import clsx from 'clsx';

const riskStyles: Record<string, string> = {
  LOW: 'border-emerald-500 text-emerald-200',
  MEDIUM: 'border-amber-500 text-amber-200',
  HIGH: 'border-orange-500 text-orange-200',
  CRITICAL: 'border-rose-500 text-rose-200',
};

export function RiskBadge({ level }: { level: string | null }) {
  if (!level) {
    return <span className="text-sm text-[var(--muted)]">Pending</span>;
  }

  return (
    <span
      className={clsx(
        'inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold',
        riskStyles[level] ?? 'border-zinc-500 text-zinc-300',
      )}
    >
      {level}
    </span>
  );
}
