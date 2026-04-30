import { AnalysisStatus, LogLevel } from '@prisma/client';
import { AnalysesService } from '../src/modules/analyses/application/analyses.service';
import { RiskScoringService } from '../src/modules/reports/risk-scoring.service';

describe('AnalysesService', () => {
  it('creates an analysis, writes initial logs and publishes a Redis Stream job', async () => {
    const workspace = { id: 'workspace-id', slug: 'default' };
    const project = { id: 'project-id', name: 'vercel/next.js', slug: 'vercel-next-js' };
    const repository = {
      id: 'repository-id',
      projectId: project.id,
      repoUrl: 'https://github.com/vercel/next.js',
    };
    const createdAnalysis = {
      id: 'analysis-id',
      repoUrl: 'https://github.com/vercel/next.js',
      branch: 'main',
      status: AnalysisStatus.PENDING,
      safeMode: true,
    };
    const createdScan = {
      id: 'scan-id',
      analysisId: createdAnalysis.id,
      repositoryId: repository.id,
      status: AnalysisStatus.PENDING,
    };
    const transaction = {
      workspace: {
        upsert: jest.fn().mockResolvedValue(workspace),
      },
      project: {
        upsert: jest.fn().mockResolvedValue(project),
      },
      repository: {
        upsert: jest.fn().mockResolvedValue(repository),
      },
      analysis: {
        create: jest.fn().mockResolvedValue(createdAnalysis),
        update: jest.fn().mockResolvedValue({
          ...createdAnalysis,
          status: AnalysisStatus.QUEUED,
        }),
      },
      scan: {
        create: jest.fn().mockResolvedValue(createdScan),
        update: jest.fn().mockResolvedValue({
          ...createdScan,
          status: AnalysisStatus.QUEUED,
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-id' }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const queue = {
      publishAnalysisJob: jest.fn().mockResolvedValue('stream-id'),
    };
    const service = new AnalysesService(prisma as never, queue as never, new RiskScoringService(), {
      generateSummary: jest.fn(),
    });

    await expect(
      service.create({ repoUrl: 'https://github.com/vercel/next.js', branch: 'main' }),
    ).resolves.toMatchObject({ status: AnalysisStatus.QUEUED });

    expect(transaction.analysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: AnalysisStatus.PENDING,
        logs: { create: { level: LogLevel.INFO, message: 'Analysis created' } },
      }),
    });
    expect(transaction.scan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        analysisId: 'analysis-id',
        repositoryId: 'repository-id',
        status: AnalysisStatus.PENDING,
      }),
    });
    expect(queue.publishAnalysisJob).toHaveBeenCalledWith({
      analysisId: 'analysis-id',
      scanId: 'scan-id',
      repoUrl: 'https://github.com/vercel/next.js',
      branch: 'main',
      safeMode: true,
    });
  });
});
