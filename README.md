# CodeGuard AI

Self-hosted AppSec and Supply Chain Security platform for public GitHub repositories.

CodeGuard AI creates asynchronous scans, publishes Redis Streams jobs, processes repositories with a Go worker and stores normalized security evidence in PostgreSQL. The default mode is safe: repositories are cloned and inspected, but their code, install scripts and tests are not executed on the host.

## Architecture

```text
Next.js Dashboard
      ->
API Gateway
      ->
Analysis Service
      ->
Redis Streams
      ->
Go Analyzer Worker
      ->
GitHub Repo / Safe Analyzer
      ->
Analysis Service
      ->
PostgreSQL
```

## Stack

- Frontend: Next.js App Router, TypeScript, Tailwind, Axios, TanStack Query, React Hook Form, Zod.
- API Gateway: NestJS, validation, throttling and HTTP facade.
- Analysis Service: NestJS, Prisma, PostgreSQL, Redis Streams, risk scoring and report generation.
- Worker: Go, Redis Streams consumer groups, Git clone with timeout, safe analyzers and Docker sandbox extension point.
- Infra: Docker Compose, Makefile, PostgreSQL, Redis, docs and Terraform/observability placeholders.

## Enterprise Model

The data model now supports portfolio-level security:

- `Workspace`, `Project`, `Repository`, `Scan`
- `ToolRun`, `Finding`, `Evidence`, `Remediation`
- `Component`, `Vulnerability`, `LicenseRisk`
- `Policy`, `RiskSnapshot`, `Artifact`, `AuditLog`

Findings are normalized with fingerprint, category, severity, status, confidence, optional CWE/CVE/CVSS/EPSS, evidence and remediation. Scans can store normalized JSON, raw tool output, CycloneDX SBOM and Markdown report artifacts.

## Local Development

```bash
cp .env.example .env
make install
make up
make db-migrate
```

Open `http://localhost:3000` and create a scan for a public repository, for example:

```text
https://github.com/vercel/next.js
```

## Services

- `web`: dashboard on `http://localhost:3000`.
- `api-gateway`: public REST API on `http://localhost:3001`.
- `analysis-service`: internal analysis API on `http://localhost:3002`.
- `analyzer-worker`: Go worker consuming Redis Stream `scan.jobs`.
- `postgres`: PostgreSQL on port `5432`.
- `redis`: Redis on port `6379`.

## Public API

Gateway endpoints:

- `GET /health`
- `POST /analyses`
- `GET /analyses`
- `GET /analyses/:id`
- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `POST /projects/:id/scans`
- `GET /scans/:id`
- `GET /scans/:id/findings`
- `GET /scans/:id/artifacts`
- `GET /scans/:id/sbom`
- `GET /scans/:id/report`
- `POST /findings/:id/status`
- `GET /dashboard/portfolio-risk`

Worker-only endpoints on `analysis-service`:

- `POST /internal/analyses/:id/start`
- `POST /internal/analyses/:id/result`
- `POST /internal/analyses/:id/fail`

Internal endpoints require `x-internal-secret`.

## Scan Flow

1. The dashboard submits a GitHub repository URL to the API Gateway.
2. The gateway validates the request and forwards it to the Analysis Service.
3. The Analysis Service creates project/repository/scan records and publishes a `scan.jobs` message.
4. The Go worker consumes the job, clones the repository with a timeout and detects the stack.
5. Safe analyzers inspect manifests, lockfiles, TypeScript config, Docker/IaC hints, secrets heuristics and repository posture.
6. The worker posts normalized findings, tool runs, components, license risks and artifacts.
7. The Analysis Service calculates score, stores snapshots and generates a rule-based summary.
8. The dashboard shows portfolio risk, scan detail, SBOM inventory, tool runs, findings and remediation actions.

## Safe Mode

`SAFE_ANALYSIS_MODE=true` is the default. In safe mode the worker does not run `npm install`, tests, linters, audit commands or repository scripts. It only clones and inspects files.

`SANDBOX_ANALYSIS_MODE=docker` is reserved for real scanner execution. When `SAFE_ANALYSIS_MODE=false`, execution must go through a sandbox executor. The Docker socket is not mounted by default.

## Future Real Engines

The worker is structured for plugins that can be added behind the sandbox boundary:

- Semgrep CE for SAST and SARIF.
- Trivy for vulnerabilities, secrets, licenses, misconfigurations and CycloneDX SBOM.
- OSV Scanner for lockfile vulnerability checks and fixed versions.
- OpenSSF Scorecard for repository security posture.
- Node quality rules for package manager, lockfile drift, scripts, engines, TypeScript and CI posture.

## AI

AI is optional. The default provider is rule-based and does not call paid APIs. Ollama can be enabled with `OLLAMA_ENABLED=true`, but summaries must only use evidence already detected by scanners.

## Security Notes

Running arbitrary repository code is dangerous. This base avoids direct host execution by default, does not mount the Docker socket into the worker and protects internal result endpoints with a local-development secret. Replace `INTERNAL_SECRET` outside local development.

## AWS Direction

The intended production path is ECS Fargate:

- Public web and gateway behind an ALB.
- Private analysis-service and worker tasks.
- RDS PostgreSQL.
- ElastiCache Redis or another Redis-compatible service.
- S3-compatible artifact storage.
- OpenTelemetry, CloudWatch and future Prometheus/Grafana integration.
- Terraform modules under `infra/terraform`.

## Roadmap

- Real Docker sandbox execution.
- Semgrep, Trivy, OSV and OpenSSF Scorecard plugins.
- Policy engine with blocking rules and audit trail.
- GitHub App, PR comments, status checks and SARIF upload.
- Authentication, workspaces, roles and API keys.
- PDF export and scheduled scans.
