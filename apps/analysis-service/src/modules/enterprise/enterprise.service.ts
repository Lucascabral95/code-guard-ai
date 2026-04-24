import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisStatus, ArtifactKind, FindingStatus, LogLevel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateScanDto } from './dto/create-scan.dto';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  listProjects() {
    return this.prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        repositories: true,
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    });
  }

  async createProject(dto: CreateProjectDto) {
    const workspace = await this.getDefaultWorkspace();
    const slug = this.slugify(dto.name);

    return this.prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        repositories: {
          create: {
            repoUrl: dto.repoUrl,
            defaultBranch: dto.defaultBranch || 'main',
          },
        },
        auditLogs: {
          create: {
            workspaceId: workspace.id,
            actor: 'system',
            action: 'project.created',
            targetType: 'project',
            metadata: { repoUrl: dto.repoUrl },
          },
        },
      },
      include: { repositories: true },
    });
  }

  async getProject(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        repositories: {
          include: {
            scans: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
        snapshots: {
          orderBy: { createdAt: 'asc' },
          take: 30,
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const repositories = project.repositories;
    const scans = repositories.flatMap((repository) => repository.scans);
    const latestScan =
      scans.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;

    return {
      project,
      repositories,
      scans,
      latestScan,
    };
  }

  async createScan(projectId: string, dto: CreateScanDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { repositories: true },
    });
    if (!project || project.repositories.length === 0) {
      throw new NotFoundException('Project or repository not found');
    }

    const repository = project.repositories[0];
    const safeMode = this.configService.get<string>('SAFE_ANALYSIS_MODE', 'true') === 'true';
    const branch = dto.branch || repository.defaultBranch || 'main';

    const { analysis, scan } = await this.prisma.$transaction(async (transaction) => {
      const analysis = await transaction.analysis.create({
        data: {
          repoUrl: repository.repoUrl,
          branch,
          status: AnalysisStatus.PENDING,
          safeMode,
          logs: {
            create: {
              level: LogLevel.INFO,
              message: 'Enterprise scan created',
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

      return { analysis, scan };
    });

    try {
      await this.queueService.publishAnalysisJob({
        analysisId: analysis.id,
        scanId: scan.id,
        repoUrl: repository.repoUrl,
        branch,
        safeMode,
      });

      await this.prisma.$transaction([
        this.prisma.analysis.update({
          where: { id: analysis.id },
          data: { status: AnalysisStatus.QUEUED },
        }),
        this.prisma.scan.update({
          where: { id: scan.id },
          data: { status: AnalysisStatus.QUEUED, currentStage: 'queued' },
        }),
      ]);
    } catch {
      throw new ServiceUnavailableException('Scan queue is unavailable');
    }

    return this.getScan(scan.id);
  }

  async getScan(id: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id },
      include: {
        repository: true,
        toolRuns: { orderBy: { startedAt: 'asc' } },
        findings: {
          orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
          include: {
            evidences: true,
            remediation: true,
          },
        },
        artifacts: true,
        components: {
          include: { vulnerabilities: true },
          orderBy: { name: 'asc' },
        },
        licenseRisks: true,
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return {
      scan,
      findings: scan.findings,
      toolRuns: scan.toolRuns,
      artifacts: scan.artifacts,
      components: scan.components,
      licenseRisks: scan.licenseRisks,
    };
  }

  async getScanFindings(id: string) {
    await this.ensureScan(id);
    return this.prisma.finding.findMany({
      where: { scanId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        evidences: true,
        remediation: true,
      },
    });
  }

  async getScanArtifacts(id: string) {
    await this.ensureScan(id);
    return this.prisma.artifact.findMany({
      where: { scanId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getScanSbom(id: string) {
    await this.ensureScan(id);
    const artifact = await this.prisma.artifact.findFirst({
      where: { scanId: id, kind: ArtifactKind.CYCLONEDX },
    });
    return artifact?.content ?? { bomFormat: 'CycloneDX', specVersion: '1.5', components: [] };
  }

  async getScanReport(id: string) {
    await this.ensureScan(id);
    const artifact = await this.prisma.artifact.findFirst({
      where: { scanId: id, kind: ArtifactKind.MARKDOWN_REPORT },
    });
    return (
      artifact?.content ?? { markdown: '# CodeGuard AI Report\n\nReport is not available yet.' }
    );
  }

  async updateFindingStatus(id: string, dto: UpdateFindingStatusDto) {
    const finding = await this.prisma.finding.findUnique({ where: { id } });
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return this.prisma.finding.update({
      where: { id },
      data: {
        status: dto.status,
        fixedAt: dto.status === FindingStatus.FIXED ? new Date() : null,
      },
      include: {
        evidences: true,
        remediation: true,
      },
    });
  }

  async getPortfolioRisk() {
    const [projects, scans, openFindings, snapshots, latestScans, categoryGroups] =
      await Promise.all([
        this.prisma.project.findMany({
          orderBy: [{ riskScore: 'asc' }, { updatedAt: 'desc' }],
          take: 8,
          include: { repositories: true },
        }),
        this.prisma.scan.count(),
        this.prisma.finding.findMany({
          where: { status: FindingStatus.OPEN },
          select: { severity: true },
        }),
        this.prisma.riskSnapshot.findMany({
          orderBy: { createdAt: 'asc' },
          take: 30,
        }),
        this.prisma.scan.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { repository: true },
        }),
        this.prisma.finding.groupBy({
          by: ['category'],
          _count: true,
          where: { status: FindingStatus.OPEN },
        }),
      ]);

    return {
      totals: {
        projects: await this.prisma.project.count(),
        scans,
        openFindings: openFindings.length,
        critical: openFindings.filter((finding) => finding.severity === 'CRITICAL').length,
        high: openFindings.filter((finding) => finding.severity === 'HIGH').length,
        medium: openFindings.filter((finding) => finding.severity === 'MEDIUM').length,
        low: openFindings.filter((finding) => finding.severity === 'LOW').length,
        info: openFindings.filter((finding) => finding.severity === 'INFO').length,
      },
      topRiskProjects: projects,
      severityTrend: snapshots,
      latestScans,
      findingsByCategory: categoryGroups.map((group) => ({
        category: group.category ?? 'uncategorized',
        count: group._count,
      })),
    };
  }

  private async ensureScan(id: string) {
    const scan = await this.prisma.scan.findUnique({ where: { id } });
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }
    return scan;
  }

  private async getDefaultWorkspace() {
    return this.prisma.workspace.upsert({
      where: { slug: 'default' },
      update: {},
      create: {
        name: 'Default Workspace',
        slug: 'default',
      },
    });
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
