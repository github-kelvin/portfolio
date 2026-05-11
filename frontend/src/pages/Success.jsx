import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function Success() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      // Call backend to verify and process
      fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ sessionId }),
      });
    }
    setTimeout(() => navigate('/dashboard'), 3000);
  }, [navigate, sessionId]);

  return (
    <div className="section" style={{ textAlign: 'center' }}>
      <h1>Payment Successful!</h1>
      <p>Thank you for your purchase. Redirecting to dashboard...</p>
    </div>
  );
}

export default Success;