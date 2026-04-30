<p align="center">
  <img src="https://go.dev/blog/go-brand/Go-Logo/SVG/Go-Logo_Blue.svg"
       alt="CodeGuard AI"
       width="220"/>
</p>

<h1 align="center">CodeGuard AI: Automated Code Review & Verification Platform</h1>

<p align="center">
  Plataforma self-hosted para analizar repositorios publicos de GitHub con arquitectura de microservicios:
  frontend Next.js, gateway NestJS, core de analisis NestJS, cola Redis Streams y worker Go en modo seguro por defecto.
</p>

---

## Table of contents

- [Descripcion general](#descripcion-general)
- [Caracteristicas principales](#caracteristicas-principales)
- [Estado actual del sistema](#estado-actual-del-sistema)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Catalogo de microservicios](#catalogo-de-microservicios)
- [Analisis de repositorios](#analisis-de-repositorios)
- [Reportes y visualizaciones](#reportes-y-visualizaciones)
- [API publica del gateway](#api-publica-del-gateway)
- [Swagger / API Docs](#swagger--api-docs)
- [Observabilidad](#observabilidad)
- [Testing y calidad](#testing-y-calidad)
- [Guia de instalacion y ejecucion local](#guia-de-instalacion-y-ejecucion-local)
- [Infraestructura y despliegue AWS](#infraestructura-y-despliegue-aws)
- [Variables de entorno](#variables-de-entorno)
- [Datos de prueba](#datos-de-prueba)
- [Documentacion tecnica](#documentacion-tecnica)
- [Roadmap](#roadmap)

## Descripcion general

**CodeGuard AI** es una plataforma DevSecOps para escanear repositorios publicos de GitHub y generar evidencia tecnica util:
findings normalizados, score de riesgo, resumen tecnico, artifacts y trazabilidad de ejecucion.

El cliente solo conversa con `api-gateway`. El gateway valida y enruta. El `analysis-service` persiste estado, publica jobs y
consolida resultados. El `analyzer-worker` en Go consume Redis Streams, clona repos y ejecuta analisis seguro por defecto.

## Caracteristicas principales

- Monorepo con `web`, `api-gateway`, `analysis-service` y `analyzer-worker`.
- Flujo asincronico end-to-end: frontend -> gateway -> analysis-service -> Redis -> worker -> analysis-service.
- Redis Streams como cola agnostica de lenguaje.
- Worker Go con validacion de URL GitHub, timeout de clone y limpieza de temporales.
- `SAFE_ANALYSIS_MODE=true` por defecto (no ejecuta codigo externo en host).
- Modelo enterprise en Prisma para proyectos, scans, findings, artifacts, componentes y snapshots de riesgo.
- Analisis extra de postura: CI/CD, repo hygiene, Docker/IaC, package health, license policy y OpenSSF Scorecard.
- Reportes ejecutivos con graficos operativos y descarga PDF desde el dashboard.
- Swagger en `api-gateway` y `analysis-service`.
- Pool PostgreSQL explicito en `analysis-service` con limites, timeouts, readiness y metricas.
- PgBouncer delante de PostgreSQL para pooling runtime; Prisma Migrate usa `DATABASE_DIRECT_URL`.
- Trazas opcionales de queries Prisma via OpenTelemetry Collector + Tempo.
- CI profesional (lint, format, tests, builds, Prisma migrations y Docker builds).
- Docker Compose para stack local completo.
- AI opcional (Ollama) desactivada por defecto; proveedor rule-based activo.

## Estado actual del sistema

Servicios implementados:

- `web` (Next.js)
- `api-gateway` (NestJS)
- `analysis-service` (NestJS + Prisma)
- `analyzer-worker` (Go)
- `postgres`
- `pgbouncer`
- `redis`

Flujos implementados de punta a punta:

- creacion de analisis desde UI
- encolado de job en Redis Streams
- consumo por worker Go
- clone de repositorio publico GitHub
- deteccion de stack
- safe analysis con findings normalizados
- analisis local seguro de GitHub Actions, Dockerfiles, Compose, package.json, licencias y hygiene del repo
- scanners reales opcionales en sandbox Docker para Semgrep, Trivy, OSV, Gitleaks y OpenSSF Scorecard
- callback de resultado/fallo al analysis-service
- persistencia en PostgreSQL
- consulta de portfolio, proyectos, scans, findings, artifacts, SBOM, reportes y PDF

## Estructura del proyecto

```text
codeguard-ai/
|-- .github/
|   |-- workflows/
|   |   `-- ci.yml
|   `-- dependabot.yml
|-- apps/
|   |-- web/
|   |-- api-gateway/
|   |-- analysis-service/
|   `-- analyzer-worker/
|-- packages/
|   `-- shared-types/
|-- docs/
|   |-- architecture.md
|   |-- local-development.md
|   |-- security.md
|   |-- analyzer-worker.md
|   `-- decisions/
|-- infra/
|   |-- docker/
|   |-- observability/
|   `-- terraform/
|-- scripts/
|-- docker-compose.yml
|-- Makefile
|-- .env.template
`-- README.md
```

## Catalogo de microservicios

### Web

- Ruta: `apps/web`
- Puerto: `3000`
- Rol:
  - dashboard operativo
  - creacion de analisis y scans
  - visualizacion de findings, score, artifacts, graficos y reportes PDF

### API Gateway

- Ruta: `apps/api-gateway`
- Puerto: `3001`
- Rol:
  - entrypoint HTTP publico
  - validacion DTO
  - rate limiting
  - orquestacion hacia `analysis-service`

### Analysis Service

- Ruta: `apps/analysis-service`
- Puerto: `3002`
- Storage: PostgreSQL
- Rol:
  - persistencia central
  - publicacion de jobs a Redis Streams
  - callbacks internos del worker
  - scoring, snapshots y report generation

### Analyzer Worker

- Ruta: `apps/analyzer-worker`
- Runtime: Go
- Rol:
  - consumir `scan.jobs`
  - clonar y analizar repositorios
  - devolver resultados normalizados por endpoint interno

## Analisis de repositorios

CodeGuard AI combina checks seguros por lectura de archivos con scanners reales opcionales en sandbox Docker.

Modo seguro por defecto:

- `ci-posture`: inspecciona `.github/workflows` para `pull_request_target`, permisos `write-all`, actions sin pin SHA y secretos inline.
- `repo-hygiene`: detecta ausencia de `SECURITY.md`, `CODEOWNERS`, `dependabot.yml` y `LICENSE`.
- `dockerfile-posture`: revisa Dockerfile/Compose para `latest`, falta de usuario no-root, falta de healthcheck, `privileged`, Docker socket y mounts sensibles.
- `package-health`: revisa `package.json`, package manager, lockfiles, scripts de instalacion, engines, workspaces y rangos peligrosos.
- `license-policy`: clasifica riesgos de licencias AGPL/GPL/LGPL/SSPL/BUSL/Commons Clause/unknown.
- `scorecard-safe`: aproxima postura tipo OpenSSF sin llamadas externas.

Modo scanners reales con `make up-scanners`:

- `semgrep`: SAST con salida normalizada.
- `trivy`: vulnerabilidades, secretos, misconfigurations, licencias y SBOM CycloneDX.
- `osv-scanner`: vulnerabilidades de dependencias y fixed versions.
- `gitleaks`: deteccion especializada de secretos.
- `scorecard`: OpenSSF Scorecard real en Docker sandbox.

Regla de seguridad:

- `SAFE_ANALYSIS_MODE=true` no ejecuta codigo del repo.
- `SAFE_ANALYSIS_MODE=false` ejecuta herramientas externas solo dentro de Docker sandbox mediante `DockerExecutor.RunTool`.

## Reportes y visualizaciones

El frontend muestra informes mas visuales para cada scan:

- donut de severidad
- donut de categorias
- barras de cobertura de herramientas
- barras de vulnerabilidades por ecosistema
- donut de distribucion de licencias
- barras de prioridad de remediacion
- barras de duracion por herramienta
- resumen de postura CI/CD, repositorio y Docker/IaC
- SBOM summary, license risk y top findings

Reportes descargables:

- `GET /scans/:id/report` devuelve el reporte Markdown/JSON.
- `GET /scans/:id/report/executive` devuelve el payload enriquecido para UI.
- `GET /scans/:id/report.pdf` descarga un PDF ejecutivo generado server-side.

## API publica del gateway

Base URL local:

```text
http://localhost:3001
```

Rutas actuales:

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
- `GET /scans/:id/report/executive`
- `GET /scans/:id/report.pdf`
- `GET /scans/:id/remediation-plan`
- `GET /scans/:id/compare/:previousScanId`
- `GET /projects/:id/risk-history`
- `POST /findings/:id/status`
- `GET /dashboard/portfolio-risk`
- `GET /dashboard/remediation`

Ejemplos:

```bash
curl -X POST "http://localhost:3001/analyses" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/vercel/next.js",
    "branch": "main"
  }'
```

```bash
curl -X POST "http://localhost:3001/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Next.js",
    "repoUrl": "https://github.com/vercel/next.js",
    "defaultBranch": "main"
  }'
```

```bash
curl -X POST "http://localhost:3001/projects/<projectId>/scans" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "main"
  }'
```

## Swagger / API Docs

Swagger/OpenAPI documenta contratos HTTP de servicios NestJS.

API Gateway:

- `GET /docs`
- `GET /docs-json`

Analysis Service:

- `GET /docs`
- `GET /docs-json`

URLs locales:

- `http://localhost:3001/docs`
- `http://localhost:3002/docs`

Nota:

- El worker Go no usa Swagger porque no expone API HTTP publica.
- Su contrato fuente de verdad esta en Redis payload + callbacks internos documentados en `apps/analyzer-worker/README.md`.

## Observabilidad

Estado actual:

- healthchecks en Docker Compose para `postgres`, `redis`, `analysis-service` y `api-gateway`
- readiness real de PostgreSQL en `analysis-service` mediante `GET /health/ready`
- endpoint `/metrics` en `api-gateway`, `analysis-service` y `analyzer-worker`
- stack opcional con Prometheus, Grafana, Loki, Tempo, OpenTelemetry Collector, Promtail, cAdvisor, Redis exporter y Postgres exporter
- dashboard Grafana provisionado: `CodeGuard AI Operations Overview`
- logs centralizados en Loki mediante Promtail
- metricas del pool Prisma/PostgreSQL: connection limit, pool timeout y connect timeout
- alertas Prometheus para slow queries, p95 alto de DB, saturacion de conexiones y pool timeout agresivo

Comandos:

```bash
make up-observability
make down-observability
make logs-observability
```

URLs locales:

- Grafana: `http://localhost:3003`
- Prometheus: `http://localhost:9090`
- Loki: `http://localhost:3100`

Pendiente:

- alertas con Alertmanager
- OpenTelemetry traces distribuidos

## Testing y calidad

Checks locales:

```bash
make lint
make test
make build
docker compose config --quiet
```

CI en GitHub Actions (`.github/workflows/ci.yml`) ejecuta:

- Node quality (`format`, `lint`, `test`, `build`)
- Prisma generate
- Prisma migrations sobre Postgres efimero
- Go formatting, `go test`, `go vet`, `go build`
- validacion de compose
- build de imagenes Docker (sin push)

## Guia de instalacion y ejecucion local

### Prerrequisitos

- Node.js 20+
- npm 10+
- Go 1.25+
- Docker + Docker Compose
- Make

### 1. Configurar entorno

```bash
cp .env.template .env
```

### 2. Instalar dependencias

```bash
make install
```

### 3. Levantar stack

```bash
make up
make db-migrate
```

### 4. Abrir aplicacion

```text
http://localhost:3000
```

Comandos utiles:

- `make logs`
- `make down`
- `make reset` (alias de redeploy completo con volumenes)

## Infraestructura y despliegue AWS

Estado actual:

- Terraform no implementado todavia en v1 (solo estructura base en `infra/terraform`).
- Ruta objetivo: AWS ECS Fargate + RDS PostgreSQL + Redis managed + storage de artifacts.

Directorios de preparacion:

- `infra/terraform`
- `infra/observability`
- `infra/docker`

## Variables de entorno

Archivo de referencia:

- `.env.template`

Variables destacadas:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `DATABASE_DIRECT_URL`
- `DB_POOL_CONNECTION_LIMIT`
- `DB_POOL_TIMEOUT_SECONDS`
- `DB_CONNECT_TIMEOUT_SECONDS`
- `DB_APPLICATION_NAME`
- `DB_PGBOUNCER`
- `DB_QUERY_LOGGING`
- `DB_QUERY_METRICS_ENABLED`
- `DB_SLOW_QUERY_THRESHOLD_MS`
- `DB_QUERY_TRACING_ENABLED`
- `DB_QUERY_TRACE_SAMPLE_RATE`
- `OTEL_ENABLED`
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- `PGBOUNCER_PORT`
- `PGBOUNCER_POOL_MODE`
- `PGBOUNCER_MAX_CLIENT_CONN`
- `PGBOUNCER_DEFAULT_POOL_SIZE`
- `PGBOUNCER_RESERVE_POOL_SIZE`
- `REDIS_ADDR`
- `ANALYSIS_STREAM_NAME`
- `API_GATEWAY_PORT`
- `ANALYSIS_SERVICE_PORT`
- `ANALYSIS_SERVICE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `SWAGGER_ENABLED`
- `INTERNAL_SECRET`
- `SAFE_ANALYSIS_MODE`
- `SANDBOX_ANALYSIS_MODE`
- `SEMGREP_IMAGE`
- `TRIVY_IMAGE`
- `OSV_SCANNER_IMAGE`
- `GITLEAKS_IMAGE`
- `SCORECARD_IMAGE`
- `OLLAMA_ENABLED`
- `OLLAMA_BASE_URL`

## Datos de prueba

Repos para probar rapidamente:

- `https://github.com/vercel/next.js`
- `https://github.com/nestjs/nest`
- `https://github.com/gin-gonic/gin`

Flujo manual recomendado:

1. crear analisis desde `/dashboard/analyses/new`
2. esperar consumo del worker
3. abrir detalle de scan para revisar findings, score, summary y graficos
4. abrir el executive report desde el detalle del scan
5. descargar el PDF con `Download PDF`

## Documentacion tecnica

- `docs/architecture.md`
- `docs/local-development.md`
- `docs/security.md`
- `docs/analyzer-worker.md`
- `docs/decisions/001-use-redis-streams.md`
- `docs/decisions/002-safe-analysis-mode.md`
- `docs/decisions/003-ai-as-optional-provider.md`
- `apps/web/README.md`
- `apps/api-gateway/README.md`
- `apps/analysis-service/README.md`
- `apps/analyzer-worker/README.md`

## Roadmap

- agregar export SARIF descargable desde UI
- agregar PDF con graficos vectoriales mas avanzados y portada brand-ready
- mejorar comparacion visual entre scans
- implementar auth multi-workspace (users/roles/API keys)
- agregar alertas sobre observabilidad (Prometheus Alertmanager)
- preparar despliegue productivo en AWS ECS Fargate con Terraform

## Contribuciones

¡Las contribuciones son bienvenidas! Seguí estos pasos:

1. Hacé un fork del repositorio.
2. Creá una rama para tu feature o fix (`git checkout -b feature/nueva-funcionalidad`).
3. Realizá tus cambios y escribí pruebas si es necesario.
4. Hacé commit y push a tu rama (`git commit -m "feat: agrega nueva funcionalidad"`).
5. Abrí un Pull Request describiendo tus cambios.

### Convenciones de Commits

Este proyecto sigue [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bugs
- `docs:` Cambios en documentación
- `style:` Cambios de formato (no afectan la lógica)
- `refactor:` Refactorización de código
- `test:` Añadir o modificar tests
- `chore:` Tareas de mantenimiento

---

## Licencia

Este proyecto está bajo la licencia **MIT**.

---

<a id="contact-anchor"></a>

## 📬 Contacto

- **Autor:** Lucas Cabral
- **Email:** lucassimple@hotmail.com
- **LinkedIn:** [https://www.linkedin.com/in/lucas-gastón-cabral/](https://www.linkedin.com/in/lucas-gastón-cabral/)
- **Portfolio:** [https://portfolio-web-dev-git-main-lucascabral95s-projects.vercel.app/](https://portfolio-web-dev-git-main-lucascabral95s-projects.vercel.app/)
- **Github:** [https://github.com/Lucascabral95](https://github.com/Lucascabral95/)

---

<p align="center">
  Desarrollado con ❤️ por Lucas Cabral
</p>
