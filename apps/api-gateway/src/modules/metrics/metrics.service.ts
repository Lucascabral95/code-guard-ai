import { Injectable } from '@nestjs/common';

type LabelSet = Record<string, string>;

const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class MetricsService {
  private readonly serviceName = 'api-gateway';
  private readonly httpRequests = new Map<string, { labels: LabelSet; value: number }>();
  private readonly httpDuration = new Map<
    string,
    { labels: LabelSet; buckets: Map<number, number>; count: number; sum: number }
  >();
  private readonly upstreamFailures = new Map<string, { labels: LabelSet; value: number }>();

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

  recordUpstreamFailure(upstream: string, operation: string) {
    this.increment(this.upstreamFailures, {
      service: this.serviceName,
      upstream,
      operation,
    });
  }

  render(): string {
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
      '# HELP gateway_upstream_failures_total Upstream request failures from the gateway.',
      '# TYPE gateway_upstream_failures_total counter',
    );
    for (const metric of this.upstreamFailures.values()) {
      lines.push(`gateway_upstream_failures_total{${formatLabels(metric.labels)}} ${metric.value}`);
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
