import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import { caseStudies } from '../content/caseStudies';
import { useReveal } from '../hooks/useReveal';

const skillDomains = [
  { title: 'APIs & Services', items: ['Node.js', 'PHP', 'REST API design', 'Event-driven systems'] },
  { title: 'Data & Storage', items: ['MySQL', 'Redis', 'Query optimization', 'Schema migrations'] },
  { title: 'Infrastructure & DevOps', items: ['Docker', 'CI/CD pipelines', 'Cloud platforms', 'Kubernetes'] },
  { title: 'Payments & Auth', items: ['Gateway integrations', 'Subscriptions & licensing', 'OAuth', 'PCI-aware design'] },
];

const experience = [
  { role: 'Senior Software Developer — SplitmediaLabs', dates: '2014–2025' },
  { role: 'Technical Consultant — Cooperative Development Authority', dates: '2010–2024' },
  { role: 'Associate Technical Staff — Fujitsu Ten Solutions', dates: '2010–2014' },
];

function Home() {
  useEffect(() => {
    document.title = 'Kelvin Joaquin — Senior Backend Engineer';
  }, []);

  useReveal();

  return (
    <>
      <Nav />
      <main>
        <section className="hero">
          <div>
            <p className="hero-eyebrow fade-up">Senior Backend Engineer</p>
            <h1 className="fade-up d1">Backend systems for payments, auth, and scale.</h1>
            <p className="hero-lede fade-up d2">
              10+ years designing and running production systems — payment infrastructure, licensing,
              authentication, and the migrations that keep them modern.
            </p>
            <a href="#work" className="hero-cta fade-up d3">
              See the work <span>→</span>
            </a>
          </div>
          <div className="hero-meta fade-up d4">
            <div>
              <span className="label">Based in</span>
              <span className="value">Philippines · remote</span>
            </div>
            <div>
              <span className="label">Focus</span>
              <div className="chiplets">
                <span>Payments</span>
                <span>Auth</span>
                <span>Migrations</span>
              </div>
            </div>
            <div>
              <span className="label">Experience</span>
              <span className="value">10+ yrs · 3 organizations</span>
            </div>
            <div>
              <span className="label">Status</span>
              <span className="value value--accent">Open to senior &amp; consulting roles</span>
            </div>
          </div>
        </section>

        <section id="work" className="section reveal">
          <p className="section-label">01 · Case Studies</p>
          <div className="work-list">
            {caseStudies.map((study) => (
              <Link
                key={study.slug}
                to={`/work/${study.slug}`}
                className={study.featured ? 'work-row work-row--featured' : 'work-row'}
              >
                <span>
                  <span className="kicker">{study.kicker}</span>
                  <span className="title">{study.title}</span>
                </span>
                <span className="arrow">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="skills" className="section reveal">
          <p className="section-label">02 · Skills</p>
          <div className="skills-cols">
            {skillDomains.map((domain) => (
              <div key={domain.title} className="skill-set">
                <h3>{domain.title}</h3>
                <p>{domain.items.join(' · ')}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="experience" className="section reveal">
          <p className="section-label">03 · Experience</p>
          <div className="xp-list">
            {experience.map((entry) => (
              <div key={entry.role} className="xp-row">
                <span className="role">{entry.role}</span>
                <span className="dates">{entry.dates}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="section reveal">
          <p className="section-label">04 · Get in touch</p>
          <div className="contact-cols">
            <div>
              <p className="label">Email</p>
              <p className="value">
                <a href="mailto:kelvin.joaquin@icloud.com">kelvin.joaquin@icloud.com</a>
              </p>
            </div>
            <div>
              <p className="label">LinkedIn</p>
              <p className="value">
                <a href="https://www.linkedin.com/in/kelvin-joaquin" target="_blank" rel="noreferrer">
                  linkedin.com/in/kelvin-joaquin
                </a>
              </p>
            </div>
            <div>
              <p className="label">Phone</p>
              <p className="value">(+63) 917-555-0338</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default Home;
