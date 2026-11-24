import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AppSettings, Exercise, WorkoutSession } from '../types/workout';

const DB_NAME = 'formae-telemetry-db';
const DB_VERSION = 1;

interface FormaeDB extends DBSchema {
  sessions: {
    key: string;
    value: WorkoutSession;
    indexes: {
      'by-startedAt': string;
      'by-syncStatus': string;
    };
  };
  exercises: {
    key: string;
    value: Exercise;
    indexes: {
      'by-category': string;
      'by-syncStatus': string;
    };
  };
  meta: {
    key: string;
    value: AppSettings;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  unit: 'LBS',
  targetRestSeconds: 90,
  weightIncrement: 5,
  nasUrl: '',
  apiToken: '',
  lastSyncAt: null,
};

let dbPromise: Promise<IDBPDatabase<FormaeDB>> | null = null;

function getDB(): Promise<IDBPDatabase<FormaeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FormaeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by-startedAt', 'startedAt');
          sessionStore.createIndex('by-syncStatus', 'syncStatus');
        }
        if (!db.objectStoreNames.contains('exercises')) {
          const exStore = db.createObjectStore('exercises', { keyPath: 'id' });
          exStore.createIndex('by-category', 'category');
          exStore.createIndex('by-syncStatus', 'syncStatus');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

// --- Settings ---

export async function loadSettings(): Promise<AppSettings> {
  const db = await getDB();
  const saved = await db.get('meta', 'settings');
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('meta', settings, 'settings');
}

// --- Sessions ---

export async function getAllSessions(includeDeleted = false): Promise<WorkoutSession[]> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  return all
    .filter((s) => includeDeleted || s.deletedAt === null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getActiveSession(): Promise<WorkoutSession | null> {
  const all = await getAllSessions(false);
  return all.find((s) => s.status === 'active') ?? null;
}

export async function saveSession(session: WorkoutSession): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function softDeleteSession(sessionId: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('sessions', sessionId);
  if (!existing) return;
  const now = new Date().toISOString();
  await db.put('sessions', {
    ...existing,
    deletedAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  });
}

export async function getPendingSessions(): Promise<WorkoutSession[]> {
  const db = await getDB();
  const pending = await db.getAllFromIndex('sessions', 'by-syncStatus', 'pending');
  // Only push completed or soft-deleted sessions; keep active mid-workout sessions local until done
  return pending.filter((s) => s.status === 'completed' || s.deletedAt !== null);
}

export async function markSessionsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('sessions', 'readwrite');
  for (const id of ids) {
    const rec = await tx.store.get(id);
    if (rec && rec.syncStatus === 'pending') {
      await tx.store.put({ ...rec, syncStatus: 'synced' });
    }
  }
  await tx.done;
}

export async function mergePulledSessions(remoteSessions: WorkoutSession[]): Promise<number> {
  if (remoteSessions.length === 0) return 0;
  const db = await getDB();
  const tx = db.transaction('sessions', 'readwrite');
  let merged = 0;
  for (const remote of remoteSessions) {
    const local = await tx.store.get(remote.id);
    if (!local || remote.updatedAt > local.updatedAt) {
      await tx.store.put({ ...remote, syncStatus: 'synced' });
      merged++;
    }
  }
  await tx.done;
  return merged;
}

// --- Custom Exercises ---

export async function getCustomExercises(includeDeleted = false): Promise<Exercise[]> {
  const db = await getDB();
  const all = await db.getAll('exercises');
  return all
    .filter((e) => includeDeleted || e.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCustomExercise(exercise: Exercise): Promise<void> {
  const db = await getDB();
  await db.put('exercises', exercise);
}

export async function getPendingExercises(): Promise<Exercise[]> {
  const db = await getDB();
  return db.getAllFromIndex('exercises', 'by-syncStatus', 'pending');
}

export async function markExercisesSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('exercises', 'readwrite');
  for (const id of ids) {
    const rec = await tx.store.get(id);
    if (rec && rec.syncStatus === 'pending') {
      await tx.store.put({ ...rec, syncStatus: 'synced' });
    }
  }
  await tx.done;
}

export async function mergePulledExercises(remoteExercises: Exercise[]): Promise<number> {
  if (remoteExercises.length === 0) return 0;
  const db = await getDB();
  const tx = db.transaction('exercises', 'readwrite');
  let merged = 0;
  for (const remote of remoteExercises) {
    const local = await tx.store.get(remote.id);
    if (!local || remote.updatedAt > local.updatedAt) {
      await tx.store.put({ ...remote, syncStatus: 'synced' });
      merged++;
    }
  }
  await tx.done;
  return merged;
}

export async function getPendingCount(): Promise<number> {
  const [sessions, exercises] = await Promise.all([
    getPendingSessions(),
    getPendingExercises(),
  ]);
  return sessions.length + exercises.length;
}

// --- JSON Backup Export / Import ---

export interface ExportPayload {
  schema: 'formae-v1';
  exportedAt: string;
  sessions: WorkoutSession[];
  customExercises: Exercise[];
}

export async function exportLocalData(): Promise<ExportPayload> {
  const [sessions, customExercises] = await Promise.all([
    getAllSessions(false),
    getCustomExercises(false),
  ]);
  return {
    schema: 'formae-v1',
    exportedAt: new Date().toISOString(),
    sessions,
    customExercises,
  };
}

export async function importLocalData(payload: ExportPayload): Promise<{ sessions: number; exercises: number }> {
  if (payload.schema !== 'formae-v1') {
    throw new Error('Unsupported backup schema');
  }
  const db = await getDB();
  let sessionCount = 0;
  let exerciseCount = 0;

  if (Array.isArray(payload.sessions)) {
    const tx = db.transaction('sessions', 'readwrite');
    for (const s of payload.sessions) {
      await tx.store.put({ ...s, syncStatus: 'pending' });
      sessionCount++;
    }
    await tx.done;
  }

  if (Array.isArray(payload.customExercises)) {
    const tx = db.transaction('exercises', 'readwrite');
    for (const ex of payload.customExercises) {
      await tx.store.put({ ...ex, syncStatus: 'pending' });
      exerciseCount++;
    }
    await tx.done;
  }

  return { sessions: sessionCount, exercises: exerciseCount };
}
