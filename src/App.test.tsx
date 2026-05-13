import { render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';
import App from './App';

vi.mock('socket.io-client', () => ({
  io: () => ({
    id: 'socket-1',
    connect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

test('renders Eleus-IA home screen', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: 'ELEUS-IA' })).toBeInTheDocument();
  expect(screen.getByText("Dans la peau d'une intelligence artificielle")).toBeInTheDocument();
});
