# Service Communication Diagram — Service Communication Diagram

> Paste the code block below into [mermaid.live](https://mermaid.live) or
> VS Code with **Markdown Preview Mermaid Support** to render.  
> Export as PNG/SVG and insert into your Word submission.
>
> **Revision note:** redrawn to match the as-built system — 6 services in solid
> boxes (Auth, Student, Exam, Result, Transcript, Notification), Course and
> Reporting Services shown dashed/grey as designed-but-not-built, NGINX shown
> serving only the static frontend (no path-based API routing exists), and the
> browser calling each service port directly. MongoDB is one shared container
> hosting six logical databases, not a multi-node cluster.

```mermaid
flowchart TB
    %% ── Client Layer ─────────────────────────────────────────────────────────
    WEB["🌐 Browser SPA\nBootstrap 5 + jQuery"]

    %% ── NGINX (static frontend only) ────────────────────────────────────────
    NGINX["⚙️ NGINX (nginx:alpine)\n━━━━━━━━━━━━━━━━━━━━\nServes static frontend only · :8080\nNo API routing implemented"]

    %% ── Built services ───────────────────────────────────────────────────────
    subgraph SERVICES["MICROSERVICES · 6 built &amp; running · JWT validated at each service"]
        direction LR
        AUTH["🔐 Auth Service\n:3007"]
        STUDENT["👤 Student Service\n:3001"]
        EXAM["📝 Exam Service\n:3003"]
        RESULT["📊 Result Service\n:3004"]
        TRANSCRIPT["📄 Transcript Service\n:3005"]
        NOTIF["🔔 Notification Service\n:3006"]
    end

    %% ── Planned, not built ───────────────────────────────────────────────────
    subgraph PLANNED["PLANNED · NOT IMPLEMENTED"]
        direction LR
        COURSE["📚 Course Service\n:3002 · planned"]
        REPORT["📈 Reporting Service\n:3008 · planned"]
    end

    %% ── Event Bus ────────────────────────────────────────────────────────────
    KAFKA[("🔄 Kafka 3.7 (KRaft)\nAsync Event Bus")]

    %% ── MongoDB Layer ────────────────────────────────────────────────────────
    subgraph DBS["MONGODB · single shared mongo:7 container · one logical DB per service"]
        direction LR
        DB_AUTH[("auth_db")]
        DB_STU[("students_db")]
        DB_EXA[("exams_db")]
        DB_RES[("results_db")]
        DB_NOT[("notif_db")]
    end
    subgraph DBS_PLANNED["PLANNED DBs · NOT PROVISIONED"]
        direction LR
        DB_COU[("courses_db")]
        DB_REP[("reports_db")]
    end

    %% ── Client → NGINX (static assets only) ───────────────────────────────────
    WEB -->|"HTTPS · static files"| NGINX

    %% ── Client → each service directly (no gateway routing) ───────────────────
    WEB -->|"REST :3007"| AUTH
    WEB -->|"REST :3001"| STUDENT
    WEB -->|"REST :3003"| EXAM
    WEB -->|"REST :3004"| RESULT
    WEB -->|"REST :3005"| TRANSCRIPT
    WEB -->|"REST :3006"| NOTIF

    %% ── Cross-service sync REST calls ─────────────────────────────────────────
    EXAM -->|"GET /api/students/:id\n✦ verify student exists"| STUDENT
    TRANSCRIPT -->|"GET /api/students/:id\n✦ fetch profile"| STUDENT
    TRANSCRIPT -->|"GET /api/results...\n✦ fetch grades &amp; GPA"| RESULT

    %% ── Async Kafka producers ─────────────────────────────────────────────────
    STUDENT -.->|"student.created"| KAFKA
    EXAM    -.->|"exam.registered"| KAFKA
    RESULT  -.->|"result.published"| KAFKA

    %% ── Async Kafka consumers ─────────────────────────────────────────────────
    KAFKA -.->|"student.created\nexam.registered\nresult.published"| NOTIF

    %% ── Services → their own DBs ──────────────────────────────────────────────
    AUTH      --- DB_AUTH
    STUDENT   --- DB_STU
    EXAM      --- DB_EXA
    RESULT    --- DB_RES
    NOTIF     --- DB_NOT
    COURSE    -.-> DB_COU
    REPORT    -.-> DB_REP

    %% ── Legend ───────────────────────────────────────────────────────────────
    subgraph LEGEND["LEGEND"]
        direction LR
        L1["──▶  Sync REST call"]
        L2["--▶  Async Kafka event / planned link"]
        L3["───  Service owns DB"]
        L4["▭▭  Dashed box = planned, not built"]
    end
```

---

## Communication Key

| Arrow / box style | Meaning |
|---|---|
| Solid `-->` | Synchronous REST (HTTP/JSON), request → response (blocking) |
| Dashed `-.->` | Asynchronous Kafka event, or a planned (not-built) link |
| Plain `---` | Database ownership — service reads/writes only its own DB |
| Dashed grey box | Designed but not implemented (Course Service, Reporting Service, their DBs) |

---

## Synchronous Flows (REST) — As Built

| # | From | To | Endpoint | Trigger | Error handling |
|---|------|----|----------|---------|----------------|
| 1 | Browser SPA | Each of the 6 built services, directly | `http://localhost:<port>/api/...` | Any user action in the frontend | Service-specific; no shared gateway error handling exists |
| 2 | Exam Service | Student Service | `GET /api/students/:id` | `POST /api/exams/:id/entries` | 404 if student missing → 404 to client; service down → 502 |
| 3 | Transcript Service | Student Service | `GET /api/students/:id` | `GET /api/transcripts/:studentId/semester/:sem` or `.../final` | Service down → 502 |
| 4 | Transcript Service | Result Service | `GET /api/results?...` and `GET /api/results/gpa/:studentId` | Same as above | Service down → 502 |

**Note:** there is no path-based API gateway in the current build. `nginx.conf` only serves the static frontend (`try_files` + JS/CSS caching); the frontend calls each service's exposed port directly (`http://localhost:3001`, `:3003`, etc.). Row 1 of the original design (NGINX routing every `/api/<resource>` request) describes an unbuilt goal, not the running system — see Architecture Design Document §8 for the full correction.

---

## Asynchronous Flows (Kafka) — As Built

| # | Event | Producer | Consumer(s) | Trigger | Payload |
|---|-------|----------|-------------|---------|---------|
| 1 | `student.created` | Student Service | Notification Service | Successful `POST /api/students` | `{ studentId, name, email }` (approximate — see producer code) |
| 2 | `exam.registered` | Exam Service | Notification Service | Successful `POST /api/exams/:id/entries` | `{ studentId, examId, ... }` |
| 3 | `result.published` | Result Service | Notification Service | `PATCH /api/results/gpa/:gpaId/finalize` | `{ studentId, studentRegNo, academicYear, gpa, status: "final" }` |

**Note:** only Notification Service consumes these topics in the built system. Reporting Service and Transcript Service are **not** Kafka consumers — Reporting Service doesn't exist, and Transcript Service fetches data synchronously via REST on demand instead of maintaining a Kafka-fed local cache. A built Reporting Service would be the natural fourth consumer of `result.published` in a future iteration.
