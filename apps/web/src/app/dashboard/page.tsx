import Link from 'next/link';
import { AnalysisList } from '@/components/analysis/AnalysisList';
import { AppShell } from '@/components/layout/AppShell';

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Analyses</h1>
          <p className="mt-2 text-[var(--muted)]">Recent repository verification runs.</p>
        </div>
        <Link
          href="/dashboard/analyses/new"
          className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[#061013] hover:bg-[#62e3d8]"
        >
          New Analysis
        </Link>
      </div>
      <AnalysisList />
    </AppShell>
  );
}
