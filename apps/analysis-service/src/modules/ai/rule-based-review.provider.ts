import { Injectable } from '@nestjs/common';
import { Severity } from '@prisma/client';
import { AiReviewProvider, GenerateSummaryInput } from './ai-review-provider';

@Injectable()
export class RuleBasedReviewProvider implements AiReviewProvider {
  async generateSummary(input: GenerateSummaryInput): Promise<string> {
    const highImpactSeverities: string[] = [Severity.CRITICAL, Severity.HIGH];
    const severityCounts = input.findings.reduce<Record<string, number>>((accumulator, finding) => {
      accumulator[finding.severity] = (accumulator[finding.severity] ?? 0) + 1;
      return accumulator;
    }, {});

    const highImpactFindings = input.findings.filter((finding) =>
      highImpactSeverities.includes(finding.severity),
    );
    const mainRisk =
      highImpactFindings[0]?.message ??
      input.findings[0]?.message ??
      'No material issues were detected in safe analysis mode.';

    return [
      `Repository ${input.repoUrl} on branch ${input.branch} was analyzed in ${input.detectedStack ?? 'unknown'} mode.`,
      `Health score is ${input.riskScore}/100 with ${input.riskLevel} risk.`,
      `Findings: ${severityCounts.CRITICAL ?? 0} critical, ${severityCounts.HIGH ?? 0} high, ${severityCounts.MEDIUM ?? 0} medium, ${severityCounts.LOW ?? 0} low, ${severityCounts.INFO ?? 0} informational.`,
      `Primary recommendation: ${mainRisk}`,
    ].join(' ');
  }
}
