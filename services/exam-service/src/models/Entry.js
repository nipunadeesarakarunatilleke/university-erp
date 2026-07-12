const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    examId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    studentId:   { type: String, required: true },
    studentName: { type: String, default: '' },
    enrolledAt:  { type: Date,   default: Date.now },

    // ── Approval workflow (G6) ────────────────────────────────────────────────
    status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    isRepeat:   { type: Boolean, default: false },
    reviewedBy: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

entrySchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Entry', entrySchema);
