.PHONY: help install up up-scanners up-observability down down-observability logs logs-observability dev dev-web dev-gateway dev-analysis dev-worker db-migrate db-studio test lint build clean reset redeploy

help:
	@echo "CodeGuard AI commands:"
	@echo "  make install       Install Node workspaces and Go worker dependencies"
	@echo "  make up            Build and start Docker Compose services"
	@echo "  make up-scanners   Build and start Docker Compose with real scanner runtime enabled"
	@echo "  make up-observability Build and start the app plus Prometheus, Grafana, Loki and exporters"
	@echo "  make down          Stop Docker Compose services"
	@echo "  make down-observability Stop observability services"
	@echo "  make logs          Follow Docker Compose logs"
	@echo "  make logs-observability Follow observability logs"
	@echo "  make dev           Show local development commands"
	@echo "  make dev-web       Run the Next.js web app"
	@echo "  make dev-gateway   Run the NestJS API Gateway"
	@echo "  make dev-analysis  Run the NestJS Analysis Service"
	@echo "  make dev-worker    Run the Go analyzer worker"
	@echo "  make db-migrate    Apply Prisma migrations inside Docker"
	@echo "  make db-studio     Open Prisma Studio for the analysis service"
	@echo "  make test          Run TypeScript and Go tests"
	@echo "  make lint          Run TypeScript linting and Go vet"
	@echo "  make build         Build all apps"
	@echo "  make clean         Remove generated local artifacts"
	@echo "  make reset         Alias for make redeploy"
	@echo "  make redeploy      Delete Docker volumes, rebuild, start services and run migrations"

install:
	npm install --cache .npm-cache --ignore-scripts
	npm --workspace @codeguard/analysis-service run prisma:generate
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$$env:GOCACHE='$(CURDIR)\.go-cache\build'; $$env:GOMODCACHE='$(CURDIR)\.go-cache\mod'; $$env:GOPATH='$(CURDIR)\.go-cache\gopath'; Set-Location 'apps\analyzer-worker'; go mod tidy"

up:
	docker compose up --build -d

up-scanners:
	docker compose -f docker-compose.yml -f docker-compose.scanners.yml up --build -d

up-observability:
	docker compose -f docker-compose.yml -f docker-compose.observability.yml up --build -d

down:
	docker compose down

down-observability:
	docker compose -f docker-compose.yml -f docker-compose.observability.yml stop prometheus grafana loki promtail cadvisor redis-exporter postgres-exporter tempo otel-collector
	docker compose -f docker-compose.yml -f docker-compose.observability.yml rm -f prometheus grafana loki promtail cadvisor redis-exporter postgres-exporter tempo otel-collector

logs:
	docker compose logs -f

logs-observability:
	docker compose -f docker-compose.yml -f docker-compose.observability.yml logs -f prometheus grafana loki promtail cadvisor redis-exporter postgres-exporter tempo otel-collector

dev:
	@echo "Run these in separate terminals:"
	@echo "  make dev-analysis"
	@echo "  make dev-gateway"
	@echo "  make dev-worker"
	@echo "  make dev-web"

dev-web:
	npm --workspace @codeguard/web run dev

dev-gateway:
	npm --workspace @codeguard/api-gateway run start:dev

dev-analysis:
	npm --workspace @codeguard/analysis-service run start:dev

dev-worker:
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$$env:GOCACHE='$(CURDIR)\.go-cache\build'; $$env:GOMODCACHE='$(CURDIR)\.go-cache\mod'; $$env:GOPATH='$(CURDIR)\.go-cache\gopath'; Set-Location 'apps\analyzer-worker'; go run ./cmd/worker"

db-migrate:
	docker compose exec analysis-service npx prisma migrate deploy

db-studio:
	npm --workspace @codeguard/analysis-service run db:studio

test:
	npm run test --workspaces --if-present
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$$env:GOCACHE='$(CURDIR)\.go-cache\build'; $$env:GOMODCACHE='$(CURDIR)\.go-cache\mod'; $$env:GOPATH='$(CURDIR)\.go-cache\gopath'; Set-Location 'apps\analyzer-worker'; go test ./..."

lint:
	npm run lint --workspaces --if-present
	npm run format:check
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$$env:GOCACHE='$(CURDIR)\.go-cache\build'; $$env:GOMODCACHE='$(CURDIR)\.go-cache\mod'; $$env:GOPATH='$(CURDIR)\.go-cache\gopath'; Set-Location 'apps\analyzer-worker'; go vet ./..."

build:
	npm run build --workspaces --if-present
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$$env:GOCACHE='$(CURDIR)\.go-cache\build'; $$env:GOMODCACHE='$(CURDIR)\.go-cache\mod'; $$env:GOPATH='$(CURDIR)\.go-cache\gopath'; Set-Location 'apps\analyzer-worker'; go build -o bin\analyzer-worker.exe ./cmd/worker"

clean:
	powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Directory -Recurse -Force -Include node_modules,.next,dist,bin,tmp,temp,coverage | Remove-Item -Recurse -Force"

redeploy:
	docker compose down -v --remove-orphans
	docker compose up --build -d
	docker compose exec analysis-service npx prisma migrate deploy

reset: redeploy
