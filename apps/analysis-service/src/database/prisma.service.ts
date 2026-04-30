import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  buildDatabasePoolConfig,
  buildPrismaClientOptions,
  DatabasePoolConfig,
} from './database.config';
import { DatabaseQueryTelemetry, DatabaseQueryTelemetrySnapshot } from './database-query-telemetry';

export type DatabaseReadiness = {
  status: 'ok';
  latencyMs: number;
  pool: DatabasePoolSummary;
};

export type DatabasePoolSummary = Omit<
  DatabasePoolConfig,
  'url' | 'queryLogging' | 'otlpTracesEndpoint'
>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly poolConfig: DatabasePoolConfig;
  private readonly queryTelemetry: DatabaseQueryTelemetry;

  constructor(configService: ConfigService) {
    const poolConfig = buildDatabasePoolConfig(configService);
    super(buildPrismaClientOptions(poolConfig));

    this.poolConfig = poolConfig;
    this.queryTelemetry = new DatabaseQueryTelemetry(poolConfig);
    this.registerLogListeners(poolConfig);
  }

  async onModuleInit(): Promise<void> {
    const startedAt = Date.now();
    await this.$connect();
    await this.assertReady(1_500);
    this.logger.log(
      `PostgreSQL connected in ${Date.now() - startedAt}ms ` +
        `(pool=${this.poolConfig.connectionLimit}, pool_timeout=${this.poolConfig.poolTimeoutSeconds}s, ` +
        `connect_timeout=${this.poolConfig.connectTimeoutSeconds}s, pgbouncer=${this.poolConfig.pgBouncer})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('PostgreSQL connection pool disconnected.');
  }

  getPoolConfig(): DatabasePoolSummary {
    return {
      redactedUrl: this.poolConfig.redactedUrl,
      connectionLimit: this.poolConfig.connectionLimit,
      poolTimeoutSeconds: this.poolConfig.poolTimeoutSeconds,
      connectTimeoutSeconds: this.poolConfig.connectTimeoutSeconds,
      applicationName: this.poolConfig.applicationName,
      pgBouncer: this.poolConfig.pgBouncer,
      queryMetricsEnabled: this.poolConfig.queryMetricsEnabled,
      slowQueryThresholdMs: this.poolConfig.slowQueryThresholdMs,
      queryTracingEnabled: this.poolConfig.queryTracingEnabled,
      traceSampleRate: this.poolConfig.traceSampleRate,
      otelServiceName: this.poolConfig.otelServiceName,
    };
  }

  getQueryTelemetrySnapshot(): DatabaseQueryTelemetrySnapshot {
    return this.queryTelemetry.snapshot();
  }

  async getReadiness(timeoutMs = 1_500): Promise<DatabaseReadiness> {
    const latencyMs = await this.assertReady(timeoutMs);
    return {
      status: 'ok',
      latencyMs,
      pool: this.getPoolConfig(),
    };
  }

  private async assertReady(timeoutMs: number): Promise<number> {
    const startedAt = Date.now();
    await withTimeout(this.$queryRaw`SELECT 1`, timeoutMs);
    return Date.now() - startedAt;
  }

  private registerLogListeners(poolConfig: DatabasePoolConfig): void {
    this.$on('warn' as never, (event: Prisma.LogEvent) => {
      this.logger.warn(event.message);
    });
    this.$on('error' as never, (event: Prisma.LogEvent) => {
      this.logger.error(event.message);
    });

    this.$on('query' as never, (event: Prisma.QueryEvent) => {
      this.queryTelemetry.record(event);
      if (poolConfig.queryLogging) {
        this.logger.debug(`Prisma query ${event.duration}ms ${event.query}`);
      }
    });
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Database readiness check exceeded ${timeoutMs}ms.`)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}
