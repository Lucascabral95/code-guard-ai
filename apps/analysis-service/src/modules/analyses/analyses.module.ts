import { Module } from '@nestjs/common';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';
import { DatabaseModule } from '../../database/prisma.module';
import { AiModule } from '../ai/ai.module';
import { QueueModule } from '../queue/queue.module';
import { ReportsModule } from '../reports/reports.module';
import { AnalysesService } from './application/analyses.service';
import { AnalysesController } from './presentation/analyses.controller';
import { InternalAnalysesController } from './presentation/internal-analyses.controller';

@Module({
  imports: [DatabaseModule, QueueModule, ReportsModule, AiModule],
  controllers: [AnalysesController, InternalAnalysesController],
  providers: [AnalysesService, InternalSecretGuard],
})
export class AnalysesModule {}
