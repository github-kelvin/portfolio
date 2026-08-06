# Professional Website

A static portfolio site built with React and Vite, hosted on DigitalOcean App
Platform's static site tier.

## Features

- Proof-first landing page: hero, five case-study cards, skills grouped by domain, experience, contact
- Case-study pages at `/work/<slug>` rendered from structured content in `frontend/src/content/caseStudies.js`
- Client-side routing (react-router-dom) with SPA fallback via App Platform's `catchall_document`

## Local Development

```bash
cd frontend
npm install
npm run dev      # dev server with hot reload
npm run build    # production build into frontend/dist
npm run preview  # serve the production build locally
npm test         # content-integrity tests (vitest)
```

## Deployment

The site deploys to DigitalOcean App Platform (app spec: [.do/app.yaml](.do/app.yaml)),
serving `crvn.online`.

Pushing to `main` triggers [.github/workflows/deploy-static.yml](.github/workflows/deploy-static.yml),
which calls `doctl apps create-deployment` — App Platform then clones the repo,
runs `npm run build` in `frontend/`, and publishes `frontend/dist`. You can also
run the workflow manually from the **Actions** tab, or deploy directly:

```bash
doctl apps create-deployment <APP_ID> --wait
```

### Configuration

| Name | Kind | Purpose |
|---|---|---|
| `DIGITALOCEAN_ACCESS_TOKEN` | secret | DO API token used to trigger deployments |
| `APP_ID` | variable | App Platform application ID |

Applying changes to the app spec itself (domains, build settings):

```bash
doctl apps update <APP_ID> --spec .do/app.yaml
```

## Project Structure

```
frontend/        React + Vite source; `dist/` is the published build output
  src/content/   Case-study content (data, validated by vitest)
  src/pages/     Home, CaseStudy, NotFound
  src/components/  Nav, Footer, CaseStudyCard, diagrams/
  src/styles/    base / home / case-study stylesheets
.do/app.yaml     App Platform spec (build, routing, domains)
```

## History

This started as a full-stack application (Express API, RabbitMQ worker,
PostgreSQL, Redis) deployed to Kubernetes. The backend existed solely to power
a natural-language-to-SQL demo page; removing that page removed the need for
any server, so the project is now a static site. The previous backend, worker,
and Kubernetes manifests remain available in the git history.
