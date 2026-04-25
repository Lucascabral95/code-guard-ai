import { ExecutiveReport } from '@/components/analysis/ExecutiveReport';
import { AppShell } from '@/components/layout/AppShell';

export default async function ScanReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <ExecutiveReport id={id} />
    </AppShell>
  );
}
