import { EnterpriseService } from '../src/modules/enterprise/enterprise.service';

describe('EnterpriseService', () => {
  it('returns a stable remediation overview payload when no scans exist', async () => {
    const prisma = {
      project: {
        count: jest.fn().mockResolvedValue(0),
      },
      scan: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      finding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new EnterpriseService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.getDashboardRemediation()).resolves.toMatchObject({
      totals: {
        projects: 0,
        scans: 0,
        openFindings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        staleOver30Days: 0,
        activePolicyFailures: 0,
      },
      summary: {
        itemsReadyForRemediation: 0,
        failingScans: 0,
        projectsAtRisk: 0,
      },
      fixFirst: [],
      staleFindings: [],
      policyFailures: [],
      latestScans: [],
    });
  });
});
