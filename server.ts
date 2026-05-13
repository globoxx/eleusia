import cors from 'cors';
import express from 'express';
import * as fs from 'fs';
import { createServer } from 'http';
import path from 'path';
import { Server, Socket } from 'socket.io';
import type { Data, ImageCatalog } from './src/shared/types';
import {
  AI_PSEUDO,
  ROOM_CLEANUP_DELAY_MS,
  calculatePoints,
  countPlayers,
  createRoomData,
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

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const port = Number(process.env.PORT) || 5000;
const buildPath = process.env.BUILD_PATH || path.join(process.cwd(), 'build');
const imagesFolder = path.join(buildPath, 'images');

app.use(cors());
app.use(express.static(buildPath));
app.use('/images', express.static(imagesFolder));

app.get('*', function (_req, res) {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const data: Data = {};
const sessions = new Map<string, SocketSession>();
const cleanupTimers = new Map<string, NodeJS.Timeout>();
const allImages = readImageCatalog(imagesFolder);

io.on('connection', (socket: Socket) => {
  socket.emit('updateRooms', getOpenRoomIds(data));
  socket.emit('updateImages', allImages);

  socket.on(
    'createRoom',
    (
      pseudo: unknown,
      roomId: unknown,
      roundDuration: unknown,
      imageSet: unknown,
      rule: unknown,
      autoRun: unknown,
      hasAI: unknown,
      sizeLimit: unknown,
      left: unknown,
      right: unknown,
    ) => {
      const input = {
        pseudo,
        roomId,
        roundDuration,
        imageSet,
        rule,
        autoRun,
        hasAI,
        sizeLimit,
        refusedImages: left,
        acceptedImages: right,
      };

      if (!isCreateRoomPayload(input)) {
        reject(socket, 'invalidRoom');
        return;
      }

      const validation = validateCreateRoomInput(input, allImages);
      if (!validation.ok) {
        reject(socket, validation.reason);
        return;
      }

      if (input.roomId in data) {
        socket.emit('roomAlreadyExists');
        return;
      }

      if (sessions.has(socket.id)) {
        reject(socket, 'alreadyInRoom');
        return;
      }

      data[input.roomId] = createRoomData(input, socket.id, allImages);
      sessions.set(socket.id, { roomId: input.roomId, pseudo: input.pseudo });
      socket.join(input.roomId);
      cancelRoomCleanup(input.roomId);

      emitRoomData(input.roomId);
      emitRooms();
    },
  );

  socket.on('joinRoom', (roomId: unknown, pseudo: unknown) => {
    if (!isValidRoomId(roomId) || !isValidPseudo(pseudo)) {
      reject(socket, 'invalidJoin');
      return;
    }

    const roomData = data[roomId];
    if (!roomData || roomData.hasStarted) {
      reject(socket, 'roomNotFound');
      return;
    }

    if (pseudo in roomData.users) {
      socket.emit('pseudoAlreadyExists');
      return;
    }

    if (countPlayers(roomData) >= roomData.sizeLimit) {
      socket.emit('roomFull');
      return;
    }

    if (sessions.has(socket.id)) {
      reject(socket, 'alreadyInRoom');
      return;
    }

    roomData.users[pseudo] = {
      socketId: socket.id,
      totalScore: 0,
      lastScore: null,
      allScores: [],
      vote: null,
    };
    sessions.set(socket.id, { roomId, pseudo });
    socket.join(roomId);
    cancelRoomCleanup(roomId);

    emitRoomData(roomId);
  });

  socket.on('startGame', (roomId: unknown) => {
    if (!isCreatorSocket(socket, roomId)) {
      reject(socket, 'notRoomCreator');
      return;
    }

    const roomData = data[roomId];
    if (!roomData || roomData.hasStarted || roomData.hasFinished) return;

    roomData.hasStarted = true;
    emitRooms();
    startNewRound(roomId);
  });

  socket.on('vote', (roomId: unknown, rawVote: unknown) => {
    if (!isValidRoomId(roomId)) {
      reject(socket, 'invalidRoom');
      return;
    }

    const session = sessions.get(socket.id);
    const roomData = data[roomId];
    const vote = normalizeVote(rawVote);
    if (!session || session.roomId !== roomId || !roomData || vote === null) {
      reject(socket, 'invalidVote');
      return;
    }

    const user = roomData.users[session.pseudo];
    if (!user || user.socketId !== socket.id || roomData.hasFinished) {
      reject(socket, 'invalidVote');
      return;
    }

    user.vote = vote;
    emitRoomData(roomId);
  });

  socket.on('aiVote', (roomId: unknown, rawVote: unknown) => {
    if (!isCreatorSocket(socket, roomId)) {
      reject(socket, 'notRoomCreator');
      return;
    }

    const roomData = data[roomId];
    const vote = normalizeVote(rawVote);
    if (!roomData?.hasAI || vote === null || !roomData.users[AI_PSEUDO]) {
      reject(socket, 'invalidAiVote');
      return;
    }

    roomData.users[AI_PSEUDO].vote = vote;
    emitRoomData(roomId);
  });

  socket.on('endGame', (roomId: unknown) => {
    if (!isCreatorSocket(socket, roomId)) {
      reject(socket, 'notRoomCreator');
      return;
    }

    const roomData = data[roomId];
    if (!roomData) return;

    roomData.hasFinished = true;
    roomData.paused = false;
    emitRoomData(roomId);
    scheduleRoomCleanup(roomId);
  });

  socket.on('leaveRoom', (roomId: unknown) => {
    if (!isValidRoomId(roomId)) {
      reject(socket, 'invalidRoom');
      return;
    }

    removeSocketFromRoom(socket);
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
    removeSocketFromRoom(socket);
  });
});

function readImageCatalog(rootFolder: string): ImageCatalog {
  const catalog: ImageCatalog = {};
  const imageFolders = fs.readdirSync(rootFolder, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  for (const imageFolder of imageFolders) {
    catalog[imageFolder.name] = fs
      .readdirSync(path.join(rootFolder, imageFolder.name))
      .filter((file) => file.endsWith('.png') || file.endsWith('.jpg'))
      .map((file) => ['images', imageFolder.name, file].join('/'));
  }

  return catalog;
}

function isCreateRoomPayload(input: {
  pseudo: unknown;
  roomId: unknown;
  roundDuration: unknown;
  imageSet: unknown;
  rule: unknown;
  autoRun: unknown;
  hasAI: unknown;
  sizeLimit: unknown;
  refusedImages: unknown;
  acceptedImages: unknown;
}): input is {
  pseudo: string;
  roomId: string;
  roundDuration: number;
  imageSet: string;
  rule: string;
  autoRun: boolean;
  hasAI: boolean;
  sizeLimit: number;
  refusedImages: string[];
  acceptedImages: string[];
} {
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

function emitRooms() {
  io.emit('updateRooms', getOpenRoomIds(data));
}

function emitRoomData(roomId: string) {
  const roomData = data[roomId];
  if (roomData) io.in(roomId).emit('updateRoomData', roomData);
}

function reject(socket: Socket, reason: string) {
  socket.emit('actionRejected', reason);
}

function isCreatorSocket(socket: Socket, roomId: unknown): roomId is string {
  if (!isValidRoomId(roomId)) return false;

  const session = sessions.get(socket.id);
  const roomData = data[roomId];
  return Boolean(session && roomData && session.roomId === roomId && roomData.creator === session.pseudo);
}

function removeSocketFromRoom(socket: Socket) {
  const session = sessions.get(socket.id);
  if (!session) return;

  sessions.delete(socket.id);
  socket.leave(session.roomId);

  const roomData = data[session.roomId];
  if (!roomData) return;

  const user = roomData.users[session.pseudo];
  if (user?.socketId === socket.id) {
    delete roomData.users[session.pseudo];
  }

  if (session.pseudo === roomData.creator) {
    roomData.hasFinished = true;
    roomData.paused = false;
  }

  if (!hasHumanUsers(roomData) || roomData.hasFinished) {
    scheduleRoomCleanup(session.roomId);
  }

  emitRoomData(session.roomId);
  emitRooms();
}

function scheduleRoomCleanup(roomId: string) {
  cancelRoomCleanup(roomId);

  const timer = setTimeout(() => {
    delete data[roomId];
    cleanupTimers.delete(roomId);
    emitRooms();
  }, ROOM_CLEANUP_DELAY_MS);

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
    roomData.hasFinished = true;
    roomData.paused = false;
    emitRoomData(roomId);
    scheduleRoomCleanup(roomId);
    return;
  }

  const randomIndex = Math.floor(Math.random() * roomData.images.length);
  const randomImage = roomData.images[randomIndex];
  if (!randomImage) return;

  roomData.currentImage = randomImage;
  roomData.images = roomData.images.filter((img) => img !== randomImage);

  for (const user of Object.values(roomData.users)) {
    user.vote = null;
  }

  roomData.timer = roomData.roundDuration;
  io.in(roomId).emit('newRound', randomImage);
  emitRoomData(roomId);
}

setInterval(function () {
  for (const roomId of Object.keys(data)) {
    const roomData = data[roomId];
    if (!roomData.hasStarted || roomData.hasFinished || roomData.paused) continue;

    roomData.timer -= 1;
    if (Object.values(roomData.users).every((user) => user.vote !== null)) {
      roomData.timer = 0;
    }

    if (roomData.timer <= 0) {
      const creatorVote = roomData.users[roomData.creator]?.vote;

      if (creatorVote !== null && creatorVote !== undefined) {
        const usersPoints: Record<string, number> = {};

        for (const [userPseudo, user] of Object.entries(roomData.users)) {
          if (userPseudo === roomData.creator) continue;

          const userVote = user.vote ?? 0;
          const points = calculatePoints(creatorVote, userVote);
          user.lastScore = points;
          user.allScores.push(points);
          user.totalScore += points;
          usersPoints[userPseudo] = points;
        }

        io.in(roomId).emit('endOfRound', usersPoints, creatorVote);
        startNewRound(roomId);
      } else {
        io.in(roomId).emit('waitCreator');
      }
    }

    io.in(roomId).emit('timer', roomData.timer);
  }
}, 1000);

httpServer.listen(port, () => console.log(`Listening on port ${port.toString()}`));
