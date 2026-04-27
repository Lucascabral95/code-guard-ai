import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnalysisStatus,
  ArtifactKind,
  FindingStatus,
  LogLevel,
  PolicyAction,
  Prisma,
  Severity,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { PdfReportService } from '../reports/pdf-report.service';
import { ReportBuilderService } from '../reports/report-builder.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateScanDto } from './dto/create-scan.dto';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

type FindingForPriority = {
  id: string;
  fingerprint: string | null;
  severity: Severity;
  status: FindingStatus;
  confidence: number | null;
  cvss: number | null;
  epss: number | null;
  cve: string | null;
  category: string | null;
  file: string | null;
  message: string;
  recommendation: string | null;
  createdAt: Date;
  remediation?: { description: string } | null;
};

type FindingForRemediation = FindingForPriority & {
  scan?: {
    id: string;
    branch: string;
    status: AnalysisStatus;
    riskScore: number | null;
    riskLevel: string | null;
    createdAt: Date;
    completedAt: Date | null;
    repository: {
      id: string;
      repoUrl: string;
      defaultBranch: string;
      project: {
        id: string;
        name: string;
        slug: string;
        riskScore: number | null;
        riskLevel: string | null;
      };
    };
  } | null;
};

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly reportBuilderService: ReportBuilderService,
    private readonly pdfReportService: PdfReportService,
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

    return this.prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        slug: this.slugify(dto.name),
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

    const scans = project.repositories
      .flatMap((repository) => repository.scans)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return {
      project,
      repositories: project.repositories,
      scans,
      latestScan: scans[0] ?? null,
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

  async getExecutiveReport(id: string) {
    const detail = await this.getScan(id);
    const openFindings = detail.findings.filter((finding) => this.isActionable(finding.status));
    const topFindings = this.prioritizeFindings(openFindings).slice(0, 5);
    const severity = this.countBySeverity(openFindings);
    const policyEvaluation = await this.evaluatePolicies(id);
    const reportSections = this.reportBuilderService.build({
      findings: detail.findings,
      toolRuns: detail.toolRuns,
      components: detail.components,
      licenseRisks: detail.licenseRisks,
      policyEvaluation,
    });

    return {
      generatedAt: new Date().toISOString(),
      scan: detail.scan,
      repository: detail.scan.repository,
      executiveSummary: this.buildExecutiveSummary(detail.scan, topFindings, severity),
      risk: {
        score: detail.scan.riskScore,
        level: detail.scan.riskLevel,
        openFindings: openFindings.length,
        criticalAndHigh: severity.CRITICAL + severity.HIGH,
      },
      severity,
      categories: this.countByCategory(openFindings),
      topFindings,
      policyEvaluation,
      businessImpact: this.buildBusinessImpact(topFindings),
      recommendedNextSteps: this.buildRecommendedNextSteps(topFindings, policyEvaluation.failed),
      ...reportSections,
    };
  }

  async getScanReportPdf(id: string) {
    const report = await this.getExecutiveReport(id);
    return this.pdfReportService.generate(report);
  }

  async getRemediationPlan(id: string) {
    const detail = await this.getScan(id);
    const findings = this.prioritizeFindings(
      detail.findings.filter((finding) => this.isActionable(finding.status)),
    );

    return {
      scanId: id,
      generatedAt: new Date().toISOString(),
      totals: this.countBySeverity(findings),
      fixFirst: findings.slice(0, 10).map((finding, index) => ({
        rank: index + 1,
        finding,
        whyThisMatters: this.impactForFinding(finding),
        suggestedAction:
          finding.remediation?.description ??
          finding.recommendation ??
          'Review the evidence and define a remediation owner.',
        ownerHint: this.ownerHintForFinding(finding),
      })),
    };
  }

  async compareScans(id: string, previousScanId: string) {
    const [current, previous] = await Promise.all([this.getScan(id), this.getScan(previousScanId)]);
    const currentMap = this.findingMap(current.findings);
    const previousMap = this.findingMap(previous.findings);

    const added = [...currentMap.entries()]
      .filter(([fingerprint]) => !previousMap.has(fingerprint))
      .map(([, finding]) => finding);
    const resolved = [...previousMap.entries()]
      .filter(([fingerprint]) => !currentMap.has(fingerprint))
      .map(([, finding]) => finding);
    const unchanged = [...currentMap.entries()]
      .filter(([fingerprint]) => previousMap.has(fingerprint))
      .map(([, finding]) => finding);

    return {
      currentScan: current.scan,
      previousScan: previous.scan,
      riskDelta: (current.scan.riskScore ?? 0) - (previous.scan.riskScore ?? 0),
      added,
      resolved,
      unchanged,
      summary: {
        added: added.length,
        resolved: resolved.length,
        unchanged: unchanged.length,
      },
    };
  }

  async getProjectRiskHistory(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const snapshots = await this.prisma.riskSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      project,
      snapshots,
      trend: snapshots.map((snapshot) => ({
        score: snapshot.score,
        level: snapshot.level,
        createdAt: snapshot.createdAt,
        totalFindings:
          snapshot.critical + snapshot.high + snapshot.medium + snapshot.low + snapshot.info,
      })),
    };
  }

  async listPolicies() {
    const workspace = await this.getDefaultWorkspace();
    await this.ensureDefaultPolicies(workspace.id);
    return this.prisma.policy.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ enabled: 'desc' }, { category: 'asc' }, { severity: 'desc' }],
    });
  }

  async createPolicy(dto: CreatePolicyDto) {
    const workspace = await this.getDefaultWorkspace();
    return this.prisma.policy.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category,
        severity: dto.severity,
        action: dto.action,
        enabled: dto.enabled ?? true,
        config: this.toInputJson(dto.config ?? {}),
      },
    });
  }

  async updatePolicy(id: string, dto: UpdatePolicyDto) {
    await this.ensurePolicy(id);
    return this.prisma.policy.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        severity: dto.severity,
        action: dto.action,
        enabled: dto.enabled,
        config: dto.config === undefined ? undefined : this.toInputJson(dto.config),
      },
    });
  }

  async getFinding(id: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id },
      include: {
        evidences: true,
        remediation: true,
        scan: {
          include: {
            repository: true,
          },
        },
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return finding;
  }

  async updateFindingStatus(id: string, dto: UpdateFindingStatusDto) {
    const finding = await this.prisma.finding.findUnique({
      where: { id },
      include: {
        scan: {
          include: {
            repository: {
              include: { project: true },
            },
          },
        },
      },
    });
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    if (
      (dto.status === FindingStatus.ACCEPTED_RISK || dto.status === FindingStatus.FALSE_POSITIVE) &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException('A reason is required for accepted risk or false positive');
    }

    const acceptedUntil =
      dto.status === FindingStatus.ACCEPTED_RISK && dto.acceptedUntil
        ? new Date(dto.acceptedUntil)
        : null;

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.finding.update({
        where: { id },
        data: {
          status: dto.status,
          fixedAt: dto.status === FindingStatus.FIXED ? new Date() : null,
          acceptedUntil,
        },
        include: {
          evidences: true,
          remediation: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          workspaceId: finding.scan?.repository.project.workspaceId ?? null,
          projectId: finding.scan?.repository.projectId ?? null,
          actor: 'system',
          action: 'finding.status_updated',
          targetType: 'finding',
          targetId: id,
          metadata: {
            from: finding.status,
            to: dto.status,
            reason: dto.reason ?? null,
            acceptedUntil: acceptedUntil?.toISOString() ?? null,
          },
        },
      });

      return updated;
    });
  }

  async getPortfolioRisk() {
    const [
      projects,
      scans,
      openFindings,
      snapshots,
      latestScans,
      categoryGroups,
      toolRuns,
      licenses,
    ] = await Promise.all([
      this.prisma.project.findMany({
        orderBy: [{ riskScore: 'asc' }, { updatedAt: 'desc' }],
        take: 8,
        include: { repositories: true },
      }),
      this.prisma.scan.count(),
      this.prisma.finding.findMany({
        where: { status: { in: [FindingStatus.OPEN, FindingStatus.REOPENED] } },
        select: { severity: true, createdAt: true },
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
        where: { status: { in: [FindingStatus.OPEN, FindingStatus.REOPENED] } },
      }),
      this.prisma.toolRun.groupBy({
        by: ['tool', 'status'],
        _count: true,
      }),
      this.prisma.component.groupBy({
        by: ['license'],
        _count: true,
        where: { license: { not: null } },
      }),
    ]);

    return {
      totals: {
        projects: await this.prisma.project.count(),
        scans,
        openFindings: openFindings.length,
        critical: openFindings.filter((finding) => finding.severity === Severity.CRITICAL).length,
        high: openFindings.filter((finding) => finding.severity === Severity.HIGH).length,
        medium: openFindings.filter((finding) => finding.severity === Severity.MEDIUM).length,
        low: openFindings.filter((finding) => finding.severity === Severity.LOW).length,
        info: openFindings.filter((finding) => finding.severity === Severity.INFO).length,
      },
      topRiskProjects: projects,
      severityTrend: snapshots,
      latestScans,
      findingsByCategory: categoryGroups.map((group) => ({
        category: group.category ?? 'uncategorized',
        count: group._count,
      })),
      toolHealth: toolRuns.map((group) => ({
        tool: group.tool,
        status: group.status,
        count: group._count,
      })),
      licenseDistribution: licenses.map((group) => ({
        license: group.license ?? 'unknown',
        count: group._count,
      })),
      aging: this.calculateAging(openFindings),
    };
  }

  async getDashboardRemediation() {
    const [projectCount, scanCount, openFindings, latestScans] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.scan.count(),
      this.prisma.finding.findMany({
        where: { status: { in: [FindingStatus.OPEN, FindingStatus.REOPENED] } },
        orderBy: { createdAt: 'asc' },
        include: {
          remediation: true,
          scan: {
            include: {
              repository: {
                include: {
                  project: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.scan.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          repository: {
            include: {
              project: true,
            },
          },
        },
      }),
    ]);

    const prioritized = this.prioritizeFindings(openFindings as FindingForRemediation[]);
    const staleFindings = [...openFindings]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .slice(0, 8);
    const policyFailures = (
      await Promise.all(
        latestScans.map(async (scan) => {
          const evaluation = await this.evaluatePolicies(scan.id);
          return {
            scanId: scan.id,
            repoUrl: scan.repository.repoUrl,
            projectId: scan.repository.project.id,
            projectName: scan.repository.project.name,
            failed: evaluation.failed,
            warned: evaluation.warned,
            riskScore: scan.riskScore,
            riskLevel: scan.riskLevel,
            createdAt: scan.createdAt.toISOString(),
          };
        }),
      )
    )
      .filter((evaluation) => evaluation.failed > 0 || evaluation.warned > 0)
      .sort((left, right) => {
        if (right.failed !== left.failed) {
          return right.failed - left.failed;
        }
        if (right.warned !== left.warned) {
          return right.warned - left.warned;
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });

    const severity = this.countBySeverity(openFindings);
    const projectsAtRisk = new Set(
      openFindings
        .map((finding) => finding.scan?.repository.project.id)
        .filter((projectId): projectId is string => Boolean(projectId)),
    ).size;

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        projects: projectCount,
        scans: scanCount,
        openFindings: openFindings.length,
        critical: severity.CRITICAL,
        high: severity.HIGH,
        medium: severity.MEDIUM,
        low: severity.LOW,
        info: severity.INFO,
        staleOver30Days: openFindings.filter((finding) => this.ageDays(finding.createdAt) > 30)
          .length,
        activePolicyFailures: policyFailures.reduce(
          (total, evaluation) => total + evaluation.failed,
          0,
        ),
      },
      summary: {
        itemsReadyForRemediation: prioritized.length,
        failingScans: policyFailures.length,
        projectsAtRisk,
      },
      fixFirst: prioritized
        .slice(0, 8)
        .map((finding, index) =>
          this.toRemediationOverviewItem(finding as FindingForRemediation, index + 1),
        ),
      staleFindings: staleFindings.map((finding, index) =>
        this.toRemediationOverviewItem(finding as FindingForRemediation, index + 1),
      ),
      policyFailures,
      latestScans,
    };
  }

  private async ensureScan(id: string) {
    const scan = await this.prisma.scan.findUnique({ where: { id } });
    if (!scan) {
      throw new NotFoundException('Scan not found');
    }
    return scan;
  }

  private async ensurePolicy(id: string) {
    const policy = await this.prisma.policy.findUnique({ where: { id } });
    if (!policy) {
      throw new NotFoundException('Policy not found');
    }
    return policy;
  }

  private async evaluatePolicies(scanId: string) {
    const [policies, findings, licenseRisks] = await Promise.all([
      this.listPolicies(),
      this.prisma.finding.findMany({
        where: { scanId, status: { in: [FindingStatus.OPEN, FindingStatus.REOPENED] } },
      }),
      this.prisma.licenseRisk.findMany({ where: { scanId } }),
    ]);

    const evaluated = policies
      .filter((policy) => policy.enabled)
      .map((policy) => {
        const findingViolations = findings.filter((finding) => {
          const categoryMatches =
            policy.category === 'any' || !policy.category || finding.category === policy.category;
          const severityMatches =
            this.severityWeight(finding.severity) >= this.severityWeight(policy.severity);
          return categoryMatches && severityMatches;
        }).length;
        const licenseViolations =
          policy.category === 'license' || policy.category === 'licenses' ? licenseRisks.length : 0;
        const violations = findingViolations + licenseViolations;

        return {
          id: policy.id,
          name: policy.name,
          category: policy.category,
          action: policy.action,
          severity: policy.severity,
          passed: violations === 0,
          violations,
        };
      });

    return {
      failed: evaluated.filter((policy) => !policy.passed && policy.action === 'FAIL').length,
      warned: evaluated.filter((policy) => !policy.passed && policy.action === 'WARN').length,
      policies: evaluated,
    };
  }

  private buildExecutiveSummary(
    scan: { riskScore: number | null; riskLevel: string | null; detectedStack: string | null },
    topFindings: Array<{ message: string }>,
    severity: Record<string, number>,
  ) {
    const primaryRisk = topFindings[0]?.message ?? 'No actionable findings are currently open.';
    return [
      `Health score is ${scan.riskScore ?? 'pending'}/100 with ${scan.riskLevel ?? 'pending'} risk.`,
      `Detected stack is ${scan.detectedStack ?? 'unknown'}.`,
      `Open critical/high findings: ${severity.CRITICAL + severity.HIGH}.`,
      `Fix first: ${primaryRisk}`,
    ].join(' ');
  }

  private buildBusinessImpact(findings: Array<{ category: string | null }>) {
    if (findings.length === 0) {
      return 'No immediate business-impacting remediation is required from the current evidence.';
    }

    const categories = new Set(findings.map((finding) => finding.category ?? 'quality'));
    if (categories.has('secrets')) {
      return 'Potential credential exposure can lead to unauthorized access and should be handled before routine quality work.';
    }
    if (categories.has('supply-chain')) {
      return 'Supply-chain weaknesses can make builds non-reproducible or expose the product to vulnerable dependencies.';
    }
    if (categories.has('iac')) {
      return 'Infrastructure misconfiguration can weaken runtime isolation and deployment reliability.';
    }

    return 'The main risk is engineering reliability and security posture drift over time.';
  }

  private buildRecommendedNextSteps(
    findings: Array<{ message: string; recommendation: string | null }>,
    failedPolicies: number,
  ) {
    const steps = findings.slice(0, 3).map((finding) => finding.recommendation ?? finding.message);
    if (failedPolicies > 0) {
      steps.unshift(`${failedPolicies} failing policy gate(s) need review before release.`);
    }
    return steps.length > 0 ? steps : ['Keep monitoring with scheduled scans and compare deltas.'];
  }

  private impactForFinding(finding: {
    category: string | null;
    severity: Severity;
    cve: string | null;
  }) {
    if (finding.cve) {
      return 'Known vulnerability with an external identifier; prioritize based on fix availability and exposure.';
    }
    if (finding.category === 'secrets') {
      return 'Secret-like evidence can indicate leaked credentials or unsafe secret handling.';
    }
    if (finding.category === 'supply-chain') {
      return 'Dependency hygiene affects reproducibility, vulnerability management and incident response.';
    }
    if (finding.severity === Severity.CRITICAL || finding.severity === Severity.HIGH) {
      return 'High-impact finding that can materially increase product or delivery risk.';
    }
    return 'This finding contributes to technical risk and should be handled in normal remediation cycles.';
  }

  private ownerHintForFinding(finding: { category: string | null; file: string | null }) {
    if (finding.category === 'iac' || finding.file?.includes('Dockerfile')) {
      return 'platform/devops';
    }
    if (finding.category === 'supply-chain' || finding.file?.includes('package')) {
      return 'application owner';
    }
    if (finding.category === 'secrets') {
      return 'security/application owner';
    }
    return 'repository maintainer';
  }

  private prioritizeFindings<T extends FindingForPriority>(findings: T[]) {
    return [...findings].sort(
      (left, right) => this.priorityScore(right) - this.priorityScore(left),
    );
  }

  private priorityScore(finding: FindingForPriority) {
    const ageDays = Math.floor((Date.now() - finding.createdAt.getTime()) / 86_400_000);
    return (
      this.severityWeight(finding.severity) * 100 +
      Math.round((finding.confidence ?? 0.75) * 20) +
      Math.round((finding.cvss ?? 0) * 3) +
      Math.round((finding.epss ?? 0) * 30) +
      this.categoryPriority(finding.category) +
      Math.min(ageDays, 30)
    );
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

  private categoryPriority(category: string | null) {
    switch (category) {
      case 'secrets':
        return 40;
      case 'supply-chain':
        return 25;
      case 'iac':
        return 20;
      case 'scorecard':
        return 10;
      default:
        return 0;
    }
  }

  private countBySeverity(findings: Array<{ severity: Severity | string }>) {
    return {
      CRITICAL: findings.filter((finding) => finding.severity === Severity.CRITICAL).length,
      HIGH: findings.filter((finding) => finding.severity === Severity.HIGH).length,
      MEDIUM: findings.filter((finding) => finding.severity === Severity.MEDIUM).length,
      LOW: findings.filter((finding) => finding.severity === Severity.LOW).length,
      INFO: findings.filter((finding) => finding.severity === Severity.INFO).length,
    };
  }

  private countByCategory(findings: Array<{ category: string | null }>) {
    return Object.entries(
      findings.reduce<Record<string, number>>((accumulator, finding) => {
        const category = finding.category ?? 'uncategorized';
        accumulator[category] = (accumulator[category] ?? 0) + 1;
        return accumulator;
      }, {}),
    ).map(([category, count]) => ({ category, count }));
  }

  private calculateAging(findings: Array<{ createdAt: Date }>) {
    return {
      under7Days: findings.filter((finding) => this.ageDays(finding.createdAt) < 7).length,
      between7And30Days: findings.filter((finding) => {
        const age = this.ageDays(finding.createdAt);
        return age >= 7 && age <= 30;
      }).length,
      over30Days: findings.filter((finding) => this.ageDays(finding.createdAt) > 30).length,
    };
  }

  private ageDays(date: Date) {
    return Math.floor((Date.now() - date.getTime()) / 86_400_000);
  }

  private toRemediationOverviewItem(finding: FindingForRemediation, rank: number) {
    const repository = finding.scan?.repository ?? null;
    const project = repository?.project
      ? {
          id: repository.project.id,
          name: repository.project.name,
          slug: repository.project.slug,
          riskScore: repository.project.riskScore,
          riskLevel: repository.project.riskLevel,
        }
      : null;
    const scan = finding.scan
      ? {
          id: finding.scan.id,
          branch: finding.scan.branch,
          status: finding.scan.status,
          riskScore: finding.scan.riskScore,
          riskLevel: finding.scan.riskLevel,
          createdAt: finding.scan.createdAt,
          completedAt: finding.scan.completedAt,
        }
      : null;

    return {
      rank,
      ageDays: this.ageDays(finding.createdAt),
      finding,
      whyThisMatters: this.impactForFinding(finding),
      suggestedAction:
        finding.remediation?.description ??
        finding.recommendation ??
        'Review the evidence, assign an owner and validate the fix with a follow-up scan.',
      ownerHint: this.ownerHintForFinding(finding),
      repository,
      project,
      scan,
    };
  }

  private findingMap<T extends { fingerprint: string | null; id: string }>(findings: T[]) {
    return new Map(findings.map((finding) => [finding.fingerprint ?? finding.id, finding]));
  }

  private isActionable(status: FindingStatus) {
    return status === FindingStatus.OPEN || status === FindingStatus.REOPENED;
  }

  private toInputJson(value: Record<string, unknown>): Prisma.InputJsonObject {
    return value as Prisma.InputJsonObject;
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

  private async ensureDefaultPolicies(workspaceId: string) {
    const existingPolicies = await this.prisma.policy.count({ where: { workspaceId } });
    if (existingPolicies > 0) {
      return;
    }

    await this.prisma.policy.createMany({
      data: [
        {
          workspaceId,
          name: 'Block critical findings',
          description: 'Fails policy evaluation when critical actionable findings are open.',
          category: 'any',
          severity: Severity.CRITICAL,
          action: PolicyAction.FAIL,
          enabled: true,
          config: this.toInputJson({}),
        },
        {
          workspaceId,
          name: 'Block secret exposure',
          description: 'Fails policy evaluation when secret-like evidence is detected.',
          category: 'secrets',
          severity: Severity.HIGH,
          action: PolicyAction.FAIL,
          enabled: true,
          config: this.toInputJson({}),
        },
        {
          workspaceId,
          name: 'Warn on supply-chain risk',
          description: 'Warns when dependency and package hygiene findings are open.',
          category: 'supply-chain',
          severity: Severity.MEDIUM,
          action: PolicyAction.WARN,
          enabled: true,
          config: this.toInputJson({}),
        },
        {
          workspaceId,
          name: 'Warn on insecure infrastructure configuration',
          description: 'Warns when Docker, Compose, Terraform or CI posture findings are open.',
          category: 'iac',
          severity: Severity.MEDIUM,
          action: PolicyAction.WARN,
          enabled: true,
          config: this.toInputJson({}),
        },
        {
          workspaceId,
          name: 'Warn on repository security posture drift',
          description: 'Warns when OpenSSF Scorecard-style posture findings are open.',
          category: 'scorecard',
          severity: Severity.LOW,
          action: PolicyAction.WARN,
          enabled: true,
          config: this.toInputJson({}),
        },
      ],
    });
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
