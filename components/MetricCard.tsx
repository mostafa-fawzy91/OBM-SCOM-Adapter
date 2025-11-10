import React from 'react';

type Accent = 'default' | 'cyan' | 'green' | 'red' | 'yellow' | 'indigo';

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  footnote?: React.ReactNode;
  accent?: Accent;
}

const accentClasses: Record<Accent, string> = {
  default: 'bg-gray-800/70 border-gray-700',
  cyan: 'bg-cyan-900/40 border-cyan-500/40',
  green: 'bg-emerald-900/40 border-emerald-500/40',
  red: 'bg-rose-900/40 border-rose-500/40',
  yellow: 'bg-amber-900/40 border-amber-500/40',
  indigo: 'bg-indigo-900/40 border-indigo-500/40',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  footnote,
  accent = 'default',
}) => {
  return (
    <div
      className={`rounded-xl border px-4 py-5 shadow-lg shadow-black/20 transition hover:shadow-xl ${accentClasses[accent]}`}
    >
      <div className="text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
      {subtitle ? <div className="mt-2 text-sm text-gray-300">{subtitle}</div> : null}
      {footnote ? <div className="mt-3 text-xs text-gray-400">{footnote}</div> : null}
    </div>
  );
};

export default MetricCard;

