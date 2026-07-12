const kafka = require('../config/kafka');
const NotificationLog = require('../models/NotificationLog');

const consumer = kafka.consumer({ groupId: 'notification-group' });

const TOPICS = ['student.created', 'exam.registered', 'result.published'];

function buildMessage(topic, payload) {
  switch (topic) {
    case 'student.created':
      return `New student registered: ${payload.name} (${payload.studentId})`;
    case 'exam.registered':
      return `Student ${payload.studentName} enrolled in exam: ${payload.examTitle}`;
    case 'result.published':
      return `GPA published for student ${payload.studentId} — Year ${payload.academicYear}: ${payload.gpa}`;
    default:
      return JSON.stringify(payload);
  }
}

async function startConsumer() {
  let retries = 0;
  while (retries < 15) {
    try {
      await consumer.connect();
      console.log('Kafka consumer connected');
      break;
    } catch (err) {
      retries++;
      console.warn(`Kafka not ready (attempt ${retries}/15): ${err.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  if (retries === 15) {
    console.error('Could not connect to Kafka after 15 attempts — notifications disabled');
    return;
  }

  // Retry subscribe until topics are auto-created by first producer message
  let subscribed = false;
  while (!subscribed) {
    try {
      await consumer.subscribe({ topics: TOPICS, fromBeginning: false });
      subscribed = true;
    } catch (err) {
      if (err.type === 'UNKNOWN_TOPIC_OR_PARTITION') {
        console.log('Topics not yet created — retrying in 10s…');
        await new Promise(r => setTimeout(r, 10000));
      } else {
        throw err;
      }
    }
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      let payload = {};
      try {
        payload = JSON.parse(message.value.toString());
      } catch (_) {}

      const msg = buildMessage(topic, payload);
      console.log(`[${topic}] ${msg}`);

      try {
        await NotificationLog.create({
          event:       topic,
          topic,
          recipientId: payload.studentId || payload.recipientId || '',
          message:     msg,
          payload,
          status:      'sent',
        });
      } catch (err) {
        console.error('Failed to save notification log:', err.message);
      }
    },
  });
}

module.exports = { startConsumer };
