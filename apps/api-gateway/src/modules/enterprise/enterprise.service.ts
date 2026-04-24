import { Injectable } from '@nestjs/common';
import { AnalysisServiceClient } from '../../clients/analysis-service.client';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateScanDto } from './dto/create-scan.dto';
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

  updateFindingStatus(id: string, dto: UpdateFindingStatusDto): Promise<unknown> {
    return this.analysisServiceClient.updateFindingStatus(id, dto);
  }

  getPortfolioRisk(): Promise<unknown> {
    return this.analysisServiceClient.getPortfolioRisk();
  }
}
