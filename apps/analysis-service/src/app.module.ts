import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './modules/ai/ai.module';
import { AnalysesModule } from './modules/analyses/analyses.module';
import { DatabaseModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { QueueModule } from './modules/queue/queue.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    QueueModule,
    ReportsModule,
    AiModule,
    HealthModule,
    AnalysesModule,
  ],
})
export class AppModule {}
