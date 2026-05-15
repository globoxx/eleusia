import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { io as createClient, Socket } from 'socket.io-client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createGameServer } from '../../server';
import type { ClientRoomData, CreateRoomPayload, RoomAck } from '../shared/types';
import { MemoryTeacherStore } from './teacherStore';

const createdServers: ReturnType<typeof createGameServer>[] = [];
const createdSockets: Socket[] = [];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const socket of createdSockets.splice(0)) {
    socket.close();
  }
  for (const server of createdServers.splice(0)) {
    server.close();
  }
  vi.restoreAllMocks();
});

test('creates and joins rooms with acknowledgements without leaking creator-only fields to players', async () => {
  const { server, url } = await startTestServer();
  createdServers.push(server);
  const creator = await connectClient(url);
  const player = await connectClient(url);

  const creatorUpdatePromise = once<ClientRoomData>(creator, 'updateRoomData');
  const createAck = await emitWithAck<RoomAck>(creator, 'createRoom', createPayload());
  const creatorData = await creatorUpdatePromise;

  expect(createAck.ok).toBe(true);
  expect(createAck.ok && createAck.role === 'creator' ? createAck.creatorToken : '').toHaveLength(36);
  expect('rule' in creatorData).toBe(true);

  const playerUpdatePromise = once<ClientRoomData>(player, 'updateRoomData');
  const joinAck = await emitWithAck<RoomAck>(player, 'joinRoom', { roomId: 'room1', pseudo: 'Alice' });
  const playerData = await playerUpdatePromise;

  expect(joinAck.ok).toBe(true);
  expect('rule' in playerData).toBe(false);
  expect(playerData.users.Alice).not.toHaveProperty('socketId');
  expect(playerData.users.Alice).not.toHaveProperty('participantToken');
  expect(playerData.users.Alice).not.toHaveProperty('vote');
});

test('does not publish open room codes on connection and joins by direct code', async () => {
  const { server, url } = await startTestServer();
  createdServers.push(server);
  const creator = await connectClient(url);
  const player = await connectClient(url);

  const updateRoomsPromise = onceWithTimeout<string[]>(player, 'updateRooms', 30);
  await emitWithAck<RoomAck>(creator, 'createRoom', createPayload());
  const joinAck = await emitWithAck<RoomAck>(player, 'joinRoom', { roomId: 'room1', pseudo: 'Alice' });
  const missingAck = await emitWithAck<RoomAck>(player, 'joinRoom', { roomId: 'missing', pseudo: 'Bob' });

  await expect(updateRoomsPromise).resolves.toBeNull();
  expect(joinAck.ok).toBe(true);
  expect(missingAck).toEqual({ ok: false, reason: 'roomNotFound' });
});

test('reconnects a disconnected player with a valid session token', async () => {
  const { server, url } = await startTestServer();
  createdServers.push(server);
  const creator = await connectClient(url);
  const player = await connectClient(url);

  await emitWithAck<RoomAck>(creator, 'createRoom', createPayload());
  const joinAck = await emitWithAck<RoomAck>(player, 'joinRoom', { roomId: 'room1', pseudo: 'Alice' });
  if (!joinAck.ok) throw new Error(joinAck.reason);
  if (joinAck.role !== 'player') throw new Error('Expected player ack');

  player.close();
  const reconnectedPlayer = await connectClient(url);
  const reconnectUpdatePromise = once<ClientRoomData>(reconnectedPlayer, 'updateRoomData');
  const reconnectAck = await emitWithAck<RoomAck>(reconnectedPlayer, 'reconnectRoom', {
    roomId: 'room1',
    pseudo: 'Alice',
    participantToken: joinAck.participantToken,
  });
  const roomData = await reconnectUpdatePromise;

  expect(reconnectAck.ok).toBe(true);
  expect(roomData.users.Alice.connected).toBe(true);
});

test('reconnects a disconnected creator with a valid creator token', async () => {
  const { server, url } = await startTestServer();
  createdServers.push(server);
  const creator = await connectClient(url);

  const createAck = await emitWithAck<RoomAck>(creator, 'createRoom', createPayload());
  if (!createAck.ok) throw new Error(createAck.reason);
  if (createAck.role !== 'creator') throw new Error('Expected creator ack');

  creator.close();
  const reconnectedCreator = await connectClient(url);
  const reconnectUpdatePromise = once<ClientRoomData>(reconnectedCreator, 'updateRoomData');
  const reconnectAck = await emitWithAck<RoomAck>(reconnectedCreator, 'reconnectCreator', {
    roomId: 'room1',
    creatorToken: createAck.creatorToken,
  });
  const roomData = await reconnectUpdatePromise;

  expect(reconnectAck.ok).toBe(true);
  expect(roomData.creatorConnected).toBe(true);
});

test('creation and launch do not require a creator pseudo and never add the creator to users', async () => {
  const teacherStore = new MemoryTeacherStore();
  const { server, url } = await startTestServer(120000, teacherStore);
  createdServers.push(server);
  const creator = await connectClient(url);

  const createAck = await emitWithAck<RoomAck>(creator, 'createRoom', createPayload());
  expect(createAck.ok).toBe(true);
  expect(server.data.room1.users.Teacher).toBeUndefined();

  const registerResponse = await fetch(`${url}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nopseudo@example.com', password: 'password-123' }),
  });
  const cookie = readSetCookie(registerResponse);
  const templateResponse = await fetch(`${url}/api/teacher/room-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      name: 'No pseudo',
      roundDuration: 10,
      imageSet: 'cards',
      rule: 'Accept red cards',
      autoRun: true,
      hasAI: false,
      sizeLimit: 30,
      refusedImages: ['images/cards/1.png'],
      acceptedImages: ['images/cards/2.png'],
    }),
  });
  const { template } = (await templateResponse.json()) as { template: { id: string } };
  const persistentCreator = await connectClient(url, cookie);
  const launchAck = await emitWithAck<RoomAck>(persistentCreator, 'launchRoomTemplate', { templateId: template.id, roomId: 'CLASS-2' });

  expect(launchAck.ok).toBe(true);
  expect(server.data['CLASS-2'].users.Teacher).toBeUndefined();
});

test('expires the creator after the reconnection grace period and reveals the rule', async () => {
  const { server, url } = await startTestServer(20);
  createdServers.push(server);
  const creator = await connectClient(url);
  const player = await connectClient(url);

  await emitWithAck<RoomAck>(creator, 'createRoom', createPayload());
  await emitWithAck<RoomAck>(player, 'joinRoom', { roomId: 'room1', pseudo: 'Alice' });

  const finishedPromise = waitForRoomData(player, (roomData) => roomData.hasFinished);
  creator.close();
  const finishedRoom = await finishedPromise;

  expect(finishedRoom.hasFinished).toBe(true);
  expect(finishedRoom.revealedRule).toBe('Accept red cards');
});

test('rejects stale round votes server-side', async () => {
  const { server, url } = await startTestServer();
  createdServers.push(server);
  const creator = await connectClient(url);
  const player = await connectClient(url);

  await emitWithAck<RoomAck>(creator, 'createRoom', { ...createPayload(), autoRun: false, acceptedImages: [], refusedImages: [] });
  await emitWithAck<RoomAck>(player, 'joinRoom', { roomId: 'room1', pseudo: 'Alice' });

  const newRoundPromise = once<{ roundId: number; image: string }>(player, 'newRound');
  creator.emit('startGame', 'room1');
  const round = await newRoundPromise;

  const rejectionPromise = once<string>(player, 'actionRejected');
  player.emit('vote', { roomId: 'room1', roundId: round.roundId + 1, vote: 1 });

  await expect(rejectionPromise).resolves.toBe('staleRound');
});

test('allows the creator to start alone and exposes status transitions', async () => {
  const { server, url } = await startTestServer();
  createdServers.push(server);
  const creator = await connectClient(url);

  await emitWithAck<RoomAck>(creator, 'createRoom', { ...createPayload(), autoRun: false, acceptedImages: [], refusedImages: [] });

  const runningPromise = waitForRoomData(creator, (roomData) => roomData.status === 'running');
  creator.emit('startGame', 'room1');
  const runningRoom = await runningPromise;
  expect(runningRoom.status).toBe('running');

  const pausedPromise = waitForRoomData(creator, (roomData) => roomData.status === 'paused');
  creator.emit('pause', 'room1');
  const pausedRoom = await pausedPromise;
  expect(pausedRoom.paused).toBe(true);
});

test('waits for the creator once and records complete round history including non-responses and AI', async () => {
  const { server, url } = await startTestServer();
  createdServers.push(server);
  const creator = await connectClient(url);
  const player = await connectClient(url);

  await emitWithAck<RoomAck>(creator, 'createRoom', { ...createPayload(), autoRun: false, hasAI: true, acceptedImages: [], refusedImages: [] });
  await emitWithAck<RoomAck>(player, 'joinRoom', { roomId: 'room1', pseudo: 'Alice' });

  const newRoundPromise = once<{ roundId: number; image: string }>(creator, 'newRound');
  creator.emit('startGame', 'room1');
  const round = await newRoundPromise;
  server.data.room1.timer = 1;

  const waitCreatorEvents: unknown[] = [];
  creator.on('waitCreator', (payload) => waitCreatorEvents.push(payload));
  await waitForRoomData(creator, (roomData) => roomData.status === 'waitingCreator');
  await new Promise((resolve) => setTimeout(resolve, 1200));
  expect(waitCreatorEvents).toHaveLength(1);

  const endPromise = waitForRoomData(creator, (roomData) => roomData.roundHistory.length === 1);
  creator.emit('vote', { roomId: 'room1', roundId: round.roundId, vote: 1 });
  const roomData = await endPromise;
  const history = roomData.roundHistory[0];

  expect(history).toMatchObject({
    roundId: round.roundId,
    image: round.image,
    label: 'Accepté',
    creatorVote: 1,
  });
  expect(history.startedAt).toBeGreaterThan(0);
  expect(history.endedAt).toBeGreaterThanOrEqual(history.startedAt);
  expect(history.participantResults.Alice).toMatchObject({ vote: null, responded: false, points: 0, isAI: false });
  expect(history.participantResults['Eleus-IA']).toMatchObject({ vote: null, responded: false, points: 0, isAI: true });
});

test('registers a teacher, stores a template, and launches it as a persistent live room', async () => {
  const teacherStore = new MemoryTeacherStore();
  const { server, url } = await startTestServer(120000, teacherStore);
  createdServers.push(server);

  const registerResponse = await fetch(`${url}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher@example.com', password: 'password-123' }),
  });
  expect(registerResponse.status).toBe(200);
  const cookie = readSetCookie(registerResponse);

  const templateResponse = await fetch(`${url}/api/teacher/room-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      name: 'Red cards',
      roundDuration: 10,
      imageSet: 'cards',
      rule: 'Accept red cards',
      autoRun: true,
      hasAI: false,
      sizeLimit: 30,
      refusedImages: ['images/cards/1.png'],
      acceptedImages: ['images/cards/2.png'],
    }),
  });
  expect(templateResponse.status).toBe(201);
  const { template } = (await templateResponse.json()) as { template: { id: string } };

  const creator = await connectClient(url, cookie);
  const creatorUpdatePromise = once<ClientRoomData>(creator, 'updateRoomData');
  const launchAck = await emitWithAck<RoomAck>(creator, 'launchRoomTemplate', { templateId: template.id, roomId: 'CLASS-1' });
  const creatorRoomData = await creatorUpdatePromise;

  expect(launchAck.ok).toBe(true);
  if (!launchAck.ok) throw new Error(launchAck.reason);
  if (launchAck.role !== 'creator') throw new Error('Expected creator ack');
  expect(launchAck.sessionId).toBeTruthy();
  expect(launchAck.roomId).toBe('CLASS-1');
  expect('rule' in creatorRoomData).toBe(true);

  const player = await connectClient(url);
  const joinAck = await emitWithAck<RoomAck>(player, 'joinRoom', { roomId: launchAck.roomId, pseudo: 'Alice' });
  expect(joinAck.ok).toBe(true);

  const sessions = await teacherStore.listRoomSessions((await teacherStore.findTeacherByEmail('teacher@example.com'))?.id ?? '');
  expect(sessions).toHaveLength(1);
  expect(sessions[0].templateId).toBe(template.id);
  expect(sessions[0].liveRoomId).toBe(launchAck.roomId);
});

test('rejects only active duplicate live room codes and allows reusing a finished session code', async () => {
  const teacherStore = new MemoryTeacherStore();
  const { server, url } = await startTestServer(120000, teacherStore);
  createdServers.push(server);

  const registerResponse = await fetch(`${url}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'reuse@example.com', password: 'password-123' }),
  });
  const cookie = readSetCookie(registerResponse);

  const templateResponse = await fetch(`${url}/api/teacher/room-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      name: 'Reusable code',
      roundDuration: 10,
      imageSet: 'cards',
      rule: 'Accept red cards',
      autoRun: true,
      hasAI: false,
      sizeLimit: 30,
      refusedImages: ['images/cards/1.png'],
      acceptedImages: ['images/cards/2.png'],
    }),
  });
  const { template } = (await templateResponse.json()) as { template: { id: string } };

  const firstCreator = await connectClient(url, cookie);
  const firstAck = await emitWithAck<RoomAck>(firstCreator, 'launchRoomTemplate', { templateId: template.id, roomId: 'CLASS-1' });
  expect(firstAck.ok).toBe(true);

  const secondCreator = await connectClient(url, cookie);
  const activeDuplicateAck = await emitWithAck<RoomAck>(secondCreator, 'launchRoomTemplate', { templateId: template.id, roomId: 'CLASS-1' });
  expect(activeDuplicateAck).toEqual({ ok: false, reason: 'roomAlreadyExists' });

  firstCreator.emit('endGame', 'CLASS-1');
  await waitForRoomData(firstCreator, (roomData) => roomData.status === 'finished');
  delete server.data['CLASS-1'];

  const replayAck = await emitWithAck<RoomAck>(secondCreator, 'launchRoomTemplate', { templateId: template.id, roomId: 'CLASS-1' });
  expect(replayAck.ok).toBe(true);

  const sessions = await teacherStore.listRoomSessions((await teacherStore.findTeacherByEmail('reuse@example.com'))?.id ?? '');
  expect(sessions.filter((session) => session.liveRoomId === 'CLASS-1')).toHaveLength(2);
});

async function startTestServer(reconnectGraceMs = 120000, teacherStore?: MemoryTeacherStore) {
  const staticPath = createStaticFixture();
  const server = createGameServer({ staticPath, imagesFolder: path.join(staticPath, 'images'), nodeEnv: 'test', reconnectGraceMs, teacherStore });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const address = server.httpServer.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${address.port.toString()}` };
}

function createStaticFixture() {
  const staticPath = fs.mkdtempSync(path.join(os.tmpdir(), 'eleusia-test-'));
  fs.mkdirSync(path.join(staticPath, 'images', 'cards'), { recursive: true });
  fs.writeFileSync(path.join(staticPath, 'index.html'), '<!doctype html><html><body></body></html>');
  fs.writeFileSync(path.join(staticPath, 'images', 'cards', '1.png'), '');
  fs.writeFileSync(path.join(staticPath, 'images', 'cards', '2.png'), '');
  return staticPath;
}

function createPayload(): CreateRoomPayload {
  return {
    roomId: 'room1',
    roundDuration: 10,
    imageSet: 'cards',
    rule: 'Accept red cards',
    autoRun: true,
    hasAI: false,
    sizeLimit: 30,
    refusedImages: ['images/cards/1.png'],
    acceptedImages: ['images/cards/2.png'],
  };
}

async function connectClient(url: string, cookie?: string) {
  const socket = createClient(url, { forceNew: true, reconnection: false, transports: ['websocket'], extraHeaders: cookie ? { Cookie: cookie } : undefined });
  createdSockets.push(socket);
  await once(socket, 'connect');
  return socket;
}

function readSetCookie(response: Response) {
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  const cookie = getSetCookie?.[0] ?? response.headers.get('set-cookie');
  if (!cookie) throw new Error('Missing Set-Cookie header');
  return cookie.split(';')[0];
}

function once<T>(socket: Socket, event: string) {
  return new Promise<T>((resolve) => {
    socket.once(event, resolve);
  });
}

function onceWithTimeout<T>(socket: Socket, event: string, timeoutMs: number) {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      resolve(null);
    }, timeoutMs);
    const listener = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(payload);
    };
    socket.on(event, listener);
  });
}

function emitWithAck<T>(socket: Socket, event: string, payload: unknown) {
  return new Promise<T>((resolve) => {
    socket.emit(event, payload, resolve);
  });
}

function waitForRoomData(socket: Socket, predicate: (roomData: ClientRoomData) => boolean) {
  return new Promise<ClientRoomData>((resolve) => {
    const listener = (roomData: ClientRoomData) => {
      if (!predicate(roomData)) return;
      socket.off('updateRoomData', listener);
      resolve(roomData);
    };

    socket.on('updateRoomData', listener);
  });
}
