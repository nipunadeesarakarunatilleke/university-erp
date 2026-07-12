require('dotenv').config();
const express           = require('express');
const cors              = require('cors');
const connectDB         = require('./config/db');
const transcriptRoutes  = require('./routes/transcripts');

const app  = express();
const PORT = process.env.PORT || 3005;

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/transcripts', transcriptRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'transcript-service', port: PORT })
);

app.listen(PORT, () => console.log(`Transcript Service running on port ${PORT}`));
