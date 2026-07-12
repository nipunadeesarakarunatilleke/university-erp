# University ERP — Microservice Project Progress

**Module:** Advanced Software Engineering · UCSC  
**Architecture:** Node.js · MongoDB · Kafka (KRaft) · NGINX  
**Prototype scope:** 6 services built and running — Auth, Student, Exam, Result, Transcript, Notification

---

## Deliverables Status

| ID | Deliverable | File | Status |
|----|-------------|------|--------|
| D1 | Microservice Architecture Design Document (incl. Database Strategy) | `deliverable-docs/Architecture Design Document.docx` | ✅ Done |
| D2 | Service Identification Table | `deliverable-docs/Service Identification Table.docx` | ✅ Done |
| D3 | Bounded Context Diagram | `deliverable-docs/Bounded Context Diagram.docx` + `deliverable-docs/Bounded Context Diagram.md` | ✅ Done |
| D4 | API Endpoint Design | `deliverable-docs/API Endpoint Design.docx` | ✅ Done |
| D5 | Service Communication Diagram | `deliverable-docs/Service Communication Diagram.docx` + `deliverable-docs/Service Communication Diagram.md` | ✅ Done |
| D6 | Database Strategy | Embedded in Architecture Design Document, Section 6 | ✅ Done |
| D7 | Prototype (≥2 services) | `services/` + `docker-compose.yml` | ✅ Done |
| D8 | Benefits & Risks | `deliverable-docs/Benefits and Risks.docx` | ✅ Done |
| D9 | AI Usage Report | `deliverable-docs/AI Usage Report.docx` | ✅ Done |

## Existing System Analysis

Before implementation, the existing MIS at the Faculty of Agriculture, Rajarata University of Sri Lanka (`agrimis.rjt.ac.lk`) was analysed by reading four source files in `supportive-docs/Information about existing system/`:

| File | Content |
|------|---------|
| `Part1.txt` | Video transcript — student management, profile view, batch view, exam registration dates |
| `part2.txt` | Video transcript — year registration via CSV, profile photo upload, exam application workflow |
| `part3.txt` | Video transcript — result upload per subject, GPA processing, transcript download |
| `video673.txt` | 1h51m awareness session transcript — full MIS scope, student portal demo, semester registration |
| `MIS Awareness Workshop for Students.pptx` | Presentation slides — MIS scope covering registration, exam management, results, specialization, transcripts |

### Output — Gap Analysis Report

After analysing all files, a formal gap analysis was produced: `supportive-docs/Gap Analysis Report.docx`

- Compared 5 feature areas of the existing MIS against the new microservice ERP prototype
- Identified **12 gaps** (G1–G12) across authentication, data models, workflows, and missing services
- Assigned each gap a priority (HIGH / MEDIUM) and a phase (1 / 2 / 3)
- Produced a 3-phase implementation roadmap with dependency ordering

| Phase | Gaps | Theme |
|-------|------|-------|
| Phase 1 | G1, G2, G5, G12 | Core foundation — auth, data model, windows, role UI |
| Phase 2 | G4, G6, G7, G8 | Core workflows — registration, approval, results, transcripts |
| Phase 3 | G3, G9, G10, G11 | Enhancements — bulk import, specialization, photos, Kafka |

---

## Gap Analysis — Phase 1 Implementation ✅

Implemented all four Phase 1 gaps from `Gap Analysis Report.docx`.

### G1 — Auth Service (new service)

| File | Purpose |
|------|---------|
| `services/auth-service/src/index.js` | Express app, port 3007 |
| `services/auth-service/src/models/User.js` | username, passwordHash, role (STUDENT/EXAM_DIVISION/HOD/LECTURER/ADMIN), name, email |
| `services/auth-service/src/routes/auth.js` | POST /api/auth/login, /register, /seed, PATCH /reset-password |

JWT now includes `role` claim — all services expose it via `req.user.role`.

**Demo users** (seeded via `POST /api/auth/seed`):

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | ADMIN |
| examdiv | exam123 | EXAM_DIVISION |
| hod | hod123 | HOD |
| lecturer | lecturer123 | LECTURER |
| student1 | student123 | STUDENT |

### G2 — Student Profile Expansion

`services/student-service/src/models/Student.js` expanded with 30+ new optional fields:
- Personal: `nic`, `gender`, `dateOfBirth`, `writingHand`, `race`, `religion`, `citizenship`, `nameSinhala`
- Contact: `mobile`, `landline`
- Permanent address: `permanentAddr1/2/3`, `permanentDistrict`, `permanentGnDivision`, `permanentElectorate`, `permanentMoh`
- Contact address: `sameAsPermanent`, `contactAddr1/2/3`, `contactDistrict`
- Guardian: `guardianType`, `guardianName`, `guardianOccupation`, `guardianWorkplace`, `guardianContact`
- Emergency: `emergencyName`, `emergencyContact`
- Academic: `batch`, `academicYear`, `studyYear`, `scholarshipInfo`, `remarks`, `photoUrl`, `signatureUrl`

New endpoint: `PATCH /api/students/:id` — partial profile update. Immutable fields (studentId, email, nic, district) protected for non-admin roles.

### G5 — Exam Registration Windows

`services/exam-service/src/models/Exam.js` expanded with:
- `registrationOpen` (Boolean, default `true` — backward compatible)
- `registrationStart`, `registrationEnd` (Date)
- `admissionDownloadEnabled`, `admissionDownloadDate`

New endpoints in `services/exam-service/src/routes/exams.js`:
- `PATCH /api/exams/:id/schedule` — set window dates
- `PATCH /api/exams/:id/toggle` — open/close registration

`POST /api/exams/:id/entries` now enforces window: returns 403 if closed or outside dates.

### G12 — Role-Based Frontend

`frontend/js/app.js` updated:
- `parseJwt()` decodes role from token client-side
- Role badge displayed on token pill (ADMIN, STUDENT, etc.)
- STUDENT role: hides Create Student form and Create Exam form, hides Students tab
- HOD/LECTURER: hides Create Student form only
- Auth Service health card added to Dashboard (7 cards total by Phase 3: Student, Exam, Auth, Result, Transcript, Notification, Kafka)

---

## Gap Analysis — Phase 2 Implementation ✅

Implemented all four Phase 2 gaps: G4 (Year Registration), G6 (Exam Approval Workflow), G7 (Result Service), G8 (Transcript Service).

### G4 — Year Registration

`services/student-service/src/models/YearRegistration.js` (new):
- Fields: `studentId` (ObjectId ref), `academicYear` (1–4), `studyYear`, `paidAmount`, `hostel` (Boolean), `registeredAt`
- Unique index: `{ studentId, academicYear }` — one registration per year per student

New endpoints in `services/student-service/src/routes/students.js`:
- `POST /api/students/:id/year-registration` — creates registration, syncs `academicYear` / `studyYear` back to Student record
- `GET /api/students/:id/year-registrations` — lists all year registrations for a student

### G6 — Exam Entry Approval Workflow

`services/exam-service/src/models/Entry.js` expanded:
- `status` (pending | approved | rejected, default `pending`)
- `isRepeat` (Boolean)
- `reviewedBy` (username), `reviewedAt` (Date)

New/updated endpoints in `services/exam-service/src/routes/exams.js`:
- `GET /api/exams/:id/entries?status=pending|approved|rejected` — optional status filter
- `PATCH /api/exams/:id/entries/:entryId` — set status; records reviewer and timestamp
- `GET /api/exams/:id/admission-card` — returns only approved entries with seat numbers

Frontend entries table now shows status badge (Pending / Approved / Rejected) and Approve (✓) / Reject (✗) / Reset (↺) buttons for ADMIN, EXAM_DIVISION, HOD, LECTURER roles.

### G7 — Result Service (new service, port 3004)

| File | Purpose |
|------|---------|
| `services/result-service/src/models/Result.js` | studentId, subjectCode, subjectName, marks, grade, gradePoints (auto-computed), credits, academicYear, semester, isRepeat |
| `services/result-service/src/models/GPA.js` | studentId, academicYear, gpa, totalCredits, totalPoints, status (draft/final) |
| `services/result-service/src/routes/results.js` | CRUD + GPA processing endpoints |

Endpoints:
- `POST /api/results` — upload single result (duplicate = upsert/replace via unique index + 11000 handler)
- `GET /api/results/student/:studentId` — all results grouped by "Year X — Semester Y" + GPA records
- `POST /api/results/process-gpa` — calculates GPA = Σ(gradePoints×credits)/Σ(credits), upserts draft record
- `GET /api/results/gpa/:studentId` — list all GPA records
- `PATCH /api/results/gpa/:gpaId/finalize` — set status=final

Grade-point mapping: A+/A=4.0, A-=3.7, B+=3.3, B=3.0, B-=2.7, C+=2.3, C=2.0, C-=1.7, D+=1.3, D=1.0, F=0.0 (auto-computed pre-save hook).

### G8 — Transcript Service (new service, port 3005)

| File | Purpose |
|------|---------|
| `services/transcript-service/src/routes/transcripts.js` | Cross-service aggregation of student + results data |

Endpoints:
- `GET /api/transcripts/:studentId/semester/:sem?academicYear=X` — semester transcript JSON with semesterGPA
- `GET /api/transcripts/:studentId/final` — full academic record JSON, grouped by year → semester

Cross-service calls: Student Service (port 3001) + Result Service (port 3004) via axios.  
Error handling: 404 if student not found, 502 if upstream unavailable.

### Phase 2 Frontend Updates

`frontend/index.html`:
- **Results tab** — student selector, GPA summary pills, results table (Year/Sem/Code/Name/Marks/Grade/GP/Credits)
- Upload Result form (admin only): student, reg no, subject, marks, grade, credits, year, semester
- Entries table Status column — shows badge + approval buttons
- 2 new health cards: Result Service, Transcript Service (dashboard now has 5 cards)

`frontend/js/app.js`:
- `loadResults(studentId)` — fetches grouped results + GPA, renders table with colour-coded grade badges
- `$('#results-student-select').on('change', ...)` — triggers loadResults
- `$('#form-upload-result').on('submit', ...)` — POST /api/results
- `approvalButtons()` / `setEntryStatus()` — Approve/Reject/Reset entry status
- `rebuildStudentDropdown()` now also populates `#results-student-select` and `#res-student-id`
- Results tab show handler: lazy-loads students list, hides upload card for non-admin

---

## Gap Analysis — Phase 3 Implementation ✅

Implemented all four Phase 3 gaps: G3 (Bulk CSV Import), G9 (Specialization), G10 (Photo Upload), G11 (Notification Service + Kafka).

### G3 — Bulk Data Import

**Student-service additions:**
- `POST /api/students/bulk` — body `{csv}`, creates multiple students from CSV; returns 207 with `created`/`errors` counts
- `POST /api/students/bulk-year-registration` — body `{csv}` with columns `studentId,academicYear,studyYear,paidAmount,hostel`
- CSV format: `name,email,studentId,programme,batch` (no external library — simple line-split parser)

**Result-service addition:**
- `POST /api/results/bulk` — body `{csv}` with columns `studentId,studentRegNo,subjectCode,subjectName,marks,grade,credits,academicYear,semester`; handles duplicates via upsert

**Frontend:** Bulk Import card in Students tab (admin only) — paste CSV, click Import, shows per-row error details on failure.

### G9 — Specialization Selection Workflow

`services/student-service/src/models/SpecializationApplication.js` (new):
- `studentId` (unique), `preferences` ([{rank, specialization}]), `status` (pending/assigned/rejected), `assignedSpecialization`, `reviewedBy`, `reviewedAt`

`services/student-service/src/routes/specializations.js` (new):
- `GET /api/specializations` — list 8 available specializations (Agriculture Economics, Agronomy, etc.)
- `POST /api/specializations/:studentId` — student submits ranked preferences (upsert)
- `GET /api/specializations/:studentId` — get student's application
- `GET /api/specializations/all/pending` — admin: list all pending applications (populated)
- `PATCH /api/specializations/:studentId/assign` — admin assigns; syncs to Student record

**Frontend:** Specialization tab with:
- Apply form: student dropdown + ranked checkbox preferences (max 3)
- Admin assign form: student + specialization dropdowns
- Pending applications table (7 columns: Student / ID / 1st–3rd choice / Status / Assigned)

### G10 — Photo & Document Management

`services/student-service` — added `multer` with disk storage:
- `POST /api/students/:id/photo` — multipart upload (image/*, max 5 MB), saves to `/app/uploads/photo-{id}.ext`
- `GET /uploads/:filename` — express.static serve

Docker: `uploads-data` named volume mounted at `/app/uploads` in student-service.

### G11 — Notification Service + Kafka (full KRaft, no Zookeeper)

**Kafka broker:** `apache/kafka:3.7.0` running in KRaft mode (combined broker+controller, port 9092 internal / 9094 external), `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true`, 3 topics auto-created on first publish.

**Producers** (kafkajs, fail-silent pattern — services stay up even if Kafka is down):
- Student-service → `student.created` on `POST /api/students`
- Exam-service → `exam.registered` on `POST /api/exams/:id/entries`
- Result-service → `result.published` on `PATCH /api/results/gpa/:gpaId/finalize`

**Notification Service** (port 3006, notif_db):
- Consumer subscribes to all 3 topics; retries every 10 s until topics are auto-created
- Persists each event as `NotificationLog` (event, topic, recipientId, channel, message, payload, status, sentAt)
- `GET /api/notifications` — list recent logs, optional `?topic=` filter
- `GET /api/notifications/student/:studentId` — logs for one student

**Frontend:** Notifications tab with topic filter (student.created / exam.registered / result.published), notification log table (Time / Topic / Message / Recipient / Status), Kafka flow info card.

### Updated Services Table (8 running containers)

| Container | Port | Image |
|-----------|------|-------|
| Auth Service | 3007 | node:20-alpine |
| Student Service | 3001 | node:20-alpine |
| Exam Service | 3003 | node:20-alpine |
| Result Service | 3004 | node:20-alpine |
| Transcript Service | 3005 | node:20-alpine |
| Notification Service | 3006 | node:20-alpine |
| Kafka | 9092/9094 | apache/kafka:3.7.0 |
| MongoDB | 27017 | mongo:7 |

---

## Kafka Test Cases

Three end-to-end flows, one per topic. All use the frontend at `http://localhost:8080` except Test Case 3 Step 1–3 which use curl. A saved JWT token is required.

### Prerequisite — Get a token

```bash
# Seed demo users (run once)
curl -X POST http://localhost:3007/api/auth/seed

# Login as admin
curl -s -X POST http://localhost:3007/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -m json.tool
```

Copy the `token` value → paste into the frontend token field → **Save**.

---

### Test Case 1 — `student.created`

**Trigger:** Create a new student.

1. Go to **Students** tab
2. Fill in Name, Email, Student ID → **Create Student**
3. Go to **Notifications** tab → click **Load**

**Expected result:** A row with topic `student.created`:
> `New student registered: Alice Perera (AG/2024/001)`

**Verify via logs:**
```bash
docker compose logs notification-service --tail=5
```

---

### Test Case 2 — `exam.registered`

**Trigger:** Enrol a student in an exam.

1. Go to **Exams** tab → create an exam (Title, Course ID, Date)
2. Go to **Enrolment** tab → select the exam + the student → **Enrol**
3. Go to **Notifications** tab → click **Load**

**Expected result:** A row with topic `exam.registered`:
> `Student Alice Perera enrolled in exam: Semester 1 Final Exam`

---

### Test Case 3 — `result.published`

**Trigger:** Upload a result → compute GPA → finalize GPA.

**Step 1 — Upload a result:**
```bash
TOKEN="<your token>"
STUDENT_ID="<student MongoDB _id from Students tab>"

curl -s -X POST http://localhost:3004/api/results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "studentRegNo": "AG/2024/001",
    "subjectCode": "AS1101",
    "subjectName": "Introduction to Agriculture",
    "marks": 82,
    "grade": "A",
    "credits": 3,
    "academicYear": 1,
    "semester": 1
  }' | python3 -m json.tool
```

**Step 2 — Process GPA:**
```bash
curl -s -X POST http://localhost:3004/api/results/process-gpa \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"studentId":"'$STUDENT_ID'","studentRegNo":"AG/2024/001","academicYear":1}' \
  | python3 -m json.tool
```
Copy `gpaRecord._id` from the response.

**Step 3 — Finalize GPA** (fires the Kafka event):
```bash
GPA_ID="<gpaRecord _id>"

curl -s -X PATCH http://localhost:3004/api/results/gpa/$GPA_ID/finalize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}' | python3 -m json.tool
```

**Step 4 — Notifications tab** → filter by `result.published`:
> `GPA published for student <id> — Year 1: 4`

---

### Verify all notifications via API

```bash
curl -s http://localhost:3006/api/notifications \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Proof that Kafka is the transport (not HTTP)

The Notification Service has no REST connection to the other services — it only receives events through Kafka. Check the consumer log lines:

```bash
docker compose logs notification-service 2>&1 \
  | grep "\[student.created\]\|\[exam.registered\]\|\[result.published\]"
```

Each printed line is a message consumed from the Kafka broker.

---

## Repository & Documentation

### Document Organisation

All project files were reorganised from the root into two clearly named folders:

| Folder | Contents |
|--------|----------|
| `deliverable-docs/` | All 9 assignment deliverables (D1–D9) |
| `supportive-docs/` | Gap Analysis Report, Individual Assignment Plan, Information about existing system, PROGRESS.md, architecture diagram PNG |

Files moved using `git mv` so rename history is preserved in git log.

### GitHub Repository

Project pushed to GitHub: **https://github.com/nipunadeesarakarunatilleke/university-erp**

- Initial commit: 77 files — all service source trees, Dockerfiles, package.json files, frontend, documents
- `.env` (JWT secret) excluded via `.gitignore` — only `.env.example` committed
- All `node_modules/` directories excluded
- Second commit: document folder reorganisation (`deliverable-docs/` + `supportive-docs/`)
- Third commit: comprehensive README.md

### README.md

A comprehensive `README.md` was written at the project root covering:
- ASCII architecture diagram (8 containers, ports, REST + Kafka flows)
- Services table with ports, databases, and responsibilities
- Technology stack table with rationale for each choice
- All 12 gaps (G1–G12) grouped by phase
- Cross-service communication patterns (sync REST + async Kafka)
- GPA formula and grade-to-points mapping
- User roles and permissions matrix
- 6-step getting started guide with curl commands
- Demo users credentials table
- Full project folder structure
- Service health check one-liner
- Gap analysis summary table

---

## Additional Documents

| Document | File | Description |
|----------|------|-------------|
| Gap Analysis Report | `supportive-docs/Gap Analysis Report.docx` | Comparison of existing MIS (Rajarata University) vs new microservice ERP — 12 gaps identified with a 3-phase implementation roadmap |
| README | `README.md` | Comprehensive project description for GitHub — architecture, setup, features, API reference |

---

## Prototype

### Services Built

| Service | Port | DB | Key additions |
|---------|------|----|---------------|
| Auth Service | 3007 | auth_db | bcrypt, JWT with role claim, seed endpoint |
| Student Service | 3001 | students_db | 35+ profile fields, year registration, specialization, photo upload, bulk import, Kafka producer |
| Exam Service | 3003 | exams_db | registration windows, entry approval workflow, admission card, Kafka producer |
| Result Service | 3004 | results_db | grade→points hook, GPA processing, bulk import, Kafka producer |
| Transcript Service | 3005 | transcripts_db | cross-service aggregation (Student + Result) |
| Notification Service | 3006 | notif_db | Kafka consumer (3 topics), NotificationLog model |

### File Structure

```
services/
├── auth-service/src/{models/User.js, routes/auth.js}
├── student-service/src/
│   ├── config/{db.js, kafka.js}
│   ├── middleware/auth.js
│   ├── models/{Student.js, YearRegistration.js, SpecializationApplication.js}
│   └── routes/{students.js, specializations.js}
├── exam-service/src/
│   ├── config/{db.js, kafka.js}
│   ├── models/{Exam.js, Entry.js}
│   └── routes/exams.js
├── result-service/src/
│   ├── config/{db.js, kafka.js}
│   ├── models/{Result.js, GPA.js}
│   └── routes/results.js
├── transcript-service/src/routes/transcripts.js
└── notification-service/src/
    ├── config/{db.js, kafka.js}
    ├── consumers/index.js
    ├── models/NotificationLog.js
    └── routes/notifications.js
docker-compose.yml          ← MongoDB + Kafka (KRaft) + 6 services + nginx
.env.example
```

### Key Cross-Service Flows

**Sync REST (exam enrolment):**
```
POST /api/exams/:id/entries
  └── Exam Service → GET /api/students/:id (Student Service)
        ├── 200 OK → create Entry, publish exam.registered to Kafka
        ├── 404    → 404 "Student not found"
        └── error  → 502 "Student Service unavailable"
```

**Async Kafka (notifications):**
```
Student Service  ──[student.created]──▶ Kafka ──▶ Notification Service
Exam Service     ──[exam.registered]──▶ Kafka ──▶ Notification Service
Result Service   ──[result.published]─▶ Kafka ──▶ Notification Service
```

### Frontend

Single-page HTML/JS/jQuery app served by nginx on port 8080.

| File | Purpose |
|------|---------|
| `frontend/index.html` | App shell — Bootstrap 5 tabs |
| `frontend/css/style.css` | University blue theme |
| `frontend/js/app.js` | jQuery AJAX, all service calls |
| `frontend/nginx.conf` | Static-file nginx config |

**Tabs (7 total):**
- **Dashboard** — 7 service health cards + cross-service flow diagram
- **Students** — create student form, students table, bulk CSV import (admin)
- **Exams** — create exam form, exams table
- **Enrolment** — enrol student in exam, entries table with Approve/Reject/Reset (admin/HOD/Lecturer)
- **Results** — view results grouped by year/semester, GPA summary pills, upload result (admin)
- **Specialization** — apply for specialization (student), assign specialization (admin)
- **Notifications** — Kafka event log, filterable by topic

JWT token saved to `localStorage` — paste once, persists across refreshes.

### How to Run

```bash
cp .env.example .env            # set JWT_SECRET=any-secret-string
docker compose up --build -d    # starts all 8 containers (MongoDB, Kafka, 6 services, nginx)
# open http://localhost:8080

# Seed demo users and get a token
curl -X POST http://localhost:3007/api/auth/seed
curl -s -X POST http://localhost:3007/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -m json.tool
# Copy token → paste into frontend → Save
```

---

## Documents Completed

### Architecture Design Document
- **Q2 update (2026-07-13):** Removed four prototype-era stale sentences; updated to reflect all 6 services fully built and Kafka running:
  - Para 108: "Note: The prototype implements Student Service and Exam Service only..." → all six services listed, Kafka 3.7 KRaft noted
  - Para 110: "The prototype is scoped to two services..." → "All six services are fully implemented and deployed via Docker Compose..."
  - Para 111: "Kafka is included in the design but not wired in the prototype — events are noted in code comments." → Kafka KRaft implementation described with 3 topics and Notification Service consumer
  - Para 114: "only Student and Exam paths are active in the prototype." → all six service paths active
- **Q3 update (2026-07-13):** Component architecture diagram assets created:
  - `deliverable-docs/architecture-diagram.html` — self-contained HTML diagram (4 layers: NGINX → 6 services → MongoDB → Kafka event flows); Kafka shown as horizontal event-flow rows separate from MongoDB to clarify Kafka connects microservices, not databases
  - `deliverable-docs/architecture-diagram.drawio` — mxGraph XML for draw.io (A3 landscape, 1654×1169), same 4-layer layout; open in draw.io desktop/web and export as PNG to insert into Architecture Design Document.docx
- Executive summary
- System context (3 user types: student, admin, automated)
- Architectural principles (single responsibility, database-per-service, API-first, loose coupling)
- All 8 services described with port, database, key endpoints
- Technology decisions table with rationale (Node.js, MongoDB, NGINX, JWT, axios, Kafka, Docker)
- NGINX routing table (all 8 path prefixes)
- JWT authentication strategy
- Inter-service communication (sync REST + async Kafka)
- **Database Strategy embedded (Section 6)** — database-per-service justification, MongoDB vs PostgreSQL rationale
- Deployment overview
- Assumptions & constraints

### Service Identification Table
- All 8 services with port, business capability, owned data, database name, communication type
- Service boundary rules
- Sync REST communication table (caller → called → endpoint → purpose)
- Async Kafka event table (topic → producer → consumers)
- Full technology stack table

### Bounded Context Diagram
- Mermaid diagram source in `Bounded Context Diagram.md` (render at mermaid.live or draw.io)
- 8 bounded context subgraphs, each showing owned entities with key fields
- Dashed arrows for 9 cross-boundary references labelled with mechanism (REST / Kafka / ref)
- Covers: description of all 8 contexts (port, database, entities, explanation), cross-boundary reference table, 5 data ownership rules

### API Endpoint Design
- 29 endpoints across all 8 services
- Per-endpoint detail: HTTP method, path, auth required, request body JSON schema, response JSON schema, status codes, notes
- Highlights cross-service endpoints: `POST /api/exams/:id/entries` (502 on Student Service failure), `POST /api/transcripts/:studentId/generate` (502 on Result Service failure)
- Section 10 is a full summary table of all 29 endpoints at a glance
- **Q5 + Q6 update (2026-07-13):**
  - 403 Forbidden row added to global status codes table (after 401)
  - Section 1.3 Standard Error Response: standard `{ "error": "..." }` JSON format, 502 `detail` field pattern, 8-row error code reference table (400/401/403/404/409/502/500)
  - Section 1.4 Role-Based Access Control: role definitions table (5 roles × 2 cols), endpoint restriction table (16 rows covering all write/management endpoints)

### Service Communication Diagram
- Mermaid flowchart source in `Service Communication Diagram.md` (render at mermaid.live)
- 4 subgraphs: Client Layer, Internal Services, Kafka Event Bus, MongoDB Cluster
- Solid arrows: NGINX path routing (8 paths) + 2 cross-service REST calls
- Dashed arrows: 3 Kafka producers → 5 consumer subscriptions
- Covers: communication layers, sync flows table, 3 Kafka event detail blocks, NGINX routing table, error propagation rules, prototype scope note

### Benefits and Risks
- 7 benefits: independent deployability, fault isolation, scalability, technology flexibility,
  focused codebases, async decoupling, team autonomy
- 7 risks with mitigations: distributed complexity, data consistency, infrastructure overhead,
  inter-service latency, debugging difficulty, security surface area, API versioning / backward compatibility
- Summary table (12 dimensions, net verdict per dimension)
- **Q7 update (2026-07-13):** Added Risk 3.7 — API Versioning / Backward Compatibility; risk text explains consumer services breaking when producer changes API or event schema; mitigation table covers API versioning, Kafka schema versioning, Schema Registry, contract testing, additive-only changes; new row added to summary table

### AI Usage Report
- 10 pre-filled log entries covering every AI task in this session (architecture analysis, document generation, prototype scaffolding)
- Each entry has: tool, task, prompt, output summary, and `[YOUR INPUT REQUIRED]` fields for corrections, validation, mistakes, and reflection
- Blank template for any additional entries
- Overall reflection prompts (5 guiding questions)
- **Action required:** fill in all `[YOUR INPUT REQUIRED]` fields before submission

---

## Team Questions Review (2026-07-13)

The team raised 7 questions in `supportive-docs/Team questions.docx`. All answers are documented in `supportive-docs/answers.md`. Document updates triggered by the questions:

| Q | Question summary | Answer / Action |
|---|-----------------|-----------------|
| Q1 | Is Result Service path `GET /api/results/student/:studentId` correct? | Already correct — no change needed |
| Q2 | Notification Service listed twice / contradiction in Architecture Design Doc | Fixed — 4 prototype-era stale sentences removed/updated in Architecture Design Document.docx |
| Q3 | Add a component-level architecture diagram | Created `architecture-diagram.html` and `architecture-diagram.drawio`; Mermaid source also in answers.md |
| Q5 | Certain endpoints should be role-restricted — document it | Section 1.4 RBAC added to API Endpoint Design.docx |
| Q6 | Add a standard error response schema to the API doc | Section 1.3 Standard Error Response + 403 row added to API Endpoint Design.docx |
| Q7 | Add API Versioning / Backward Compatibility to Risks | Risk 3.7 + mitigation table + summary table row added to Benefits and Risks.docx |

All triggered document changes committed and pushed to GitHub on 2026-07-13.

---

## Remaining Work

All deliverables complete. ✅

### Pre-Submission Checklist
- [x] All 12 gaps implemented across 3 phases ✅
- [x] All 8 containers running and healthy (`docker compose up --build -d`) ✅
- [x] Kafka pipeline verified: student.created / exam.registered / result.published → Notification Service ✅
- [x] Documents organised into `deliverable-docs/` and `supportive-docs/` ✅
- [x] Project pushed to GitHub: https://github.com/nipunadeesarakarunatilleke/university-erp ✅
- [x] Comprehensive README.md written and pushed ✅
- [x] Team questions answered (`supportive-docs/answers.md`) ✅
- [x] Architecture Design Document updated (Q2 stale prototype sentences removed) ✅
- [x] API Endpoint Design updated (Q5 RBAC section + Q6 error schema + 403 row) ✅
- [x] Benefits and Risks updated (Q7 Risk 3.7 API versioning) ✅
- [x] Architecture diagram assets created (`architecture-diagram.html`, `architecture-diagram.drawio`) ✅
- [ ] Export `architecture-diagram.drawio` as PNG → insert into `deliverable-docs/Architecture Design Document.docx`
- [ ] Fill in `[YOUR INPUT REQUIRED]` fields in `deliverable-docs/AI Usage Report.docx`
- [ ] Render `deliverable-docs/Bounded Context Diagram.md` in mermaid.live → export PNG → insert into `deliverable-docs/Bounded Context Diagram.docx`
- [ ] Render `deliverable-docs/Service Communication Diagram.md` in mermaid.live → export PNG → insert into `deliverable-docs/Service Communication Diagram.docx`
- [ ] Proofread all documents for consistent terminology
- [ ] Assemble final submission package

---

## Architecture Reference

### Services — Built vs Planned

| Service | Port | DB | Libs | Status |
|---------|------|----|------|--------|
| Auth Service | 3007 | auth_db | jsonwebtoken, bcrypt | ✅ Built |
| Student Service | 3001 | students_db | mongoose, kafkajs, multer | ✅ Built |
| Exam Service | 3003 | exams_db | mongoose, axios, kafkajs | ✅ Built |
| Result Service | 3004 | results_db | mongoose, kafkajs | ✅ Built |
| Transcript Service | 3005 | transcripts_db | mongoose, axios | ✅ Built |
| Notification Service | 3006 | notif_db | mongoose, kafkajs | ✅ Built |
| Course Service | 3002 | courses_db | mongoose | Planned (not built) |
| Reporting Service | 3008 | reports_db | mongoose, kafkajs | Planned (not built) |

### Kafka Events (implemented)

| Event | Producer | Trigger | Consumer |
|-------|----------|---------|----------|
| `student.created` | Student Service | POST /api/students | Notification Service |
| `exam.registered` | Exam Service | POST /api/exams/:id/entries | Notification Service |
| `result.published` | Result Service | PATCH /api/results/gpa/:id/finalize | Notification Service |

### NGINX Path Routing

| Path Prefix | Service | Port |
|-------------|---------|------|
| `/api/auth` | Auth Service | 3007 |
| `/api/students` | Student Service | 3001 |
| `/api/courses` | Course Service | 3002 |
| `/api/exams` | Exam Service | 3003 |
| `/api/results` | Result Service | 3004 |
| `/api/transcripts` | Transcript Service | 3005 |
| `/api/notifications` | Notification Service | 3006 |
| `/api/reports` | Reporting Service | 3008 |
