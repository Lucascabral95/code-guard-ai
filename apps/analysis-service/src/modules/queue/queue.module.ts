import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { QueueService } from './queue.service';

@Module({
  imports: [MetricsModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
