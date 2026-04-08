const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', false);
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ MongoDB connected:', mongoose.connection.host);
}

module.exports = { connectDB };
