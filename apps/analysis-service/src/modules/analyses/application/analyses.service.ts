import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisStatus, FindingType, LogLevel, Prisma, Severity } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AI_REVIEW_PROVIDER, AiReviewProvider } from '../../ai/ai-review-provider';
import { QueueService } from '../../queue/queue.service';
import { RiskScoringService } from '../../reports/risk-scoring.service';
import { CompleteAnalysisResultDto } from '../presentation/dto/analysis-result.dto';
import { CreateAnalysisDto } from '../presentation/dto/create-analysis.dto';

type FindingForSummary = {
  type: FindingType;
  severity: Severity;
  tool: string;
  file?: string | null;
  line?: number | null;
  message: string;
  recommendation?: string | null;
  raw?: Record<string, unknown> | null;
};

@Injectable()
export class AnalysesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly riskScoringService: RiskScoringService,
    @Inject(AI_REVIEW_PROVIDER)
    private readonly reviewProvider: AiReviewProvider,
  ) {}

  async create(dto: CreateAnalysisDto) {
    const safeMode = this.configService.get<string>('SAFE_ANALYSIS_MODE', 'true') === 'true';
    const branch = dto.branch || 'main';

    const analysis = await this.prisma.analysis.create({
      data: {
        repoUrl: dto.repoUrl,
        branch,
        status: AnalysisStatus.PENDING,
        safeMode,
        logs: {
          create: {
            level: LogLevel.INFO,
            message: 'Analysis created',
          },
        },
      },
    });

    try {
      await this.queueService.publishAnalysisJob({
        analysisId: analysis.id,
        repoUrl: analysis.repoUrl,
        branch: analysis.branch,
        safeMode: analysis.safeMode,
      });

      return this.prisma.analysis.update({
        where: { id: analysis.id },
        data: {
          status: AnalysisStatus.QUEUED,
          logs: {
            create: {
              level: LogLevel.INFO,
              message: 'Analysis queued',
            },
          },
        },
      });
    } catch (error) {
      await this.prisma.analysis.update({
        where: { id: analysis.id },
        data: {
          status: AnalysisStatus.FAILED,
          errorMessage: 'Failed to publish analysis job',
          completedAt: new Date(),
          logs: {
            create: {
              level: LogLevel.ERROR,
              message: error instanceof Error ? error.message : 'Redis publish failed',
            },
          },
        },
      });
      throw new ServiceUnavailableException('Analysis queue is unavailable');
    }
  }

  findAll() {
    return this.prisma.analysis.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id },
      include: {
        findings: {
          orderBy: { createdAt: 'asc' },
        },
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    const { findings, logs, ...analysisFields } = analysis;
    return {
      analysis: analysisFields,
      findings,
      logs,
    };
  }

  async markStarted(id: string) {
    await this.ensureExists(id);
    return this.prisma.analysis.update({
      where: { id },
      data: {
        status: AnalysisStatus.RUNNING,
        startedAt: new Date(),
        logs: {
          create: {
            level: LogLevel.INFO,
            message: 'Analysis started by worker',
          },
        },
      },
    });
  }

  async complete(id: string, dto: CompleteAnalysisResultDto) {
    const analysis = await this.ensureExists(id);
    const findings = dto.findings.map((finding): FindingForSummary => ({ ...finding }));
    const riskScore = this.riskScoringService.calculateRiskScore(findings, dto.rawSummary);
    const riskLevel = this.riskScoringService.calculateRiskLevel(riskScore);
    const summary = await this.reviewProvider.generateSummary({
      repoUrl: analysis.repoUrl,
      branch: analysis.branch,
      detectedStack: dto.detectedStack ?? null,
      riskScore,
      riskLevel,
      findings,
    });

    return this.prisma.$transaction(async (transaction) => {
      if (findings.length > 0) {
        await transaction.finding.createMany({
          data: findings.map((finding) => ({
            analysisId: id,
            type: finding.type,
            severity: finding.severity,
            tool: finding.tool,
            file: finding.file ?? null,
            line: finding.line ?? null,
            message: finding.message,
            recommendation: finding.recommendation ?? null,
            raw: (finding.raw ?? Prisma.DbNull) as Prisma.InputJsonValue,
          })),
        });
      }

      if (dto.logs.length > 0) {
        await transaction.analysisLog.createMany({
          data: dto.logs.map((log) => ({
            analysisId: id,
            level: log.level,
            message: log.message,
          })),
        });
      }

      await transaction.analysisLog.create({
        data: {
          analysisId: id,
          level: LogLevel.INFO,
          message: 'Analysis completed',
        },
      });

      return transaction.analysis.update({
        where: { id },
        data: {
          detectedStack: dto.detectedStack ?? null,
          status: AnalysisStatus.COMPLETED,
          riskScore,
          riskLevel,
          summary,
          completedAt: new Date(),
        },
      });
    });
  }

  async fail(id: string, errorMessage: string) {
    await this.ensureExists(id);
    return this.prisma.analysis.update({
      where: { id },
      data: {
        status: AnalysisStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
        logs: {
          create: {
            level: LogLevel.ERROR,
            message: errorMessage,
          },
        },
      },
    });
  }

  private async ensureExists(id: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    return analysis;
  }
}
