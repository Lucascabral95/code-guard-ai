import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { InternalSecretGuard } from '../../../common/guards/internal-secret.guard';
import { AnalysesService } from '../application/analyses.service';
import { CompleteAnalysisResultDto } from './dto/analysis-result.dto';
import { FailAnalysisDto } from './dto/fail-analysis.dto';

@ApiTags('Worker Internal API')
@ApiSecurity('internal-secret')
@ApiHeader({
  name: 'x-internal-secret',
  required: true,
  description: 'Shared internal secret used by the analyzer worker.',
})
@Controller('internal/analyses')
@UseGuards(InternalSecretGuard)
export class InternalAnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post(':id/start')
  @ApiOperation({ summary: 'Mark analysis as running' })
  @ApiParam({ name: 'id', description: 'Analysis UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Analysis status was updated to RUNNING.' })
  markStarted(@Param('id') id: string) {
    return this.analysesService.markStarted(id);
  }

  @Post(':id/result')
  @ApiOperation({ summary: 'Complete analysis with normalized worker result' })
  @ApiParam({ name: 'id', description: 'Analysis UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Findings, logs, artifacts, score and summary were persisted.' })
  complete(@Param('id') id: string, @Body() dto: CompleteAnalysisResultDto) {
    return this.analysesService.complete(id, dto);
  }

  @Post(':id/fail')
  @ApiOperation({ summary: 'Mark analysis as failed' })
  @ApiParam({ name: 'id', description: 'Analysis UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Analysis was marked as FAILED with an error message.' })
  fail(@Param('id') id: string, @Body() dto: FailAnalysisDto) {
    return this.analysesService.fail(id, dto.errorMessage);
  }
}
