import type { Server, Socket } from 'socket.io';
import { isValidRoomId } from './gameState';

export interface CreatorSocketSession {
  roomId: string;
  role: 'creator';
}

export interface PlayerSocketSession {
  roomId: string;
  role: 'player';
  pseudo: string;
}

export type SocketSession = CreatorSocketSession | PlayerSocketSession;

export function createSocketSessionStore(io: Server) {
  const sessions = new Map<string, SocketSession>();

  const attachCreator = (roomId: string, socket: Socket) => {
    sessions.set(socket.id, { roomId, role: 'creator' });
    socket.join(roomId);
  };

  const attachPlayer = (roomId: string, pseudo: string, socket: Socket) => {
    sessions.set(socket.id, { roomId, role: 'player', pseudo });
    socket.join(roomId);
  };

  const get = (socket: Socket) => sessions.get(socket.id) ?? null;

  const getCreator = (socket: Socket, roomId: unknown): CreatorSocketSession | null => {
    if (!isValidRoomId(roomId)) return null;

    const session = get(socket);
    return session?.role === 'creator' && session.roomId === roomId ? session : null;
  };

  const getPlayer = (socket: Socket, roomId: unknown): PlayerSocketSession | null => {
    if (!isValidRoomId(roomId)) return null;

    const session = get(socket);
    return session?.role === 'player' && session.roomId === roomId ? session : null;
  };

  const isAttached = (socket: Socket) => sessions.has(socket.id);

  const detachSocketId = (socketId: string) => {
    sessions.delete(socketId);
  };

  const replaceSocket = (socketId: string, roomId: string) => {
    detachSocketId(socketId);
    io.sockets.sockets.get(socketId)?.leave(roomId);
  };

  return {
    attachCreator,
    attachPlayer,
    detachSocketId,
    get,
    getCreator,
    getPlayer,
    isAttached,
    replaceSocket,
    sessions,
  };
}
