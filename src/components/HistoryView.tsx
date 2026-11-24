import React, { useRef, useState } from 'react';
import { WorkoutSession } from '../types/workout';
import {
  calcExerciseVolume,
  calcSessionAvgRest,
  calcSessionSetCount,
  calcSessionVolume,
  formatDuration,
  formatRestClock,
  formatSessionDate,
  formatSessionTime,
  formatVolume,
  getSessionMuscleGroups,
} from '../utils/format';

interface HistoryViewProps {
  sessions: WorkoutSession[];
  onDeleteSession: (sessionId: string) => Promise<void>;
  onExportJson: () => Promise<void>;
  onImportJson: (file: File) => Promise<string>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  onDeleteSession,
  onExportJson,
  onImportJson,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const msg = await onImportJson(file);
      setImportFeedback(msg);
    } catch (err) {
      setImportFeedback(err instanceof Error ? err.message : 'Import failed');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="stack-md">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="micro-label">ARCHIVE // WORKOUT TELEMETRY LOGS</div>
            <h2 className="panel-title">Mission Logs ({sessions.length})</h2>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onExportJson}>
              EXPORT JSON
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => fileInputRef.current?.click()}
            >
              IMPORT
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {importFeedback && (
          <div className="banner banner--green" style={{ marginBottom: 12 }}>
            <span>{importFeedback}</span>
            <button
              type="button"
              className="icon-action"
              onClick={() => setImportFeedback(null)}
            >
              DISMISS
            </button>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="empty-state">
            NO COMPLETED WORKOUTS IN LOCAL ARCHIVE.
          </div>
        ) : (
          <div className="stack-sm">
            {sessions.map((session) => {
              const isOpen = expandedId === session.id;
              const groups = getSessionMuscleGroups(session);
              const vol = calcSessionVolume(session);
              const sets = calcSessionSetCount(session);
              const avgRest = calcSessionAvgRest(session);
              const performed = session.exercises.filter((e) => e.sets.length > 0);

              return (
                <div key={session.id} className="session-card">
                  <div className="session-card__top">
                    <div>
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {formatSessionDate(session.startedAt)}
                      </span>{' '}
                      <span className="micro-label">
                        {formatSessionTime(session.startedAt)} ·{' '}
                        {formatDuration(session.startedAt, session.endedAt)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {groups.map((g) => (
                        <span key={g} className="tag">
                          {g}
                        </span>
                      ))}
                      <span
                        className={`tag ${
                          session.syncStatus === 'synced' ? 'tag--green' : 'tag--orange'
                        }`}
                      >
                        {session.syncStatus === 'synced' ? 'SYNCED' : 'LOCAL PENDING'}
                      </span>
                    </div>
                  </div>

                  <div className="stat-grid">
                    <div className="stat-cell">
                      <span className="stat-cell__label">VOLUME</span>
                      <span className="stat-cell__value" style={{ fontSize: '0.96rem' }}>
                        {formatVolume(vol)} {session.unit}
                      </span>
                    </div>
                    <div className="stat-cell">
                      <span className="stat-cell__label">EX / SETS</span>
                      <span className="stat-cell__value" style={{ fontSize: '0.96rem' }}>
                        {performed.length} / {sets}
                      </span>
                    </div>
                    <div className="stat-cell">
                      <span className="stat-cell__label">AVG REST</span>
                      <span className="stat-cell__value" style={{ fontSize: '0.96rem' }}>
                        {avgRest !== null ? formatRestClock(avgRest) : '--:--'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setExpandedId(isOpen ? null : session.id)}
                    >
                      {isOpen ? 'HIDE DETAILS' : 'INSPECT SETS'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => {
                        if (window.confirm('Delete this workout session? (Will sync deletion to NAS)')) {
                          void onDeleteSession(session.id);
                        }
                      }}
                    >
                      DELETE
                    </button>
                  </div>

                  {isOpen && (
                    <div className="stack-sm" style={{ marginTop: 6 }}>
                      <div className="divider" />
                      {performed.map((ex) => (
                        <div key={ex.id} style={{ paddingBottom: 8 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 4,
                            }}
                          >
                            <strong style={{ fontSize: '0.9rem' }}>
                              {ex.exerciseName}{' '}
                              <span className="tag" style={{ marginLeft: 4 }}>
                                {ex.category}
                              </span>
                            </strong>
                            <span className="mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b85314' }}>
                              {formatVolume(calcExerciseVolume(ex))} {session.unit}
                            </span>
                          </div>
                          <table className="telemetry-table">
                            <thead>
                              <tr>
                                <th>SET</th>
                                <th className="num">WEIGHT</th>
                                <th className="num">REPS</th>
                                <th className="num">VOL</th>
                                <th className="num">REST</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ex.sets.map((s) => (
                                <tr key={s.id}>
                                  <td>#{s.setNumber}</td>
                                  <td className="num">
                                    {s.weight} {session.unit}
                                  </td>
                                  <td className="num">{s.reps}</td>
                                  <td className="num">{formatVolume(s.weight * s.reps)}</td>
                                  <td className="num">
                                    {s.restSeconds !== null ? formatRestClock(s.restSeconds) : '--:--'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
