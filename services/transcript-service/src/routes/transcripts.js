const router = require('express').Router();
const axios  = require('axios');
const auth   = require('../middleware/auth');

const STUDENT_SVC = process.env.STUDENT_SERVICE_URL || 'http://student-service:3001';
const RESULT_SVC  = process.env.RESULT_SERVICE_URL  || 'http://result-service:3004';

function authHeader(req) {
  return { headers: { Authorization: req.headers.authorization } };
}

async function fetchStudent(studentId, req) {
  const r = await axios.get(`${STUDENT_SVC}/api/students/${studentId}`, authHeader(req));
  return r.data;
}

async function fetchResults(studentId, query, req) {
  const params = new URLSearchParams({ studentId, ...query }).toString();
  const r = await axios.get(`${RESULT_SVC}/api/results?${params}`, authHeader(req));
  return r.data;
}

async function fetchGPA(studentId, req) {
  const r = await axios.get(`${RESULT_SVC}/api/results/gpa/${studentId}`, authHeader(req));
  return r.data;
}

// ── GET /api/transcripts/:studentId/semester/:sem — semester transcript ───────
// ?academicYear=X
router.get('/:studentId/semester/:sem', auth, async (req, res) => {
  try {
    const { studentId, sem } = req.params;
    const academicYear = req.query.academicYear;

    const [student, results] = await Promise.all([
      fetchStudent(studentId, req),
      fetchResults(studentId, { semester: sem, ...(academicYear && { academicYear }) }, req),
    ]);

    const totalCredits = results.reduce((s, r) => s + (r.credits || 3), 0);
    const totalPoints  = results.reduce((s, r) => s + ((r.gradePoints || 0) * (r.credits || 3)), 0);
    const semGpa = totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : null;

    res.json({
      type: 'SEMESTER_TRANSCRIPT',
      generatedAt: new Date(),
      student: {
        name: student.name,
        studentId: student.studentId,
        programme: student.programme,
        batch: student.batch,
      },
      semester: Number(sem),
      academicYear: academicYear ? Number(academicYear) : null,
      results: results.map(r => ({
        subjectCode:  r.subjectCode,
        subjectName:  r.subjectName,
        marks:        r.marks,
        grade:        r.grade,
        gradePoints:  r.gradePoints,
        credits:      r.credits,
      })),
      summary: { totalCredits, totalPoints, semesterGPA: semGpa },
    });
  } catch (err) {
    if (err.response?.status === 404) return res.status(404).json({ error: 'Student not found' });
    if (err.code === 'ECONNREFUSED') return res.status(502).json({ error: 'Upstream service unavailable' });
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/transcripts/:studentId/final — full academic transcript ───────────
router.get('/:studentId/final', auth, async (req, res) => {
  try {
    const { studentId } = req.params;

    const [student, allResults, gpaRecords] = await Promise.all([
      fetchStudent(studentId, req),
      fetchResults(studentId, {}, req),
      fetchGPA(studentId, req),
    ]);

    // Group results by year and semester
    const byYear = {};
    allResults.forEach(r => {
      const yr  = r.academicYear;
      const sem = r.semester;
      if (!byYear[yr]) byYear[yr] = {};
      if (!byYear[yr][sem]) byYear[yr][sem] = [];
      byYear[yr][sem].push({
        subjectCode: r.subjectCode,
        subjectName: r.subjectName,
        marks: r.marks,
        grade: r.grade,
        gradePoints: r.gradePoints,
        credits: r.credits,
      });
    });

    const gpaMap = {};
    gpaRecords.forEach(g => { gpaMap[g.academicYear] = g; });

    res.json({
      type: 'FINAL_TRANSCRIPT',
      generatedAt: new Date(),
      student: {
        name: student.name,
        studentId: student.studentId,
        programme: student.programme,
        batch: student.batch,
        nic: student.nic,
      },
      academicRecord: Object.keys(byYear).sort().map(yr => ({
        academicYear: Number(yr),
        gpa: gpaMap[yr]?.gpa ?? null,
        gpaStatus: gpaMap[yr]?.status ?? null,
        semesters: Object.keys(byYear[yr]).sort().map(sem => ({
          semester: Number(sem),
          results: byYear[yr][sem],
        })),
      })),
    });
  } catch (err) {
    if (err.response?.status === 404) return res.status(404).json({ error: 'Student not found' });
    if (err.code === 'ECONNREFUSED') return res.status(502).json({ error: 'Upstream service unavailable' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
