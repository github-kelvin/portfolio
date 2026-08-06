import { Link } from 'react-router-dom';

// `article` variant: narrow header with a back link (case-study pages).
function Nav({ article = false }) {
  return (
    <header className={article ? 'top-nav top-nav--article' : 'top-nav'}>
      <Link to="/" className="logo">
        Kelvin <strong>Joaquin</strong>
      </Link>
      {article ? (
        <Link to="/" className="nav-back">← All work</Link>
      ) : (
        <nav>
          <a href="#work">Work</a>
          <a href="#skills">Skills</a>
          <a href="#experience">Experience</a>
          <a href="#contact">Contact</a>
        </nav>
      )}
    </header>
  );
}

export default Nav;
