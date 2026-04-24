import { FindingType, Severity } from '@prisma/client';
import { RiskScoringService } from '../src/modules/reports/risk-scoring.service';

describe('RiskScoringService', () => {
  const service = new RiskScoringService();

  it('calculates score from finding severities and missing tests', () => {
    const score = service.calculateRiskScore(
      [
        {
          type: FindingType.SECURITY,
          severity: Severity.HIGH,
          message: 'Vulnerable dependency detected',
        },
        {
          type: FindingType.TEST,
          severity: Severity.MEDIUM,
          message: 'No test script found',
        },
      ],
      { testsDetected: false },
    );

    expect(score).toBe(40);
    expect(service.calculateRiskLevel(score)).toBe('HIGH');
  });

  it('clamps scores to zero', () => {
    const score = service.calculateRiskScore([
      { type: FindingType.SECURITY, severity: Severity.CRITICAL, message: 'Critical issue' },
      { type: FindingType.SECURITY, severity: Severity.CRITICAL, message: 'Critical issue' },
      { type: FindingType.SECURITY, severity: Severity.CRITICAL, message: 'Critical issue' },
    ]);

    expect(score).toBe(0);
    expect(service.calculateRiskLevel(score)).toBe('CRITICAL');
  });
});
