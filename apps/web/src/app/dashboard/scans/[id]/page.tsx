import { ScanDetail } from '@/components/analysis/ScanDetail';
import { AppShell } from '@/components/layout/AppShell';

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <ScanDetail id={id} />
    </AppShell>
  );
}
