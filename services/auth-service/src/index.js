require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3007;

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'auth-service', port: PORT })
);

app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));
