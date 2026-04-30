import type { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';

const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_POOL_TIMEOUT_SECONDS = 10;
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10;
const DEFAULT_APPLICATION_NAME = 'codeguard-analysis-service';
const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 250;
const DEFAULT_OTLP_TRACES_ENDPOINT = 'http://otel-collector:4318/v1/traces';

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

export function buildDatabasePoolConfig(configService: ConfigService): DatabasePoolConfig {
  const rawUrl = readRequiredString(configService, 'DATABASE_URL');
  const url = parsePostgresUrl(rawUrl);

  const connectionLimit = readPositiveInt(
    configService,
    'DB_POOL_CONNECTION_LIMIT',
    readUrlInt(url, 'connection_limit') ?? DEFAULT_CONNECTION_LIMIT,
  );
  const poolTimeoutSeconds = readPositiveInt(
    configService,
    'DB_POOL_TIMEOUT_SECONDS',
    readUrlInt(url, 'pool_timeout') ?? DEFAULT_POOL_TIMEOUT_SECONDS,
  );
  const connectTimeoutSeconds = readPositiveInt(
    configService,
    'DB_CONNECT_TIMEOUT_SECONDS',
    readUrlInt(url, 'connect_timeout') ?? DEFAULT_CONNECT_TIMEOUT_SECONDS,
  );
  const applicationName = readOptionalString(
    configService,
    'DB_APPLICATION_NAME',
    url.searchParams.get('application_name') ?? DEFAULT_APPLICATION_NAME,
  );
  const pgBouncer = readBoolean(
    configService,
    'DB_PGBOUNCER',
    url.searchParams.get('pgbouncer') === 'true',
  );
  const queryLogging = readBoolean(configService, 'DB_QUERY_LOGGING', false);
  const queryMetricsEnabled = readBoolean(configService, 'DB_QUERY_METRICS_ENABLED', true);
  const slowQueryThresholdMs = readPositiveInt(
    configService,
    'DB_SLOW_QUERY_THRESHOLD_MS',
    DEFAULT_SLOW_QUERY_THRESHOLD_MS,
  );
  const queryTracingEnabled =
    readBoolean(configService, 'OTEL_ENABLED', false) &&
    readBoolean(configService, 'DB_QUERY_TRACING_ENABLED', false);
  const traceSampleRate = readRatio(configService, 'DB_QUERY_TRACE_SAMPLE_RATE', 1);
  const otelServiceName = readOptionalString(
    configService,
    'OTEL_SERVICE_NAME',
    `${applicationName}-db`,
  );
  const otlpTracesEndpoint = readOptionalString(
    configService,
    'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
    DEFAULT_OTLP_TRACES_ENDPOINT,
  );

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

function readRequiredString(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key);
  if (!value?.trim()) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function readOptionalString(configService: ConfigService, key: string, fallback: string): string {
  const value = configService.get<string>(key, fallback).trim();
  if (!value) {
    throw new Error(`${key} cannot be empty.`);
  }
  return value;
}

function readBoolean(configService: ConfigService, key: string, fallback: boolean): boolean {
  const value = configService.get<string>(key);
  if (value === undefined || value === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function readPositiveInt(configService: ConfigService, key: string, fallback: number): number {
  const rawValue = configService.get<string>(key);
  const value = rawValue === undefined || rawValue === '' ? fallback : Number(rawValue);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return value;
}

function readRatio(configService: ConfigService, key: string, fallback: number): number {
  const rawValue = configService.get<string>(key);
  const value = rawValue === undefined || rawValue === '' ? fallback : Number(rawValue);

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${key} must be a number between 0 and 1.`);
  }

  return value;
}

function readUrlInt(url: URL, key: string): number | null {
  const value = url.searchParams.get(key);
  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`DATABASE_URL query parameter ${key} must be a positive integer.`);
  }

  return parsed;
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
