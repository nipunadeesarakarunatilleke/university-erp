# Project Evaluation Report

**Assignment:** Microservice Architecture and Prototype — Group Assignment
**Reference brief:** `supportive-docs/Microservice Architecture and Prototype - Group Assignment.pdf`
**Evaluated:** 2026-07-18
**Method:** Full repository audit — every deliverable `.docx` extracted and read in full, all prototype route files inspected, `docker-compose.yml` and `package.json` files checked, git history reviewed, all embedded diagram images opened and visually inspected. This is a self-assessment against the brief's own "Common Evaluation Criteria," not an official grade.

---

## 0. Read This First — Scope Mismatch

The brief states **"10 members per group."** Every commit in this repository (`git log`) is authored by a single person, and `supportive-docs/Individual Assignment Plan.docx` explicitly frames the work as a **"Solo execution plan."** If this repository is being submitted as the group's actual output, that is the single biggest risk in the whole submission — an examiner comparing this against a 10-person roster will ask where the other nine members' contributions are. This report evaluates the work that exists, but this scope question sits above all the criteria below and should be resolved with the group/module coordinator before submission.

---

## 1. Expected Deliverables — Completion Check

| # | Deliverable | Exists | Content Matches Prototype? |
|---|---|---|---|
| D1 | Microservice architecture design document | ✅ `Architecture Design Document.docx` | ❌ Describes an 8-service, 2-service-prototype design that predates the actual 6-service build |
| D2 | Service identification table | ✅ `Service Identification Table.docx` | ❌ Same stale 8-service/2-built scope |
| D3 | Bounded context diagram | ✅ `Bounded Context Diagram.docx` (Mermaid image embedded, 6954×6157, high quality) | ⚠️ Diagram itself is clear and correct *for the design it describes*, but that design (PDF transcripts, Course/Reporting contexts as if real) is not what was built |
| D4 | API endpoint design | ✅ `API Endpoint Design.docx` | ❌ Not one documented endpoint path matches the actual route files (see §3) |
| D5 | Service communication diagram | ✅ `Service Communication Diagram.docx` (Mermaid image embedded, 4944×8192) | ❌ Same stale design; also an unusually tall/narrow aspect ratio suggests the Mermaid export wasn't cropped before insertion |
| D6 | Database-per-service discussion | ✅ Embedded as Section 6 of D1 | ✅ The *argument* (why not shared DB, why MongoDB) is sound and reusable regardless of scope |
| D7 | Prototype (≥2 services) | ✅ 6 services + Auth, running via `docker-compose.yml`, Kafka wired | ✅ This dramatically **exceeds** the brief's minimum bar — see §4 |
| D8 | Benefits and risks | ✅ `Benefits and Risks.docx` | ⚠️ Good content, but a formatting defect leaves a "3.7 API Versioning" heading orphaned after its own body text (see §3) |
| D9 | AI usage report | ✅ `AI Usage Report.docx` | ❌ 7 of 9 logged entries still contain literal `[YOUR INPUT REQUIRED]` placeholders; the mandatory Overall Reflection section is entirely unfilled |

**All 9 deliverables exist as files.** That is the good news. The bad news, detailed below, is that most of the written deliverables document a version of the system that is no longer the one running in `services/`.

---

## 2. The Core Finding: Documentation Describes an Earlier System

This is the single most important thing to fix before submission, so it gets its own section.

`supportive-docs/PROGRESS.md` claims (under "Team Questions Review", 2026-07-13) that four stale prototype-era sentences were removed from the Architecture Design Document as part of a "Q2 update." **That update was never actually applied to the file.** Checking git history:

- Commit `8312fc6` ("update Architecture Design Document with manual edits") changed only the binary `.docx`.
- Commit `9cf0a2e` ("record Q2-Q7 document updates...") changed **only `PROGRESS.md`**, not the `.docx` it claims to describe.

Re-extracting the current document text confirms the stale sentences are still present verbatim, in **three separate deliverables**:

| Document | Stale sentence still present |
|---|---|
| Architecture Design Document §10–11 | *"The prototype ... implements Student Service and Exam Service only. The remaining six services are designed ... but noted as 'designed, not implemented'."* / *"Kafka is included in the design but not wired in the prototype."* |
| Service Identification Table §5 | *"The prototype ... implements Student Service and Exam Service only."* |
| Benefits and Risks §3.3 | *"For the prototype, only Student and Exam services are active."* |
| Service Communication Diagram §8 | *"Kafka event emission ... is noted in code comments but not wired to a running Kafka instance."* |

**None of this is true of the actual system.** The real prototype (confirmed by reading `docker-compose.yml` and every route file directly) has:
- **Six working services** (Auth, Student, Exam, Result, Transcript, Notification), not two.
- **Kafka fully wired** — `kafkajs` producers in Student/Exam/Result and a live consumer in Notification, not "noted in comments."
- A completely different **API surface** than any of the four documents above describe (see §3).

This is not a cosmetic issue — under the brief's own criteria it directly damages **"Quality of documentation"** and **"Clarity of presentation and final report,"** because an examiner reading D1, D2, D5, or D8 will form an inaccurate picture of what was built, then be confused (or impressed, but for the wrong reasons) when they see the actual `docker-compose up`.

`README.md` at the repo root, by contrast, **is accurate** — it correctly describes all 6 running services, their real endpoints, and the working Kafka pipeline. It is the most trustworthy document in the repository. If time is short, use it as the source of truth to correct the `.docx` deliverables.

---

## 3. API Endpoint Design vs. Actual Code — Concrete Diff

`API Endpoint Design.docx` was checked line-by-line against every `router.*` call in `services/*/src/routes/*.js`. Not one path matches:

| Service | Documented (docx) | Actually implemented (code) |
|---|---|---|
| Auth | `POST /register`, `/login`, `/refresh` | `POST /register`, `/login`, `/seed`, `PATCH /reset-password` — no `/refresh` exists |
| Student | `POST /`, `GET /`, `GET /:id`, `PUT /:id` | `PATCH /:id` (not PUT), plus `POST /bulk`, `POST /:id/photo`, `POST /:id/year-registration`, `GET /:id/year-registrations`, `POST /bulk-year-registration`, and a whole `specializations.js` router — none documented |
| Exam | `POST /`, `GET /`, `POST /:id/entries`, `GET /:id/entries`, `DELETE /:id/entries/:entryId` | `PATCH /:id/schedule`, `PATCH /:id/toggle`, `PATCH /:id/entries/:entryId` (approval workflow), `GET /:id/admission-card` — none documented; `DELETE` on entries doesn't exist in code |
| Result | `POST /`, `GET /student/:studentId`, `GET /exam/:examId`, `POST /:id/publish` | `POST /bulk`, `POST /process-gpa`, `GET /gpa/:studentId`, `PATCH /gpa/:gpaId/finalize` — the entire GPA subsystem (the actual grading model used) is undocumented; `/exam/:examId` and `/:id/publish` don't exist in code |
| Transcript | `POST /:studentId/generate` (PDF), `GET /:studentId`, `GET /:studentId/download` | `GET /:studentId/semester/:sem`, `GET /:studentId/final` — the real service returns JSON aggregation, not a generated PDF; `pdfkit` is referenced in the design doc but not used anywhere in `services/transcript-service` |
| Notification | `GET /:studentId` | `GET /`, `GET /student/:studentId` |
| Course, Reporting | Fully specified with request/response schemas | Not built at all — confirmed absent from `services/` and `docker-compose.yml` |

Curiously, **Section 1.4 (Role-Based Access Control)** of the same document — added later per the Q5 update — *does* reference several of the real endpoints (`PATCH /api/students/:id`, `POST /api/results/bulk`, `PATCH /api/results/gpa/:id/finalize`, `PATCH /api/specializations/:id/assign`). So the document is internally inconsistent: its own RBAC table names endpoints that Sections 2–9 of the same document never define.

**Recommendation:** regenerate Sections 2–10 of `API Endpoint Design.docx` from the real routes (all six services), which will also make the RBAC table finally consistent with the rest of the document.

---

## 4. Evaluation Against the Brief's 10 "Common Evaluation Criteria"

### 4.1 Understanding of the existing system — **Strong**
`supportive-docs/Gap Analysis Report.docx` and the four transcripts in `Information about existing system/` show real engagement with a concrete reference system (Rajarata University's `agrimis.rjt.ac.lk` MIS), not a hypothetical strawman. 12 concrete gaps (G1–G12) were identified and prioritized into a 3-phase roadmap, and — unusually for a student project — all 12 were actually implemented (year registration, exam approval workflow, GPA processing, specialization selection, bulk CSV import, photo upload). This is a genuine strength and should be foregrounded in the final report.

### 4.2 Correct application of Requirements Engineering concepts — **Weak evidence in the deliverables**
The gap analysis (§4.1) demonstrates real RE work happened, but it isn't surfaced in the formal deliverables in a way an examiner can easily credit — there's no explicit functional/non-functional/domain requirements catalogue anywhere in `deliverable-docs/`. This overlaps directly with the next criterion.

### 4.3 Quality of documentation — **Weak, due to §2 and §3 above**
Individually, each document is well-formatted, uses consistent tables, and is written in clear professional prose — the *writing quality* is good. But four of nine deliverables describe a system that no longer exists, and `API Endpoint Design.docx` doesn't correctly describe any service. Documentation that is well-written but factually wrong about its own subject scores worse than documentation that is plainer but accurate.

### 4.4 Quality of diagrams and models — **Good, with one gap**
Both Mermaid diagrams that were checked (Bounded Context, Service Communication) are genuinely well-drawn: clear boxes, typed icons, labelled cross-boundary arrows distinguishing REST vs. Kafka vs. plain reference, a legend, readable at their exported resolution. The `architecture-diagram.html`/`.drawio` component diagram (see `deliverable-docs/`) adds a third, complementary view. The gap is the same one as above — the diagrams model the 8-service design, not the 6-service reality, so they need re-drawing (or at minimum, a clearly labelled "as-built" companion diagram) once the text is corrected.

### 4.5 Correct distinction between functional, non-functional, and domain requirements — **Not demonstrated**
No document in `deliverable-docs/` or `supportive-docs/` explicitly labels requirements as functional, non-functional, or domain. This isn't necessarily wrong for a group of these particular deliverables (the brief's deliverable list doesn't demand a requirements catalogue by name), but since it's called out as its own scored criterion, a short explicit table (even one page, e.g. in D1 §2) mapping a handful of examples in each category would directly address it and is low effort for the credit available.

### 4.6 Practical use of AI tools — **Strong**
The AI Usage Report's *completed* entries (1, 2) show specific, real prompts and concrete outputs, not generic descriptions. The tool was clearly used throughout the actual build (architecture generation, document generation, prototype scaffolding, gap analysis), which is evident from the sheer coherence and volume of consistent output across `deliverable-docs/`, `supportive-docs/`, and `services/`.

### 4.7 Human validation of AI outputs — **Weak, and this is the easiest fix in this report**
This is scored as its own criterion and is currently the worst-served one. Of 9 logged AI interactions, entries 4 through 10 (7 of 9) still contain the literal placeholder text `[YOUR INPUT REQUIRED]` in the Human corrections, Validation method, Mistakes/hallucinations, and Reflection fields. Section 5, "Overall Reflection" — explicitly required by the brief's own deliverable spec ("Reflection on whether AI improved the software engineering process") — is entirely blank. The brief states this section "is evaluated on honesty and depth, not on how much AI you used," which means filling in real, specific answers (even "I didn't catch this until re-reading it" is a valid, creditable answer) is pure upside with no downside. This is the single highest-value, lowest-effort fix available before submission.

### 4.8 Creativity and feasibility of the proposed solution — **Strong**
The GPA subsystem (grade→points mapping, `Σ(gradePoints×credits)/Σ(credits)` computation, draft/final status), the exam entry approval workflow with role-gated actions, the specialization ranking/assignment flow, and the fail-silent Kafka producer pattern (services stay up if the broker is down) are all genuinely thought-through, non-trivial design decisions that go beyond copying the brief's example service list. This is real engineering judgement, not just scaffolding.

### 4.9 Quality of prototype, where applicable — **Strong functionally, weak on engineering hygiene**
Strengths: 6 working services (triple the brief's 2-service minimum), a real Kafka event pipeline with 3 topics and a working consumer, JWT auth with 5 roles enforced across services, a role-aware frontend SPA (~1,574 lines across `index.html`/`app.js`), and Docker Compose orchestration that starts the whole stack with one command.
Gaps: **zero automated tests** exist anywhere in the repository (`find . -iname "*.test.js"` returns nothing, and no `package.json` in any service defines a `test` script), despite the project's own `Individual Assignment Plan.docx` timeline explicitly scheduling "write unit tests" for Week 3. For a prototype this functionally rich, the complete absence of tests is the most visible engineering gap, and it's also the thing most likely to be checked live in a demo ("what happens if I run `npm test`?").

### 4.10 Clarity of presentation and final report — **Depends entirely on fixing §2**
No single "final report" document currently exists that ties the nine deliverables together into one submission-ready narrative — each `.docx` stands alone. Combined with the documentation/reality drift, an examiner moving from README → docx deliverables → live demo will encounter three different, inconsistent descriptions of the same system. Fixing the drift and assembling a short cover/final report (even 1–2 pages summarising what was designed, what was built, and *why* the two differ — framing the extra scope as a strength, not hiding it) would resolve this criterion directly.

---

## 5. Priority Fix List (ranked by evaluation impact ÷ effort)

1. **Fill in the AI Usage Report** (§4.7). Highest credit-per-minute available — the content to answer most fields already exists in this session's/your own memory of the work; it just needs writing down honestly.
2. **Resolve the group-vs-solo scope question** (§0) with whoever is coordinating submission — this affects how everything else should be framed.
3. **Correct the four stale "2-service, no-Kafka" sentences** across Architecture Design Document, Service Identification Table, Benefits and Risks, and Service Communication Diagram (§2) — small, mechanical edits with outsized effect on perceived documentation quality.
4. **Regenerate `API Endpoint Design.docx`** Sections 2–10 from the actual six services' routes (§3) — this is the deliverable furthest from reality and the most likely to be spot-checked against the running prototype.
5. **Add a short functional/non-functional/domain requirements table** to D1 (§4.5) — cheap, directly answers a named criterion.
6. **Add automated tests** — even a handful of integration tests per service (health check + one happy-path + one error-path) would materially change the "Quality of prototype" story and is demoable.
7. **Fix the orphaned "3.7 API Versioning" heading** in Benefits and Risks (§1) and re-crop/re-export the very tall Service Communication Diagram image before final assembly — small polish items.
8. **Assemble a short final report** binding the nine deliverables together (§4.10), explicitly noting where the build exceeded the brief's minimum scope (6 services vs. 2 required; full Kafka pipeline; 12 gap-analysis items implemented) as a deliberate strength.

---

## 6. Bottom Line

The **prototype itself is the strongest part of this submission** — it substantially exceeds the brief's minimum bar and reflects real, creative engineering decisions grounded in a genuine study of an existing system. The **weakest part is that the written deliverables no longer describe the prototype that was actually built**, and the **AI Usage Report — a deliverable explicitly scored on honesty — is mostly unfilled**. Both are fixable in hours, not days, and neither requires new engineering work, only bringing the documentation into alignment with what already exists in `services/` and completing fields that are already scaffolded and waiting for real answers.
