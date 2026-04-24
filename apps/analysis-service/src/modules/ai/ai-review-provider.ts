import { FindingType, RiskLevel, Severity } from '@prisma/client';

export interface GenerateSummaryFinding {
  type: FindingType | string;
  severity: Severity | string;
  message: string;
  recommendation?: string | null;
}

export interface GenerateSummaryInput {
  repoUrl: string;
  branch: string;
  detectedStack: string | null;
  riskScore: number;
  riskLevel: RiskLevel;
  findings: GenerateSummaryFinding[];
}

export interface AiReviewProvider {
  generateSummary(input: GenerateSummaryInput): Promise<string>;
}

export const AI_REVIEW_PROVIDER = Symbol('AI_REVIEW_PROVIDER');
