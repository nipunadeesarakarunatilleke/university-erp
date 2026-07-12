# Service Communication Diagram — Service Communication Diagram

> Paste the code block below into [mermaid.live](https://mermaid.live) or
> VS Code with **Markdown Preview Mermaid Support** to render.  
> Export as PNG/SVG and insert into your Word submission.

```mermaid
flowchart TB
    %% ── Client Layer ─────────────────────────────────────────────────────────
    subgraph CLIENT["CLIENT LAYER"]
        direction LR
        WEB["🌐 Web Browser"]
        MOB["📱 Mobile App"]
        ADM["🖥️ Admin Portal"]
    end

    %% ── NGINX ────────────────────────────────────────────────────────────────
    NGINX["⚙️ NGINX Reverse Proxy\n━━━━━━━━━━━━━━━━━━━━\n/api/auth       → :3007\n/api/students   → :3001\n/api/courses    → :3002\n/api/exams      → :3003\n/api/results    → :3004\n/api/transcripts→ :3005\n/api/reports    → :3008"]

    %% ── Services ─────────────────────────────────────────────────────────────
    subgraph SERVICES["INTERNAL NETWORK  ·  JWT validated at each service"]
        direction TB
        AUTH["🔐 Auth Service\n:3007"]
        STUDENT["👤 Student Service\n:3001"]
        COURSE["📚 Course Service\n:3002"]
        EXAM["📝 Exam Service\n:3003"]
        RESULT["📊 Result Service\n:3004"]
        TRANSCRIPT["📄 Transcript Service\n:3005"]
        NOTIF["🔔 Notification Service\n:3006"]
        REPORT["📈 Reporting Service\n:3008"]
    end

    %% ── Event Bus ────────────────────────────────────────────────────────────
    KAFKA[("🔄 Kafka\nAsync Event Bus")]

    %% ── MongoDB Layer ────────────────────────────────────────────────────────
    subgraph DBS["MONGODB CLUSTER  ·  one database per service"]
        direction LR
        DB_AUTH[("auth_db")]
        DB_STU[("students_db")]
        DB_COU[("courses_db")]
        DB_EXA[("exams_db")]
        DB_RES[("results_db")]
        DB_TRA[("transcripts_db")]
        DB_NOT[("notif_db")]
        DB_REP[("reports_db")]
    end

    %% ── Client → NGINX ───────────────────────────────────────────────────────
    WEB & MOB & ADM -->|"HTTPS"| NGINX

    %% ── NGINX → Services (sync REST, path-based routing) ─────────────────────
    NGINX -->|"/api/auth"| AUTH
    NGINX -->|"/api/students"| STUDENT
    NGINX -->|"/api/courses"| COURSE
    NGINX -->|"/api/exams"| EXAM
    NGINX -->|"/api/results"| RESULT
    NGINX -->|"/api/transcripts"| TRANSCRIPT
    NGINX -->|"/api/reports"| REPORT

    %% ── Cross-service sync REST calls ─────────────────────────────────────────
    EXAM -->|"GET /api/students/:id\n✦ verify student exists"| STUDENT
    TRANSCRIPT -->|"GET /api/results/student/:studentId\n✦ fetch grades for PDF"| RESULT

    %% ── Async Kafka producers ─────────────────────────────────────────────────
    STUDENT -.->|"student.created"| KAFKA
    EXAM    -.->|"exam.registered"| KAFKA
    RESULT  -.->|"result.published"| KAFKA

    %% ── Async Kafka consumers ─────────────────────────────────────────────────
    KAFKA -.->|"student.created\nexam.registered\nresult.published"| NOTIF
    KAFKA -.->|"result.published"| REPORT
    KAFKA -.->|"result.published"| TRANSCRIPT

    %% ── Services → their own DBs ──────────────────────────────────────────────
    AUTH      --- DB_AUTH
    STUDENT   --- DB_STU
    COURSE    --- DB_COU
    EXAM      --- DB_EXA
    RESULT    --- DB_RES
    TRANSCRIPT--- DB_TRA
    NOTIF     --- DB_NOT
    REPORT    --- DB_REP

    %% ── Legend ───────────────────────────────────────────────────────────────
    subgraph LEGEND["LEGEND"]
        direction LR
        L1["──▶  Sync REST call"]
        L2["--▶  Async Kafka event"]
        L3["───  Service owns DB"]
    end
```

---

## Communication Key

| Arrow style | Protocol | Direction | Example |
|-------------|----------|-----------|---------|
| Solid `-->` | Synchronous REST (HTTP/JSON) | Request → Response (blocking) | Exam → Student verify |
| Dashed `-.->` | Asynchronous Kafka event | Fire and forget | `result.published` |
| Plain `---` | Database ownership | Service reads/writes only its own DB | Student → students_db |

---

## Synchronous Flows (REST)

| # | From | To | Endpoint | Trigger | Error handling |
|---|------|----|----------|---------|----------------|
| 1 | NGINX | Any service | `/api/<resource>` | Client HTTP request | 404 if path unknown |
| 2 | Exam Service | Student Service | `GET /api/students/:id` | `POST /api/exams/:id/entries` | 404 if student missing → 404 to client; service down → 502 |
| 3 | Transcript Service | Result Service | `GET /api/results/student/:id` | `POST /api/transcripts/:id/generate` | Service down → 502 |

---

## Asynchronous Flows (Kafka)

| # | Event | Producer | Consumer(s) | Payload |
|---|-------|----------|-------------|---------|
| 1 | `student.created` | Student Service | Notification Service | `{ studentId, name, email }` |
| 2 | `exam.registered` | Exam Service | Notification Service | `{ studentId, examId, examTitle }` |
| 3 | `result.published` | Result Service | Notification Svc, Reporting Svc, Transcript Svc | `{ studentId, examId, grade, score }` |
