const mongoose = require('mongoose');

module.exports = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/transcripts_db';
  await mongoose.connect(uri);
  console.log('Transcript Service connected to MongoDB');
};
