export type MuscleGroup =
  | 'CHEST'
  | 'BACK'
  | 'SHOULDERS'
  | 'LEGS'
  | 'ARMS'
  | 'CORE'
  | 'CARDIO';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'CHEST',
  'BACK',
  'SHOULDERS',
  'LEGS',
  'ARMS',
  'CORE',
  'CARDIO',
];

export type WeightUnit = 'LBS' | 'KG';

export type SyncStatus = 'pending' | 'synced';

export interface Exercise {
  id: string;
  name: string;
  category: MuscleGroup;
  isCustom: boolean;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
}

export interface LoggedSet {
  id: string;
  setNumber: number;
  weight: number;
  reps: number;
  /** Elapsed rest in seconds taken BEFORE this set was logged (null for the first set of a session) */
  restSeconds: number | null;
  /** Inferred ISO-8601 UTC timestamp when the set started (when prior rest timer hit 0) */
  assumedStartedAt?: string | null;
  /** Exact ISO-8601 UTC timestamp when LOG SET was pressed */
  loggedAt: string;
}

export type SessionEventType =
  | 'session_started'
  | 'exercise_selected'
  | 'set_logged'
  | 'set_updated'
  | 'set_deleted'
  | 'rest_extended'
  | 'rest_target_changed'
  | 'exercise_completed'
  | 'session_ended';

export interface SessionEvent {
  id: string;
  type: SessionEventType;
  /** Exact ISO-8601 UTC timestamp when the button was pressed */
  timestamp: string;
  /** Unix epoch milliseconds for direct time-series alignment */
  epochMs: number;
  exerciseId?: string;
  exerciseName?: string;
  category?: MuscleGroup;
  setNumber?: number;
  weight?: number;
  reps?: number;
  deltaSeconds?: number;
  restTargetSeconds?: number;
  restSeconds?: number | null;
  assumedSetStartedAt?: string | null;
}

export interface LoggedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  category: MuscleGroup;
  startedAt: string;
  completedAt: string | null;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: 'active' | 'completed';
  unit: WeightUnit;
  /** Timestamp (ISO) when the current rest timer began (set on each logged set) */
  restStartedAt: string | null;
  /** Target rest duration in seconds for the current rest window (includes +30s extensions) */
  restTargetSeconds?: number | null;
  /** ID of the currently active LoggedExercise while session is in progress */
  activeExerciseId: string | null;
  /** Last selected muscle group so the picker auto-scopes to the same group */
  lastCategory: MuscleGroup;
  exercises: LoggedExercise[];
  /** Append-only button-press event log for external time-series alignment */
  events?: SessionEvent[];
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
}

export interface AppSettings {
  unit: WeightUnit;
  targetRestSeconds: number;
  weightIncrement: number;
  nasUrl: string;
  apiToken: string;
  lastSyncAt: string | null;
}

export type NasConnectionState =
  | 'unconfigured'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error';

export interface SyncStateSnapshot {
  state: NasConnectionState;
  pendingCount: number;
  lastSyncAt: string | null;
  message: string;
}
