FROM alpine:3.20

RUN apk add --no-cache pgbouncer postgresql-client

COPY infra/docker/pgbouncer/entrypoint.sh /usr/local/bin/pgbouncer-entrypoint.sh
RUN chmod +x /usr/local/bin/pgbouncer-entrypoint.sh

EXPOSE 5432

ENTRYPOINT ["/usr/local/bin/pgbouncer-entrypoint.sh"]
