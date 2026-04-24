import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService],
})
export class EnterpriseModule {}
