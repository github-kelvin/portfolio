# Backend-Proof Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild crvn.online as a proof-driven portfolio: a proof-first home page plus five routed case-study pages, all static.

**Architecture:** Case studies are structured data in `src/content/caseStudies.js`; one shared `CaseStudy.jsx` template renders any study by slug via `react-router-dom`, and home cards derive from the same data. Diagrams render from per-study node/edge data through one generic `FlowDiagram` SVG component. Styling is a three-file split (base tokens / home / case study) evolving the existing dark theme.

**Tech Stack:** React 18, Vite 5, react-router-dom v6, vitest (node environment — content-integrity tests only, no DOM tests).

**Spec:** `docs/superpowers/specs/2026-08-06-backend-proof-redesign-design.md`

## Global Constraints

- Fully static site — no backend, no new external services. Google Fonts is the only permitted external resource.
- Never invent metrics: any unverified number renders as the literal string `[metric needed]` with `placeholder: true`.
- `.do/app.yaml` already has `catchall_document: index.html` — do NOT modify `.do/app.yaml`.
- All frontend work happens under `frontend/`; run npm commands from `frontend/`.
- Dark theme only; palette base `#080b14`, accent gradient `#f29111 → #f2c24f`.
- Existing scroll-reveal animation is intentionally dropped (no `opacity: 0` sections).
- Work on branch `redesign/backend-proof`.

**Intermediate-state note:** Tasks 4–6 leave the OLD home page partially unstyled (its old-only classes like `.panel-card` disappear when `index.css` is replaced). This is expected and acceptable; the site fully recovers at Task 7. Every task still builds and tests green.

---

### Task 1: Branch, dependencies, and test tooling

**Files:**
- Modify: `frontend/package.json` (deps + `test` script)

**Interfaces:**
- Produces: `react-router-dom` v6 importable; `npm test` runs `vitest run` (from `frontend/`).

- [ ] **Step 1: Create the branch**

```bash
cd /Users/kelvin/Work/portfolio && git checkout -b redesign/backend-proof
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend && npm install react-router-dom@^6.26.0 && npm install -D vitest@^2.1.0
```

- [ ] **Step 3: Add the test script**

In `frontend/package.json`, change the `scripts` block to:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

- [ ] **Step 4: Verify the build still passes**

Run (in `frontend/`): `npm run build`
Expected: `vite build` completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add react-router-dom and vitest for redesign"
```

---

### Task 2: Case-study content module (TDD)

**Files:**
- Create: `frontend/src/content/caseStudies.js`
- Test: `frontend/src/content/caseStudies.test.js`

**Interfaces:**
- Produces: named export `caseStudies` — array of 5 study objects with shape:
  `{ slug, kicker, title, summary, outcome, context: { company, role, timeframe, stack }, problem: string[], decisions: [{ title, why, rejected }], results: [{ value, label, placeholder? }], tags: string[], diagram: { title, width, height, nodes: [{ id, x, y, w, h, label, sub?, accent? }], edges: [{ from, to }] } }`
- Slugs (exact): `payments-licensing`, `auth-at-scale`, `php-to-node`, `monolith-to-events`, `cda-infrastructure`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/content/caseStudies.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run (in `frontend/`): `npm test`
Expected: FAIL — cannot resolve `./caseStudies`.

- [ ] **Step 3: Write the content module**

Create `frontend/src/content/caseStudies.js` with exactly this content:

```js
export const caseStudies = [
  {
    slug: 'payments-licensing',
    kicker: 'XSplit · SplitmediaLabs',
    title: 'Payment & licensing infrastructure for a global desktop product',
    summary:
      'Multiple gateways, subscriptions, and license enforcement across web and desktop — with zero-downtime migrations.',
    outcome:
      'Multiple payment gateways and a licensing system serving a worldwide user base — extended and migrated with zero downtime.',
    context: {
      company: 'SplitmediaLabs (XSplit)',
      role: 'Senior Software Developer',
      timeframe: '2014 – 2025',
      stack: 'Node.js · PHP · MySQL · Redis',
    },
    problem: [
      'XSplit sold subscriptions and licenses globally, which meant supporting multiple payment providers, currencies, and tax regimes — on top of a licensing system that desktop clients verified against continuously.',
      'The original implementation was tightly coupled to a single gateway inside a legacy PHP codebase. Adding a provider or changing a plan meant touching checkout logic directly, and any downtime hit the revenue path.',
    ],
    decisions: [
      {
        title: 'Gateway abstraction layer instead of per-provider code paths',
        why: 'A single provider interface let new gateways ship without touching checkout or licensing logic.',
        rejected:
          'Direct integrations per gateway — faster for the first provider, unmaintainable by the third.',
      },
      {
        title: 'License verification cached out of the database hot path',
        why: 'Desktop clients verify continuously; caching verification at the API edge kept the database off the hot path.',
        rejected: 'Per-check database reads — simple, but collapses under fleet-wide load.',
      },
      {
        title: 'Incremental billing migration behind stable API contracts',
        why: 'Old PHP and new Node.js code served the same API surface during cutover, so clients never noticed the migration.',
        rejected: 'Big-bang rewrite of billing — unbounded risk on the revenue path.',
      },
    ],
    results: [
      { value: '[metric needed]', label: 'payment gateways in production', placeholder: true },
      { value: '[metric needed]', label: 'subscriptions supported', placeholder: true },
      { value: 'Zero', label: 'downtime during migrations' },
    ],
    tags: ['Node.js', 'Payments', 'Licensing', 'MySQL', 'Redis'],
    diagram: {
      title: 'Payments and licensing architecture',
      width: 640,
      height: 220,
      nodes: [
        { id: 'clients', x: 20, y: 85, w: 120, h: 50, label: 'Desktop + web', sub: 'checkout' },
        { id: 'api', x: 210, y: 85, w: 130, h: 50, label: 'Payments API', sub: 'Node.js', accent: true },
        { id: 'gwA', x: 420, y: 20, w: 140, h: 44, label: 'Gateway A' },
        { id: 'gwB', x: 420, y: 88, w: 140, h: 44, label: 'Gateway B' },
        { id: 'lic', x: 420, y: 156, w: 140, h: 44, label: 'License store' },
      ],
      edges: [
        { from: 'clients', to: 'api' },
        { from: 'api', to: 'gwA' },
        { from: 'api', to: 'gwB' },
        { from: 'api', to: 'lic' },
      ],
    },
  },
  {
    slug: 'auth-at-scale',
    kicker: 'XSplit · SplitmediaLabs',
    title: 'Authentication for desktop and web at global scale',
    summary:
      'One identity system serving desktop apps, web properties, and third-party OAuth — built for global usage.',
    outcome:
      'A single identity system serving desktop apps, web properties, and third-party OAuth logins for users worldwide.',
    context: {
      company: 'SplitmediaLabs (XSplit)',
      role: 'Senior Software Developer',
      timeframe: '2014 – 2025',
      stack: 'Node.js · Redis · MySQL · OAuth',
    },
    problem: [
      'Several products — desktop applications and multiple web properties — needed one account system, but desktop token lifecycles behave nothing like browser sessions.',
      'Third-party OAuth logins had to resolve to the same canonical identity as email accounts, and a failure anywhere locked users out of software they had paid for.',
    ],
    decisions: [
      {
        title: 'Token model split by client type',
        why: 'Long-lived refresh tokens for desktop clients and short browser sessions, issued by one service, matched each platform’s real lifecycle.',
        rejected: 'A one-size-fits-all session model — either insecure on web or hostile on desktop.',
      },
      {
        title: 'Third-party identities linked to one canonical account',
        why: 'OAuth logins attach to a single identity, so purchases and licenses always resolve to the same user.',
        rejected: 'Provider-keyed accounts — duplicate users and orphaned purchases.',
      },
      {
        title: 'Sessions in Redis, identities in MySQL',
        why: 'Hot-path token validation stays in memory while the durable identity record stays relational.',
        rejected: 'Database-backed sessions — hot-path load on the source of truth.',
      },
    ],
    results: [
      { value: '[metric needed]', label: 'authentications per month', placeholder: true },
      { value: '[metric needed]', label: 'OAuth providers supported', placeholder: true },
      { value: 'Zero', label: 'forced global logouts during migrations' },
    ],
    tags: ['Auth', 'OAuth', 'Node.js', 'Redis', 'MySQL'],
    diagram: {
      title: 'Authentication architecture',
      width: 640,
      height: 232,
      nodes: [
        { id: 'desktop', x: 20, y: 20, w: 130, h: 44, label: 'Desktop apps' },
        { id: 'web', x: 20, y: 94, w: 130, h: 44, label: 'Web apps' },
        { id: 'oauth', x: 20, y: 168, w: 130, h: 44, label: 'OAuth providers' },
        { id: 'api', x: 250, y: 94, w: 140, h: 50, label: 'Auth API', sub: 'Node.js', accent: true },
        { id: 'redis', x: 470, y: 58, w: 140, h: 44, label: 'Redis', sub: 'sessions' },
        { id: 'mysql', x: 470, y: 132, w: 140, h: 44, label: 'MySQL', sub: 'identities' },
      ],
      edges: [
        { from: 'desktop', to: 'api' },
        { from: 'web', to: 'api' },
        { from: 'oauth', to: 'api' },
        { from: 'api', to: 'redis' },
        { from: 'api', to: 'mysql' },
      ],
    },
  },
  {
    slug: 'php-to-node',
    kicker: 'Migration',
    title: 'Migrating a legacy PHP platform to Node.js — incrementally, under load',
    summary:
      'Modernizing a revenue-critical PHP codebase to Node.js services without stopping the product.',
    outcome:
      'A revenue-critical PHP codebase modernized into Node.js services without stopping the product or freezing features.',
    context: {
      company: 'SplitmediaLabs (XSplit)',
      role: 'Senior Software Developer',
      timeframe: 'Multi-year, incremental',
      stack: 'PHP · Node.js · MySQL · Docker',
    },
    problem: [
      'Years of accumulated PHP handled authentication, billing, and licensing. It was hard to test, risky to deploy, and increasingly hard to hire for.',
      'A from-scratch rewrite was repeatedly considered and rejected — the product had to keep shipping features while the platform underneath it was replaced.',
    ],
    decisions: [
      {
        title: 'Strangler-fig routing at the proxy layer',
        why: 'A routing layer in front of the platform moved traffic endpoint-by-endpoint to new Node.js services, keeping every step reversible.',
        rejected: 'Big-bang rewrite — the industry’s best-documented way to lose two years.',
      },
      {
        title: 'Shared database during the transition',
        why: 'Old and new code read the same MySQL schema, with contracts enforced at the API layer — no dual-write machinery until services stabilized.',
        rejected: 'Splitting the database first — dual-write complexity before any service existed.',
      },
      {
        title: 'Behavior-preserving ports before redesigns',
        why: 'Endpoints were ported as-is and verified against existing behavior, then refactored — migration risk and design risk never in the same change.',
        rejected: 'Redesigning while porting — two failure modes in every deploy.',
      },
    ],
    results: [
      { value: '[metric needed]', label: 'endpoints migrated', placeholder: true },
      { value: '[metric needed]', label: 'deploy time improvement', placeholder: true },
      { value: 'Zero', label: 'revenue-impacting incidents during cutover' },
    ],
    tags: ['PHP', 'Node.js', 'Strangler fig', 'MySQL', 'Docker'],
    diagram: {
      title: 'Strangler-fig migration architecture',
      width: 640,
      height: 232,
      nodes: [
        { id: 'clients', x: 20, y: 94, w: 120, h: 44, label: 'Clients' },
        { id: 'proxy', x: 200, y: 91, w: 130, h: 50, label: 'Routing proxy', sub: 'strangler fig', accent: true },
        { id: 'php', x: 410, y: 20, w: 150, h: 50, label: 'Legacy PHP', sub: 'shrinking' },
        { id: 'node', x: 410, y: 92, w: 150, h: 50, label: 'Node services', sub: 'growing' },
        { id: 'db', x: 410, y: 172, w: 150, h: 40, label: 'Shared MySQL' },
      ],
      edges: [
        { from: 'clients', to: 'proxy' },
        { from: 'proxy', to: 'php' },
        { from: 'proxy', to: 'node' },
        { from: 'node', to: 'db' },
      ],
    },
  },
  {
    slug: 'monolith-to-events',
    kicker: 'XSplit · Architecture',
    title: 'From backend monolith to event-driven services',
    summary:
      'Splitting a backend monolith into event-driven services — queues, contracts, and the seams that made it safe.',
    outcome:
      'A backend monolith decomposed into event-driven services, with licensing, payment, and account events flowing through a message broker instead of cross-module calls.',
    context: {
      company: 'SplitmediaLabs (XSplit)',
      role: 'Senior Software Developer',
      timeframe: '2014 – 2025',
      stack: 'Node.js · RabbitMQ · Docker · MySQL',
    },
    problem: [
      'Backend modules were coupled through direct calls and shared tables: a slow payment provider could stall unrelated requests, and scaling one workload meant scaling everything.',
      'Deploys were all-or-nothing — every change carried the whole backend’s risk.',
    ],
    decisions: [
      {
        title: 'Events for cross-domain effects, not synchronous calls',
        why: 'License issuance reacts to a payment event through the broker, so provider latency is absorbed by the queue instead of blocking requests.',
        rejected: 'Synchronous service chains — a distributed monolith with network faults added.',
      },
      {
        title: 'Service boundaries along business capabilities',
        why: 'Payments, accounts, and licensing each own their domain and data — boundaries match how the product actually changes.',
        rejected: 'Layer-based services (API / logic / data tiers) — every feature touches every service.',
      },
      {
        title: 'Idempotent consumers with at-least-once delivery',
        why: 'Every consumer tolerates duplicate events by design, which makes broker semantics simple and failure recovery boring.',
        rejected: 'Exactly-once delivery assumptions — a guarantee brokers can’t actually make.',
      },
    ],
    results: [
      { value: '[metric needed]', label: 'services extracted', placeholder: true },
      { value: '[metric needed]', label: 'events per day through the broker', placeholder: true },
      { value: 'Independent', label: 'deploys per service' },
    ],
    tags: ['RabbitMQ', 'Microservices', 'Node.js', 'Docker'],
    diagram: {
      title: 'Event-driven services architecture',
      width: 700,
      height: 240,
      nodes: [
        { id: 'gw', x: 20, y: 95, w: 120, h: 50, label: 'API gateway' },
        { id: 'pay', x: 200, y: 40, w: 140, h: 48, label: 'Payments svc' },
        { id: 'acct', x: 200, y: 150, w: 140, h: 48, label: 'Accounts svc' },
        { id: 'mq', x: 400, y: 95, w: 110, h: 50, label: 'RabbitMQ', accent: true },
        { id: 'lic', x: 560, y: 40, w: 120, h: 48, label: 'Licensing', sub: 'worker' },
        { id: 'wrk', x: 560, y: 150, w: 120, h: 48, label: 'Workers', sub: 'email, sync' },
      ],
      edges: [
        { from: 'gw', to: 'pay' },
        { from: 'gw', to: 'acct' },
        { from: 'pay', to: 'mq' },
        { from: 'acct', to: 'mq' },
        { from: 'mq', to: 'lic' },
        { from: 'mq', to: 'wrk' },
      ],
    },
  },
  {
    slug: 'cda-infrastructure',
    kicker: 'Cooperative Development Authority',
    title: 'Nationwide infrastructure and CI/CD for a government agency',
    summary:
      'Fourteen years of distributed infrastructure, deployment pipelines, and long-horizon architecture stewardship.',
    outcome:
      'Fourteen years of infrastructure stewardship — regional systems, deployment pipelines, and architecture for a nationwide agency.',
    context: {
      company: 'Cooperative Development Authority',
      role: 'Technical Consultant',
      timeframe: '2010 – 2024',
      stack: 'CI/CD · Docker · Linux · Cloud',
    },
    problem: [
      'A government agency serving cooperatives across the country ran systems in distributed offices with uneven connectivity and manual deployment practices.',
      'The systems had to outlive individual projects, vendors, and administrations — architecture decisions carried a ten-year-plus horizon.',
    ],
    decisions: [
      {
        title: 'One standardized deployment pipeline across systems',
        why: 'Every system ships through the same CI/CD path, so operational knowledge transfers instead of living with one person.',
        rejected: 'Per-system manual deploy procedures — unauditable and person-dependent.',
      },
      {
        title: 'Containerized services for hosting portability',
        why: 'Docker images run identically across hosting environments, surviving infrastructure changes the agency didn’t control.',
        rejected: 'Environment-specific installs — every hosting change becomes a migration project.',
      },
      {
        title: 'Boring-technology bias for a decade-long horizon',
        why: 'Mature, widely-known tools keep systems maintainable by whoever comes next.',
        rejected: 'Framework-of-the-year adoption — unmaintainable within one staffing cycle.',
      },
    ],
    results: [
      { value: '14 years', label: 'of continuous operation' },
      { value: '[metric needed]', label: 'systems maintained', placeholder: true },
      { value: '[metric needed]', label: 'regional offices served', placeholder: true },
    ],
    tags: ['CI/CD', 'Docker', 'Infrastructure', 'Linux'],
    diagram: {
      title: 'Nationwide deployment architecture',
      width: 640,
      height: 220,
      nodes: [
        { id: 'repo', x: 20, y: 88, w: 120, h: 44, label: 'Git repos' },
        { id: 'ci', x: 200, y: 85, w: 140, h: 50, label: 'CI/CD pipeline', accent: true },
        { id: 'central', x: 410, y: 20, w: 150, h: 48, label: 'Central services' },
        { id: 'regional', x: 410, y: 92, w: 150, h: 48, label: 'Regional systems' },
        { id: 'offices', x: 410, y: 168, w: 150, h: 40, label: 'Field offices' },
      ],
      edges: [
        { from: 'repo', to: 'ci' },
        { from: 'ci', to: 'central' },
        { from: 'ci', to: 'regional' },
        { from: 'regional', to: 'offices' },
      ],
    },
  },
];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (in `frontend/`): `npm test`
Expected: PASS — all integrity tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/content/
git commit -m "feat: add case-study content model with integrity tests"
```

---

### Task 3: FlowDiagram component (TDD on the anchor helper)

**Files:**
- Create: `frontend/src/components/diagrams/FlowDiagram.jsx`
- Test: `frontend/src/components/diagrams/FlowDiagram.test.js`

**Interfaces:**
- Consumes: diagram data shape from Task 2 (`{ title, width, height, nodes, edges }`).
- Produces: default export `FlowDiagram` React component taking props `{ title, width, height, nodes, edges }`; named export `anchor(from, to)` returning `[x, y]` on `from`'s border facing `to`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/diagrams/FlowDiagram.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { anchor } from './FlowDiagram';

const box = (x, y) => ({ x, y, w: 100, h: 50 });

describe('anchor', () => {
  it('connects from the right edge when the target is to the right', () => {
    expect(anchor(box(0, 0), box(200, 0))).toEqual([100, 25]);
  });
  it('connects from the left edge when the target is to the left', () => {
    expect(anchor(box(200, 0), box(0, 0))).toEqual([200, 25]);
  });
  it('connects from the bottom edge when the target is below', () => {
    expect(anchor(box(0, 0), box(0, 200))).toEqual([50, 50]);
  });
  it('connects from the top edge when the target is above', () => {
    expect(anchor(box(0, 200), box(0, 0))).toEqual([50, 200]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (in `frontend/`): `npm test`
Expected: FAIL — cannot resolve `./FlowDiagram`.

- [ ] **Step 3: Implement FlowDiagram**

Create `frontend/src/components/diagrams/FlowDiagram.jsx`:

```jsx
export function anchor(from, to) {
  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? [from.x + from.w, from.y + from.h / 2] : [from.x, from.y + from.h / 2];
  }
  return dy >= 0 ? [from.x + from.w / 2, from.y + from.h] : [from.x + from.w / 2, from.y];
}

function FlowDiagram({ title, width, height, nodes, edges }) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <svg className="flow-diagram" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      <defs>
        <marker id="fd-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="none" stroke="#9ba2c7" strokeWidth="1.2" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const [x1, y1] = anchor(byId[e.from], byId[e.to]);
        const [x2, y2] = anchor(byId[e.to], byId[e.from]);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ba2c7" strokeWidth="1.2" markerEnd="url(#fd-arrow)" />
        );
      })}
      {nodes.map((n) => (
        <g key={n.id}>
          <rect
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            rx="10"
            fill={n.accent ? 'rgba(242,145,17,0.12)' : 'rgba(255,255,255,0.05)'}
            stroke={n.accent ? 'rgba(242,145,17,0.4)' : 'rgba(255,255,255,0.15)'}
          />
          <text x={n.x + n.w / 2} y={n.y + n.h / 2 + (n.sub ? -2 : 4)} textAnchor="middle" fill="#f6f7fb">
            {n.label}
          </text>
          {n.sub && (
            <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 14} textAnchor="middle" fill="#9ba2c7">
              {n.sub}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default FlowDiagram;
```

(Diagram text font styling comes from `.diagram text` rules in `case-study.css`, Task 4.)

- [ ] **Step 4: Run the tests to verify they pass**

Run (in `frontend/`): `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/diagrams/
git commit -m "feat: add generic FlowDiagram SVG component"
```

---

### Task 4: Stylesheet split (new design language)

**Files:**
- Create: `frontend/src/styles/base.css`, `frontend/src/styles/home.css`, `frontend/src/styles/case-study.css`
- Modify: `frontend/src/main.jsx` (imports)
- Delete: `frontend/src/index.css`

**Interfaces:**
- Produces: class vocabulary used by Tasks 5–7: `.top-nav`, `.logo`, `.section`, `.section-title`, `.eyebrow`, `.btn`, `.btn-primary`, `.tag`, `.site-footer`, `.not-found`, `.hero`, `.positioning`, `.intro`, `.cs-grid`, `.cs-card`, `.kicker`, `.read`, `.skills-grid`, `.skill-group`, `.xp`, `.xp-row`, `.xp-dot`, `.xp-meta`, `.contact-grid`, `.contact-card`, `.case-study`, `.outcome`, `.context-strip`, `.diagram`, `.decision`, `.alt`, `.results`, `.result`, `.placeholder`, `.tags`, `.back-link`.

- [ ] **Step 1: Create `frontend/src/styles/base.css`**

```css
/* Design tokens + shared chrome for crvn.online. Dark theme only. */

:root {
  --bg: #080b14;
  --bg-card: rgba(255, 255, 255, 0.03);
  --bg-card-raised: rgba(255, 255, 255, 0.06);
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.12);
  --text: #f6f7fb;
  --text-secondary: #c5cadf;
  --text-muted: #9ba2c7;
  --accent: #f29111;
  --accent-soft: #f6b55f;
  --accent-gradient: linear-gradient(135deg, #f29111 0%, #f2c24f 100%);
  --accent-wash: rgba(242, 145, 17, 0.12);
  --accent-border: rgba(242, 145, 17, 0.35);
  --radius-card: 24px;
  --radius-pill: 999px;
  --font-sans: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background-color: var(--bg);
  color: var(--text);
  line-height: 1.6;
  font-size: 16px;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
a {
  transition: all 0.25s ease;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(8, 11, 20, 0.75);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}

.top-nav .logo {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.top-nav nav {
  display: flex;
  gap: 1.5rem;
}

.top-nav nav a {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.top-nav nav a:hover {
  color: #fff;
}

.section {
  padding: 4.5rem 2rem;
  max-width: 1060px;
  margin: 0 auto;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0 0 2rem;
}

.section-title span {
  font-family: var(--font-mono);
  color: var(--accent-soft);
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.3em;
}

.section-title h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
}

.eyebrow {
  margin: 0 0 1rem;
  font-family: var(--font-mono);
  color: var(--accent-soft);
  font-size: 0.8rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.9rem 1.7rem;
  border-radius: var(--radius-pill);
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn-primary {
  background: var(--accent-gradient);
  color: #08101d;
}

.tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.site-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  max-width: 1060px;
  margin: 0 auto;
  padding: 2rem;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.9rem;
}

.site-footer div {
  display: flex;
  gap: 1.25rem;
}

.site-footer a:hover {
  color: #fff;
}

.not-found {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  max-width: 1060px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

.not-found h1 {
  margin: 0 0 1.5rem;
  font-size: clamp(2rem, 4vw, 3rem);
}

@media (max-width: 720px) {
  .top-nav {
    padding: 1rem;
  }

  .top-nav nav {
    display: none;
  }

  .section {
    padding: 3.5rem 1.25rem;
  }
}
```

- [ ] **Step 2: Create `frontend/src/styles/home.css`**

```css
/* Home page: hero, case-study grid, skills domains, experience, contact. */

.hero {
  padding-top: 5rem;
  padding-bottom: 3rem;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(242, 145, 17, 0.18), transparent 55%);
  top: -160px;
  right: -160px;
  pointer-events: none;
}

.hero h1 {
  margin: 0;
  font-size: clamp(2.6rem, 5vw, 4.5rem);
  line-height: 0.98;
}

.positioning {
  margin: 1.25rem 0 0;
  font-size: 1.35rem;
  color: var(--text-secondary);
  max-width: 38rem;
}

.intro {
  margin: 1rem 0 2rem;
  color: var(--text-muted);
  max-width: 42rem;
}

.cs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.25rem;
}

.cs-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.cs-card:hover {
  background: var(--accent-wash);
  border-color: var(--accent-border);
}

.kicker {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.cs-card h3 {
  margin: 0;
  font-size: 1.2rem;
  line-height: 1.3;
}

.cs-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
  flex: 1;
}

.cs-card .tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.read {
  font-size: 0.85rem;
  color: var(--accent-soft);
  font-weight: 600;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 1.25rem;
}

.skill-group {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 1.5rem;
}

.skill-group h3 {
  margin: 0 0 0.9rem;
  font-size: 1rem;
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
  color: var(--accent-soft);
}

.skill-group ul {
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--text-secondary);
  font-size: 0.95rem;
  display: grid;
  gap: 0.4rem;
}

.xp {
  display: grid;
  gap: 1.1rem;
}

.xp-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.25rem;
  align-items: start;
}

.xp-dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--accent-gradient);
  margin-top: 0.45rem;
}

.xp-row h3 {
  margin: 0;
  font-size: 1.05rem;
}

.xp-meta {
  font-family: var(--font-mono);
  color: var(--text-muted);
  font-size: 0.82rem;
  margin: 0.15rem 0 0;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.contact-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 1.5rem;
}

.contact-card h3 {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
  font-family: var(--font-mono);
  color: var(--accent-soft);
}

.contact-card p,
.contact-card a {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.contact-card a:hover {
  color: #fff;
}
```

- [ ] **Step 3: Create `frontend/src/styles/case-study.css`**

```css
/* Case-study detail page template. */

.case-study {
  max-width: 820px;
  margin: 0 auto;
  padding: 4rem 2rem;
  line-height: 1.65;
}

.case-study h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(1.9rem, 3.5vw, 2.8rem);
  line-height: 1.15;
}

.outcome {
  margin: 0 0 2.5rem;
  font-size: 1.15rem;
  color: var(--text-secondary);
}

.context-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1.4rem 1.6rem;
  margin-bottom: 3rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-muted);
}

.context-strip strong {
  display: block;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
  margin-top: 0.2rem;
}

.case-study h2 {
  font-size: 1.35rem;
  margin: 3rem 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.case-study h2 span {
  font-family: var(--font-mono);
  color: var(--accent-soft);
  font-size: 0.8rem;
  letter-spacing: 0.25em;
}

.case-study > p {
  color: var(--text-secondary);
  margin: 0 0 1rem;
}

.diagram {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1.5rem;
  margin: 1.5rem 0;
}

.diagram svg {
  width: 100%;
  height: auto;
  display: block;
}

.diagram text {
  font-family: var(--font-mono);
  font-size: 11px;
}

.decision {
  border-left: 2px solid var(--accent-border);
  padding: 0.2rem 0 0.2rem 1.25rem;
  margin: 0 0 1.5rem;
}

.decision h3 {
  margin: 0 0 0.35rem;
  font-size: 1.02rem;
}

.decision p {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0 0 0.3rem;
}

.decision .alt {
  color: var(--text-muted);
  font-size: 0.88rem;
}

.results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.result {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1.4rem;
}

.result strong {
  display: block;
  font-size: 1.6rem;
  margin-bottom: 0.3rem;
}

.result span {
  color: var(--text-muted);
  font-size: 0.88rem;
}

.placeholder {
  color: var(--accent-soft);
  font-family: var(--font-mono);
  font-size: 0.85rem;
}

.case-study .tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 2.5rem;
}

.back-link {
  display: inline-block;
  margin-top: 2rem;
  color: var(--accent-soft);
  font-weight: 600;
}
```

- [ ] **Step 4: Swap the imports in `frontend/src/main.jsx`**

Replace `import './index.css'` with:

```js
import './styles/base.css'
import './styles/home.css'
import './styles/case-study.css'
```

- [ ] **Step 5: Delete the old stylesheet**

```bash
git rm frontend/src/index.css
```

- [ ] **Step 6: Verify build and tests**

Run (in `frontend/`): `npm run build && npm test`
Expected: both pass. (The old Home page loses some styling until Task 7 — expected.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/styles/ frontend/src/main.jsx
git commit -m "feat: split stylesheet into base/home/case-study with new design tokens"
```

---

### Task 5: Nav, Footer, NotFound, and router shell

**Files:**
- Create: `frontend/src/components/Nav.jsx`, `frontend/src/components/Footer.jsx`, `frontend/src/pages/NotFound.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `.top-nav`, `.site-footer`, `.not-found`, `.eyebrow`, `.btn` classes from Task 4.
- Produces: default exports `Nav` (no props), `Footer` (no props), `NotFound` (no props). `App` wraps everything in `BrowserRouter` with routes `/` → `Home`, `*` → `NotFound`.

- [ ] **Step 1: Create `frontend/src/components/Nav.jsx`**

```jsx
import { Link } from 'react-router-dom';

function Nav() {
  return (
    <header className="top-nav">
      <Link to="/" className="logo">Kelvin Joaquin</Link>
      <nav>
        <a href="/#work">Work</a>
        <a href="/#skills">Skills</a>
        <a href="/#experience">Experience</a>
        <a href="/#contact">Contact</a>
      </nav>
    </header>
  );
}

export default Nav;
```

- [ ] **Step 2: Create `frontend/src/components/Footer.jsx`**

```jsx
function Footer() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} Kelvin Joaquin</span>
      <div>
        <a href="mailto:kelvin.joaquin@icloud.com">Email</a>
        <a href="https://www.linkedin.com/in/kelvin-joaquin" target="_blank" rel="noreferrer">LinkedIn</a>
      </div>
    </footer>
  );
}

export default Footer;
```

- [ ] **Step 3: Create `frontend/src/pages/NotFound.jsx`**

```jsx
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';

function NotFound() {
  return (
    <>
      <Nav />
      <main className="not-found">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <Link to="/" className="btn btn-primary">Back to home</Link>
      </main>
    </>
  );
}

export default NotFound;
```

- [ ] **Step 4: Rewrite `frontend/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 5: Verify build and tests**

Run (in `frontend/`): `npm run build && npm test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Nav.jsx frontend/src/components/Footer.jsx frontend/src/pages/NotFound.jsx frontend/src/App.jsx
git commit -m "feat: add router shell with Nav, Footer, and NotFound"
```

---

### Task 6: CaseStudy page template and route

**Files:**
- Create: `frontend/src/pages/CaseStudy.jsx`
- Modify: `frontend/src/App.jsx` (add route)

**Interfaces:**
- Consumes: `caseStudies` (Task 2), `FlowDiagram` (Task 3), `Nav`/`Footer`/`NotFound` (Task 5), case-study classes (Task 4).
- Produces: default export `CaseStudy` (no props; reads `:slug` from the route). Route `/work/:slug` registered in `App`.

- [ ] **Step 1: Create `frontend/src/pages/CaseStudy.jsx`**

```jsx
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import FlowDiagram from '../components/diagrams/FlowDiagram';
import { caseStudies } from '../content/caseStudies';
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

  if (!study) {
    return <NotFound />;
  }

  return (
    <>
      <Nav />
      <article className="case-study">
        <p className="eyebrow">Case Study · {study.kicker}</p>
        <h1>{study.title}</h1>
        <p className="outcome">{study.outcome}</p>

        <div className="context-strip">
          <div>Company<strong>{study.context.company}</strong></div>
          <div>Role<strong>{study.context.role}</strong></div>
          <div>Timeframe<strong>{study.context.timeframe}</strong></div>
          <div>Stack<strong>{study.context.stack}</strong></div>
        </div>

        <h2><span>01</span>The problem</h2>
        {study.problem.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}

        <h2><span>02</span>Architecture</h2>
        <div className="diagram">
          <FlowDiagram {...study.diagram} />
        </div>

        <h2><span>03</span>Key decisions</h2>
        {study.decisions.map((d) => (
          <div className="decision" key={d.title}>
            <h3>{d.title}</h3>
            <p>{d.why}</p>
            <p className="alt">Rejected: {d.rejected}</p>
          </div>
        ))}

        <h2><span>04</span>Results</h2>
        <div className="results">
          {study.results.map((r) => (
            <div className="result" key={r.label}>
              <strong className={r.placeholder ? 'placeholder' : undefined}>{r.value}</strong>
              <span>{r.label}</span>
            </div>
          ))}
        </div>

        <div className="tags">
          {study.tags.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>

        <Link to="/" className="back-link">← All work</Link>
      </article>
      <Footer />
    </>
  );
}

export default CaseStudy;
```

- [ ] **Step 2: Register the route in `frontend/src/App.jsx`**

Add the import and route so the file reads:

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CaseStudy from './pages/CaseStudy';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/work/:slug" element={<CaseStudy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 3: Verify in the dev server**

Run (in `frontend/`): `npm run dev` — then load `http://localhost:3000/work/payments-licensing` and `http://localhost:3000/work/nope`.
Expected: the first renders the full template (context strip, diagram, decisions, results); the second renders the 404 page. Stop the server after checking.

- [ ] **Step 4: Verify build and tests**

Run (in `frontend/`): `npm run build && npm test`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CaseStudy.jsx frontend/src/App.jsx
git commit -m "feat: add case-study page template at /work/:slug"
```

---

### Task 7: Proof-first Home page and CaseStudyCard

**Files:**
- Create: `frontend/src/components/CaseStudyCard.jsx`
- Modify: `frontend/src/pages/Home.jsx` (full rewrite)

**Interfaces:**
- Consumes: `caseStudies` (Task 2), `Nav`/`Footer` (Task 5), home classes (Task 4).
- Produces: default export `CaseStudyCard` taking prop `{ study }` (one element of `caseStudies`); rewritten `Home` (no props).

- [ ] **Step 1: Create `frontend/src/components/CaseStudyCard.jsx`**

```jsx
import { Link } from 'react-router-dom';

function CaseStudyCard({ study }) {
  return (
    <Link to={`/work/${study.slug}`} className="cs-card">
      <span className="kicker">{study.kicker}</span>
      <h3>{study.title}</h3>
      <p>{study.summary}</p>
      <div className="tags">
        {study.tags.slice(0, 3).map((t) => (
          <span key={t} className="tag">{t}</span>
        ))}
      </div>
      <span className="read">Read case study →</span>
    </Link>
  );
}

export default CaseStudyCard;
```

- [ ] **Step 2: Rewrite `frontend/src/pages/Home.jsx`**

Replace the entire file with:

```jsx
import { useEffect } from 'react';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import CaseStudyCard from '../components/CaseStudyCard';
import { caseStudies } from '../content/caseStudies';

const skillDomains = [
  { title: 'APIs & Services', items: ['Node.js', 'PHP', 'REST API design', 'Event-driven systems'] },
  { title: 'Data & Storage', items: ['MySQL', 'Redis', 'Query optimization', 'Schema migrations'] },
  { title: 'Infrastructure & DevOps', items: ['Docker', 'CI/CD pipelines', 'Cloud platforms', 'Kubernetes'] },
  { title: 'Payments & Auth', items: ['Gateway integrations', 'Subscriptions & licensing', 'OAuth / identity', 'PCI-aware design'] },
];

const experience = [
  {
    title: 'Senior Software Developer — SplitmediaLabs',
    meta: '2014 – 2025 · APIs, payments, auth, PHP→Node migrations',
  },
  {
    title: 'Technical Consultant — Cooperative Development Authority',
    meta: '2010 – 2024 · nationwide infrastructure, CI/CD, architecture',
  },
  {
    title: 'Associate Technical Staff — Fujitsu Ten Solutions',
    meta: '2010 – 2014 · internal web apps, embedded C training',
  },
];

function Home() {
  useEffect(() => {
    document.title = 'Kelvin Joaquin — Senior Backend Engineer';
  }, []);

  return (
    <>
      <Nav />
      <main>
        <section className="section hero">
          <p className="eyebrow">Senior Backend Engineer</p>
          <h1>Kelvin Joaquin</h1>
          <p className="positioning">Backend systems for payments, auth, and scale — 10+ years in production.</p>
          <p className="intro">
            I design and run the systems behind global desktop and web products: payment infrastructure,
            licensing, authentication, and the migrations that keep them modern. Below are five of the
            hardest problems I&rsquo;ve solved.
          </p>
          <a href="#work" className="btn btn-primary">See the work</a>
        </section>

        <section id="work" className="section">
          <div className="section-title"><span>01</span><h2>Case Studies</h2></div>
          <div className="cs-grid">
            {caseStudies.map((study) => (
              <CaseStudyCard key={study.slug} study={study} />
            ))}
          </div>
        </section>

        <section id="skills" className="section">
          <div className="section-title"><span>02</span><h2>Skills</h2></div>
          <div className="skills-grid">
            {skillDomains.map((domain) => (
              <div key={domain.title} className="skill-group">
                <h3>{domain.title}</h3>
                <ul>
                  {domain.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="experience" className="section">
          <div className="section-title"><span>03</span><h2>Experience</h2></div>
          <div className="xp">
            {experience.map((role) => (
              <div key={role.title} className="xp-row">
                <div className="xp-dot" />
                <div>
                  <h3>{role.title}</h3>
                  <p className="xp-meta">{role.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="section">
          <div className="section-title"><span>04</span><h2>Get in Touch</h2></div>
          <div className="contact-grid">
            <div className="contact-card">
              <h3>Email</h3>
              <p><a href="mailto:kelvin.joaquin@icloud.com">kelvin.joaquin@icloud.com</a></p>
            </div>
            <div className="contact-card">
              <h3>LinkedIn</h3>
              <p>
                <a href="https://www.linkedin.com/in/kelvin-joaquin" target="_blank" rel="noreferrer">
                  linkedin.com/in/kelvin-joaquin
                </a>
              </p>
            </div>
            <div className="contact-card">
              <h3>Phone</h3>
              <p>(+63) 917-555-0338</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default Home;
```

- [ ] **Step 3: Verify in the dev server**

Run (in `frontend/`): `npm run dev` — load `http://localhost:3000/`.
Expected: hero with positioning line, five case-study cards linking to `/work/<slug>`, four skill groups, three experience rows, contact cards, footer. Card click navigates client-side to the case study. Stop the server after checking.

- [ ] **Step 4: Verify build and tests**

Run (in `frontend/`): `npm run build && npm test`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CaseStudyCard.jsx frontend/src/pages/Home.jsx
git commit -m "feat: rebuild home page proof-first around case studies"
```

---

### Task 8: Page metadata, fonts, docs, and final verification

**Files:**
- Modify: `frontend/index.html`, `README.md`

**Interfaces:**
- Consumes: everything prior.
- Produces: shippable branch.

- [ ] **Step 1: Update `frontend/index.html`**

Replace the entire file with:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kelvin Joaquin — Senior Backend Engineer</title>
    <meta
      name="description"
      content="Senior Backend Engineer — payments, auth, and scale. Case studies from 10+ years of production systems."
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

(Note: this intentionally drops the missing `/vite.svg` favicon reference.)

- [ ] **Step 2: Update `README.md`**

In the **Features** section, replace the single bullet with:

```markdown
- Proof-first landing page: hero, five case-study cards, skills grouped by domain, experience, contact
- Case-study pages at `/work/<slug>` rendered from structured content in `frontend/src/content/caseStudies.js`
- Client-side routing (react-router-dom) with SPA fallback via App Platform's `catchall_document`
```

In the **Project Structure** section, replace the code block with:

```
frontend/        React + Vite source; `dist/` is the published build output
  src/content/   Case-study content (data, validated by vitest)
  src/pages/     Home, CaseStudy, NotFound
  src/components/  Nav, Footer, CaseStudyCard, diagrams/
  src/styles/    base / home / case-study stylesheets
.do/app.yaml     App Platform spec (build, routing, domains)
```

In **Local Development**, add below `npm run preview`:

```markdown
npm test         # content-integrity tests (vitest)
```

- [ ] **Step 3: Full verification**

Run (in `frontend/`): `npm run build && npm test`
Expected: both pass. Also run `npm run preview` and spot-check `/`, `/work/php-to-node`, and a bad slug.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html README.md
git commit -m "feat: page metadata, web fonts, and README for redesign"
```

---

## After all tasks

Merge is a user decision: present the branch, offer to merge to `main` (which triggers the App Platform deploy via GitHub Actions) or open a PR. Remind the user that `[metric needed]` placeholders in `frontend/src/content/caseStudies.js` await their real numbers before the site should go live.
