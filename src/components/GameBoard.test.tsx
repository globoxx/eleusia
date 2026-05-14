import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import type { ClientRoomData, CreatorRoomData } from '../shared/types';
import GameBoard from './GameBoard';

const aiModelMock = vi.hoisted(() => ({
  loadFeatureExtractor: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  loadModel: vi.fn<() => void>(),
  trainModel: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  predictImage: vi.fn<() => Promise<number[]>>().mockResolvedValue([0.2, 0.8]),
  featureExtractor: {},
  model: {},
}));

vi.mock('./Timer', () => ({
  default: () => <div data-testid="timer" />,
}));

vi.mock('./AIModel', () => ({
  default: aiModelMock,
}));

vi.mock('./Modals/EndOfGameModal', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="end-of-game-modal" /> : null),
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

function createRoomData(overrides: Partial<CreatorRoomData> = {}): CreatorRoomData {
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
    currentImage: null,
    currentRoundId: 1,
    waitingForCreator: false,
    roundHistory: [],
    revealedRule: null,
    sizeLimit: 20,
    users: {
      Teacher: {
        totalScore: 0,
        lastScore: null,
        allScores: [],
        connected: true,
      },
      Alice: {
        totalScore: 0,
        lastScore: null,
        allScores: [],
        connected: true,
      },
    },
    ...overrides,
  };
}

function createPublicRoomData(overrides: Partial<ClientRoomData> = {}): ClientRoomData {
  const { rule: _rule, acceptedImages: _acceptedImages, refusedImages: _refusedImages, ...publicRoom } = createRoomData();
  return {
    ...publicRoom,
    ...overrides,
  };
}

beforeEach(() => {
  aiModelMock.loadFeatureExtractor.mockResolvedValue(undefined);
  aiModelMock.loadModel.mockClear();
  aiModelMock.trainModel.mockResolvedValue(undefined);
  aiModelMock.predictImage.mockResolvedValue([0.2, 0.8]);
  aiModelMock.featureExtractor = {};
  aiModelMock.model = {};
});

test('player vote emits room and vote only', () => {
  const { socket, emit, handlers } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Alice" room="room1" roomData={createRoomData()} callbackLeaveRoom={vi.fn()} />);

  act(() => {
    handlers.newRound?.({ roundId: 1, image: 'images/cards/1.png' });
    handlers.timer?.(10);
  });

  expect(screen.getByRole('img', { name: 'Image courante' })).toHaveAttribute('src', 'images/cards/1.png');

  fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

  expect(emit).toHaveBeenCalledWith('vote', { roomId: 'room1', roundId: 1, vote: 0 });
  expect(emit).not.toHaveBeenCalledWith('vote', 'room1', 0);
});

test('creator controls pause and reveal actions', () => {
  const { socket, emit } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Teacher" room="room1" roomData={createRoomData()} callbackLeaveRoom={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  fireEvent.click(screen.getByRole('button', { name: 'Révéler la règle' }));

  expect(emit).toHaveBeenCalledWith('pause', 'room1');
  expect(emit).toHaveBeenCalledWith('endGame', 'room1');
});

test('does not render end of game modal before game is finished', () => {
  const { socket } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Alice" room="room1" roomData={createPublicRoomData({ hasFinished: false })} callbackLeaveRoom={vi.fn()} />);

  expect(screen.queryByTestId('end-of-game-modal')).not.toBeInTheDocument();
});

test('renders end of game modal when game is finished', async () => {
  const { socket } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Alice" room="room1" roomData={createPublicRoomData({ hasFinished: true, revealedRule: 'Accept red cards' })} callbackLeaveRoom={vi.fn()} />);

  expect(await screen.findByTestId('end-of-game-modal')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Room room1' })).toBeInTheDocument();
});

test('does not initialize AI model when room has no AI', () => {
  const { socket } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Teacher" room="room1" roomData={createRoomData({ hasAI: false })} callbackLeaveRoom={vi.fn()} />);

  expect(aiModelMock.loadFeatureExtractor).not.toHaveBeenCalled();
  expect(aiModelMock.loadModel).not.toHaveBeenCalled();
});

test('creator initializes AI model when room has AI', async () => {
  const { socket } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Teacher" room="room1" roomData={createRoomData({ hasAI: true })} callbackLeaveRoom={vi.fn()} />);

  await waitFor(() => expect(aiModelMock.loadFeatureExtractor).toHaveBeenCalledTimes(1));

  expect(aiModelMock.loadModel).toHaveBeenCalledTimes(1);
});

test('AI initialization failure keeps the board rendered', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  aiModelMock.loadFeatureExtractor.mockRejectedValueOnce(new Error('model unavailable'));
  const { socket } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Teacher" room="room1" roomData={createRoomData({ hasAI: true })} callbackLeaveRoom={vi.fn()} />);

  await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Error initializing model:', expect.any(Error)));

  expect(screen.getByRole('heading', { name: 'Room room1' })).toBeInTheDocument();

  consoleError.mockRestore();
});

test('player room data does not expose the secret rule before the end', () => {
  const { socket } = createSocketMock();

  render(<GameBoard socket={socket} pseudo="Alice" room="room1" roomData={createPublicRoomData({ hasFinished: false, revealedRule: null })} callbackLeaveRoom={vi.fn()} />);

  expect(screen.queryByText(/Accept red cards/)).not.toBeInTheDocument();
});
