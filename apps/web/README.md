# Web App (`apps/web`)

Frontend de CodeGuard AI (Next.js App Router).

## Responsabilidad

- Mostrar dashboard de portfolio, proyectos, scans y findings.
- Permitir crear análisis y scans.
- Consumir solo `api-gateway` (no habla directo con `analysis-service`).

## Rutas principales

- `/`
- `/dashboard`
- `/dashboard/analyses/new`
- `/dashboard/analyses/[id]`
- `/dashboard/projects/[id]`
- `/dashboard/scans/[id]`

## Integración API

Cliente Axios:

- Base URL: `NEXT_PUBLIC_API_BASE_URL`
- Default local: `http://localhost:3001`

Endpoints usados:

- `/analyses`
- `/projects`
- `/scans`
- `/findings/:id/status`
- `/dashboard/portfolio-risk`

## Variables de entorno

- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3001`)

## Stack UI

- Next.js + React + TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form + Zod
- Axios

## Scripts

- `npm --workspace @codeguard/web run dev`
- `npm --workspace @codeguard/web run build`
- `npm --workspace @codeguard/web run lint`

## Errores comunes

- Pantalla sin datos: verificar `NEXT_PUBLIC_API_BASE_URL`.
- Error de fetch en browser: revisar que `api-gateway` esté levantado.
- Build falla por tipos: ejecutar build en `@codeguard/shared-types` primero si hubo cambios de contratos.
