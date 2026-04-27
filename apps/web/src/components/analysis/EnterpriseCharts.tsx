import type {
  ExecutiveReportResponse,
  PortfolioRiskResponse,
  RiskSnapshot,
} from '@/features/analyses/types';

const severityColors: Record<string, string> = {
  critical: '#fb7185',
  high: '#f97316',
  medium: '#facc15',
  low: '#38bdf8',
  info: '#8fa0b6',
};

const chartColors = ['#4fd1c5', '#38bdf8', '#facc15', '#f97316', '#fb7185', '#a78bfa'];

export function ReportDonutChart({
  data,
  emptyLabel = 'No data yet.',
}: {
  data: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>;
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-center">
      <svg viewBox="0 0 180 180" className="h-44 w-44" role="img">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#0b1018" strokeWidth="24" />
        {data.map((item, index) => {
          const length = (item.count / total) * circumference;
          const dashOffset = -offset;
          offset += length;
          return (
            <circle
              key={item.label}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={chartColors[index % chartColors.length]}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              strokeWidth="24"
              transform="rotate(-90 90 90)"
            />
          );
        })}
        <text x="90" y="86" textAnchor="middle" className="fill-slate-100 text-xl font-semibold">
          {total}
        </text>
        <text x="90" y="106" textAnchor="middle" className="fill-[#8fa0b6] text-[10px]">
          total
        </text>
      </svg>
      <div className="grid gap-2">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: chartColors[index % chartColors.length] }}
              />
              <span className="truncate text-[var(--muted)]">{item.label}</span>
            </span>
            <span className="tabular-nums text-slate-200">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportBarChart({
  data,
  emptyLabel = 'No data yet.',
}: {
  data: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>;
  }

  return <HorizontalBars data={data.map((item) => ({ label: item.label, value: item.count }))} />;
}

export function ToolDurationChart({
  data,
}: {
  data: ExecutiveReportResponse['charts']['toolDuration'];
}) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No tool duration data yet.</p>;
  }

  return <HorizontalBars data={data.slice(0, 10)} suffix="ms" />;
}

export function RiskLineChart({ snapshots }: { snapshots: RiskSnapshot[] }) {
  if (snapshots.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No historical risk snapshots yet.</p>;
  }

  const width = 520;
  const height = 180;
  const padding = 20;
  const points = snapshots.map((snapshot, index) => {
    const x =
      snapshots.length === 1
        ? width / 2
        : padding + (index / (snapshots.length - 1)) * (width - padding * 2);
    const y = padding + ((100 - snapshot.score) / 100) * (height - padding * 2);
    return { x, y, snapshot };
  });

  return (
    <svg className="h-56 w-full" viewBox={`0 0 ${width} ${height}`} role="img">
      <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="#273244" />
      <line
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
        stroke="#273244"
      />
      <polyline
        fill="none"
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        stroke="#4fd1c5"
        strokeWidth="3"
      />
      {points.map((point) => (
        <circle key={point.snapshot.id} cx={point.x} cy={point.y} r="4" fill="#eef3fb" />
      ))}
    </svg>
  );
}

export function PostureSummary({ posture }: { posture: ExecutiveReportResponse['posture'] }) {
  const items = [
    { label: 'CI/CD Risk', value: posture.ciCd },
    { label: 'Repository Posture', value: posture.repository },
    { label: 'Docker/IaC Posture', value: posture.dockerIac },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-[var(--border)] bg-[#0b1018] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{item.label}</p>
            <span className={postureStatusClass(item.value.status)}>{item.value.status}</span>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">{item.value.summary}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--muted)]">
            {item.value.findings} finding(s)
          </p>
        </div>
      ))}
    </div>
  );
}

function postureStatusClass(status: 'PASS' | 'WARN' | 'FAIL') {
  switch (status) {
    case 'FAIL':
      return 'text-xs font-semibold text-rose-300';
    case 'WARN':
      return 'text-xs font-semibold text-amber-300';
    default:
      return 'text-xs font-semibold text-emerald-300';
  }
}

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

export function LicenseDistribution({
  data,
}: {
  data: NonNullable<PortfolioRiskResponse['licenseDistribution']>;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No license data yet.</p>;
  }

  return <HorizontalBars data={data.map((item) => ({ label: item.license, value: item.count }))} />;
}

export function ToolHealth({ data }: { data: NonNullable<PortfolioRiskResponse['toolHealth']> }) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No tool execution data yet.</p>;
  }

  return (
    <div className="grid gap-2">
      {data.slice(0, 8).map((item) => (
        <div
          key={`${item.tool}-${item.status}`}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md bg-[#0b1018] p-3 text-sm"
        >
          <span className="truncate font-medium">{item.tool}</span>
          <span className="text-xs text-[var(--muted)]">{item.status}</span>
          <span className="tabular-nums">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

export function AgingBuckets({ aging }: { aging: NonNullable<PortfolioRiskResponse['aging']> }) {
  const data = [
    { label: '< 7d', value: aging.under7Days },
    { label: '7-30d', value: aging.between7And30Days },
    { label: '> 30d', value: aging.over30Days },
  ];

  return <HorizontalBars data={data} />;
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

function HorizontalBars({
  data,
  suffix = '',
}: {
  data: Array<{ label: string; value: number }>;
  suffix?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="grid gap-3">
      {data.map((item) => (
        <div key={item.label} className="grid grid-cols-[84px_1fr_40px] items-center gap-3 text-sm">
          <span className="truncate text-[var(--muted)]">{item.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-[#0b1018]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 6 : 0)}%` }}
            />
          </div>
          <span className="text-right tabular-nums text-slate-200">
            {item.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}
