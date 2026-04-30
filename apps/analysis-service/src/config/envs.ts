import 'dotenv/config';

type EnvSource = Record<string, string | undefined>;

export type AppEnvs = {
  nodeEnv: string;
  port: number;
  postgresUser: string;
  postgresPassword: string;
  postgresDb: string;
  databaseUrl: string;
  databaseDirectUrl: string;
  dbPoolConnectionLimit: number;
  dbPoolTimeoutSeconds: number;
  dbConnectTimeoutSeconds: number;
  dbApplicationName: string;
  dbPgBouncer: boolean;
  dbQueryLogging: boolean;
  dbQueryMetricsEnabled: boolean;
  dbSlowQueryThresholdMs: number;
  dbQueryTracingEnabled: boolean;
  dbQueryTraceSampleRate: number;
  otelEnabled: boolean;
  otelServiceName: string;
  otelExporterOtlpTracesEndpoint: string;
  pgbouncerPort: number;
  pgbouncerPoolMode: string;
  pgbouncerMaxClientConn: number;
  pgbouncerDefaultPoolSize: number;
  pgbouncerReservePoolSize: number;
  redisAddr: string;
  analysisStreamName: string;
  apiGatewayPort: number;
  analysisServicePort: number;
  analysisServiceUrl: string;
  nextPublicApiBaseUrl: string;
  swaggerEnabled: boolean;
  metricsEnabled: boolean;
  metricsPath: string;
  internalSecret: string;
  safeAnalysisMode: boolean;
  sandboxAnalysisMode: string;
  tempDir: string;
  workerMetricsPort: number;
  scannerTimeoutSeconds: number;
  scannerOutputLimitBytes: number;
  scannerDockerNetwork: string;
  scannerSharedVolume: string;
  scannerWorkspacePath: string;
  scannerMemoryLimit: string;
  scannerCpuLimit: string;
  semgrepImage: string;
  trivyImage: string;
  osvScannerImage: string;
  gitleaksImage: string;
  scorecardImage: string;
  ollamaEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  prometheusPort: number;
  grafanaPort: number;
  grafanaAdminUser: string;
  grafanaAdminPassword: string;
  lokiPort: number;
};

export function loadEnvs(source: EnvSource = process.env): AppEnvs {
  return {
    nodeEnv: readString(source, 'NODE_ENV', 'development'),
    port: readInt(source, 'PORT', readInt(source, 'ANALYSIS_SERVICE_PORT', 3002)),
    postgresUser: readString(source, 'POSTGRES_USER', 'codeguard'),
    postgresPassword: readString(source, 'POSTGRES_PASSWORD', 'codeguard'),
    postgresDb: readString(source, 'POSTGRES_DB', 'codeguard'),
    databaseUrl: readPostgresUrl(
      source,
      'DATABASE_URL',
      'postgresql://codeguard:codeguard@pgbouncer:5432/codeguard',
    ),
    databaseDirectUrl: readPostgresUrl(
      source,
      'DATABASE_DIRECT_URL',
      'postgresql://codeguard:codeguard@postgres:5432/codeguard',
    ),
    dbPoolConnectionLimit: readInt(source, 'DB_POOL_CONNECTION_LIMIT', 10),
    dbPoolTimeoutSeconds: readInt(source, 'DB_POOL_TIMEOUT_SECONDS', 10),
    dbConnectTimeoutSeconds: readInt(source, 'DB_CONNECT_TIMEOUT_SECONDS', 10),
    dbApplicationName: readString(source, 'DB_APPLICATION_NAME', 'codeguard-analysis-service'),
    dbPgBouncer: readBoolean(source, 'DB_PGBOUNCER', true),
    dbQueryLogging: readBoolean(source, 'DB_QUERY_LOGGING', false),
    dbQueryMetricsEnabled: readBoolean(source, 'DB_QUERY_METRICS_ENABLED', true),
    dbSlowQueryThresholdMs: readInt(source, 'DB_SLOW_QUERY_THRESHOLD_MS', 250),
    dbQueryTracingEnabled: readBoolean(source, 'DB_QUERY_TRACING_ENABLED', false),
    dbQueryTraceSampleRate: readRatio(source, 'DB_QUERY_TRACE_SAMPLE_RATE', 1),
    otelEnabled: readBoolean(source, 'OTEL_ENABLED', false),
    otelServiceName: readString(source, 'OTEL_SERVICE_NAME', 'codeguard-analysis-service'),
    otelExporterOtlpTracesEndpoint: readUrl(
      source,
      'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
      'http://otel-collector:4318/v1/traces',
    ),
    pgbouncerPort: readInt(source, 'PGBOUNCER_PORT', 6432),
    pgbouncerPoolMode: readString(source, 'PGBOUNCER_POOL_MODE', 'transaction'),
    pgbouncerMaxClientConn: readInt(source, 'PGBOUNCER_MAX_CLIENT_CONN', 200),
    pgbouncerDefaultPoolSize: readInt(source, 'PGBOUNCER_DEFAULT_POOL_SIZE', 20),
    pgbouncerReservePoolSize: readInt(source, 'PGBOUNCER_RESERVE_POOL_SIZE', 5),
    redisAddr: readHostPort(source, 'REDIS_ADDR', 'redis:6379'),
    analysisStreamName: readString(source, 'ANALYSIS_STREAM_NAME', 'scan.jobs'),
    apiGatewayPort: readInt(source, 'API_GATEWAY_PORT', 3001),
    analysisServicePort: readInt(source, 'ANALYSIS_SERVICE_PORT', 3002),
    analysisServiceUrl: readUrl(source, 'ANALYSIS_SERVICE_URL', 'http://analysis-service:3002'),
    nextPublicApiBaseUrl: readUrl(source, 'NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001'),
    swaggerEnabled: readBoolean(source, 'SWAGGER_ENABLED', true),
    metricsEnabled: readBoolean(source, 'METRICS_ENABLED', true),
    metricsPath: readPath(source, 'METRICS_PATH', '/metrics'),
    internalSecret: readString(source, 'INTERNAL_SECRET', 'dev-internal-secret'),
    safeAnalysisMode: readBoolean(source, 'SAFE_ANALYSIS_MODE', true),
    sandboxAnalysisMode: readString(source, 'SANDBOX_ANALYSIS_MODE', 'docker'),
    tempDir: readString(source, 'TEMP_DIR', '/tmp/codeguard'),
    workerMetricsPort: readInt(source, 'WORKER_METRICS_PORT', 9101),
    scannerTimeoutSeconds: readInt(source, 'SCANNER_TIMEOUT_SECONDS', 120),
    scannerOutputLimitBytes: readInt(source, 'SCANNER_OUTPUT_LIMIT_BYTES', 10_485_760),
    scannerDockerNetwork: readString(source, 'SCANNER_DOCKER_NETWORK', 'none'),
    scannerSharedVolume: readString(source, 'SCANNER_SHARED_VOLUME', 'codeguard_scanner_workspace'),
    scannerWorkspacePath: readString(source, 'SCANNER_WORKSPACE_PATH', '/workspace'),
    scannerMemoryLimit: readString(source, 'SCANNER_MEMORY_LIMIT', '2g'),
    scannerCpuLimit: readString(source, 'SCANNER_CPU_LIMIT', '2.0'),
    semgrepImage: readString(source, 'SEMGREP_IMAGE', 'semgrep/semgrep:latest'),
    trivyImage: readString(source, 'TRIVY_IMAGE', 'aquasec/trivy:latest'),
    osvScannerImage: readString(source, 'OSV_SCANNER_IMAGE', 'ghcr.io/google/osv-scanner:latest'),
    gitleaksImage: readString(source, 'GITLEAKS_IMAGE', 'zricethezav/gitleaks:latest'),
    scorecardImage: readString(source, 'SCORECARD_IMAGE', 'gcr.io/openssf/scorecard:latest'),
    ollamaEnabled: readBoolean(source, 'OLLAMA_ENABLED', false),
    ollamaBaseUrl: readUrl(source, 'OLLAMA_BASE_URL', 'http://localhost:11434'),
    ollamaModel: readString(source, 'OLLAMA_MODEL', 'llama3.2'),
    prometheusPort: readInt(source, 'PROMETHEUS_PORT', 9090),
    grafanaPort: readInt(source, 'GRAFANA_PORT', 3003),
    grafanaAdminUser: readString(source, 'GRAFANA_ADMIN_USER', 'admin'),
    grafanaAdminPassword: readString(source, 'GRAFANA_ADMIN_PASSWORD', 'admin'),
    lokiPort: readInt(source, 'LOKI_PORT', 3100),
  };
}

export const envs = loadEnvs();

function readString(source: EnvSource, key: string, fallback: string): string {
  const value = source[key]?.trim() || fallback;
  if (!value) {
    throw new Error(`${key} cannot be empty.`);
  }
  return value;
}

function readPath(source: EnvSource, key: string, fallback: string): string {
  const value = readString(source, key, fallback);
  if (!value.startsWith('/')) {
    throw new Error(`${key} must start with "/".`);
  }
  return value;
}

function readInt(source: EnvSource, key: string, fallback: number): number {
  const rawValue = source[key]?.trim();
  const value = rawValue ? Number(rawValue) : fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function readRatio(source: EnvSource, key: string, fallback: number): number {
  const rawValue = source[key]?.trim();
  const value = rawValue ? Number(rawValue) : fallback;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${key} must be a number between 0 and 1.`);
  }
  return value;
}

function readBoolean(source: EnvSource, key: string, fallback: boolean): boolean {
  const rawValue = source[key]?.trim().toLowerCase();
  if (!rawValue) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'on'].includes(rawValue)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(rawValue)) {
    return false;
  }
  throw new Error(`${key} must be a boolean value.`);
}

function readUrl(source: EnvSource, key: string, fallback: string): string {
  const value = readString(source, key, fallback);
  try {
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${key} must be a valid URL.`);
  }
}

function readPostgresUrl(source: EnvSource, key: string, fallback: string): string {
  const value = readString(source, key, fallback);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid PostgreSQL connection URL.`);
  }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error(`${key} must use the postgresql:// protocol.`);
  }
  return value;
}

function readHostPort(source: EnvSource, key: string, fallback: string): string {
  const value = readString(source, key, fallback);
  const [host, port] = value.split(':');
  if (!host || !port || !Number.isInteger(Number(port))) {
    throw new Error(`${key} must use host:port format.`);
  }
  return value;
}
