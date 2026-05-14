export interface User {
  socketId: string;
  participantToken: string | null;
  connected: boolean;
  disconnectedAt: number | null;
  totalScore: number;
  lastScore: number | null;
  allScores: number[];
  vote: number | null;
  voteRoundId: number | null;
}

export interface Users {
  [pseudo: string]: User;
}

export type RoundLabel = 'Accepté' | 'Refusé';

export interface RoundHistoryItem {
  roundId: number;
  image: string;
  label: RoundLabel;
  pointsByPseudo: Record<string, number>;
}

export interface RoomData {
  rule: string;
  roundDuration: number;
  creator: string;
  autoRun: boolean;
  hasAI: boolean;
  paused: boolean;
  refusedImages: string[];
  acceptedImages: string[];
  hasStarted: boolean;
  hasFinished: boolean;
  timer: number;
  images: string[];
  currentImage: string | null;
  currentRoundId: number | null;
  nextRoundId: number;
  waitingForCreator: boolean;
  roundHistory: RoundHistoryItem[];
  sizeLimit: number;
  users: Users;
}

export interface Data {
  [roomId: string]: RoomData;
}

export interface ImageCatalog {
  [folder: string]: string[];
}

export interface PublicUser {
  totalScore: number;
  lastScore: number | null;
  allScores: number[];
  connected: boolean;
}

export interface PublicUsers {
  [pseudo: string]: PublicUser;
}

export interface PublicRoomData {
  roundDuration: number;
  creator: string;
  autoRun: boolean;
  hasAI: boolean;
  paused: boolean;
  hasStarted: boolean;
  hasFinished: boolean;
  timer: number;
  currentImage: string | null;
  currentRoundId: number | null;
  waitingForCreator: boolean;
  roundHistory: RoundHistoryItem[];
  revealedRule: string | null;
  sizeLimit: number;
  users: PublicUsers;
}

export interface CreatorRoomData extends PublicRoomData {
  rule: string;
  refusedImages: string[];
  acceptedImages: string[];
}

export type ClientRoomData = PublicRoomData | CreatorRoomData;

export interface RoomAckSuccess {
  ok: true;
  roomId: string;
  pseudo: string;
  participantToken: string;
}

export interface RoomAckFailure {
  ok: false;
  reason: string;
}

export type RoomAck = RoomAckSuccess | RoomAckFailure;

export interface CreateRoomPayload {
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

export interface JoinRoomPayload {
  roomId: string;
  pseudo: string;
}

export interface ReconnectRoomPayload {
  roomId: string;
  pseudo: string;
  participantToken: string;
}

export interface VotePayload {
  roomId: string;
  roundId: number;
  vote: number;
}

export interface NewRoundPayload {
  roundId: number;
  image: string;
}
