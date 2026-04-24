import { ConfigService } from '@nestjs/config';
import { AnalysisStatus, LogLevel } from '@prisma/client';
import { AnalysesService } from '../src/modules/analyses/application/analyses.service';
import { RiskScoringService } from '../src/modules/reports/risk-scoring.service';

describe('AnalysesService', () => {
  it('creates an analysis, writes initial logs and publishes a Redis Stream job', async () => {
    const createdAnalysis = {
      id: 'analysis-id',
      repoUrl: 'https://github.com/vercel/next.js',
      branch: 'main',
      status: AnalysisStatus.PENDING,
      safeMode: true,
    };
    const prisma = {
      analysis: {
        create: jest.fn().mockResolvedValue(createdAnalysis),
        update: jest.fn().mockResolvedValue({
          ...createdAnalysis,
          status: AnalysisStatus.QUEUED,
        }),
      },
    };
    const queue = {
      publishAnalysisJob: jest.fn().mockResolvedValue('stream-id'),
    };
    const config = {
      get: jest.fn().mockReturnValue('true'),
    } as unknown as ConfigService;

    const service = new AnalysesService(
      prisma as never,
      queue as never,
      config,
      new RiskScoringService(),
      { generateSummary: jest.fn() },
    );

    await expect(
      service.create({ repoUrl: 'https://github.com/vercel/next.js', branch: 'main' }),
    ).resolves.toMatchObject({ status: AnalysisStatus.QUEUED });

    expect(prisma.analysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: AnalysisStatus.PENDING,
        logs: { create: { level: LogLevel.INFO, message: 'Analysis created' } },
      }),
    });
    expect(queue.publishAnalysisJob).toHaveBeenCalledWith({
      analysisId: 'analysis-id',
      repoUrl: 'https://github.com/vercel/next.js',
      branch: 'main',
      safeMode: true,
    });
  });
});
