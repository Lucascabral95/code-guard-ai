import { FindingDetail } from '@/components/analysis/FindingDetail';
import { AppShell } from '@/components/layout/AppShell';

export default async function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <FindingDetail id={id} />
    </AppShell>
  );
}
