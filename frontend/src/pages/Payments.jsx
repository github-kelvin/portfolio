import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Payments() {
  const [payments, setPayments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    const res = await fetch('/api/payments', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await res.json();
    setPayments(data);
  };

  return (
    <div className="section">
      <h1>Payment History</h1>
      <div className="payments-list">
        <ul>
          {payments.map(payment => (
            <li key={payment.id}>
              {payment.plan} - ${payment.amount} - {payment.status} - {payment.created_at}
            </li>
          ))}
        </ul>
      </div>
      <Link to="/dashboard" className="btn">Back to Dashboard</Link>
    </div>
  );
}

export default Payments;