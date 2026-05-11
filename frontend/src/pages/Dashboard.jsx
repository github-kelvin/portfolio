import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Dashboard() {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/auth');
    else fetchContacts();
  }, []);

  const fetchContacts = async () => {
    const res = await fetch('/api/contacts', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await res.json();
    setContacts(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `/api/contacts/${editing}` : '/api/contacts';
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name, email, phone }),
    });
    if (res.ok) {
      fetchContacts();
      setName('');
      setEmail('');
      setPhone('');
      setEditing(null);
    }
  };

  const handleEdit = (contact) => {
    setName(contact.name);
    setEmail(contact.email);
    setPhone(contact.phone);
    setEditing(contact.id);
  };

  const handleDelete = async (id) => {
    await fetch(`/api/contacts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    fetchContacts();
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <Link to="/subscriptions" className="btn">Subscriptions</Link>
      <br />
      <Link to="/payments" className="btn">Payment History</Link>
      <h2>Contacts</h2>
      <div className="contact-form">
        <form onSubmit={handleSubmit}>
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
          <button type="submit">{editing ? 'Update' : 'Add'}</button>
        </form>
      </div>
      <div className="contacts-list">
        {contacts.map(contact => (
          <div key={contact.id} className="contact-card">
            <h3>{contact.name}</h3>
            <p>{contact.email}</p>
            <p>{contact.phone}</p>
            <button onClick={() => handleEdit(contact)}>Edit</button>
            <button onClick={() => handleDelete(contact.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;