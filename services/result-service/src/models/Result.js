const mongoose = require('mongoose');

const GRADE_POINTS = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0,  'F': 0.0,
};

const resultSchema = new mongoose.Schema(
  {
    studentId:    { type: String, required: true },
    studentRegNo: { type: String, required: true },
    subjectCode:  { type: String, required: true },
    subjectName:  { type: String, default: '' },
    marks:        { type: Number, required: true, min: 0, max: 100 },
    grade:        { type: String, required: true },
    gradePoints:  { type: Number },
    credits:      { type: Number, default: 3 },
    academicYear: { type: Number, required: true },
    semester:     { type: Number, required: true },
    isRepeat:     { type: Boolean, default: false },
    uploadedBy:   { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-compute gradePoints from grade before saving
resultSchema.pre('save', function (next) {
  if (this.grade && GRADE_POINTS[this.grade] !== undefined) {
    this.gradePoints = GRADE_POINTS[this.grade];
  }
  next();
});

// For repeated subjects in the same year, keep latest (unique per student+subject+year)
resultSchema.index(
  { studentId: 1, subjectCode: 1, academicYear: 1, isRepeat: 1 },
  { unique: true }
);

module.exports = mongoose.model('Result', resultSchema);
module.exports.GRADE_POINTS = GRADE_POINTS;
