const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { Pool } = require('pg');
const { createClient } = require('redis');
const bcrypt = require('bcryptjs');
require('dotenv').config();
// Payments are currently disabled; stripe is only initialized when a key is configured.
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Helper function to parse cookies
const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const [name, value] = c.split('=');
      return [name, decodeURIComponent(value || '')];
    })
  );
};

// Helper function to generate user ID
const generateUserId = () => {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  statement_timeout: 5000,
});

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect().catch(console.error);

const MONTHLY_HARD_LIMIT = 1_000_000; // 1M tokens
const DAILY_SOFT_LIMIT = 100_000; // 100k tokens

// Helper functions for token tracking
const getTodayKey = () => {
  const today = new Date();
  return `token_usage:${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const getCurrentMonthKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
};

const trackDailyTokens = async (tokens) => {
  try {
    const key = getTodayKey();
    const count = await redisClient.incrBy(key, tokens);
    // Set expiry to end of day (24 hours)
    await redisClient.expire(key, 86400);
    return count;
  } catch (err) {
    console.error('Error tracking daily tokens:', err);
    return 0;
  }
};

const trackMonthlyTokens = async (tokens) => {
  try {
    const monthKey = getCurrentMonthKey();
    const today = new Date();
    const result = await pool.query(
      `INSERT INTO token_usage (month_year, total_tokens, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (month_year) DO UPDATE SET
       total_tokens = token_usage.total_tokens + $2,
       updated_at = CURRENT_TIMESTAMP`,
      [monthKey, tokens]
    );
    return true;
  } catch (err) {
    console.error('Error tracking monthly tokens:', err);
    return false;
  }
};

const checkDailySoftLimit = async () => {
  try {
    const key = getTodayKey();
    const count = parseInt(await redisClient.get(key) || '0', 10);
    return count >= DAILY_SOFT_LIMIT;
  } catch (err) {
    console.error('Error checking daily soft limit:', err);
    return false;
  }
};

const checkMonthlySoftLimit = async () => {
  try {
    const monthKey = getCurrentMonthKey();
    const result = await pool.query(
      'SELECT total_tokens FROM token_usage WHERE month_year = $1',
      [monthKey]
    );
    if (result.rows.length === 0) return false;
    return result.rows[0].total_tokens >= MONTHLY_HARD_LIMIT;
  } catch (err) {
    console.error('Error checking monthly hard limit:', err);
    return false;
  }
};

const getDailyTokenUsage = async () => {
  try {
    const key = getTodayKey();
    const count = parseInt(await redisClient.get(key) || '0', 10);
    return count;
  } catch (err) {
    console.error('Error getting daily token usage:', err);
    return 0;
  }
};

const getMonthlyTokenUsage = async () => {
  try {
    const monthKey = getCurrentMonthKey();
    const result = await pool.query(
      'SELECT total_tokens FROM token_usage WHERE month_year = $1',
      [monthKey]
    );
    if (result.rows.length === 0) return 0;
    return result.rows[0].total_tokens;
  } catch (err) {
    console.error('Error getting monthly token usage:', err);
    return 0;
  }
};

const accessibleTables = [
  "contacts",
  "payments"
];

const schemaFiles = {
  "01-contacts.sql": '', 
  "02-payments.sql": ''
};

// read schema files
for (const file of Object.keys(schemaFiles)) {
  const content = fs.readFileSync(`${__dirname}/sql/${file}`, 'utf-8');
  schemaFiles[file] = content;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/query', async (req, res) => {
  const { prompt = '' } = req.body;
  
  // Extract or generate user ID from cookies
  const cookies = parseCookies(req.headers.cookie);
  let userId = cookies.userId;
  if (!userId) {
    userId = generateUserId();
    // Set cookie in response (expires in 1 year)
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    res.set('Set-Cookie', `userId=${encodeURIComponent(userId)}; expires=${date.toUTCString()}; path=/; HttpOnly`);
  }

  if (!prompt.trim()) {
    const dailyUsage = await getDailyTokenUsage();
    const monthlyUsage = await getMonthlyTokenUsage();
    return res.json({
      query: '',
      columns: [],
      rows: [],
      tokensUsed: 0,
      tokenUsage: {
        daily: { used: dailyUsage, limit: DAILY_SOFT_LIMIT },
        monthly: { used: monthlyUsage, limit: MONTHLY_HARD_LIMIT },
      },
    });
  }

  // Check daily soft limit
  const dailyLimitExceeded = await checkDailySoftLimit();
  if (dailyLimitExceeded) {
    const dailyUsage = await getDailyTokenUsage();
    const monthlyUsage = await getMonthlyTokenUsage();
    return res.status(429).json({
      success: false,
      message: 'Daily token limit (100k) exceeded. Please try again tomorrow.',
      query: '',
      columns: [],
      rows: [],
      tokenUsage: {
        daily: { used: dailyUsage, limit: DAILY_SOFT_LIMIT },
        monthly: { used: monthlyUsage, limit: MONTHLY_HARD_LIMIT },
      },
    });
  }

  // Check monthly hard limit
  const monthlyLimitExceeded = await checkMonthlySoftLimit();
  if (monthlyLimitExceeded) {
    const dailyUsage = await getDailyTokenUsage();
    const monthlyUsage = await getMonthlyTokenUsage();
    return res.status(429).json({
      success: false,
      message: 'Monthly token limit (1M) exceeded. Service is unavailable.',
      query: '',
      columns: [],
      rows: [],
      tokenUsage: {
        daily: { used: dailyUsage, limit: DAILY_SOFT_LIMIT },
        monthly: { used: monthlyUsage, limit: MONTHLY_HARD_LIMIT },
      },
    });
  }

  const fullSchema = Object.values(schemaFiles).join('\n');

  const response = await fetch('https://inference.do-ai.run/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GPT_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai-gpt-4o-mini',
      user: userId,
      messages: [
        { role: 'system', content: 'You are a SQL expert. Database schema:\n\n' + fullSchema },
        { role: 'user', content: `Respond only in valid SQL without any additional text. Convert the following request into a SQL query: "${prompt}."` },
      ],
      max_completion_tokens: 1000,
    }),
  });

  const data = await response.json();

  // Extract token usage from LLM response
  const tokensUsed = (data.usage?.total_tokens || 0) + (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || 0;
  const totalTokens = data.usage?.total_tokens || (promptTokens + completionTokens);

  // Track tokens for both daily and monthly limits
  if (totalTokens > 0) {
    await trackDailyTokens(totalTokens);
    await trackMonthlyTokens(totalTokens);
  }

  // Get updated token usage
  const dailyUsage = await getDailyTokenUsage();
  const monthlyUsage = await getMonthlyTokenUsage();

  const generatedSql = (data.choices?.[0]?.message?.content || '').trim();
  const safeSql = generatedSql.match(/\n(.*)\n/)?.[1] || generatedSql;
  const normalizedSql = safeSql.toLowerCase();

  // App-level defense-in-depth only; this is not a substitute for a DB-level
  // read-only role restricted to accessibleTables, which would be the real
  // security boundary here.
  const blacklist = /(insert|update|delete|drop|alter|truncate|create|merge|exec|replace|grant|revoke|set\s+session|call|attach|detach)/;
  const statementChainOrComment = /;|--|\/\*/;
  const forbiddenTableRegex = /\busers\b/i;
  const tableRegex = new RegExp(`\\b(${accessibleTables.join('|')})\\b`, 'i');

  if (
    !normalizedSql.startsWith('select') ||
    blacklist.test(normalizedSql) ||
    statementChainOrComment.test(normalizedSql) ||
    forbiddenTableRegex.test(normalizedSql) ||
    !tableRegex.test(normalizedSql)
  ) {
    return res.status(400).json({
      query: generatedSql,
      columns: [],
      rows: [],
      tokensUsed: totalTokens,
      tokenUsage: {
        daily: { used: dailyUsage, limit: DAILY_SOFT_LIMIT },
        monthly: { used: monthlyUsage, limit: MONTHLY_HARD_LIMIT },
      },
    });
  }

  try {
    const result = await pool.query(safeSql);
    return res.json({
      query: generatedSql,
      normalizedSql: normalizedSql,
      columns: result.fields.map((field) => field.name),
      rows: result.rows,
      tokensUsed: totalTokens,
      tokenUsage: {
        daily: { used: dailyUsage, limit: DAILY_SOFT_LIMIT },
        monthly: { used: monthlyUsage, limit: MONTHLY_HARD_LIMIT },
      },
    });
  } catch (err) {
    console.error('SQL execution error', err);
    return res.status(400).json({
      query: generatedSql,
      columns: [],
      rows: [],
      tokensUsed: totalTokens,
      tokenUsage: {
        daily: { used: dailyUsage, limit: DAILY_SOFT_LIMIT },
        monthly: { used: monthlyUsage, limit: MONTHLY_HARD_LIMIT },
      },
    });
  }
});

app.post('/api/auth', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const passwordMatches = typeof user.password === 'string' && user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    return res.json({ success: true, message: `Authenticated ${username}.` });
  } catch (err) {
    console.error('Auth error', err);
    return res.status(500).json({ success: false, message: 'Unable to authenticate right now.' });
  }
});

app.get('/api/plans', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ success: false, message: 'Payments are currently disabled.' });
  }

  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
      limit: 100,
    });

    const planData = prices.data.map((price) => {
      const interval = price.recurring?.interval || 'one_time';
      const displayAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: price.currency || 'usd',
      }).format((price.unit_amount || 0) / 100);

      return {
        id: price.id,
        nickname: price.nickname || price.product?.name || `Plan ${price.id}`,
        productName: price.product?.name || null,
        interval,
        intervalLabel: interval === 'year' ? 'annually' : 'monthly',
        amount: price.unit_amount || 0,
        currency: price.currency || 'usd',
        displayAmount,
      };
    });

    const categorized = {
      monthly: planData.filter((plan) => plan.interval === 'month'),
      annually: planData.filter((plan) => plan.interval === 'year'),
    };

    if (!categorized.monthly.length && !categorized.annually.length) {
      return res.json({
        plans: {
          monthly: [
            { id: 'plan_monthly_basic', nickname: 'Basic Monthly', interval: 'month', intervalLabel: 'monthly', amount: 9900, currency: 'usd', displayAmount: '$99.00' },
            { id: 'plan_monthly_pro', nickname: 'Pro Monthly', interval: 'month', intervalLabel: 'monthly', amount: 4900, currency: 'usd', displayAmount: '$49.00' },
          ],
          annually: [
            { id: 'plan_annual_pro', nickname: 'Pro Annual', interval: 'year', intervalLabel: 'annually', amount: 49900, currency: 'usd', displayAmount: '$499.00' },
          ],
        },
      });
    }

    return res.json({ plans: categorized });
  } catch (err) {
    console.error('Plans error', err);
    return res.status(500).json({ success: false, message: 'Unable to fetch plans.' });
  }
});

app.post('/api/subscribe', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ success: false, message: 'Payments are currently disabled.' });
  }

  const { token, planPriceId, email } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Stripe token is required.' });
  }

  if (!planPriceId) {
    return res.status(400).json({ success: false, message: 'A plan price is required.' });
  }

  if (!email) {
    return res.status(400).json({ success: false, message: 'Customer email is required.' });
  }

  try {
    const customer = await stripe.customers.create({
      email,
      source: token,
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: planPriceId }],
      expand: ['items.data.price.product'],
    });

    const planItem = subscription.items.data[0];
    const planName = planItem.price.nickname || planItem.price.product?.name || planItem.price.id;

    return res.json({
      success: true,
      message: `Subscription created for ${email} on ${planName}.`,
      subscriptionId: subscription.id,
      plan: planName,
      status: subscription.status,
    });
  } catch (err) {
    console.error('Subscription error', err);
    return res.status(500).json({ success: false, message: 'Unable to create subscription.' });
  }
});

app.listen(3001, '0.0.0.0', () => console.log('Backend running on port 3001'));
