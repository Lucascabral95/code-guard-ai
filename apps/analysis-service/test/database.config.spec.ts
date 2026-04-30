import { loadEnvs } from '../src/config/envs';
import { buildDatabasePoolConfig } from '../src/database/database.config';

describe('buildDatabasePoolConfig', () => {
  it('adds explicit Prisma pool parameters to DATABASE_URL', () => {
    const result = buildDatabasePoolConfig(
      loadEnvs({
        DATABASE_URL: 'postgresql://codeguard:secret@postgres:5432/codeguard',
        DB_PGBOUNCER: 'false',
      }),
    );

    expect(result.connectionLimit).toBe(10);
    expect(result.poolTimeoutSeconds).toBe(10);
    expect(result.connectTimeoutSeconds).toBe(10);
    expect(result.applicationName).toBe('codeguard-analysis-service');
    expect(result.pgBouncer).toBe(false);
    expect(result.queryLogging).toBe(false);
    expect(result.queryMetricsEnabled).toBe(true);
    expect(result.slowQueryThresholdMs).toBe(250);
    expect(result.queryTracingEnabled).toBe(false);
    expect(result.traceSampleRate).toBe(1);
    expect(result.otelServiceName).toBe('codeguard-analysis-service');
    expect(result.url).toContain('connection_limit=10');
    expect(result.url).toContain('pool_timeout=10');
    expect(result.url).toContain('connect_timeout=10');
    expect(result.url).toContain('application_name=codeguard-analysis-service');
    expect(result.redactedUrl).toContain('***:***@postgres');
    expect(result.redactedUrl).not.toContain('secret');
  });

  it('lets explicit environment settings override URL query parameters', () => {
    const result = buildDatabasePoolConfig(
      loadEnvs({
        DATABASE_URL:
          'postgresql://codeguard:secret@postgres:5432/codeguard?connection_limit=4&pool_timeout=5',
        DB_POOL_CONNECTION_LIMIT: '20',
        DB_POOL_TIMEOUT_SECONDS: '30',
        DB_CONNECT_TIMEOUT_SECONDS: '7',
        DB_APPLICATION_NAME: 'codeguard-ci',
        DB_PGBOUNCER: 'true',
        DB_QUERY_LOGGING: 'true',
        DB_QUERY_METRICS_ENABLED: 'false',
        DB_SLOW_QUERY_THRESHOLD_MS: '500',
        OTEL_ENABLED: 'true',
        DB_QUERY_TRACING_ENABLED: 'true',
        DB_QUERY_TRACE_SAMPLE_RATE: '0.25',
        OTEL_SERVICE_NAME: 'codeguard-analysis-service',
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://collector:4318/v1/traces',
      }),
    );

    expect(result.connectionLimit).toBe(20);
    expect(result.poolTimeoutSeconds).toBe(30);
    expect(result.connectTimeoutSeconds).toBe(7);
    expect(result.applicationName).toBe('codeguard-ci');
    expect(result.pgBouncer).toBe(true);
    expect(result.queryLogging).toBe(true);
    expect(result.queryMetricsEnabled).toBe(false);
    expect(result.slowQueryThresholdMs).toBe(500);
    expect(result.queryTracingEnabled).toBe(true);
    expect(result.traceSampleRate).toBe(0.25);
    expect(result.otelServiceName).toBe('codeguard-analysis-service');
    expect(result.otlpTracesEndpoint).toBe('http://collector:4318/v1/traces');
    expect(result.url).toContain('connection_limit=20');
    expect(result.url).toContain('pool_timeout=30');
    expect(result.url).toContain('connect_timeout=7');
    expect(result.url).toContain('pgbouncer=true');
  });

  it('rejects invalid pool values early', () => {
    expect(() =>
      loadEnvs({
        DATABASE_URL: 'postgresql://codeguard:secret@postgres:5432/codeguard',
        DB_POOL_CONNECTION_LIMIT: '0',
      }),
    ).toThrow('DB_POOL_CONNECTION_LIMIT must be a positive integer.');
  });

  it('rejects invalid trace sample rates early', () => {
    expect(() =>
      loadEnvs({
        DATABASE_URL: 'postgresql://codeguard:secret@postgres:5432/codeguard',
        DB_QUERY_TRACE_SAMPLE_RATE: '1.5',
      }),
    ).toThrow('DB_QUERY_TRACE_SAMPLE_RATE must be a number between 0 and 1.');
  });
});
