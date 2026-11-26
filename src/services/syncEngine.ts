import {
  getPendingCount,
  getPendingExercises,
  getPendingSessions,
  loadSettings,
  markExercisesSynced,
  markSessionsSynced,
  mergePulledExercises,
  mergePulledSessions,
  saveSettings,
} from '../db/database';
import { AppSettings, Exercise, SyncStateSnapshot, WorkoutSession } from '../types/workout';

const HEALTH_TIMEOUT_MS = 2500;
const SYNC_TIMEOUT_MS = 8000;

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Resolve the effective NAS API base URL:
 * - Uses the explicitly configured `nasUrl` if set.
 * - Otherwise defaults to the origin serving this app (`window.location.origin`),
 *   so the app automatically syncs with its own NAS host when reachable.
 */
export function resolveNasUrl(nasUrl?: string): string {
  const explicit = normalizeBaseUrl(nasUrl ?? '');
  if (explicit) return explicit;
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    /^https?:\/\//i.test(window.location.origin)
  ) {
    return normalizeBaseUrl(window.location.origin);
  }
  return '';
}

function buildHeaders(apiToken: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiToken.trim()) {
    headers['Authorization'] = `Bearer ${apiToken.trim()}`;
  }
  return headers;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function probeNasHealth(nasUrl: string, apiToken: string): Promise<{ ok: boolean; detail: string }> {
  const base = resolveNasUrl(nasUrl);
  if (!base) {
    return { ok: false, detail: 'NAS endpoint not configured' };
  }
  try {
    const res = await fetchWithTimeout(
      `${base}/api/health`,
      { method: 'GET', headers: buildHeaders(apiToken) },
      HEALTH_TIMEOUT_MS
    );
    if (res.status === 401 || res.status === 403) {
      return { ok: false, detail: 'Authentication failed (check API token)' };
    }
    if (!res.ok) {
      return { ok: false, detail: `NAS returned HTTP ${res.status}` };
    }
    return { ok: true, detail: 'NAS link verified' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, detail: 'NAS unreachable (timeout)' };
    }
    return { ok: false, detail: 'NAS unreachable (offline or LAN unavailable)' };
  }
}

export async function runNasSync(
  overrideSettings?: AppSettings
): Promise<{ snapshot: SyncStateSnapshot; pulledChanges: boolean }> {
  const settings = overrideSettings ?? (await loadSettings());
  const pendingBefore = await getPendingCount();
  const base = resolveNasUrl(settings.nasUrl);

  if (!base) {
    return {
      pulledChanges: false,
      snapshot: {
        state: 'unconfigured',
        pendingCount: pendingBefore,
        lastSyncAt: settings.lastSyncAt,
        message: 'LOCAL ONLY',
      },
    };
  }

  // 1. Fast reachability probe
  const health = await probeNasHealth(base, settings.apiToken);
  if (!health.ok) {
    const isAuthError = health.detail.includes('Authentication');
    return {
      pulledChanges: false,
      snapshot: {
        state: isAuthError ? 'error' : 'offline',
        pendingCount: pendingBefore,
        lastSyncAt: settings.lastSyncAt,
        message: isAuthError ? 'AUTH ERROR' : 'LOCAL · NAS OFFLINE',
      },
    };
  }

  try {
    // 2. Push pending local records (idempotent upsert on NAS)
    const [pendingSessions, pendingExercises] = await Promise.all([
      getPendingSessions(),
      getPendingExercises(),
    ]);

    if (pendingSessions.length > 0 || pendingExercises.length > 0) {
      const pushRes = await fetchWithTimeout(
        `${base}/api/sync/push`,
        {
          method: 'POST',
          headers: buildHeaders(settings.apiToken),
          body: JSON.stringify({
            sessions: pendingSessions,
            exercises: pendingExercises,
          }),
        },
        SYNC_TIMEOUT_MS
      );

      if (!pushRes.ok) {
        throw new Error(`Push failed (HTTP ${pushRes.status})`);
      }

      const pushBody = (await pushRes.json()) as {
        ackSessionIds?: string[];
        ackExerciseIds?: string[];
      };

      await Promise.all([
        markSessionsSynced(pushBody.ackSessionIds ?? pendingSessions.map((s) => s.id)),
        markExercisesSynced(pushBody.ackExerciseIds ?? pendingExercises.map((e) => e.id)),
      ]);
    }

    // 3. Pull updates from NAS since lastSyncAt
    const sinceParam = settings.lastSyncAt
      ? `?since=${encodeURIComponent(settings.lastSyncAt)}`
      : '';
    const pullRes = await fetchWithTimeout(
      `${base}/api/sync/pull${sinceParam}`,
      {
        method: 'GET',
        headers: buildHeaders(settings.apiToken),
      },
      SYNC_TIMEOUT_MS
    );

    if (!pullRes.ok) {
      throw new Error(`Pull failed (HTTP ${pullRes.status})`);
    }

    const pullBody = (await pullRes.json()) as {
      serverTime?: string;
      sessions?: WorkoutSession[];
      exercises?: Exercise[];
    };

    const [mergedSessions, mergedExercises] = await Promise.all([
      mergePulledSessions(pullBody.sessions ?? []),
      mergePulledExercises(pullBody.exercises ?? []),
    ]);

    const newSyncTime = pullBody.serverTime ?? new Date().toISOString();
    await saveSettings({ ...settings, lastSyncAt: newSyncTime });

    const pendingAfter = await getPendingCount();

    return {
      pulledChanges: mergedSessions > 0 || mergedExercises > 0,
      snapshot: {
        state: 'synced',
        pendingCount: pendingAfter,
        lastSyncAt: newSyncTime,
        message: 'NAS SYNCED',
      },
    };
  } catch (err) {
    const pendingNow = await getPendingCount();
    return {
      pulledChanges: false,
      snapshot: {
        state: 'error',
        pendingCount: pendingNow,
        lastSyncAt: settings.lastSyncAt,
        message: err instanceof Error ? err.message : 'SYNC FAILED',
      },
    };
  }
}
