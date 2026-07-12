const router = require('express').Router();
const SpecializationApplication = require('../models/SpecializationApplication');
const Student = require('../models/Student');
const auth = require('../middleware/auth');

const SPECIALIZATIONS = [
  'Agricultural Economics',
  'Agricultural Extension',
  'Agronomy',
  'Animal Science',
  'Food Science & Technology',
  'Horticulture',
  'Plant Pathology',
  'Soil Science',
];

// GET /api/specializations — list available specializations
router.get('/', (req, res) => res.json({ specializations: SPECIALIZATIONS }));

// POST /api/specializations/:studentId — student submits preferences
router.post('/:studentId', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { preferences } = req.body;
    if (!Array.isArray(preferences) || !preferences.length) {
      return res.status(400).json({ error: 'preferences array is required' });
    }

    const app = await SpecializationApplication.findOneAndUpdate(
      { studentId: req.params.studentId },
      { $set: { preferences, status: 'pending', appliedAt: new Date() } },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/specializations/:studentId — get student's application
router.get('/:studentId', auth, async (req, res) => {
  try {
    const app = await SpecializationApplication.findOne({ studentId: req.params.studentId });
    if (!app) return res.status(404).json({ error: 'No application found' });
    res.json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/specializations/all/pending — admin: list all pending applications
router.get('/all/pending', auth, async (req, res) => {
  try {
    const apps = await SpecializationApplication.find({ status: 'pending' })
      .populate('studentId', 'name studentId programme')
      .sort({ appliedAt: 1 });
    res.json({ count: apps.length, applications: apps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/specializations/:studentId/assign — admin assigns specialization
router.patch('/:studentId/assign', auth, async (req, res) => {
  try {
    const { assignedSpecialization } = req.body;
    if (!assignedSpecialization) {
      return res.status(400).json({ error: 'assignedSpecialization is required' });
    }
    const app = await SpecializationApplication.findOneAndUpdate(
      { studentId: req.params.studentId },
      {
        $set: {
          assignedSpecialization,
          status: 'assigned',
          reviewedBy: req.user?.username || '',
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!app) return res.status(404).json({ error: 'No application found' });

    // Sync to student record
    await Student.findByIdAndUpdate(req.params.studentId, {
      $set: { scholarshipInfo: assignedSpecialization },
    });

    res.json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
