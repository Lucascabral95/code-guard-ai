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
  @ApiOkResponse({ description: 'Projects with repositories and recent risk snapshots.' })
  listProjects() {
    return this.enterpriseService.listProjects();
  }

  @Post('projects')
  @ApiOperation({ summary: 'Create project linked to a public GitHub repository' })
  @ApiCreatedResponse({ description: 'Project and repository were created.' })
  createProject(@Body() dto: CreateProjectDto) {
    return this.enterpriseService.createProject(dto);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get project detail and scan timeline' })
  @ApiParam({ name: 'id', description: 'Project UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Project, repositories, scans and latest scan.' })
  getProject(@Param('id') id: string) {
    return this.enterpriseService.getProject(id);
  }

  @Post('projects/:id/scans')
  @ApiOperation({ summary: 'Create and queue a scan for a project' })
  @ApiParam({ name: 'id', description: 'Project UUID', format: 'uuid' })
  @ApiCreatedResponse({ description: 'Scan was created and queued.' })
  createScan(@Param('id') id: string, @Body() dto: CreateScanDto) {
    return this.enterpriseService.createScan(id, dto);
  }

  @Get('scans/:id')
  @ApiOperation({ summary: 'Get scan detail with normalized evidence' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({
    description: 'Scan, findings, tool runs, artifacts, components and license risks.',
  })
  getScan(@Param('id') id: string) {
    return this.enterpriseService.getScan(id);
  }

  @Get('scans/:id/findings')
  @ApiOperation({ summary: 'List scan findings' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Findings with evidence and remediation.' })
  getScanFindings(@Param('id') id: string) {
    return this.enterpriseService.getScanFindings(id);
  }

  @Get('scans/:id/artifacts')
  @ApiOperation({ summary: 'List scan artifacts' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Artifacts produced by the scan.' })
  getScanArtifacts(@Param('id') id: string) {
    return this.enterpriseService.getScanArtifacts(id);
  }

  @Get('scans/:id/sbom')
  @ApiOperation({ summary: 'Get CycloneDX SBOM' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'CycloneDX SBOM JSON.' })
  getScanSbom(@Param('id') id: string) {
    return this.enterpriseService.getScanSbom(id);
  }

  @Get('scans/:id/report')
  @ApiOperation({ summary: 'Get Markdown scan report' })
  @ApiParam({ name: 'id', description: 'Scan UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Markdown report artifact.' })
  getScanReport(@Param('id') id: string) {
    return this.enterpriseService.getScanReport(id);
  }

  @Post('findings/:id/status')
  @ApiOperation({ summary: 'Update finding lifecycle status' })
  @ApiParam({ name: 'id', description: 'Finding UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Updated finding.' })
  updateFindingStatus(@Param('id') id: string, @Body() dto: UpdateFindingStatusDto) {
    return this.enterpriseService.updateFindingStatus(id, dto);
  }

  @Get('dashboard/portfolio-risk')
  @ApiOperation({ summary: 'Get dashboard portfolio risk metrics' })
  @ApiOkResponse({ description: 'Portfolio risk totals, trends, categories and latest scans.' })
  getPortfolioRisk() {
    return this.enterpriseService.getPortfolioRisk();
  }
}
