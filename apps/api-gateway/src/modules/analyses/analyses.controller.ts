import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AnalysesService } from './analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';

@ApiTags('Analyses')
@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a safe asynchronous repository analysis',
    description: 'Validates a public GitHub URL and proxies the request to the Analysis Service.',
  })
  @ApiCreatedResponse({ description: 'Analysis was created and queued.' })
  create(@Body() dto: CreateAnalysisDto): Promise<unknown> {
    return this.analysesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List recent analyses' })
  @ApiOkResponse({ description: 'Recent analyses ordered by creation date.' })
  findAll(): Promise<unknown> {
    return this.analysesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get analysis detail with findings and logs' })
  @ApiParam({ name: 'id', description: 'Analysis UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Analysis detail payload.' })
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.analysesService.findOne(id);
  }
}
