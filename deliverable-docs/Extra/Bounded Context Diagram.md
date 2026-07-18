# Bounded Context Diagram — Bounded Context Diagram

> Paste the code block below into [draw.io](https://app.diagrams.net) → Extras → Edit Diagram,
> or open in VS Code with the **Markdown Preview Mermaid Support** extension.

```mermaid
graph TB
    subgraph AUTH["🔐 Auth Context (auth_db)"]
        direction TB
        User["User\n─────────\nid\nname\nemail\npasswordHash\nrole"]
        Token["Token\n─────────\nuserId\ntokenValue\nexpiresAt"]
    end

    subgraph STUDENT["👤 Student Context (students_db)"]
        direction TB
        Student["Student\n─────────\nid\nname\nemail\nstudentId\nprogramme"]
        Enrolment["Enrolment\n─────────\nstudentId\ncourseId\nenrolledAt"]
    end

    subgraph COURSE["📚 Course Context (courses_db)"]
        direction TB
        Course["Course\n─────────\nid\ntitle\ncourseCode\ncredits"]
        Module["Module\n─────────\ncourseId\ntitle\nweek"]
    end

    subgraph EXAM["📝 Exam Context (exams_db)"]
        direction TB
        Exam["Exam\n─────────\nid\ntitle\ncourseId ◀ ref\ndate\nvenue"]
        Entry["Entry\n─────────\nexamId\nstudentId ◀ ref\nstudentName\nenrolledAt"]
    end

    subgraph RESULT["📊 Result Context (results_db)"]
        direction TB
        Result["Result\n─────────\nid\nstudentId ◀ ref\nexamId ◀ ref\ngrade\nscore\npublishedAt"]
    end

    subgraph TRANSCRIPT["📄 Transcript Context (transcripts_db)"]
        direction TB
        Transcript["Transcript\n─────────\nid\nstudentId ◀ ref\ngeneratedAt\npdfPath"]
    end

    subgraph NOTIF["🔔 Notification Context (notif_db)"]
        direction TB
        NotifLog["NotificationLog\n─────────\nid\nstudentId ◀ ref\nevent\nsentAt\nchannel"]
    end

    subgraph REPORT["📈 Reporting Context (reports_db)"]
        direction TB
        Snapshot["Snapshot\n─────────\nexamId ◀ ref\npassRate\ntotalEntries\ncreatedAt"]
        Metric["Metric\n─────────\nname\nvalue\nperiod"]
    end

    %% ── Cross-boundary references (dashed = reference only, no direct DB join) ──
    Entry        -. "studentId (REST verify)" .-> Student
    Entry        -. "courseId (ref)" .->         Course
    Result       -. "studentId (ref)" .->         Student
    Result       -. "examId (ref)" .->            Exam
    Transcript   -. "studentId (ref)" .->         Student
    Transcript   -. "reads grades (REST)" .->     Result
    NotifLog     -. "studentId (Kafka event)" .-> Student
    Snapshot     -. "examId (Kafka event)" .->    Exam
    Snapshot     -. "from result.published" .->   Result
```

---

## How to render

| Tool | Steps |
|------|-------|
| **draw.io** (recommended) | Go to [app.diagrams.net](https://app.diagrams.net) → Extras → Edit Diagram → paste the Mermaid code block |
| **VS Code** | Install *Markdown Preview Mermaid Support* extension → open this file → Ctrl+Shift+V |
| **Mermaid Live** | Go to [mermaid.live](https://mermaid.live) → paste the code block contents |

Export as **PNG or SVG** from draw.io and insert into your final Word submission.

---

## Cross-Boundary Reference Key

| Arrow | Meaning |
|-------|---------|
| Solid `-->` | Owned relationship (within the same context) |
| Dashed `-.->` | Cross-context reference — passes only the **ID**, never a direct DB join |
| `REST verify` | Synchronous HTTP call to confirm the entity exists at enrolment time |
| `Kafka event` | Asynchronous event — ID is carried in the event payload |
