const router = require('express').Router();
const Result = require('../models/Result');
const GPA    = require('../models/GPA');
const auth   = require('../middleware/auth');
const { publish } = require('../config/kafka');

// CSV parsing helper
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line, i) => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length < headers.length) throw new Error(`Row ${i + 2} has fewer columns than header`);
    return Object.fromEntries(headers.map((h, idx) => [h, values[idx] || '']));
  });
}

// ── POST /api/results — upload a single subject result ────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const result = new Result(req.body);
    await result.save();
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      const { studentId, subjectCode, academicYear, isRepeat } = req.body;
      const updated = await Result.findOneAndUpdate(
        { studentId, subjectCode, academicYear, isRepeat: isRepeat || false },
        { $set: req.body },
        { new: true, runValidators: true }
      );
      return res.json(updated);
    }
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/results/bulk — bulk import results from CSV (G3) ───────────────
router.post('/bulk', auth, async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'csv field is required' });

    const rows = parseCSV(csv);
    const created = [];
    const errors  = [];

    for (const row of rows) {
      try {
        const payload = {
          studentId:    row.studentId,
          studentRegNo: row.studentRegNo || '',
          subjectCode:  row.subjectCode,
          subjectName:  row.subjectName  || '',
          marks:        row.marks  ? parseFloat(row.marks)  : undefined,
          grade:        row.grade,
          credits:      row.credits ? parseInt(row.credits) : 3,
          academicYear: row.academicYear ? parseInt(row.academicYear) : undefined,
          semester:     row.semester     ? parseInt(row.semester)     : undefined,
        };
        const result = new Result(payload);
        await result.save();
        created.push(row.subjectCode + '/' + row.studentId);
      } catch (err) {
        if (err.code === 11000) {
          // upsert duplicate
          try {
            await Result.findOneAndUpdate(
              { studentId: row.studentId, subjectCode: row.subjectCode, academicYear: parseInt(row.academicYear), isRepeat: false },
              { $set: { grade: row.grade, marks: parseFloat(row.marks) || undefined } },
              { new: true }
            );
            created.push(row.subjectCode + '/' + row.studentId + ' (updated)');
          } catch (e2) {
            errors.push({ row: row.subjectCode, error: e2.message });
          }
        } else {
          errors.push({ row: row.subjectCode + '/' + row.studentId, error: err.message });
        }
      }
    }

    res.status(207).json({ created: created.length, errors: errors.length, createdIds: created, errorDetails: errors });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/results — query results ─────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.studentId)    filter.studentId    = req.query.studentId;
    if (req.query.semester)     filter.semester     = Number(req.query.semester);
    if (req.query.academicYear) filter.academicYear = Number(req.query.academicYear);

    const results = await Result.find(filter).sort({ academicYear: 1, semester: 1, subjectCode: 1 });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/results/student/:studentId — all results grouped by semester ─────
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const results = await Result.find({ studentId: req.params.studentId })
      .sort({ academicYear: 1, semester: 1 });

    const grouped = {};
    results.forEach(r => {
      const key = `Year ${r.academicYear} — Semester ${r.semester}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    const gpa = await GPA.find({ studentId: req.params.studentId }).sort({ academicYear: 1 });
    res.json({ results, grouped, gpa });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/results/process-gpa ────────────────────────────────────────────
router.post('/process-gpa', auth, async (req, res) => {
  try {
    const { studentId, studentRegNo, academicYear } = req.body;
    if (!studentId || !academicYear) {
      return res.status(400).json({ error: 'studentId and academicYear are required' });
    }

    const results = await Result.find({ studentId, academicYear, isRepeat: false });
    if (!results.length) {
      return res.status(404).json({ error: 'No results found for this student and year' });
    }

    let totalPoints  = 0;
    let totalCredits = 0;
    results.forEach(r => {
      totalPoints  += (r.gradePoints ?? 0) * (r.credits ?? 3);
      totalCredits += (r.credits ?? 3);
    });

    const gpa = totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;

    const gpaRecord = await GPA.findOneAndUpdate(
      { studentId, academicYear },
      { $set: { studentId, studentRegNo: studentRegNo || '', academicYear, gpa, totalCredits, totalPoints, status: 'draft' } },
      { upsert: true, new: true }
    );

    res.json({ gpa, totalCredits, totalPoints, resultCount: results.length, gpaRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/results/gpa/:studentId ──────────────────────────────────────────
router.get('/gpa/:studentId', auth, async (req, res) => {
  try {
    const gpaRecords = await GPA.find({ studentId: req.params.studentId }).sort({ academicYear: 1 });
    res.json(gpaRecords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/results/gpa/:gpaId/finalize ───────────────────────────────────
router.patch('/gpa/:gpaId/finalize', auth, async (req, res) => {
  try {
    const update = { status: 'final', finalizedAt: new Date() };
    if (req.body.gpa !== undefined) update.gpa = req.body.gpa;

    const gpaRecord = await GPA.findByIdAndUpdate(
      req.params.gpaId,
      { $set: update },
      { new: true }
    );
    if (!gpaRecord) return res.status(404).json({ error: 'GPA record not found' });

    // Publish result.published event
    await publish('result.published', {
      studentId:    gpaRecord.studentId,
      studentRegNo: gpaRecord.studentRegNo,
      academicYear: gpaRecord.academicYear,
      gpa:          gpaRecord.gpa,
      status:       'final',
    });

    res.json(gpaRecord);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
