import { Injectable } from '@nestjs/common';
import { FindingType, RiskLevel, Severity } from '@prisma/client';

export interface RiskFinding {
  type: FindingType | string;
  severity: Severity | string;
  message: string;
  category?: string | null;
  confidence?: number | null;
  cve?: string | null;
  cvss?: number | null;
  epss?: number | null;
}

export interface RiskSummary {
  testsDetected?: boolean;
  installationErrors?: number;
  licenseRiskCount?: number;
  secretCandidates?: number;
  iacFindings?: number;
  scorecardWarnings?: number;
}

@Injectable()
export class RiskScoringService {
  calculateRiskScore(findings: RiskFinding[], rawSummary?: RiskSummary | null): number {
    let score = 100;

    const totalFindingPenalty = findings.reduce(
      (total, finding) => total + this.penaltyForFinding(finding),
      0,
    );
    score -= totalFindingPenalty;

    const noTestsFinding = findings.some(
      (finding) => finding.type === FindingType.TEST && /no test/i.test(finding.message),
    );
    if (rawSummary?.testsDetected === false || noTestsFinding) {
      score -= 20;
    }

    if ((rawSummary?.installationErrors ?? 0) > 0) {
      score -= 20;
    }

    score -= Math.min((rawSummary?.licenseRiskCount ?? 0) * 5, 15);
    score -= Math.min((rawSummary?.secretCandidates ?? 0) * 5, 20);
    score -= Math.min((rawSummary?.iacFindings ?? 0) * 3, 15);
    score -= Math.min((rawSummary?.scorecardWarnings ?? 0) * 2, 10);

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

  private penaltyForFinding(finding: RiskFinding): number {
    const severityPenalty = this.penaltyForSeverity(finding.severity);
    if (severityPenalty === 0) {
      return 0;
    }

    const confidenceMultiplier = this.confidenceMultiplier(finding.confidence);
    const exploitabilityPenalty = this.exploitabilityPenalty(finding);
    const categoryPenalty = this.categoryPenalty(finding.category);

    return Math.min(
      50,
      Math.round(severityPenalty * confidenceMultiplier + exploitabilityPenalty + categoryPenalty),
    );
  }

  private confidenceMultiplier(confidence?: number | null): number {
    if (confidence == null) {
      return 1;
    }

    if (confidence >= 0.9) {
      return 1.1;
    }

    if (confidence < 0.5) {
      return 0.6;
    }

    if (confidence < 0.75) {
      return 0.85;
    }

    return 1;
  }

  private exploitabilityPenalty(finding: RiskFinding): number {
    let penalty = 0;

    if ((finding.cvss ?? 0) >= 9) {
      penalty += 10;
    } else if ((finding.cvss ?? 0) >= 7) {
      penalty += 6;
    }

    if ((finding.epss ?? 0) >= 0.5) {
      penalty += 8;
    } else if ((finding.epss ?? 0) >= 0.1) {
      penalty += 3;
    }

    if (finding.cve) {
      penalty += 5;
    }

    return penalty;
  }

  private categoryPenalty(category?: string | null): number {
    switch (category) {
      case 'secrets':
        return 10;
      case 'supply-chain':
        return 5;
      case 'iac':
        return 4;
      case 'scorecard':
        return 2;
      default:
        return 0;
    }
  }
}
