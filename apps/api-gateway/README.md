# API Gateway (`apps/api-gateway`)

Fachada HTTP publica de CodeGuard AI.

## Responsabilidad

- Recibir requests desde `web`.
- Validar DTOs de entrada.
- Aplicar rate limiting.
- Delegar al `analysis-service`.
- Exponer documentación OpenAPI (`/docs`).

No contiene lógica de análisis ni persistencia.

## Endpoints

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

Swagger:

- `GET /docs`
- `GET /docs-json`

## Variables de entorno

- `PORT` (default `3001`)
- `API_GATEWAY_PORT` (fallback, default `3001`)
- `ANALYSIS_SERVICE_URL` (default `http://localhost:3002`)
- `WEB_ORIGIN` (default `http://localhost:3000`)
- `SWAGGER_ENABLED` (default `true`)

## Scripts

- `npm --workspace @codeguard/api-gateway run start:dev`
- `npm --workspace @codeguard/api-gateway run build`
- `npm --workspace @codeguard/api-gateway run lint`
- `npm --workspace @codeguard/api-gateway run test`

## Errores comunes

- `ECONNREFUSED` hacia `analysis-service`: revisar `ANALYSIS_SERVICE_URL` y estado del servicio.
- `429` por throttling: normal cuando se excede tasa de requests.
- CORS en frontend: revisar `WEB_ORIGIN`.
