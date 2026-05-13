import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import type { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import type { RoomData } from '../shared/types';
import GameBoard from './GameBoard';

vi.mock('./Timer', () => ({
  default: () => <div data-testid="timer" />,
}));
vi.mock('mui-image', () => ({
  Image: ({ src }: { src: string }) => <img alt="current round" src={src} />,
}));

type Handler = (...args: unknown[]) => void;

function createSocketMock() {
  const handlers: Record<string, Handler> = {};
  const socket = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  socket.on.mockImplementation((event: string, handler: Handler) => {
      handlers[event] = handler;
      return socket;
  });
  socket.off.mockImplementation((event: string) => {
      delete handlers[event];
      return socket;
  });

  return { socket: socket as unknown as Socket, emit: socket.emit, handlers };
}

function createRoomData(overrides: Partial<RoomData> = {}): RoomData {
  return {
    rule: 'Accept red cards',
    roundDuration: 10,
    creator: 'Teacher',
    autoRun: false,
    hasAI: false,
    paused: false,
    refusedImages: [],
    acceptedImages: [],
    hasStarted: true,
    hasFinished: false,
    timer: 10,
    images: [],
    currentImage: null,
    sizeLimit: 20,
    users: {
      Teacher: {
        socketId: 'creator-socket',
        totalScore: 0,
        lastScore: null,
        allScores: [],
        vote: null,
      },
      Alice: {
        socketId: 'alice-socket',
        totalScore: 0,
        lastScore: null,
        allScores: [],
        vote: null,
      },
    },
    ...overrides,
  };
}

test('player vote emits room and vote only', () => {
  const { socket, emit, handlers } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Alice" room="room1" roomData={createRoomData()} callbackLeaveRoom={vi.fn()} />);

  act(() => {
    handlers.newRound?.('images/cards/1.png');
    handlers.timer?.(10);
  });

  fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

  expect(emit).toHaveBeenCalledWith('vote', 'room1', 0);
  expect(emit).not.toHaveBeenCalledWith('vote', 'room1', 'Alice', 0);
});

test('creator controls pause and reveal actions', () => {
  const { socket, emit } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Teacher" room="room1" roomData={createRoomData()} callbackLeaveRoom={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  fireEvent.click(screen.getByRole('button', { name: 'Révéler la règle' }));

  expect(emit).toHaveBeenCalledWith('pause', 'room1');
  expect(emit).toHaveBeenCalledWith('endGame', 'room1');
});
