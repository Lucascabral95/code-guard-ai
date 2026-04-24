import type { PortfolioRiskResponse, RiskSnapshot } from '@/features/analyses/types';

const severityColors: Record<string, string> = {
  critical: '#fb7185',
  high: '#f97316',
  medium: '#facc15',
  low: '#38bdf8',
  info: '#8fa0b6',
};

export function SeverityBars({ totals }: { totals: PortfolioRiskResponse['totals'] }) {
  const values = [
    { label: 'Critical', value: totals.critical, key: 'critical' },
    { label: 'High', value: totals.high, key: 'high' },
    { label: 'Medium', value: totals.medium, key: 'medium' },
    { label: 'Low', value: totals.low, key: 'low' },
    { label: 'Info', value: totals.info, key: 'info' },
  ];
  const max = Math.max(...values.map((item) => item.value), 1);

  return (
    <div className="grid gap-3">
      {values.map((item) => (
        <div key={item.key} className="grid grid-cols-[76px_1fr_40px] items-center gap-3 text-sm">
          <span className="text-[var(--muted)]">{item.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-[#0b1018]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 6 : 0)}%`,
                backgroundColor: severityColors[item.key],
              }}
            />
          </div>
          <span className="text-right tabular-nums text-slate-200">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function CategoryBars({ data }: { data: PortfolioRiskResponse['findingsByCategory'] }) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No category data yet.</p>;
  }

  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <div className="grid gap-3">
      {data.map((item) => (
        <div
          key={item.category}
          className="grid grid-cols-[96px_1fr_40px] items-center gap-3 text-sm"
        >
          <span className="truncate text-[var(--muted)]">{item.category}</span>
          <div className="h-2 overflow-hidden rounded-full bg-[#0b1018]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${Math.max((item.count / max) * 100, 6)}%` }}
            />
          </div>
          <span className="text-right tabular-nums text-slate-200">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

export function RiskTrend({ snapshots }: { snapshots: RiskSnapshot[] }) {
  if (snapshots.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No historical risk snapshots yet.</p>;
  }

  const width = 520;
  const height = 160;
  const padding = 16;
  const points = snapshots.map((snapshot, index) => {
    const x =
      snapshots.length === 1
        ? width / 2
        : padding + (index / (snapshots.length - 1)) * (width - padding * 2);
    const y = padding + ((100 - snapshot.score) / 100) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg className="h-40 w-full" viewBox={`0 0 ${width} ${height}`} role="img">
      <line
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
        stroke="#273244"
      />
      <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="#273244" />
      <polyline fill="none" points={points.join(' ')} stroke="#4fd1c5" strokeWidth="3" />
      {snapshots.map((snapshot, index) => {
        const [x, y] = points[index].split(',').map(Number);
        return <circle key={snapshot.id} cx={x} cy={y} r="4" fill="#eef3fb" />;
      })}
    </svg>
  );
}
