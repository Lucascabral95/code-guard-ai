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
- `GET /health/ready`
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
- `DATABASE_DIRECT_URL`
- `DB_POOL_CONNECTION_LIMIT` (default `10`)
- `DB_POOL_TIMEOUT_SECONDS` (default `10`)
- `DB_CONNECT_TIMEOUT_SECONDS` (default `10`)
- `DB_APPLICATION_NAME` (default `codeguard-analysis-service`)
- `DB_PGBOUNCER` (default `false`)
- `DB_QUERY_LOGGING` (default `false`)
- `DB_QUERY_METRICS_ENABLED` (default `true`)
- `DB_SLOW_QUERY_THRESHOLD_MS` (default `250`)
- `DB_QUERY_TRACING_ENABLED` (default `false`)
- `DB_QUERY_TRACE_SAMPLE_RATE` (default `1`)
- `OTEL_ENABLED` (default `false`)
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
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

## Pool PostgreSQL

El servicio usa un unico `PrismaService` global dentro de NestJS. Ese singleton controla el pool interno de Prisma y evita crear clientes por request.

La URL final de conexion se normaliza al iniciar el servicio con parametros explicitos:

- `connection_limit`: maximo de conexiones del pool Prisma.
- `pool_timeout`: tiempo maximo esperando una conexion libre.
- `connect_timeout`: tiempo maximo de conexion inicial.
- `application_name`: nombre visible en PostgreSQL para `pg_stat_activity`.
- `pgbouncer`: compatibilidad opcional si se usa PgBouncer delante de PostgreSQL.

En Docker, el runtime usa `DATABASE_URL` apuntando a PgBouncer y Prisma Migrate usa `DATABASE_DIRECT_URL` apuntando directo a PostgreSQL. Esto evita problemas de migraciones con transaction pooling.

Endpoints y metricas:

- `GET /health`: liveness liviano, no toca DB.
- `GET /health/ready`: valida `SELECT 1`, devuelve latencia y configuracion sanitizada del pool.
- `GET /metrics`: expone `codeguard_database_pool_connection_limit`, `codeguard_database_pool_timeout_seconds`, `codeguard_database_connect_timeout_seconds`, `codeguard_database_query_duration_seconds` y `codeguard_database_slow_queries_total`.
- OpenTelemetry: si `OTEL_ENABLED=true` y `DB_QUERY_TRACING_ENABLED=true`, cada query muestreada exporta una traza OTLP HTTP hacia `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`.

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
