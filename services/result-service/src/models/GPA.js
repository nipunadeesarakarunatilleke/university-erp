const mongoose = require('mongoose');

const gpaSchema = new mongoose.Schema(
  {
    studentId:    { type: String, required: true },
    studentRegNo: { type: String, required: true },
    academicYear: { type: Number, required: true },
    gpa:          { type: Number, required: true },
    totalCredits: { type: Number, required: true },
    totalPoints:  { type: Number, required: true },
    status:       { type: String, enum: ['draft', 'final'], default: 'draft' },
    finalizedAt:  { type: Date },
  },
  { timestamps: true }
);

gpaSchema.index({ studentId: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('GPA', gpaSchema);
