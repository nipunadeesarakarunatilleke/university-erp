const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');

const SALT_ROUNDS = 10;

function sign(user) {
  return jwt.sign(
    { userId: user._id, username: user.username, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register — create a user account
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, name, email, studentId } = req.body;
    if (!username || !password || !role || !name) {
      return res.status(400).json({ error: 'username, password, role and name are required' });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ username, passwordHash, role, name, email, studentId });
    res.status(201).json({ id: user._id, username: user.username, role: user.role, name: user.name });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Username already exists' });
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login — validate credentials, return JWT
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    const user = await User.findOne({ username, active: true });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: sign(user), role: user.role, name: user.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/seed — create demo users if the collection is empty
router.post('/seed', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) {
      return res.status(409).json({ message: 'Users already seeded', count });
    }
    const demos = [
      { username: 'admin',    password: 'admin123',   role: 'ADMIN',         name: 'Administrator' },
      { username: 'examdiv',  password: 'exam123',    role: 'EXAM_DIVISION', name: 'Exam Division Staff' },
      { username: 'hod',      password: 'hod123',     role: 'HOD',           name: 'Head of Department' },
      { username: 'lecturer', password: 'lecturer123', role: 'LECTURER',     name: 'Lecturer' },
      { username: 'student1', password: 'student123', role: 'STUDENT',       name: 'Demo Student', studentId: 'SC2024001' },
    ];
    const created = [];
    for (const d of demos) {
      const passwordHash = await bcrypt.hash(d.password, SALT_ROUNDS);
      const u = await User.create({ ...d, passwordHash });
      created.push({ username: u.username, role: u.role });
    }
    res.status(201).json({ message: 'Demo users created', users: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/reset-password — admin resets a user's password
router.patch('/reset-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ error: 'username and newPassword are required' });
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const user = await User.findOneAndUpdate({ username }, { passwordHash }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `Password reset for ${username}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
