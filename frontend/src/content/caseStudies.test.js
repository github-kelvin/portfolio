import { describe, it, expect } from 'vitest';
import { caseStudies } from './caseStudies';

const REQUIRED_STRINGS = ['slug', 'kicker', 'title', 'summary', 'outcome'];

describe('caseStudies content integrity', () => {
  it('has exactly five studies', () => {
    expect(caseStudies).toHaveLength(5);
  });

  it('has unique, url-safe slugs', () => {
    const slugs = caseStudies.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(caseStudies.map((s) => [s.slug, s]))('%s has complete content', (_slug, s) => {
    for (const key of REQUIRED_STRINGS) {
      expect(s[key], key).toBeTypeOf('string');
      expect(s[key].length, key).toBeGreaterThan(0);
    }
    for (const key of ['company', 'role', 'timeframe', 'stack']) {
      expect(s.context[key], `context.${key}`).toBeTypeOf('string');
    }
    expect(s.problem.length).toBeGreaterThan(0);
    expect(s.decisions.length).toBeGreaterThanOrEqual(2);
    for (const d of s.decisions) {
      expect(d.title).toBeTypeOf('string');
      expect(d.why).toBeTypeOf('string');
      expect(d.rejected).toBeTypeOf('string');
    }
    expect(s.results.length).toBeGreaterThan(0);
    for (const r of s.results) {
      expect(r.value).toBeTypeOf('string');
      expect(r.label).toBeTypeOf('string');
    }
    expect(s.tags.length).toBeGreaterThan(0);
  });

  it.each(caseStudies.map((s) => [s.slug, s]))('%s has a valid diagram', (_slug, s) => {
    const { diagram } = s;
    expect(diagram.title).toBeTypeOf('string');
    expect(diagram.width).toBeGreaterThan(0);
    expect(diagram.height).toBeGreaterThan(0);
    expect(diagram.nodes.length).toBeGreaterThanOrEqual(2);
    expect(diagram.edges.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(diagram.nodes.map((n) => n.id));
    expect(ids.size).toBe(diagram.nodes.length);
    for (const e of diagram.edges) {
      expect(ids.has(e.from), `edge from ${e.from}`).toBe(true);
      expect(ids.has(e.to), `edge to ${e.to}`).toBe(true);
    }
  });
});
