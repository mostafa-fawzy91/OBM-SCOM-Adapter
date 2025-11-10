import React from 'react';

import type { DlqRecord } from '@/types';

interface DlqTableProps {
  records: DlqRecord[];
  onReplay: (eventId: string) => Promise<void>;
  replayingId: string | null;
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString();
};

export const DlqTable: React.FC<DlqTableProps> = ({ records, onReplay, replayingId }) => {
  const handleReplay = (eventId: string) => async () => {
    await onReplay(eventId);
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/40">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3 text-sm font-semibold text-gray-200">
        <span>Dead Letter Queue</span>
        <span className="text-xs font-normal text-gray-400">
          {records.length} unresolved event{records.length === 1 ? '' : 's'}
        </span>
      </div>
      {records.length === 0 ? (
        <div className="p-4 text-sm text-gray-400">
          DLQ is empty. All events are being processed successfully.
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto text-sm">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-900/60 text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Event ID</th>
                <th className="px-4 py-2 text-left font-medium">Reason</th>
                <th className="px-4 py-2 text-left font-medium">Retries</th>
                <th className="px-4 py-2 text-left font-medium">Last Failure</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-200">
              {records.map((record) => (
                <tr key={`${record.eventId}-${record.failureTimestamp}`}>
                  <td className="px-4 py-2 align-top">
                    <div className="font-mono text-xs">{record.eventId}</div>
                    <div className="text-xs text-gray-500">
                      {record.correlationId ? `corr: ${record.correlationId}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2 align-top text-xs text-gray-300">
                    {record.failureReason}
                  </td>
                  <td className="px-4 py-2 align-top text-xs text-gray-300">
                    {record.retryCount}
                    {record.lastHttpStatus ? ` (HTTP ${record.lastHttpStatus})` : ''}
                  </td>
                  <td className="px-4 py-2 align-top text-xs text-gray-400">
                    {formatTimestamp(record.failureTimestamp)}
                  </td>
                  <td className="px-4 py-2 align-top text-right">
                    <button
                      type="button"
                      onClick={handleReplay(record.eventId)}
                      disabled={replayingId === record.eventId}
                      className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-cyan-500 disabled:cursor-wait disabled:bg-gray-600"
                    >
                      {replayingId === record.eventId ? 'Replaying…' : 'Replay'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DlqTable;

