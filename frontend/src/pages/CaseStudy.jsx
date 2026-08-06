import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Nav from '../components/Nav';
import FlowDiagram from '../components/diagrams/FlowDiagram';
import { caseStudies } from '../content/caseStudies';
import { useReveal } from '../hooks/useReveal';
import NotFound from './NotFound';

function CaseStudy() {
  const { slug } = useParams();
  const study = caseStudies.find((s) => s.slug === slug);

  useEffect(() => {
    if (study) {
      document.title = `${study.title} — Kelvin Joaquin`;
    }
    window.scrollTo(0, 0);
  }, [study]);

  useReveal([slug]);

  if (!study) {
    return <NotFound />;
  }

  return (
    <>
      <Nav article />
      <article className="case-study">
        <p className="cs-eyebrow">Case Study · {study.kicker}</p>
        <h1>{study.title}</h1>
        <p className="outcome">{study.outcome}</p>

        <div className="context-strip reveal">
          <div>Company<strong>{study.context.company}</strong></div>
          <div>Role<strong>{study.context.role}</strong></div>
          <div>Timeframe<strong>{study.context.timeframe}</strong></div>
          <div>Stack<strong>{study.context.stack}</strong></div>
        </div>

        <h2 className="reveal"><span>01</span>The problem</h2>
        {study.problem.map((paragraph, i) => (
          <p className="body reveal" key={i}>{paragraph}</p>
        ))}

        <h2 className="reveal"><span>02</span>Architecture</h2>
        <div className="diagram reveal">
          <FlowDiagram {...study.diagram} />
        </div>

        <h2 className="reveal"><span>03</span>Key decisions</h2>
        {study.decisions.map((d) => (
          <div className="decision reveal" key={d.title}>
            <h3>{d.title}</h3>
            <p>{d.why}</p>
            <p className="alt">Rejected: {d.rejected}</p>
          </div>
        ))}

        <h2 className="reveal"><span>04</span>Results</h2>
        <div className="results reveal">
          {study.results.map((r) => (
            <div className="result" key={r.label}>
              <strong className={r.placeholder ? 'placeholder' : undefined}>{r.value}</strong>
              <span>{r.label}</span>
            </div>
          ))}
        </div>

        <p className="cs-tags">{study.tags.join(' · ')}</p>
      </article>
    </>
  );
}

export default CaseStudy;
