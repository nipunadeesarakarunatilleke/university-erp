const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username:     { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['STUDENT', 'EXAM_DIVISION', 'HOD', 'LECTURER', 'ADMIN'],
      required: true,
    },
    name:      { type: String, required: true },
    email:     { type: String, default: '' },
    studentId: { type: String, default: '' },
    active:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
