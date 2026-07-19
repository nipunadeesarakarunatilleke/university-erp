# Deployment Instructions — University ERP

Standalone deployment guide for the University ERP microservice system. For architecture background, see `README.md` and `deliverable-docs/1. Architecture Design Document.docx`.

This guide covers **local Docker Compose deployment only** — the only deployment target this project actually implements. See [Production Gap Notes](#production-gap-notes) at the end for what a real production deployment would still need.

---

## Quick Reference

```bash
cp .env.example .env                    # 1. configure secret
docker compose up --build -d            # 2. build + start all 9 containers
docker compose ps                       # 3. verify all show "Up" / "healthy"
curl -X POST http://localhost:3007/api/auth/seed   # 4. seed demo users
open http://localhost:8080              # 5. open the app
```

| Component | Container | Host Port | Depends On |
|---|---|---|---|
| Frontend (static SPA) | `frontend` (nginx:alpine) | 8080 | student-service, exam-service (started) |
| Auth Service | `auth-service` | 3007 | mongodb (healthy) |
| Student Service | `student-service` | 3001 | mongodb (healthy) |
| Exam Service | `exam-service` | 3003 | mongodb (healthy), student-service (started) |
| Result Service | `result-service` | 3004 | mongodb (healthy) |
| Transcript Service | `transcript-service` | 3005 | mongodb (healthy), student-service, result-service (started) |
| Notification Service | `notification-service` | 3006 | mongodb (healthy) |
| MongoDB 7 | `mongodb` | 27017 | — |
| Kafka 3.7 (KRaft) | `kafka` | 9092 (internal), 9094 (external) | — |

**Not deployed** — Course Service (:3002) and Reporting Service (:3008) are designed but have no Dockerfile, no `services/` directory, and no `docker-compose.yml` entry. Nothing below starts them.

---

## 1. Prerequisites

| Requirement | Why |
|---|---|
| Docker Desktop 4.x+ (or Docker Engine + Compose plugin v2) | This guide uses `docker compose` (space) — the v2 CLI syntax, not the deprecated `docker-compose` binary |
| Git | To clone the repository |
| ~4 GB free RAM, ~2 GB free disk | 9 containers: MongoDB, Kafka, 6 Node services, nginx, plus their images |
| The following host ports free | `8080`, `27017`, `9092`, `9094`, `3001`, `3003`, `3004`, `3005`, `3006`, `3007` |

Check for port conflicts before starting:

```bash
lsof -iTCP -sTCP:LISTEN -P | grep -E '8080|27017|9092|9094|300[1-7]'
```

---

## 2. Clone and Configure

```bash
git clone https://github.com/nipunadeesarakarunatilleke/university-erp.git
cd university-erp

cp .env.example .env
```

Edit `.env` and set a real secret:

```bash
JWT_SECRET=$(openssl rand -hex 32)
```

`.env` is gitignored — only `.env.example` (which contains a placeholder, not a real secret) is committed. `JWT_SECRET` is the single value every one of the six services independently uses to sign/verify JWTs; there is no shared session store or secrets vault in this local setup.

### Environment Variable Reference

All variables below are already wired in `docker-compose.yml` — this table is for understanding what each service receives, not something you need to edit by hand.

| Service | Variable | Value | Purpose |
|---|---|---|---|
| All 6 services | `PORT` | service-specific (3001/3003/…/3007) | Port the Express app listens on inside the container |
| All 6 services | `MONGO_URI` | `mongodb://mongodb:27017/<db_name>` | Own logical database — see table below |
| All 6 services | `JWT_SECRET` | from `.env` | Shared signing/verification key |
| student-service, exam-service, result-service | `KAFKA_BROKER` | `kafka:9092` | Kafka producer connection |
| exam-service | `STUDENT_SERVICE_URL` | `http://student-service:3001` | Sync REST call to verify a student before creating an entry |
| transcript-service | `STUDENT_SERVICE_URL` | `http://student-service:3001` | Sync REST call to fetch student profile |
| transcript-service | `RESULT_SERVICE_URL` | `http://result-service:3004` | Sync REST call to fetch grades/GPA |

| Service | Database |
|---|---|
| auth-service | `auth_db` |
| student-service | `students_db` |
| exam-service | `exams_db` |
| result-service | `results_db` |
| transcript-service | *(none — pure aggregator)* |
| notification-service | `notif_db` |

All six databases live on the **same** `mongo:7` container (`mongodb` service) — logically isolated by database name, not physically separate instances. See Architecture Design Document §6 for the database-per-service rationale.

---

## 3. Start the Stack

```bash
docker compose up --build -d
```

- First run pulls `mongo:7`, `apache/kafka:3.7.0`, `nginx:alpine`, then builds the 6 `node:20-alpine` service images from `services/*/Dockerfile`. Expect several minutes on a cold cache/first pull.
- Subsequent starts are fast — Docker reuses cached layers. Drop `--build` (`docker compose up -d`) unless you changed service source code.
- `mongodb` and `kafka` both define `healthcheck` blocks; every service that needs Mongo waits for `condition: service_healthy` before starting, so services won't crash-loop against a not-yet-ready database.

---

## 4. Verify the Deployment

```bash
docker compose ps
```

Expect all 9 rows `Up`, with `mongodb` and `kafka` additionally showing `(healthy)`.

```bash
for port in 3001 3003 3004 3005 3006 3007; do
  echo -n "Port $port: "
  curl -sf http://localhost:$port/health || echo "NOT READY"
  echo
done
```

Each should return `{"status":"ok","service":"<name>-service"}`.

**Kafka takes ~15–30 seconds** after container start to pass its healthcheck. During that window, `student-service`, `exam-service`, and `result-service` (the three Kafka producers) will log connection retries — this is the intended **fail-silent producer pattern**: the service stays up and serves HTTP requests normally, it just can't publish events yet. No action needed; it self-resolves once Kafka is healthy.

---

## 5. Seed Demo Data

```bash
curl -X POST http://localhost:3007/api/auth/seed
```

Creates five demo accounts, one per role:

| Username | Password | Role |
|---|---|---|
| admin | admin123 | ADMIN |
| examdiv | exam123 | EXAM_DIVISION |
| hod | hod123 | HOD |
| lecturer | lecturer123 | LECTURER |
| student1 | student123 | STUDENT |

Get a token:

```bash
curl -s -X POST http://localhost:3007/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -m json.tool
```

---

## 6. Open the App

```bash
open http://localhost:8080      # macOS
xdg-open http://localhost:8080  # Linux
```

Paste the JWT from step 5 into the token field in the UI → **Save**.

**Important:** the frontend calls each service directly on its published port (`http://localhost:3001`, `:3003`, etc.) — hardcoded in `frontend/js/app.js`. There is **no API gateway** in front of the services today; `nginx` (the `frontend` container) only serves the static SPA files (`try_files` + JS/CSS caching in `frontend/nginx.conf`), it does not proxy `/api/*` requests. See Service Communication Diagram §3.2/§3.6 for the target design this differs from.

---

## Day-to-Day Operations

```bash
# Tail logs — one service, or all of them
docker compose logs -f notification-service
docker compose logs -f

# Rebuild + restart one service after editing its code
docker compose up -d --build student-service

# Restart without rebuilding (e.g. after an env var change requiring recreation)
docker compose up -d --force-recreate student-service

# Stop containers, keep volumes (data survives)
docker compose stop

# Stop + remove containers, keep volumes
docker compose down

# Full reset — also deletes MongoDB data, Kafka topics/messages, uploaded photos
docker compose down -v

# Shell into a running container
docker compose exec student-service sh

# Open a Mongo shell against the shared database container
docker compose exec mongodb mongosh
```

### Resetting Kafka only

If Kafka gets into a bad state without wanting to lose MongoDB data:

```bash
docker compose stop kafka
docker volume rm university-erp_kafka-data
docker compose up -d kafka
```
(adjust the volume name prefix to match your actual `docker volume ls` output — Compose prefixes volumes with the project/directory name).

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| A service container exits immediately after `Up` | Check `docker compose logs <service>`. Usually a `MONGO_URI` connection failure because Mongo wasn't ready — `depends_on: service_healthy` should prevent this in normal operation, but a slow first pull can still race. Re-run `docker compose up -d`. |
| `Error: bind: address already in use` | Another process holds one of the ports listed in [Prerequisites](#1-prerequisites). Stop it, or edit the host-side port mapping (left-hand side of `"host:container"`) in `docker-compose.yml`. |
| `curl http://localhost:8080` hangs or connection refused | `frontend` container not up — check `docker compose ps` and `docker compose logs frontend`. |
| Frontend loads, but one tab's API calls fail | That specific service's container may be down — since there's no gateway, each tab depends only on its own service's port. `docker compose ps` to check which one. |
| Kafka events never reach Notification Service | Check `docker compose logs kafka` for healthcheck status first. Then check `docker compose logs notification-service` — `UNKNOWN_TOPIC_OR_PARTITION` log lines are expected until a producer's first publish auto-creates the topic (`auto.create.topics.enable=true`); the consumer retries every 10s. |
| Editing `.env` doesn't change behaviour | Compose only re-reads `.env` when a container is recreated, not on every `up`. Run `docker compose up -d --force-recreate`. |
| `docker compose build` fails inside a service | Check the specific `services/<name>/Dockerfile` and `package.json` — each service builds independently from `node:20-alpine`; a `npm install` failure there usually means a lockfile/registry issue, not a Compose problem. |
| Photo upload succeeds but photo disappears after `docker compose down -v` | Expected — `-v` deletes the `uploads-data` volume along with `mongo-data` and `kafka-data`. Use `docker compose down` (no `-v`) to preserve uploads. |

---

## Production Gap Notes

This repository only implements local Docker Compose deployment. If this were taken toward a real production deployment, the following gaps (already called out in `deliverable-docs/1. Architecture Design Document.docx` §11 and `deliverable-docs/6. Benefits and Risks.docx`) would need to be closed first:

- **Database:** replace the single shared `mongo:7` container with a managed multi-database cluster (e.g. MongoDB Atlas) — currently one process hosts all six logical databases.
- **Secrets:** replace the single `.env` `JWT_SECRET` with a real secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault); rotate independently of deploys.
- **API Gateway:** NGINX currently serves static files only. A production deployment would need either a real reverse-proxy gateway (path-based routing, TLS termination, rate limiting) or a managed API gateway — see the unbuilt design in Service Communication Diagram §6.
- **TLS:** everything here runs over plain HTTP on `localhost`. Production needs TLS termination in front of the frontend and, ideally, between internal services.
- **Automated tests:** no `*.test.js`/`*.spec.js` files and no `test` script in any `package.json` exist in this repository today — there is nothing to run in a CI pipeline before a production deploy.
- **Observability:** only per-request console logging exists. Production would need centralized log aggregation and metrics (the Reporting Service, which would consume `result.published` for dashboards, is designed but not built).
- **Horizontal scaling:** `docker-compose.yml` runs exactly one replica of each service. Production scaling would mean moving to an orchestrator (Kubernetes, ECS) with per-service replica counts and a real load balancer in front of each.
