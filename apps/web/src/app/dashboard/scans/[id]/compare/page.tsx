import { ScanCompare } from '@/components/analysis/ScanCompare';
import { AppShell } from '@/components/layout/AppShell';

export default async function ScanComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <ScanCompare id={id} />
    </AppShell>
  );
}
