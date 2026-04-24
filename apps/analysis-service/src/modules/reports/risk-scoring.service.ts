import { Injectable } from '@nestjs/common';
import { FindingType, RiskLevel, Severity } from '@prisma/client';

export interface RiskFinding {
  type: FindingType | string;
  severity: Severity | string;
  message: string;
}

export interface RiskSummary {
  testsDetected?: boolean;
  installationErrors?: number;
}

@Injectable()
export class RiskScoringService {
  calculateRiskScore(findings: RiskFinding[], rawSummary?: RiskSummary | null): number {
    let score = 100;

    for (const finding of findings) {
      score -= this.penaltyForSeverity(finding.severity);
    }

    const noTestsFinding = findings.some(
      (finding) => finding.type === FindingType.TEST && /no test/i.test(finding.message),
    );
    if (rawSummary?.testsDetected === false || noTestsFinding) {
      score -= 20;
    }

    if ((rawSummary?.installationErrors ?? 0) > 0) {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  calculateRiskLevel(score: number): RiskLevel {
    if (score >= 90) {
      return RiskLevel.LOW;
    }

    if (score >= 70) {
      return RiskLevel.MEDIUM;
    }

    if (score >= 40) {
      return RiskLevel.HIGH;
    }

    return RiskLevel.CRITICAL;
  }

  private penaltyForSeverity(severity: Severity | string): number {
    switch (severity) {
      case Severity.CRITICAL:
        return 40;
      case Severity.HIGH:
        return 25;
      case Severity.MEDIUM:
        return 15;
      case Severity.LOW:
        return 5;
      default:
        return 0;
    }
  }
}
