import React from 'react';
import { SyncStateSnapshot, WorkoutSession } from '../types/workout';
import {
  calcExerciseVolume,
  calcSessionAvgRest,
  calcSessionSetCount,
  calcSessionVolume,
  formatDuration,
  formatRestClock,
  formatSessionDate,
  formatVolume,
} from '../utils/format';

interface SessionDebriefProps {
  session: WorkoutSession;
  syncState: SyncStateSnapshot;
  onReturnToTerminal: () => void;
  onSyncNow: () => void;
}

export const SessionDebrief: React.FC<SessionDebriefProps> = ({
  session,
  syncState,
  onReturnToTerminal,
  onSyncNow,
}) => {
  const totalVol = calcSessionVolume(session);
  const totalSets = calcSessionSetCount(session);
  const avgRest = calcSessionAvgRest(session);
  const duration = formatDuration(session.startedAt, session.endedAt);
  const performed = session.exercises.filter((e) => e.sets.length > 0);

  return (
    <div className="stack-md">
      <section className="panel panel--accent-green">
        <div className="panel-header">
          <div>
            <div className="micro-label">TRANSMISSION COMPLETE // {formatSessionDate(session.startedAt)}</div>
            <h2 className="panel-title">Session Debrief</h2>
          </div>
          <span className={`tag ${session.syncStatus === 'synced' ? 'tag--green' : 'tag--orange'}`}>
            {session.syncStatus === 'synced' ? 'NAS SYNCED' : 'SAVED LOCALLY'}
          </span>
        </div>

        <div className="stat-grid stat-grid--4">
          <div className="stat-cell">
            <span className="stat-cell__label">DURATION</span>
            <span className="stat-cell__value">{duration}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">TOTAL SETS</span>
            <span className="stat-cell__value">{totalSets}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">VOLUME ({session.unit})</span>
            <span className="stat-cell__value stat-cell__value--amber">
              {formatVolume(totalVol)}
            </span>
          </div>
          <div className="stat-cell">
            <span className="stat-cell__label">AVG REST</span>
            <span className="stat-cell__value">
              {avgRest !== null ? formatRestClock(avgRest) : '--:--'}
            </span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="micro-label">EXERCISE BREAKDOWN ({performed.length})</div>
        </div>
        {performed.length === 0 ? (
          <div className="empty-state">NO SETS WERE LOGGED IN THIS SESSION.</div>
        ) : (
          <div className="stack-sm">
            {performed.map((ex) => (
              <div key={ex.id} className="session-card">
                <div className="session-card__top">
                  <div>
                    <strong style={{ letterSpacing: '0.04em' }}>{ex.exerciseName}</strong>{' '}
                    <span className="tag">{ex.category}</span>
                  </div>
                  <span className="mono" style={{ fontSize: '0.86rem', fontWeight: 700, color: '#b85314' }}>
                    {formatVolume(calcExerciseVolume(ex))} {session.unit}
                  </span>
                </div>
                <table className="telemetry-table">
                  <thead>
                    <tr>
                      <th>SET</th>
                      <th className="num">WEIGHT</th>
                      <th className="num">REPS</th>
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
      </section>

      <div className="action-row">
        <button type="button" className="btn btn--primary btn--lg" onClick={onReturnToTerminal}>
          RETURN TO STANDBY
        </button>
        {syncState.state !== 'synced' && syncState.state !== 'unconfigured' && (
          <button type="button" className="btn btn--ghost btn--lg" onClick={onSyncNow}>
            RETRY NAS SYNC
          </button>
        )}
      </div>
    </div>
  );
};
