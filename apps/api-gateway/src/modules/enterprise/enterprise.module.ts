import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AnalysisServiceClient } from '../../clients/analysis-service.client';
import { MetricsModule } from '../metrics/metrics.module';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';

@Module({
  imports: [HttpModule.register({ timeout: 10_000 }), MetricsModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService, AnalysisServiceClient],
})
export class EnterpriseModule {}
