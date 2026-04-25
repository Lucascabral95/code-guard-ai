import { PolicyDashboard } from '@/components/analysis/PolicyDashboard';
import { AppShell } from '@/components/layout/AppShell';

export default function PoliciesPage() {
  return (
    <AppShell>
      <PolicyDashboard />
    </AppShell>
  );
}
