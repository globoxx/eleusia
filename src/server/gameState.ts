import type { ClientRoomData, CreatorRoomData, ImageCatalog, PublicRoomData, PublicUser, RoomData, RoomStatus, User } from '../shared/types';

export const AI_PSEUDO = 'Eleus-IA';
export const AI_SOCKET_ID = 'ai';
export const ROOM_CLEANUP_DELAY_MS = 60 * 60 * 1000;
export const RECONNECT_GRACE_MS = 2 * 60 * 1000;
export const MAX_ROOM_ID_LENGTH = 64;
export const MAX_PSEUDO_LENGTH = 15;
export const MAX_RULE_LENGTH = 500;
export const MIN_ROUND_DURATION = 5;
export const MAX_ROUND_DURATION = 120;
export const MAX_SIZE_LIMIT = 1000;

export interface CreateRoomInput {
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
  return (
    typeof roundDuration === 'number' &&
    Number.isInteger(roundDuration) &&
    roundDuration >= MIN_ROUND_DURATION &&
    roundDuration <= MAX_ROUND_DURATION
  );
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

export function createUser(socketId: string, participantToken: string | null = null): User {
  return {
    socketId,
    participantToken,
    connected: true,
    disconnectedAt: null,
    totalScore: 0,
    lastScore: null,
    allScores: [],
    vote: null,
    voteRoundId: null,
  };
}

export function countPlayers(roomData: RoomData): number {
  return Object.keys(roomData.users).filter((pseudo) => pseudo !== AI_PSEUDO).length;
}

export function hasHumanUsers(roomData: RoomData): boolean {
  return roomData.creator.connected || Object.values(roomData.users).some((user) => user.socketId !== AI_SOCKET_ID);
}

export function validateCreateRoomInput(input: CreateRoomInput, allImages: ImageCatalog): ValidationResult {
  if (!isValidRoomId(input.roomId)) return { ok: false, reason: 'invalidRoom' };
  if (!isValidRoundDuration(input.roundDuration)) return { ok: false, reason: 'invalidRoundDuration' };
  if (!isValidSizeLimit(input.sizeLimit)) return { ok: false, reason: 'invalidSizeLimit' };
  if (typeof input.rule !== 'string' || input.rule.trim().length === 0 || input.rule.length > MAX_RULE_LENGTH) {
    return { ok: false, reason: 'invalidRule' };
  }

  const images = allImages[input.imageSet];
  if (!Array.isArray(images) || images.length === 0) {
    return { ok: false, reason: 'invalidImageSet' };
  }

  if (input.autoRun) {
    const imageSet = new Set(images);
    const refusedSet = new Set(input.refusedImages);
    const acceptedSet = new Set(input.acceptedImages);
    const allLabels = [...input.refusedImages, ...input.acceptedImages];
    const labelsAreKnown = allLabels.every((image) => imageSet.has(image));
    if (!labelsAreKnown) return { ok: false, reason: 'invalidLabels' };
    if (refusedSet.size !== input.refusedImages.length || acceptedSet.size !== input.acceptedImages.length) {
      return { ok: false, reason: 'invalidLabels' };
    }
    if ([...refusedSet].some((image) => acceptedSet.has(image))) {
      return { ok: false, reason: 'invalidLabels' };
    }
    if (allLabels.length !== images.length || allLabels.some((image) => !imageSet.has(image))) {
      return { ok: false, reason: 'incompleteLabels' };
    }
  }

  return { ok: true };
}

export function createRoomData(input: CreateRoomInput, creatorSocketId: string, allImages: ImageCatalog, creatorToken: string): RoomData {
  const images = allImages[input.imageSet] ?? [];

  return {
    rule: input.rule.trim(),
    roundDuration: input.roundDuration,
    creator: {
      socketId: creatorSocketId,
      creatorToken,
      connected: true,
      disconnectedAt: null,
      vote: null,
      voteRoundId: null,
    },
    autoRun: input.autoRun,
    hasAI: input.hasAI,
    status: 'lobby',
    paused: false,
    refusedImages: input.autoRun ? input.refusedImages : [],
    acceptedImages: input.autoRun ? input.acceptedImages : [],
    hasStarted: false,
    hasFinished: false,
    timer: input.roundDuration,
    images: [...images],
    currentImage: null,
    currentRoundId: null,
    currentRoundStartedAt: null,
    nextRoundId: 1,
    waitingForCreator: false,
    roundHistory: [],
    sizeLimit: input.sizeLimit,
    users: {
      ...(input.hasAI ? { [AI_PSEUDO]: createUser(AI_SOCKET_ID) } : {}),
    },
  };
}

export function setRoomStatus(roomData: RoomData, status: RoomStatus) {
  roomData.status = status;
  roomData.hasStarted = status !== 'lobby';
  roomData.hasFinished = status === 'finished' || status === 'expired';
  roomData.paused = status === 'paused';
  roomData.waitingForCreator = status === 'waitingCreator';
}

export function toPublicUser(user: User): PublicUser {
  return {
    totalScore: user.totalScore,
    lastScore: user.lastScore,
    allScores: user.allScores,
    connected: user.connected,
  };
}

export function buildPublicRoomData(roomData: RoomData): PublicRoomData {
  return {
    status: roomData.status,
    roundDuration: roomData.roundDuration,
    creatorConnected: roomData.creator.connected,
    autoRun: roomData.autoRun,
    hasAI: roomData.hasAI,
    paused: roomData.status === 'paused',
    hasStarted: roomData.status !== 'lobby',
    hasFinished: roomData.status === 'finished' || roomData.status === 'expired',
    timer: roomData.timer,
    currentImage: roomData.currentImage,
    currentRoundId: roomData.currentRoundId,
    waitingForCreator: roomData.status === 'waitingCreator',
    roundHistory: roomData.roundHistory,
    revealedRule: roomData.status === 'finished' || roomData.status === 'expired' ? roomData.rule : null,
    sizeLimit: roomData.sizeLimit,
    users: Object.fromEntries(Object.entries(roomData.users).map(([pseudo, user]) => [pseudo, toPublicUser(user)])),
  };
}

export function buildCreatorRoomData(roomData: RoomData): CreatorRoomData {
  return {
    ...buildPublicRoomData(roomData),
    rule: roomData.rule,
    refusedImages: roomData.refusedImages,
    acceptedImages: roomData.acceptedImages,
  };
}

export function buildClientRoomData(roomData: RoomData, isCreator: boolean): ClientRoomData {
  return isCreator ? buildCreatorRoomData(roomData) : buildPublicRoomData(roomData);
}
