import { render, screen } from '@testing-library/react';
import React from 'react';
import App from './App';

jest.mock('socket.io-client', () => ({
  io: () => ({
    id: 'socket-1',
    connect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  }),
}));

test('renders Eleus-IA home screen', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: 'ELEUS-IA' })).toBeInTheDocument();
  expect(screen.getByText("Dans la peau d'une intelligence artificielle")).toBeInTheDocument();
});
