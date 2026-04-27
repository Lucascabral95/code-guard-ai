import { ReportBuilderService } from '../src/modules/reports/report-builder.service';

describe('ReportBuilderService', () => {
  it('builds chart, posture and coverage sections from normalized scan data', () => {
    const service = new ReportBuilderService();

    const report = service.build({
      findings: [
        {
          id: 'finding-1',
          severity: 'HIGH',
          status: 'OPEN',
          category: 'ci-cd',
          tool: 'ci-posture',
          message: 'Workflow grants broad permissions',
          remediation: { priority: 2 },
        },
        {
          id: 'finding-2',
          severity: 'LOW',
          status: 'FALSE_POSITIVE',
          category: 'quality',
          tool: 'node-quality',
          message: 'Ignored finding',
          remediation: { priority: 4 },
        },
      ],
      toolRuns: [
        { tool: 'ci-posture', stage: 'quality', status: 'COMPLETED', durationMs: 12 },
        { tool: 'scorecard', stage: 'scorecard', status: 'FAILED', durationMs: 1000 },
      ],
      components: [
        {
          name: 'next',
          ecosystem: 'npm',
          license: 'MIT',
          vulnerabilities: [{ severity: 'HIGH', externalId: 'CVE-1' }],
        },
      ],
      licenseRisks: [{ license: 'MIT', risk: 'none' }],
      policyEvaluation: { failed: 1, warned: 0, policies: [] },
    });

    expect(report.coverage.toolsEnabled).toBe(2);
    expect(report.coverage.toolsFailed).toBe(1);
    expect(report.posture.ciCd.status).toBe('FAIL');
    expect(report.charts.severity).toEqual([{ label: 'HIGH', count: 1 }]);
    expect(report.vulnerabilityBreakdown).toEqual([{ ecosystem: 'npm', count: 1 }]);
  });
});
