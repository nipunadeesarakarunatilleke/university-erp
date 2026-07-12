const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    // ── Core ──────────────────────────────────────────────────────────────────
    title:    { type: String, required: true, trim: true },
    courseId: { type: String, required: true },
    date:     { type: Date,   required: true },
    venue:    { type: String, default: '' },

    // ── Registration window (G5) ──────────────────────────────────────────────
    // Default true so existing data and tests keep working unchanged
    registrationOpen:         { type: Boolean, default: true },
    registrationStart:        { type: Date },
    registrationEnd:          { type: Date },
    admissionDownloadEnabled: { type: Boolean, default: false },
    admissionDownloadDate:    { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exam', examSchema);
