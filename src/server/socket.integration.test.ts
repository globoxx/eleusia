import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { io as createClient, Socket } from 'socket.io-client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createGameServer } from '../../server';
import type { ClientRoomData, CreateRoomPayload, RoomAck } from '../shared/types';

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
  expect(createAck.ok ? createAck.participantToken : '').toHaveLength(36);
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

async function startTestServer(reconnectGraceMs = 120000) {
  const staticPath = createStaticFixture();
  const server = createGameServer({ staticPath, imagesFolder: path.join(staticPath, 'images'), nodeEnv: 'test', reconnectGraceMs });
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
    pseudo: 'Teacher',
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

async function connectClient(url: string) {
  const socket = createClient(url, { forceNew: true, reconnection: false, transports: ['websocket'] });
  createdSockets.push(socket);
  await once(socket, 'connect');
  return socket;
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
