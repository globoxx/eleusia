import type { RoomStatus } from './types';

export function isLobby(status: RoomStatus) {
  return status === 'lobby';
}

export function isRunning(status: RoomStatus) {
  return status === 'running';
}

export function isPaused(status: RoomStatus) {
  return status === 'paused';
}

export function isWaitingCreator(status: RoomStatus) {
  return status === 'waitingCreator';
}

export function isFinished(status: RoomStatus) {
  return status === 'finished' || status === 'expired';
}
