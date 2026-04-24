import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnalysisServiceClient } from './clients/analysis-service.client';
import { AnalysesModule } from './modules/analyses/analyses.module';
import { HealthModule } from './modules/health/health.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule.register({ timeout: 10_000 }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    HealthModule,
    AnalysesModule,
    EnterpriseModule,
  ],
  providers: [AnalysisServiceClient],
  exports: [AnalysisServiceClient],
})
export class AppModule {}
