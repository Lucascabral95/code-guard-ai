# Observability

CodeGuard AI ships with an optional local observability stack based on Prometheus, Grafana and Loki.

## Run

```bash
make up
make up-observability
```

URLs:

- Grafana: `http://localhost:3003`
- Prometheus: `http://localhost:9090`
- Loki: `http://localhost:3100`
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

## Logs

Promtail reads Docker container logs and ships them to Loki with service labels. On Docker Desktop, access to `/var/lib/docker/containers` may depend on the local Docker backend permissions.

`node-exporter` is configured as an optional Linux-only profile (`linux-host`) because Docker Desktop on Windows/macOS typically does not support the required mount propagation for that container.

## Stop

```bash
make down-observability
```
