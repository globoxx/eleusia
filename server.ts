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
  ReconnectRoomPayload,
  RoomAck,
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
  getOpenRoomIds,
  hasHumanUsers,
  isValidPseudo,
  isValidRoomId,
  normalizeVote,
  validateCreateRoomInput,
} from './src/server/gameState';

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

  app.use(cors({ origin: corsOrigin }));
  app.use(express.static(staticPath));
  app.use('/images', express.static(imagesFolder));

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
  const allImages = readImageCatalog(imagesFolder);

  io.on('connection', (socket: Socket) => {
    socket.emit('updateRooms', getOpenRoomIds(data));
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
      emitRooms();
    });

    socket.on('joinRoom', (payload: unknown, ack?: RoomAckCallback) => {
      if (!isJoinRoomPayload(payload)) {
        reject(socket, 'invalidJoin', ack);
        return;
      }

      const roomData = data[payload.roomId];
      if (!roomData || roomData.hasStarted || roomData.hasFinished) {
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
      if (!roomData || !user || user.participantToken !== payload.participantToken || roomData.hasFinished) {
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

    socket.on('startGame', (roomId: unknown) => {
      if (!isCreatorSocket(socket, roomId)) {
        reject(socket, 'notRoomCreator');
        return;
      }

      const roomData = data[roomId];
      if (!roomData || roomData.hasStarted || roomData.hasFinished) return;

      roomData.hasStarted = true;
      log('game_started', { roomId });
      emitRooms();
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
      roomData.waitingForCreator = false;
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

    socket.on('pause', (roomId: unknown) => {
      if (!isCreatorSocket(socket, roomId)) {
        reject(socket, 'notRoomCreator');
        return;
      }

      const roomData = data[roomId];
      if (!roomData || roomData.hasFinished) return;

      roomData.paused = !roomData.paused;
      emitRoomData(roomId);
    });

    socket.on('disconnect', () => {
      removeSocketFromRoom(socket, false);
    });
  });

  function emitRooms() {
    io.emit('updateRooms', getOpenRoomIds(data));
  }

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

    if (!roomData.hasStarted || roomData.hasFinished || roomData.paused || !roomData.currentRoundId || roomData.timer <= 0) {
      reject(socket, 'voteClosed');
      return null;
    }

    if (payload.roundId !== roomData.currentRoundId) {
      reject(socket, 'staleRound');
      return null;
    }

    if (isAiVote) {
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
        emitRooms();
      }

      log('room_left', { roomId: session.roomId, pseudo: session.pseudo });
      return;
    }

    user.connected = false;
    user.disconnectedAt = Date.now();
    scheduleReconnectExpiration(session.roomId, session.pseudo);

    log('room_disconnected', { roomId: session.roomId, pseudo: session.pseudo });
    emitRoomData(session.roomId);
    emitRooms();
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
        finishRoom(roomId);
      } else if (!hasHumanUsers(roomData)) {
        scheduleRoomCleanup(roomId);
      } else {
        emitRoomData(roomId);
        emitRooms();
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

  function finishRoom(roomId: string) {
    const roomData = data[roomId];
    if (!roomData) return;

    roomData.hasFinished = true;
    roomData.paused = false;
    roomData.waitingForCreator = false;
    log('game_finished', { roomId });
    emitRoomData(roomId);
    scheduleRoomCleanup(roomId);
    emitRooms();
  }

  function scheduleRoomCleanup(roomId: string) {
    cancelRoomCleanup(roomId);

    const timer = setTimeout(() => {
      delete data[roomId];
      cleanupTimers.delete(roomId);
      log('room_cleaned', { roomId });
      emitRooms();
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
    roomData.currentImage = randomImage;
    roomData.images = roomData.images.filter((img) => img !== randomImage);
    roomData.waitingForCreator = false;

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
      if (!roomData.hasStarted || roomData.hasFinished || roomData.paused || !roomData.currentRoundId) continue;

      roomData.timer -= 1;
      if (Object.values(roomData.users).every((user) => !user.connected || user.voteRoundId === roomData.currentRoundId)) {
        roomData.timer = 0;
      }

      if (roomData.timer <= 0) {
        const creatorVote = roomData.users[roomData.creator]?.vote;

        if (creatorVote !== null && creatorVote !== undefined) {
          const usersPoints: Record<string, number> = {};

          for (const [userPseudo, user] of Object.entries(roomData.users)) {
            if (userPseudo === roomData.creator) continue;

            const userVote = user.voteRoundId === roomData.currentRoundId ? user.vote ?? 0 : 0;
            const points = calculatePoints(creatorVote, userVote);
            user.lastScore = points;
            user.allScores.push(points);
            user.totalScore += points;
            usersPoints[userPseudo] = points;
          }

          const label = creatorVote > 0 ? 'Accepté' : 'Refusé';
          roomData.roundHistory.push({
            roundId: roomData.currentRoundId,
            image: roomData.currentImage ?? '',
            label,
            pointsByPseudo: usersPoints,
          });

          io.in(roomId).emit('endOfRound', { roundId: roomData.currentRoundId, pointsByPseudo: usersPoints, creatorVote });
          startNewRound(roomId);
        } else if (!roomData.waitingForCreator) {
          roomData.waitingForCreator = true;
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

function isVotePayload(payload: unknown): payload is VotePayload {
  if (!payload || typeof payload !== 'object') return false;
  const input = payload as Record<string, unknown>;

  return isValidRoomId(input.roomId) && typeof input.roundId === 'number' && Number.isInteger(input.roundId) && typeof input.vote === 'number';
}

function log(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...details }));
}

if (require.main === module) {
  const server = createGameServer();
  server.httpServer.listen(server.port, () => console.log(`Listening on port ${server.port.toString()}`));
}
