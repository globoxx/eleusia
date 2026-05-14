import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Timer from './Timer';

describe('Timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders the initial duration', () => {
    render(<Timer timerKey={0} isPlaying roundDuration={10} />);

    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('10');
  });

  test('decrements while playing', () => {
    render(<Timer timerKey={0} isPlaying roundDuration={10} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('9');
  });

  test('does not decrement while paused', () => {
    render(<Timer timerKey={0} isPlaying={false} roundDuration={10} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('10');
  });

  test('resumes after pause without resetting', () => {
    const { rerender } = render(<Timer timerKey={0} isPlaying roundDuration={10} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('8');

    rerender(<Timer timerKey={0} isPlaying={false} roundDuration={10} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('8');

    rerender(<Timer timerKey={0} isPlaying roundDuration={10} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('7');
  });

  test('resets when timerKey changes', () => {
    const { rerender } = render(<Timer timerKey={0} isPlaying roundDuration={10} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('7');

    rerender(<Timer timerKey={1} isPlaying roundDuration={10} />);

    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('10');
  });

  test('stays at zero after completion', () => {
    render(<Timer timerKey={0} isPlaying roundDuration={2} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('0');
  });
});
