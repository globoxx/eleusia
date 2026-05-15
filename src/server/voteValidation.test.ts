import { expect, test } from 'vitest';
import type { RoomData } from '../shared/types';
import { AI_PSEUDO, createRoomData, setRoomStatus } from './gameState';
import type { SocketSession } from './socketSessionStore';
import { validateVote } from './voteValidation';

const catalog = {
  cards: ['images/cards/1.png', 'images/cards/2.png'],
};

const baseInput = {
  roomId: 'room1',
  roundDuration: 10,
  imageSet: 'cards',
  rule: 'Accept red cards',
  autoRun: false,
  hasAI: true,
  sizeLimit: 20,
  refusedImages: [],
  acceptedImages: [],
};

function createRunningRoom(overrides: Partial<RoomData> = {}) {
  const room = createRoomData(baseInput, 'creator-socket', catalog, 'creator-token');
  room.users.Alice = {
    socketId: 'alice-socket',
    participantToken: 'alice-token',
    connected: true,
    disconnectedAt: null,
    totalScore: 0,
    lastScore: null,
    allScores: [],
    vote: null,
    voteRoundId: null,
  };
  setRoomStatus(room, 'running');
  room.currentRoundId = 1;
  room.timer = 10;
  return Object.assign(room, overrides);
}

test('accepts a valid player vote', () => {
  const room = createRunningRoom();
  const session: SocketSession = { roomId: 'room1', role: 'player', pseudo: 'Alice' };

  expect(validateVote({ payload: { roomId: 'room1', roundId: 1, vote: 0.25 }, roomData: room, session, socketId: 'alice-socket', isAiVote: false })).toEqual({
    ok: true,
    votePayload: { roomId: 'room1', roundId: 1, vote: 0.25 },
    actor: { role: 'player', pseudo: 'Alice' },
  });
});

test('accepts creator votes in running and waitingCreator states', () => {
  const runningRoom = createRunningRoom();
  const session: SocketSession = { roomId: 'room1', role: 'creator' };

  expect(validateVote({ payload: { roomId: 'room1', roundId: 1, vote: 1 }, roomData: runningRoom, session, socketId: 'creator-socket', isAiVote: false })).toMatchObject({
    ok: true,
    actor: 'creator',
  });

  const waitingRoom = createRunningRoom();
  setRoomStatus(waitingRoom, 'waitingCreator');
  waitingRoom.timer = 0;

  expect(validateVote({ payload: { roomId: 'room1', roundId: 1, vote: -1 }, roomData: waitingRoom, session, socketId: 'creator-socket', isAiVote: false })).toMatchObject({
    ok: true,
    actor: 'creator',
  });
});

test('accepts AI votes only from the creator in a room with AI', () => {
  const room = createRunningRoom();
  const session: SocketSession = { roomId: 'room1', role: 'creator' };

  expect(validateVote({ payload: { roomId: 'room1', roundId: 1, vote: 0.7 }, roomData: room, session, socketId: 'creator-socket', isAiVote: true })).toMatchObject({
    ok: true,
    actor: 'ai',
  });

  const playerSession: SocketSession = { roomId: 'room1', role: 'player', pseudo: 'Alice' };
  expect(validateVote({ payload: { roomId: 'room1', roundId: 1, vote: 0.7 }, roomData: room, session: playerSession, socketId: 'alice-socket', isAiVote: true })).toEqual({
    ok: false,
    reason: 'invalidAiVote',
  });
});

test('rejects stale, duplicate, paused, finished and expired votes', () => {
  const room = createRunningRoom();
  const session: SocketSession = { roomId: 'room1', role: 'player', pseudo: 'Alice' };
  expect(validateVote({ payload: { roomId: 'room1', roundId: 2, vote: 1 }, roomData: room, session, socketId: 'alice-socket', isAiVote: false })).toEqual({
    ok: false,
    reason: 'staleRound',
  });

  room.users.Alice.voteRoundId = 1;
  expect(validateVote({ payload: { roomId: 'room1', roundId: 1, vote: 1 }, roomData: room, session, socketId: 'alice-socket', isAiVote: false })).toEqual({
    ok: false,
    reason: 'duplicateVote',
  });

  const pausedRoom = createRunningRoom();
  setRoomStatus(pausedRoom, 'paused');
  expect(validateVote({ payload: { roomId: 'room1', roundId: 1, vote: 1 }, roomData: pausedRoom, session, socketId: 'alice-socket', isAiVote: false })).toEqual({
    ok: false,
    reason: 'voteClosed',
  });

  const finishedRoom = createRunningRoom();
  setRoomStatus(finishedRoom, 'finished');
  expect(validateVote({ payload: { roomId: 'room1', roundId: 1, vote: 1 }, roomData: finishedRoom, session, socketId: 'alice-socket', isAiVote: false })).toEqual({
    ok: false,
    reason: 'voteClosed',
  });
});

test('rejects AI duplicate votes', () => {
  const room = createRunningRoom();
  room.users[AI_PSEUDO].voteRoundId = 1;
  const session: SocketSession = { roomId: 'room1', role: 'creator' };

  expect(validateVote({ payload: { roomId: 'room1', roundId: 1, vote: 0.5 }, roomData: room, session, socketId: 'creator-socket', isAiVote: true })).toEqual({
    ok: false,
    reason: 'duplicateVote',
  });
});
