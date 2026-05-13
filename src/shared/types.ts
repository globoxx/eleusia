export interface User {
  socketId: string;
  totalScore: number;
  lastScore: number | null;
  allScores: number[];
  vote: number | null;
}

export interface Users {
  [pseudo: string]: User;
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
  sizeLimit: number;
  users: Users;
}

export interface Data {
  [roomId: string]: RoomData;
}

export interface ImageCatalog {
  [folder: string]: string[];
}
