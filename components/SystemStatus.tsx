import React from 'react';

import type { CircuitState, HealthResponse } from '@/types';
import { BoltIcon, CheckCircleIcon, ExclamationTriangleIcon, LogoIcon } from './icons';

interface SystemStatusProps {
  health: HealthResponse | null;
  circuitState: CircuitState | null;
  lastUpdated: Date | null;
}

const statusColor = (status?: string) => {
  if (!status) {
    return 'text-gray-300';
  }
  const normalized = status.toLowerCase();
  if (normalized === 'healthy' || normalized === 'up' || normalized === 'ready' || normalized === 'closed') {
    return 'text-emerald-300';
  }
  if (normalized === 'half-open' || normalized === 'degraded' || normalized === 'warning') {
    return 'text-amber-300';
  }
  return 'text-rose-300';
};

const prettyStatus = (status?: string) => {
  if (!status) return 'Unknown';
  return status.replace(/[-_]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
};

export const SystemStatus: React.FC<SystemStatusProps> = ({ health, circuitState, lastUpdated }) => {
  return (
    <div className="rounded-xl border border-cyan-500/40 bg-cyan-900/20 p-5 text-sm shadow-lg shadow-cyan-500/10">
      <div className="flex items-center gap-3 text-cyan-200">
        <LogoIcon className="h-8 w-8 text-cyan-300" />
        <div>
          <div className="text-lg font-semibold text-white">Adapter Control Plane</div>
          <div className="text-xs text-gray-300">
            {health ? `Uptime: ${(health.uptime / 3600).toFixed(2)} hours` : 'Status pending'}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="flex items-center gap-2 text-gray-300">
            <CheckCircleIcon className="h-5 w-5 text-emerald-300" />
            <span className="text-xs uppercase tracking-wide text-gray-400">Service Health</span>
          </div>
          <div className={`mt-2 text-base font-semibold ${statusColor(health?.status)}`}>
            {prettyStatus(health?.status)}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Version {health?.version ?? 'unknown'}
          </div>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="flex items-center gap-2 text-gray-300">
            <BoltIcon className="h-5 w-5 text-amber-300" />
            <span className="text-xs uppercase tracking-wide text-gray-400">Circuit Breaker</span>
          </div>
          <div className={`mt-2 text-base font-semibold ${statusColor(circuitState ?? undefined)}`}>
            {prettyStatus(circuitState ?? undefined)}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {circuitState === 'open'
              ? 'New OBM submissions paused'
              : circuitState === 'half-open'
              ? 'Testing OBM connectivity'
              : 'Normal event delivery'}
          </div>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          <div className="flex items-center gap-2 text-gray-300">
            <ExclamationTriangleIcon className="h-5 w-5 text-rose-300" />
            <span className="text-xs uppercase tracking-wide text-gray-400">Last Updated</span>
          </div>
          <div className="mt-2 text-base font-semibold text-white">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Pending'}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {lastUpdated
              ? `Refreshed ${Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago`
              : 'Awaiting data'}
          </div>
        </div>
      </div>
      {health?.components ? (
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-gray-300 md:grid-cols-2">
          {Object.entries(health.components).map(([component, details]) => (
            <div key={component} className="flex items-center justify-between rounded border border-gray-700 bg-gray-900/30 px-3 py-2">
              <span className="font-medium text-gray-200">{prettyStatus(component)}</span>
              <span className={`font-semibold ${statusColor(details.status)}`}>
                {prettyStatus(String(details.status))}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default SystemStatus;

