const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'exam-service',
  brokers: [(process.env.KAFKA_BROKER || 'kafka:9092')],
  retry: { retries: 5, initialRetryTime: 2000 },
});

const producer = kafka.producer();
let connected = false;

async function connect() {
  try {
    await producer.connect();
    connected = true;
    console.log('Kafka producer connected (exam-service)');
  } catch (err) {
    console.warn('Kafka unavailable (exam-service):', err.message);
  }
}

async function publish(topic, value) {
  if (!connected) return;
  try {
    await producer.send({ topic, messages: [{ value: JSON.stringify(value) }] });
  } catch (err) {
    console.warn('Kafka publish error:', err.message);
  }
}

module.exports = { connect, publish };
