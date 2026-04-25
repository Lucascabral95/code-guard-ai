import { Injectable } from '@nestjs/common';
import { AnalysisServiceClient } from '../../clients/analysis-service.client';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateScanDto } from './dto/create-scan.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';

@Injectable()
export class EnterpriseService {
  constructor(private readonly analysisServiceClient: AnalysisServiceClient) {}

  listProjects(): Promise<unknown> {
    return this.analysisServiceClient.listProjects();
  }

  createProject(dto: CreateProjectDto): Promise<unknown> {
    return this.analysisServiceClient.createProject(dto);
  }

  getProject(id: string): Promise<unknown> {
    return this.analysisServiceClient.getProject(id);
  }

  createScan(projectId: string, dto: CreateScanDto): Promise<unknown> {
    return this.analysisServiceClient.createScan(projectId, dto);
  }

  getScan(id: string): Promise<unknown> {
    return this.analysisServiceClient.getScan(id);
  }

  getScanFindings(id: string): Promise<unknown> {
    return this.analysisServiceClient.getScanFindings(id);
  }

  getScanArtifacts(id: string): Promise<unknown> {
    return this.analysisServiceClient.getScanArtifacts(id);
  }

  getScanSbom(id: string): Promise<unknown> {
    return this.analysisServiceClient.getScanSbom(id);
  }

  getScanReport(id: string): Promise<unknown> {
    return this.analysisServiceClient.getScanReport(id);
  }

  getExecutiveReport(id: string): Promise<unknown> {
    return this.analysisServiceClient.getExecutiveReport(id);
  }

  getRemediationPlan(id: string): Promise<unknown> {
    return this.analysisServiceClient.getRemediationPlan(id);
  }

  compareScans(id: string, previousScanId: string): Promise<unknown> {
    return this.analysisServiceClient.compareScans(id, previousScanId);
  }

  getProjectRiskHistory(id: string): Promise<unknown> {
    return this.analysisServiceClient.getProjectRiskHistory(id);
  }

  listPolicies(): Promise<unknown> {
    return this.analysisServiceClient.listPolicies();
  }

  createPolicy(dto: CreatePolicyDto): Promise<unknown> {
    return this.analysisServiceClient.createPolicy(dto);
  }

  updatePolicy(id: string, dto: UpdatePolicyDto): Promise<unknown> {
    return this.analysisServiceClient.updatePolicy(id, dto);
  }

  getFinding(id: string): Promise<unknown> {
    return this.analysisServiceClient.getFinding(id);
  }

  updateFindingStatus(id: string, dto: UpdateFindingStatusDto): Promise<unknown> {
    return this.analysisServiceClient.updateFindingStatus(id, dto);
  }

  getPortfolioRisk(): Promise<unknown> {
    return this.analysisServiceClient.getPortfolioRisk();
  }

  getDashboardRemediation(): Promise<unknown> {
    return this.analysisServiceClient.getDashboardRemediation();
  }
}
