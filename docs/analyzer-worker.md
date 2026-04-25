# Analyzer Worker Guide

This document describes the Go worker located at `apps/analyzer-worker`.

## Why This Service Exists

The worker isolates asynchronous repository processing from API request handling. It consumes queue jobs and posts normalized evidence back to `analysis-service`.

This keeps API latency low and avoids running repository logic in frontend/gateway paths.

## Service Boundaries

Inputs:

- Redis Stream jobs from `scan.jobs`.
- Repository data from public GitHub URLs.
- Runtime configuration from environment variables.

Outputs:

- Internal HTTP callbacks to `analysis-service`.
- Structured findings, logs, tool runs, components, artifacts and license risks.
- Redis message acknowledgements.

Non-goals:

- No public HTTP endpoints.
- No Swagger/OpenAPI requirement.
- No direct persistence in PostgreSQL.

## Processing Pipeline

1. `main.go` loads config and validates `INTERNAL_SECRET`.
2. Redis consumer group is created (idempotent) if missing.
3. Worker reads one message per cycle (`Count=1`) with blocking read.
4. Message payload is parsed to `AnalysisJob`.
5. Worker marks scan as running via internal API.
6. Repository is cloned with timeout and branch fallback.
7. Stack is detected.
8. Safe analyzer or Docker sandbox executor runs.
9. Worker posts result or failure callback.
10. Worker acknowledges the message when processing is finalized.

## Queue Contract

Stream name default: `scan.jobs` (`ANALYSIS_STREAM_NAME`)

Required payload fields:

- `analysisId`
- `repoUrl`

Optional payload fields:

- `scanId`
- `branch` (defaults to `main`)
- `safeMode`

## Internal API Contract

The worker calls:

- `POST /internal/analyses/:id/start`
- `POST /internal/analyses/:id/result`
- `POST /internal/analyses/:id/fail`

All internal calls include:

- `content-type: application/json`
- `x-internal-secret: <INTERNAL_SECRET>`

## Safe Mode Guarantees

With `SAFE_ANALYSIS_MODE=true`:

- No `npm install`, `npm test`, `npm run lint`, repository scripts or hooks.
- No host execution of untrusted project code.
- Analysis is file-inspection based and deterministic for the same repository state.

## Sandbox Mode

With `SAFE_ANALYSIS_MODE=false`, the worker routes execution through the Docker sandbox executor interface.

Current status:

- `DockerExecutor` is intentionally defined but returns `not implemented yet`.
- This preserves architecture without enabling unsafe host execution.

## Reliability Notes

Message ACK policy is designed for at-least-once delivery:

- Invalid payload -> ACK.
- Start callback failure -> do not ACK.
- Result callback failure -> do not ACK.
- Failure callback success -> ACK.
- Failure callback failure -> do not ACK.

Operational implication:

- Persistent callback failures can accumulate pending messages and require intervention.

## Security Controls

- Repository URL allowlist: only `https://github.com/<owner>/<repo>`.
- Clone timeout: `CLONE_TIMEOUT_SECONDS` (default 60s).
- Temporary clone cleanup on every run path.
- Internal secret required for callback authorization.
- Safe mode default enabled.

## Configuration Reference

| Variable                | Default                 |
| ----------------------- | ----------------------- |
| `REDIS_ADDR`            | `localhost:6379`        |
| `ANALYSIS_SERVICE_URL`  | `http://localhost:3002` |
| `INTERNAL_SECRET`       | empty (required)        |
| `WORKER_CONSUMER_NAME`  | `worker-1`              |
| `WORKER_CONSUMER_GROUP` | `codeguard-workers`     |
| `ANALYSIS_STREAM_NAME`  | `scan.jobs`             |
| `SAFE_ANALYSIS_MODE`    | `true`                  |
| `SANDBOX_ANALYSIS_MODE` | `docker`                |
| `TEMP_DIR`              | `/tmp/codeguard`        |
| `CLONE_TIMEOUT_SECONDS` | `60`                    |

## Runbook

Build and test:

```bash
go test ./apps/analyzer-worker/...
go vet ./apps/analyzer-worker/...
go build ./apps/analyzer-worker/cmd/worker
```

Run standalone:

```bash
cd apps/analyzer-worker
go run ./cmd/worker
```

Run in Compose stack:

```bash
make up
```

## Common Incidents

- Startup exits because `INTERNAL_SECRET` is missing.
- Redis connectivity issues (`REDIS_ADDR` mismatch).
- Callback failures due to wrong `ANALYSIS_SERVICE_URL` or secret mismatch.
- Pending messages caused by repeated callback errors.
- Clone failures from invalid URL format or inaccessible repository/branch.
