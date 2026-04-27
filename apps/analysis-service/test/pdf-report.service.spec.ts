import { PdfReportService } from '../src/modules/reports/pdf-report.service';

describe('PdfReportService', () => {
  it('generates a valid PDF buffer', () => {
    const service = new PdfReportService();

    const pdf = service.generate({
      generatedAt: new Date().toISOString(),
  executiveSummary: 'Health score is 82/100 with MEDIUM risk.',
      businessImpact: 'The repository has actionable dependency and CI posture work.',
      recommendedNextSteps: ['Pin GitHub Actions to commit SHAs.'],
      risk: { score: 82, level: 'MEDIUM', openFindings: 1, criticalAndHigh: 1 },
      repository: { repoUrl: 'https://github.com/example/repo' },
      topFindings: [
        {
          severity: 'HIGH',
          message: 'Workflow grants broad permissions',
          recommendation: 'Use least-privilege permissions.',
          tool: 'ci-posture',
          category: 'ci-cd',
        },
      ],
      charts: {
        severity: [{ label: 'HIGH', count: 1 }],
        categories: [{ label: 'ci-cd', count: 1 }],
        tools: [{ label: 'ci-posture COMPLETED', count: 1 }],
        vulnerabilityEcosystems: [],
        licenses: [],
        remediationPriority: [{ label: 'P2', count: 1 }],
        toolDuration: [{ label: 'ci-posture', value: 10 }],
      },
      coverage: { toolsEnabled: 1, toolsCompleted: 1, toolsFailed: 0, toolsSkipped: 0 },
      posture: {
        ciCd: { status: 'FAIL', findings: 1, summary: 'CI/CD has high-risk issues.' },
        repository: { status: 'PASS', findings: 0, summary: 'Repository has no open findings.' },
        dockerIac: { status: 'PASS', findings: 0, summary: 'Docker/IaC has no open findings.' },
      },
      repositoryHealth: {
        postureFindings: 1,
        policyFailures: 1,
        policyWarnings: 0,
        componentsDetected: 0,
        licenseRisks: 0,
      },
      toolCoverage: [{ tool: 'ci-posture', stage: 'quality', status: 'COMPLETED', durationMs: 10 }],
      vulnerabilityBreakdown: [],
      licenseBreakdown: [],
      remediationStats: {
        totalActionable: 1,
        priorityOne: 0,
        priorityTwo: 1,
        priorityThreePlus: 0,
      },
    });

    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
