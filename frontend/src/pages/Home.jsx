import { useEffect } from 'react';

const defaultProfessional = {
  name: 'Kelvin Joaquin',
  title: 'Senior Backend Engineer',
  bio: 'Senior Backend Engineer with 10+ years of experience designing scalable APIs, modernizing legacy systems, and improving cloud deployment workflows.',
  summary: "I’m a Senior Backend Engineer with over 10 years of experience building scalable, production-ready systems for web and desktop applications. I specialize in designing RESTful APIs, modernizing legacy architectures, and delivering reliable backend services that support real-world users.\nI’ve worked on global platforms like XSplit, where I developed backend systems for authentication, licensing, and payment integrations. My work focuses on creating clean, maintainable solutions using Node.js, PHP, and cloud technologies, while ensuring performance and reliability at scale.\nOver the years, I’ve led backend improvements such as migrating legacy systems to modern architectures, introducing containerized deployments with Docker, and optimizing database performance. I enjoy solving complex problems, improving system design, and building systems that grow with the product.\nI’m comfortable working independently or as part of a team, and I value clear communication, practical solutions, and continuous learning.",
  contact: {
    email: 'kelvin.joaquin@icloud.com',
    phone: '(+63) 917-555-0338',
    linkedin: 'www.linkedin.com/in/kelvin-joaquin',
  },
  skills: ['Node.js', 'PHP', 'REST APIs', 'MySQL', 'Redis', 'Docker', 'CI/CD', 'Cloud platforms', 'Payment integrations', 'Performance optimization'],
  workExperience: [
    {
      title: 'Senior Software Developer',
      company: 'SplitmediaLabs',
      duration: '2014 – 2025',
      description: 'Designed and maintained RESTful APIs for production desktop and web applications, migrated legacy PHP services to scalable Node.js backends, and implemented Docker-based deployment workflows.',
    },
    {
      title: 'Technical Consultant',
      company: 'Cooperative Development Authority',
      duration: '2010 – 2024',
      description: 'Designed nationwide infrastructure, implemented CI/CD pipelines, and guided long-term architecture and operations for distributed systems.',
    },
    {
      title: 'Associate Technical Staff',
      company: 'Fujitsu Ten Solutions Philippines',
      duration: '2010 – 2014',
      description: 'Built internal web applications, delivered embedded C training, and reviewed software for reliability and performance.',
    },
  ],
};

function Home() {
  const professional = defaultProfessional;

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
    handleScroll(); // Check initial visibility
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="home-page">
      <header className="top-nav">
        <div className="logo">Kelvin Joaquin</div>
        <nav>
          <a href="#about">About</a>
          <a href="#skills">Skills</a>
          <a href="#experience">Experience</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <section id="home" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Professional Portfolio</p>
          <h1>{professional ? professional.name : 'Kelvin Joaquin'}</h1>
          <p className="hero-title">{professional ? professional.title : 'Backend Developer'}</p>
          <p className="hero-description">{professional ? professional.bio : 'Passionate backend developer specializing in scalable systems and modern technologies.'}</p>
          <div className="hero-actions">
            <a href="#contact" className="btn btn-primary">Work with me</a>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-card">
            <p className="panel-label">Current Role</p>
            <h2>{professional ? professional.title : 'Backend Developer'}</h2>
            <p>{professional.contact?.email || 'kelvin.joaquin@example.com'}</p>
            <div className="panel-details">
              <div>
                <strong>Experience</strong>
                <span>10+ Years</span>
              </div>
              <div>
                <strong>Focus</strong>
                <span>Backend / Payments</span>
              </div>
            </div>
          </div>
        </div>
      </section>

          <section id="about" className="section about">
            <div className="section-title">
              <span>01</span>
              <h2>About Me</h2>
            </div>
            <div className="about-grid">
              <div className="about-text">
                <p>{professional.summary || professional.bio}</p>
                <p>Specialized in modern backend architecture, containerized deployment pipelines, and international payment platforms.</p>
              </div>
            </div>
          </section>

          <section id="skills" className="section skills">
            <div className="section-title">
              <span>02</span>
              <h2>Skills</h2>
            </div>
            <div className="skills-grid">
              {professional.skills.map(skill => (
                <div key={skill} className="skill-card">
                  {skill}
                </div>
              ))}
            </div>
          </section>

          <section id="experience" className="section experience">
            <div className="section-title">
              <span>03</span>
              <h2>Experience</h2>
            </div>
            <div className="timeline">
              {professional.workExperience.map((work, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <h3>{work.title}</h3>
                    <p className="timeline-meta">{work.company} · {work.duration}</p>
                    <p>{work.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="contact" className="section contact">
            <div className="section-title">
              <span>04</span>
              <h2>Get in Touch</h2>
            </div>
            <div className="contact-grid">
              <div className="contact-card">
                <h3>Email</h3>
                <p>{professional.contact.email}</p>
              </div>
              <div className="contact-card">
                <h3>Phone</h3>
                <p>{professional.contact.phone}</p>
              </div>
              <div className="contact-card">
                <h3>LinkedIn</h3>
                <a href={`https://${professional.contact.linkedin}`} target="_blank" rel="noreferrer">{professional.contact.linkedin}</a>
              </div>
            </div>
          </section>
    </main>
  );
}

export default Home;