import { ProjectDetail } from '@/components/analysis/ProjectDetail';
import { AppShell } from '@/components/layout/AppShell';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <ProjectDetail id={id} />
    </AppShell>
  );
}
