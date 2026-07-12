import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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
        </nav>
      </header>

      <section id="home" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Process Demo</p>
          <h1>Backend workflow demos</h1>
          <p className="hero-title">Explore retrieval and authentication flows in one design-focused page.</p>
          <p className="hero-description">This demo surface shows how data retrieval and login interactions come together.</p>
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
      */}
    </main>
  );
}

export default Demo;
