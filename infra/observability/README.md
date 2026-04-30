# Observability

CodeGuard AI ships with an optional local observability stack based on Prometheus, Grafana, Loki, Tempo and OpenTelemetry Collector.

## Run

```bash
make up
make up-observability
```

URLs:

- Grafana: `http://localhost:3003`
- Prometheus: `http://localhost:9090`
- Loki: `http://localhost:3100`
- Tempo: `http://localhost:3200`
- OpenTelemetry Collector OTLP HTTP: `http://localhost:4318`
- Worker metrics: `http://localhost:9101/metrics`
- API Gateway metrics: `http://localhost:3001/metrics`
- Analysis Service metrics: `http://localhost:3002/metrics`

Default Grafana credentials:

- user: `admin`
- password: `admin`

## Dashboard

Grafana provisions `CodeGuard AI Operations Overview` automatically from:

- `infra/observability/grafana/dashboards/codeguard-overview.json`

The dashboard includes:

- HTTP request rate
- HTTP error rate
- HTTP p95 latency
- HTTP p99 latency
- gateway upstream failures
- scan lifecycle
- worker job throughput
- worker stage p95 duration
- scanner failures and timeouts
- findings by severity
- Redis Stream health
- container CPU and memory
- Prisma/PostgreSQL pool configuration
- Prisma slow query and query latency metrics

## Traces

When `make up-observability` is used, `analysis-service` enables Prisma query tracing and exports OTLP HTTP spans to OpenTelemetry Collector, which forwards them to Tempo. Grafana provisions a `Tempo` datasource automatically.

Query span attributes intentionally avoid raw query parameters. The trace includes operation, model/table classification, duration and a sanitized query summary.

## Alerts

Prometheus loads database alert rules from:

- `infra/observability/prometheus/rules/codeguard-db-alerts.yml`

Current database alerts:

- slow Prisma queries above `DB_SLOW_QUERY_THRESHOLD_MS`
- DB query p95 latency above 500ms
- PostgreSQL connection saturation above 80%
- Prisma pool timeout configured below 5 seconds

## Logs

Promtail reads Docker container logs and ships them to Loki with service labels. On Docker Desktop, access to `/var/lib/docker/containers` may depend on the local Docker backend permissions.

`node-exporter` is configured as an optional Linux-only profile (`linux-host`) because Docker Desktop on Windows/macOS typically does not support the required mount propagation for that container.

## Stop

```bash
make down-observability
```
