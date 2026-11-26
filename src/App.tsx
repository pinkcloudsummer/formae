import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActiveExerciseView } from './components/ActiveExerciseView';
import { ExercisePicker } from './components/ExercisePicker';
import { HistoryView } from './components/HistoryView';
import { SessionDebrief } from './components/SessionDebrief';
import { SettingsView } from './components/SettingsView';
import { StandbyView } from './components/StandbyView';
import { NavTab, TopTelemetryBar } from './components/TopTelemetryBar';
import { ConstellationSwoosh } from './components/ConstellationSwoosh';
import { FieldMonitorBridge } from './components/FieldMonitorBridge';
import { BUILTIN_EXERCISES } from './data/exerciseCatalog';
import {
  DEFAULT_SETTINGS,
  ExportPayload,
  exportLocalData,
  getActiveSession,
  getAllSessions,
  getCustomExercises,
  getPendingCount,
  importLocalData,
  loadSettings,
  saveCustomExercise,
  saveSession,
  saveSettings,
  softDeleteSession,
} from './db/database';
import { runNasSync } from './services/syncEngine';
import {
  AppSettings,
  Exercise,
  LoggedExercise,
  LoggedSet,
  MuscleGroup,
  SessionEvent,
  SessionEventType,
  SyncStateSnapshot,
  WorkoutSession,
} from './types/workout';
import { generateId } from './utils/format';

type PickerPromptReason = 'start' | 'next-after-done' | 'switch';

function createSessionEvent(
  type: SessionEventType,
  extra: Omit<SessionEvent, 'id' | 'type' | 'timestamp' | 'epochMs'> = {},
  epochMs = Date.now()
): SessionEvent {
  return {
    id: generateId(),
    type,
    timestamp: new Date(epochMs).toISOString(),
    epochMs,
    ...extra,
  };
}

export const App: React.FC = () => {
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('terminal');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [debriefSession, setDebriefSession] = useState<WorkoutSession | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<MuscleGroup>('CHEST');
  const [pickerReason, setPickerReason] = useState<PickerPromptReason>('start');

  const [syncState, setSyncState] = useState<SyncStateSnapshot>({
    state: 'unconfigured',
    pendingCount: 0,
    lastSyncAt: null,
    message: 'LOCAL ONLY',
  });

  const allExercises = useMemo<Exercise[]>(() => {
    return [...BUILTIN_EXERCISES, ...customExercises];
  }, [customExercises]);

  const completedSessions = useMemo<WorkoutSession[]>(() => {
    return sessions.filter((s) => s.status === 'completed');
  }, [sessions]);

  const refreshLocalData = useCallback(async () => {
    const [loadedSettings, loadedSessions, loadedCustom, loadedActive, pending] =
      await Promise.all([
        loadSettings(),
        getAllSessions(false),
        getCustomExercises(false),
        getActiveSession(),
        getPendingCount(),
      ]);

    setSettings(loadedSettings);
    setSessions(loadedSessions);
    setCustomExercises(loadedCustom);
    setActiveSession(loadedActive);

    setSyncState((prev) => ({
      ...prev,
      pendingCount: pending,
      lastSyncAt: loadedSettings.lastSyncAt,
      state: loadedSettings.nasUrl.trim() ? prev.state : 'unconfigured',
      message: loadedSettings.nasUrl.trim() ? prev.message : 'LOCAL ONLY',
    }));

    return { loadedSettings, loadedActive };
  }, []);

  const triggerSync = useCallback(
    async (overrideSettings?: AppSettings) => {
      const targetSettings = overrideSettings ?? (await loadSettings());
      if (!targetSettings.nasUrl.trim()) {
        const pending = await getPendingCount();
        setSyncState({
          state: 'unconfigured',
          pendingCount: pending,
          lastSyncAt: targetSettings.lastSyncAt,
          message: 'LOCAL ONLY',
        });
        return;
      }

      setSyncState((prev) => ({
        ...prev,
        state: 'syncing',
        message: 'SYNCING...',
      }));

      const { snapshot, pulledChanges } = await runNasSync(targetSettings);
      setSyncState(snapshot);

      if (pulledChanges || snapshot.state === 'synced') {
        const [freshSettings, freshSessions, freshCustom] = await Promise.all([
          loadSettings(),
          getAllSessions(false),
          getCustomExercises(false),
        ]);
        setSettings(freshSettings);
        setSessions(freshSessions);
        setCustomExercises(freshCustom);

        // Update debrief session sync badge if currently viewing debrief
        setDebriefSession((prev) => {
          if (!prev) return null;
          const updated = freshSessions.find((s) => s.id === prev.id);
          return updated ?? prev;
        });
      }
    },
    []
  );

  // Initial load & recovery of any in-progress session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { loadedSettings, loadedActive } = await refreshLocalData();
      if (!mounted) return;
      if (loadedActive) {
        setPickerCategory(loadedActive.lastCategory);
        if (!loadedActive.activeExerciseId) {
          setPickerReason('next-after-done');
          setPickerOpen(true);
        }
      }
      setHydrated(true);
      if (loadedSettings.nasUrl.trim()) {
        void triggerSync(loadedSettings);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshLocalData, triggerSync]);

  // Background sync triggers on online & focus events
  useEffect(() => {
    const handleOnline = () => void triggerSync();
    const handleFocus = () => void triggerSync();

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [triggerSync]);

  const persistActiveSession = useCallback(async (updated: WorkoutSession) => {
    setActiveSession(updated);
    await saveSession(updated);
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
  }, []);

  // --- Workout Lifecycle Handlers ---

  const handleStartSession = async (initialGroup?: MuscleGroup) => {
    const epochMs = Date.now();
    const now = new Date(epochMs).toISOString();
    const startCategory: MuscleGroup = initialGroup ?? 'CHEST';
    const newSession: WorkoutSession = {
      id: generateId(),
      startedAt: now,
      endedAt: null,
      status: 'active',
      unit: settings.unit,
      restStartedAt: null,
      restTargetSeconds: null,
      activeExerciseId: null,
      lastCategory: startCategory,
      exercises: [],
      events: [createSessionEvent('session_started', { category: startCategory }, epochMs)],
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    setDebriefSession(null);
    await persistActiveSession(newSession);
    setPickerCategory(startCategory);
    setPickerReason('start');
    setPickerOpen(true);
    setActiveTab('terminal');
  };

  const handleSelectExercise = async (exercise: Exercise) => {
    if (!activeSession) return;
    const epochMs = Date.now();
    const now = new Date(epochMs).toISOString();

    // If an existing exercise in this session matches and has no sets yet, replace it; otherwise start a fresh LoggedExercise
    const cleaned = activeSession.exercises.filter(
      (ex) => ex.id !== activeSession.activeExerciseId || ex.sets.length > 0
    );

    const newLogged: LoggedExercise = {
      id: generateId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      startedAt: now,
      completedAt: null,
      sets: [],
    };

    const event = createSessionEvent(
      'exercise_selected',
      {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        category: exercise.category,
      },
      epochMs
    );

    const updated: WorkoutSession = {
      ...activeSession,
      activeExerciseId: newLogged.id,
      lastCategory: exercise.category,
      exercises: [...cleaned, newLogged],
      events: [...(activeSession.events ?? []), event],
      updatedAt: now,
    };

    await persistActiveSession(updated);
    setPickerCategory(exercise.category);
    setPickerOpen(false);
  };

  const handleAddCustomExercise = async (name: string, category: MuscleGroup): Promise<Exercise> => {
    const now = new Date().toISOString();
    const created: Exercise = {
      id: generateId(),
      name,
      category,
      isCustom: true,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };
    await saveCustomExercise(created);
    setCustomExercises((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    const pending = await getPendingCount();
    setSyncState((prev) => ({ ...prev, pendingCount: pending }));
    return created;
  };

  const handleLogSet = async (weight: number, reps: number) => {
    if (!activeSession || !activeSession.activeExerciseId) return;
    const epochMs = Date.now();
    const now = new Date(epochMs).toISOString();
    let restSeconds: number | null = null;
    let assumedStartedAt: string | null = null;

    if (activeSession.restStartedAt) {
      const restStartMs = new Date(activeSession.restStartedAt).getTime();
      const elapsed = Math.max(0, Math.floor((epochMs - restStartMs) / 1000));
      const restCap = activeSession.restTargetSeconds ?? settings.targetRestSeconds;
      // Once the countdown hits 0, the timer stops and assumes the set started,
      // so recorded rest is capped at the rest target (inclusive of +30s extensions).
      restSeconds = Math.min(elapsed, restCap);
      if (elapsed >= restCap) {
        assumedStartedAt = new Date(restStartMs + restCap * 1000).toISOString();
      }
    }

    let loggedSetNumber = 1;
    let targetExercise: LoggedExercise | undefined;

    const updatedExercises = activeSession.exercises.map((ex) => {
      if (ex.id !== activeSession.activeExerciseId) return ex;
      targetExercise = ex;
      loggedSetNumber = ex.sets.length + 1;
      const nextSet: LoggedSet = {
        id: generateId(),
        setNumber: loggedSetNumber,
        weight,
        reps,
        restSeconds,
        assumedStartedAt,
        loggedAt: now,
      };
      return { ...ex, sets: [...ex.sets, nextSet] };
    });

    const event = createSessionEvent(
      'set_logged',
      {
        exerciseId: targetExercise?.exerciseId,
        exerciseName: targetExercise?.exerciseName,
        category: targetExercise?.category,
        setNumber: loggedSetNumber,
        weight,
        reps,
        restSeconds,
        restTargetSeconds: settings.targetRestSeconds,
        assumedSetStartedAt: assumedStartedAt,
      },
      epochMs
    );

    const updated: WorkoutSession = {
      ...activeSession,
      restStartedAt: now,
      restTargetSeconds: settings.targetRestSeconds,
      exercises: updatedExercises,
      events: [...(activeSession.events ?? []), event],
      updatedAt: now,
    };

    await persistActiveSession(updated);
  };

  const handleExtendRest = async (deltaSeconds: number) => {
    if (!activeSession || !activeSession.restStartedAt) return;
    const epochMs = Date.now();
    const now = new Date(epochMs).toISOString();
    const elapsed = Math.max(
      0,
      Math.floor((epochMs - new Date(activeSession.restStartedAt).getTime()) / 1000)
    );
    const currentTarget = activeSession.restTargetSeconds ?? settings.targetRestSeconds;
    // If still counting down, add 30s to remaining; if already at 0, give 30s from now.
    const nextTarget =
      elapsed < currentTarget ? currentTarget + deltaSeconds : elapsed + deltaSeconds;

    const currentEx = activeSession.exercises.find(
      (e) => e.id === activeSession.activeExerciseId
    );
    const event = createSessionEvent(
      'rest_extended',
      {
        deltaSeconds,
        restTargetSeconds: nextTarget,
        exerciseId: currentEx?.exerciseId,
        exerciseName: currentEx?.exerciseName,
      },
      epochMs
    );

    await persistActiveSession({
      ...activeSession,
      restTargetSeconds: nextTarget,
      events: [...(activeSession.events ?? []), event],
      updatedAt: now,
    });
  };

  const handleUpdateSet = async (setId: string, weight: number, reps: number) => {
    if (!activeSession || !activeSession.activeExerciseId) return;
    const epochMs = Date.now();
    const now = new Date(epochMs).toISOString();

    const currentEx = activeSession.exercises.find(
      (e) => e.id === activeSession.activeExerciseId
    );

    const updatedExercises = activeSession.exercises.map((ex) => {
      if (ex.id !== activeSession.activeExerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s) => (s.id === setId ? { ...s, weight, reps } : s)),
      };
    });

    const event = createSessionEvent(
      'set_updated',
      {
        exerciseId: currentEx?.exerciseId,
        exerciseName: currentEx?.exerciseName,
        weight,
        reps,
      },
      epochMs
    );

    await persistActiveSession({
      ...activeSession,
      exercises: updatedExercises,
      events: [...(activeSession.events ?? []), event],
      updatedAt: now,
    });
  };

  const handleDeleteSet = async (setId: string) => {
    if (!activeSession || !activeSession.activeExerciseId) return;
    const epochMs = Date.now();
    const now = new Date(epochMs).toISOString();

    const currentEx = activeSession.exercises.find(
      (e) => e.id === activeSession.activeExerciseId
    );

    const updatedExercises = activeSession.exercises.map((ex) => {
      if (ex.id !== activeSession.activeExerciseId) return ex;
      const remaining = ex.sets
        .filter((s) => s.id !== setId)
        .map((s, i) => ({ ...s, setNumber: i + 1 }));
      return { ...ex, sets: remaining };
    });

    const event = createSessionEvent(
      'set_deleted',
      {
        exerciseId: currentEx?.exerciseId,
        exerciseName: currentEx?.exerciseName,
      },
      epochMs
    );

    await persistActiveSession({
      ...activeSession,
      exercises: updatedExercises,
      events: [...(activeSession.events ?? []), event],
      updatedAt: now,
    });
  };

  // CORE REQUIREMENT: Mark exercise done -> immediately assume starting another exercise
  // and open the Exercise Picker scoped to the exact same muscle group.
  const handleCompleteExercise = async () => {
    if (!activeSession) return;
    const epochMs = Date.now();
    const now = new Date(epochMs).toISOString();
    const current = activeSession.exercises.find((e) => e.id === activeSession.activeExerciseId);
    const scopedGroup: MuscleGroup = current?.category ?? activeSession.lastCategory;

    const updatedExercises = activeSession.exercises
      .map((ex) =>
        ex.id === activeSession.activeExerciseId ? { ...ex, completedAt: now } : ex
      )
      .filter((ex) => ex.sets.length > 0);

    const event = createSessionEvent(
      'exercise_completed',
      {
        exerciseId: current?.exerciseId,
        exerciseName: current?.exerciseName,
        category: scopedGroup,
      },
      epochMs
    );

    const updated: WorkoutSession = {
      ...activeSession,
      activeExerciseId: null,
      lastCategory: scopedGroup,
      exercises: updatedExercises,
      events: [...(activeSession.events ?? []), event],
      updatedAt: now,
    };

    await persistActiveSession(updated);
    setPickerCategory(scopedGroup);
    setPickerReason('next-after-done');
    setPickerOpen(true);
  };

  const handleEndWorkout = async () => {
    if (!activeSession) return;
    const epochMs = Date.now();
    const now = new Date(epochMs).toISOString();
    const nonEmptyExercises = activeSession.exercises
      .filter((ex) => ex.sets.length > 0)
      .map((ex) => (ex.completedAt ? ex : { ...ex, completedAt: now }));

    // If user started a session and logged zero sets at all, simply discard cleanly
    if (nonEmptyExercises.length === 0) {
      await softDeleteSession(activeSession.id);
      setActiveSession(null);
      setPickerOpen(false);
      await refreshLocalData();
      return;
    }

    const endEvent = createSessionEvent('session_ended', {}, epochMs);

    const finished: WorkoutSession = {
      ...activeSession,
      status: 'completed',
      endedAt: now,
      activeExerciseId: null,
      restStartedAt: null,
      restTargetSeconds: null,
      exercises: nonEmptyExercises,
      events: [...(activeSession.events ?? []), endEvent],
      updatedAt: now,
      syncStatus: 'pending',
    };

    await saveSession(finished);
    setActiveSession(null);
    setPickerOpen(false);
    setDebriefSession(finished);
    await refreshLocalData();

    // Attempt background NAS sync automatically upon session completion
    void triggerSync();
  };

  const handleUpdateTargetRest = async (seconds: number) => {
    const epochMs = Date.now();
    const next = { ...settings, targetRestSeconds: seconds };
    setSettings(next);
    await saveSettings(next);
    if (activeSession && activeSession.restStartedAt) {
      const event = createSessionEvent(
        'rest_target_changed',
        { restTargetSeconds: seconds },
        epochMs
      );
      await persistActiveSession({
        ...activeSession,
        restTargetSeconds: seconds,
        events: [...(activeSession.events ?? []), event],
        updatedAt: new Date(epochMs).toISOString(),
      });
    }
  };

  const handleSaveSettings = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
    const pending = await getPendingCount();
    setSyncState((prev) => ({
      ...prev,
      pendingCount: pending,
      state: next.nasUrl.trim() ? prev.state : 'unconfigured',
      message: next.nasUrl.trim() ? prev.message : 'LOCAL ONLY',
    }));
  };

  const handleDeleteSession = async (sessionId: string) => {
    await softDeleteSession(sessionId);
    await refreshLocalData();
    void triggerSync();
  };

  const handleExportJson = async () => {
    const payload = await exportLocalData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formae-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (file: File): Promise<string> => {
    const text = await file.text();
    const parsed = JSON.parse(text) as ExportPayload;
    const result = await importLocalData(parsed);
    await refreshLocalData();
    void triggerSync();
    return `IMPORTED ${result.sessions} SESSIONS & ${result.exercises} CUSTOM EXERCISES`;
  };

  const activeExercise = useMemo(() => {
    if (!activeSession || !activeSession.activeExerciseId) return null;
    return (
      activeSession.exercises.find((e) => e.id === activeSession.activeExerciseId) ?? null
    );
  }, [activeSession]);

  // Look up the STARTING set (first set) from the last time this exercise was performed
  const previousReferenceSet = useMemo(() => {
    if (!activeExercise) return null;

    if (activeSession) {
      for (let i = activeSession.exercises.length - 1; i >= 0; i--) {
        const ex = activeSession.exercises[i];
        if (
          ex.id !== activeExercise.id &&
          ex.exerciseId === activeExercise.exerciseId &&
          ex.sets.length > 0
        ) {
          const first = ex.sets[0];
          return { weight: first.weight, reps: first.reps };
        }
      }
    }

    for (const s of completedSessions) {
      const match = s.exercises.find(
        (e) => e.exerciseId === activeExercise.exerciseId && e.sets.length > 0
      );
      if (match) {
        const first = match.sets[0];
        return { weight: first.weight, reps: first.reps };
      }
    }
    return null;
  }, [activeExercise, activeSession, completedSessions]);

  const completedExerciseIdsInSession = useMemo(() => {
    const ids = new Set<string>();
    if (!activeSession) return ids;
    for (const ex of activeSession.exercises) {
      if (ex.sets.length > 0) ids.add(ex.exerciseId);
    }
    return ids;
  }, [activeSession]);

  if (!hydrated) {
    return (
      <div className="app-shell">
        <ConstellationSwoosh variant="header" />
        <main className="main-content">
          <div className="empty-state">INITIALIZING FORMAE LOCAL TELEMETRY DB...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopTelemetryBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeSession={activeSession}
        syncState={syncState}
        onTriggerSync={() => void triggerSync()}
      />

      <main className="main-content">
        {activeTab === 'terminal' && (
          <>
            {activeSession && activeExercise ? (
              <ActiveExerciseView
                session={activeSession}
                activeExercise={activeExercise}
                previousReferenceSet={previousReferenceSet}
                settings={settings}
                onUpdateTargetRest={(sec) => void handleUpdateTargetRest(sec)}
                onExtendRest={(delta) => void handleExtendRest(delta)}
                onLogSet={(w, r) => void handleLogSet(w, r)}
                onUpdateSet={(id, w, r) => void handleUpdateSet(id, w, r)}
                onDeleteSet={(id) => void handleDeleteSet(id)}
                onCompleteExercise={() => void handleCompleteExercise()}
                onSwitchExercise={() => {
                  setPickerCategory(activeExercise.category);
                  setPickerReason('switch');
                  setPickerOpen(true);
                }}
                onEndWorkout={() => void handleEndWorkout()}
              />
            ) : activeSession ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="micro-label">SESSION ACTIVE // AWAITING PROTOCOL</div>
                    <h2 className="panel-title">Select Next Exercise</h2>
                  </div>
                </div>
                <div className="action-row">
                  <button
                    type="button"
                    className="btn btn--primary btn--lg"
                    onClick={() => setPickerOpen(true)}
                  >
                    OPEN EXERCISE PICKER ({activeSession.lastCategory})
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--lg"
                    onClick={() => void handleEndWorkout()}
                  >
                    END WORKOUT
                  </button>
                </div>
              </section>
            ) : debriefSession ? (
              <SessionDebrief
                session={debriefSession}
                syncState={syncState}
                onReturnToTerminal={() => setDebriefSession(null)}
                onSyncNow={() => void triggerSync()}
              />
            ) : (
              <StandbyView
                completedSessions={completedSessions}
                defaultUnit={settings.unit}
                onStartSession={(group) => void handleStartSession(group)}
                onOpenHistory={() => setActiveTab('history')}
              />
            )}
          </>
        )}

        {activeTab === 'history' && (
          <HistoryView
            sessions={completedSessions}
            onDeleteSession={handleDeleteSession}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            syncState={syncState}
            onSaveSettings={handleSaveSettings}
            onSyncNow={triggerSync}
          />
        )}
      </main>

      {pickerOpen && activeSession && (
        <ExercisePicker
          exercises={allExercises}
          initialCategory={pickerCategory}
          completedExerciseIds={completedExerciseIdsInSession}
          restStartedAt={activeSession.restStartedAt}
          restTargetSeconds={activeSession.restTargetSeconds ?? settings.targetRestSeconds}
          canCancel={activeExercise !== null}
          canEndWorkout={true}
          promptReason={pickerReason}
          onSelectExercise={(ex) => void handleSelectExercise(ex)}
          onAddCustomExercise={handleAddCustomExercise}
          onExtendRest={(delta) => void handleExtendRest(delta)}
          onCancel={() => setPickerOpen(false)}
          onEndWorkout={() => void handleEndWorkout()}
        />
      )}

      <footer className="terminal-footer">
        <span>FORMAE // v1.0 LOCAL-FIRST</span>
        <span>STORAGE: INDEXEDDB &rarr; NAS SYNC</span>
      </footer>

      <FieldMonitorBridge view={activeTab} />
    </div>
  );
};

export default App;
