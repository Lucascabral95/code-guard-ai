import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AnalysesService } from '../application/analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';

@ApiTags('Analyses')
@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create analysis and publish scan job',
    description:
      'Persists the analysis, creates an audit log entry and publishes a Redis Streams job for the Go worker.',
  })
  @ApiCreatedResponse({ description: 'Analysis was persisted and queued on Redis Streams.' })
  create(@Body() dto: CreateAnalysisDto) {
    return this.analysesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List analyses' })
  @ApiOkResponse({ description: 'Analyses ordered by creation date descending.' })
  findAll() {
    return this.analysesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get analysis detail' })
  @ApiParam({ name: 'id', description: 'Analysis UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Analysis detail with findings, logs and scan evidence.' })
  findOne(@Param('id') id: string) {
    return this.analysesService.findOne(id);
  }
}
