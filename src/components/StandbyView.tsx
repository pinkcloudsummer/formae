import React from 'react';
import { MUSCLE_GROUPS, MuscleGroup, WeightUnit, WorkoutSession } from '../types/workout';
import {
  calcSessionAvgRest,
  calcSessionSetCount,
  calcSessionVolume,
  formatDuration,
  formatRestClock,
  formatSessionDate,
  formatVolume,
  getSessionMuscleGroups,
} from '../utils/format';

interface StandbyViewProps {
  completedSessions: WorkoutSession[];
  defaultUnit: WeightUnit;
  onStartSession: (initialGroup?: MuscleGroup) => void;
  onOpenHistory: () => void;
}

export const StandbyView: React.FC<StandbyViewProps> = ({
  completedSessions,
  defaultUnit,
  onStartSession,
  onOpenHistory,
}) => {
  const recent = completedSessions.slice(0, 3);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekSessions = completedSessions.filter(
    (s) => new Date(s.startedAt).getTime() >= sevenDaysAgo
  );
  const weekVolume = weekSessions.reduce((sum, s) => sum + calcSessionVolume(s), 0);
  const weekSets = weekSessions.reduce((sum, s) => sum + calcSessionSetCount(s), 0);

  return (
    <div className="stack-md">
      <section className="panel panel--accent-orange">
        <div className="panel-header">
          <div>
            <div className="micro-label">STATUS // STANDBY MODE</div>
            <h2 className="panel-title">Initiate Workout Telemetry</h2>
          </div>
          <span className="tag tag--slate mono">UNIT: {defaultUnit}</span>
        </div>

        <div className="stack-md">
          <button
            type="button"
            className="btn btn--primary btn--lg btn--block"
            onClick={() => onStartSession()}
          >
            INITIATE SESSION
          </button>

          <div className="field-group">
            <span className="micro-label">OR JUMP DIRECTLY TO MUSCLE GROUP</span>
            <div className="category-tabs">
              {MUSCLE_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  className="cat-tab"
                  onClick={() => onStartSession(group)}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="micro-label">METRICS // 7-DAY ROLLING</div>
            <h2 className="panel-title">Output Summary</h2>
          </div>
          <span className="micro-label">{completedSessions.length} TOTAL LOGS</span>
        </div>

        <div className="stat-grid">
          <div className="stat-cell">
            <span className="stat-cell__label">SESSIONS (7D)</span>
            <span className="stat-cell__value">{weekSessions.length}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">SETS (7D)</span>
            <span className="stat-cell__value">{weekSets}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">VOL ({defaultUnit})</span>
            <span className="stat-cell__value stat-cell__value--amber">
              {formatVolume(weekVolume)}
            </span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="micro-label">ARCHIVE // RECENT TRANSMISSIONS</div>
            <h2 className="panel-title">Recent Sessions</h2>
          </div>
          {completedSessions.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenHistory}>
              ALL LOGS
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="empty-state">
            NO SESSIONS RECORDED YET. INITIATE A SESSION TO BEGIN LOGGING SETS &amp; REST INTERVALS.
          </div>
        ) : (
          <div className="stack-sm">
            {recent.map((session) => {
              const groups = getSessionMuscleGroups(session);
              const vol = calcSessionVolume(session);
              const sets = calcSessionSetCount(session);
              const avgRest = calcSessionAvgRest(session);
              return (
                <div key={session.id} className="session-card">
                  <div className="session-card__top">
                    <span className="mono" style={{ fontWeight: 700 }}>
                      {formatSessionDate(session.startedAt)}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                        {session.syncStatus === 'synced' ? 'SYNCED' : 'LOCAL'}
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
                      <span className="stat-cell__label">SETS / DUR</span>
                      <span className="stat-cell__value" style={{ fontSize: '0.96rem' }}>
                        {sets} · {formatDuration(session.startedAt, session.endedAt)}
                      </span>
                    </div>
                    <div className="stat-cell">
                      <span className="stat-cell__label">AVG REST</span>
                      <span className="stat-cell__value" style={{ fontSize: '0.96rem' }}>
                        {avgRest !== null ? formatRestClock(avgRest) : '--:--'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
