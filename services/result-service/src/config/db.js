const mongoose = require('mongoose');

module.exports = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/results_db';
  await mongoose.connect(uri);
  console.log('Result Service connected to MongoDB');
};
