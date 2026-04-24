import { AnalysisDetail } from '@/components/analysis/AnalysisDetail';
import { AppShell } from '@/components/layout/AppShell';

export default async function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <AnalysisDetail id={id} />
    </AppShell>
  );
}
