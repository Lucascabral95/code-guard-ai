# Analyzer Worker (Go)

`apps/analyzer-worker` is the asynchronous scan worker for CodeGuard AI.

It consumes jobs from Redis Streams, clones public GitHub repositories, runs safe analysis by default, and sends normalized results back to the Analysis Service.

## Scope

The worker is responsible for:

- Consuming `scan.jobs` with Redis consumer groups.
- Validating and cloning `https://github.com/<owner>/<repo>` repositories.
- Detecting stack (`node`, `go`, `python`, `unknown`).
- Running safe analysis when `SAFE_ANALYSIS_MODE=true`.
- Sending lifecycle callbacks and results to `analysis-service`.
- Acknowledging Redis messages only when processing can be finalized.
- Cleaning temporary clone directories.

The worker is not responsible for:

- Public API exposure.
- Dashboard or user-facing routes.
- Risk scoring persistence (done by `analysis-service`).
- Swagger endpoints (worker is not an HTTP API service).

## Runtime Flow

1. Read one message from Redis Stream `scan.jobs` under consumer group `codeguard-workers`.
2. Parse message fields into `AnalysisJob`.
3. Call `POST /internal/analyses/:id/start`.
4. Clone repository with timeout and branch fallback.
5. Run analyzer:
   `SAFE_ANALYSIS_MODE=true`: safe file-based analysis.
   `SAFE_ANALYSIS_MODE=false`: Docker sandbox executor entrypoint (currently placeholder).
6. Call `POST /internal/analyses/:id/result` or `POST /internal/analyses/:id/fail`.
7. `XACK` message when completion/failure has been persisted.

## Redis Job Contract

Stream: `scan.jobs`

Expected fields:

```json
{
  "analysisId": "uuid",
  "scanId": "uuid-optional",
  "repoUrl": "https://github.com/owner/repo",
  "branch": "main",
  "safeMode": true
}
```

Validation rules:

- `analysisId` is required.
- `repoUrl` is required.
- `branch` defaults to `main` if missing.
- Non-parseable `safeMode` becomes `false`.

## HTTP Callbacks To Analysis Service

All internal calls use header `x-internal-secret`.

- `POST /internal/analyses/:id/start`
- `POST /internal/analyses/:id/result`
- `POST /internal/analyses/:id/fail`

## Environment Variables

| Variable                | Default                 | Description                                    |
| ----------------------- | ----------------------- | ---------------------------------------------- |
| `REDIS_ADDR`            | `localhost:6379`        | Redis address.                                 |
| `ANALYSIS_SERVICE_URL`  | `http://localhost:3002` | Base URL for internal callbacks.               |
| `INTERNAL_SECRET`       | empty                   | Required shared secret for internal endpoints. |
| `WORKER_CONSUMER_NAME`  | `worker-1`              | Redis consumer name.                           |
| `WORKER_CONSUMER_GROUP` | `codeguard-workers`     | Redis consumer group.                          |
| `ANALYSIS_STREAM_NAME`  | `scan.jobs`             | Redis Stream name.                             |
| `SAFE_ANALYSIS_MODE`    | `true`                  | Safe mode default.                             |
| `SANDBOX_ANALYSIS_MODE` | `docker`                | Sandbox strategy selector.                     |
| `TEMP_DIR`              | `/tmp/codeguard`        | Temporary clone root.                          |
| `CLONE_TIMEOUT_SECONDS` | `60`                    | Clone timeout in seconds.                      |

## Safe Analysis Mode

When `SAFE_ANALYSIS_MODE=true`, the worker does not execute repository code, install hooks, tests or scripts. It only inspects files and emits normalized findings/tool-runs/artifacts/components/license-risk signals.

Current safe analyzers include:

- Stack detection and Node project posture.
- Lockfile and dependency hygiene checks.
- TypeScript strictness check.
- Secret-like keyword heuristics.
- Dockerfile/Compose posture heuristics.
- Basic scorecard-style repository signals (`.github/workflows`, `SECURITY.md`).

## Error Handling And ACK Policy

- Invalid Redis payload: log + ACK.
- `markStarted` fails: no ACK (message can be retried).
- Analysis fails and fail callback succeeds: ACK.
- Analysis fails and fail callback fails: no ACK.
- Result callback fails: no ACK.

This preserves at-least-once delivery behavior for critical failures.

## Security Model

- Only `https://github.com/*` repositories are allowed.
- Clone uses command timeout.
- Temporary clone directories are removed after processing.
- Internal callbacks require `x-internal-secret`.
- No Docker socket requirement in safe mode.
- `SAFE_ANALYSIS_MODE=true` is default and recommended for local/dev.

## Local Development

From monorepo root:

```bash
go test ./apps/analyzer-worker/...
go vet ./apps/analyzer-worker/...
go build ./apps/analyzer-worker/cmd/worker
```

Run directly:

```bash
cd apps/analyzer-worker
go run ./cmd/worker
```

Run with Docker Compose:

```bash
make up
```

## Troubleshooting

- Worker exits immediately with `INTERNAL_SECRET must be configured`:
  Set `INTERNAL_SECRET` in `.env`.
- Messages stay pending in Redis:
  Check connectivity to `analysis-service` and internal secret mismatch.
- Clone failures:
  Validate repository URL, branch name and network access.
- Result not persisted:
  Inspect logs for callback status failures from `analysis_client`.
