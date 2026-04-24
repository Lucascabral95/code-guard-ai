# Security

Repository analysis is security-sensitive because public repositories can contain arbitrary install scripts, test scripts and build hooks.

This project defaults to `SAFE_ANALYSIS_MODE=true`. In that mode the worker clones a public GitHub repository and inspects files, but does not run dependency installation, tests, linters or audit commands from the repository.

The worker also does not mount the Docker socket by default. Real command execution must run through a constrained sandbox with CPU, memory, network, filesystem and timeout limits. The `DockerExecutor` exists as an integration point for that future mode.

Internal result endpoints require `x-internal-secret`. The provided default secret is only for local development and must be replaced outside local environments.
