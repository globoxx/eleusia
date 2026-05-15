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

export type RoomStatus = 'lobby' | 'running' | 'paused' | 'waitingCreator' | 'finished' | 'expired';
export type RoundLabel = 'Accepté' | 'Refusé';

export interface ParticipantRoundResult {
  vote: number | null;
  points: number;
  responded: boolean;
  isAI: boolean;
}

export interface RoundHistoryItem {
  roundId: number;
  image: string;
  startedAt: number;
  endedAt: number;
  label: RoundLabel;
  creatorVote: number;
  participantResults: Record<string, ParticipantRoundResult>;
}

export interface RoomData {
  rule: string;
  roundDuration: number;
  creator: string;
  autoRun: boolean;
  hasAI: boolean;
  status: RoomStatus;
  paused: boolean;
  refusedImages: string[];
  acceptedImages: string[];
  hasStarted: boolean;
  hasFinished: boolean;
  timer: number;
  images: string[];
  currentImage: string | null;
  currentRoundId: number | null;
  currentRoundStartedAt: number | null;
  nextRoundId: number;
  waitingForCreator: boolean;
  roundHistory: RoundHistoryItem[];
  sizeLimit: number;
  users: Users;
  teacherId?: string;
  templateId?: string;
  persistentSessionId?: string;
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
  status: RoomStatus;
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
  templateId?: string;
  sessionId?: string;
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

export interface TeacherPublic {
  id: string;
  email: string;
}

export interface AuthResponse {
  teacher: TeacherPublic;
}

export interface RoomTemplatePayload {
  name: string;
  roundDuration: number;
  imageSet: string;
  rule: string;
  autoRun: boolean;
  hasAI: boolean;
  sizeLimit: number;
  refusedImages: string[];
  acceptedImages: string[];
}

export interface RoomTemplateRecord extends RoomTemplatePayload {
  id: string;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface RoomSessionRecord {
  id: string;
  teacherId: string;
  templateId: string | null;
  liveRoomId: string;
  status: RoomStatus;
  startedAt: string | null;
  finishedAt: string | null;
  initialConfig: RoomTemplatePayload;
  roundHistory: RoundHistoryItem[];
  finalUsers: PublicUsers;
  createdAt: string;
  updatedAt: string;
}

export interface LaunchRoomTemplatePayload {
  templateId: string;
  roomId: string;
  pseudo: string;
}
