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
  const { socket, emit } = createSocketMock({ ok: true, roomId: 'room1', pseudo: 'Alice', participantToken: 'token-1' });
  const callbackJoinRoom = vi.fn();

  const { container } = render(
    <Home
      socket={socket}
      callbackPseudoChange={vi.fn()}
      callbackRoomChange={vi.fn()}
      callbackJoinRoom={callbackJoinRoom}
    />,
  );

  const inputs = container.querySelectorAll('input');
  fireEvent.change(inputs[0], { target: { value: 'Alice' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rejoindre une room' }));
  fireEvent.change(container.querySelectorAll('input')[1], { target: { value: 'room1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rejoindre la room !' }));

  expect(emit).toHaveBeenCalledWith('joinRoom', { roomId: 'room1', pseudo: 'Alice' }, expect.any(Function));
  expect(callbackJoinRoom).toHaveBeenCalledWith('room1', 'Alice', 'token-1');
});

test('shows the ack error and does not enter a missing room', () => {
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  const { socket } = createSocketMock({ ok: false, reason: 'roomNotFound' });
  const callbackJoinRoom = vi.fn();

  const { container } = render(
    <Home
      socket={socket}
      callbackPseudoChange={vi.fn()}
      callbackRoomChange={vi.fn()}
      callbackJoinRoom={callbackJoinRoom}
    />,
  );

  const inputs = container.querySelectorAll('input');
  fireEvent.change(inputs[0], { target: { value: 'Alice' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rejoindre une room' }));
  fireEvent.change(container.querySelectorAll('input')[1], { target: { value: 'missing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rejoindre la room !' }));

  expect(callbackJoinRoom).not.toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Cette room n'existe pas"));
  alertSpy.mockRestore();
});
