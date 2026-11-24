import React, { useEffect, useMemo, useState } from 'react';
import { Exercise, MUSCLE_GROUPS, MuscleGroup } from '../types/workout';
import { formatRestClock } from '../utils/format';
import { ConstellationSwoosh } from './ConstellationSwoosh';

interface ExercisePickerProps {
  exercises: Exercise[];
  initialCategory: MuscleGroup;
  completedExerciseIds: Set<string>;
  restStartedAt: string | null;
  restTargetSeconds: number;
  canCancel: boolean;
  canEndWorkout: boolean;
  promptReason: 'start' | 'next-after-done' | 'switch';
  onSelectExercise: (exercise: Exercise) => void;
  onAddCustomExercise: (name: string, category: MuscleGroup) => Promise<Exercise>;
  onExtendRest: (deltaSeconds: number) => void;
  onCancel: () => void;
  onEndWorkout: () => void;
}

export const ExercisePicker: React.FC<ExercisePickerProps> = ({
  exercises,
  initialCategory,
  completedExerciseIds,
  restStartedAt,
  restTargetSeconds,
  canCancel,
  canEndWorkout,
  promptReason,
  onSelectExercise,
  onAddCustomExercise,
  onExtendRest,
  onCancel,
  onEndWorkout,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MuscleGroup>(initialCategory);
  const [selectedDropdownId, setSelectedDropdownId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);
  const [restRemaining, setRestRemaining] = useState<number>(restTargetSeconds);

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (!restStartedAt) {
      setRestRemaining(restTargetSeconds);
      return;
    }
    let id: number | undefined;
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(restStartedAt).getTime()) / 1000);
      const rem = Math.max(0, restTargetSeconds - Math.max(0, diff));
      setRestRemaining(rem);
      if (rem === 0 && id !== undefined) {
        window.clearInterval(id);
        id = undefined;
      }
    };
    tick();
    const initialDiff = Math.floor((Date.now() - new Date(restStartedAt).getTime()) / 1000);
    if (initialDiff < restTargetSeconds) {
      id = window.setInterval(tick, 250);
    }
    return () => {
      if (id !== undefined) window.clearInterval(id);
    };
  }, [restStartedAt, restTargetSeconds]);

  const categoryExercises = useMemo(() => {
    return exercises
      .filter((ex) => ex.category === selectedCategory)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, selectedCategory]);

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categoryExercises;
    return categoryExercises.filter((ex) => ex.name.toLowerCase().includes(q));
  }, [categoryExercises, search]);

  useEffect(() => {
    if (categoryExercises.length > 0) {
      const firstUncompleted = categoryExercises.find((e) => !completedExerciseIds.has(e.id));
      setSelectedDropdownId((firstUncompleted ?? categoryExercises[0]).id);
    } else {
      setSelectedDropdownId('');
    }
  }, [categoryExercises, completedExerciseIds]);

  const handleConfirmDropdown = () => {
    const found = exercises.find((e) => e.id === selectedDropdownId);
    if (found) {
      onSelectExercise(found);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim();
    if (!trimmed) return;
    setSavingCustom(true);
    try {
      const created = await onAddCustomExercise(trimmed, selectedCategory);
      setCustomName('');
      setShowCustomForm(false);
      onSelectExercise(created);
    } finally {
      setSavingCustom(false);
    }
  };

  const headerSubtitle =
    promptReason === 'next-after-done'
      ? `EXERCISE COMPLETE // SCOPED TO ${selectedCategory}`
      : promptReason === 'switch'
        ? 'REASSIGN ACTIVE PROTOCOL'
        : 'SELECT INITIAL EXERCISE PROTOCOL';

  return (
    <div className="picker-overlay" role="dialog" aria-modal="true" aria-label="Select Exercise">
      <div className="picker-modal">
        <ConstellationSwoosh variant="compact" />

        <div className="picker-body">
          <div className="panel-header" style={{ marginBottom: 0 }}>
            <div>
              <div className="micro-label">{headerSubtitle}</div>
              <h2 className="panel-title">Select Next Exercise</h2>
            </div>
            {canCancel && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
                CLOSE
              </button>
            )}
          </div>

          {restStartedAt && (
            <div className={`banner ${restRemaining === 0 ? 'banner--green' : 'banner--amber'}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={`led ${
                    restRemaining === 0 ? 'led--green' : 'led--amber led--pulse'
                  }`}
                />
                {restRemaining === 0
                  ? 'REST COMPLETE — READY FOR NEXT SET'
                  : 'INTER-EXERCISE REST REMAINING'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <strong
                  className="mono"
                  style={{
                    fontSize: '1.05rem',
                    color: restRemaining === 0 ? 'var(--led-green)' : '#b85314',
                  }}
                >
                  {formatRestClock(restRemaining)}
                </strong>
                <button
                  type="button"
                  className="btn btn--orange btn--sm"
                  onClick={() => onExtendRest(30)}
                >
                  +30S
                </button>
              </span>
            </div>
          )}

          {/* Category Dropdown + Segmented Group Buttons */}
          <div className="field-group">
            <label htmlFor="category-select" className="field-label">
              MUSCLE GROUP // CATEGORY
            </label>
            <select
              id="category-select"
              className="terminal-select"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value as MuscleGroup);
                setSearch('');
              }}
            >
              {MUSCLE_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>

            <div className="category-tabs">
              {MUSCLE_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  className={`cat-tab ${selectedCategory === group ? 'cat-tab--active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(group);
                    setSearch('');
                  }}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise Dropdown + Quick Confirm */}
          <div className="field-group">
            <label htmlFor="exercise-select" className="field-label">
              WORKOUT // {selectedCategory} ({categoryExercises.length})
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                id="exercise-select"
                className="terminal-select"
                value={selectedDropdownId}
                onChange={(e) => setSelectedDropdownId(e.target.value)}
              >
                {categoryExercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                    {completedExerciseIds.has(ex.id) ? ' [DONE]' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--primary"
                style={{ flexShrink: 0 }}
                disabled={!selectedDropdownId}
                onClick={handleConfirmDropdown}
              >
                LOAD
              </button>
            </div>
          </div>

          {/* Quick Filter + Direct Tap List */}
          <div className="field-group">
            <input
              type="text"
              className="terminal-input"
              placeholder={`Filter ${selectedCategory.toLowerCase()} exercises...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="exercise-list">
              {filteredExercises.map((ex) => {
                const alreadyDone = completedExerciseIds.has(ex.id);
                return (
                  <button
                    key={ex.id}
                    type="button"
                    className="exercise-row"
                    onClick={() => onSelectExercise(ex)}
                  >
                    <span className="exercise-row__name">{ex.name}</span>
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      {ex.isCustom && <span className="tag tag--slate">CUSTOM</span>}
                      {alreadyDone && <span className="tag tag--green">LOGGED</span>}
                    </span>
                  </button>
                );
              })}
              {filteredExercises.length === 0 && (
                <div className="empty-state">No exercises match &ldquo;{search}&rdquo;.</div>
              )}
            </div>
          </div>

          {/* Inline Custom Exercise Creator */}
          {!showCustomForm ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setShowCustomForm(true)}
            >
              + ADD CUSTOM {selectedCategory} EXERCISE
            </button>
          ) : (
            <form onSubmit={handleCreateCustom} className="stack-sm">
              <div className="field-group">
                <label htmlFor="custom-ex-name" className="field-label">
                  NEW CUSTOM EXERCISE ({selectedCategory})
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="custom-ex-name"
                    type="text"
                    className="terminal-input"
                    placeholder="e.g., Cable Y-Raise"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn btn--orange"
                    disabled={savingCustom || !customName.trim()}
                  >
                    ADD &amp; LOAD
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomName('');
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </form>
          )}

          {canEndWorkout && (
            <>
              <div className="divider" />
              <button
                type="button"
                className="btn btn--danger btn--block"
                onClick={onEndWorkout}
              >
                END WORKOUT &amp; SAVE SESSION
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
