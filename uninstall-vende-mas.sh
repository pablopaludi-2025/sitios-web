#!/bin/bash
# =============================================================================
#  uninstall-vende-mas.sh — Elimina la app "Vendé más IA" del servidor
#
#  Elimina ÚNICAMENTE recursos con prefijo "vende-mas-":
#    - Contenedores Docker (app + Supabase)
#    - Volúmenes Docker (datos de DB, storage, funciones)
#    - Redes Docker
#    - Imagen Docker
#    - Directorio /opt/vende-mas/
#    - Configuración de Caddy o nginx para los dominios de esta app
#
#  NO toca: otros Supabase, AirSync, Caddy/nginx como servicio, ni
#            ningún recurso Docker sin el prefijo "vende-mas-".
#
#  Uso:
#    bash uninstall-vende-mas.sh            # interactivo (pide confirmación)
#    bash uninstall-vende-mas.sh --dry-run  # muestra qué haría, sin ejecutar
# =============================================================================

set -euo pipefail

# ── Configuración ─────────────────────────────────────────────────────────────
DEPLOY_DIR="/opt/vende-mas"
APP_NAME="vende-mas"

# Dominios asociados (para info; Caddy/nginx se detecta por nombre de archivo)
APP_DOMAIN="dev.vendemas.soynico.ai"
SUPABASE_DOMAIN="api.dev.vendemas.soynico.ai"
STUDIO_DOMAIN="studio.dev.vendemas.soynico.ai"

# ── Modo dry-run ──────────────────────────────────────────────────────────────
DRY_RUN=false
for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

# ── Helpers ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC}  $*"; }
err()  { echo -e "${RED}[ERR ]${NC}  $*"; }

run() {
  if $DRY_RUN; then
    echo -e "${YELLOW}[DRY-RUN]${NC} $*"
  else
    eval "$@"
  fi
}

# ── Encabezado ────────────────────────────────────────────────────────────────
echo ""
echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║        DESINSTALACIÓN DE "Vendé más IA"                      ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

if $DRY_RUN; then
  warn "MODO DRY-RUN — no se ejecuta nada, sólo se muestra qué haría el script."
  echo ""
fi

# ── 1. Inventario — mostrar qué se va a eliminar ──────────────────────────────
echo -e "${CYAN}═══ RECURSOS QUE SERÁN ELIMINADOS ═══════════════════════════${NC}"
echo ""

# Contenedores
echo "📦 Contenedores (prefijo: ${APP_NAME}-):"
CONTAINERS=$(docker ps -a --filter "name=${APP_NAME}-" --format "  • {{.Names}} ({{.Status}})" 2>/dev/null || true)
[ -n "$CONTAINERS" ] && echo "$CONTAINERS" || echo "  (ninguno encontrado)"

# Volúmenes
echo ""
echo "💾 Volúmenes Docker:"
VOLUMES=$(docker volume ls --filter "name=${APP_NAME}-" --format "  • {{.Name}}" 2>/dev/null || true)
[ -n "$VOLUMES" ] && echo "$VOLUMES" || echo "  (ninguno encontrado)"

# Redes
echo ""
echo "🌐 Redes Docker:"
NETWORKS=$(docker network ls --filter "name=${APP_NAME}-" --format "  • {{.Name}}" 2>/dev/null || true)
[ -n "$NETWORKS" ] && echo "$NETWORKS" || echo "  (ninguna encontrada)"

# Imagen
echo ""
echo "🐳 Imagen Docker:"
IMAGE=$(docker images "${APP_NAME}:latest" --format "  • {{.Repository}}:{{.Tag}} ({{.Size}})" 2>/dev/null || true)
[ -n "$IMAGE" ] && echo "$IMAGE" || echo "  (no encontrada)"

# Directorio
echo ""
echo "📁 Directorio de deploy:"
if [ -d "$DEPLOY_DIR" ]; then
  SIZE=$(du -sh "$DEPLOY_DIR" 2>/dev/null | cut -f1 || echo "?")
  echo "  • $DEPLOY_DIR ($SIZE)"
else
  echo "  (no existe)"
fi

# Configuración reverse proxy
echo ""
echo "🔧 Configuración reverse proxy:"
RP_FOUND=false

# Caddy
for confd in \
    "/opt/airsync/deployment/conf.d" \
    "/etc/caddy/conf.d" \
    "/usr/local/etc/caddy/conf.d"; do
  if [ -f "${confd}/${APP_NAME}.caddy" ]; then
    echo "  • ${confd}/${APP_NAME}.caddy  [Caddy]"
    RP_FOUND=true
    CADDY_CONFD="$confd"
  fi
done

# nginx
for f in \
    "/etc/nginx/sites-available/${APP_NAME}" \
    "/etc/nginx/sites-available/${APP_NAME}-supabase" \
    "/etc/nginx/sites-available/${APP_NAME}-studio" \
    "/etc/nginx/sites-enabled/${APP_NAME}" \
    "/etc/nginx/sites-enabled/${APP_NAME}-supabase" \
    "/etc/nginx/sites-enabled/${APP_NAME}-studio"; do
  if [ -f "$f" ] || [ -L "$f" ]; then
    echo "  • $f  [nginx]"
    RP_FOUND=true
  fi
done

$RP_FOUND || echo "  (ninguna encontrada)"

# Dominios
echo ""
echo "🌍 Dominios que dejarán de funcionar:"
echo "  • $APP_DOMAIN"
echo "  • $SUPABASE_DOMAIN"
echo "  • $STUDIO_DOMAIN"

echo ""
echo -e "${RED}⚠️  ADVERTENCIA: Los volúmenes de base de datos se eliminarán${NC}"
echo -e "${RED}   de forma PERMANENTE e IRRECUPERABLE.${NC}"
echo ""

# ── 2. Confirmar ──────────────────────────────────────────────────────────────
if ! $DRY_RUN; then
  echo -e "Para continuar, escribí ${RED}ELIMINAR${NC} (en mayúsculas) y presioná Enter:"
  read -r CONFIRM
  if [[ "$CONFIRM" != "ELIMINAR" ]]; then
    echo ""
    warn "Cancelado. No se eliminó nada."
    exit 0
  fi
fi

echo ""
echo -e "${CYAN}═══ EJECUTANDO LIMPIEZA ═══════════════════════════════════════${NC}"
echo ""

# ── 3. Detener contenedores vía docker compose (más limpio) ───────────────────
if [ -f "$DEPLOY_DIR/docker-compose.app.yml" ]; then
  log "Deteniendo contenedor de la app..."
  run "docker compose -f '$DEPLOY_DIR/docker-compose.app.yml' down --remove-orphans 2>/dev/null || true"
fi

if [ -f "$DEPLOY_DIR/supabase-stack/docker-compose.yml" ]; then
  log "Deteniendo stack de Supabase..."
  run "docker compose -f '$DEPLOY_DIR/supabase-stack/docker-compose.yml' down --volumes --remove-orphans 2>/dev/null || true"
fi

# ── 4. Limpieza residual (por si los compose files ya no existen) ──────────────
log "Eliminando contenedores residuales con prefijo '${APP_NAME}-'..."
run "docker ps -a --filter 'name=${APP_NAME}-' -q | xargs -r docker rm -f 2>/dev/null || true"

log "Eliminando volúmenes residuales con prefijo '${APP_NAME}-'..."
run "docker volume ls --filter 'name=${APP_NAME}-' -q | xargs -r docker volume rm 2>/dev/null || true"

log "Eliminando redes residuales con prefijo '${APP_NAME}-'..."
run "docker network ls --filter 'name=${APP_NAME}-' -q | xargs -r docker network rm 2>/dev/null || true"

log "Eliminando imagen '${APP_NAME}:latest'..."
run "docker image rm '${APP_NAME}:latest' 2>/dev/null || true"

# ── 5. Eliminar directorio de deploy ──────────────────────────────────────────
if [ -d "$DEPLOY_DIR" ] || $DRY_RUN; then
  log "Eliminando directorio $DEPLOY_DIR..."
  run "rm -rf '$DEPLOY_DIR'"
fi

# ── 6. Limpiar Caddy ──────────────────────────────────────────────────────────
CADDY_CONFD=""
for confd in \
    "/opt/airsync/deployment/conf.d" \
    "/etc/caddy/conf.d" \
    "/usr/local/etc/caddy/conf.d"; do
  if [ -f "${confd}/${APP_NAME}.caddy" ]; then
    CADDY_CONFD="$confd"
    break
  fi
done

if [ -n "$CADDY_CONFD" ] || $DRY_RUN; then
  if [ -n "$CADDY_CONFD" ]; then
    log "Eliminando ${CADDY_CONFD}/${APP_NAME}.caddy..."
    run "rm -f '${CADDY_CONFD}/${APP_NAME}.caddy'"

    # Si quedan 0 archivos .caddy, limpiar línea import del Caddyfile principal
    REMAINING=$(find "$CADDY_CONFD" -name "*.caddy" 2>/dev/null | wc -l || echo 0)
    if [ "$REMAINING" -eq 0 ]; then
      # Buscar el Caddyfile que importa este directorio
      CADDYFILE=""
      for cf in \
          "/opt/airsync/deployment/Caddyfile" \
          "/etc/caddy/Caddyfile" \
          "/usr/local/etc/caddy/Caddyfile"; do
        if [ -f "$cf" ] && grep -q "import.*conf.d" "$cf" 2>/dev/null; then
          CADDYFILE="$cf"
          break
        fi
      done
      if [ -n "$CADDYFILE" ]; then
        log "Eliminando línea 'import conf.d/*.caddy' del Caddyfile (directorio vacío)..."
        run "sed -i '/import.*conf\.d.*\.caddy/d' '$CADDYFILE'"
      fi
    fi

    log "Recargando Caddy..."
    run "systemctl reload caddy 2>/dev/null || caddy reload 2>/dev/null || true"
  fi
fi

# ── 7. Limpiar nginx ──────────────────────────────────────────────────────────
NGINX_CHANGED=false
for site in "${APP_NAME}" "${APP_NAME}-supabase" "${APP_NAME}-studio"; do
  for dir in "/etc/nginx/sites-available" "/etc/nginx/sites-enabled"; do
    if [ -f "${dir}/${site}" ] || [ -L "${dir}/${site}" ]; then
      log "Eliminando ${dir}/${site}..."
      run "rm -f '${dir}/${site}'"
      NGINX_CHANGED=true
    fi
  done
done

if $NGINX_CHANGED; then
  log "Recargando nginx..."
  run "nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true"
fi

# ── 8. Verificación final ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══ VERIFICACIÓN ══════════════════════════════════════════════${NC}"
echo ""

if ! $DRY_RUN; then
  C=$(docker ps -a --filter "name=${APP_NAME}-" -q 2>/dev/null | wc -l)
  V=$(docker volume ls --filter "name=${APP_NAME}-" -q 2>/dev/null | wc -l)
  N=$(docker network ls --filter "name=${APP_NAME}-" -q 2>/dev/null | wc -l)

  [ "$C" -eq 0 ] && ok "Contenedores: ninguno con prefijo ${APP_NAME}-" \
                 || warn "Aún existen $C contenedor(es) con prefijo ${APP_NAME}-"

  [ "$V" -eq 0 ] && ok "Volúmenes: ninguno con prefijo ${APP_NAME}-" \
                 || warn "Aún existen $V volumen(es) con prefijo ${APP_NAME}-"

  [ "$N" -eq 0 ] && ok "Redes: ninguna con prefijo ${APP_NAME}-" \
                 || warn "Aún existen $N red(es) con prefijo ${APP_NAME}-"

  [ ! -d "$DEPLOY_DIR" ] && ok "Directorio $DEPLOY_DIR: eliminado" \
                          || warn "Directorio $DEPLOY_DIR aún existe"
fi

echo ""
echo -e "${GREEN}✅  Desinstalación completada.${NC}"
echo ""
echo "   Recursos NO afectados:"
echo "   • Otros Supabase / apps en el servidor"
echo "   • Caddy/nginx como servicio del sistema"
echo "   • Certificados SSL de otros dominios"
echo ""
