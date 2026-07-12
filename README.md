# Professional Website

A full-stack web application with React frontend, Node.js backend API, worker service, RabbitMQ, PostgreSQL, and Stripe integration.

## Features

- Landing page with professional details
- Natural-language-to-SQL demo querying a Postgres database
- Basic login check against a users table
- Subscription plans and signup via Stripe

## Deployment

### Manual Deployment via GitHub Actions (DigitalOcean Kubernetes)

The application deploys to a DigitalOcean Kubernetes (DOKS) cluster in the
`portfolio` namespace. Images are built in CI, pushed to DigitalOcean
Container Registry (DOCR), and rolled out with `kubectl`. No SSH access to
any server is required.

#### Prerequisites (one-time)

- A DOKS cluster, a DOCR registry, and a DO Managed Postgres database
- The one-time cluster setup in [docs/k8s-setup.md](docs/k8s-setup.md)
  (ingress-nginx, cert-manager, DNS, database firewall)
- Kubernetes manifests live in `k8s/`

#### GitHub Configuration

Repository **variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose | Example |
|---|---|---|
| `DOCR_REGISTRY` | DOCR registry name | `my-registry` |
| `CLUSTER_NAME` | DOKS cluster name | `portfolio-cluster` |
| `FRONTEND_ORIGIN` | Public origin of the frontend (CORS). Must be the EXACT origin — scheme + domain, no trailing slash — or every browser API call fails CORS | `https://example.com` |

Repository **secrets**:

| Secret | Purpose |
|---|---|
| `DIGITALOCEAN_ACCESS_TOKEN` | DO API token with registry + kubernetes scopes |
| `DATABASE_URL` | Managed Postgres URI, must end `?sslmode=no-verify` |
| `REDIS_URL` | `redis://redis:6379` |
| `RABBITMQ_URL` | `amqp://<user>:<pass>@rabbitmq:5672` |
| `RABBITMQ_DEFAULT_USER` | RabbitMQ username |
| `RABBITMQ_DEFAULT_PASS` | RabbitMQ password |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (also baked into frontend build) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `GPT_API_KEY` | LLM inference API key |

The old `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `SSH_USER`, `SSH_HOST`, and
`ENV_FILE` secrets are no longer used — delete them.

#### Deployment Process

1. Go to the **Actions** tab → **Deploy to DOKS** → **Run workflow**

The workflow builds and pushes all three images (tagged with the commit SHA),
refreshes the registry pull secret and app Secret/ConfigMap, applies `k8s/`,
waits for the `db-init` job, rolls the deployments to the new tag, and waits
for rollout completion.

#### Data Persistence

- **PostgreSQL**: DO Managed Postgres (automated backups, external to cluster)
- **Redis / RabbitMQ**: ephemeral (emptyDir) — data does not survive pod
  restarts. Redis holds only self-expiring daily token counters; the monthly
  hard limit lives in Postgres.

### Local Development

1. Ensure Docker and Docker Compose are installed.

2. Clone the repository.

3. Run `docker compose up --build` to start all services.

4. Access the app at http://localhost

5. Backend API at http://localhost/api

6. RabbitMQ management at http://localhost:15672 (user: user, pass: password)

## Services

- **Frontend**: React app with Vite, served via Nginx
- **Backend**: Node.js Express API with Stripe
- **Worker**: Processes payment messages from RabbitMQ
- **PostgreSQL**: DO Managed Postgres (production) / container (local dev)
- **RabbitMQ**: Message queue
- **Nginx**: ingress-nginx (production) / Nginx container (local dev)

## API Endpoints

- GET /api/health
- POST /api/query — natural-language-to-SQL demo (read-only, restricted to `contacts`/`payments`)
- POST /api/auth — login check against the `users` table
- GET /api/plans — available Stripe subscription plans
- POST /api/subscribe — create a Stripe customer and subscription