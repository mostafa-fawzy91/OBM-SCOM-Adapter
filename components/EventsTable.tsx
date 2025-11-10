import React from 'react';

import type { RecentEvent } from '@/types';

interface EventsTableProps {
  events: RecentEvent[];
  maxRows?: number;
}

const severityBadgeClass = (severity: string) => {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical' || normalized === 'error') {
    return 'bg-rose-500/20 text-rose-300';
  }
  if (normalized === 'warning') {
    return 'bg-amber-500/20 text-amber-300';
  }
  return 'bg-emerald-500/20 text-emerald-200';
};

const statusBadgeClass = (status: RecentEvent['status']) =>
  status === 'success'
    ? 'text-green-300 bg-emerald-500/10'
    : 'text-rose-300 bg-rose-500/10';

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString();
};

export const EventsTable: React.FC<EventsTableProps> = ({ events, maxRows = 15 }) => {
  const visibleEvents = events.slice(0, maxRows);
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/40">
      <div className="border-b border-gray-700 px-4 py-3 text-sm font-semibold text-gray-200">
        Recent Events
      </div>
      {visibleEvents.length === 0 ? (
        <div className="p-4 text-sm text-gray-400">No events have been processed yet.</div>
      ) : (
        <div className="max-h-[360px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-800 text-sm">
            <thead className="bg-gray-900/60 text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Event</th>
                <th className="px-4 py-2 text-left font-medium">Severity</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Processed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {visibleEvents.map((event) => (
                <tr key={`${event.eventId}-${event.timestamp}`}>
                  <td className="px-4 py-2">
                    <div className="text-gray-100">{event.title}</div>
                    <div className="text-xs text-gray-500">{event.eventId}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${severityBadgeClass(event.severity)}`}
                    >
                      {event.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusBadgeClass(event.status)}`}
                    >
                      {event.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-300">{formatTimestamp(event.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EventsTable;

