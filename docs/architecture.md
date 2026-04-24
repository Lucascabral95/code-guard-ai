# Architecture

CodeGuard AI is split into a public edge, a private analysis core and a language-agnostic worker.

The frontend only talks to `api-gateway`. The gateway validates public requests, applies rate limiting and forwards operations to `analysis-service`. The analysis service owns persistence, project/scan lifecycle, status transitions, scoring, artifacts, reports and Redis Stream publication. The Go worker consumes `scan.jobs`, clones public GitHub repositories, runs safe analyzers and posts normalized results back through protected internal endpoints.

## Service Boundaries

- `web`: product UI, portfolio dashboard, scan detail, findings, tool runs, SBOM inventory and remediation actions.
- `api-gateway`: public REST facade and validation. It contains no analysis logic.
- `analysis-service`: source of truth for workspaces, projects, scans, findings, artifacts, policies and risk snapshots.
- `analyzer-worker`: queue consumer and repository analyzer. It never writes to PostgreSQL directly.
- `postgres`: durable state.
- `redis`: stream-based job transport.

## Queue Contract

- Stream: `scan.jobs`
- Consumer group: `codeguard-workers`
- Payload: `analysisId`, `scanId`, `repoUrl`, `branch`, `safeMode`

Redis Streams are used instead of framework-specific queues so the worker can stay in Go and future workers can be written in any language.

## Scan Stages

The current safe analyzer implements these stages without executing repository code:

1. clone
2. detect
3. node-quality
4. dependency inventory
5. secret heuristics
6. Docker/IaC heuristics
7. scorecard-style posture checks
8. normalize
9. risk scoring
10. report generation

Real engines such as Semgrep, Trivy, OSV Scanner and OpenSSF Scorecard should run only through the sandbox executor.
