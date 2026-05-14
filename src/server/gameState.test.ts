import type { ImageCatalog } from '../shared/types';
import {
  AI_PSEUDO,
  buildCreatorRoomData,
  buildPublicRoomData,
  calculatePoints,
  createRoomData,
  getOpenRoomIds,
  isValidPseudo,
  isValidRoomId,
  normalizeVote,
  validateCreateRoomInput,
} from './gameState';

const catalog: ImageCatalog = {
  cards: ['images/cards/1.png', 'images/cards/2.png'],
};

const validInput = {
  pseudo: 'Teacher',
  roomId: 'room 1',
  roundDuration: 10,
  imageSet: 'cards',
  rule: 'Accept red cards',
  autoRun: true,
  hasAI: true,
  sizeLimit: 20,
  refusedImages: ['images/cards/1.png'],
  acceptedImages: ['images/cards/2.png'],
};

test('validates room and pseudo boundaries', () => {
  expect(isValidPseudo('Alice')).toBe(true);
  expect(isValidPseudo('<script>')).toBe(false);
  expect(isValidPseudo('')).toBe(false);
  expect(isValidRoomId('room libre 123')).toBe(true);
  expect(isValidRoomId('x'.repeat(65))).toBe(false);
});

test('validates create room payload against available image catalog', () => {
  expect(validateCreateRoomInput(validInput, catalog)).toEqual({ ok: true });
  expect(validateCreateRoomInput({ ...validInput, imageSet: 'missing' }, catalog)).toEqual({
    ok: false,
    reason: 'invalidImageSet',
  });
  expect(validateCreateRoomInput({ ...validInput, acceptedImages: ['images/cards/missing.png'] }, catalog)).toEqual({
    ok: false,
    reason: 'invalidLabels',
  });
  expect(validateCreateRoomInput({ ...validInput, rule: 'x'.repeat(501) }, catalog)).toEqual({
    ok: false,
    reason: 'invalidRule',
  });
  expect(validateCreateRoomInput({ ...validInput, roundDuration: 4 }, catalog)).toEqual({
    ok: false,
    reason: 'invalidRoundDuration',
  });
  expect(validateCreateRoomInput({ ...validInput, sizeLimit: 1001 }, catalog)).toEqual({
    ok: false,
    reason: 'invalidSizeLimit',
  });
  expect(validateCreateRoomInput({ ...validInput, acceptedImages: [], refusedImages: ['images/cards/1.png'] }, catalog)).toEqual({
    ok: false,
    reason: 'incompleteLabels',
  });
  expect(
    validateCreateRoomInput(
      { ...validInput, acceptedImages: ['images/cards/1.png', 'images/cards/2.png'], refusedImages: ['images/cards/1.png'] },
      catalog,
    ),
  ).toEqual({
    ok: false,
    reason: 'invalidLabels',
  });
});

test('creates a room with creator and special AI participant', () => {
  const room = createRoomData(validInput, 'socket-1', catalog, 'token-1');

  expect(room.creator).toBe('Teacher');
  expect(room.users.Teacher.socketId).toBe('socket-1');
  expect(room.users.Teacher.participantToken).toBe('token-1');
  expect(room.users[AI_PSEUDO]).toBeDefined();
  expect(room.images).toEqual(catalog.cards);
});

test('only lists rooms that are open and unfinished', () => {
  const openRoom = createRoomData(validInput, 'socket-1', catalog, 'token-1');
  const startedRoom = createRoomData({ ...validInput, roomId: 'started' }, 'socket-2', catalog, 'token-2');
  startedRoom.hasStarted = true;
  const finishedRoom = createRoomData({ ...validInput, roomId: 'finished' }, 'socket-3', catalog, 'token-3');
  finishedRoom.hasFinished = true;

  expect(getOpenRoomIds({ open: openRoom, started: startedRoom, finished: finishedRoom })).toEqual(['open']);
});

test('builds public and creator room payloads without leaking private state', () => {
  const room = createRoomData(validInput, 'socket-1', catalog, 'token-1');
  room.users.Teacher.vote = 1;

  const publicRoom = buildPublicRoomData(room);
  const creatorRoom = buildCreatorRoomData(room);

  expect(publicRoom).not.toHaveProperty('rule');
  expect(publicRoom).not.toHaveProperty('acceptedImages');
  expect(publicRoom).not.toHaveProperty('refusedImages');
  expect(publicRoom.users.Teacher).not.toHaveProperty('socketId');
  expect(publicRoom.users.Teacher).not.toHaveProperty('participantToken');
  expect(publicRoom.users.Teacher).not.toHaveProperty('vote');
  expect(creatorRoom.rule).toBe(validInput.rule);
  expect(creatorRoom.acceptedImages).toEqual(validInput.acceptedImages);
  expect(creatorRoom.refusedImages).toEqual(validInput.refusedImages);
});

test('normalizes votes and preserves the bounded current scoring rule', () => {
  expect(normalizeVote(2)).toBe(1);
  expect(normalizeVote(-2)).toBe(-1);
  expect(normalizeVote(Number.NaN)).toBeNull();
  expect(calculatePoints(1, 1)).toBe(100);
  expect(calculatePoints(1, -1)).toBe(-100);
  expect(calculatePoints(1, 0)).toBe(0);
});
