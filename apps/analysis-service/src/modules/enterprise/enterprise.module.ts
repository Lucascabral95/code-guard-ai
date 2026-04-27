import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ReportsModule } from '../reports/reports.module';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';

@Module({
  imports: [DatabaseModule, QueueModule, ReportsModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService],
})
export class EnterpriseModule {}
