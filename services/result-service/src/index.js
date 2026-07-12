require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const connectDB    = require('./config/db');
const resultRoutes = require('./routes/results');
const { connect: connectKafka } = require('./config/kafka');

const app  = express();
const PORT = process.env.PORT || 3004;

connectDB();
connectKafka();

app.use(cors());
app.use(express.json());

app.use('/api/results', resultRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'result-service', port: PORT })
);

app.listen(PORT, () => console.log(`Result Service running on port ${PORT}`));
