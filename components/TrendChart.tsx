import React from 'react';

import type { TrendPoint } from '@/types';

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  color?: string;
  label?: string;
  emptyLabel?: string;
}

const DEFAULT_HEIGHT = 140;

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  height = DEFAULT_HEIGHT,
  color = '#22d3ee',
  label,
  emptyLabel = 'Awaiting data…',
}) => {
  if (!data || data.length < 2) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-800/40 text-sm text-gray-400">
        {emptyLabel}
      </div>
    );
  }

  const width = 400;
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * width;
      const normalized = (point.value - min) / range;
      const y = height - normalized * height;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4">
      {label ? <div className="mb-2 text-sm font-medium text-gray-300">{label}</div> : null}
      <svg
        className="w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label ?? 'trend chart'}
      >
        <defs>
          <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPoints ? `M${areaPoints}` : ''} fill="url(#trendGradient)" />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
        <div>
          Min: <span className="text-gray-200">{min.toFixed(2)}</span>
        </div>
        <div className="text-right">
          Max: <span className="text-gray-200">{max.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default TrendChart;

