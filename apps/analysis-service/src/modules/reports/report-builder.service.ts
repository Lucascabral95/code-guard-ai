import { Injectable } from '@nestjs/common';

type ReportFinding = {
  id: string;
  severity: string;
  status: string;
  category: string | null;
  tool: string;
  message: string;
  remediation?: { priority: number | null } | null;
};

type ReportToolRun = {
  tool: string;
  stage: string;
  status: string;
  durationMs: number | null;
};

type ReportComponent = {
  name: string;
  ecosystem: string | null;
  license: string | null;
  vulnerabilities?: Array<{ severity: string; externalId: string }>;
};

type ReportLicenseRisk = {
  license: string;
  risk: string;
};

type PolicyEvaluation = {
  failed: number;
  warned: number;
  policies: Array<{ passed: boolean; category: string; severity: string; violations: number }>;
};

export type BuiltReportSections = {
  charts: {
    severity: Array<{ label: string; count: number }>;
    categories: Array<{ label: string; count: number }>;
    tools: Array<{ label: string; count: number }>;
    vulnerabilityEcosystems: Array<{ label: string; count: number }>;
    licenses: Array<{ label: string; count: number }>;
    remediationPriority: Array<{ label: string; count: number }>;
    toolDuration: Array<{ label: string; value: number }>;
  };
  coverage: {
    toolsEnabled: number;
    toolsCompleted: number;
    toolsFailed: number;
    toolsSkipped: number;
  };
  posture: {
    ciCd: PostureSection;
    repository: PostureSection;
    dockerIac: PostureSection;
  };
  repositoryHealth: {
    postureFindings: number;
    policyFailures: number;
    policyWarnings: number;
    componentsDetected: number;
    licenseRisks: number;
  };
  toolCoverage: Array<{ tool: string; stage: string; status: string; durationMs: number | null }>;
  vulnerabilityBreakdown: Array<{ ecosystem: string; count: number }>;
  licenseBreakdown: Array<{ license: string; count: number; riskCount: number }>;
  remediationStats: {
    totalActionable: number;
    priorityOne: number;
    priorityTwo: number;
    priorityThreePlus: number;
  };
};

type PostureSection = {
  status: 'PASS' | 'WARN' | 'FAIL';
  findings: number;
  summary: string;
};

@Injectable()
export class ReportBuilderService {
  build(input: {
    findings: ReportFinding[];
    toolRuns: ReportToolRun[];
    components: ReportComponent[];
    licenseRisks: ReportLicenseRisk[];
    policyEvaluation: PolicyEvaluation;
  }): BuiltReportSections {
    const actionableFindings = input.findings.filter((finding) =>
      ['OPEN', 'REOPENED'].includes(finding.status),
    );

    return {
      charts: {
        severity: this.countBy(actionableFindings, (finding) => finding.severity),
        categories: this.countBy(
          actionableFindings,
          (finding) => finding.category ?? 'uncategorized',
        ),
        tools: this.countBy(input.toolRuns, (toolRun) => `${toolRun.tool} ${toolRun.status}`),
        vulnerabilityEcosystems: this.vulnerabilityEcosystems(input.components),
        licenses: this.licenseDistribution(input.components, input.licenseRisks),
        remediationPriority: this.remediationPriority(actionableFindings),
        toolDuration: input.toolRuns
          .filter((toolRun) => toolRun.durationMs != null)
          .map((toolRun) => ({ label: toolRun.tool, value: toolRun.durationMs ?? 0 })),
      },
      coverage: this.coverage(input.toolRuns),
      posture: {
        ciCd: this.postureSection(actionableFindings, 'ci-cd', 'CI/CD posture'),
        repository: this.postureSection(actionableFindings, 'repo-hygiene', 'Repository hygiene'),
        dockerIac: this.postureSection(actionableFindings, ['docker', 'iac'], 'Docker/IaC posture'),
      },
      repositoryHealth: {
        postureFindings: actionableFindings.filter((finding) =>
          ['ci-cd', 'repo-hygiene', 'docker', 'iac', 'scorecard'].includes(finding.category ?? ''),
        ).length,
        policyFailures: input.policyEvaluation.failed,
        policyWarnings: input.policyEvaluation.warned,
        componentsDetected: input.components.length,
        licenseRisks: input.licenseRisks.length,
      },
      toolCoverage: input.toolRuns.map((toolRun) => ({
        tool: toolRun.tool,
        stage: toolRun.stage,
        status: toolRun.status,
        durationMs: toolRun.durationMs,
      })),
      vulnerabilityBreakdown: this.vulnerabilityEcosystems(input.components).map((item) => ({
        ecosystem: item.label,
        count: item.count,
      })),
      licenseBreakdown: this.licenseBreakdown(input.components, input.licenseRisks),
      remediationStats: this.remediationStats(actionableFindings),
    };
  }

  private coverage(toolRuns: ReportToolRun[]) {
    return {
      toolsEnabled: toolRuns.length,
      toolsCompleted: toolRuns.filter((toolRun) => toolRun.status === 'COMPLETED').length,
      toolsFailed: toolRuns.filter((toolRun) => ['FAILED', 'TIMED_OUT'].includes(toolRun.status))
        .length,
      toolsSkipped: toolRuns.filter((toolRun) => toolRun.status === 'SKIPPED').length,
    };
  }

  private postureSection(
    findings: ReportFinding[],
    categories: string | string[],
    label: string,
  ): PostureSection {
    const categoryList = Array.isArray(categories) ? categories : [categories];
    const matched = findings.filter((finding) => categoryList.includes(finding.category ?? ''));
    const criticalOrHigh = matched.filter((finding) =>
      ['CRITICAL', 'HIGH'].includes(finding.severity),
    ).length;

    if (criticalOrHigh > 0) {
      return {
        status: 'FAIL',
        findings: matched.length,
        summary: `${label} has high-risk issues.`,
      };
    }
    if (matched.length > 0) {
      return { status: 'WARN', findings: matched.length, summary: `${label} needs review.` };
    }
    return { status: 'PASS', findings: 0, summary: `${label} has no open findings.` };
  }

  private vulnerabilityEcosystems(components: ReportComponent[]) {
    const items = components.flatMap((component) =>
      (component.vulnerabilities ?? []).map(() => component.ecosystem ?? 'unknown'),
    );
    return this.countValues(items);
  }

  private licenseDistribution(components: ReportComponent[], licenseRisks: ReportLicenseRisk[]) {
    const licenses = components
      .map((component) => component.license)
      .filter((license): license is string => Boolean(license));
    if (licenses.length === 0 && licenseRisks.length > 0) {
      return this.countValues(licenseRisks.map((risk) => risk.license));
    }
    return this.countValues(licenses);
  }

  private licenseBreakdown(components: ReportComponent[], licenseRisks: ReportLicenseRisk[]) {
    const distribution = this.licenseDistribution(components, licenseRisks);
    return distribution.map((item) => ({
      license: item.label,
      count: item.count,
      riskCount: licenseRisks.filter((risk) => risk.license === item.label).length,
    }));
  }

  private remediationPriority(findings: ReportFinding[]) {
    return this.countValues(
      findings.map((finding) => {
        const priority = finding.remediation?.priority ?? 3;
        return priority <= 1 ? 'P1' : priority === 2 ? 'P2' : 'P3+';
      }),
    );
  }

  private remediationStats(findings: ReportFinding[]) {
    return {
      totalActionable: findings.length,
      priorityOne: findings.filter((finding) => (finding.remediation?.priority ?? 3) <= 1).length,
      priorityTwo: findings.filter((finding) => finding.remediation?.priority === 2).length,
      priorityThreePlus: findings.filter((finding) => (finding.remediation?.priority ?? 3) >= 3)
        .length,
    };
  }

  private countBy<T>(items: T[], mapper: (item: T) => string) {
    return this.countValues(items.map(mapper));
  }

  private countValues(values: string[]) {
    const counts = values.reduce<Record<string, number>>((accumulator, value) => {
      accumulator[value] = (accumulator[value] ?? 0) + 1;
      return accumulator;
    }, {});
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count);
  }
}
