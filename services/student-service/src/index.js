require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const studentRoutes = require('./routes/students');
const specializationRoutes = require('./routes/specializations');
const { connect: connectKafka } = require('./config/kafka');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = '/app/uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

connectDB();
connectKafka();

app.use(cors());
app.use(express.json());

// Serve uploaded photos statically
app.use('/uploads', express.static(uploadsDir));

app.use('/api/students', studentRoutes);
app.use('/api/specializations', specializationRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'student-service', port: PORT })
);

app.listen(PORT, () => console.log(`Student Service running on port ${PORT}`));
