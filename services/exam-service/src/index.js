require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const examRoutes = require('./routes/exams');
const { connect: connectKafka } = require('./config/kafka');

const app = express();
const PORT = process.env.PORT || 3003;

connectDB();
connectKafka();

app.use(cors());
app.use(express.json());

app.use('/api/exams', examRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'exam-service', port: PORT })
);

app.listen(PORT, () => console.log(`Exam Service running on port ${PORT}`));
