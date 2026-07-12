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
| Container | Docker + docker-compose | Reproducible single-command startup for all 8 containers |

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

## Getting Started

### Prerequisites
- Docker Desktop
- Git

### Run the project

```bash
# 1. Clone the repository
git clone https://github.com/nipunadeesarakarunatilleke/university-erp.git
cd university-erp

# 2. Set environment variables
cp .env.example .env
# Edit .env and set: JWT_SECRET=any-long-secret-string

# 3. Start all 8 containers
docker compose up --build -d

# 4. Seed demo users
curl -X POST http://localhost:3007/api/auth/seed

# 5. Get a JWT token
curl -s -X POST http://localhost:3007/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -m json.tool

# 6. Open the frontend
open http://localhost:8080
# Paste the token → Save → start exploring
```

### Demo Users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | ADMIN |
| examdiv | exam123 | EXAM_DIVISION |
| hod | hod123 | HOD |
| lecturer | lecturer123 | LECTURER |
| student1 | student123 | STUDENT |

---

## Project Structure

```
university-erp/
├── deliverable-docs/               # Assignment deliverables (D1–D9)
│   ├── Architecture Design Document.docx
│   ├── Service Identification Table.docx
│   ├── Bounded Context Diagram.docx / .md
│   ├── API Endpoint Design.docx
│   ├── Service Communication Diagram.docx / .md
│   ├── Benefits and Risks.docx
│   └── AI Usage Report.docx
├── supportive-docs/                # Background research & tracking
│   ├── Gap Analysis Report.docx
│   ├── Individual Assignment Plan.docx
│   ├── Information about existing system/
│   └── PROGRESS.md
├── services/
│   ├── auth-service/
│   ├── student-service/
│   ├── exam-service/
│   ├── result-service/
│   ├── transcript-service/
│   └── notification-service/
├── frontend/                       # Static SPA (Bootstrap 5 + jQuery)
│   ├── index.html
│   ├── js/app.js
│   ├── css/style.css
│   └── nginx.conf
├── docker-compose.yml              # All 8 containers
├── .env.example
└── .gitignore
```

---

## Service Health Check

Once running, verify all services:

```bash
for port in 3001 3003 3004 3005 3006 3007; do
  echo -n "Port $port: "
  curl -sf http://localhost:$port/health
  echo
done
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
