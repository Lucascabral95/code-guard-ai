import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { DatabasePoolConfig } from './database.config';

export type DatabaseQueryMetric = {
  labels: {
    service: string;
    operation: string;
    model: string;
  };
  buckets: Map<number, number>;
  count: number;
  sumSeconds: number;
  maxSeconds: number;
  slowCount: number;
};

export type DatabaseQueryTelemetrySnapshot = {
  buckets: number[];
  metrics: DatabaseQueryMetric[];
  slowQueryThresholdSeconds: number;
  tracingEnabled: boolean;
};

const queryBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export class DatabaseQueryTelemetry {
  private readonly metrics = new Map<string, DatabaseQueryMetric>();
  private readonly serviceName: string;
  private readonly slowQueryThresholdMs: number;

  constructor(private readonly poolConfig: DatabasePoolConfig) {
    this.serviceName = poolConfig.applicationName;
    this.slowQueryThresholdMs = poolConfig.slowQueryThresholdMs;
  }

  record(event: Prisma.QueryEvent): void {
    const classification = classifyQuery(event.query);

    if (this.poolConfig.queryMetricsEnabled) {
      this.recordMetrics(classification.operation, classification.model, event.duration);
    }

    if (this.shouldTrace()) {
      void this.exportTrace(event, classification);
    }
  }

  snapshot(): DatabaseQueryTelemetrySnapshot {
    return {
      buckets: queryBuckets,
      metrics: Array.from(this.metrics.values()).map((metric) => ({
        labels: { ...metric.labels },
        buckets: new Map(metric.buckets),
        count: metric.count,
        sumSeconds: metric.sumSeconds,
        maxSeconds: metric.maxSeconds,
        slowCount: metric.slowCount,
      })),
      slowQueryThresholdSeconds: this.slowQueryThresholdMs / 1000,
      tracingEnabled: this.poolConfig.queryTracingEnabled,
    };
  }

  private recordMetrics(operation: string, model: string, durationMs: number): void {
    const labels = { service: this.serviceName, operation, model };
    const key = `${operation}:${model}`;
    const metric =
      this.metrics.get(key) ??
      ({
        labels,
        buckets: new Map(queryBuckets.map((bucket) => [bucket, 0])),
        count: 0,
        sumSeconds: 0,
        maxSeconds: 0,
        slowCount: 0,
      } satisfies DatabaseQueryMetric);

    const durationSeconds = durationMs / 1000;
    for (const bucket of queryBuckets) {
      if (durationSeconds <= bucket) {
        metric.buckets.set(bucket, (metric.buckets.get(bucket) ?? 0) + 1);
      }
    }

    metric.count += 1;
    metric.sumSeconds += durationSeconds;
    metric.maxSeconds = Math.max(metric.maxSeconds, durationSeconds);
    if (durationMs >= this.slowQueryThresholdMs) {
      metric.slowCount += 1;
    }

    this.metrics.set(key, metric);
  }

  private shouldTrace(): boolean {
    return (
      this.poolConfig.queryTracingEnabled &&
      this.poolConfig.traceSampleRate > 0 &&
      Math.random() <= this.poolConfig.traceSampleRate
    );
  }

  private async exportTrace(
    event: Prisma.QueryEvent,
    classification: { operation: string; model: string },
  ): Promise<void> {
    const endTimeUnixNano = BigInt(Date.now()) * 1_000_000n;
    const startTimeUnixNano = endTimeUnixNano - BigInt(Math.max(event.duration, 0)) * 1_000_000n;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_500);

    try {
      await fetch(this.poolConfig.otlpTracesEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resourceSpans: [
            {
              resource: {
                attributes: [
                  stringAttribute('service.name', this.poolConfig.otelServiceName),
                  stringAttribute('deployment.environment', process.env.NODE_ENV ?? 'development'),
                ],
              },
              scopeSpans: [
                {
                  scope: {
                    name: 'codeguard.analysis-service.prisma',
                    version: '1.0.0',
                  },
                  spans: [
                    {
                      traceId: randomHex(16),
                      spanId: randomHex(8),
                      name: `db.query ${classification.operation}`,
                      kind: 3,
                      startTimeUnixNano: startTimeUnixNano.toString(),
                      endTimeUnixNano: endTimeUnixNano.toString(),
                      attributes: [
                        stringAttribute('db.system.name', 'postgresql'),
                        stringAttribute('db.operation.name', classification.operation),
                        stringAttribute('db.collection.name', classification.model),
                        stringAttribute('db.query.summary', sanitizeQuerySummary(event.query)),
                        intAttribute('db.query.duration_ms', event.duration),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch {
      // Tracing must never affect request handling or worker callbacks.
    } finally {
      clearTimeout(timeout);
    }
  }
}

function classifyQuery(query: string): { operation: string; model: string } {
  const compactQuery = query.replace(/\s+/g, ' ').trim();
  const operation = compactQuery.split(' ')[0]?.toUpperCase() || 'UNKNOWN';
  const model =
    matchModel(compactQuery, /FROM\s+"?(?:public"\.)?"?([A-Za-z0-9_]+)"?/i) ??
    matchModel(compactQuery, /INTO\s+"?(?:public"\.)?"?([A-Za-z0-9_]+)"?/i) ??
    matchModel(compactQuery, /UPDATE\s+"?(?:public"\.)?"?([A-Za-z0-9_]+)"?/i) ??
    'raw';

  return { operation, model };
}

function matchModel(query: string, pattern: RegExp): string | null {
  return query.match(pattern)?.[1] ?? null;
}

function sanitizeQuerySummary(query: string): string {
  return query.replace(/\s+/g, ' ').replace(/\$\d+/g, '?').slice(0, 240);
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function stringAttribute(key: string, value: string) {
  return { key, value: { stringValue: value } };
}

function intAttribute(key: string, value: number) {
  return { key, value: { intValue: Math.round(value) } };
}
