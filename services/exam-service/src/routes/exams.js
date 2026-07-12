const router = require('express').Router();
const axios = require('axios');
const Exam = require('../models/Exam');
const Entry = require('../models/Entry');
const auth = require('../middleware/auth');
const { publish } = require('../config/kafka');

const STUDENT_SERVICE_URL = process.env.STUDENT_SERVICE_URL || 'http://student-service:3001';

// POST /api/exams — create an exam
router.post('/', auth, async (req, res) => {
  try {
    const exam = await Exam.create(req.body);
    res.status(201).json(exam);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/exams — list all exams
router.get('/', auth, async (req, res) => {
  try {
    const exams = await Exam.find().sort({ date: 1 });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/exams/:id/schedule — set registration window dates (G5)
router.patch('/:id/schedule', auth, async (req, res) => {
  try {
    const { registrationStart, registrationEnd, admissionDownloadDate, admissionDownloadEnabled } = req.body;
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      { $set: { registrationStart, registrationEnd, admissionDownloadDate, admissionDownloadEnabled } },
      { new: true, runValidators: true }
    );
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    res.json(exam);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/exams/:id/toggle — open or close exam registration (G5)
router.patch('/:id/toggle', auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    exam.registrationOpen = !exam.registrationOpen;
    await exam.save();
    res.json({ registrationOpen: exam.registrationOpen, exam });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/exams/:id/entries — enroll a student in an exam
// Cross-service call: verifies student exists in Student Service
router.post('/:id/entries', auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // Enforce registration window (G5)
    if (!exam.registrationOpen) {
      return res.status(403).json({ error: 'Exam registration is currently closed' });
    }
    const now = new Date();
    if (exam.registrationStart && now < new Date(exam.registrationStart)) {
      return res.status(403).json({ error: 'Exam registration has not started yet' });
    }
    if (exam.registrationEnd && now > new Date(exam.registrationEnd)) {
      return res.status(403).json({ error: 'Exam registration deadline has passed' });
    }

    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    // Verify student exists via Student Service (cross-service REST call)
    let student;
    try {
      const response = await axios.get(
        `${STUDENT_SERVICE_URL}/api/students/${studentId}`,
        { headers: { Authorization: req.headers.authorization } }
      );
      student = response.data;
    } catch (err) {
      if (err.response?.status === 404) {
        return res.status(404).json({ error: `Student ${studentId} not found in Student Service` });
      }
      return res.status(502).json({ error: 'Student Service unavailable', detail: err.message });
    }

    const entry = await Entry.create({
      examId:      exam._id,
      studentId,
      studentName: student.name,
    });

    await publish('exam.registered', {
      studentId,
      studentName: student.name,
      examTitle:   exam.title,
      examId:      exam._id,
      entryId:     entry._id,
    });

    res.status(201).json(entry);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Student is already enrolled in this exam' });
    }
    res.status(400).json({ error: err.message });
  }
});

// GET /api/exams/:id/entries — list entries, optional ?status=approved|pending|rejected
router.get('/:id/entries', auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const filter = { examId: req.params.id };
    if (req.query.status) filter.status = req.query.status;

    const entries = await Entry.find(filter).sort({ enrolledAt: 1 });
    res.json({ exam, entries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/exams/:id/entries/:entryId — approve or reject an entry (G6)
router.patch('/:id/entries/:entryId', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, approved or rejected' });
    }
    const entry = await Entry.findOneAndUpdate(
      { _id: req.params.entryId, examId: req.params.id },
      { $set: { status, reviewedBy: req.user?.username || req.user?.userId || '', reviewedAt: new Date() } },
      { new: true }
    );
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/exams/:id/admission-card — approved entries only (G6)
router.get('/:id/admission-card', auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const entries = await Entry.find({ examId: req.params.id, status: 'approved' })
      .sort({ studentName: 1 });

    res.json({
      admissionCard: {
        exam: {
          title:    exam.title,
          courseId: exam.courseId,
          date:     exam.date,
          venue:    exam.venue,
        },
        generatedAt:    new Date(),
        approvedCount:  entries.length,
        candidates: entries.map((e, i) => ({
          seatNo:      i + 1,
          studentId:   e.studentId,
          studentName: e.studentName,
          isRepeat:    e.isRepeat,
          enrolledAt:  e.enrolledAt,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
