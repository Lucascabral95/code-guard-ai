FROM golang:1.26-alpine AS build
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY apps/analyzer-worker/go.mod apps/analyzer-worker/go.sum* ./
RUN go mod download
COPY apps/analyzer-worker ./
RUN go build -o /out/analyzer-worker ./cmd/worker

FROM alpine:3.23
RUN apk add --no-cache git ca-certificates
WORKDIR /app
COPY --from=build /out/analyzer-worker /usr/local/bin/analyzer-worker
ENV TEMP_DIR=/tmp/codeguard
CMD ["analyzer-worker"]
