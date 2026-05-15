import type { ParticipantRoundResult, RoomData } from '../shared/types';
import { AI_PSEUDO, calculatePoints, setRoomStatus } from './gameState';

export type StartRoundResult =
  | { type: 'finished' }
  | { type: 'newRound'; roundId: number; image: string };

export type CloseRoundResult =
  | { type: 'waitingCreator' }
  | { type: 'endOfRound'; roundId: number; pointsByPseudo: Record<string, number>; creatorVote: number };

export function startNextRound(roomData: RoomData): StartRoundResult {
  if (roomData.images.length === 0) {
    return { type: 'finished' };
  }

  const randomIndex = Math.floor(Math.random() * roomData.images.length);
  const randomImage = roomData.images[randomIndex];
  if (!randomImage) {
    return { type: 'finished' };
  }

  const roundId = roomData.nextRoundId;
  roomData.nextRoundId += 1;
  roomData.currentRoundId = roundId;
  roomData.currentRoundStartedAt = Date.now();
  roomData.currentImage = randomImage;
  roomData.images = roomData.images.filter((img) => img !== randomImage);
  roomData.timer = roomData.roundDuration;
  roomData.creator.vote = null;
  roomData.creator.voteRoundId = null;
  setRoomStatus(roomData, 'running');

  for (const user of Object.values(roomData.users)) {
    user.vote = null;
    user.voteRoundId = null;
  }

  return { type: 'newRound', roundId, image: randomImage };
}

export function closeCurrentRound(roomData: RoomData): CloseRoundResult {
  if (!roomData.currentRoundId) {
    return { type: 'waitingCreator' };
  }

  const creatorVote = roomData.creator.voteRoundId === roomData.currentRoundId ? roomData.creator.vote : null;
  if (creatorVote === null || creatorVote === undefined) {
    setRoomStatus(roomData, 'waitingCreator');
    return { type: 'waitingCreator' };
  }

  const pointsByPseudo: Record<string, number> = {};
  const participantResults: Record<string, ParticipantRoundResult> = {};

  for (const [userPseudo, user] of Object.entries(roomData.users)) {
    const responded = user.voteRoundId === roomData.currentRoundId && user.vote !== null;
    const effectiveVote = responded ? user.vote ?? 0 : 0;
    const points = calculatePoints(creatorVote, effectiveVote);
    user.lastScore = points;
    user.allScores.push(points);
    user.totalScore += points;
    pointsByPseudo[userPseudo] = points;
    participantResults[userPseudo] = {
      vote: responded ? user.vote : null,
      points,
      responded,
      isAI: userPseudo === AI_PSEUDO,
    };
  }

  roomData.roundHistory.push({
    roundId: roomData.currentRoundId,
    image: roomData.currentImage ?? '',
    startedAt: roomData.currentRoundStartedAt ?? Date.now(),
    endedAt: Date.now(),
    label: creatorVote > 0 ? 'Accepté' : 'Refusé',
    creatorVote,
    participantResults,
  });

  return { type: 'endOfRound', roundId: roomData.currentRoundId, pointsByPseudo, creatorVote };
}
