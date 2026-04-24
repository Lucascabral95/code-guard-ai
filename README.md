# CodeGuard AI

Automated Code Review & Verification Platform for public GitHub repositories.

CodeGuard AI receives a repository URL, creates an asynchronous analysis, publishes a Redis Streams job, processes it with a Go worker and stores technical findings, logs, summaries and risk scores in PostgreSQL.

## Architecture

```text
Next.js Dashboard
      ↓
API Gateway
      ↓
Analysis Service
      ↓
Redis Streams
      ↓
Go Analyzer Worker
      ↓
GitHub Repo / Safe Analyzer
      ↓
Analysis Service
      ↓
PostgreSQL
```

## Stack

- Frontend: Next.js, TypeScript, Tailwind, Axios, TanStack Query, React Hook Form, Zod.
- API Gateway: NestJS, class-validator, throttling, HTTP facade.
- Analysis Service: NestJS, Prisma, PostgreSQL, Redis Streams, rule-based summaries.
- Worker: Go, Redis Streams consumer groups, safe repository analysis.
- Infrastructure: Docker Compose, Makefile, PostgreSQL, Redis.

## Local Development

```bash
cp .env.example .env
make install
make up
make db-migrate
```

Open `http://localhost:3000` and create an analysis for a public repository such as:

```text
https://github.com/vercel/next.js
```

## Main Services

- `web`: public dashboard on `http://localhost:3000`.
- `api-gateway`: public REST API on `http://localhost:3001`.
- `analysis-service`: internal analysis API on `http://localhost:3002`.
- `analyzer-worker`: Go worker consuming Redis Streams.
- `postgres`: database on port `5432`.
- `redis`: Redis on port `6379`.

## API

Public gateway:

- `GET /health`
- `POST /analyses`
- `GET /analyses`
- `GET /analyses/:id`

Worker-only internal endpoints on `analysis-service`:

- `POST /internal/analyses/:id/start`
- `POST /internal/analyses/:id/result`
- `POST /internal/analyses/:id/fail`

Internal endpoints require `x-internal-secret`.

## Safe Mode

`SAFE_ANALYSIS_MODE=true` is the default. In safe mode the worker may clone a public repository and inspect files, but it does not run dependency installation, tests, linters or repository code on the host.

When `SAFE_ANALYSIS_MODE=false`, the architecture routes execution through a Docker sandbox executor. That executor is intentionally structured but not enabled as a host execution shortcut.

## AI

AI summaries are optional. The default provider is rule-based and does not call paid APIs. Ollama can be wired through `OLLAMA_ENABLED=true` and `OLLAMA_BASE_URL`, but it is disabled by default.

## Security Notes

Running arbitrary repository code is dangerous. This base avoids direct host execution by default, does not mount the Docker socket into the worker and keeps the internal worker API protected by a shared internal secret for local development.

## AWS Direction

The intended cloud path is ECS Fargate:

- Public web and gateway behind an ALB.
- Private analysis-service and worker tasks.
- RDS PostgreSQL.
- Managed Redis-compatible service or ElastiCache Redis.
- CloudWatch logs and future Prometheus/Grafana integration.
- Terraform under `infra/terraform`.

## Roadmap

- Docker sandbox execution for real `npm install`, `npm test`, lint and audit.
- Semgrep integration.
- GitHub OAuth and GitHub App support.
- Pull request comments.
- Ollama-backed optional summaries.
- Prometheus/Grafana dashboards.
- ECS Fargate Terraform modules.
