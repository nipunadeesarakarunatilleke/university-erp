const mongoose = require('mongoose');

const notifSchema = new mongoose.Schema({
  event:       { type: String, required: true },
  topic:       { type: String, required: true },
  recipientId: { type: String, default: '' },
  channel:     { type: String, enum: ['system', 'email', 'sms'], default: 'system' },
  message:     { type: String, required: true },
  payload:     { type: mongoose.Schema.Types.Mixed },
  status:      { type: String, enum: ['sent', 'failed'], default: 'sent' },
  sentAt:      { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('NotificationLog', notifSchema);
