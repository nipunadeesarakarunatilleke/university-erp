const mongoose = require('mongoose');

const yearRegSchema = new mongoose.Schema(
  {
    studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    academicYear: { type: Number, required: true, min: 1, max: 4 },
    studyYear:    { type: Number, required: true },
    paidAmount:   { type: Number, default: 0 },
    hostel:       { type: Boolean, default: false },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// A student can only be registered once per academic year
yearRegSchema.index({ studentId: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('YearRegistration', yearRegSchema);
