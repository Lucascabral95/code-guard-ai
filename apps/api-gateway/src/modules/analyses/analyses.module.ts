import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AnalysisServiceClient } from '../../clients/analysis-service.client';
import { MetricsModule } from '../metrics/metrics.module';
import { AnalysesController } from './analyses.controller';
import { AnalysesService } from './analyses.service';

@Module({
  imports: [HttpModule.register({ timeout: 10_000 }), MetricsModule],
  controllers: [AnalysesController],
  providers: [AnalysesService, AnalysisServiceClient],
})
export class AnalysesModule {}
