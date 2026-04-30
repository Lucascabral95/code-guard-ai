import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { envs } from '../../config/envs';
import { MetricsService } from '../metrics/metrics.service';

export interface AnalysisJob {
  analysisId: string;
  scanId?: string;
  repoUrl: string;
  branch: string;
  safeMode: boolean;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly streamName: string;

  constructor(private readonly metricsService: MetricsService) {
    this.streamName = envs.analysisStreamName;
    const [host, port] = envs.redisAddr.split(':');
    this.redis = new Redis({
      host,
      port: Number(port ?? 6379),
      maxRetriesPerRequest: 3,
    });
  }

  async publishAnalysisJob(job: AnalysisJob): Promise<string> {
    let messageId: string | null;
    try {
      messageId = await this.redis.xadd(
        this.streamName,
        '*',
        'analysisId',
        job.analysisId,
        'scanId',
        job.scanId ?? '',
        'repoUrl',
        job.repoUrl,
        'branch',
        job.branch,
        'safeMode',
        String(job.safeMode),
      );
    } catch (error) {
      this.metricsService.recordRedisPublishError(this.streamName);
      throw error;
    }

    if (!messageId) {
      this.metricsService.recordRedisPublishError(this.streamName);
      throw new Error('Redis did not return a stream message id');
    }

    return messageId;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
