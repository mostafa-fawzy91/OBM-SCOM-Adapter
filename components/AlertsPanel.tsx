import React from 'react';

import type { AlertEvent } from '@/types';

interface AlertsPanelProps {
  alerts: AlertEvent[];
}

const severityColor: Record<AlertEvent['severity'], string> = {
  info: 'text-sky-300 border-sky-500/50 bg-sky-900/20',
  warning: 'text-amber-300 border-amber-500/50 bg-amber-900/20',
  error: 'text-rose-300 border-rose-500/50 bg-rose-900/20',
  critical: 'text-red-200 border-red-500/50 bg-red-900/30',
};

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts }) => {
  const displayAlerts = alerts.slice(0, 10);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/40">
      <div className="border-b border-gray-700 px-4 py-3 text-sm font-semibold text-gray-200">
        Active Alerts
      </div>
      {displayAlerts.length === 0 ? (
        <div className="p-4 text-sm text-gray-400">
          No alerts triggered. Adapter is operating within thresholds.
        </div>
      ) : (
        <div className="space-y-3 p-4 text-sm">
          {displayAlerts.map((alert) => (
            <div
              key={`${alert.name}-${alert.triggeredAt}`}
              className={`rounded-lg border px-4 py-3 ${severityColor[alert.severity]}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-200">
                  {alert.severity}
                </span>
                <span className="text-xs text-gray-300">
                  {new Date(alert.triggeredAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 text-base font-semibold text-white">{alert.name}</div>
              <div className="mt-1 text-gray-200">{alert.message}</div>
              {alert.context ? (
                <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-black/40 p-2 text-xs text-gray-300">
                  {JSON.stringify(alert.context, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;

