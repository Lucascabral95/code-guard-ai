import clsx from 'clsx';

const statusStyles: Record<string, string> = {
  PENDING: 'border-slate-500 text-slate-300',
  QUEUED: 'border-cyan-500 text-cyan-200',
  RUNNING: 'border-amber-500 text-amber-200',
  COMPLETED: 'border-emerald-500 text-emerald-200',
  FAILED: 'border-rose-500 text-rose-200',
  CANCELLED: 'border-zinc-500 text-zinc-300',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold',
        statusStyles[status] ?? 'border-zinc-500 text-zinc-300',
      )}
    >
      {status}
    </span>
  );
}
