# Security

Repository analysis is security-sensitive because public repositories can contain malicious install scripts, test hooks, build hooks, binaries and dependency lifecycle scripts.

CodeGuard AI defaults to `SAFE_ANALYSIS_MODE=true`. In that mode the worker clones a public GitHub repository and inspects files, but it does not run dependency installation, tests, linters, audit commands or project code.

The worker also does not mount the Docker socket by default. Real command execution must run through a constrained sandbox with CPU, memory, network, filesystem and timeout limits. `SANDBOX_ANALYSIS_MODE=docker` is the configured direction, and the `DockerExecutor` is the extension point.

Internal result endpoints require `x-internal-secret`. The provided default secret is only for local development and must be replaced outside local environments.

Security controls already present:

- Only `https://github.com/<owner>/<repo>` URLs are accepted.
- Git clone runs with a timeout.
- Temporary repository directories are cleaned after each job.
- Worker results are posted through internal authenticated endpoints.
- Findings store evidence and remediation separately from raw tool data.
- AI is optional and must summarize existing evidence instead of inventing findings.

Security controls still planned:

- Real container sandbox limits.
- Network egress policy for scanners.
- Artifact storage isolation.
- Workspace users, roles and API keys.
- Policy engine for accepted risk, false positives and expiration.
- OpenTelemetry audit correlation.
