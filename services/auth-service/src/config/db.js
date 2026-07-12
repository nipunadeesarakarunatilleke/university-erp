const mongoose = require('mongoose');

module.exports = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db';
  await mongoose.connect(uri);
  console.log('Auth Service connected to MongoDB');
};
