import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { InternalSecretGuard } from '../../../common/guards/internal-secret.guard';
import { AnalysesService } from '../application/analyses.service';
import { CompleteAnalysisResultDto } from './dto/analysis-result.dto';
import { FailAnalysisDto } from './dto/fail-analysis.dto';

@Controller('internal/analyses')
@UseGuards(InternalSecretGuard)
export class InternalAnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post(':id/start')
  markStarted(@Param('id') id: string) {
    return this.analysesService.markStarted(id);
  }

  @Post(':id/result')
  complete(@Param('id') id: string, @Body() dto: CompleteAnalysisResultDto) {
    return this.analysesService.complete(id, dto);
  }

  @Post(':id/fail')
  fail(@Param('id') id: string, @Body() dto: FailAnalysisDto) {
    return this.analysesService.fail(id, dto.errorMessage);
  }
}
