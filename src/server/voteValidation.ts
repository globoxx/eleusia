import { isFinished, isPaused } from '../shared/roomStatus';
import type { RoomData, VotePayload } from '../shared/types';
import { AI_PSEUDO, isValidRoomId, normalizeVote } from './gameState';
import type { SocketSession } from './socketSessionStore';

export type VoteActor = 'creator' | 'ai' | { role: 'player'; pseudo: string };

export type VoteValidationResult =
  | { ok: true; votePayload: VotePayload; actor: VoteActor }
  | { ok: false; reason: string };

export interface VoteValidationInput {
  payload: unknown;
  roomData: RoomData | undefined;
  session: SocketSession | null;
  socketId: string;
  isAiVote: boolean;
}

export function validateVote(input: VoteValidationInput): VoteValidationResult {
  const invalidReason = input.isAiVote ? 'invalidAiVote' : 'invalidVote';
  if (!isVotePayload(input.payload)) {
    return { ok: false, reason: invalidReason };
  }

  const vote = normalizeVote(input.payload.vote);
  const roomData = input.roomData;
  if (!roomData || vote === null) {
    return { ok: false, reason: invalidReason };
  }

  if (isFinished(roomData.status) || isPaused(roomData.status) || !roomData.currentRoundId) {
    return { ok: false, reason: 'voteClosed' };
  }

  if (input.payload.roundId !== roomData.currentRoundId) {
    return { ok: false, reason: 'staleRound' };
  }

  const votePayload = { ...input.payload, vote };
  if (input.isAiVote) {
    return validateAiVote({ roomData, votePayload, session: input.session, socketId: input.socketId });
  }

  if (!input.session || input.session.roomId !== input.payload.roomId) {
    return { ok: false, reason: 'invalidVote' };
  }

  if (input.session.role === 'creator') {
    return validateCreatorVote({ roomData, votePayload, socketId: input.socketId });
  }

  return validatePlayerVote({ roomData, votePayload, pseudo: input.session.pseudo, socketId: input.socketId });
}

function validateAiVote(input: { roomData: RoomData; votePayload: VotePayload; session: SocketSession | null; socketId: string }): VoteValidationResult {
  if (input.roomData.status !== 'running' || input.roomData.timer <= 0) {
    return { ok: false, reason: 'voteClosed' };
  }

  if (
    !input.session ||
    input.session.role !== 'creator' ||
    input.roomData.creator.socketId !== input.socketId ||
    !input.roomData.creator.connected ||
    !input.roomData.hasAI
  ) {
    return { ok: false, reason: 'invalidAiVote' };
  }

  const aiUser = input.roomData.users[AI_PSEUDO];
  if (!aiUser || aiUser.voteRoundId === input.votePayload.roundId) {
    return { ok: false, reason: 'duplicateVote' };
  }

  return { ok: true, votePayload: input.votePayload, actor: 'ai' };
}

function validateCreatorVote(input: { roomData: RoomData; votePayload: VotePayload; socketId: string }): VoteValidationResult {
  if (input.roomData.creator.socketId !== input.socketId || !input.roomData.creator.connected) {
    return { ok: false, reason: 'invalidVote' };
  }

  if (input.roomData.status !== 'waitingCreator' && (input.roomData.status !== 'running' || input.roomData.timer <= 0)) {
    return { ok: false, reason: 'voteClosed' };
  }

  if (input.roomData.creator.voteRoundId === input.votePayload.roundId) {
    return { ok: false, reason: 'duplicateVote' };
  }

  return { ok: true, votePayload: input.votePayload, actor: 'creator' };
}

function validatePlayerVote(input: { roomData: RoomData; votePayload: VotePayload; pseudo: string; socketId: string }): VoteValidationResult {
  const user = input.roomData.users[input.pseudo];
  if (!user || user.socketId !== input.socketId || !user.connected) {
    return { ok: false, reason: 'invalidVote' };
  }

  if (input.roomData.status !== 'running' || input.roomData.timer <= 0) {
    return { ok: false, reason: 'voteClosed' };
  }

  if (user.voteRoundId === input.votePayload.roundId) {
    return { ok: false, reason: 'duplicateVote' };
  }

  return { ok: true, votePayload: input.votePayload, actor: { role: 'player', pseudo: input.pseudo } };
}

function isVotePayload(payload: unknown): payload is VotePayload {
  if (!payload || typeof payload !== 'object') return false;
  const input = payload as Record<string, unknown>;

  return isValidRoomId(input.roomId) && typeof input.roundId === 'number' && Number.isInteger(input.roundId) && typeof input.vote === 'number';
}
