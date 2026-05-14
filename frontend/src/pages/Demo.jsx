import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_12345');

function DemoRetrieveCard() {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState(null);

  const runQuery = async (e) => {
    e.preventDefault();
    setResults(null);
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      credentials: 'include',
    });

    if (!response.ok) {
      setResults({ columns: [], rows: [] });
      return;
    }

    const data = await response.json();
    setResults(data);
  };

  return (
    <div className="demo-card">
      <p>Ask for a record or dataset in natural language and view results below.</p>
      <form onSubmit={runQuery} className="demo-form">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Show me recent subscription payments"
        />
        <button type="submit" className="btn btn-primary">Run Query</button>
      </form>
      {results && (
        <div className="demo-results">
          {results.query && (
            <div className="demo-query">
              <strong>Generated SQL:</strong>
              <pre>{results.query}</pre>
            </div>
          )}
          {results.tokenUsage && (
            <div className="demo-token-usage">
              <div className="token-stat">
                <span className="token-label">Daily Usage</span>
                <span className="token-progress">{results.tokenUsage.daily.used.toLocaleString()} / {results.tokenUsage.daily.limit.toLocaleString()}</span>
                <div className="token-bar">
                  <div className="token-fill" style={{ width: `${Math.min((results.tokenUsage.daily.used / results.tokenUsage.daily.limit) * 100, 100)}%` }}></div>
                </div>
              </div>
              <div className="token-stat">
                <span className="token-label">Monthly Usage</span>
                <span className="token-progress">{results.tokenUsage.monthly.used.toLocaleString()} / {results.tokenUsage.monthly.limit.toLocaleString()}</span>
                <div className="token-bar">
                  <div className="token-fill" style={{ width: `${Math.min((results.tokenUsage.monthly.used / results.tokenUsage.monthly.limit) * 100, 100)}%` }}></div>
                </div>
              </div>
            </div>
          )}
          {results.rows.length > 0 ? (
            <table>
              <thead>
                <tr>
                  {results.columns.map(column => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((row, index) => (
                  <tr key={index}>
                    {results.columns.map(column => (
                      <td key={`${index}-${column}`}>{row[column]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="demo-empty">No results found for that prompt.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DemoAuthCard() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const submitAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    setLoading(false);
    setResult(data);
  };

  return (
    <div className="demo-card">
      <p>Enter username and password to simulate an authentication flow.</p>
      <form onSubmit={submitAuth} className="demo-form">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Authenticating…' : 'Sign In'}
        </button>
      </form>
      {result && (
        <div className={`demo-message ${result.success ? 'success' : 'error'}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState('');
  const [plans, setPlans] = useState({ monthly: [], annually: [] });
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedPriceId, setSelectedPriceId] = useState('');
  const [selectedPlanLabel, setSelectedPlanLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await fetch('/api/plans');
        const data = await response.json();
        const planGroups = data.plans || { monthly: [], annually: [] };
        setPlans(planGroups);

        const firstPlan = planGroups.monthly?.[0] || planGroups.annually?.[0];
        if (firstPlan) {
          setSelectedPriceId(firstPlan.id);
          setSelectedPlanLabel(`${firstPlan.nickname} — ${firstPlan.displayAmount}`);
        }
      } catch (err) {
        console.error('Unable to load plans', err);
      }
    };

    loadPlans();
  }, []);

  useEffect(() => {
    const selectedPlan = (plans[billingCycle] || []).find((plan) => plan.id === selectedPriceId);
    if (!selectedPlan) {
      const firstPlan = plans[billingCycle]?.[0];
      if (firstPlan) {
        setSelectedPriceId(firstPlan.id);
        setSelectedPlanLabel(`${firstPlan.nickname} — ${firstPlan.displayAmount}`);
      }
    }
  }, [billingCycle, plans, selectedPriceId]);

  const handleSelectPlan = (plan) => {
    setSelectedPriceId(plan.id);
    setSelectedPlanLabel(`${plan.nickname} — ${plan.displayAmount}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setMessage(null);

    if (!email.trim()) {
      setMessage('Please enter an email address.');
      return;
    }

    if (!selectedPriceId) {
      setMessage('Please select a pricing plan.');
      return;
    }

    setLoading(true);
    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      setLoading(false);
      setMessage('Card element not loaded.');
      return;
    }

    const result = await stripe.createToken(cardElement);

    if (result.error) {
      setLoading(false);
      setMessage(result.error.message);
      return;
    }

    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: result.token.id,
        planPriceId: selectedPriceId,
        email,
      }),
    });

    const data = await response.json();
    setLoading(false);
    setMessage(data.message || 'Subscription completed.');
  };

  const displayPlans = plans[billingCycle] || [];

  return (
    <form onSubmit={handleSubmit} className="demo-form demo-stripe">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email for Stripe customer"
        className="demo-input"
      />

      <div className="billing-toggle">
        <button
          type="button"
          className={billingCycle === 'monthly' ? 'active' : ''}
          onClick={() => setBillingCycle('monthly')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={billingCycle === 'annually' ? 'active' : ''}
          onClick={() => setBillingCycle('annually')}
        >
          Annually
        </button>
      </div>

      <div className="plan-grid">
        {displayPlans.length ? (
          displayPlans.map((plan) => (
            <button
              type="button"
              key={plan.id}
              className={`plan-card ${selectedPriceId === plan.id ? 'selected' : ''}`}
              onClick={() => handleSelectPlan(plan)}
            >
              <div className="plan-card-header">
                <span className="plan-name">{plan.nickname}</span>
                <span className="plan-amount">{plan.displayAmount}</span>
              </div>
              <div className="plan-card-body">
                <span className="plan-interval">Billed {plan.intervalLabel}</span>
                {plan.productName && <span className="plan-product">{plan.productName}</span>}
              </div>
            </button>
          ))
        ) : (
          <div className="plan-empty">Loading {billingCycle} plans…</div>
        )}
      </div>

      <CardElement options={{ style: { base: { color: '#fff', fontSize: '16px' }, invalid: { color: '#ff6b6b' } } }} />
      <button type="submit" className="btn btn-primary" disabled={!stripe || loading}>
        {loading ? 'Processing…' : 'Purchase Subscription'}
      </button>
      {selectedPlanLabel && <div className="selected-plan">Selected: {selectedPlanLabel}</div>}
      {message && <div className="demo-message success">{message}</div>}
    </form>
  );
}

function DemoStripeCard() {
  return (
    <div className="demo-card">
      <p>Use Stripe Elements to enter card details and simulate a subscription purchase.</p>
      <p className="demo-note">Test card: <strong>4242 4242 4242 4242</strong> · Expiry: any future date · CVC: 123</p>
      <Elements stripe={stripePromise}>
        <CheckoutForm />
      </Elements>
    </div>
  );
}

function Demo() {
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('.section');
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top < window.innerHeight - 100) {
          section.classList.add('visible');
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="home-page">
      <header className="top-nav">
        <div className="logo">Kelvin Joaquin</div>
        <nav>
          <Link to="/">Home</Link>
          <a href="#process-demos">Retrieve</a>
          <a href="#auth-demo">Auth</a>
          <a href="#stripe-demo">Subscribe</a>
        </nav>
      </header>

      <section id="home" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Process Demo</p>
          <h1>Backend workflow demos</h1>
          <p className="hero-title">Explore retrieval, authentication, and subscription flows in one design-focused page.</p>
          <p className="hero-description">This demo surface shows how data retrieval, login interactions, and Stripe Elements.</p>
          <div className="hero-actions">
            <Link to="/" className="btn btn-secondary">Back to Home</Link>
          </div>
        </div>
      </section>

      <section id="process-demos" className="section about">
        <div className="section-title">
          <span>01</span>
          <h2>Retrieving Details</h2>
        </div>
        <p className="section-description">
          This demo uses an OpenAI-powered LLM to translate natural language into SQL, then executes the query against the live database so you can explore real contact and payment data.
        </p>
        <div className="demo-cards">
          <DemoRetrieveCard />
        </div>
      </section>

      {/*
      <section id="auth-demo" className="section skills">
        <div className="section-title">
          <span>02</span>
          <h2>Authenticate</h2>
        </div>
        <div className="demo-cards">
          <DemoAuthCard />
        </div>
      </section>

      <section id="stripe-demo" className="section experience">
        <div className="section-title">
          <span>03</span>
          <h2>Purchase Subscription</h2>
        </div>
        <div className="demo-cards">
          <DemoStripeCard />
        </div>
      </section>
      */}
    </main>
  );
}

export default Demo;
