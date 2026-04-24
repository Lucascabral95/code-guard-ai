import { NewAnalysisForm } from '@/components/analysis/NewAnalysisForm';
import { AppShell } from '@/components/layout/AppShell';

export default function NewAnalysisPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">New Analysis</h1>
        <p className="mt-2 text-[var(--muted)]">
          Submit a public GitHub repository for safe asynchronous review.
        </p>
      </div>
      <NewAnalysisForm />
    </AppShell>
  );
}
