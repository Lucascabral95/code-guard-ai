import { Module } from '@nestjs/common';
import { AiModule } from './modules/ai/ai.module';
import { AnalysesModule } from './modules/analyses/analyses.module';
import { DatabaseModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { QueueModule } from './modules/queue/queue.module';
import { ReportsModule } from './modules/reports/reports.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { MetricsModule } from './modules/metrics/metrics.module';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ReportsModule,
    AiModule,
    HealthModule,
    MetricsModule,
    AnalysesModule,
    EnterpriseModule,
  ],
})
export class AppModule {}
