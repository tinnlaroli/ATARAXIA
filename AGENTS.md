# AGENTS.md — ATARAXIA

## Project overview

Multi-service Docker Compose stack (proyecto `ataraxia`). Puertos distintos a SMARTUR para poder correr ambos en el mismo host.

Servicios en `docker-compose.yml` raíz:
- **API** (Node.js/Express 5) — expuesto en host **4100** (nginx → contenedor `api:3000`)
- **PLATAFORMA** (React/Vite) — **8080** (nginx → `plataforma:5173`)
- **LANDING** (Astro) — **4322** (nginx → `landing:4321`)
- **MODELO** (FastAPI wellness) — **8100** (clasificador estrés + match destinos)
- **postgres** — solo red interna en compose raíz; en `API/docker-compose.yml` host **5433**

Stack opcional en `API/docker-compose.yml`: **redis** (6381), **grafana** (4101).

Copia `.env.example` → `.env` para cambiar puertos sin editar YAML.

## Key commands

```bash
# Start all services (from project root)
docker compose up -d

# Logs MODELO wellness
docker logs -f ataraxia-modelo

# Build and restart a specific service
docker compose build <service> && docker compose up -d <service>

# View logs
docker logs ataraxia-api
docker logs ataraxia-plataforma

# Apply DB schema from scratch (wipes data)
Get-Content "API/bd.sql" | docker exec -i ataraxia-postgres psql -U postgres -d ataraxia
```

## Services and ports

| Service | Container | Host port (default) |
|---------|-----------|---------------------|
| PLATAFORMA (nginx) | ataraxia-nginx → plataforma | 8080 |
| LANDING (nginx) | ataraxia-nginx → landing | 4322 |
| API (nginx) | ataraxia-nginx → api | 4100 |
| MODELO (nginx) | ataraxia-nginx → modelo | 8100 |
| postgres | ataraxia-postgres | (internal; 5433 en API compose) |
| redis | ataraxia-redis | 6381 (`API/docker-compose.yml`) |
| grafana | ataraxia-grafana | 4101 (`API/docker-compose.yml`) |

## Architecture notes

- **API prefix**: All routes served under `/api/v2/`
- **Frontend proxy**: nginx raíz en `:4100` → `http://api:3000`; landing en `:4322` proxy `/api/v2/` → `api:3000`
- **Database source of truth**: `API/bd.sql` is the single schema file — no migration files. Any DB change must be applied to local Docker, production VPS (`ssh root@2.24.112.25`), and `bd.sql` simultaneously.
- **DB init**: `bd.sql` is auto-imported when `postgres_data` volume is first created
- **MODELO bootstrap**: Sync `destinos_wellness.csv` → Postgres; carga/entrena `stress_profile_rf.joblib` si falta (ver `MODELO/AGENTS.md`)
- **Express 5**: Does NOT support wildcard routes `app.options('*', ...)` — use `app.options(app.router, cors(corsOptions))`
- **PLATAFORMA build**: Uses `npx vite build` (not `npm run build`) in Docker to skip TypeScript strict checking
- **LANDING build**: Uses npm in Docker (not pnpm) to avoid pnpm script restrictions

## Database

- **Schema file**: `API/bd.sql` — full schema + seed data, no separate migration files
- **Apply schema changes** (must run on all 3 targets):
  1. Local: `Get-Content "API/bd.sql" | docker exec -i ataraxia-postgres psql -U postgres -d ataraxia`
  2. VPS: ajustar contenedor/DB del despliegue ATARAXIA (SMARTUR en VPS sigue en `/opt/SMARTUR`)
  3. Edit `API/bd.sql` to include the change
- **Test users**:
  - `turista@smartur.demo` / `Password1a` (role 2: tourist user)
  - `martinlaraolivares@gmail.com` / `Password1a` (role 1: admin)

## API route groups

| Router file | Mount prefix | Auth |
|-------------|-------------|------|
| `userRoutes.js` | `/api/v2/` | mixed |
| `companyRoutes.js` | `/api/v2/` | verifyToken |
| `touristServicesRoutes.js` | `/api/v2/` | verifyToken |
| `locationRoutes.js` | `/api/v2/` | verifyToken |
| `pointOfInterestRoutes.js` | `/api/v2/` | verifyToken |
| `travelerProfileRoutes.js` | `/api/v2/` | verifyToken |
| `touristActivitiesRoutes.js` | `/api/v2/` | verifyToken |
| `serviceCertificationRoutes.js` | `/api/v2/` | verifyToken |
| `contactRoutes.js` | `/api/v2/` | public POST, verifyToken GET/PATCH/DELETE |
| `interactionRoutes.js` | `/api/v2/` | verifyToken |
| `mlRoutes.js` | `/api/v2/` | verifyToken |
| `dashboardRoutes.js` | `/api/v2/` | verifyToken |
| `userContentRoutes.js` | `/api/v2/` | verifyToken |
| `securityRoutes.js` | `/api/v2/` | verifyToken |

**Contact routes** (no email notifications — contacts managed from dashboard only):
- `POST /api/v2/contact` — public, saves contact form submission
- `GET /api/v2/contact-subscriptions` — admin, paginated list
- `PATCH /api/v2/contact-subscriptions/:id/status` — update status (pending/in_progress/done/dismissed)
- `DELETE /api/v2/contact-subscriptions/:id` — delete record

**ML data collection routes**:
- `POST /api/v2/me/interactions` — batch implicit event ingestion (dwell, detail_open, skip, filter_click)
- `POST /api/v2/me/rating` — upsert explicit star rating (1–5)
- `GET /api/v2/recommendations/:userId` — proxied MODELO call with session logging
- `GET /api/v2/ml/health` — model metrics + daily sessions + CTR for dashboard

## MODELO (Wellness ML)

See `MODELO/AGENTS.md`. Key endpoints (host `:8100`):
- `POST /recommend/{user_id}` — body `{ q1, q2, q3, q4, top_n }` → perfil de estrés + Top-N destinos con `match_pct`
- `GET /metrics` — accuracy / macro-F1 del clasificador
- `POST /train-stress` — reentrenar clasificador

## Common issues

1. **API crashes on start**: `PathError: Missing parameter name at index 1: *` → check `API/index.js` for `app.options('*', ...)` — remove for Express 5 compatibility
2. **DB tables missing**: Delete volume and recreate (`docker compose down -v && docker compose up`) or import manually: `Get-Content "API/bd.sql" | docker exec -i ataraxia-postgres psql -U postgres -d ataraxia`
3. **MODELO sin modelo**: Ejecutar `docker exec ataraxia-modelo python -m stress_classifier --train` o aplicar `API/migrations/001_wellness_tables.sql` si falta catálogo en BD
4. **405 on API calls from PLATAFORMA**: Verify nginx proxy en `nginx/nginx.conf` y puertos en `.env`
5. **Port/name conflicts with SMARTUR**: ATARAXIA usa `ataraxia-*` y puertos 8080/4322/4100/8100 por defecto — ver `.env.example`
6. **VPS SMARTUR**: `/opt/SMARTUR` — no mezclar con este stack local sin cambiar nombres/puertos

## Project structure

```
DEVELOPMENT/
├── docker-compose.yml    # Main compose file
├── .env                  # Shared env defaults
├── AGENTS.md             # This file
├── API/                  # Node.js Express API
│   ├── bd.sql            # Complete DB schema (single source of truth)
│   ├── index.js          # Express app + route mounts
│   ├── routes/           # Route handlers (24 files)
│   ├── middleware/       # Auth, rate limiting
│   ├── utils/            # mailer, helpers
│   └── Dockerfile
├── PLATAFORMA/           # React 19 + Vite dashboard
│   ├── src/features/     # Feature modules by domain
│   ├── nginx.conf
│   └── Dockerfile
├── LANDING/              # Astro 5 + React marketing site
│   ├── src/
│   ├── nginx.conf
│   └── Dockerfile
├── MODELO/               # Python FastAPI ML service
│   ├── AGENTS.md         # Detailed MODELO docs
│   ├── src/
│   └── Dockerfile
├── MOBILE/               # Flutter mobile app
│   ├── lib/
│   └── pubspec.yaml
└── BD/                   # Database documentation (PDF)
```
