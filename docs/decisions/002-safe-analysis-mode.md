# ADR 002: Safe Analysis Mode

Safe mode is enabled by default through `SAFE_ANALYSIS_MODE=true`.

The worker may clone public repositories and inspect static files, but it does not execute repository-controlled commands on the host. This protects local machines and CI runners from install scripts, test scripts and other untrusted code paths.

Real execution must go through a sandbox executor. `SANDBOX_ANALYSIS_MODE=docker` is the default direction, but the Docker socket is not mounted by default and host execution is intentionally not used as a fallback.
