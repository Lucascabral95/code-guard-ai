import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateScanDto } from './dto/create-scan.dto';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';
import { EnterpriseService } from './enterprise.service';

@ApiTags('Enterprise')
@Controller()
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @Get('projects')
  @ApiOperation({ summary: 'List enterprise projects' })
  @ApiOkResponse({ description: 'Projects with linked repositories and recent snapshots.' })
  listProjects(): Promise<unknown> {
    return this.enterpriseService.listProjects();
  }

  @Post('projects')
  @ApiOperation({ summary: 'Create a project linked to a public GitHub repository' })
  @ApiCreatedResponse({ description: 'Project and repository were created.' })
  createProject(@Body() dto: CreateProjectDto): Promise<unknown> {
    return this.enterpriseService.createProject(dto);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get project detail and scan timeline' })
  @ApiParam({ name: 'id', description: 'Project UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Project detail payload.' })
  getProject(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getProject(id);
  }

  @Post('projects/:id/scans')
  @ApiOperation({ summary: 'Create a new scan for a project' })
  @ApiParam({ name: 'id', description: 'Project UUID', format: 'uuid' })
  @ApiCreatedResponse({ description: 'Scan was created and queued.' })
  createScan(@Param('id') id: string, @Body() dto: CreateScanDto): Promise<unknown> {
    return this.enterpriseService.createScan(id, dto);
  }

  @Get('scans/:id')
  @ApiOperation({ summary: 'Get scan detail with normalized evidence' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Scan detail payload.' })
  getScan(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScan(id);
  }

  @Get('scans/:id/findings')
  @ApiOperation({ summary: 'List findings for a scan' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Scan findings with evidence and remediation.' })
  getScanFindings(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScanFindings(id);
  }

  @Get('scans/:id/artifacts')
  @ApiOperation({ summary: 'List artifacts produced by a scan' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Scan artifacts metadata and inline content.' })
  getScanArtifacts(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScanArtifacts(id);
  }

  @Get('scans/:id/sbom')
  @ApiOperation({ summary: 'Get CycloneDX SBOM for a scan' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'CycloneDX SBOM JSON.' })
  getScanSbom(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScanSbom(id);
  }

  @Get('scans/:id/report')
  @ApiOperation({ summary: 'Get Markdown report for a scan' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Markdown report artifact.' })
  getScanReport(@Param('id') id: string): Promise<unknown> {
    return this.enterpriseService.getScanReport(id);
  }

  @Post('findings/:id/status')
  @ApiOperation({ summary: 'Update finding lifecycle status' })
  @ApiParam({ name: 'id', description: 'Finding UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Updated finding with evidence and remediation.' })
  updateFindingStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFindingStatusDto,
  ): Promise<unknown> {
    return this.enterpriseService.updateFindingStatus(id, dto);
  }

  @Get('dashboard/portfolio-risk')
  @ApiOperation({ summary: 'Get portfolio risk metrics for the dashboard' })
  @ApiOkResponse({ description: 'Portfolio risk totals, trends and latest scans.' })
  getPortfolioRisk(): Promise<unknown> {
    return this.enterpriseService.getPortfolioRisk();
  }
}
