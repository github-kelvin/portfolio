const amqp = require('amqplib');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function startWorker() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue('payment_queue');

  console.log('Worker waiting for messages...');

  channel.consume('payment_queue', async (msg) => {
    if (msg === null) return;

    try {
      const { userId, plan, amount } = JSON.parse(msg.content.toString());
      console.log(`Processing payment for user ${userId}, plan ${plan}, amount ${amount}`);

      // Simulate payment processing (already done by Stripe)
      const status = 'completed';

      // Insert into payments
      await pool.query('INSERT INTO payments (user_id, plan, amount, status) VALUES ($1, $2, $3, $4)', [userId, plan, amount, status]);

      channel.ack(msg);
      console.log('Payment processed');
    } catch (err) {
      console.error('Error processing payment message:', err);
      channel.nack(msg, false, false);
    }
  });
}

startWorker();