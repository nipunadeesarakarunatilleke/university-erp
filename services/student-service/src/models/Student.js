const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    // ── Core (required) ───────────────────────────────────────────────────────
    name:      { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true },
    studentId: { type: String, required: true, unique: true },
    programme: { type: String, default: '' },

    // ── Personal ──────────────────────────────────────────────────────────────
    nic:         { type: String, default: '' },
    gender:      { type: String, enum: ['MALE', 'FEMALE', 'OTHER', ''], default: '' },
    dateOfBirth: { type: Date },
    writingHand: { type: String, enum: ['RIGHT', 'LEFT', ''], default: '' },
    race:        { type: String, default: '' },
    religion:    { type: String, default: '' },
    citizenship: { type: String, default: '' },
    nameSinhala: { type: String, default: '' },

    // ── Contact ───────────────────────────────────────────────────────────────
    mobile:   { type: String, default: '' },
    landline: { type: String, default: '' },

    // ── Permanent address ─────────────────────────────────────────────────────
    permanentAddr1:      { type: String, default: '' },
    permanentAddr2:      { type: String, default: '' },
    permanentAddr3:      { type: String, default: '' },
    permanentDistrict:   { type: String, default: '' },
    permanentGnDivision: { type: String, default: '' },
    permanentElectorate: { type: String, default: '' },
    permanentMoh:        { type: String, default: '' },

    // ── Contact address ───────────────────────────────────────────────────────
    sameAsPermanent: { type: Boolean, default: false },
    contactAddr1:    { type: String, default: '' },
    contactAddr2:    { type: String, default: '' },
    contactAddr3:    { type: String, default: '' },
    contactDistrict: { type: String, default: '' },

    // ── Guardian ──────────────────────────────────────────────────────────────
    guardianType:       { type: String, enum: ['FATHER', 'MOTHER', 'GUARDIAN', ''], default: '' },
    guardianName:       { type: String, default: '' },
    guardianOccupation: { type: String, default: '' },
    guardianWorkplace:  { type: String, default: '' },
    guardianContact:    { type: String, default: '' },

    // ── Emergency contact ─────────────────────────────────────────────────────
    emergencyName:    { type: String, default: '' },
    emergencyContact: { type: String, default: '' },

    // ── Academic ──────────────────────────────────────────────────────────────
    batch:           { type: String, default: '' },
    academicYear:    { type: Number, default: null },
    studyYear:       { type: Number, default: null },
    scholarshipInfo: { type: String, default: '' },
    remarks:         { type: String, default: '' },
    photoUrl:        { type: String, default: '' },
    signatureUrl:    { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
