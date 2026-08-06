# Backend-Proof Portfolio Redesign — Design

**Date:** 2026-08-06
**Status:** Approved (brainstormed interactively; prototyped in Claude Design project "Portfolio Redesign", `734c2c8d-4477-4e9a-82f1-eddde2c83971`)

## Goal & positioning

Reposition crvn.online from a résumé-style page ("I am a backend engineer") to a
proof-driven portfolio ("here are five hard backend problems I solved"). It serves
recruiters and consulting clients equally: scannable cards for the 30-second skim,
full case studies for anyone evaluating depth. The site stays fully static on
DigitalOcean App Platform — no live backend.

## Information architecture

- `/` — Home, proof-first order: hero → case-study grid (5 cards) → skills grouped
  by domain → compact experience timeline → contact.
- `/work/<slug>` — one page per case study:
  - `payments-licensing` — XSplit payments & licensing
  - `auth-at-scale` — XSplit authentication systems
  - `php-to-node` — legacy PHP → Node.js migration
  - `monolith-to-events` — XSplit monolith → event-driven microservices
  - `cda-infrastructure` — CDA nationwide infrastructure & CI/CD
- Routing via `react-router-dom` (reintroduced). `.do/app.yaml` already has
  `catchall_document: index.html`, so deep links work with zero infra changes.
  Unknown slugs render a small NotFound page linking home.

## Case-study page template

Every study follows the same structure:

1. **Title + outcome line** — one sentence stating what was achieved.
2. **Context strip** — company, role, timeframe, scale, stack tags (monospace).
3. **The problem** — what was broken or needed, and why it was hard.
4. **Architecture** — a dark-theme inline SVG diagram of the system (before/after
   where relevant).
5. **Key decisions & trade-offs** — 3–5 decisions with the why, the rejected
   alternative, and the consequence. The strongest senior signal.
6. **Results** — outcomes with metrics; `[metric needed]` placeholders mark spots
   for real numbers the author fills in later.

## Content model

Case studies live as data, not markup: `src/content/caseStudies.js` exports an
array of structured objects (slug, title, outcome, context, problem, decisions,
results, tags, diagram component reference). One shared `CaseStudy.jsx` template
renders any of them; home cards derive from the same data. Diagrams are small
hand-authored SVG components in `src/components/diagrams/`.

## Component structure

```
frontend/src/
  content/caseStudies.js      # all 5 studies as data
  pages/Home.jsx              # reorganized proof-first
  pages/CaseStudy.jsx         # shared template, slug-driven
  pages/NotFound.jsx
  components/
    Nav.jsx, Footer.jsx       # shared across pages
    CaseStudyCard.jsx
    diagrams/*.jsx            # one SVG per study
  styles/                     # index.css split: base, home, case-study
```

## Visual direction

Evolve the existing dark theme: keep the `#080b14` base and Inter; add a monospace
accent (JetBrains Mono / ui-monospace stack) for labels, tags, eyebrows, section
numbers, and context strips. Glass cards (rgba-white 3–6% fills, 8% borders,
20–24px radii), warm orange accent gradient (#f29111 → #f2c24f) used sparingly for
CTAs and emphasis. Skills become four domain groups (APIs & Services, Data &
Storage, Infrastructure & DevOps, Payments & Auth) instead of ten flat chips. The
long about-paragraph is cut to 2–3 sentences in the hero; the standalone About
section is removed — case studies carry that weight.

Reference mockups live in the Claude Design project (HomePage, CaseStudyPage,
CaseStudyCard, SkillsDomains).

## Error handling & testing

- NotFound page for unknown `/work/<slug>`.
- A small vitest suite validating content integrity: every study has required
  fields, slugs are unique, every diagram reference resolves.
- `npm run build` as the release gate. No E2E.

## Content sourcing

Case-study drafts are written from the existing résumé/site content; spots needing
real metrics are marked `[metric needed]` for the author to fill in. Drafts must
not invent specific numbers.
