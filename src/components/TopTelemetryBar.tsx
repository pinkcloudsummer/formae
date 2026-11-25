import React, { useEffect, useState } from 'react';
import { SyncStateSnapshot, WorkoutSession } from '../types/workout';
import { formatDuration } from '../utils/format';
import { ConstellationSwoosh } from './ConstellationSwoosh';

export type NavTab = 'terminal' | 'history' | 'settings';

interface TopTelemetryBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeSession: WorkoutSession | null;
  syncState: SyncStateSnapshot;
  onTriggerSync: () => void;
}

export const TopTelemetryBar: React.FC<TopTelemetryBarProps> = ({
  activeTab,
  onSelectTab,
  activeSession,
  syncState,
  onTriggerSync,
}) => {
  const [elapsed, setElapsed] = useState<string>('00:00');

  useEffect(() => {
    if (!activeSession) return;
    const update = () => setElapsed(formatDuration(activeSession.startedAt));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [activeSession]);

  const ledClass = (() => {
    switch (syncState.state) {
      case 'synced':
        return 'led led--green';
      case 'syncing':
        return 'led led--amber led--pulse';
      case 'offline':
        return 'led led--amber';
      case 'error':
        return 'led led--red';
      default:
        return 'led led--muted';
    }
  })();

  return (
    <header className="top-bar">
      <ConstellationSwoosh variant="header" />

      <div className="top-bar-inner">
        <div
          className="brand-block"
          data-field-monitor-trigger
          style={{
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
        >
          <div>
            <h1 className="brand-title">FORMAE</h1>
            <div className="brand-sub">SYS // FIELD TELEMETRY</div>
          </div>
        </div>

        <div className="top-bar-right">
          {activeSession && (
            <span className="tag tag--green mono">
              <span className="led led--green led--pulse" />
              {elapsed}
            </span>
          )}

          <button
            type="button"
            className="sync-pill"
            onClick={onTriggerSync}
            title="Click to probe NAS and sync now"
          >
            <span className={ledClass} />
            <span>{syncState.message}</span>
            {syncState.pendingCount > 0 && (
              <span className="sync-pill__count">({syncState.pendingCount})</span>
            )}
          </button>
        </div>
      </div>

      <nav className="nav-strip" aria-label="Primary navigation">
        <button
          type="button"
          className={`nav-tab ${activeTab === 'terminal' ? 'nav-tab--active' : ''}`}
          onClick={() => onSelectTab('terminal')}
        >
          {activeSession ? 'ACTIVE SESSION' : 'TERMINAL'}
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'history' ? 'nav-tab--active' : ''}`}
          onClick={() => onSelectTab('history')}
        >
          LOGS
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'settings' ? 'nav-tab--active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          SYSTEM
        </button>
      </nav>
    </header>
  );
};
