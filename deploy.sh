#!/bin/bash
# =============================================================================
#  sitios-web — Script de deploy automático para Hostinger
# =============================================================================
#
#  USO:
#    1. Copiar deploy.env.example → deploy.env y completar los valores
#    2. chmod +x deploy.sh
#    3. sudo ./deploy.sh
#
#  El script:
#   - Detecta reverse proxy y SSL existentes (nginx, traefik, caddy, certbot)
#   - Detecta puertos ocupados y elige puertos libres
#   - Despliega Supabase en Docker con puertos distintos al existente
#   - Construye y despliega la app React en Docker
#   - Configura el reverse proxy existente para la nueva app
#   - Aplica migraciones SQL y despliega las edge functions
#   - No modifica ni toca la instalación existente del servidor
#
# =============================================================================

set -euo pipefail

# ─── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1" >&2; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }
step()  { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}"; }

# ─── Verificar root ───────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "Este script debe ejecutarse como root (sudo ./deploy.sh)"
fi

# ─── Cargar configuración ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/deploy.env"

if [[ ! -f "$ENV_FILE" ]]; then
  error "No se encontró deploy.env. Copiá deploy.env.example → deploy.env y completá los valores."
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

# ─── Valores requeridos ───────────────────────────────────────────────────────
: "${GITHUB_TOKEN:?Falta GITHUB_TOKEN en deploy.env}"
: "${APP_DOMAIN:?Falta APP_DOMAIN en deploy.env (ej: dev.vendemas.soynico.ai)}"
: "${SUPABASE_DOMAIN:?Falta SUPABASE_DOMAIN en deploy.env (ej: api.dev.vendemas.soynico.ai)}"
: "${STUDIO_DOMAIN:?Falta STUDIO_DOMAIN en deploy.env (ej: studio.dev.vendemas.soynico.ai)}"
: "${DB_PASSWORD:?Falta DB_PASSWORD en deploy.env}"
: "${OPENROUTER_API_KEY:?Falta OPENROUTER_API_KEY en deploy.env}"

# ─── Constantes ───────────────────────────────────────────────────────────────
GITHUB_REPO="https://x-access-token:${GITHUB_TOKEN}@github.com/pablopaludi-2025/sitios-web.git"
APP_NAME="vende-mas"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/vende-mas}"
SUPABASE_DIR="${DEPLOY_DIR}/supabase-stack"
BRANCH="${BRANCH:-claude/build-ai-sales-app-73xTm}"

# ─── DOCKER COMPOSE command ───────────────────────────────────────────────────
if docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

# =============================================================================
# 1. DETECTAR ENTORNO
# =============================================================================
step "Detectando entorno del servidor"

# Docker
command -v docker &>/dev/null || error "Docker no está instalado."
log "Docker: $(docker --version | head -1)"
log "Docker Compose: $($DC version | head -1)"

# Reverse proxy
REVERSE_PROXY="none"
RP_CONTAINER=""

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qiE '^nginx$|^nginx-proxy$|^proxy$|nginx'; then
  RP_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i nginx | head -1)
  REVERSE_PROXY="nginx-docker"
elif docker ps --format '{{.Image}}' 2>/dev/null | grep -qi 'nginx'; then
  RP_CONTAINER=$(docker ps --format '{{.Names}}\t{{.Image}}' | grep -i nginx | awk '{print $1}' | head -1)
  REVERSE_PROXY="nginx-docker"
elif docker ps --format '{{.Image}}' 2>/dev/null | grep -qi 'traefik'; then
  RP_CONTAINER=$(docker ps --format '{{.Names}}\t{{.Image}}' | grep -i traefik | awk '{print $1}' | head -1)
  REVERSE_PROXY="traefik"
elif docker ps --format '{{.Image}}' 2>/dev/null | grep -qi 'caddy'; then
  RP_CONTAINER=$(docker ps --format '{{.Names}}\t{{.Image}}' | grep -i caddy | awk '{print $1}' | head -1)
  REVERSE_PROXY="caddy-docker"
elif systemctl is-active --quiet caddy 2>/dev/null || command -v caddy &>/dev/null; then
  REVERSE_PROXY="caddy-system"
elif systemctl is-active --quiet nginx 2>/dev/null || \
     ( command -v nginx &>/dev/null && nginx -v &>/dev/null 2>&1 ); then
  REVERSE_PROXY="nginx-system"
elif systemctl is-active --quiet apache2 2>/dev/null; then
  REVERSE_PROXY="apache"
fi

if [[ "$REVERSE_PROXY" != "none" ]]; then
  log "Reverse proxy detectado: $REVERSE_PROXY ${RP_CONTAINER:+(container: $RP_CONTAINER)}"
else
  warn "No se detectó reverse proxy. La app quedará expuesta directamente en el puerto asignado."
fi

# SSL
SSL_TOOL="none"
if [[ "$REVERSE_PROXY" == "caddy-system" || "$REVERSE_PROXY" == "caddy-docker" ]]; then
  SSL_TOOL="caddy-auto"  # Caddy gestiona ACME automáticamente
elif [[ "$REVERSE_PROXY" == "traefik" ]]; then
  SSL_TOOL="traefik-auto"
elif command -v certbot &>/dev/null; then
  SSL_TOOL="certbot"
elif [[ -f /root/.acme.sh/acme.sh ]]; then
  SSL_TOOL="acme.sh"
fi
log "SSL management: $SSL_TOOL"

find_caddyfile() {
  # 1. Intentar sacar la ruta del servicio systemd
  local exec_line
  exec_line=$(systemctl cat caddy 2>/dev/null | grep -oP '(?<=ExecStart=).*' | head -1)
  if echo "$exec_line" | grep -q '\-\-config'; then
    local path
    path=$(echo "$exec_line" | grep -oP '(?<=--config )\S+')
    [[ -f "$path" ]] && { echo "$path"; return; }
  fi
  # 2. Ubicaciones conocidas
  local known
  for known in \
    /opt/airsync/deployment/Caddyfile \
    /etc/caddy/Caddyfile \
    /usr/local/etc/caddy/Caddyfile \
    /home/*/Caddyfile; do
    [[ -f "$known" ]] && { echo "$known"; return; }
  done
  echo ""
}

# Verificar que el dominio no esté ya configurado en el reverse proxy
check_domain_conflict() {
  local domain=$1
  case "$REVERSE_PROXY" in
    caddy-system)
      local caddy_cfg
      caddy_cfg=$(find_caddyfile)
      if [[ -n "$caddy_cfg" ]] && grep -q "$domain" "$caddy_cfg" 2>/dev/null; then
        warn "El dominio $domain ya aparece en el Caddyfile ($caddy_cfg). Revisá antes de continuar."
      fi
      ;;
    nginx-system)
      if grep -r "$domain" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | grep -q .; then
        warn "El dominio $domain ya aparece en la configuración de nginx. Revisá antes de continuar."
      fi
      ;;
    nginx-docker)
      if [[ -n "$RP_CONTAINER" ]]; then
        if docker exec "$RP_CONTAINER" grep -r "$domain" /etc/nginx/conf.d/ 2>/dev/null | grep -q .; then
          warn "El dominio $domain ya aparece en la configuración del contenedor nginx."
        fi
      fi
      ;;
  esac
}
check_domain_conflict "$APP_DOMAIN"
check_domain_conflict "$SUPABASE_DOMAIN"
check_domain_conflict "$STUDIO_DOMAIN"

# =============================================================================
# 2. ENCONTRAR PUERTOS LIBRES
# =============================================================================
step "Buscando puertos disponibles"

is_port_in_use() {
  local port=$1
  # Chequear con ss (sockets del sistema)
  ss -tlnp 2>/dev/null | grep -q ":${port} " && return 0
  # Chequear puertos expuestos por Docker
  docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE "(0\.0\.0\.0|127\.0\.0\.1):${port}->" && return 0
  return 1
}

find_free_port() {
  local start=$1
  local port=$start
  while is_port_in_use "$port"; do
    port=$((port + 1))
  done
  echo "$port"
}

# Ports para esta app (empezamos lejos de los defaults para no chocar)
APP_PORT=$(find_free_port 3150)
SUPA_API_PORT=$(find_free_port 8150)      # Kong API
SUPA_STUDIO_PORT=$(find_free_port 3250)   # Supabase Studio
SUPA_DB_PORT=$(find_free_port 5543)       # PostgreSQL
SUPA_INBUCKET_PORT=$(find_free_port 9150) # Email testing

log "App frontend      → puerto $APP_PORT"
log "Supabase API      → puerto $SUPA_API_PORT"
log "Supabase Studio   → puerto $SUPA_STUDIO_PORT"
log "Supabase DB       → puerto $SUPA_DB_PORT"
log "Supabase Inbucket → puerto $SUPA_INBUCKET_PORT"

# =============================================================================
# 3. CLONAR / ACTUALIZAR REPOSITORIO
# =============================================================================
step "Clonando/actualizando repositorio"

mkdir -p "$DEPLOY_DIR"

if [[ -d "${DEPLOY_DIR}/.git" ]]; then
  info "Repositorio existente. Haciendo pull..."
  git -C "$DEPLOY_DIR" remote set-url origin "$GITHUB_REPO"
  git -C "$DEPLOY_DIR" fetch origin "$BRANCH"
  git -C "$DEPLOY_DIR" checkout "$BRANCH"
  git -C "$DEPLOY_DIR" reset --hard "origin/$BRANCH"
  log "Repositorio actualizado"
else
  info "Clonando repositorio..."
  git clone --branch "$BRANCH" --single-branch "$GITHUB_REPO" "$DEPLOY_DIR"
  log "Repositorio clonado en $DEPLOY_DIR"
fi

# =============================================================================
# 4. GENERAR SECRETS DE SUPABASE
# =============================================================================
step "Configurando secrets de Supabase"

SECRETS_FILE="${SUPABASE_DIR}/.secrets"
mkdir -p "$SUPABASE_DIR"

if [[ -f "$SECRETS_FILE" ]]; then
  info "Cargando secrets existentes..."
  # shellcheck source=/dev/null
  source "$SECRETS_FILE"
else
  info "Generando nuevos secrets..."

  # JWT secret (mínimo 32 chars para HS256)
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 64)

  # JWT tokens para Supabase
  # Payload anon: {"role":"anon","iss":"supabase-demo","iat":...,"exp":...}
  # Usamos python3 o node para generar los JWT
  generate_jwt() {
    local role=$1
    python3 - <<PYEOF
import base64, json, hmac, hashlib, time

secret = "$JWT_SECRET".encode()
now = int(time.time())
exp = now + 10 * 365 * 24 * 3600  # 10 años

payload = {"role": "$role", "iss": "supabase", "iat": now, "exp": exp}

def b64url(data):
    if isinstance(data, str):
        data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header = b64url(json.dumps({"alg":"HS256","typ":"JWT"}))
body   = b64url(json.dumps(payload))
sig    = b64url(hmac.new(secret, f"{header}.{body}".encode(), hashlib.sha256).digest())
print(f"{header}.{body}.{sig}")
PYEOF
  }

  if command -v python3 &>/dev/null; then
    ANON_KEY=$(generate_jwt "anon")
    SERVICE_ROLE_KEY=$(generate_jwt "service_role")
  else
    error "python3 es necesario para generar JWT. Instalá con: apt-get install -y python3"
  fi

  # Dashboard password
  DASHBOARD_USERNAME="${DASHBOARD_USERNAME:-admin}"
  DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -d '\n/+=' | head -c 20)

  # Guardar secrets
  cat > "$SECRETS_FILE" <<EOF
JWT_SECRET="${JWT_SECRET}"
ANON_KEY="${ANON_KEY}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
DASHBOARD_USERNAME="${DASHBOARD_USERNAME}"
DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD}"
EOF
  chmod 600 "$SECRETS_FILE"
  log "Secrets generados y guardados en $SECRETS_FILE"
fi

log "Secrets listos"

# =============================================================================
# 5. CREAR DOCKER COMPOSE DE SUPABASE
# =============================================================================
step "Generando docker-compose de Supabase"

cat > "${SUPABASE_DIR}/docker-compose.yml" <<DCEOF
# Supabase self-hosted — sitios-web
# Generado automáticamente por deploy.sh
# NO editar manualmente — regenerar con deploy.sh

version: "3.8"

networks:
  ${APP_NAME}-supabase:
    name: ${APP_NAME}-supabase

volumes:
  ${APP_NAME}-db-data:
  ${APP_NAME}-storage-data:
  ${APP_NAME}-functions-data:

services:

  # ── PostgreSQL ──────────────────────────────────────────────────────────────
  db:
    container_name: ${APP_NAME}-db
    image: supabase/postgres:15.8.1.085
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    ports:
      - "127.0.0.1:${SUPA_DB_PORT}:5432"
    environment:
      POSTGRES_HOST: /var/run/postgresql
      PGPORT: 5432
      POSTGRES_PORT: 5432
      PGPASSWORD: "${DB_PASSWORD}"
      POSTGRES_PASSWORD: "${DB_PASSWORD}"
      PGDATABASE: postgres
      POSTGRES_DB: postgres
      JWT_SECRET: "${JWT_SECRET}"
    volumes:
      - ${APP_NAME}-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d postgres"]
      interval: 10s
      timeout: 5s
      retries: 10

  # ── GoTrue (Auth) ───────────────────────────────────────────────────────────
  auth:
    container_name: ${APP_NAME}-auth
    image: supabase/gotrue:v2.186.0
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    depends_on:
      db:
        condition: service_healthy
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: https://${SUPABASE_DOMAIN}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${DB_PASSWORD}@db:5432/postgres?sslmode=disable
      GOTRUE_SITE_URL: https://${APP_DOMAIN}
      GOTRUE_URI_ALLOW_LIST: "https://${APP_DOMAIN},https://${APP_DOMAIN}/*"
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_SECRET: "${JWT_SECRET}"
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      GOTRUE_SMTP_ADMIN_EMAIL: "admin@${APP_DOMAIN}"
      GOTRUE_SMTP_HOST: inbucket
      GOTRUE_SMTP_PORT: 2500
      GOTRUE_SMTP_SENDER_NAME: "sitios-web"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9999/health"]
      timeout: 5s
      interval: 10s
      retries: 5

  # ── PostgREST ───────────────────────────────────────────────────────────────
  rest:
    container_name: ${APP_NAME}-rest
    image: postgrest/postgrest:v14.5
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://authenticator:${DB_PASSWORD}@db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: "${JWT_SECRET}"
      PGRST_DB_USE_LEGACY_GUCS: "false"
      PGRST_APP_SETTINGS_JWT_SECRET: "${JWT_SECRET}"
      PGRST_APP_SETTINGS_JWT_EXP: 3600
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/"]
      timeout: 5s
      interval: 10s
      retries: 5

  # ── Realtime ────────────────────────────────────────────────────────────────
  realtime:
    container_name: ${APP_NAME}-realtime
    image: supabase/realtime:v2.76.5
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    depends_on:
      db:
        condition: service_healthy
    environment:
      PORT: 4000
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: supabase_admin
      DB_PASSWORD: "${DB_PASSWORD}"
      DB_NAME: postgres
      DB_AFTER_CONNECT_QUERY: "SET search_path TO _realtime"
      DB_ENC_KEY: "${JWT_SECRET}"
      API_JWT_SECRET: "${JWT_SECRET}"
      FLY_ALLOC_ID: fly123
      FLY_APP_NAME: realtime
      SECRET_KEY_BASE: "${JWT_SECRET}${JWT_SECRET}"
      ERL_AFLAGS: -proto_dist inet_tcp
      ENABLE_TAILSCALE: "false"
      DNS_NODES: "''"

  # ── Storage ─────────────────────────────────────────────────────────────────
  storage:
    container_name: ${APP_NAME}-storage
    image: supabase/storage-api:v1.37.8
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    depends_on:
      db:
        condition: service_healthy
      rest:
        condition: service_started
    environment:
      ANON_KEY: "${ANON_KEY}"
      SERVICE_KEY: "${SERVICE_ROLE_KEY}"
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: "${JWT_SECRET}"
      DATABASE_URL: postgres://supabase_storage_admin:${DB_PASSWORD}@db:5432/postgres
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: local
      GLOBAL_S3_BUCKET: stub
      ENABLE_IMAGE_TRANSFORMATION: "true"
      IMGPROXY_URL: http://imgproxy:8080
    volumes:
      - ${APP_NAME}-storage-data:/var/lib/storage

  # ── Imgproxy ────────────────────────────────────────────────────────────────
  imgproxy:
    container_name: ${APP_NAME}-imgproxy
    image: darthsim/imgproxy:v3.30.1
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    environment:
      IMGPROXY_BIND: ":8080"
      IMGPROXY_LOCAL_FILESYSTEM_ROOT: /
      IMGPROXY_USE_ETAG: "true"
      IMGPROXY_ENABLE_WEBP_DETECTION: "true"
    volumes:
      - ${APP_NAME}-storage-data:/var/lib/storage:ro

  # ── Postgres Meta ───────────────────────────────────────────────────────────
  meta:
    container_name: ${APP_NAME}-meta
    image: supabase/postgres-meta:v0.95.2
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    depends_on:
      db:
        condition: service_healthy
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: db
      PG_META_DB_PORT: 5432
      PG_META_DB_NAME: postgres
      PG_META_DB_USER: supabase_admin
      PG_META_DB_PASSWORD: "${DB_PASSWORD}"

  # ── Edge Functions (Deno) ───────────────────────────────────────────────────
  functions:
    container_name: ${APP_NAME}-functions
    image: supabase/edge-runtime:v1.70.3
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    depends_on:
      db:
        condition: service_healthy
    environment:
      JWT_SECRET: "${JWT_SECRET}"
      SUPABASE_URL: http://kong:8000
      SUPABASE_ANON_KEY: "${ANON_KEY}"
      SUPABASE_SERVICE_ROLE_KEY: "${SERVICE_ROLE_KEY}"
      SUPABASE_DB_URL: postgres://postgres:${DB_PASSWORD}@db:5432/postgres
      OPENROUTER_API_KEY: "${OPENROUTER_API_KEY}"
      VERIFY_JWT: "false"
    volumes:
      - ${DEPLOY_DIR}/supabase/functions:/home/deno/functions:ro
    command:
      - start
      - --main-service
      - /home/deno/functions/main

  # ── Kong API Gateway ────────────────────────────────────────────────────────
  kong:
    container_name: ${APP_NAME}-kong
    image: kong:2.8.1
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "127.0.0.1:${SUPA_API_PORT}:8000"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /home/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
    volumes:
      - ${SUPABASE_DIR}/kong.yml:/home/kong/kong.yml:ro

  # ── Supabase Studio ─────────────────────────────────────────────────────────
  studio:
    container_name: ${APP_NAME}-studio
    image: supabase/studio:2026.02.16-sha-26c615c
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "127.0.0.1:${SUPA_STUDIO_PORT}:3000"
    environment:
      STUDIO_PG_META_URL: http://meta:8080
      POSTGRES_PASSWORD: "${DB_PASSWORD}"
      DEFAULT_ORGANIZATION_NAME: "sitios-web"
      DEFAULT_PROJECT_NAME: "sitios-web"
      SUPABASE_URL: http://kong:8000
      SUPABASE_PUBLIC_URL: https://${SUPABASE_DOMAIN}
      SUPABASE_ANON_KEY: "${ANON_KEY}"
      SUPABASE_SERVICE_KEY: "${SERVICE_ROLE_KEY}"
      AUTH_JWT_SECRET: "${JWT_SECRET}"
      LOGFLARE_API_KEY: "stub"
      LOGFLARE_URL: http://analytics:4000
      NEXT_ANALYTICS_BACKEND_PROVIDER: postgres

  # ── Inbucket (dev email) ────────────────────────────────────────────────────
  inbucket:
    container_name: ${APP_NAME}-inbucket
    image: inbucket/inbucket
    restart: unless-stopped
    networks:
      - ${APP_NAME}-supabase
    ports:
      - "127.0.0.1:${SUPA_INBUCKET_PORT}:9000"
DCEOF

log "docker-compose.yml de Supabase generado"

# =============================================================================
# 6. GENERAR kong.yml
# =============================================================================
step "Generando configuración de Kong"

cat > "${SUPABASE_DIR}/kong.yml" <<KONGEOF
_format_version: "1.1"

consumers:
  - username: anon
    keyauth_credentials:
      - key: ${ANON_KEY}
  - username: service_role
    keyauth_credentials:
      - key: ${SERVICE_ROLE_KEY}

acls:
  - consumer: anon
    group: anon
  - consumer: service_role
    group: admin

services:
  - name: auth-v1-open
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-open
        strip_path: true
        paths:
          - /auth/v1/verify
    plugins:
      - name: cors

  - name: auth-v1-open-callback
    url: http://auth:9999/callback
    routes:
      - name: auth-v1-open-callback
        strip_path: true
        paths:
          - /auth/v1/callback
    plugins:
      - name: cors

  - name: auth-v1-open-authorize
    url: http://auth:9999/authorize
    routes:
      - name: auth-v1-open-authorize
        strip_path: true
        paths:
          - /auth/v1/authorize
    plugins:
      - name: cors

  - name: auth-v1
    url: http://auth:9999/
    routes:
      - name: auth-v1-all
        strip_path: true
        paths:
          - /auth/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - anon
            - admin

  - name: rest-v1
    url: http://rest:3000/
    routes:
      - name: rest-v1-all
        strip_path: true
        paths:
          - /rest/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - anon
            - admin

  - name: realtime-v1
    url: http://realtime:4000/socket/
    routes:
      - name: realtime-v1-all
        strip_path: true
        paths:
          - /realtime/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - anon
            - admin

  - name: storage-v1
    url: http://storage:5000/
    routes:
      - name: storage-v1-all
        strip_path: true
        paths:
          - /storage/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - anon
            - admin

  - name: functions-v1
    url: http://functions:9000/
    routes:
      - name: functions-v1-all
        strip_path: true
        paths:
          - /functions/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - anon
            - admin

  - name: meta
    url: http://meta:8080/
    routes:
      - name: meta-all
        strip_path: true
        paths:
          - /pg/
    plugins:
      - name: key-auth
        config:
          hide_credentials: false
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
KONGEOF

log "kong.yml generado"

# =============================================================================
# 7. CREAR MAIN FUNCTION para edge runtime
# =============================================================================
step "Preparando edge functions"

MAIN_FN_DIR="${DEPLOY_DIR}/supabase/functions/main"
mkdir -p "$MAIN_FN_DIR"

cat > "${MAIN_FN_DIR}/index.ts" <<'MAINEOF'
const functions: Record<string, () => Promise<{ default: (req: Request) => Response | Promise<Response> }>> = {
  "chatbot":               () => import("../chatbot/index.ts"),
  "create-client-user":   () => import("../create-client-user/index.ts"),
  "generate-content-plan": () => import("../generate-content-plan/index.ts"),
  "seed-data":             () => import("../seed-data/index.ts"),
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const pathParts = url.pathname.split("/").filter(Boolean)
  const fnName = pathParts[0]

  if (!fnName || !functions[fnName]) {
    return new Response(JSON.stringify({ error: "Function not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const mod = await functions[fnName]()
    return await mod.default(req)
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
})
MAINEOF

log "Main edge function creada"

# =============================================================================
# 8. CREAR .env DE LA APP Y DOCKER COMPOSE
# =============================================================================
step "Generando configuración de la app React"

# Escribir el .env de la app
cat > "${DEPLOY_DIR}/.env.production" <<ENVEOF
VITE_SUPABASE_URL=https://${SUPABASE_DOMAIN}
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
ENVEOF
chmod 600 "${DEPLOY_DIR}/.env.production"
log ".env.production generado"

# Docker Compose para la app
cat > "${DEPLOY_DIR}/docker-compose.app.yml" <<APPEOF
# App React — sitios-web
# Generado automáticamente por deploy.sh

version: "3.8"

networks:
  ${APP_NAME}-app:
    name: ${APP_NAME}-app

services:
  app:
    container_name: ${APP_NAME}-app
    build:
      context: ${DEPLOY_DIR}
      dockerfile: Dockerfile
      args:
        VITE_SUPABASE_URL: "https://${SUPABASE_DOMAIN}"
        VITE_SUPABASE_ANON_KEY: "${ANON_KEY}"
    image: ${APP_NAME}:latest
    restart: unless-stopped
    networks:
      - ${APP_NAME}-app
    ports:
      - "127.0.0.1:${APP_PORT}:80"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
APPEOF

log "docker-compose.app.yml generado"

# =============================================================================
# 9. CONSTRUIR LA APP
# =============================================================================
step "Construyendo imagen Docker de la app"

cd "$DEPLOY_DIR"
$DC -f docker-compose.app.yml build --no-cache
log "Imagen construida"

# =============================================================================
# 10. INICIAR SUPABASE
# =============================================================================
step "Iniciando Supabase"

cd "$SUPABASE_DIR"
$DC up -d

info "Esperando que PostgreSQL esté listo..."
RETRIES=30
until docker exec "${APP_NAME}-db" pg_isready -U postgres -d postgres &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [[ $RETRIES -eq 0 ]]; then
    error "PostgreSQL no arrancó después de 30 intentos. Revisá los logs: docker logs ${APP_NAME}-db"
  fi
  sleep 3
done
log "PostgreSQL listo"

# =============================================================================
# 11. APLICAR MIGRACIONES
# =============================================================================
step "Aplicando migraciones SQL"

MIGRATION_FILE="${DEPLOY_DIR}/supabase/migrations/00001_initial_schema.sql"
if [[ -f "$MIGRATION_FILE" ]]; then
  # Copiar y ejecutar la migración dentro del contenedor de DB
  docker cp "$MIGRATION_FILE" "${APP_NAME}-db:/tmp/migration.sql"
  docker exec "${APP_NAME}-db" psql -U postgres -d postgres -f /tmp/migration.sql
  log "Migración aplicada"
else
  warn "No se encontró el archivo de migración: $MIGRATION_FILE"
fi

# Migración adicional: crear los roles y usuarios necesarios para Supabase
docker exec "${APP_NAME}-db" psql -U postgres -d postgres <<'SQLEOF' || true
-- Crear roles de Supabase si no existen
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
END
$$;
SQLEOF
log "Roles de Supabase verificados"

# =============================================================================
# 12. INICIAR LA APP
# =============================================================================
step "Iniciando la app React"

cd "$DEPLOY_DIR"
$DC -f docker-compose.app.yml up -d
log "App iniciada en puerto $APP_PORT"

# =============================================================================
# 13. CONFIGURAR REVERSE PROXY
# =============================================================================
step "Configurando reverse proxy"

print_caddy_blocks() {
  local caddy_conf_dir
  caddy_conf_dir=$(dirname "$(find_caddyfile 2>/dev/null || echo '/etc/caddy/Caddyfile')")/conf.d
  echo ""
  echo "  # Crear archivo separado para esta app:"
  echo "  sudo mkdir -p ${caddy_conf_dir}"
  echo "  sudo tee ${caddy_conf_dir}/${APP_NAME}.caddy <<'EOF'"
  echo "  ${APP_DOMAIN} {"
  echo "      reverse_proxy localhost:${APP_PORT}"
  echo "      encode gzip"
  echo "  }"
  echo "  ${SUPABASE_DOMAIN} {"
  echo "      reverse_proxy localhost:${SUPA_API_PORT}"
  echo "  }"
  echo "  ${STUDIO_DOMAIN} {"
  echo "      reverse_proxy localhost:${SUPA_STUDIO_PORT}"
  echo "  }"
  echo "  EOF"
  echo ""
  echo "  # Y agregar al Caddyfile principal (una sola vez):"
  echo "  echo 'import ${caddy_conf_dir}/*.caddy' | sudo tee -a <ruta-del-Caddyfile>"
  echo ""
  echo "  Luego: caddy validate --config <ruta> && sudo systemctl reload caddy"
}

configure_caddy_system() {
  local caddyfile
  caddyfile=$(find_caddyfile)

  if [[ -z "$caddyfile" || ! -f "$caddyfile" ]]; then
    warn "No se encontró el Caddyfile. Agregá los bloques manualmente:"
    print_caddy_blocks
    return
  fi

  log "Caddyfile encontrado: $caddyfile"

  # Directorio conf.d propio de esta app (NO tocar el Caddyfile de AirSync salvo por el import)
  local caddy_dir
  caddy_dir=$(dirname "$caddyfile")
  local confd_dir="${caddy_dir}/conf.d"
  mkdir -p "$confd_dir"

  # Si el Caddyfile aún no importa conf.d, agregamos una sola línea al final
  if ! grep -q "import.*conf\.d" "$caddyfile" 2>/dev/null; then
    local backup_ts
    backup_ts=$(date +%Y%m%d%H%M%S)
    cp "$caddyfile" "${caddyfile}.bak.${backup_ts}"
    info "Backup del Caddyfile: ${caddyfile}.bak.${backup_ts}"
    echo "" >> "$caddyfile"
    echo "import ${confd_dir}/*.caddy" >> "$caddyfile"
    info "Agregado: import ${confd_dir}/*.caddy al Caddyfile"
  fi

  # Escribir el archivo de esta app en conf.d (independiente de AirSync)
  local app_caddy="${confd_dir}/${APP_NAME}.caddy"
  cat > "$app_caddy" <<CADDYEOF
# ${APP_NAME} — generado por deploy.sh el $(date)
${APP_DOMAIN} {
    reverse_proxy localhost:${APP_PORT}
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}

${SUPABASE_DOMAIN} {
    reverse_proxy localhost:${SUPA_API_PORT}
    header {
        Strict-Transport-Security "max-age=31536000;"
    }
}

${STUDIO_DOMAIN} {
    reverse_proxy localhost:${SUPA_STUDIO_PORT}
    header {
        Strict-Transport-Security "max-age=31536000;"
    }
}
CADDYEOF
  log "Config de ${APP_NAME} escrita en: $app_caddy"

  # Validar toda la config antes de recargar
  if caddy validate --config "$caddyfile" 2>/dev/null; then
    systemctl reload caddy
    log "Caddy recargado — SSL automático via ACME"
  else
    warn "La validación de Caddy falló. Eliminando ${app_caddy} y revirtiendo..."
    rm -f "$app_caddy"
    # Revertir el import si lo acabamos de agregar
    if [[ -n "${backup_ts:-}" ]]; then
      cp "${caddyfile}.bak.${backup_ts}" "$caddyfile"
      warn "Caddyfile revertido a .bak.${backup_ts}"
    fi
    warn "Configurá manualmente el archivo: $app_caddy"
    print_caddy_blocks
  fi
}

configure_nginx_system() {
  local nginx_conf_dir="/etc/nginx/sites-available"
  local nginx_enabled_dir="/etc/nginx/sites-enabled"

  # Config para la app
  cat > "${nginx_conf_dir}/${APP_NAME}" <<NGINXEOF
# sitios-web app — generado por deploy.sh
server {
    listen 80;
    server_name ${APP_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

  # Config para Supabase API
  cat > "${nginx_conf_dir}/${APP_NAME}-supabase" <<NGINXEOF2
# sitios-web supabase — generado por deploy.sh
server {
    listen 80;
    server_name ${SUPABASE_DOMAIN};

    # Aumentar límite para uploads
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:${SUPA_API_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINXEOF2

  # Config para Supabase Studio
  cat > "${nginx_conf_dir}/${APP_NAME}-studio" <<NGINXEOF3
# sitios-web studio — generado por deploy.sh
server {
    listen 80;
    server_name ${STUDIO_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${SUPA_STUDIO_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINXEOF3

  ln -sf "${nginx_conf_dir}/${APP_NAME}" "${nginx_enabled_dir}/${APP_NAME}" 2>/dev/null || true
  ln -sf "${nginx_conf_dir}/${APP_NAME}-supabase" "${nginx_enabled_dir}/${APP_NAME}-supabase" 2>/dev/null || true
  ln -sf "${nginx_conf_dir}/${APP_NAME}-studio" "${nginx_enabled_dir}/${APP_NAME}-studio" 2>/dev/null || true

  nginx -t && systemctl reload nginx
  log "nginx (sistema) configurado"

  # SSL con certbot
  if [[ "$SSL_TOOL" == "certbot" ]]; then
    info "Obteniendo certificados SSL con certbot..."
    certbot --nginx -d "$APP_DOMAIN" -d "$SUPABASE_DOMAIN" -d "$STUDIO_DOMAIN" \
      --non-interactive --agree-tos --email "admin@${APP_DOMAIN}" \
      --keep-until-expiring --expand || \
      warn "certbot falló. Configurar SSL manualmente."
    log "SSL configurado"
  elif [[ "$SSL_TOOL" == "acme.sh" ]]; then
    info "Usando acme.sh para SSL. Ejecutá manualmente:"
    echo "  ~/.acme.sh/acme.sh --issue -d ${APP_DOMAIN} -d ${SUPABASE_DOMAIN} -d ${STUDIO_DOMAIN} --nginx"
    echo "  ~/.acme.sh/acme.sh --install-cert -d ${APP_DOMAIN} --nginx"
  fi
}

configure_nginx_docker() {
  local conf_dir="/tmp/${APP_NAME}-nginx"
  mkdir -p "$conf_dir"

  cat > "${conf_dir}/${APP_NAME}.conf" <<NGINXEOF
# sitios-web — generado por deploy.sh
server {
    listen 80;
    server_name ${APP_DOMAIN};
    location / {
        proxy_pass http://host.docker.internal:${APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
server {
    listen 80;
    server_name ${SUPABASE_DOMAIN};
    client_max_body_size 50m;
    location / {
        proxy_pass http://host.docker.internal:${SUPA_API_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
server {
    listen 80;
    server_name ${STUDIO_DOMAIN};
    location / {
        proxy_pass http://host.docker.internal:${SUPA_STUDIO_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINXEOF

  # Copiar la config al contenedor nginx y recargar
  docker cp "${conf_dir}/${APP_NAME}.conf" "${RP_CONTAINER}:/etc/nginx/conf.d/${APP_NAME}.conf"
  docker exec "$RP_CONTAINER" nginx -t && docker exec "$RP_CONTAINER" nginx -s reload
  log "nginx (docker) configurado"
}

configure_traefik() {
  warn "Traefik detectado. Necesitás agregar las labels al docker-compose manualmente."
  info "Agrega estas labels al servicio 'app' en docker-compose.app.yml:"
  cat <<TRAEFIKEOF
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${APP_NAME}.rule=Host(\`${APP_DOMAIN}\`)"
      - "traefik.http.routers.${APP_NAME}.entrypoints=websecure"
      - "traefik.http.routers.${APP_NAME}.tls.certresolver=le"
      - "traefik.http.services.${APP_NAME}.loadbalancer.server.port=80"
TRAEFIKEOF
  info "Y estas para Supabase API:"
  cat <<TRAEFIKEOF2
      - "traefik.http.routers.${APP_NAME}-supa.rule=Host(\`${SUPABASE_DOMAIN}\`)"
      - "traefik.http.routers.${APP_NAME}-supa.entrypoints=websecure"
      - "traefik.http.routers.${APP_NAME}-supa.tls.certresolver=le"
      - "traefik.http.services.${APP_NAME}-supa.loadbalancer.server.port=8000"
TRAEFIKEOF2
  info "Y estas para Supabase Studio:"
  cat <<TRAEFIKEOF3
      - "traefik.http.routers.${APP_NAME}-studio.rule=Host(\`${STUDIO_DOMAIN}\`)"
      - "traefik.http.routers.${APP_NAME}-studio.entrypoints=websecure"
      - "traefik.http.routers.${APP_NAME}-studio.tls.certresolver=le"
      - "traefik.http.services.${APP_NAME}-studio.loadbalancer.server.port=3000"
TRAEFIKEOF3
}

case "$REVERSE_PROXY" in
  nginx-system) configure_nginx_system ;;
  nginx-docker) configure_nginx_docker ;;
  traefik)      configure_traefik ;;
  caddy-system) configure_caddy_system ;;
  caddy-docker)
    warn "Caddy en Docker detectado. Agregá los bloques al Caddyfile del contenedor manualmente:"
    print_caddy_blocks
    ;;
  none)
    # Último intento: re-chequear caddy/nginx por si el detection falló al inicio
    if systemctl is-active --quiet caddy 2>/dev/null || command -v caddy &>/dev/null; then
      REVERSE_PROXY="caddy-system"
      SSL_TOOL="caddy-auto"
      configure_caddy_system
    elif systemctl is-active --quiet nginx 2>/dev/null || command -v nginx &>/dev/null; then
      REVERSE_PROXY="nginx-system"
      SSL_TOOL="certbot"
      configure_nginx_system
    else
      info "No hay reverse proxy. Instalando nginx + certbot..."
      if command -v apt-get &>/dev/null; then
        apt-get update -qq
        apt-get install -y -qq nginx
        apt-get install -y -qq certbot python3-certbot-nginx
      elif command -v yum &>/dev/null; then
        yum install -y -q nginx certbot python3-certbot-nginx
      else
        warn "No se pudo instalar nginx automáticamente."
        warn "  apt-get install -y nginx certbot python3-certbot-nginx"
        break
      fi
      systemctl enable nginx 2>/dev/null || true
      systemctl start nginx  2>/dev/null || true
      REVERSE_PROXY="nginx-system"
      SSL_TOOL="certbot"
      configure_nginx_system
    fi
    ;;
esac

# =============================================================================
# 14. GUARDAR RESUMEN
# =============================================================================
SUMMARY_FILE="${DEPLOY_DIR}/deploy-info.txt"
cat > "$SUMMARY_FILE" <<SUMEOF
╔══════════════════════════════════════════════════════╗
║          sitios-web — Deploy Info                    ║
╚══════════════════════════════════════════════════════╝

Fecha de deploy: $(date)
Directorio:      ${DEPLOY_DIR}

── App ──────────────────────────────────────────────
  URL:            https://${APP_DOMAIN}
  Puerto interno: ${APP_PORT}
  Container:      ${APP_NAME}-app

── Supabase API ─────────────────────────────────────
  URL:            https://${SUPABASE_DOMAIN}
  Puerto interno: ${SUPA_API_PORT}

── Supabase Studio ──────────────────────────────────
  URL:            https://${STUDIO_DOMAIN}
  Puerto interno: ${SUPA_STUDIO_PORT}

── Supabase DB ──────────────────────────────────────
  Host: 127.0.0.1:${SUPA_DB_PORT}
  DB:   postgres
  User: postgres

── Credenciales (ver también ${SUPABASE_DIR}/.secrets) ──
  ANON_KEY:         ${ANON_KEY}
  SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
  Dashboard user:   ${DASHBOARD_USERNAME}
  Dashboard pass:   ${DASHBOARD_PASSWORD}

── Comandos útiles ───────────────────────────────────
  Ver logs app:       docker logs -f ${APP_NAME}-app
  Ver logs Supabase:  docker logs -f ${APP_NAME}-kong
  Ver logs DB:        docker logs -f ${APP_NAME}-db
  Detener todo:       cd ${SUPABASE_DIR} && ${DC} down
                      cd ${DEPLOY_DIR} && ${DC} -f docker-compose.app.yml down
  Re-deploy:          sudo ${DEPLOY_DIR}/deploy.sh
SUMEOF

chmod 600 "$SUMMARY_FILE"

# =============================================================================
# RESUMEN FINAL
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   Deploy completado exitosamente!                    ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}App:${NC}            https://${APP_DOMAIN}"
echo -e "  ${BOLD}Supabase API:${NC}   https://${SUPABASE_DOMAIN}"
echo -e "  ${BOLD}Studio:${NC}         https://${STUDIO_DOMAIN}"
echo ""
echo -e "  ${BOLD}Info completa:${NC}  ${SUMMARY_FILE}"
echo ""
echo -e "${YELLOW}[!] Los secrets están en: ${SUPABASE_DIR}/.secrets${NC}"
echo -e "${YELLOW}[!] Guardá ese archivo en un lugar seguro.${NC}"
echo ""
