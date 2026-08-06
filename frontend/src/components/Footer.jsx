function Footer() {
  return (
    <footer className="site-footer">
      <p>© {new Date().getFullYear()} Kelvin Joaquin. Built for backend roles.</p>
      <div>
        <a href="mailto:kelvin.joaquin@icloud.com">Email</a>
        <a href="https://www.linkedin.com/in/kelvin-joaquin" target="_blank" rel="noreferrer">LinkedIn</a>
        <a href="#work">Back to top ↑</a>
      </div>
    </footer>
  );
}

export default Footer;
