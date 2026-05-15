import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import type { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import Home from './Home';
import type { RoomAck } from '../shared/types';

type Handler = (...args: unknown[]) => void;

function createSocketMock(ack: RoomAck) {
  const handlers: Record<string, Handler> = {};
  const socket = {
    emit: vi.fn((event: string, _payload: unknown, callback?: (ack: RoomAck) => void) => {
      if (event === 'joinRoom') callback?.(ack);
    }),
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
      return socket;
    }),
    off: vi.fn((event: string) => {
      delete handlers[event];
      return socket;
    }),
  };

  return { socket: socket as unknown as Socket, emit: socket.emit, handlers };
}

test('joins by direct room code without needing a published room list', () => {
  const { socket, emit } = createSocketMock({ ok: true, role: 'player', roomId: 'room1', pseudo: 'Alice', participantToken: 'token-1' });
  const onPlayerJoined = vi.fn();
  const onCreatorJoined = vi.fn();

  const { container } = render(
    <Home
      socket={socket}
      teacher={null}
      onPlayerJoined={onPlayerJoined}
      onCreatorJoined={onCreatorJoined}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Rejoindre une room' }));
  const inputs = container.querySelectorAll('input');
  fireEvent.change(inputs[0], { target: { value: 'Alice' } });
  fireEvent.change(container.querySelectorAll('input')[1], { target: { value: 'room1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rejoindre la room !' }));

  expect(emit).toHaveBeenCalledWith('joinRoom', { roomId: 'room1', pseudo: 'Alice' }, expect.any(Function));
  expect(onPlayerJoined).toHaveBeenCalledWith({ roomId: 'room1', pseudo: 'Alice', participantToken: 'token-1' });
});

test('does not subscribe to legacy room rejection events', () => {
  const { socket } = createSocketMock({ ok: false, reason: 'roomNotFound' });

  render(<Home socket={socket} teacher={null} onPlayerJoined={vi.fn()} onCreatorJoined={vi.fn()} />);

  expect(socket.on).not.toHaveBeenCalledWith('roomAlreadyExists', expect.any(Function));
  expect(socket.on).not.toHaveBeenCalledWith('pseudoAlreadyExists', expect.any(Function));
  expect(socket.on).not.toHaveBeenCalledWith('roomFull', expect.any(Function));
  expect(socket.on).not.toHaveBeenCalledWith('actionRejected', expect.any(Function));
});

test('shows the ack error and does not enter a missing room', () => {
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  const { socket } = createSocketMock({ ok: false, reason: 'roomNotFound' });
  const onPlayerJoined = vi.fn();
  const onCreatorJoined = vi.fn();

  const { container } = render(
    <Home
      socket={socket}
      teacher={null}
      onPlayerJoined={onPlayerJoined}
      onCreatorJoined={onCreatorJoined}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Rejoindre une room' }));
  const inputs = container.querySelectorAll('input');
  fireEvent.change(inputs[0], { target: { value: 'Alice' } });
  fireEvent.change(container.querySelectorAll('input')[1], { target: { value: 'missing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rejoindre la room !' }));

  expect(onPlayerJoined).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Cette room n'existe pas"));
  alertSpy.mockRestore();
});
