import { FindingType, RiskLevel, Severity } from '@prisma/client';
import { RuleBasedReviewProvider } from '../src/modules/ai/rule-based-review.provider';

describe('RuleBasedReviewProvider', () => {
  it('generates a deterministic technical summary', async () => {
    const provider = new RuleBasedReviewProvider();

    await expect(
      provider.generateSummary({
        repoUrl: 'https://github.com/vercel/next.js',
        branch: 'main',
        detectedStack: 'node',
        riskScore: 75,
        riskLevel: RiskLevel.MEDIUM,
        findings: [
          {
            type: FindingType.LINT,
            severity: Severity.LOW,
            message: 'No lint script found',
          },
        ],
      }),
    ).resolves.toContain('Risk score is 75/100');
  });
});
