import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateScanDto } from './dto/create-scan.dto';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';
import { EnterpriseService } from './enterprise.service';

@Controller()
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @Get('projects')
  listProjects(): Promise<unknown> {
    return this.enterpriseService.listProjects();
  }

  @Post('projects')
  createProject(@Body() dto: CreateProjectDto): Promise<unknown> {
    return this.enterpriseService.createProject(dto);
  }

  @Get('projects/:id')
  getProject(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getProject(id);
  }

  @Post('projects/:id/scans')
  createScan(@Param('id') id: string, @Body() dto: CreateScanDto): Promise<unknown> {
    return this.enterpriseService.createScan(id, dto);
  }

  @Get('scans/:id')
  getScan(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScan(id);
  }

  @Get('scans/:id/findings')
  getScanFindings(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScanFindings(id);
  }

  @Get('scans/:id/artifacts')
  getScanArtifacts(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScanArtifacts(id);
  }

  @Get('scans/:id/sbom')
  getScanSbom(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScanSbom(id);
  }

  @Get('scans/:id/report')
  getScanReport(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScanReport(id);
  }

  @Post('findings/:id/status')
  updateFindingStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFindingStatusDto,
  ): Promise<unknown> {
    return this.enterpriseService.updateFindingStatus(id, dto);
  }

  @Get('dashboard/portfolio-risk')
  getPortfolioRisk(): Promise<unknown> {
    return this.enterpriseService.getPortfolioRisk();
  }
}
