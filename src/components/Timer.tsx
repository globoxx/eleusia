import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Timer.css';

type TimerProps = {
  timerKey: number;
  isPlaying: boolean;
  roundDuration: number;
};

const size = 180;
const strokeWidth = 12;
const radius = (size - strokeWidth) / 2;
const circumference = 2 * Math.PI * radius;
const tickMs = 100;

function getDurationMs(roundDuration: number) {
  return Math.max(0, roundDuration * 1000);
}

function getTimerColor(progress: number) {
  if (progress > 0.66) return '#004777';
  if (progress > 0.33) return '#F7B801';
  return '#A30000';
}

function Timer({ timerKey, isPlaying, roundDuration }: TimerProps) {
  const durationMs = useMemo(() => getDurationMs(roundDuration), [roundDuration]);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    setRemainingMs(durationMs);
    lastTickRef.current = null;
  }, [durationMs, timerKey]);

  useEffect(() => {
    if (!isPlaying || remainingMs <= 0) {
      lastTickRef.current = null;
      return undefined;
    }

    lastTickRef.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const elapsedMs = lastTickRef.current === null ? 0 : now - lastTickRef.current;
      lastTickRef.current = now;
      setRemainingMs((current) => Math.max(0, current - elapsedMs));
    }, tickMs);

    return () => window.clearInterval(interval);
  }, [isPlaying, remainingMs]);

  const progress = durationMs === 0 ? 0 : remainingMs / durationMs;
  const displayedSeconds = remainingMs === 0 ? 0 : Math.ceil(remainingMs / 1000);
  const strokeDashoffset = circumference * (1 - progress);
  const color = getTimerColor(progress);

  return (
    <div className="timer-wrapper" role="timer" aria-label="Temps restant" aria-live="polite">
      <svg className="timer-circle" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="timer-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
        <circle
          className="timer-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="time-wrapper">
        <div key={displayedSeconds} className="time">
          {displayedSeconds}
        </div>
      </div>
    </div>
  );
}

export default Timer;
