const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const amqp = require('amqplib');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let channel;

async function connectRabbitMQ(retries = 0) {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue('payment_queue');
    console.log('RabbitMQ connected');
  } catch (error) {
    console.error('RabbitMQ connection failed:', error.message);
    if (retries < 10) {
      const delay = 5000;
      console.log(`Retrying RabbitMQ connection in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      await connectRabbitMQ(retries + 1);
    } else {
      console.error('RabbitMQ unreachable after retries. Continuing without queue.');
    }
  }
}

connectRabbitMQ();

const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const apiRouter = express.Router();

// Auth routes
apiRouter.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', [email, hashedPassword]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(400).json({ error: 'User already exists' });
  }
});

apiRouter.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });

  const validPassword = await bcrypt.compare(password, result.rows[0].password);
  if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET);
  res.json({ token });
});

// Contacts CRUD
apiRouter.get('/contacts', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT * FROM contacts WHERE user_id = $1', [req.user.id]);
  res.json(result.rows);
});

apiRouter.post('/contacts', authenticateToken, async (req, res) => {
  const { name, email, phone } = req.body;
  const result = await pool.query('INSERT INTO contacts (user_id, name, email, phone) VALUES ($1, $2, $3, $4) RETURNING *', [req.user.id, name, email, phone]);
  res.status(201).json(result.rows[0]);
});

apiRouter.put('/contacts/:id', authenticateToken, async (req, res) => {
  const { name, email, phone } = req.body;
  const result = await pool.query('UPDATE contacts SET name = $1, email = $2, phone = $3 WHERE id = $4 AND user_id = $5 RETURNING *', [name, email, phone, req.params.id, req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
  res.json(result.rows[0]);
});

apiRouter.delete('/contacts/:id', authenticateToken, async (req, res) => {
  const result = await pool.query('DELETE FROM contacts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Contact not found' });
  res.status(204).send();
});

// Subscriptions
apiRouter.post('/create-checkout-session', authenticateToken, async (req, res) => {
  const { plan } = req.body;
  const price = plan === 'basic' ? 1000 : 2000; // in cents

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${plan} Plan`,
        },
        unit_amount: price,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'http://localhost/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'http://localhost/subscriptions',
    metadata: {
      userId: req.user.id,
      plan,
    },
  });

  res.json({ url: session.url });
});

// Verify payment
apiRouter.post('/verify-payment', authenticateToken, async (req, res) => {
  const { sessionId } = req.body;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status === 'paid') {
    if (!channel) {
      return res.status(503).json({ error: 'Payment queue is not available yet' });
    }

    const { userId, plan } = session.metadata;
    const amount = plan === 'basic' ? 10.0 : 20.0;
    // Send to queue
    channel.sendToQueue('payment_queue', Buffer.from(JSON.stringify({ userId, plan, amount })));
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Payment not completed' });
  }
});

// Payment history
apiRouter.get('/payments', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT * FROM payments WHERE user_id = $1', [req.user.id]);
  res.json(result.rows);
});

// Professional details (static for landing page)
apiRouter.get('/professional', (req, res) => {
  res.json({
    name: 'Kelvin Joaquin',
    title: 'Backend Developer',
    bio: 'Passionate backend developer specializing in scalable systems and modern technologies.',
    skills: ['Node.js', 'Python', 'PostgreSQL', 'Docker', 'RabbitMQ', 'Express', 'FastAPI'],
    workExperience: [
      { title: 'Senior Backend Developer', company: 'Tech Corp', duration: '2020 - Present', description: 'Led development of microservices architecture.' },
      { title: 'Backend Engineer', company: 'Startup Inc', duration: '2018 - 2020', description: 'Built RESTful APIs and database solutions.' }
    ],
    contact: {
      email: 'kelvin.joaquin@example.com',
      phone: '+1 (123) 456-7890',
      linkedin: 'linkedin.com/in/kelvinjoaquin'
    }
  });
});

app.use('/api', apiRouter);

app.listen(3001, '0.0.0.0', () => console.log('Backend running on port 3001'));