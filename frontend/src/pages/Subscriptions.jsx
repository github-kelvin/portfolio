import { useNavigate, Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('pk_test_51ReXBn08p1kJLykgZcT9pbKQTsIgUowG8hmgqVNA2q7JjlUu2cjqs1081SfBQFfg4b5uFu8eJtF7yHQCUmEznTOm00t3Um7bgY');

function Subscriptions() {
  const navigate = useNavigate();

  const handlePurchase = async (plan) => {
    const stripe = await stripePromise;
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ plan }),
    });
    const { url } = await res.json();
    window.location.href = url; // Redirect to Stripe
  };

  return (
    <div className="section">
      <h1>Subscriptions</h1>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn" onClick={() => handlePurchase('basic')}>Buy Basic ($10)</button>
        <button className="btn" onClick={() => handlePurchase('premium')}>Buy Premium ($20)</button>
      </div>
      <br />
      <Link to="/dashboard" className="btn">Back to Dashboard</Link>
    </div>
  );
}

export default Subscriptions;