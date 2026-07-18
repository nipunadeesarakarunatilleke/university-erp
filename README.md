# University ERP — Microservice Architecture

> Advanced Software Engineering module project · University of Colombo School of Computing (UCSC)

A production-style microservice ERP system designed to replace a monolithic Faculty Management Information System (MIS) used at the Faculty of Agriculture, Rajarata University of Sri Lanka. The system is built with Node.js, MongoDB, Apache Kafka, and Docker, demonstrating real-world microservice patterns including service decomposition, database-per-service, synchronous REST communication, and asynchronous event-driven messaging.

---

## Architecture Overview

The system is decomposed into 6 independently deployable services, each owning its own MongoDB database, communicating via REST (sync) and Kafka (async).

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (port 8080)                      │
│              jQuery SPA served by nginx                         │
└──────────┬──────────┬────────┬────────┬──────────┬─────────────┘
           │          │        │        │          │
    :3007  │   :3001  │  :3003 │  :3004 │  :3005   │  :3006
   ┌───────┐ ┌───────┐ ┌─────┐ ┌──────┐ ┌────────┐ ┌────────────┐
   │ Auth  │ │Student│ │Exam │ │Result│ │Transc. │ │Notification│
   │Service│ │Service│ │Svc  │ │Svc   │ │Service │ │Service     │
   └───────┘ └───┬───┘ └──┬──┘ └──┬───┘ └───┬────┘ └─────┬──────┘
                 │  REST   │       │          │             │
                 └────────▶│       │          │             │
                           │       │ Kafka    │             │
                           │   student.created ────────────▶│
                           │   exam.registered ─────────────▶│
                           │   result.published ─────────────▶│
                           │                                │
        ┌──────────────────┴──────────────────────────────────┐
        │                   MongoDB  (port 27017)              │
        │  auth_db · students_db · exams_db · results_db      │
        │  transcripts_db · notif_db                          │
        └─────────────────────────────────────────────────────┘
        ┌─────────────────────────────────────────────────────┐
        │          Apache Kafka KRaft  (port 9092)            │
        │  Topics: student.created · exam.registered          │
        │          result.published                           │
        └─────────────────────────────────────────────────────┘
```

---

## Services

| Service | Port | Database | Responsibility |
|---------|------|----------|----------------|
| **Auth Service** | 3007 | auth_db | User registration, JWT login, role management |
| **Student Service** | 3001 | students_db | Student profiles, year registration, specialization, photo upload, bulk import |
| **Exam Service** | 3003 | exams_db | Exam scheduling, registration windows, entry approval workflow, admission cards |
| **Result Service** | 3004 | results_db | Result upload, GPA calculation (Σ GP×cr / Σ cr), finalization |
| **Transcript Service** | 3005 | transcripts_db | Cross-service aggregation of student + result data into transcript JSON |
| **Notification Service** | 3006 | notif_db | Kafka consumer — logs all domain events to NotificationLog |

> **Planned, not implemented:** Course Service (:3002) and Reporting Service (:3008) are part of the original 8-service design (see `deliverable-docs/1. Architecture Design Document.docx` §4.3 / §4.8) but have no code under `services/` and no entry in `docker-compose.yml`. They do not start with the commands below.

---

## Technology Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Runtime | Node.js 20 + Express | Lightweight, non-blocking I/O, consistent across all services |
| Database | MongoDB 7 + Mongoose | Flexible schema, natural fit for document-style student/exam records |
| Messaging | Apache Kafka 3.7 (KRaft) | Async event decoupling — no Zookeeper required in KRaft mode |
| Auth | JWT (jsonwebtoken) + bcrypt | Stateless authentication with role claims embedded in token |
| File upload | Multer | Profile photo upload with Docker-volume persistence |
| Frontend | jQuery + Bootstrap 5 | No build tools — served as static files via nginx |
| Container | Docker + docker-compose | Reproducible single-command startup for all 9 containers |

---

## Key Features Implemented

### Phase 1 — Core Foundation
- **G1 Auth Service** — Role-based JWT authentication (STUDENT / EXAM_DIVISION / HOD / LECTURER / ADMIN)
- **G2 Student Profile** — 35+ field expanded schema covering personal, contact, address, guardian, emergency, and academic data
- **G5 Exam Windows** — Registration open/close toggle with date-range enforcement
- **G12 Role-Based Frontend** — UI adapts per role (students cannot see management forms)

### Phase 2 — Core Workflows
- **G4 Year Registration** — Academic year enrolment with fee and hostel tracking
- **G6 Approval Workflow** — Exam entry approval (pending → approved / rejected) by HOD/Lecturer with admission card generation
- **G7 Result Service** — Subject result upload, automatic grade-to-GPA-point mapping, year GPA calculation and finalization
- **G8 Transcript Service** — Cross-service REST aggregation (Student + Result) into semester and full academic transcripts

### Phase 3 — Enhancements
- **G3 Bulk Import** — CSV batch import for students, year registrations, and results
- **G9 Specialization** — Student preference submission and admin assignment workflow
- **G10 Photo Upload** — Multer-based profile photo storage with Docker volume persistence
- **G11 Kafka Notifications** — Full event pipeline: 3 Kafka producers → broker → Notification Service consumer → MongoDB log

---

## Cross-Service Communication

### Synchronous REST
```
Exam Service  ──[GET /api/students/:id]──▶  Student Service
                 Validates student exists before creating exam entry

Transcript Service  ──[GET /api/students/:id]──▶  Student Service
Transcript Service  ──[GET /api/results/student/:id]──▶  Result Service
                       Aggregates full academic record
```

### Asynchronous Kafka
```
Student Service   ── student.created  ──▶  Kafka  ──▶  Notification Service
Exam Service      ── exam.registered  ──▶  Kafka  ──▶  Notification Service
Result Service    ── result.published ──▶  Kafka  ──▶  Notification Service
```
Producers use a **fail-silent pattern** — services remain operational even if the Kafka broker is temporarily unavailable.

---

## GPA Calculation

```
GPA = Σ (gradePoints × credits) / Σ (credits)

Grade mapping:
  A+ / A  → 4.0     B+ → 3.3     C+ → 2.3     D+ → 1.3
  A-      → 3.7     B  → 3.0     C  → 2.0     D  → 1.0
                    B- → 2.7     C- → 1.7     F  → 0.0
```

---

## User Roles

| Role | Permissions |
|------|-------------|
| ADMIN | Full access — create users, manage all data, bulk import, assign specializations |
| EXAM_DIVISION | Manage exams, registration windows, entry approval, results upload |
| HOD | Approve/reject exam entries, view all student and exam data |
| LECTURER | Approve/reject exam entries, view results |
| STUDENT | View own enrolment, apply for specialization, view own results |

---

## Deployment

### Prerequisites

| Requirement | Notes |
|---|---|
| Docker Desktop 4.x+ (or Docker Engine + Compose v2) | `docker compose` (space, not hyphen) — the v2 CLI plugin syntax used throughout this guide |
| Git | To clone the repository |
| ~4 GB free RAM, ~2 GB free disk | For 9 containers (MongoDB, Kafka, 6 services, nginx) plus their images |
| Free host ports | `8080`, `27017`, `9092`, `9094`, `3001`, `3003`, `3004`, `3005`, `3006`, `3007` — stop anything else already bound to these before starting |

### 1. Clone and configure

```bash
git clone https://github.com/nipunadeesarakarunatilleke/university-erp.git
cd university-erp

cp .env.example .env
# Edit .env and set JWT_SECRET to a long random string, e.g.:
#   JWT_SECRET=$(openssl rand -hex 32)
```

`.env` is gitignored — only `.env.example` is committed. `JWT_SECRET` is the one secret every service shares to independently verify tokens (see Architecture Design Document §9); there is no vault or secret manager in this local setup.

### 2. Start the stack

```bash
# Build all service images and start all 9 containers in the background
docker compose up --build -d
```

First run pulls `mongo:7`, `apache/kafka:3.7.0`, and `nginx:alpine`, then builds the 6 `node:20-alpine`-based service images — expect a few minutes on a cold cache. Subsequent runs are fast (Docker layer cache), and plain `docker compose up -d` (no `--build`) is enough unless service source code changed.

### 3. Verify the deployment

```bash
# All 9 containers should show "Up" (mongodb/kafka also show "healthy")
docker compose ps

# Each built service exposes GET /health
for port in 3001 3003 3004 3005 3006 3007; do
  echo -n "Port $port: "
  curl -sf http://localhost:$port/health || echo "NOT READY"
  echo
done
```

Kafka takes ~15–30 seconds after container start to pass its healthcheck; services that depend only on MongoDB (`depends_on: service_healthy`) come up faster and will log Kafka connection retries until the broker is ready — this is expected, not an error (fail-silent producer pattern, see Benefits & Risks §3.3).

### 4. Seed demo data and get a token

```bash
curl -X POST http://localhost:3007/api/auth/seed

curl -s -X POST http://localhost:3007/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -m json.tool
```

### 5. Open the app

```bash
open http://localhost:8080   # macOS; use xdg-open on Linux or just browse manually
```

Paste the JWT from step 4 into the token field → **Save** → start exploring. The frontend calls each service directly on its published port (`http://localhost:3001`, `:3003`, …) — there is currently no API gateway in front of them; see Service Communication Diagram §3.2 for why.

### Demo Users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | ADMIN |
| examdiv | exam123 | EXAM_DIVISION |
| hod | hod123 | HOD |
| lecturer | lecturer123 | LECTURER |
| student1 | student123 | STUDENT |

### Day-to-day operations

```bash
# Tail logs for one service (or omit the name to tail everything)
docker compose logs -f notification-service

# Rebuild and restart just one service after editing its code
docker compose up -d --build student-service

# Stop everything, keep data volumes
docker compose stop

# Stop and remove containers (data volumes survive — mongo-data, kafka-data, uploads-data)
docker compose down

# Full reset — also wipes MongoDB data, Kafka topics/messages, and uploaded photos
docker compose down -v
```

### Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| A service exits immediately | Check `docker compose logs <service>` — usually `MONGO_URI` unreachable because `mongodb` isn't healthy yet; `depends_on: service_healthy` should prevent this, but a first-run pull can still race on slow connections. Re-run `docker compose up -d`. |
| `bind: address already in use` on startup | Another process already holds one of the ports listed under Prerequisites. Stop it, or change the host-side port mapping in `docker-compose.yml`. |
| Kafka events never reach Notification Service | Check `docker compose logs kafka` for healthcheck status, and `docker compose logs notification-service` for `UNKNOWN_TOPIC_OR_PARTITION` retries — these stop once a producer's first publish auto-creates the topic. |
| Frontend loads but API calls fail (CORS / connection refused) | Confirm the specific service's container is `Up` and its port is published (`docker compose ps`) — the frontend talks to `localhost:<port>` directly, so a single down service breaks only its own tab, not the whole app. |
| `.env` changes not taking effect | `docker compose` only re-reads `.env` on container recreation — run `docker compose up -d --force-recreate`. |

### Production notes

This Compose setup is for local development/demo only. Section 11 of `deliverable-docs/1. Architecture Design Document.docx` lists what a real deployment still needs: MongoDB Atlas (or another managed multi-database cluster) instead of a single `mongo:7` container, a secrets vault instead of a shared `.env` `JWT_SECRET`, an actual API gateway in front of the services (NGINX currently only serves static files — see Service Communication Diagram §3.2/§3.6), and automated tests (none exist in the repository today).

---

## Project Structure

```
university-erp/
├── deliverable-docs/                       # 7 numbered assignment deliverables
│   ├── 1. Architecture Design Document.docx    (incl. Database Strategy as §6)
│   ├── 2. Service Identification Table.docx
│   ├── 3. Bounded Context Diagram.docx
│   ├── 4. API Endpoint Design.docx
│   ├── 5. Service Communication Diagram.docx
│   ├── 6. Benefits and Risks.docx
│   ├── 7. AI Usage Report.docx
│   ├── docs/                                   # PDF export of each numbered deliverable
│   └── Extra/                                  # Diagram sources + compiled copy
│       ├── architecture-diagram.html / .drawio
│       ├── Bounded Context Diagram.md              (Mermaid source)
│       ├── Service Communication Diagram.md        (Mermaid source)
│       └── Combined Deliverable Report.docx        (all 7 deliverables in one file)
├── supportive-docs/                        # Background research & tracking
│   ├── Microservice Architecture and Prototype - Group Assignment.pdf  (the brief)
│   ├── Gap Analysis Report.docx
│   ├── Individual Assignment Plan.docx
│   ├── Evaluation Report.md                    (self-assessment vs. the brief's criteria)
│   ├── Team questions.docx / answers.md
│   ├── Information about existing system/
│   └── PROGRESS.md
├── services/
│   ├── auth-service/
│   ├── student-service/
│   ├── exam-service/
│   ├── result-service/
│   ├── transcript-service/
│   └── notification-service/
├── frontend/                                # Static SPA (Bootstrap 5 + jQuery)
│   ├── index.html
│   ├── js/app.js
│   ├── css/style.css
│   └── nginx.conf
├── docker-compose.yml                       # All 9 containers
├── .env.example
└── .gitignore
```

---

## Gap Analysis

This project was built by analysing the existing MIS at Rajarata University of Sri Lanka (`agrimis.rjt.ac.lk`) and identifying 12 gaps between the existing monolithic system and the new microservice architecture. The full analysis is in `supportive-docs/Gap Analysis Report.docx`.

| Gap | Description | Phase |
|-----|-------------|-------|
| G1 | Auth Service with role-based access | 1 |
| G2 | Full student profile schema | 1 |
| G3 | Bulk CSV import | 3 |
| G4 | Year registration workflow | 2 |
| G5 | Exam registration windows | 1 |
| G6 | Entry approval workflow + admission cards | 2 |
| G7 | Result Service + GPA calculation | 2 |
| G8 | Transcript Service | 2 |
| G9 | Specialization selection workflow | 3 |
| G10 | Profile photo upload | 3 |
| G11 | Kafka notification pipeline | 3 |
| G12 | Role-based frontend views | 1 |

---

## Module

**Advanced Software Engineering (ASE)** · MSc in Computer Science · University of Colombo School of Computing (UCSC)
