import cors from 'cors';
import express from 'express';
import * as fs from 'fs';
import { createServer } from 'http';
import path from 'path';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import type {
  CreateRoomPayload,
  Data,
  ImageCatalog,
  JoinRoomPayload,
  LaunchRoomTemplatePayload,
  ParticipantRoundResult,
  ReconnectRoomPayload,
  RoomAck,
  RoomData,
  RoomStatus,
  RoomTemplatePayload,
  VotePayload,
} from './src/shared/types';
import {
  AI_PSEUDO,
  AI_SOCKET_ID,
  RECONNECT_GRACE_MS,
  ROOM_CLEANUP_DELAY_MS,
  buildClientRoomData,
  calculatePoints,
  countPlayers,
  createRoomData,
  createUser,
  hasHumanUsers,
  isValidPseudo,
  isValidRoomId,
  normalizeVote,
  setRoomStatus,
  toPublicUser,
  validateCreateRoomInput,
} from './src/server/gameState';
import { authenticateTeacher } from './src/server/auth';
import { setupTeacherRoutes } from './src/server/teacherRoutes';
import { createTeacherStoreFromEnv, type TeacherStore } from './src/server/teacherStore';

interface SocketSession {
  roomId: string;
  pseudo: string;
}

interface CreateGameServerOptions {
  port?: number;
  buildPath?: string;
  staticPath?: string;
  imagesFolder?: string;
  nodeEnv?: string;
  allowedOrigin?: string;
  reconnectGraceMs?: number;
  roomCleanupDelayMs?: number;
  teacherStore?: TeacherStore;
}

type RoomAckCallback = (ack: RoomAck) => void;

const DEFAULT_PORT = 5000;

export function createGameServer(options: CreateGameServerOptions = {}) {
  const app = express();
  const httpServer = createServer(app);
  const corsOrigin = createCorsOrigin(options.nodeEnv ?? process.env.NODE_ENV, options.allowedOrigin ?? process.env.SOCKET_ALLOWED_ORIGIN);
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  const port = options.port ?? (Number(process.env.PORT) || DEFAULT_PORT);
  const buildPath = options.buildPath ?? process.env.BUILD_PATH ?? path.join(process.cwd(), 'dist', 'client');
  const staticPath = options.staticPath ?? (fs.existsSync(buildPath) ? buildPath : path.join(process.cwd(), 'public'));
  const imagesFolder = options.imagesFolder ?? path.join(staticPath, 'images');
  const allImages = readImageCatalog(imagesFolder);
  const teacherStore = options.teacherStore ?? createTeacherStoreFromEnv(options.nodeEnv ?? process.env.NODE_ENV);

  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: corsOrigin }));
  app.use(express.static(staticPath));
  app.use('/images', express.static(imagesFolder));
  setupTeacherRoutes({ app, store: teacherStore, allImages, nodeEnv: options.nodeEnv ?? process.env.NODE_ENV });

  app.use((_req, res) => {
    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }

    res.status(404).send('Client build not found. Run npm run build or use npm run start:client.');
  });

  const data: Data = {};
  const sessions = new Map<string, SocketSession>();
  const cleanupTimers = new Map<string, NodeJS.Timeout>();
  const reconnectTimers = new Map<string, NodeJS.Timeout>();
  const reconnectGraceMs = options.reconnectGraceMs ?? RECONNECT_GRACE_MS;
  const roomCleanupDelayMs = options.roomCleanupDelayMs ?? ROOM_CLEANUP_DELAY_MS;

  void teacherStore.expireOpenRoomSessions().catch((error: unknown) => log('teacher_session_expire_failed', { error: String(error) }));

  io.on('connection', (socket: Socket) => {
    socket.emit('updateImages', allImages);

    socket.on('createRoom', (payload: unknown, ack?: RoomAckCallback) => {
      if (!isCreateRoomPayload(payload)) {
        reject(socket, 'invalidRoom', ack);
        return;
      }

      const validation = validateCreateRoomInput(payload, allImages);
      if (!validation.ok) {
        reject(socket, validation.reason, ack);
        return;
      }

      if (payload.roomId in data) {
        reject(socket, 'roomAlreadyExists', ack);
        return;
      }

      if (sessions.has(socket.id)) {
        reject(socket, 'alreadyInRoom', ack);
        return;
      }

      const participantToken = randomUUID();
      data[payload.roomId] = createRoomData(payload, socket.id, allImages, participantToken);
      sessions.set(socket.id, { roomId: payload.roomId, pseudo: payload.pseudo });
      socket.join(payload.roomId);
      cancelRoomCleanup(payload.roomId);

      log('room_created', { roomId: payload.roomId, pseudo: payload.pseudo });
      ack?.({ ok: true, roomId: payload.roomId, pseudo: payload.pseudo, participantToken });
      emitRoomData(payload.roomId);
    });

    socket.on('launchRoomTemplate', async (payload: unknown, ack?: RoomAckCallback) => {
      try {
      if (!isLaunchRoomTemplatePayload(payload)) {
        reject(socket, 'invalidTemplateLaunch', ack);
        return;
      }

      if (!teacherStore.available) {
        reject(socket, 'teacherStorageUnavailable', ack);
        return;
      }

      const teacher = await authenticateTeacher(socket.request.headers, teacherStore);
      if (!teacher) {
        reject(socket, 'notAuthenticated', ack);
        return;
      }

      if (sessions.has(socket.id)) {
        reject(socket, 'alreadyInRoom', ack);
        return;
      }

      const template = await teacherStore.getRoomTemplate(teacher.id, payload.templateId);
      if (!template) {
        reject(socket, 'templateNotFound', ack);
        return;
      }

      const createPayload: CreateRoomPayload = {
        ...templateToCreatePayload(template),
        pseudo: payload.pseudo,
        roomId: payload.roomId,
      };
      const validation = validateCreateRoomInput(createPayload, allImages);
      if (!validation.ok) {
        reject(socket, validation.reason, ack);
        return;
      }
      if (payload.roomId in data) {
        reject(socket, 'roomAlreadyExists', ack);
        return;
      }

      const persistentSession = await teacherStore.createRoomSession({
        teacherId: teacher.id,
        templateId: template.id,
        liveRoomId: payload.roomId,
        status: 'lobby',
        initialConfig: templateToPayload(template),
      });

      const participantToken = randomUUID();
      const roomData = createRoomData(createPayload, socket.id, allImages, participantToken);
      roomData.teacherId = teacher.id;
      roomData.templateId = template.id;
      roomData.persistentSessionId = persistentSession.id;
      data[payload.roomId] = roomData;
      sessions.set(socket.id, { roomId: payload.roomId, pseudo: payload.pseudo });
      socket.join(payload.roomId);
      cancelRoomCleanup(payload.roomId);

      log('room_template_launched', { roomId: payload.roomId, templateId: template.id, teacherId: teacher.id });
      ack?.({ ok: true, roomId: payload.roomId, pseudo: payload.pseudo, participantToken, templateId: template.id, sessionId: persistentSession.id });
      emitRoomData(payload.roomId);
      } catch (error: unknown) {
        log('room_template_launch_failed', { error: String(error) });
        reject(socket, 'templateLaunchFailed', ack);
      }
    });

    socket.on('joinRoom', (payload: unknown, ack?: RoomAckCallback) => {
      if (!isJoinRoomPayload(payload)) {
        reject(socket, 'invalidJoin', ack);
        return;
      }

      const roomData = data[payload.roomId];
      if (!roomData || roomData.status !== 'lobby') {
        reject(socket, 'roomNotFound', ack);
        return;
      }

      if (payload.pseudo in roomData.users) {
        reject(socket, 'pseudoAlreadyExists', ack);
        return;
      }

      if (countPlayers(roomData) >= roomData.sizeLimit) {
        reject(socket, 'roomFull', ack);
        return;
      }

      if (sessions.has(socket.id)) {
        reject(socket, 'alreadyInRoom', ack);
        return;
      }

      const participantToken = randomUUID();
      roomData.users[payload.pseudo] = createUser(socket.id, participantToken);
      sessions.set(socket.id, { roomId: payload.roomId, pseudo: payload.pseudo });
      socket.join(payload.roomId);
      cancelRoomCleanup(payload.roomId);

      log('room_joined', { roomId: payload.roomId, pseudo: payload.pseudo });
      ack?.({ ok: true, roomId: payload.roomId, pseudo: payload.pseudo, participantToken });
      emitRoomData(payload.roomId);
    });

    socket.on('reconnectRoom', (payload: unknown, ack?: RoomAckCallback) => {
      if (!isReconnectRoomPayload(payload)) {
        reject(socket, 'invalidReconnect', ack);
        return;
      }

      const roomData = data[payload.roomId];
      const user = roomData?.users[payload.pseudo];
      if (!roomData || !user || user.participantToken !== payload.participantToken || isTerminalStatus(roomData.status)) {
        reject(socket, 'invalidReconnect', ack);
        return;
      }

      const previousSocketId = user.socketId;
      if (previousSocketId && previousSocketId !== socket.id) {
        sessions.delete(previousSocketId);
        io.sockets.sockets.get(previousSocketId)?.leave(payload.roomId);
      }

      user.socketId = socket.id;
      user.connected = true;
      user.disconnectedAt = null;
      sessions.set(socket.id, { roomId: payload.roomId, pseudo: payload.pseudo });
      socket.join(payload.roomId);
      cancelReconnectTimer(payload.roomId, payload.pseudo);
      cancelRoomCleanup(payload.roomId);

      log('room_reconnected', { roomId: payload.roomId, pseudo: payload.pseudo });
      ack?.({ ok: true, roomId: payload.roomId, pseudo: payload.pseudo, participantToken: payload.participantToken });
      emitRoomData(payload.roomId);
    });

    socket.on('startGame', async (roomId: unknown) => {
      if (!isCreatorSocket(socket, roomId)) {
        reject(socket, 'notRoomCreator');
        return;
      }

      const roomData = data[roomId];
      if (!roomData || roomData.status !== 'lobby') return;

      setRoomStatus(roomData, 'running');
      await persistRoomSession(roomId, { status: 'running', startedAt: new Date() });
      log('game_started', { roomId });
      startNewRound(roomId);
    });

    socket.on('vote', (payload: unknown) => {
      const votePayload = validateVotePayload(socket, payload, false);
      if (!votePayload) return;

      const session = sessions.get(socket.id);
      if (!session) return;

      const roomData = data[votePayload.roomId];
      const user = roomData.users[session.pseudo];
      user.vote = votePayload.vote;
      user.voteRoundId = votePayload.roundId;
      if (roomData.status === 'waitingCreator') {
        setRoomStatus(roomData, 'running');
      }
      emitRoomData(votePayload.roomId);
    });

    socket.on('aiVote', (payload: unknown) => {
      const votePayload = validateVotePayload(socket, payload, true);
      if (!votePayload) return;

      const roomData = data[votePayload.roomId];
      const aiUser = roomData.users[AI_PSEUDO];
      if (!aiUser) {
        reject(socket, 'invalidAiVote');
        return;
      }

      aiUser.vote = votePayload.vote;
      aiUser.voteRoundId = votePayload.roundId;
      emitRoomData(votePayload.roomId);
    });

    socket.on('endGame', (roomId: unknown) => {
      if (!isCreatorSocket(socket, roomId)) {
        reject(socket, 'notRoomCreator');
        return;
      }

      const roomData = data[roomId];
      if (!roomData) return;

      finishRoom(roomId);
    });

    socket.on('leaveRoom', (roomId: unknown) => {
      if (!isValidRoomId(roomId)) {
        reject(socket, 'invalidRoom');
        return;
      }

      removeSocketFromRoom(socket, true);
    });

    socket.on('pause', async (roomId: unknown) => {
      if (!isCreatorSocket(socket, roomId)) {
        reject(socket, 'notRoomCreator');
        return;
      }

      const roomData = data[roomId];
      if (!roomData || isTerminalStatus(roomData.status)) return;

      setRoomStatus(roomData, roomData.status === 'paused' ? 'running' : 'paused');
      await persistRoomSession(roomId, { status: roomData.status });
      emitRoomData(roomId);
    });

    socket.on('disconnect', () => {
      removeSocketFromRoom(socket, false);
    });
  });

  function emitRoomData(roomId: string) {
    const roomData = data[roomId];
    if (!roomData) return;

    for (const [pseudo, user] of Object.entries(roomData.users)) {
      if (!user.connected || user.socketId === AI_SOCKET_ID) continue;
      io.to(user.socketId).emit('updateRoomData', buildClientRoomData(roomData, pseudo));
    }
  }

  function reject(socket: Socket, reason: string, ack?: RoomAckCallback) {
    log('action_rejected', { socketId: socket.id, reason });
    ack?.({ ok: false, reason });
    socket.emit('actionRejected', reason);
  }

  function isCreatorSocket(socket: Socket, roomId: unknown): roomId is string {
    if (!isValidRoomId(roomId)) return false;

    const session = sessions.get(socket.id);
    const roomData = data[roomId];
    return Boolean(session && roomData && session.roomId === roomId && roomData.creator === session.pseudo);
  }

  function validateVotePayload(socket: Socket, payload: unknown, isAiVote: boolean): VotePayload | null {
    if (!isVotePayload(payload)) {
      reject(socket, isAiVote ? 'invalidAiVote' : 'invalidVote');
      return null;
    }

    const roomData = data[payload.roomId];
    const vote = normalizeVote(payload.vote);
    if (!roomData || vote === null) {
      reject(socket, isAiVote ? 'invalidAiVote' : 'invalidVote');
      return null;
    }

    if (isTerminalStatus(roomData.status) || roomData.status === 'paused' || !roomData.currentRoundId) {
      reject(socket, 'voteClosed');
      return null;
    }

    if (payload.roundId !== roomData.currentRoundId) {
      reject(socket, 'staleRound');
      return null;
    }

    if (isAiVote) {
      if (roomData.status !== 'running' || roomData.timer <= 0) {
        reject(socket, 'voteClosed');
        return null;
      }

      if (!isCreatorSocket(socket, payload.roomId) || !roomData.hasAI) {
        reject(socket, 'invalidAiVote');
        return null;
      }

      const aiUser = roomData.users[AI_PSEUDO];
      if (!aiUser || aiUser.voteRoundId === payload.roundId) {
        reject(socket, 'duplicateVote');
        return null;
      }

      return { ...payload, vote };
    }

    const session = sessions.get(socket.id);
    const user = session?.roomId === payload.roomId ? roomData.users[session.pseudo] : null;
    if (!session || !user || user.socketId !== socket.id || !user.connected) {
      reject(socket, 'invalidVote');
      return null;
    }

    if (roomData.status === 'waitingCreator') {
      if (session.pseudo !== roomData.creator) {
        reject(socket, 'voteClosed');
        return null;
      }
    } else if (roomData.status !== 'running' || roomData.timer <= 0) {
      reject(socket, 'voteClosed');
      return null;
    }

    if (user.voteRoundId === payload.roundId) {
      reject(socket, 'duplicateVote');
      return null;
    }

    return { ...payload, vote };
  }

  function removeSocketFromRoom(socket: Socket, explicitLeave: boolean) {
    const session = sessions.get(socket.id);
    if (!session) return;

    sessions.delete(socket.id);
    socket.leave(session.roomId);

    const roomData = data[session.roomId];
    if (!roomData) return;

    const user = roomData.users[session.pseudo];
    if (!user || user.socketId !== socket.id) return;

    if (explicitLeave) {
      delete roomData.users[session.pseudo];
      cancelReconnectTimer(session.roomId, session.pseudo);

      if (session.pseudo === roomData.creator) {
        finishRoom(session.roomId);
      } else if (!hasHumanUsers(roomData)) {
        scheduleRoomCleanup(session.roomId);
      } else {
        emitRoomData(session.roomId);
      }

      log('room_left', { roomId: session.roomId, pseudo: session.pseudo });
      return;
    }

    user.connected = false;
    user.disconnectedAt = Date.now();
    scheduleReconnectExpiration(session.roomId, session.pseudo);

    log('room_disconnected', { roomId: session.roomId, pseudo: session.pseudo });
    emitRoomData(session.roomId);
  }

  function scheduleReconnectExpiration(roomId: string, pseudo: string) {
    cancelReconnectTimer(roomId, pseudo);

    const timer = setTimeout(() => {
      const roomData = data[roomId];
      const user = roomData?.users[pseudo];
      if (!roomData || !user || user.connected) return;

      delete roomData.users[pseudo];
      reconnectTimers.delete(reconnectTimerKey(roomId, pseudo));
      log('room_reconnect_expired', { roomId, pseudo });

      if (pseudo === roomData.creator) {
        finishRoom(roomId, 'expired');
      } else if (!hasHumanUsers(roomData)) {
        scheduleRoomCleanup(roomId);
      } else {
        emitRoomData(roomId);
      }
    }, reconnectGraceMs);

    timer.unref?.();
    reconnectTimers.set(reconnectTimerKey(roomId, pseudo), timer);
  }

  function cancelReconnectTimer(roomId: string, pseudo: string) {
    const key = reconnectTimerKey(roomId, pseudo);
    const timer = reconnectTimers.get(key);
    if (!timer) return;

    clearTimeout(timer);
    reconnectTimers.delete(key);
  }

  function reconnectTimerKey(roomId: string, pseudo: string) {
    return `${roomId}:${pseudo}`;
  }

  function finishRoom(roomId: string, status: 'finished' | 'expired' = 'finished') {
    const roomData = data[roomId];
    if (!roomData) return;

    setRoomStatus(roomData, status);
    void persistRoomSession(roomId, {
      status,
      finishedAt: new Date(),
      roundHistory: roomData.roundHistory,
      finalUsers: buildFinalUsers(roomData),
    });
    log('game_finished', { roomId });
    emitRoomData(roomId);
    scheduleRoomCleanup(roomId);
  }

  async function persistRoomSession(roomId: string, patch: { status?: RoomStatus; startedAt?: Date; finishedAt?: Date; roundHistory?: unknown; finalUsers?: unknown }) {
    const roomData = data[roomId];
    if (!roomData?.persistentSessionId || !teacherStore.available) return;

    try {
      await teacherStore.updateRoomSession(roomData.persistentSessionId, {
        status: patch.status,
        startedAt: patch.startedAt,
        finishedAt: patch.finishedAt,
        roundHistory: patch.roundHistory,
        finalUsers: patch.finalUsers,
      });
    } catch (error: unknown) {
      log('room_session_persist_failed', { roomId, error: String(error) });
    }
  }

  function scheduleRoomCleanup(roomId: string) {
    cancelRoomCleanup(roomId);

    const timer = setTimeout(() => {
      delete data[roomId];
      cleanupTimers.delete(roomId);
      log('room_cleaned', { roomId });
    }, roomCleanupDelayMs);

    timer.unref?.();
    cleanupTimers.set(roomId, timer);
  }

  function cancelRoomCleanup(roomId: string) {
    const timer = cleanupTimers.get(roomId);
    if (!timer) return;

    clearTimeout(timer);
    cleanupTimers.delete(roomId);
  }

  function startNewRound(roomId: string) {
    const roomData = data[roomId];
    if (!roomData) return;

    if (roomData.images.length === 0) {
      finishRoom(roomId);
      return;
    }

    const randomIndex = Math.floor(Math.random() * roomData.images.length);
    const randomImage = roomData.images[randomIndex];
    if (!randomImage) return;

    const roundId = roomData.nextRoundId;
    roomData.nextRoundId += 1;
    roomData.currentRoundId = roundId;
    roomData.currentRoundStartedAt = Date.now();
    roomData.currentImage = randomImage;
    roomData.images = roomData.images.filter((img) => img !== randomImage);
    setRoomStatus(roomData, 'running');

    for (const user of Object.values(roomData.users)) {
      user.vote = null;
      user.voteRoundId = null;
    }

    roomData.timer = roomData.roundDuration;
    io.in(roomId).emit('newRound', { roundId, image: randomImage });
    emitRoomData(roomId);
  }

  const roundInterval = setInterval(function () {
    for (const roomId of Object.keys(data)) {
      const roomData = data[roomId];
      if (roomData.status !== 'running' || !roomData.currentRoundId) continue;

      roomData.timer -= 1;
      if (Object.values(roomData.users).every((user) => !user.connected || user.voteRoundId === roomData.currentRoundId)) {
        roomData.timer = 0;
      }

      if (roomData.timer <= 0) {
        const creatorVote = roomData.users[roomData.creator]?.vote;

        if (creatorVote !== null && creatorVote !== undefined) {
          const usersPoints: Record<string, number> = {};
          const participantResults: Record<string, ParticipantRoundResult> = {};

          for (const [userPseudo, user] of Object.entries(roomData.users)) {
            if (userPseudo === roomData.creator) continue;

            const responded = user.voteRoundId === roomData.currentRoundId && user.vote !== null;
            const effectiveVote = responded ? user.vote ?? 0 : 0;
            const points = calculatePoints(creatorVote, effectiveVote);
            user.lastScore = points;
            user.allScores.push(points);
            user.totalScore += points;
            usersPoints[userPseudo] = points;
            participantResults[userPseudo] = {
              vote: responded ? user.vote : null,
              points,
              responded,
              isAI: userPseudo === AI_PSEUDO,
            };
          }

          const label = creatorVote > 0 ? 'Accepté' : 'Refusé';
          roomData.roundHistory.push({
            roundId: roomData.currentRoundId,
            image: roomData.currentImage ?? '',
            startedAt: roomData.currentRoundStartedAt ?? Date.now(),
            endedAt: Date.now(),
            label,
            creatorVote,
            participantResults,
          });

          void persistRoomSession(roomId, { status: roomData.status, roundHistory: roomData.roundHistory, finalUsers: buildFinalUsers(roomData) });
          io.in(roomId).emit('endOfRound', { roundId: roomData.currentRoundId, pointsByPseudo: usersPoints, creatorVote });
          startNewRound(roomId);
        } else {
          setRoomStatus(roomData, 'waitingCreator');
          void persistRoomSession(roomId, { status: 'waitingCreator' });
          io.in(roomId).emit('waitCreator');
          emitRoomData(roomId);
        }
      }

      io.in(roomId).emit('timer', roomData.timer);
    }
  }, 1000);

  function close() {
    clearInterval(roundInterval);
    for (const timer of cleanupTimers.values()) clearTimeout(timer);
    for (const timer of reconnectTimers.values()) clearTimeout(timer);
    io.close();
    httpServer.close();
    void teacherStore.close();
  }

  return {
    app,
    httpServer,
    io,
    port,
    data,
    sessions,
    close,
  };
}

function readImageCatalog(rootFolder: string): ImageCatalog {
  const catalog: ImageCatalog = {};
  if (!fs.existsSync(rootFolder)) {
    throw new Error(`Image catalog folder not found: ${rootFolder}`);
  }

  const imageFolders = fs.readdirSync(rootFolder, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  for (const imageFolder of imageFolders) {
    catalog[imageFolder.name] = fs
      .readdirSync(path.join(rootFolder, imageFolder.name))
      .filter((file) => file.endsWith('.png') || file.endsWith('.jpg'))
      .map((file) => ['images', imageFolder.name, file].join('/'));
  }

  return catalog;
}

function createCorsOrigin(nodeEnv: string | undefined, allowedOrigin: string | undefined) {
  const allowedOrigins = allowedOrigin
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (nodeEnv === 'production' && (!allowedOrigins || allowedOrigins.length === 0)) {
    throw new Error('SOCKET_ALLOWED_ORIGIN is required in production.');
  }

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins?.includes(origin) || (nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  };
}

function isCreateRoomPayload(payload: unknown): payload is CreateRoomPayload {
  if (!payload || typeof payload !== 'object') return false;
  const input = payload as Record<string, unknown>;

  return (
    typeof input.pseudo === 'string' &&
    typeof input.roomId === 'string' &&
    typeof input.roundDuration === 'number' &&
    typeof input.imageSet === 'string' &&
    typeof input.rule === 'string' &&
    typeof input.autoRun === 'boolean' &&
    typeof input.hasAI === 'boolean' &&
    typeof input.sizeLimit === 'number' &&
    Array.isArray(input.refusedImages) &&
    input.refusedImages.every((image) => typeof image === 'string') &&
    Array.isArray(input.acceptedImages) &&
    input.acceptedImages.every((image) => typeof image === 'string')
  );
}

function isJoinRoomPayload(payload: unknown): payload is JoinRoomPayload {
  if (!payload || typeof payload !== 'object') return false;
  const input = payload as Record<string, unknown>;

  return isValidRoomId(input.roomId) && isValidPseudo(input.pseudo);
}

function isReconnectRoomPayload(payload: unknown): payload is ReconnectRoomPayload {
  if (!payload || typeof payload !== 'object') return false;
  const input = payload as Record<string, unknown>;

  return isValidRoomId(input.roomId) && isValidPseudo(input.pseudo) && typeof input.participantToken === 'string';
}

function isLaunchRoomTemplatePayload(payload: unknown): payload is LaunchRoomTemplatePayload {
  if (!payload || typeof payload !== 'object') return false;
  const input = payload as Record<string, unknown>;
  return typeof input.templateId === 'string' && input.templateId.length > 0 && isValidRoomId(input.roomId) && isValidPseudo(input.pseudo);
}

function isVotePayload(payload: unknown): payload is VotePayload {
  if (!payload || typeof payload !== 'object') return false;
  const input = payload as Record<string, unknown>;

  return isValidRoomId(input.roomId) && typeof input.roundId === 'number' && Number.isInteger(input.roundId) && typeof input.vote === 'number';
}

function templateToPayload(template: RoomTemplatePayload): RoomTemplatePayload {
  return {
    name: template.name,
    rule: template.rule,
    roundDuration: template.roundDuration,
    imageSet: template.imageSet,
    autoRun: template.autoRun,
    hasAI: template.hasAI,
    sizeLimit: template.sizeLimit,
    acceptedImages: template.autoRun ? template.acceptedImages : [],
    refusedImages: template.autoRun ? template.refusedImages : [],
  };
}

function templateToCreatePayload(template: RoomTemplatePayload): Omit<CreateRoomPayload, 'pseudo' | 'roomId'> {
  return {
    roundDuration: template.roundDuration,
    imageSet: template.imageSet,
    rule: template.rule,
    autoRun: template.autoRun,
    hasAI: template.hasAI,
    sizeLimit: template.sizeLimit,
    acceptedImages: template.autoRun ? template.acceptedImages : [],
    refusedImages: template.autoRun ? template.refusedImages : [],
  };
}

function buildFinalUsers(roomData: RoomData) {
  return Object.fromEntries(Object.entries(roomData.users).map(([pseudo, user]) => [pseudo, toPublicUser(user)]));
}

function isTerminalStatus(status: string) {
  return status === 'finished' || status === 'expired';
}

function log(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...details }));
}

if (require.main === module) {
  const server = createGameServer();
  server.httpServer.listen(server.port, () => console.log(`Listening on port ${server.port.toString()}`));
}
