import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

import AlertsPanel from './components/AlertsPanel';
import ConfigDrawer from './components/ConfigDrawer';
import DlqTable from './components/DlqTable';
import EventsTable from './components/EventsTable';
import MetricCard from './components/MetricCard';
import SystemStatus from './components/SystemStatus';
import TrendChart from './components/TrendChart';
import { LogoIcon, RefreshIcon } from './components/icons';
import type {
  AlertEvent,
  AdapterConfigUpdateRequest,
  AdapterConfigUpdateResponse,
  AdapterConfigViewModel,
  AdapterSecretUpdateRequest,
  AdapterSecretUpdateResponse,
  CircuitState,
  DlqRecord,
  HealthResponse,
  RecentEvent,
  StatsResponse,
  TrendPoint,
} from './types';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

const buildUrl = (path: string) => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
};

type SocketStatus = 'connecting' | 'connected' | 'disconnected';

const App: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsHistory, setStatsHistory] = useState<TrendPoint[]>([]);
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [dlqRecords, setDlqRecords] = useState<DlqRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting');
  const [isHydrating, setIsHydrating] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const fetchJson = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(buildUrl(path), {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const message =
        data && typeof data === 'object' && 'message' in (data as Record<string, unknown>)
          ? String((data as Record<string, unknown>).message)
          : `${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    return data as T;
  }, []);

  const pushHistory = useCallback((value: number) => {
    const numeric = Number.isFinite(value) ? value : 0;
    setStatsHistory((previous) => {
      const next = [...previous, { timestamp: Date.now(), value: numeric }];
      return next.slice(-40);
    });
  }, []);

  const refreshStats = useCallback(async () => {
    const response = await fetchJson<StatsResponse>('/api/stats');
    setStats(response);
    pushHistory(response.successRate ?? 0);
    return response;
  }, [fetchJson, pushHistory]);

  const refreshEvents = useCallback(async () => {
    const response = await fetchJson<RecentEvent[]>('/api/events/recent');
    setEvents(response.slice(0, 100));
    return response;
  }, [fetchJson]);

  const loadConfig = useCallback(() => fetchJson<AdapterConfigViewModel>('/api/config'), [fetchJson]);

  const updateConfig = useCallback(
    (payload: AdapterConfigUpdateRequest) =>
      fetchJson<AdapterConfigUpdateResponse>('/api/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
    [fetchJson]
  );

  const updateSecrets = useCallback(
    (payload: AdapterSecretUpdateRequest) =>
      fetchJson<AdapterSecretUpdateResponse>('/api/config/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
    [fetchJson]
  );

  const refreshDlq = useCallback(async () => {
    const response = await fetchJson<DlqRecord[]>('/api/dlq?limit=50');
    setDlqRecords(response);
    return response;
  }, [fetchJson]);

  const refreshHealth = useCallback(async () => {
    const response = await fetchJson<HealthResponse>('/health');
    setHealth(response);
    return response;
  }, [fetchJson]);

  const hydrate = useCallback(async () => {
    if (isHydrating) {
      return;
    }
    setIsHydrating(true);
    try {
      const results = await Promise.allSettled([
        refreshStats(),
        refreshEvents(),
        refreshDlq(),
        refreshHealth(),
      ]);
      const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );
      if (failures.length > 0) {
        const messages = failures.map((failure) =>
          failure.reason instanceof Error ? failure.reason.message : String(failure.reason)
        );
        setError(messages.join('; '));
      } else {
        setError(null);
        setLastUpdated(new Date());
      }
    } finally {
      setIsHydrating(false);
    }
  }, [isHydrating, refreshDlq, refreshEvents, refreshHealth, refreshStats]);

  useEffect(() => {
    void hydrate();
    const interval = setInterval(() => {
      void hydrate();
    }, 15000);
    return () => clearInterval(interval);
  }, [hydrate]);

  useEffect(() => {
    const socket = io(API_BASE_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('connect', () => setSocketStatus('connected'));
    socket.on('disconnect', () => setSocketStatus('disconnected'));
    socket.on('connect_error', () => setSocketStatus('disconnected'));

    socket.on(
      'stats:update',
      (payload: Omit<StatsResponse, 'successRate' | 'failureRate' | 'circuitBreaker'>) => {
        setStats((previous) => {
          const successRate = payload.total
            ? (payload.success / payload.total) * 100
            : 0;
          const failureRate = payload.total ? (payload.failed / payload.total) * 100 : 0;
          const circuitBreaker: CircuitState = previous?.circuitBreaker ?? 'closed';
          const next: StatsResponse = {
            ...payload,
            successRate,
            failureRate,
            circuitBreaker,
          };
          pushHistory(successRate);
          return next;
        });
      }
    );

    socket.on('events:recent', (event: RecentEvent) => {
      setEvents((previous) => {
        const deduped = previous.filter((existing) => existing.eventId !== event.eventId);
        return [event, ...deduped].slice(0, 100);
      });
    });

    socket.on('alerts:new', (alert: AlertEvent) => {
      setAlerts((previous) => [alert, ...previous].slice(0, 20));
    });

    return () => {
      socket.disconnect();
      setSocketStatus('disconnected');
    };
  }, [pushHistory]);

  const handleReplay = useCallback(
    async (eventId: string) => {
      try {
        setReplayingId(eventId);
        await fetchJson<{ replayed: number }>(`/api/dlq/replay/${eventId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        await Promise.all([refreshDlq(), refreshStats()]);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Failed to replay DLQ event: ${message}`);
      } finally {
        setReplayingId(null);
      }
    },
    [fetchJson, refreshDlq, refreshStats]
  );

  const handleManualRefresh = useCallback(() => {
    void hydrate();
  }, [hydrate]);

  const circuitState = stats?.circuitBreaker ?? null;

  const socketBadge = useMemo(() => {
    switch (socketStatus) {
      case 'connected':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      case 'disconnected':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
      default:
        return 'bg-amber-500/20 text-amber-200 border border-amber-500/40';
    }
  }, [socketStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-6 border-b border-gray-800 pb-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 p-3">
              <LogoIcon className="h-10 w-10 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                SCOM → OBM Event Integration Adapter
              </h1>
              <p className="text-sm text-gray-400">
                Enterprise-grade bridge for reliable, observable event synchronization.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsConfigOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/20"
            >
              Configure adapter
            </button>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${socketBadge}`}>
              {socketStatus === 'connecting'
                ? 'Connecting…'
                : socketStatus === 'connected'
                ? 'Live telemetry'
                : 'Offline'}
            </span>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isHydrating}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshIcon className={`h-4 w-4 ${isHydrating ? 'animate-spin' : ''}`} />
              {isHydrating ? 'Refreshing…' : 'Refresh now'}
            </button>
          </div>
        </header>

        <section className="mt-6">
          <SystemStatus health={health} circuitState={circuitState} lastUpdated={lastUpdated} />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Events Processed"
            value={stats?.total?.toLocaleString() ?? '—'}
            subtitle={`${stats?.success?.toLocaleString() ?? 0} success / ${stats?.failed?.toLocaleString() ?? 0} failed`}
            accent="cyan"
          />
          <MetricCard
            title="Success Rate"
            value={stats ? `${stats.successRate.toFixed(2)}%` : '—'}
            subtitle="Target ≥ 99.9%"
            footnote={
              stats?.lastError ? (
                <span className="text-rose-300">Last error: {stats.lastError}</span>
              ) : (
                'No processing errors recorded'
              )
            }
            accent="green"
          />
          <MetricCard
            title="Retries Attempted"
            value={stats?.retries?.toLocaleString() ?? '—'}
            subtitle="Exponential backoff with jitter"
            accent="indigo"
          />
          <MetricCard
            title="DLQ Size"
            value={dlqRecords.length}
            subtitle="Awaiting operator remediation"
            accent={dlqRecords.length === 0 ? 'green' : dlqRecords.length > 50 ? 'red' : 'yellow'}
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TrendChart
              data={statsHistory}
              label="Success rate trend (last 40 samples)"
              emptyLabel="Waiting for telemetry updates…"
            />
          </div>
          <AlertsPanel alerts={alerts} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <EventsTable events={events} />
          <DlqTable records={dlqRecords} onReplay={handleReplay} replayingId={replayingId} />
        </section>

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-500/40 bg-rose-900/30 p-4 text-sm text-rose-100 shadow-lg shadow-rose-500/10">
            {error}
          </div>
        ) : null}

        <footer className="mt-10 border-t border-gray-800 pt-6 text-xs text-gray-500">
          <div>Telemetry updates every 15 seconds, with live push via WebSocket when available.</div>
          <div className="mt-1">
            Adapter configuration lives in `backend/config/config.yaml`. Update dashboard CORS origins to match your host.
          </div>
        </footer>
      </div>
      <ConfigDrawer
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        loadConfig={loadConfig}
        updateConfig={updateConfig}
        updateSecrets={updateSecrets}
      />
    </div>
  );
};

export default App;

