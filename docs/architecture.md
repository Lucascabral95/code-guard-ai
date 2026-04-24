# Architecture

CodeGuard AI is split into a public edge, a private analysis core and a language-agnostic worker.

The frontend only talks to `api-gateway`. The gateway validates public requests, applies rate limiting and forwards analysis operations to `analysis-service`. The analysis service owns persistence, status transitions, scoring, report generation and Redis Stream publication. The Go worker consumes `analysis.jobs`, clones public GitHub repositories, runs safe analysis and posts results back to protected internal endpoints.

The gateway intentionally contains no analysis logic. The worker intentionally does not write to PostgreSQL directly. This keeps service boundaries clear and makes the queue contract portable across languages.
