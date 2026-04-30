#!/usr/bin/env sh
set -eu

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=codeguard}"
: "${POSTGRES_PASSWORD:=codeguard}"
: "${POSTGRES_DB:=codeguard}"
: "${PGBOUNCER_POOL_MODE:=transaction}"
: "${PGBOUNCER_MAX_CLIENT_CONN:=200}"
: "${PGBOUNCER_DEFAULT_POOL_SIZE:=20}"
: "${PGBOUNCER_RESERVE_POOL_SIZE:=5}"
: "${PGBOUNCER_IGNORE_STARTUP_PARAMETERS:=extra_float_digits,application_name}"

mkdir -p /etc/pgbouncer

cat > /etc/pgbouncer/userlist.txt <<EOF
"$POSTGRES_USER" "$POSTGRES_PASSWORD"
EOF

cat > /etc/pgbouncer/pgbouncer.ini <<EOF
[databases]
$POSTGRES_DB = host=$POSTGRES_HOST port=$POSTGRES_PORT dbname=$POSTGRES_DB

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 5432
auth_type = plain
auth_file = /etc/pgbouncer/userlist.txt
admin_users = $POSTGRES_USER
stats_users = $POSTGRES_USER
pool_mode = $PGBOUNCER_POOL_MODE
max_client_conn = $PGBOUNCER_MAX_CLIENT_CONN
default_pool_size = $PGBOUNCER_DEFAULT_POOL_SIZE
reserve_pool_size = $PGBOUNCER_RESERVE_POOL_SIZE
ignore_startup_parameters = $PGBOUNCER_IGNORE_STARTUP_PARAMETERS
server_check_query = select 1
server_check_delay = 30
server_login_retry = 5
client_idle_timeout = 300
server_idle_timeout = 300
query_timeout = 120
log_connections = 1
log_disconnections = 1
stats_period = 60
pidfile =
EOF

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
