const router = require('express').Router();
const NotificationLog = require('../models/NotificationLog');
const auth = require('../middleware/auth');

// GET /api/notifications — list recent notifications (newest first)
router.get('/', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const topic = req.query.topic;
    const filter = topic ? { topic } : {};
    const logs = await NotificationLog.find(filter).sort({ sentAt: -1 }).limit(limit);
    res.json({ count: logs.length, notifications: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/student/:studentId — notifications for one student
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const logs = await NotificationLog.find({ recipientId: req.params.studentId })
      .sort({ sentAt: -1 }).limit(30);
    res.json({ count: logs.length, notifications: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
