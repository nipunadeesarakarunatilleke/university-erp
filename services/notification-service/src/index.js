require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { startConsumer } = require('./consumers');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3006;

connectDB().catch(console.error);

app.use(cors());
app.use(express.json());

app.use('/api/notifications', notificationRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'notification-service', port: PORT })
);

app.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
  startConsumer().catch(console.error);
});
