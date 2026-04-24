# Local Development

Required tools:

- Node.js 20+
- npm 10+
- Go 1.25+
- Docker and Docker Compose
- GNU Make

Run:

```bash
cp .env.example .env
make install
make up
make db-migrate
```

Open `http://localhost:3000`.

The first screen is the enterprise portfolio dashboard. Use `New Scan` to submit a public GitHub repository. The scan will be queued on `scan.jobs`, consumed by the Go worker and shown in the project and scan detail pages.

Useful commands:

- `make logs`
- `make test`
- `make lint`
- `make build`
- `make down`
- `make reset`

For split local development, run `make dev` and start each service in a separate terminal.

If Go commands hit Windows cache permission issues, use the Makefile targets. They set a local Go cache under `.go-cache`.
