import React, { useEffect, useMemo, useState } from 'react';
import { AppSettings, LoggedExercise, LoggedSet, WorkoutSession } from '../types/workout';
import {
  calcExerciseVolume,
  calcSessionSetCount,
  calcSessionVolume,
  formatRestClock,
  formatVolume,
} from '../utils/format';

interface ActiveExerciseViewProps {
  session: WorkoutSession;
  activeExercise: LoggedExercise;
  previousReferenceSet: { weight: number; reps: number } | null;
  settings: AppSettings;
  onUpdateTargetRest: (seconds: number) => void;
  onExtendRest: (deltaSeconds: number) => void;
  onLogSet: (weight: number, reps: number) => void;
  onUpdateSet: (setId: string, weight: number, reps: number) => void;
  onDeleteSet: (setId: string) => void;
  onCompleteExercise: () => void;
  onSwitchExercise: () => void;
  onEndWorkout: () => void;
}

const REST_PRESETS = [60, 90, 120, 180];

export const ActiveExerciseView: React.FC<ActiveExerciseViewProps> = ({
  session,
  activeExercise,
  previousReferenceSet,
  settings,
  onUpdateTargetRest,
  onExtendRest,
  onLogSet,
  onUpdateSet,
  onDeleteSet,
  onCompleteExercise,
  onSwitchExercise,
  onEndWorkout,
}) => {
  const [weightInput, setWeightInput] = useState<string>('45');
  const [repsInput, setRepsInput] = useState<string>('10');
  const [restElapsed, setRestElapsed] = useState<number>(0);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<string>('');
  const [editReps, setEditReps] = useState<string>('');

  // Pre-fill weight & reps: latest set in this exercise, else the starting set from last time
  useEffect(() => {
    const lastSet = activeExercise.sets[activeExercise.sets.length - 1];
    if (lastSet) {
      setWeightInput(String(lastSet.weight));
      setRepsInput(String(lastSet.reps));
    } else if (previousReferenceSet) {
      setWeightInput(String(previousReferenceSet.weight));
      setRepsInput(String(previousReferenceSet.reps));
    } else {
      setWeightInput(session.unit === 'LBS' ? '45' : '20');
      setRepsInput('10');
    }
    setEditingSetId(null);
  }, [activeExercise.id, activeExercise.sets.length, previousReferenceSet, session.unit]);

  const activeRestTarget = session.restTargetSeconds ?? settings.targetRestSeconds;

  // Countdown rest timer: stops at 00:00 (assumes user started their next set)
  useEffect(() => {
    if (!session.restStartedAt) {
      setRestElapsed(0);
      return;
    }
    let id: number | undefined;
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(session.restStartedAt!).getTime()) / 1000);
      const clamped = Math.max(0, Math.min(diff, activeRestTarget));
      setRestElapsed(clamped);
      if (clamped >= activeRestTarget && id !== undefined) {
        window.clearInterval(id);
        id = undefined;
      }
    };
    tick();
    if (
      Math.floor((Date.now() - new Date(session.restStartedAt).getTime()) / 1000) <
      activeRestTarget
    ) {
      id = window.setInterval(tick, 250);
    }
    return () => {
      if (id !== undefined) window.clearInterval(id);
    };
  }, [session.restStartedAt, activeRestTarget]);

  const exerciseVol = useMemo(() => calcExerciseVolume(activeExercise), [activeExercise]);
  const sessionVol = useMemo(() => calcSessionVolume(session), [session]);
  const sessionSets = useMemo(() => calcSessionSetCount(session), [session]);

  const completedExercises = useMemo(
    () => session.exercises.filter((e) => e.id !== activeExercise.id && e.sets.length > 0),
    [session.exercises, activeExercise.id]
  );

  const parsedWeight = Math.max(0, Number(weightInput) || 0);
  const parsedReps = Math.max(0, Math.floor(Number(repsInput) || 0));
  const previewVol = parsedWeight * parsedReps;

  const isResting = session.restStartedAt !== null;
  const restRemaining = isResting ? Math.max(0, activeRestTarget - restElapsed) : activeRestTarget;
  const restDone = isResting && restRemaining === 0;
  const restPct = isResting
    ? Math.min(100, (restElapsed / Math.max(1, activeRestTarget)) * 100)
    : 0;

  const stepWeight = (delta: number) => {
    const next = Math.max(0, Math.round((parsedWeight + delta) * 10) / 10);
    setWeightInput(String(next));
  };

  const stepReps = (delta: number) => {
    const next = Math.max(1, parsedReps + delta);
    setRepsInput(String(next));
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedReps <= 0) return;
    onLogSet(parsedWeight, parsedReps);
  };

  const startEdit = (set: LoggedSet) => {
    setEditingSetId(set.id);
    setEditWeight(String(set.weight));
    setEditReps(String(set.reps));
  };

  const commitEdit = (setId: string) => {
    const w = Math.max(0, Number(editWeight) || 0);
    const r = Math.max(1, Math.floor(Number(editReps) || 1));
    onUpdateSet(setId, w, r);
    setEditingSetId(null);
  };

  return (
    <div className="stack-md">
      {/* Active Exercise Header & Live Telemetry */}
      <section className="panel panel--accent-green">
        <div className="panel-header">
          <div>
            <div className="micro-label">
              ACTIVE PROTOCOL // {activeExercise.category}
            </div>
            <h2 className="panel-title">{activeExercise.exerciseName}</h2>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onSwitchExercise}>
            SWITCH
          </button>
        </div>

        <div className="stat-grid">
          <div className="stat-cell">
            <span className="stat-cell__label">EX VOLUME ({session.unit})</span>
            <span className="stat-cell__value stat-cell__value--amber">
              {formatVolume(exerciseVol)}
            </span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">EX SETS</span>
            <span className="stat-cell__value">{activeExercise.sets.length}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">SESSION VOL</span>
            <span className="stat-cell__value">{formatVolume(sessionVol)}</span>
          </div>
        </div>
      </section>

      {/* Live Rest Countdown Module (stops at 00:00 -> assumes set started) */}
      <section
        className={`rest-module ${
          !isResting ? 'rest-module--idle' : restDone ? 'rest-module--ready' : ''
        }`}
      >
        <div className="rest-module__top">
          <div>
            <div className="micro-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className={`led ${
                  !isResting
                    ? 'led--muted'
                    : restDone
                      ? 'led--green'
                      : 'led--amber led--pulse'
                }`}
              />
              {!isResting
                ? `REST TIMER // STANDBY (${formatRestClock(activeRestTarget)})`
                : restDone
                  ? `REST COMPLETE (${formatRestClock(activeRestTarget)}) — SET IN PROGRESS`
                  : `REST REMAINING // TARGET ${formatRestClock(activeRestTarget)}`}
            </div>
            <div className="rest-clock" style={{ marginTop: 4 }}>
              {formatRestClock(restRemaining)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {isResting && (
              <button
                type="button"
                className="btn btn--orange btn--sm"
                onClick={() => onExtendRest(30)}
              >
                +30S REST
              </button>
            )}
            <div className="rest-presets" aria-label="Target rest presets">
              {REST_PRESETS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`chip ${settings.targetRestSeconds === sec ? 'chip--active' : ''}`}
                  onClick={() => onUpdateTargetRest(sec)}
                >
                  {sec}S
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rest-progress-track">
          <div className="rest-progress-fill" style={{ width: `${restPct}%` }} />
        </div>
      </section>

      {/* Fast Set Entry Panel */}
      <section className="panel panel--accent-orange">
        <form onSubmit={handleLogSubmit} className="stack-md">
          <div className="panel-header" style={{ marginBottom: 0 }}>
            <div>
              <div className="micro-label">
                SET #{activeExercise.sets.length + 1} // DATA ENTRY
              </div>
              {previousReferenceSet && activeExercise.sets.length === 0 && (
                <div className="micro-label" style={{ color: '#b85314', marginTop: 2 }}>
                  LAST START WEIGHT: {previousReferenceSet.weight} {session.unit} ×{' '}
                  {previousReferenceSet.reps}
                </div>
              )}
            </div>
            <span className="tag mono">
              SET VOL: {formatVolume(previewVol)} {session.unit}
            </span>
          </div>

          <div className="set-entry-grid">
            <div className="stepper-field">
              <label htmlFor="weight-input" className="field-label">
                WEIGHT ({session.unit})
              </label>
              <div className="stepper-row">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => stepWeight(-settings.weightIncrement)}
                  aria-label={`Decrease weight by ${settings.weightIncrement}`}
                >
                  -{settings.weightIncrement}
                </button>
                <input
                  id="weight-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  className="numeric-input"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                />
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => stepWeight(settings.weightIncrement)}
                  aria-label={`Increase weight by ${settings.weightIncrement}`}
                >
                  +{settings.weightIncrement}
                </button>
              </div>
            </div>

            <div className="stepper-field">
              <label htmlFor="reps-input" className="field-label">
                REPS
              </label>
              <div className="stepper-row">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => stepReps(-1)}
                  aria-label="Decrease reps by 1"
                >
                  -1
                </button>
                <input
                  id="reps-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  className="numeric-input"
                  value={repsInput}
                  onChange={(e) => setRepsInput(e.target.value)}
                />
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => stepReps(1)}
                  aria-label="Increase reps by 1"
                >
                  +1
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--block"
            disabled={parsedReps <= 0}
          >
            LOG SET #{activeExercise.sets.length + 1}
          </button>
        </form>
      </section>

      {/* Logged Sets Telemetry Readout */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="micro-label">TELEMETRY // RECORDED SETS</div>
            <h3 className="panel-title" style={{ fontSize: '0.96rem' }}>
              {activeExercise.exerciseName}
            </h3>
          </div>
          <span className="micro-label">{activeExercise.sets.length} LOGGED</span>
        </div>

        {activeExercise.sets.length === 0 ? (
          <div className="empty-state">
            NO SETS LOGGED FOR THIS EXERCISE YET. ENTER WEIGHT &amp; REPS ABOVE.
          </div>
        ) : (
          <table className="telemetry-table">
            <thead>
              <tr>
                <th>SET</th>
                <th className="num">WEIGHT</th>
                <th className="num">REPS</th>
                <th className="num">VOL</th>
                <th className="num">REST</th>
                <th className="num">ACT</th>
              </tr>
            </thead>
            <tbody>
              {activeExercise.sets.map((s) => {
                const isEditing = editingSetId === s.id;
                return (
                  <tr key={s.id}>
                    <td>#{s.setNumber}</td>
                    <td className="num">
                      {isEditing ? (
                        <input
                          type="number"
                          step="any"
                          className="numeric-input"
                          style={{ height: 30, fontSize: '0.85rem', width: 70 }}
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                        />
                      ) : (
                        `${s.weight} ${session.unit}`
                      )}
                    </td>
                    <td className="num">
                      {isEditing ? (
                        <input
                          type="number"
                          className="numeric-input"
                          style={{ height: 30, fontSize: '0.85rem', width: 54 }}
                          value={editReps}
                          onChange={(e) => setEditReps(e.target.value)}
                        />
                      ) : (
                        s.reps
                      )}
                    </td>
                    <td className="num">{formatVolume(s.weight * s.reps)}</td>
                    <td className="num">
                      {s.restSeconds !== null ? formatRestClock(s.restSeconds) : '--:--'}
                    </td>
                    <td className="num">
                      {isEditing ? (
                        <button
                          type="button"
                          className="icon-action"
                          onClick={() => commitEdit(s.id)}
                        >
                          SAVE
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="icon-action"
                            onClick={() => startEdit(s)}
                          >
                            EDT
                          </button>
                          <button
                            type="button"
                            className="icon-action icon-action--danger"
                            onClick={() => onDeleteSet(s.id)}
                          >
                            DEL
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Primary Workflow Action: Mark Done -> Immediately Opens Next Exercise Scoped to Same Group */}
      <div className="action-row">
        <button
          type="button"
          className="btn btn--orange btn--lg"
          onClick={onCompleteExercise}
        >
          MARK EXERCISE DONE &rarr; NEXT ({activeExercise.category})
        </button>
        <button
          type="button"
          className="btn btn--danger btn--lg"
          style={{ flex: '0 1 200px' }}
          onClick={onEndWorkout}
        >
          END WORKOUT ({sessionSets} SETS)
        </button>
      </div>

      {/* Completed Exercises in This Session */}
      {completedExercises.length > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div className="micro-label">
              SESSION LOG // COMPLETED EXERCISES ({completedExercises.length})
            </div>
          </div>
          <div className="stack-sm">
            {completedExercises.map((ex) => (
              <div
                key={ex.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{ex.exerciseName}</span>{' '}
                  <span className="tag">{ex.category}</span>
                </div>
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                  {ex.sets.length} SETS · {formatVolume(calcExerciseVolume(ex))} {session.unit}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
