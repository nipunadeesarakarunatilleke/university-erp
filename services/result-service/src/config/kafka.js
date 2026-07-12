const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'result-service',
  brokers: [(process.env.KAFKA_BROKER || 'kafka:9092')],
  retry: { retries: 5, initialRetryTime: 2000 },
});

const producer = kafka.producer();
let connected = false;

async function connect() {
  try {
    await producer.connect();
    connected = true;
    console.log('Kafka producer connected (result-service)');
  } catch (err) {
    console.warn('Kafka unavailable (result-service):', err.message);
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
