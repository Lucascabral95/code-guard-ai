import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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

  constructor(configService: ConfigService) {
    this.streamName = configService.get<string>('ANALYSIS_STREAM_NAME', 'scan.jobs');
    const redisAddr = configService.get<string>('REDIS_ADDR', 'localhost:6379');
    const [host, port] = redisAddr.split(':');
    this.redis = new Redis({
      host,
      port: Number(port ?? 6379),
      maxRetriesPerRequest: 3,
    });
  }

  async publishAnalysisJob(job: AnalysisJob): Promise<string> {
    const messageId = await this.redis.xadd(
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

    if (!messageId) {
      throw new Error('Redis did not return a stream message id');
    }

    return messageId;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
