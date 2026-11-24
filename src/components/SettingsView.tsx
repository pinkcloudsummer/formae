import React, { useState } from 'react';
import { probeNasHealth } from '../services/syncEngine';
import { AppSettings, SyncStateSnapshot, WeightUnit } from '../types/workout';

interface SettingsViewProps {
  settings: AppSettings;
  syncState: SyncStateSnapshot;
  onSaveSettings: (next: AppSettings) => Promise<void>;
  onSyncNow: (override?: AppSettings) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  syncState,
  onSaveSettings,
  onSyncNow,
}) => {
  const [unit, setUnit] = useState<WeightUnit>(settings.unit);
  const [weightIncrement, setWeightIncrement] = useState<number>(settings.weightIncrement);
  const [targetRestSeconds, setTargetRestSeconds] = useState<number>(settings.targetRestSeconds);
  const [nasUrl, setNasUrl] = useState<string>(settings.nasUrl);
  const [apiToken, setApiToken] = useState<string>(settings.apiToken);
  const [probeResult, setProbeResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const buildNextSettings = (): AppSettings => ({
    ...settings,
    unit,
    weightIncrement,
    targetRestSeconds,
    nasUrl: nasUrl.trim(),
    apiToken: apiToken.trim(),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = buildNextSettings();
    await onSaveSettings(next);
    setSavedBanner(true);
    window.setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setProbeResult(null);
    try {
      const res = await probeNasHealth(nasUrl, apiToken);
      setProbeResult(res);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndSync = async () => {
    const next = buildNextSettings();
    await onSaveSettings(next);
    await onSyncNow(next);
  };

  return (
    <form onSubmit={handleSave} className="stack-md">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="micro-label">SYSTEM // LOGGING PREFERENCES</div>
            <h2 className="panel-title">Terminal Configuration</h2>
          </div>
        </div>

        <div className="stack-md">
          <div className="field-group">
            <span className="field-label">DEFAULT WEIGHT UNIT</span>
            <div className="category-tabs">
              {(['LBS', 'KG'] as WeightUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  className={`cat-tab ${unit === u ? 'cat-tab--active' : ''}`}
                  onClick={() => setUnit(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <span className="field-label">WEIGHT STEPPER INCREMENT ({unit})</span>
            <div className="category-tabs">
              {[2.5, 5, 10].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  className={`cat-tab ${weightIncrement === inc ? 'cat-tab--active' : ''}`}
                  onClick={() => setWeightIncrement(inc)}
                >
                  &plusmn;{inc} {unit}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <span className="field-label">DEFAULT TARGET REST INTERVAL</span>
            <div className="category-tabs">
              {[60, 90, 120, 150, 180].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`cat-tab ${targetRestSeconds === sec ? 'cat-tab--active' : ''}`}
                  onClick={() => setTargetRestSeconds(sec)}
                >
                  {sec}S
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel panel--accent-orange">
        <div className="panel-header">
          <div>
            <div className="micro-label">UPLINK // LOCAL-FIRST NAS SYNC</div>
            <h2 className="panel-title">NAS Backend Endpoint</h2>
          </div>
          <span
            className={`tag ${
              syncState.state === 'synced'
                ? 'tag--green'
                : syncState.state === 'error'
                  ? 'tag--orange'
                  : 'tag--slate'
            }`}
          >
            {syncState.message}
          </span>
        </div>

        <div className="stack-md">
          <div className="field-group">
            <label htmlFor="nas-url" className="field-label">
              NAS API BASE URL (LAN IP, LOCAL DOMAIN, OR TAILSCALE URL)
            </label>
            <input
              id="nas-url"
              type="url"
              className="terminal-input mono"
              placeholder="http://192.168.1.50:8787"
              value={nasUrl}
              onChange={(e) => setNasUrl(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label htmlFor="nas-token" className="field-label">
              BEARER API TOKEN (OPTIONAL — MATCHES FORMAE_API_TOKEN ON NAS)
            </label>
            <input
              id="nas-token"
              type="password"
              className="terminal-input mono"
              placeholder="Enter shared secret token"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
          </div>

          <div className="stat-grid">
            <div className="stat-cell">
              <span className="stat-cell__label">PENDING PUSH</span>
              <span className="stat-cell__value">{syncState.pendingCount}</span>
            </div>
            <div className="stat-cell" style={{ gridColumn: 'span 2' }}>
              <span className="stat-cell__label">LAST SUCCESSFUL SYNC</span>
              <span className="stat-cell__value" style={{ fontSize: '0.88rem' }}>
                {syncState.lastSyncAt
                  ? new Date(syncState.lastSyncAt).toLocaleString()
                  : 'NEVER SYNCED'}
              </span>
            </div>
          </div>

          {probeResult && (
            <div className={`banner ${probeResult.ok ? 'banner--green' : 'banner--red'}`}>
              <span>{probeResult.detail}</span>
            </div>
          )}

          {savedBanner && (
            <div className="banner banner--green">
              <span>SETTINGS SAVED TO LOCAL INDEXEDDB</span>
            </div>
          )}

          <div className="action-row">
            <button type="submit" className="btn btn--primary">
              SAVE SETTINGS
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={testing || !nasUrl.trim()}
              onClick={handleTestConnection}
            >
              {testing ? 'PROBING...' : 'TEST NAS LINK'}
            </button>
            <button
              type="button"
              className="btn btn--orange"
              disabled={!nasUrl.trim()}
              onClick={handleSaveAndSync}
            >
              SYNC NOW
            </button>
          </div>
        </div>
      </section>
    </form>
  );
};
