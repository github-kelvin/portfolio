# Bloomgate case study + placeholder cleanup — design

**Date:** 2026-08-27
**Status:** approved (pending spec review)

## Context

The site's case-study redesign (10 commits: `ffff0d7`..`f49a550`) is committed on local
`main` but was never pushed, so `crvn.online` still serves the pre-redesign single-page
site. Verified against the live bundle: it contains `About Me` / `Professional Portfolio`
and no router, and the live `<title>` is `Professional Website`. `/work/<slug>` returns
200 only because App Platform's `catchall_document` serves `index.html`.

Deploys trigger on push to `main` (`.github/workflows/deploy-static.yml`). Shipping is
therefore a push, not a build.

## Goal

1. Add **Bloomgate** as a sixth case study.
2. Remove the ten `[metric needed]` placeholder result tiles from the existing five.
3. Push, so the whole redesign plus Bloomgate goes live in one deploy.

## Decisions taken

**No separate "Projects" section.** The original request was a Projects section covering
XSplit and Bloomgate. Investigation showed XSplit already occupies four of the five case
studies, so a Projects section would have restated existing content. Bloomgate instead
joins the case studies as a peer. XSplit needs no new surface — it already has four.

**Bloomgate is framed as an engineering story with a single link to the live product.**
No revenue, user-count, or traction claims. Nothing on the page requires substantiation
beyond what the repository and the live site already show.

**Placeholders are cut, not filled.** Each existing study keeps its one verified figure
and loses its two `[metric needed]` tiles. No numbers are invented. Real figures can be
added later; `caseStudies.js`'s standing comment against inventing metrics still holds.

## Content: the Bloomgate study

The narrative is that the system was **built distributed and then deliberately
un-distributed**. Five deployables over RabbitMQ on DOKS with a managed Postgres were
consolidated into one backend on a single droplet; RabbitMQ was replaced by pg-boss;
DOKS, the managed database, and the container registry were decommissioned after a
rehearsed cutover.

This is the deliberate counterpoint to the existing `monolith-to-events` study. One goes
monolith → events, this one goes events → monolith. Together they show topology chosen
from constraints rather than from fashion.

All facts below are sourced from `tgmanager/docs/PROJECT_CONTEXT.md`, `CLAUDE.md`, and
the repo's git history — none are inferred.

| Field | Value |
|---|---|
| `slug` | `bloomgate` |
| `kicker` | `Bloomgate · Own product` |
| `link` | `https://bloomgate.app` (new field, see below) |
| `context.company` | Bloomgate (independent product) |
| `context.role` | Founder & sole engineer |
| `context.timeframe` | Jun 2026 – present |
| `context.stack` | Node.js · TypeScript · Prisma · PostgreSQL · pg-boss |

**Problem** — a solo-run SaaS carrying an architecture sized for a team: five deployables,
a message broker, a managed Kubernetes cluster, and a managed database, for a workload one
process could serve. Every incident meant reasoning across service boundaries that existed
for organizational reasons that did not apply.

**Decisions** (each with the rejected alternative, matching the existing format):

1. *Consolidate services before optimizing any of them* — merging four `packages/*`
   services into `backend` removed the network hops and partial-failure modes rather than
   tuning them. Rejected: tuning the distributed system in place — optimizing a topology
   that shouldn't exist.
2. *pg-boss over RabbitMQ* — a Postgres-backed queue enqueues jobs inside the caller's own
   Prisma transaction via `fromPrisma(tx)`, which deleted the outbox table *and* its 2s
   relay poller. Rejected: keeping RabbitMQ plus the outbox — a second datastore and a
   bespoke relay to paper over the fact that a broker publish can't join a DB transaction.
3. *Rehearse the cutover, verify the dump, then delete* — the data path was rehearsed
   against a scratch database and a `pg_dump -Fc` was checksum- and `pg_restore --list`-
   verified before any managed service was destroyed. Rejected: cutting over live and
   keeping the old stack as a fallback — pays for both and rehearses neither.

**Results** — three verified figures, no placeholders:

- `5 → 1` services in production
- `Zero` data loss at cutover
- `3` managed services decommissioned (DOKS, managed Postgres, container registry)

**Tags** — `Node.js`, `TypeScript`, `PostgreSQL`, `pg-boss`, `Prisma`

**Diagram** — the current consolidated topology, consistent with the other five studies
(each shows one architecture, not a before/after). `FlowDiagram` supports only flat
nodes and unlabeled edges, so before/after would need component changes that this work
doesn't justify; the reversal is carried by the decisions text. Nodes: frontend SPA and
Telegram webhook on the left, `backend` (Express + Prisma, accent) centre, Postgres and
the pg-boss worker/cron on the right.

## Code changes

**`frontend/src/content/caseStudies.js`** — two changes: append the sixth entry (the only
one carrying a `link` field), and delete the ten `{ ..., placeholder: true }` result
entries from the existing five studies, each of which keeps its one verified figure.

**`frontend/src/pages/CaseStudy.jsx`** — render `study.link` when present, as a single
"Visit <host> →" anchor after the outcome line, `target="_blank" rel="noreferrer"`.
Conditional, so the other five are untouched.

**`frontend/src/styles/case-study.css`** — style the new link. Remove the now-dead
`.result strong.placeholder` rule.

**`frontend/src/content/caseStudies.test.js`** — update `has exactly five studies` to six.
Add two assertions: no result carries `placeholder: true`, and any `link` present is a
valid `https://` URL.

No changes to `Home.jsx` — it maps over `caseStudies`, so Bloomgate appears in the list
automatically. No new routes; `/work/bloomgate` is served by the existing `/work/:slug`.

## Verification

- `npm test` in `frontend/` — all suites pass, including the updated count and the two new
  assertions.
- `npm run build` succeeds.
- Locally: `/work/bloomgate` renders with diagram and working outbound link; the home list
  shows six rows; no `[metric needed]` appears anywhere in the built output
  (`grep -r "metric needed" dist/` returns nothing).

## Deploy

Push `main`, which triggers `deploy-static.yml`. Then confirm against the live site that
the title is `Kelvin Joaquin — Senior Backend Engineer`, that `/work/bloomgate` renders the
case study rather than the old homepage, and that the old `About Me` markers are gone.

## Out of scope

- Supplying real numbers for the ten removed metrics.
- A Projects section (superseded — see Decisions taken).
- Any redesign of the existing five studies beyond deleting placeholder tiles.
