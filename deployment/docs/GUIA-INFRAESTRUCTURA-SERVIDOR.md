# Guía de Infraestructura del Servidor para Nueva Aplicación

**Fecha de Actualización:** Marzo 2026
**Aplicación Existente:** AirSync Property Management
**Propósito:** Deployar una segunda aplicación en el mismo servidor sin conflictos

---

## Resumen del Servidor

- **Sistema Operativo:** Ubuntu 22.04 LTS (Linux 4.4.0)
- **Aplicaciones Deployadas:**
  1. AirSync — Sistema de gestión de propiedades (`/opt/airsync/`)
- **Recursos Mínimos Recomendados:** 8GB RAM, 4 cores CPU, 80GB disco
- **Plataforma de Deployment:** Coolify (PaaS containerizada)

---

## Software Ya Instalado (REUTILIZABLE)

> **Importante:** Los siguientes componentes YA están instalados. NO necesitas reinstalarlos.

### Runtime y Build Tools
- **Docker** + Docker Compose
- **Node.js v20**
- **Bun** (runtime alternativo, más rápido que Node)
- **PM2** (process manager para Node.js)
- **Nixpacks** (build automático para Coolify)

### Web Servers y Reverse Proxy
- **Caddy** — Reverse proxy principal con **auto-HTTPS via ACME** (Let's Encrypt)
- **Certbot** — También instalado (pero Caddy gestiona SSL automáticamente)

### Herramientas del Sistema
- Git, curl, wget, Python3, PyYAML, UFW, build-essential

---

## Puertos en Uso por AirSync (NO USAR)

### Puertos Públicos
| Puerto | Servicio |
|--------|---------|
| 80 / 443 | HTTP/HTTPS (Caddy reverse proxy) |
| 8000 | Kong API Gateway (Supabase API) |

### Puertos Internos Docker (Supabase de AirSync)
| Puerto | Servicio |
|--------|---------|
| 5432 | PostgreSQL |
| 9999 | GoTrue (autenticación) |
| 3000 | PostgREST + Studio |
| 5000 | Storage API |
| 9000 | Edge Functions (Deno) |
| 4000 | Logflare / Supavisor |
| 8080 | postgres-meta |
| 9001 | MinIO |

### Puertos Sugeridos para la Nueva Aplicación
| Servicio | Puerto Sugerido |
|---------|----------------|
| Kong API Gateway | 8001 |
| PostgreSQL | 5433 |
| GoTrue Auth | 9998 |
| PostgREST | 3001 |
| Storage API | 5001 |
| Edge Functions | 9002 |
| Studio | 3002 |
| postgres-meta | 8081 |
| Logflare | 4001 |
| Supavisor | 4002 |
| MinIO | 9003 / 9004 |
| App frontend | 5173 (Vite) o 5000 |

---

## Dominios y Configuración SSL

### Dominios Actuales de AirSync
- `app.chenant.com` → Frontend (React SPA)
- `api.app.chenant.com` → Kong Gateway (API Supabase)
- `studio.app.chenant.com` → Supabase Studio

### Caddyfile — Ubicación
```
/opt/airsync/deployment/Caddyfile
```

### Configuración Actual (Referencia)
```caddyfile
app.chenant.com {
    root * /opt/airsync/app/dist
    file_server
    try_files {path} {path}/ /index.html
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
}

api.app.chenant.com {
    reverse_proxy localhost:8000
}

studio.app.chenant.com {
    reverse_proxy localhost:8000
}
```

### Agregar Nueva App — Archivo Separado (conf.d)

Cada app tiene su **propio archivo Caddy** en `conf.d/`. El Caddyfile de AirSync
se toca **una sola vez** para agregar el `import`.

**Paso 1 — Solo la primera vez (si no existe el import):**
```bash
# Agregar al final del Caddyfile de AirSync
echo "import /opt/airsync/deployment/conf.d/*.caddy" \
  | sudo tee -a /opt/airsync/deployment/Caddyfile
```

**Paso 2 — Para cada nueva app, crear su propio archivo:**
```bash
sudo mkdir -p /opt/airsync/deployment/conf.d

sudo tee /opt/airsync/deployment/conf.d/nueva-app.caddy <<'EOF'
nueva-app.chenant.com {
    reverse_proxy localhost:3150
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
}

api.nueva-app.chenant.com {
    reverse_proxy localhost:8001
}

studio.nueva-app.chenant.com {
    reverse_proxy localhost:3002
}
EOF
```

**Paso 3 — Validar y recargar:**
```bash
caddy validate --config /opt/airsync/deployment/Caddyfile
sudo systemctl reload caddy
```

> El deploy.sh hace esto automáticamente. El Caddyfile de AirSync nunca se modifica
> más allá de agregar la línea `import conf.d/*.caddy` (solo una vez).

---

## Estructura de Directorios

### AirSync (NO MODIFICAR)
```
/opt/airsync/
├── app/dist/                  # Frontend compilado
├── deployment/
│   ├── Caddyfile              # Reverse proxy (compartido)
│   ├── docker-compose.coolify.yml
│   ├── docker-compose.supabase.yml
│   ├── kong.yml
│   ├── roles.sql
│   └── [scripts de deployment]
├── supabase/
│   ├── functions/             # Edge functions (Deno)
│   └── migrations/
└── .env.production
```

### Ubicación Sugerida para la Nueva App
```
/opt/<nombre-nueva-app>/
├── app/dist/
├── deployment/
│   └── docker-compose.yml     # Puertos únicos
├── supabase/
└── .env.production
```

---

## Docker y Redes

### Contenedores Existentes de AirSync
```
supabase-db, supabase-auth, supabase-rest, supabase-storage,
supabase-kong, supabase-studio, supabase-functions,
supabase-analytics, supabase-meta, supabase-pooler,
supabase-minio, supabase-imgproxy, supabase-vector
```

### Para la Nueva Aplicación
```bash
# Crear red separada
docker network create nueva-app_network
```

En `docker-compose.yml`:
```yaml
networks:
  nueva-app_network:
    driver: bridge

services:
  db:
    container_name: nueva-app-db       # nombre ÚNICO
    ports:
      - "5433:5432"                    # puerto externo DIFERENTE
    networks:
      - nueva-app_network
```

**Reglas de oro:**
1. Nombres de contenedores únicos (`nueva-app-` como prefijo)
2. Red Docker separada (NO usar `supabase_default`)
3. Volúmenes únicos (`nueva-app-db-data`, etc.)
4. Puertos externos diferentes (ver tabla de puertos)

---

## Supabase — INSTANCIA INDEPENDIENTE REQUERIDA

> **CRITICO:** NO reutilizar la instancia de Supabase de AirSync.

### Generar Secrets Únicos
```bash
# PostgreSQL password
openssl rand -base64 32

# JWT Secret
openssl rand -base64 32

# Usar el generador de AirSync como referencia
node /opt/airsync/deployment/generate-supabase-keys.js
```

Variables críticas a generar nuevas:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`
- `DASHBOARD_PASSWORD`

---

## Variables de Entorno

### Para la Nueva App
```bash
# Frontend
VITE_SUPABASE_URL=https://api.nueva-app.chenant.com
VITE_SUPABASE_PUBLISHABLE_KEY=<tu-nuevo-anon-key>
VITE_APP_DOMAIN=https://nueva-app.chenant.com

# Backend (secrets nuevos, no copiar de AirSync)
POSTGRES_PASSWORD=<nuevo-secret>
JWT_SECRET=<nuevo-secret>
```

---

## Comandos Útiles

```bash
# Ver puertos en uso
sudo lsof -i -P -n | grep LISTEN
sudo netstat -tulpn | grep LISTEN

# Ver contenedores activos
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"

# Ver redes Docker
docker network ls

# Verificar Caddyfile
caddy validate --config /opt/airsync/deployment/Caddyfile
sudo systemctl status caddy

# Ver logs de contenedor
docker logs <container-name> --tail 100 --follow

# Ver espacio en disco
df -h
docker system df
```

---

## Checklist Pre-Deployment

- [ ] Puertos verificados (no en uso por AirSync)
- [ ] Directorio creado en `/opt/<nueva-app>/`
- [ ] Subdominios DNS configurados (A record → IP del servidor)
- [ ] `docker-compose.yml` con puertos y nombres únicos
- [ ] Red Docker separada creada
- [ ] Volúmenes con nombres únicos
- [ ] Secrets generados (JWT, passwords, API keys NUEVOS)
- [ ] Caddyfile actualizado (bloques agregados al final, validado)
- [ ] `.env.production` con URLs y keys correctas
- [ ] Backup del Caddyfile hecho antes de modificar

---

## ADVERTENCIAS CRÍTICAS

### NO HACER
1. NO modificar `/opt/airsync/` ni sus subdirectorios
2. NO usar los mismos puertos que AirSync
3. NO reutilizar la instancia de Supabase de AirSync
4. NO copiar los secrets/passwords de AirSync
5. NO usar la red Docker `supabase_default` o `airsync_default`
6. NO editar el Caddyfile sin hacer backup primero
7. NO commitear archivos `.env` al repositorio

### SÍ HACER
1. SÍ usar puertos completamente diferentes
2. SÍ crear red Docker separada
3. SÍ generar secrets únicos
4. SÍ usar nombres de contenedores con prefijo único
5. SÍ validar el Caddyfile antes de recargar Caddy
6. SÍ verificar logs después de cada deployment

---

## Archivos de Referencia de AirSync

> Podés leer estos para entender patrones, pero **NO modificarlos**.

- `/opt/airsync/deployment/Caddyfile` — Reverse proxy y SSL
- `/opt/airsync/deployment/docker-compose.supabase.yml` — Compose Supabase completo
- `/opt/airsync/deployment/kong.yml` — Kong Gateway
- `/opt/airsync/deployment/roles.sql` — Roles PostgreSQL
- `/opt/airsync/deployment/generate-supabase-keys.js` — Generador de secrets

---

## Troubleshooting

| Problema | Causa | Solución |
|---------|-------|---------|
| "Port already in use" | Puerto ocupado por AirSync | `sudo lsof -i :<puerto>` → usar otro puerto |
| "Container name already exists" | Nombre duplicado | Usar prefijo único (`nueva-app-db`) |
| "Network not found" | Red Docker no creada | `docker network create nueva-app_network` |
| "SSL certificate error" | DNS incorrecto | Verificar que subdominio apunte al IP del servidor |
| "Cannot connect to database" | Puerto incorrecto | Verificar `docker ps` y `docker logs <db>` |
| Caddy no recarga | Config inválida | `caddy validate --config <path>` antes de recargar |
