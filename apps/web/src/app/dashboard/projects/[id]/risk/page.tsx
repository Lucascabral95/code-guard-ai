import { ProjectRisk } from '@/components/analysis/ProjectRisk';
import { AppShell } from '@/components/layout/AppShell';

export default async function ProjectRiskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <ProjectRisk id={id} />
    </AppShell>
  );
}
