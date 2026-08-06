import { Link } from 'react-router-dom';
import Nav from '../components/Nav';

function NotFound() {
  return (
    <>
      <Nav article />
      <main className="not-found">
        <p className="cs-eyebrow">404</p>
        <h1>Page not found</h1>
        <Link to="/">← Back to home</Link>
      </main>
    </>
  );
}

export default NotFound;
