import type { ImageCatalog, RoomData, User } from '../shared/types';

export const AI_PSEUDO = 'Eleus-IA';
export const AI_SOCKET_ID = 'ai';
export const ROOM_CLEANUP_DELAY_MS = 60 * 60 * 1000;
export const MAX_ROOM_ID_LENGTH = 64;
export const MAX_PSEUDO_LENGTH = 15;
export const MAX_SIZE_LIMIT = 1000;

export interface CreateRoomInput {
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
}

type ValidationResult = { ok: true } | { ok: false; reason: string };

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const HTML_BRACKETS = /[<>]/;

export function isValidPseudo(pseudo: unknown): pseudo is string {
  return (
    typeof pseudo === 'string' &&
    pseudo.trim().length > 0 &&
    pseudo.length <= MAX_PSEUDO_LENGTH &&
    !CONTROL_CHARS.test(pseudo) &&
    !HTML_BRACKETS.test(pseudo)
  );
}

export function isValidRoomId(roomId: unknown): roomId is string {
  return (
    typeof roomId === 'string' &&
    roomId.trim().length > 0 &&
    roomId.length <= MAX_ROOM_ID_LENGTH &&
    !CONTROL_CHARS.test(roomId)
  );
}

export function isValidRoundDuration(roundDuration: unknown): roundDuration is number {
  return typeof roundDuration === 'number' && Number.isFinite(roundDuration) && roundDuration > 0;
}

export function isValidSizeLimit(sizeLimit: unknown): sizeLimit is number {
  return typeof sizeLimit === 'number' && Number.isInteger(sizeLimit) && sizeLimit > 0 && sizeLimit <= MAX_SIZE_LIMIT;
}

export function normalizeVote(vote: unknown): number | null {
  if (typeof vote !== 'number' || !Number.isFinite(vote)) return null;
  return Math.max(-1, Math.min(1, vote));
}

export function calculatePoints(creatorVote: number, userVote: number): number {
  const rawPoints = Math.round((1 - Math.abs(creatorVote - userVote)) * 100);
  return Math.max(-100, Math.min(100, rawPoints));
}

export function createUser(socketId: string): User {
  return {
    socketId,
    totalScore: 0,
    lastScore: null,
    allScores: [],
    vote: null,
  };
}

export function countPlayers(roomData: RoomData): number {
  return Object.keys(roomData.users).length - 1;
}

export function hasHumanUsers(roomData: RoomData): boolean {
  return Object.values(roomData.users).some((user) => user.socketId !== AI_SOCKET_ID);
}

export function getOpenRoomIds(data: Record<string, RoomData>): string[] {
  return Object.entries(data)
    .filter(([, roomData]) => !roomData.hasStarted && !roomData.hasFinished)
    .map(([roomId]) => roomId);
}

export function validateCreateRoomInput(input: CreateRoomInput, allImages: ImageCatalog): ValidationResult {
  if (!isValidPseudo(input.pseudo)) return { ok: false, reason: 'invalidPseudo' };
  if (!isValidRoomId(input.roomId)) return { ok: false, reason: 'invalidRoom' };
  if (!isValidRoundDuration(input.roundDuration)) return { ok: false, reason: 'invalidRoundDuration' };
  if (!isValidSizeLimit(input.sizeLimit)) return { ok: false, reason: 'invalidSizeLimit' };
  if (typeof input.rule !== 'string' || input.rule.trim().length === 0) {
    return { ok: false, reason: 'invalidRule' };
  }

  const images = allImages[input.imageSet];
  if (!Array.isArray(images) || images.length === 0) {
    return { ok: false, reason: 'invalidImageSet' };
  }

  const imageSet = new Set(images);
  const labelsAreValid = [...input.refusedImages, ...input.acceptedImages].every((image) => imageSet.has(image));
  if (!labelsAreValid) return { ok: false, reason: 'invalidLabels' };

  return { ok: true };
}

export function createRoomData(input: CreateRoomInput, creatorSocketId: string, allImages: ImageCatalog): RoomData {
  const images = allImages[input.imageSet] ?? [];

  return {
    rule: input.rule,
    roundDuration: input.roundDuration,
    creator: input.pseudo,
    autoRun: input.autoRun,
    hasAI: input.hasAI,
    paused: false,
    refusedImages: input.refusedImages,
    acceptedImages: input.acceptedImages,
    hasStarted: false,
    hasFinished: false,
    timer: input.roundDuration,
    images: [...images],
    currentImage: null,
    sizeLimit: input.sizeLimit,
    users: {
      [input.pseudo]: createUser(creatorSocketId),
      ...(input.hasAI ? { [AI_PSEUDO]: createUser(AI_SOCKET_ID) } : {}),
    },
  };
}
