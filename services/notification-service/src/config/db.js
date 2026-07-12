const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/notif_db';
  await mongoose.connect(uri);
  console.log('Notification Service connected to MongoDB');
};
