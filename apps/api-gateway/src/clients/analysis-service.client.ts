import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { CreateAnalysisDto } from '../modules/analyses/dto/create-analysis.dto';
import { CreatePolicyDto } from '../modules/enterprise/dto/create-policy.dto';
import { CreateProjectDto } from '../modules/enterprise/dto/create-project.dto';
import { CreateScanDto } from '../modules/enterprise/dto/create-scan.dto';
import { UpdatePolicyDto } from '../modules/enterprise/dto/update-policy.dto';
import { UpdateFindingStatusDto } from '../modules/enterprise/dto/update-finding-status.dto';
import { MetricsService } from '../modules/metrics/metrics.service';

@Injectable()
export class AnalysisServiceClient {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
    configService: ConfigService,
  ) {
    this.baseUrl = configService.get<string>('ANALYSIS_SERVICE_URL', 'http://localhost:3002');
  }

  async createAnalysis(body: CreateAnalysisDto): Promise<unknown> {
    return this.forward('post', '/analyses', body);
  }

  async listAnalyses(): Promise<unknown> {
    return this.forward('get', '/analyses');
  }

  async getAnalysis(id: string): Promise<unknown> {
    return this.forward('get', `/analyses/${encodeURIComponent(id)}`);
  }

  async listProjects(): Promise<unknown> {
    return this.forward('get', '/projects');
  }

  async createProject(body: CreateProjectDto): Promise<unknown> {
    return this.forward('post', '/projects', body);
  }

  async getProject(id: string): Promise<unknown> {
    return this.forward('get', `/projects/${encodeURIComponent(id)}`);
  }

  async createScan(projectId: string, body: CreateScanDto): Promise<unknown> {
    return this.forward('post', `/projects/${encodeURIComponent(projectId)}/scans`, body);
  }

  async getScan(id: string): Promise<unknown> {
    return this.forward('get', `/scans/${encodeURIComponent(id)}`);
  }

  async getScanFindings(id: string): Promise<unknown> {
    return this.forward('get', `/scans/${encodeURIComponent(id)}/findings`);
  }

  async getScanArtifacts(id: string): Promise<unknown> {
    return this.forward('get', `/scans/${encodeURIComponent(id)}/artifacts`);
  }

  async getScanSbom(id: string): Promise<unknown> {
    return this.forward('get', `/scans/${encodeURIComponent(id)}/sbom`);
  }

  async getScanReport(id: string): Promise<unknown> {
    return this.forward('get', `/scans/${encodeURIComponent(id)}/report`);
  }

  async getScanReportPdf(id: string): Promise<Buffer> {
    try {
      const response = await firstValueFrom(
        this.httpService.request<ArrayBuffer>({
          method: 'get',
          url: `${this.baseUrl}/scans/${encodeURIComponent(id)}/report.pdf`,
          responseType: 'arraybuffer',
        }),
      );
      return Buffer.from(response.data);
    } catch (error) {
      this.metricsService.recordUpstreamFailure('analysis-service', `GET /scans/${id}/report.pdf`);
      if (error instanceof AxiosError && error.response) {
        throw new BadGatewayException({
          message: 'Analysis service rejected the gateway PDF request',
          upstreamStatus: error.response.status,
        });
      }

      throw new BadGatewayException('Analysis service PDF report is unavailable');
    }
  }

  async getExecutiveReport(id: string): Promise<unknown> {
    return this.forward('get', `/scans/${encodeURIComponent(id)}/report/executive`);
  }

  async getRemediationPlan(id: string): Promise<unknown> {
    return this.forward('get', `/scans/${encodeURIComponent(id)}/remediation-plan`);
  }

  async compareScans(id: string, previousScanId: string): Promise<unknown> {
    return this.forward(
      'get',
      `/scans/${encodeURIComponent(id)}/compare/${encodeURIComponent(previousScanId)}`,
    );
  }

  async getProjectRiskHistory(id: string): Promise<unknown> {
    return this.forward('get', `/projects/${encodeURIComponent(id)}/risk-history`);
  }

  async listPolicies(): Promise<unknown> {
    return this.forward('get', '/policies');
  }

  async createPolicy(body: CreatePolicyDto): Promise<unknown> {
    return this.forward('post', '/policies', body);
  }

  async updatePolicy(id: string, body: UpdatePolicyDto): Promise<unknown> {
    return this.forward('put', `/policies/${encodeURIComponent(id)}`, body);
  }

  async getFinding(id: string): Promise<unknown> {
    return this.forward('get', `/findings/${encodeURIComponent(id)}`);
  }

  async updateFindingStatus(id: string, body: UpdateFindingStatusDto): Promise<unknown> {
    return this.forward('post', `/findings/${encodeURIComponent(id)}/status`, body);
  }

  async getPortfolioRisk(): Promise<unknown> {
    return this.forward('get', '/dashboard/portfolio-risk');
  }

  async getDashboardRemediation(): Promise<unknown> {
    return this.forward('get', '/dashboard/remediation');
  }

  private async forward(
    method: 'get' | 'post' | 'put',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${this.baseUrl}${path}`,
          data: body,
        }),
      );
      return response.data;
    } catch (error) {
      this.metricsService.recordUpstreamFailure(
        'analysis-service',
        `${method.toUpperCase()} ${path}`,
      );
      if (error instanceof AxiosError && error.response) {
        throw new BadGatewayException({
          message: 'Analysis service rejected the gateway request',
          upstreamStatus: error.response.status,
          upstreamBody: error.response.data,
        });
      }

      throw new BadGatewayException('Analysis service is unavailable');
    }
  }
}
