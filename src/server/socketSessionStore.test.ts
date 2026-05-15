import { expect, test, vi } from 'vitest';
import type { Server, Socket } from 'socket.io';
import { createSocketSessionStore } from './socketSessionStore';

function createStore() {
  const sockets = new Map<string, { leave: ReturnType<typeof vi.fn> }>();
  const io = { sockets: { sockets } } as unknown as Server;
  return { store: createSocketSessionStore(io), sockets };
}

function createSocket(id: string) {
  return { id, join: vi.fn(), leave: vi.fn() } as unknown as Socket & { join: ReturnType<typeof vi.fn>; leave: ReturnType<typeof vi.fn> };
}

test('attaches creator and player sessions', () => {
  const { store } = createStore();
  const creator = createSocket('creator-1');
  const player = createSocket('player-1');

  store.attachCreator('room1', creator);
  store.attachPlayer('room1', 'Alice', player);

  expect(store.get(creator)).toEqual({ roomId: 'room1', role: 'creator' });
  expect(store.get(player)).toEqual({ roomId: 'room1', role: 'player', pseudo: 'Alice' });
  expect(creator.join).toHaveBeenCalledWith('room1');
  expect(player.join).toHaveBeenCalledWith('room1');
});

test('retrieves sessions by expected role only', () => {
  const { store } = createStore();
  const creator = createSocket('creator-1');
  const player = createSocket('player-1');
  store.attachCreator('room1', creator);
  store.attachPlayer('room1', 'Alice', player);

  expect(store.getCreator(creator, 'room1')).toEqual({ roomId: 'room1', role: 'creator' });
  expect(store.getPlayer(player, 'room1')).toEqual({ roomId: 'room1', role: 'player', pseudo: 'Alice' });
  expect(store.getCreator(player, 'room1')).toBeNull();
  expect(store.getPlayer(creator, 'room1')).toBeNull();
  expect(store.getCreator(creator, 'missing')).toBeNull();
});

test('replaces and detaches sockets', () => {
  const { store, sockets } = createStore();
  const socket = createSocket('player-1');
  const liveSocket = { leave: vi.fn() };
  sockets.set('player-1', liveSocket);
  store.attachPlayer('room1', 'Alice', socket);

  store.replaceSocket('player-1', 'room1');
  expect(store.get(socket)).toBeNull();
  expect(liveSocket.leave).toHaveBeenCalledWith('room1');

  const nextSocket = createSocket('player-2');
  store.attachPlayer('room1', 'Alice', nextSocket);
  expect(store.isAttached(nextSocket)).toBe(true);
  store.detachSocketId('player-2');
  expect(store.isAttached(nextSocket)).toBe(false);
});
