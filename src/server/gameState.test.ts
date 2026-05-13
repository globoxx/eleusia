import type { ImageCatalog } from '../shared/types';
import {
  AI_PSEUDO,
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
  autoRun: false,
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
});

test('creates a room with creator and special AI participant', () => {
  const room = createRoomData(validInput, 'socket-1', catalog);

  expect(room.creator).toBe('Teacher');
  expect(room.users.Teacher.socketId).toBe('socket-1');
  expect(room.users[AI_PSEUDO]).toBeDefined();
  expect(room.images).toEqual(catalog.cards);
});

test('only lists rooms that are open and unfinished', () => {
  const openRoom = createRoomData(validInput, 'socket-1', catalog);
  const startedRoom = createRoomData({ ...validInput, roomId: 'started' }, 'socket-2', catalog);
  startedRoom.hasStarted = true;
  const finishedRoom = createRoomData({ ...validInput, roomId: 'finished' }, 'socket-3', catalog);
  finishedRoom.hasFinished = true;

  expect(getOpenRoomIds({ open: openRoom, started: startedRoom, finished: finishedRoom })).toEqual(['open']);
});

test('normalizes votes and preserves the bounded current scoring rule', () => {
  expect(normalizeVote(2)).toBe(1);
  expect(normalizeVote(-2)).toBe(-1);
  expect(normalizeVote(Number.NaN)).toBeNull();
  expect(calculatePoints(1, 1)).toBe(100);
  expect(calculatePoints(1, -1)).toBe(-100);
  expect(calculatePoints(1, 0)).toBe(0);
});
