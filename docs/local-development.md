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

Useful commands:

- `make logs`
- `make test`
- `make lint`
- `make build`
- `make down`
- `make reset`

For split local development, run `make dev` and start each service in a separate terminal.
