import type { ImageCatalog } from '../shared/types';
import {
  AI_PSEUDO,
  buildCreatorRoomData,
  buildPublicRoomData,
  calculatePoints,
  createRoomData,
  isValidPseudo,
  isValidRoomId,
  normalizeVote,
  setRoomStatus,
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

test('derives legacy payload flags from room status', () => {
  const room = createRoomData(validInput, 'socket-1', catalog, 'token-1');
  expect(room.status).toBe('lobby');

  setRoomStatus(room, 'running');
  expect(buildPublicRoomData(room)).toMatchObject({
    status: 'running',
    hasStarted: true,
    hasFinished: false,
    paused: false,
    waitingForCreator: false,
  });

  setRoomStatus(room, 'paused');
  expect(buildPublicRoomData(room)).toMatchObject({ status: 'paused', paused: true });

  setRoomStatus(room, 'waitingCreator');
  expect(buildPublicRoomData(room)).toMatchObject({ status: 'waitingCreator', waitingForCreator: true });

  setRoomStatus(room, 'finished');
  expect(buildPublicRoomData(room)).toMatchObject({ status: 'finished', hasFinished: true, revealedRule: validInput.rule });
});

test('normalizes votes and preserves the bounded current scoring rule', () => {
  expect(normalizeVote(2)).toBe(1);
  expect(normalizeVote(-2)).toBe(-1);
  expect(normalizeVote(Number.NaN)).toBeNull();
  expect(calculatePoints(1, 1)).toBe(100);
  expect(calculatePoints(1, -1)).toBe(-100);
  expect(calculatePoints(1, 0)).toBe(0);
});
