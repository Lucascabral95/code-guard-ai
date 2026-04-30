import { Injectable } from '@nestjs/common';
import { FindingStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type LabelSet = Record<string, string>;

const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class MetricsService {
  private readonly serviceName = 'analysis-service';
  private readonly httpRequests = new Map<string, { labels: LabelSet; value: number }>();
  private readonly httpDuration = new Map<
    string,
    { labels: LabelSet; buckets: Map<number, number>; count: number; sum: number }
  >();
  private readonly redisPublishErrors = new Map<string, { labels: LabelSet; value: number }>();

  constructor(private readonly prisma: PrismaService) {}

  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number) {
    const labels = {
      service: this.serviceName,
      method,
      route: normalizeRoute(route),
      status_code: String(statusCode),
    };
    this.increment(this.httpRequests, labels);

    const durationLabels = {
      service: this.serviceName,
      method,
      route: normalizeRoute(route),
    };
    const key = labelsKey(durationLabels);
    const metric =
      this.httpDuration.get(key) ??
      ({
        labels: durationLabels,
        buckets: new Map(buckets.map((bucket) => [bucket, 0])),
        count: 0,
        sum: 0,
      } satisfies {
        labels: LabelSet;
        buckets: Map<number, number>;
        count: number;
        sum: number;
      });

    for (const bucket of buckets) {
      if (durationSeconds <= bucket) {
        metric.buckets.set(bucket, (metric.buckets.get(bucket) ?? 0) + 1);
      }
    }
    metric.count += 1;
    metric.sum += durationSeconds;
    this.httpDuration.set(key, metric);
  }

  recordRedisPublishError(stream: string) {
    this.increment(this.redisPublishErrors, {
      service: this.serviceName,
      stream,
    });
  }

  async render(): Promise<string> {
    const [scanGroups, severityGroups, categoryGroups] = await Promise.all([
      this.prisma.scan.groupBy({ by: ['status'], _count: true }),
      this.prisma.finding.groupBy({
        by: ['severity'],
        _count: true,
        where: { status: { in: [FindingStatus.OPEN, FindingStatus.REOPENED] } },
      }),
      this.prisma.finding.groupBy({
        by: ['category'],
        _count: true,
        where: { status: { in: [FindingStatus.OPEN, FindingStatus.REOPENED] } },
      }),
    ]);

    const lines: string[] = [
      '# HELP http_requests_total Total HTTP requests by service, route, method and status code.',
      '# TYPE http_requests_total counter',
    ];

    for (const metric of this.httpRequests.values()) {
      lines.push(`http_requests_total{${formatLabels(metric.labels)}} ${metric.value}`);
    }

    lines.push(
      '# HELP http_request_duration_seconds HTTP request duration histogram in seconds.',
      '# TYPE http_request_duration_seconds histogram',
    );
    for (const metric of this.httpDuration.values()) {
      for (const bucket of buckets) {
        lines.push(
          `http_request_duration_seconds_bucket{${formatLabels({
            ...metric.labels,
            le: String(bucket),
          })}} ${metric.buckets.get(bucket) ?? 0}`,
        );
      }
      lines.push(
        `http_request_duration_seconds_bucket{${formatLabels({
          ...metric.labels,
          le: '+Inf',
        })}} ${metric.count}`,
      );
      lines.push(`http_request_duration_seconds_sum{${formatLabels(metric.labels)}} ${metric.sum}`);
      lines.push(
        `http_request_duration_seconds_count{${formatLabels(metric.labels)}} ${metric.count}`,
      );
    }

    lines.push(
      '# HELP codeguard_redis_publish_errors_total Redis Stream publish errors.',
      '# TYPE codeguard_redis_publish_errors_total counter',
    );
    for (const metric of this.redisPublishErrors.values()) {
      lines.push(
        `codeguard_redis_publish_errors_total{${formatLabels(metric.labels)}} ${metric.value}`,
      );
    }

    const poolConfig = this.prisma.getPoolConfig();
    const queryTelemetry = this.prisma.getQueryTelemetrySnapshot();
    lines.push(
      '# HELP codeguard_database_pool_connection_limit Configured Prisma PostgreSQL pool connection limit.',
      '# TYPE codeguard_database_pool_connection_limit gauge',
      `codeguard_database_pool_connection_limit{${formatLabels({
        service: this.serviceName,
        application_name: poolConfig.applicationName,
        pgbouncer: String(poolConfig.pgBouncer),
      })}} ${poolConfig.connectionLimit}`,
      '# HELP codeguard_database_pool_timeout_seconds Configured Prisma PostgreSQL pool timeout in seconds.',
      '# TYPE codeguard_database_pool_timeout_seconds gauge',
      `codeguard_database_pool_timeout_seconds{${formatLabels({
        service: this.serviceName,
      })}} ${poolConfig.poolTimeoutSeconds}`,
      '# HELP codeguard_database_connect_timeout_seconds Configured PostgreSQL connect timeout in seconds.',
      '# TYPE codeguard_database_connect_timeout_seconds gauge',
      `codeguard_database_connect_timeout_seconds{${formatLabels({
        service: this.serviceName,
      })}} ${poolConfig.connectTimeoutSeconds}`,
      '# HELP codeguard_database_slow_query_threshold_seconds Configured slow-query threshold in seconds.',
      '# TYPE codeguard_database_slow_query_threshold_seconds gauge',
      `codeguard_database_slow_query_threshold_seconds{${formatLabels({
        service: this.serviceName,
      })}} ${queryTelemetry.slowQueryThresholdSeconds}`,
      '# HELP codeguard_database_query_tracing_enabled Whether Prisma query tracing is enabled.',
      '# TYPE codeguard_database_query_tracing_enabled gauge',
      `codeguard_database_query_tracing_enabled{${formatLabels({
        service: this.serviceName,
      })}} ${queryTelemetry.tracingEnabled ? 1 : 0}`,
      '# HELP codeguard_database_slow_queries_total Total Prisma queries over the configured slow-query threshold.',
      '# TYPE codeguard_database_slow_queries_total counter',
    );
    for (const metric of queryTelemetry.metrics) {
      lines.push(
        `codeguard_database_slow_queries_total{${formatLabels(metric.labels)}} ${metric.slowCount}`,
      );
    }

    lines.push(
      '# HELP codeguard_database_query_duration_seconds Prisma query duration histogram in seconds.',
      '# TYPE codeguard_database_query_duration_seconds histogram',
      '# HELP codeguard_database_query_duration_max_seconds Maximum observed Prisma query duration in seconds by operation and model.',
      '# TYPE codeguard_database_query_duration_max_seconds gauge',
    );
    for (const metric of queryTelemetry.metrics) {
      for (const bucket of queryTelemetry.buckets) {
        lines.push(
          `codeguard_database_query_duration_seconds_bucket{${formatLabels({
            ...metric.labels,
            le: String(bucket),
          })}} ${metric.buckets.get(bucket) ?? 0}`,
        );
      }
      lines.push(
        `codeguard_database_query_duration_seconds_bucket{${formatLabels({
          ...metric.labels,
          le: '+Inf',
        })}} ${metric.count}`,
      );
      lines.push(
        `codeguard_database_query_duration_seconds_sum{${formatLabels(metric.labels)}} ${metric.sumSeconds}`,
      );
      lines.push(
        `codeguard_database_query_duration_seconds_count{${formatLabels(metric.labels)}} ${metric.count}`,
      );
      lines.push(
        `codeguard_database_query_duration_max_seconds{${formatLabels(metric.labels)}} ${metric.maxSeconds}`,
      );
    }

    lines.push(
      '# HELP codeguard_scans_by_status Current number of scans by lifecycle status.',
      '# TYPE codeguard_scans_by_status gauge',
    );
    for (const group of scanGroups) {
      lines.push(
        `codeguard_scans_by_status{${formatLabels({
          service: this.serviceName,
          status: group.status,
        })}} ${group._count}`,
      );
    }

    lines.push(
      '# HELP codeguard_findings_open_by_severity Current open findings by severity.',
      '# TYPE codeguard_findings_open_by_severity gauge',
    );
    for (const group of severityGroups) {
      lines.push(
        `codeguard_findings_open_by_severity{${formatLabels({
          service: this.serviceName,
          severity: group.severity,
        })}} ${group._count}`,
      );
    }

    lines.push(
      '# HELP codeguard_findings_open_by_category Current open findings by category.',
      '# TYPE codeguard_findings_open_by_category gauge',
    );
    for (const group of categoryGroups) {
      lines.push(
        `codeguard_findings_open_by_category{${formatLabels({
          service: this.serviceName,
          category: group.category ?? 'uncategorized',
        })}} ${group._count}`,
      );
    }

    return `${lines.join('\n')}\n`;
  }

  private increment(store: Map<string, { labels: LabelSet; value: number }>, labels: LabelSet) {
    const key = labelsKey(labels);
    const current = store.get(key) ?? { labels, value: 0 };
    current.value += 1;
    store.set(key, current);
  }
}

function normalizeRoute(route: string) {
  return (
    route
      .replace(/[?#].*$/, '')
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
      .replace(/\/[0-9a-f]{24,}/gi, '/:id')
      .replace(/\/\d+/g, '/:id') || '/'
  );
}

function labelsKey(labels: LabelSet) {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}:${labels[key]}`)
    .join('|');
}

function formatLabels(labels: LabelSet) {
  return Object.entries(labels)
    .map(([key, value]) => `${key}="${escapeLabel(value)}"`)
    .join(',');
}

function escapeLabel(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
