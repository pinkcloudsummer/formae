import { LoggedExercise, WorkoutSession } from '../types/workout';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatRestClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDuration(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatVolume(volume: number): string {
  return Math.round(volume).toLocaleString('en-US');
}

export function calcExerciseVolume(exercise: LoggedExercise): number {
  return exercise.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function calcSessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce((sum, ex) => sum + calcExerciseVolume(ex), 0);
}

export function calcSessionSetCount(session: WorkoutSession): number {
  return session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
}

export function calcSessionAvgRest(session: WorkoutSession): number | null {
  const rests: number[] = [];
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.restSeconds !== null && s.restSeconds > 0) {
        rests.push(s.restSeconds);
      }
    }
  }
  if (rests.length === 0) return null;
  return Math.round(rests.reduce((a, b) => a + b, 0) / rests.length);
}

export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).toUpperCase();
}

export function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function getSessionMuscleGroups(session: WorkoutSession): string[] {
  const seen = new Set<string>();
  for (const ex of session.exercises) {
    if (ex.sets.length > 0) {
      seen.add(ex.category);
    }
  }
  return Array.from(seen);
}
