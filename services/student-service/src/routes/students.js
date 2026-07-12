const router           = require('express').Router();
const path             = require('path');
const multer           = require('multer');
const Student          = require('../models/Student');
const YearRegistration = require('../models/YearRegistration');
const auth             = require('../middleware/auth');
const { publish }      = require('../config/kafka');

// ── Photo upload storage ──────────────────────────────────────────────────────
const photoStorage = multer.diskStorage({
  destination: '/app/uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'photo-' + req.params.id + ext);
  },
});
const upload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// CSV parsing helper — handles basic comma-separated values (no embedded commas)
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

// ── POST /api/students — create a student ────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const student = await Student.create(req.body);
    await publish('student.created', {
      studentId: student.studentId,
      name:      student.name,
      email:     student.email,
      _id:       student._id,
    });
    res.status(201).json(student);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email or studentId already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/students/bulk — bulk import from CSV body (G3) ─────────────────
router.post('/bulk', auth, async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'csv field is required in request body' });

    const rows = parseCSV(csv);
    const created = [];
    const errors  = [];

    for (const row of rows) {
      try {
        const student = await Student.create({
          name:      row.name,
          email:     row.email,
          studentId: row.studentId,
          programme: row.programme || '',
          batch:     row.batch     || '',
        });
        await publish('student.created', {
          studentId: student.studentId,
          name:      student.name,
          email:     student.email,
          _id:       student._id,
        });
        created.push(student.studentId);
      } catch (err) {
        errors.push({ row: row.studentId || row.email, error: err.message });
      }
    }

    res.status(207).json({
      created: created.length,
      errors:  errors.length,
      createdIds: created,
      errorDetails: errors,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/students — list all students ────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/students/:id — get student by MongoDB _id ───────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PATCH /api/students/:id — partial profile update (G2) ────────────────────
router.patch('/:id', auth, async (req, res) => {
  try {
    const forbidden = ['studentId', 'email', 'nic', 'permanentDistrict'];
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'EXAM_DIVISION') {
      forbidden.forEach(f => delete req.body[f]);
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/students/:id/photo — upload profile photo (G10) ────────────────
router.post('/:id/photo', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const photoUrl = '/uploads/' + req.file.filename;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: { photoUrl } },
      { new: true }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ photoUrl, student });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Year Registration (G4) ────────────────────────────────────────────────────

// POST /api/students/:id/year-registration
router.post('/:id/year-registration', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { academicYear, studyYear, paidAmount, hostel } = req.body;
    if (!academicYear || !studyYear) {
      return res.status(400).json({ error: 'academicYear and studyYear are required' });
    }

    const reg = await YearRegistration.create({
      studentId: student._id,
      academicYear,
      studyYear,
      paidAmount: paidAmount || 0,
      hostel: hostel || false,
    });

    await Student.findByIdAndUpdate(req.params.id, { $set: { academicYear, studyYear } });

    res.status(201).json(reg);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Student is already registered for this academic year' });
    }
    res.status(400).json({ error: err.message });
  }
});

// GET /api/students/:id/year-registrations
router.get('/:id/year-registrations', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const regs = await YearRegistration.find({ studentId: req.params.id }).sort({ academicYear: 1 });
    res.json({ student, yearRegistrations: regs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk Year Registration (G3) ───────────────────────────────────────────────
router.post('/bulk-year-registration', auth, async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'csv field is required' });

    const rows = parseCSV(csv);
    const created = [];
    const errors  = [];

    for (const row of rows) {
      try {
        const student = await Student.findOne({ studentId: row.studentId });
        if (!student) throw new Error(`Student ${row.studentId} not found`);

        await YearRegistration.create({
          studentId:    student._id,
          academicYear: parseInt(row.academicYear),
          studyYear:    parseInt(row.studyYear),
          paidAmount:   parseFloat(row.paidAmount) || 0,
          hostel:       row.hostel === 'true' || row.hostel === '1',
        });
        await Student.findByIdAndUpdate(student._id, {
          $set: { academicYear: parseInt(row.academicYear), studyYear: parseInt(row.studyYear) },
        });
        created.push(row.studentId);
      } catch (err) {
        errors.push({ row: row.studentId, error: err.message });
      }
    }

    res.status(207).json({ created: created.length, errors: errors.length, createdIds: created, errorDetails: errors });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
