const mongoose = require('mongoose');

const preferenceSchema = new mongoose.Schema({
  rank:           { type: Number, required: true },
  specialization: { type: String, required: true },
}, { _id: false });

const appSchema = new mongoose.Schema({
  studentId:              { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  preferences:            { type: [preferenceSchema], default: [] },
  status:                 { type: String, enum: ['pending', 'assigned', 'rejected'], default: 'pending' },
  assignedSpecialization: { type: String, default: '' },
  reviewedBy:             { type: String, default: '' },
  reviewedAt:             { type: Date },
  appliedAt:              { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('SpecializationApplication', appSchema);
