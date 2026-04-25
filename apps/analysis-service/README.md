# Analysis Service (`apps/analysis-service`)

Servicio central de negocio y persistencia de CodeGuard AI.

## Responsabilidad

- Persistir entidades en PostgreSQL (Prisma).
- Crear análisis/scans y publicarlos a Redis Streams.
- Recibir callbacks internos del worker.
- Guardar findings, logs, artifacts, components y license risks.
- Calcular score/risk y generar resumen.
- Exponer documentación OpenAPI (`/docs`).

## Endpoints principales

Public/internal app endpoints:

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

Worker callbacks (protegidos por `x-internal-secret`):

- `POST /internal/analyses/:id/start`
- `POST /internal/analyses/:id/result`
- `POST /internal/analyses/:id/fail`

Swagger:

- `GET /docs`
- `GET /docs-json`

## Variables de entorno

- `PORT` (default `3002`)
- `ANALYSIS_SERVICE_PORT` (fallback, default `3002`)
- `DATABASE_URL`
- `REDIS_ADDR` (default `localhost:6379`)
- `ANALYSIS_STREAM_NAME` (default `scan.jobs`)
- `INTERNAL_SECRET` (requerido para endpoints internos)
- `SAFE_ANALYSIS_MODE` (default `true`)
- `OLLAMA_ENABLED` (default `false`)
- `OLLAMA_BASE_URL` (default `http://localhost:11434`)
- `SWAGGER_ENABLED` (default `true`)

## Prisma

- Generar cliente: `npm --workspace @codeguard/analysis-service run prisma:generate`
- Migrar local: `npm --workspace @codeguard/analysis-service run db:migrate`
- Aplicar migraciones: `npm --workspace @codeguard/analysis-service run db:deploy`
- Studio: `npm --workspace @codeguard/analysis-service run db:studio`

## Scripts

- `npm --workspace @codeguard/analysis-service run start:dev`
- `npm --workspace @codeguard/analysis-service run build`
- `npm --workspace @codeguard/analysis-service run lint`
- `npm --workspace @codeguard/analysis-service run test`

## Errores comunes

- `@prisma/client not found`: ejecutar `prisma:generate`.
- Error de conexión a DB: validar `DATABASE_URL` y estado de PostgreSQL.
- Worker no puede actualizar estado: revisar `INTERNAL_SECRET`.
- No se publican jobs: revisar `REDIS_ADDR` y `ANALYSIS_STREAM_NAME`.
