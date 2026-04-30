import type { Prisma } from '@prisma/client';
import { AppEnvs, envs } from '../config/envs';

export type DatabasePoolConfig = {
  url: string;
  redactedUrl: string;
  connectionLimit: number;
  poolTimeoutSeconds: number;
  connectTimeoutSeconds: number;
  applicationName: string;
  pgBouncer: boolean;
  queryLogging: boolean;
  queryMetricsEnabled: boolean;
  slowQueryThresholdMs: number;
  queryTracingEnabled: boolean;
  traceSampleRate: number;
  otelServiceName: string;
  otlpTracesEndpoint: string;
};

export function buildDatabasePoolConfig(appEnvs: AppEnvs = envs): DatabasePoolConfig {
  const rawUrl = appEnvs.databaseUrl;
  const url = parsePostgresUrl(rawUrl);

  const connectionLimit = appEnvs.dbPoolConnectionLimit;
  const poolTimeoutSeconds = appEnvs.dbPoolTimeoutSeconds;
  const connectTimeoutSeconds = appEnvs.dbConnectTimeoutSeconds;
  const applicationName = appEnvs.dbApplicationName;
  const pgBouncer = appEnvs.dbPgBouncer;
  const queryLogging = appEnvs.dbQueryLogging;
  const queryMetricsEnabled = appEnvs.dbQueryMetricsEnabled;
  const slowQueryThresholdMs = appEnvs.dbSlowQueryThresholdMs;
  const queryTracingEnabled = appEnvs.otelEnabled && appEnvs.dbQueryTracingEnabled;
  const traceSampleRate = appEnvs.dbQueryTraceSampleRate;
  const otelServiceName = appEnvs.otelServiceName;
  const otlpTracesEndpoint = appEnvs.otelExporterOtlpTracesEndpoint;

  url.searchParams.set('connection_limit', String(connectionLimit));
  url.searchParams.set('pool_timeout', String(poolTimeoutSeconds));
  url.searchParams.set('connect_timeout', String(connectTimeoutSeconds));
  url.searchParams.set('application_name', applicationName);

  if (pgBouncer) {
    url.searchParams.set('pgbouncer', 'true');
  } else {
    url.searchParams.delete('pgbouncer');
  }

  return {
    url: url.toString(),
    redactedUrl: redactDatabaseUrl(url),
    connectionLimit,
    poolTimeoutSeconds,
    connectTimeoutSeconds,
    applicationName,
    pgBouncer,
    queryLogging,
    queryMetricsEnabled,
    slowQueryThresholdMs,
    queryTracingEnabled,
    traceSampleRate,
    otelServiceName,
    otlpTracesEndpoint,
  };
}

export function buildPrismaClientOptions(
  poolConfig: DatabasePoolConfig,
): Prisma.PrismaClientOptions {
  const log: Prisma.PrismaClientOptions['log'] = [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'query' },
  ];

  return {
    datasources: {
      db: {
        url: poolConfig.url,
      },
    },
    errorFormat: 'minimal',
    log,
  };
}

function parsePostgresUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use the postgresql:// protocol.');
  }

  return url;
}

function redactDatabaseUrl(url: URL): string {
  const safeUrl = new URL(url.toString());
  if (safeUrl.username) {
    safeUrl.username = '***';
  }
  if (safeUrl.password) {
    safeUrl.password = '***';
  }
  return safeUrl.toString();
}
