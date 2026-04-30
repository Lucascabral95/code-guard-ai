import { createHash } from 'node:crypto';
import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  AnalysisStatus,
  ArtifactKind,
  FindingType,
  LogLevel,
  Prisma,
  Severity,
  ToolRunStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { envs } from '../../../config/envs';
import { AI_REVIEW_PROVIDER, AiReviewProvider } from '../../ai/ai-review-provider';
import { QueueService } from '../../queue/queue.service';
import { RiskScoringService } from '../../reports/risk-scoring.service';
import { CompleteAnalysisResultDto } from '../presentation/dto/analysis-result.dto';
import { CreateAnalysisDto } from '../presentation/dto/create-analysis.dto';

type FindingForSummary = {
  type: FindingType;
  severity: Severity;
  fingerprint?: string | null;
  category?: string | null;
  confidence?: number | null;
  cwe?: string | null;
  cve?: string | null;
  cvss?: number | null;
  epss?: number | null;
  tool: string;
  file?: string | null;
  line?: number | null;
  message: string;
  recommendation?: string | null;
  raw?: Record<string, unknown> | null;
  evidences?: CompleteAnalysisResultDto['findings'][number]['evidences'];
  remediation?: CompleteAnalysisResultDto['findings'][number]['remediation'];
};

@Injectable()
export class AnalysesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly riskScoringService: RiskScoringService,
    @Inject(AI_REVIEW_PROVIDER)
    private readonly reviewProvider: AiReviewProvider,
  ) {}

  async create(dto: CreateAnalysisDto) {
    const safeMode = envs.safeAnalysisMode;
    const branch = dto.branch || 'main';
    const repoName = this.extractRepositoryName(dto.repoUrl);
    const projectSlug = this.slugify(repoName);

    const { analysis, scan } = await this.prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.upsert({
        where: { slug: 'default' },
        update: {},
        create: {
          name: 'Default Workspace',
          slug: 'default',
        },
      });

      const project = await transaction.project.upsert({
        where: {
          workspaceId_slug: {
            workspaceId: workspace.id,
            slug: projectSlug,
          },
        },
        update: {
          name: repoName,
        },
        create: {
          workspaceId: workspace.id,
          name: repoName,
          slug: projectSlug,
          description: 'Imported from a public GitHub repository.',
        },
      });

      const repository = await transaction.repository.upsert({
        where: {
          projectId_repoUrl: {
            projectId: project.id,
            repoUrl: dto.repoUrl,
          },
        },
        update: {
          defaultBranch: branch,
        },
        create: {
          projectId: project.id,
          repoUrl: dto.repoUrl,
          defaultBranch: branch,
        },
      });

      const analysis = await transaction.analysis.create({
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

      const scan = await transaction.scan.create({
        data: {
          repositoryId: repository.id,
          analysisId: analysis.id,
          branch,
          status: AnalysisStatus.PENDING,
          currentStage: 'queued',
          safeMode,
        },
      });

      await transaction.auditLog.create({
        data: {
          workspaceId: workspace.id,
          projectId: project.id,
          actor: 'system',
          action: 'scan.created',
          targetType: 'scan',
          targetId: scan.id,
          metadata: { repoUrl: dto.repoUrl, branch },
        },
      });

      return { analysis, scan };
    });

    try {
      await this.queueService.publishAnalysisJob({
        analysisId: analysis.id,
        scanId: scan.id,
        repoUrl: analysis.repoUrl,
        branch: analysis.branch,
        safeMode: analysis.safeMode,
      });

      const updatedAnalysis = await this.prisma.$transaction(async (transaction) => {
        await transaction.scan.update({
          where: { id: scan.id },
          data: {
            status: AnalysisStatus.QUEUED,
            currentStage: 'queued',
          },
        });

        return transaction.analysis.update({
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
      });
      return updatedAnalysis;
    } catch (error) {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.scan.update({
          where: { id: scan.id },
          data: {
            status: AnalysisStatus.FAILED,
            errorMessage: 'Failed to publish analysis job',
            completedAt: new Date(),
          },
        });

        await transaction.analysis.update({
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
        scan: {
          include: {
            toolRuns: { orderBy: { startedAt: 'asc' } },
            artifacts: { orderBy: { createdAt: 'asc' } },
            components: {
              orderBy: { name: 'asc' },
              include: { vulnerabilities: true },
            },
            licenseRisks: { orderBy: { createdAt: 'asc' } },
          },
        },
        findings: {
          orderBy: { createdAt: 'asc' },
          include: {
            evidences: true,
            remediation: true,
          },
        },
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    const { findings, logs, scan, ...analysisFields } = analysis;
    return {
      analysis: analysisFields,
      scan,
      findings,
      logs,
      toolRuns: scan?.toolRuns ?? [],
      artifacts: scan?.artifacts ?? [],
      components: scan?.components ?? [],
      licenseRisks: scan?.licenseRisks ?? [],
    };
  }

  async markStarted(id: string) {
    const analysis = await this.ensureExists(id);
    return this.prisma.$transaction(async (transaction) => {
      if (analysis.scan) {
        await transaction.scan.update({
          where: { id: analysis.scan.id },
          data: {
            status: AnalysisStatus.RUNNING,
            currentStage: 'clone',
            startedAt: new Date(),
          },
        });
      }

      return transaction.analysis.update({
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

    const scan = analysis.scan;

    return this.prisma.$transaction(async (transaction) => {
      if (scan && (dto.toolRuns?.length ?? 0) > 0) {
        await transaction.toolRun.createMany({
          data: dto.toolRuns!.map((toolRun) => ({
            scanId: scan.id,
            tool: toolRun.tool,
            stage: toolRun.stage,
            status: this.toToolRunStatus(toolRun.status),
            startedAt: new Date(),
            completedAt: new Date(),
            durationMs: toolRun.durationMs ?? null,
            exitCode: toolRun.exitCode ?? null,
            summary: toolRun.summary ?? null,
            errorMessage: toolRun.errorMessage ?? null,
            raw: (toolRun.raw ?? Prisma.DbNull) as Prisma.InputJsonValue,
          })),
        });
      }

      if (findings.length > 0) {
        for (const finding of findings) {
          const fingerprint = this.findingFingerprint(id, finding);
          const createdFinding = await transaction.finding.create({
            data: {
              analysisId: id,
              scanId: scan?.id ?? null,
              fingerprint,
              category: finding.category ?? this.defaultCategory(finding.type),
              type: finding.type,
              severity: finding.severity,
              confidence: finding.confidence ?? null,
              cwe: finding.cwe ?? null,
              cve: finding.cve ?? null,
              cvss: finding.cvss ?? null,
              epss: finding.epss ?? null,
              tool: finding.tool,
              file: finding.file ?? null,
              line: finding.line ?? null,
              message: finding.message,
              recommendation: finding.recommendation ?? null,
              raw: (finding.raw ?? Prisma.DbNull) as Prisma.InputJsonValue,
            },
          });

          if (finding.evidences?.length) {
            await transaction.evidence.createMany({
              data: finding.evidences.map((evidence) => ({
                findingId: createdFinding.id,
                title: evidence.title,
                snippet: evidence.snippet ?? null,
                file: evidence.file ?? null,
                lineStart: evidence.lineStart ?? null,
                lineEnd: evidence.lineEnd ?? null,
                raw: (evidence.raw ?? Prisma.DbNull) as Prisma.InputJsonValue,
              })),
            });
          }

          if (finding.remediation) {
            await transaction.remediation.create({
              data: {
                findingId: createdFinding.id,
                title: finding.remediation.title,
                description: finding.remediation.description,
                effort: finding.remediation.effort ?? null,
                priority: finding.remediation.priority ?? 3,
              },
            });
          }
        }
      }

      if (scan && (dto.components?.length ?? 0) > 0) {
        await transaction.component.createMany({
          skipDuplicates: true,
          data: dto.components!.map((component) => ({
            scanId: scan.id,
            name: component.name,
            version: component.version ?? null,
            ecosystem: component.ecosystem ?? null,
            packageUrl: component.packageUrl ?? null,
            license: component.license ?? null,
            direct: component.direct ?? false,
          })),
        });
      }

      if (scan && (dto.vulnerabilities?.length ?? 0) > 0) {
        const persistedComponents = await transaction.component.findMany({
          where: { scanId: scan.id },
        });
        const componentIndex = new Map(
          persistedComponents.map((component) => [
            this.componentIdentity(component.name, component.version, component.ecosystem),
            component.id,
          ]),
        );

        await transaction.vulnerability.createMany({
          data: dto.vulnerabilities!.map((vulnerability) => ({
            componentId:
              vulnerability.componentName != null
                ? (componentIndex.get(
                    this.componentIdentity(
                      vulnerability.componentName,
                      vulnerability.version ?? null,
                      vulnerability.ecosystem ?? null,
                    ),
                  ) ?? null)
                : null,
            scanId: scan.id,
            source: vulnerability.source,
            externalId: vulnerability.externalId,
            severity: vulnerability.severity,
            cvss: vulnerability.cvss ?? null,
            epss: vulnerability.epss ?? null,
            fixedVersion: vulnerability.fixedVersion ?? null,
            title: vulnerability.title,
            description: vulnerability.description ?? null,
            url: vulnerability.url ?? null,
          })),
        });
      }

      if (scan && (dto.licenseRisks?.length ?? 0) > 0) {
        await transaction.licenseRisk.createMany({
          data: dto.licenseRisks!.map((licenseRisk) => ({
            scanId: scan.id,
            component: licenseRisk.component,
            license: licenseRisk.license,
            risk: licenseRisk.risk,
            policy: licenseRisk.policy ?? null,
          })),
        });
      }

      if (scan) {
        await transaction.artifact.createMany({
          data: [
            ...this.artifactsForScan(scan.id, dto, summary, findings),
            ...(dto.artifacts ?? []).map((artifact) => ({
              scanId: scan.id,
              kind: this.toArtifactKind(artifact.kind),
              name: artifact.name,
              contentType: artifact.contentType,
              path: artifact.path ?? null,
              content: artifact.content ? this.toJson(artifact.content) : Prisma.DbNull,
            })),
          ],
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

      const completedAt = new Date();
      if (scan) {
        await transaction.scan.update({
          where: { id: scan.id },
          data: {
            detectedStack: dto.detectedStack ?? null,
            status: AnalysisStatus.COMPLETED,
            currentStage: 'completed',
            riskScore,
            riskLevel,
            summary,
            completedAt,
          },
        });

        await transaction.project.update({
          where: { id: scan.repository.projectId },
          data: {
            riskScore,
            riskLevel,
          },
        });

        const severityCounts = this.countSeverities(findings);
        await transaction.riskSnapshot.create({
          data: {
            projectId: scan.repository.projectId,
            scanId: scan.id,
            score: riskScore,
            level: riskLevel,
            ...severityCounts,
          },
        });
      }

      return transaction.analysis.update({
        where: { id },
        data: {
          detectedStack: dto.detectedStack ?? null,
          status: AnalysisStatus.COMPLETED,
          riskScore,
          riskLevel,
          summary,
          completedAt,
        },
      });
    });
  }

  async fail(id: string, errorMessage: string) {
    const analysis = await this.ensureExists(id);
    return this.prisma.$transaction(async (transaction) => {
      const completedAt = new Date();
      if (analysis.scan) {
        await transaction.scan.update({
          where: { id: analysis.scan.id },
          data: {
            status: AnalysisStatus.FAILED,
            currentStage: 'failed',
            errorMessage,
            completedAt,
          },
        });
      }

      return transaction.analysis.update({
        where: { id },
        data: {
          status: AnalysisStatus.FAILED,
          errorMessage,
          completedAt,
          logs: {
            create: {
              level: LogLevel.ERROR,
              message: errorMessage,
            },
          },
        },
      });
    });
  }

  private async ensureExists(id: string) {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id },
      include: {
        scan: {
          include: {
            repository: true,
          },
        },
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    return analysis;
  }

  private extractRepositoryName(repoUrl: string): string {
    const parsed = new URL(repoUrl);
    const [owner, repo] = parsed.pathname
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean);
    return `${owner}/${repo}`;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private findingFingerprint(analysisId: string, finding: FindingForSummary): string {
    if (finding.fingerprint) {
      return finding.fingerprint;
    }

    return createHash('sha256')
      .update(
        [
          analysisId,
          finding.tool,
          finding.type,
          finding.severity,
          finding.file ?? '',
          finding.line ?? '',
          finding.message,
        ].join('|'),
      )
      .digest('hex');
  }

  private defaultCategory(type: FindingType): string {
    switch (type) {
      case FindingType.SECURITY:
        return 'sast';
      case FindingType.DEPENDENCY:
        return 'supply-chain';
      case FindingType.LINT:
      case FindingType.TEST:
      case FindingType.COVERAGE:
        return 'quality';
      case FindingType.STACK_DETECTION:
        return 'inventory';
      default:
        return 'system';
    }
  }

  private toToolRunStatus(status: string): ToolRunStatus {
    if (Object.values(ToolRunStatus).includes(status as ToolRunStatus)) {
      return status as ToolRunStatus;
    }

    return ToolRunStatus.COMPLETED;
  }

  private toArtifactKind(kind: string): ArtifactKind {
    if (Object.values(ArtifactKind).includes(kind as ArtifactKind)) {
      return kind as ArtifactKind;
    }

    return ArtifactKind.RAW_TOOL_OUTPUT;
  }

  private countSeverities(findings: FindingForSummary[]) {
    return {
      critical: findings.filter((finding) => finding.severity === Severity.CRITICAL).length,
      high: findings.filter((finding) => finding.severity === Severity.HIGH).length,
      medium: findings.filter((finding) => finding.severity === Severity.MEDIUM).length,
      low: findings.filter((finding) => finding.severity === Severity.LOW).length,
      info: findings.filter((finding) => finding.severity === Severity.INFO).length,
    };
  }

  private artifactsForScan(
    scanId: string,
    dto: CompleteAnalysisResultDto,
    summary: string,
    findings: FindingForSummary[],
  ): Prisma.ArtifactCreateManyInput[] {
    return [
      {
        scanId,
        kind: ArtifactKind.NORMALIZED_JSON,
        name: 'normalized-findings.json',
        contentType: 'application/json',
        content: this.toJson({ findings, rawSummary: dto.rawSummary ?? {} }),
      },
      {
        scanId,
        kind: ArtifactKind.CYCLONEDX,
        name: 'sbom.cyclonedx.json',
        contentType: 'application/vnd.cyclonedx+json',
        content: this.toJson({
          bomFormat: 'CycloneDX',
          specVersion: '1.5',
          components: dto.components ?? [],
        }),
      },
      {
        scanId,
        kind: ArtifactKind.MARKDOWN_REPORT,
        name: 'executive-report.md',
        contentType: 'text/markdown',
        content: this.toJson({ markdown: this.buildMarkdownReport(summary, findings, dto) }),
      },
    ];
  }

  private buildMarkdownReport(
    summary: string,
    findings: FindingForSummary[],
    dto: CompleteAnalysisResultDto,
  ) {
    const severity = this.countSeverities(findings);
    const toolRuns = dto.toolRuns ?? [];
    const components = dto.components ?? [];
    const licenseRisks = dto.licenseRisks ?? [];
    const topFindings = [...findings]
      .sort(
        (left, right) => this.severityWeight(right.severity) - this.severityWeight(left.severity),
      )
      .slice(0, 10);

    return [
      '# CodeGuard AI Report',
      '',
      '## Executive Summary',
      '',
      summary,
      '',
      '## Risk Evidence',
      '',
      `- Findings: ${findings.length}`,
      `- Critical: ${severity.critical}`,
      `- High: ${severity.high}`,
      `- Medium: ${severity.medium}`,
      `- Low: ${severity.low}`,
      `- Info: ${severity.info}`,
      `- Components detected: ${components.length}`,
      `- License risks: ${licenseRisks.length}`,
      '',
      '## Tool Runs',
      '',
      ...(toolRuns.length
        ? toolRuns.map(
            (toolRun) =>
              `- ${toolRun.tool} (${toolRun.stage}): ${toolRun.status}${toolRun.durationMs ? ` in ${toolRun.durationMs}ms` : ''}`,
          )
        : ['- No tool runs recorded.']),
      '',
      '## Top Findings',
      '',
      ...(topFindings.length
        ? topFindings.map(
            (finding) =>
              `- [${finding.severity}] ${finding.message} (${finding.tool}${finding.category ? ` / ${finding.category}` : ''})`,
          )
        : ['- No actionable findings detected.']),
      '',
      '## Remediation Guidance',
      '',
      ...(topFindings.length
        ? topFindings.map(
            (finding, index) =>
              `${index + 1}. ${finding.recommendation ?? 'Review the evidence and assign an owner.'}`,
          )
        : ['1. Keep scheduled scans running and compare risk over time.']),
    ].join('\n');
  }

  private severityWeight(severity: Severity) {
    switch (severity) {
      case Severity.CRITICAL:
        return 5;
      case Severity.HIGH:
        return 4;
      case Severity.MEDIUM:
        return 3;
      case Severity.LOW:
        return 2;
      default:
        return 1;
    }
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private componentIdentity(
    name: string,
    version: string | null | undefined,
    ecosystem: string | null | undefined,
  ) {
    return [name, version ?? '', ecosystem ?? ''].join('|');
  }
}
