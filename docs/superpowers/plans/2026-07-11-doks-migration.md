# DigitalOcean Kubernetes Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> On approval, copy this plan to `docs/superpowers/plans/2026-07-11-doks-migration.md` in the repo (Task 0).

**Goal:** Migrate the portfolio app from Docker Compose on a droplet to a DigitalOcean Kubernetes (DOKS) cluster in a dedicated `portfolio` namespace, deployed directly from GitHub Actions.

**Architecture:** Backend, worker, frontend, Redis, and RabbitMQ all run as Deployments — Redis/RabbitMQ on ephemeral emptyDir storage (data loss on restart accepted by user; no block-storage volumes); Postgres moves to DO Managed Postgres (external). ingress-nginx runs with `hostNetwork: true` binding 80/443 directly on the single node (NO DO Load Balancer — saves ~$12/mo; DNS points at the node's public IP), routing `/` → frontend and `/api` → backend with cert-manager/Let's Encrypt TLS. GitHub Actions builds images to DOCR and applies raw manifests with kubectl — replacing the SSH/compose deploy entirely.

**Tech Stack:** DOKS, DOCR, DO Managed Postgres, ingress-nginx v1.13.0, cert-manager v1.18.2, kubectl + raw YAML (no Helm/Kustomize), GitHub Actions + doctl.

## Global Constraints

- Namespace: `portfolio`; every resource labeled `app.kubernetes.io/part-of: portfolio`
- Deploy: kubectl + raw manifests in `k8s/` — no Helm, no Kustomize; workflow trigger stays `workflow_dispatch`
- Images: `registry.digitalocean.com/<DOCR_REGISTRY>/portfolio-{backend,worker,frontend}`, tagged `<git-sha>` + `latest`; manifests pin `:latest`, CI overrides via `kubectl set image`
- Container name inside each Deployment == Deployment name (`backend`, `worker`, `frontend`)
- Postgres: DO Managed (external); DATABASE_URL uses `?sslmode=no-verify` (node-postgres); db-init Job rewrites it to `sslmode=require` for psql/libpq
- NO DO Load Balancer: single-node cluster; ingress-nginx uses `hostNetwork: true` (baremetal manifest + patch), DNS A record → node public IP. CAVEAT: node recycle/upgrade changes the IP — keep cluster auto-upgrade OFF and re-point DNS after any node replacement
- Frontend: in-cluster nginx Deployment (DO Spaces evaluated and rejected: cluster required regardless for backend/worker/queues; Spaces adds $5/mo + apex-CNAME + SPA-404 problems while a frontend pod is ~free)
- Two one-time substitution placeholders committed then sed-replaced once with real values before first deploy: `portfolio.example.com` (PORTFOLIO_DOMAIN) and `DOCR_REGISTRY_PLACEHOLDER`
- Existing infra assumed: DOKS cluster, DOCR registry, Managed Postgres already provisioned
- Secret `portfolio-secrets` + ConfigMap `portfolio-config` created by CI only — never as manifests in `k8s/`
- ACME email: kelvin.joaquin@icloud.com
- `docker-compose.local.yml` / local compose flow stays untouched for local dev

## Architecture Overview Diagram

```mermaid
flowchart TB
    subgraph Internet
        U[User Browser]
        GH[GitHub Actions<br/>workflow_dispatch]
        LE[Let's Encrypt ACME]
    end

    subgraph DO[DigitalOcean]
        DOCR[(DO Container Registry<br/>portfolio-backend / -worker / -frontend)]
        PG[(DO Managed Postgres<br/>trusted source: cluster only)]

        subgraph DOKS[DOKS Cluster — single node]
            subgraph ns_ingress[ns: ingress-nginx]
                IC[ingress-nginx controller v1.13.0<br/>hostNetwork :80/:443 on node public IP]
            end
            subgraph ns_cm[ns: cert-manager]
                CM[cert-manager v1.18.2<br/>ClusterIssuer letsencrypt-prod]
            end
            subgraph ns_portfolio[ns: portfolio]
                ING[Ingress portfolio<br/>TLS secret: portfolio-tls]
                FE[Deployment frontend<br/>nginx static :80]
                BE[Deployment backend<br/>Express :3001]
                WK[Deployment worker]
                RD[(Deployment redis :6379<br/>emptyDir · ephemeral)]
                MQ[(Deployment rabbitmq :5672<br/>emptyDir · ephemeral)]
                SEC[Secret portfolio-secrets<br/>ConfigMap portfolio-config<br/>· created by CI]
                JOB[Job db-init<br/>psql schema/seed + sentinel]
            end
        end
    end

    U -->|https://PORTFOLIO_DOMAIN<br/>DNS A → node public IP| IC --> ING
    ING -->|/| FE
    ING -->|/api| BE
    BE --> RD
    BE --> PG
    WK --> MQ
    WK --> PG
    JOB --> PG
    CM <-->|HTTP-01| LE
    CM -->|issues portfolio-tls| ING
    GH -->|docker push| DOCR
    GH -->|doctl kubeconfig + kubectl| DOKS
    DOCR -->|pull secret on default SA| ns_portfolio
    SEC -.->|envFrom| BE & WK & MQ & JOB
```

## Decisions Log (locked with user)

| Decision | Choice |
|---|---|
| Stateful services | DO Managed Postgres; Redis + RabbitMQ in-cluster as ephemeral Deployments (emptyDir — user accepts data loss; no block storage) |
| Ingress | ingress-nginx hostNetwork on the single node — NO DO LB (user decision: LB unjustified on one node; accepts ephemeral node IP caveat), replaces droplet nginx reverse proxy |
| Deploy tooling | kubectl + raw manifests from `k8s/` |
| Registry/TLS | DOCR images; cert-manager + Let's Encrypt |
| Frontend hosting | In-cluster (Spaces rejected on cost/DNS/SPA grounds) |
| Provisioning | Cluster/DOCR/Managed-PG assumed to exist |
| Domain | Apex domain; `portfolio.example.com` placeholder until finalized |

## Interface Reconciliation (conflicts resolved during merge)

1. **`portfolio-config` owner = CI workflow, NOT `k8s/`** — apply of a committed manifest would clobber the live value with a placeholder. No `k8s/configmap.yaml` exists.
2. **Placeholders substituted once, real values committed** — CI applies `k8s/` every deploy, so `k8s/ingress.yaml` must hold the real domain in git. GitHub var `FRONTEND_ORIGIN` = `https://<same domain>`; keep in sync.
3. **ClusterIssuer lives in `k8s/`, applied by CI** — valid only after one-time cert-manager install (`docs/k8s-setup.md` runs first).
4. **`DATABASE_URL` uses `?sslmode=no-verify`** (pg ^8.11 vs DO private CA; `require` crashes node-postgres with SELF_SIGNED_CERT_IN_CHAIN). db-init Job internally rewrites to `sslmode=require` because libpq rejects `no-verify`.
5. **Job name `db-init`** — CI deletes it before every apply (Jobs immutable), then waits for completion before rolling app images.
6. **Container name == Deployment name** — required by CI's `kubectl set image`.
7. **NetworkPolicies**: skipped this migration (YAGNI; backend is ClusterIP-only). Revisit later.
8. **Sentinel table `db_init_done`** in managed PG gates the non-idempotent SQL (plain `CREATE TABLE`, unguarded seed INSERTs, `contacts` has no unique constraint) — ConfigMap SQL stays byte-identical to `backend/sql/`.

## File Map

| File | Action | Owner task |
|---|---|---|
| `docs/superpowers/plans/2026-07-11-doks-migration.md` | Create (copy of this plan) | 0 |
| `docs/k8s-setup.md` | Create — one-time cluster setup runbook | 1 |
| `k8s/namespace.yaml` | Create | 2 |
| `k8s/backend.yaml` | Create | 3 |
| `k8s/worker.yaml` | Create | 4 |
| `k8s/frontend.yaml` | Create | 5 |
| `k8s/redis.yaml` | Create | 6 |
| `k8s/rabbitmq.yaml` | Create | 7 |
| `k8s/db-init-job.yaml` | Create | 8 |
| `k8s/cluster-issuer.yaml` | Create | 9 |
| `k8s/ingress.yaml` | Create | 10 |
| `.github/workflows/deploy-k8s.yml` | Create | 11 |
| `.github/workflows/deploy-services.yml` | Delete | 11 |
| `README.md` | Modify deployment section | 12 |

---

## Tasks

### Task 0: Save plan into repo

- [ ] `mkdir -p docs/superpowers/plans && cp <this plan file> docs/superpowers/plans/2026-07-11-doks-migration.md`
- [ ] `git add docs/superpowers/plans/2026-07-11-doks-migration.md && git commit -m "docs: add DOKS migration plan"`

### Task 1: One-time cluster setup runbook — `docs/k8s-setup.md`

**Files:** Create: `docs/k8s-setup.md`

This file documents commands run ONCE by an operator against the cluster (they are not part of CI). Full content:

````markdown
# One-Time DOKS Cluster Setup

Run these once, in order, before the first "Deploy to DOKS" workflow run.
Prereqs: `doctl` authenticated (`doctl auth init`), kubeconfig saved
(`doctl kubernetes cluster kubeconfig save <CLUSTER_NAME>`).

## 0. Substitute placeholders (once, then commit)

```bash
# macOS sed; on Linux drop the ''
sed -i '' 's/portfolio\.example\.com/<REAL_DOMAIN>/g' k8s/ingress.yaml docs/k8s-setup.md
sed -i '' 's/DOCR_REGISTRY_PLACEHOLDER/<REAL_DOCR_REGISTRY>/g' k8s/*.yaml
git add -A && git commit -m "chore: set real domain and registry in k8s manifests"
```

## 1. Install ingress-nginx v1.13.0 (hostNetwork, NO load balancer)

Single-node cluster: instead of a DO Load Balancer (~$12/mo), the controller
binds ports 80/443 directly on the node via hostNetwork. This also avoids the
DO PROXY-protocol hairpin problem entirely (no LB, no PROXY protocol).

```bash
curl -sI https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.0/deploy/static/provider/baremetal/deploy.yaml | head -1   # expect HTTP 200
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.0/deploy/static/provider/baremetal/deploy.yaml

# Patch the controller onto the host network so it serves 80/443 on the node
# public IP (only one controller replica can run per node — fine at 1 node):
kubectl -n ingress-nginx patch deployment ingress-nginx-controller --type=json -p='[
  {"op":"add","path":"/spec/template/spec/hostNetwork","value":true},
  {"op":"replace","path":"/spec/template/spec/dnsPolicy","value":"ClusterFirstWithHostNet"}
]'
kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=180s

# Node public IP (this is what DNS will point at):
kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}'
```

## 2. DNS (node IP — read the caveat)

Create an apex A record → the node public IP from step 1 (TTL 300).
DigitalOcean DNS: `doctl compute domain records create <domain> --record-type A --record-name @ --record-data <NODE_IP> --record-ttl 300`
Verify before proceeding: `dig +short portfolio.example.com A` → node IP (also via `@1.1.1.1`).

**CAVEAT — ephemeral node IP:** DOKS node public IPs change when a node is
recycled or the pool is upgraded. Keep cluster **auto-upgrade OFF** (Control
Panel → cluster → Settings, or `doctl kubernetes cluster update <name>
--auto-upgrade=false`) and re-run step 1's node-IP command + update the A
record after any node replacement. If this operational burden ever outweighs
$12/mo, switch to the DO-provider overlay and a Load Balancer.

## 3. Install cert-manager v1.18.2

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.18.2/cert-manager.yaml
kubectl wait --namespace cert-manager --for=condition=Available deployment \
  cert-manager cert-manager-webhook cert-manager-cainjector --timeout=180s
```

## 4. Managed Postgres wiring

DATABASE_URL format for the GitHub secret (note `sslmode=no-verify` — the
node-postgres value; doctl emits `require`, substitute it):

```
postgresql://doadmin:<PASSWORD>@<host>.db.ondigitalocean.com:25060/defaultdb?sslmode=no-verify
```

Use the direct port 25060 (not the 25061 PgBouncer pool) for this migration.
Restrict trusted sources to the cluster:

```bash
doctl kubernetes cluster list --format ID,Name     # note <CLUSTER_UUID>
doctl databases list --format ID,Name              # note <DB_ID>
doctl databases firewalls replace <DB_ID> --rule k8s:<CLUSTER_UUID>
doctl databases firewalls list <DB_ID>             # verify single k8s rule
```

Follow-up hardening (post-migration, optional): mount DO's CA cert and set
NODE_EXTRA_CA_CERTS, then switch to sslmode=require for full verification.

## 5. Certificate rehearsal (optional, avoids LE prod rate limits)

Apply `k8s/ingress.yaml` once with annotation value `letsencrypt-staging`,
wait for `kubectl get certificate -n portfolio` READY=True, then switch back
to `letsencrypt-prod` and `kubectl delete secret portfolio-tls -n portfolio`.

## Troubleshooting

- Certificate stuck: `kubectl get challenges -n portfolio` — pending usually
  means DNS (step 2) not propagated, or the node IP changed since the A
  record was created.
- Pods in CreateContainerConfigError: `portfolio-secrets`/`portfolio-config`
  don't exist yet — run the deploy workflow, which creates them first.
````

- [ ] Write the file with the content above
- [ ] Verify: `python3 -c "print(open('docs/k8s-setup.md').read().count('kubectl'))"` → non-zero; visual read-through
- [ ] Commit: `git add docs/k8s-setup.md && git commit -m "docs: add one-time DOKS cluster setup runbook"`

### Task 2: `k8s/namespace.yaml`

**Files:** Create: `k8s/namespace.yaml`

- [ ] Write:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: portfolio
  labels:
    app.kubernetes.io/name: portfolio
    app.kubernetes.io/part-of: portfolio
```

- [ ] Verify: `kubectl apply --dry-run=client -f k8s/namespace.yaml` → `namespace/portfolio created (dry run)`
- [ ] Commit: `git add k8s/namespace.yaml && git commit -m "feat(k8s): add portfolio namespace"`

### Task 3: `k8s/backend.yaml`

**Files:** Create: `k8s/backend.yaml`
**Interfaces:** Produces Service `backend:3001` (consumed by Ingress, Task 10); Deployment/container name `backend` (consumed by CI `kubectl set image`, Task 11). Consumes Secret `portfolio-secrets` + ConfigMap `portfolio-config` (created by CI).

- [ ] Write:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: portfolio
  labels:
    app.kubernetes.io/name: backend
    app.kubernetes.io/part-of: portfolio
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: backend
  template:
    metadata:
      labels:
        app.kubernetes.io/name: backend
        app.kubernetes.io/part-of: portfolio
    spec:
      containers:
        - name: backend
          image: registry.digitalocean.com/DOCR_REGISTRY_PLACEHOLDER/portfolio-backend:latest
          ports:
            - name: http
              containerPort: 3001
          envFrom:
            - secretRef:
                name: portfolio-secrets
            - configMapRef:
                name: portfolio-config
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3001
            initialDelaySeconds: 15
            periodSeconds: 20
            timeoutSeconds: 3
            failureThreshold: 3
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 250m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: portfolio
  labels:
    app.kubernetes.io/name: backend
    app.kubernetes.io/part-of: portfolio
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: backend
  ports:
    - name: http
      port: 3001
      targetPort: 3001
```

- [ ] Verify: `kubectl apply --dry-run=client -f k8s/backend.yaml` → `deployment.apps/backend created (dry run)` + `service/backend created (dry run)`
- [ ] Commit: `git add k8s/backend.yaml && git commit -m "feat(k8s): add backend deployment and service"`

### Task 4: `k8s/worker.yaml`

**Files:** Create: `k8s/worker.yaml`
**Interfaces:** Deployment/container name `worker` (CI). Consumes `portfolio-secrets` only. No liveness probe: `npm start` → node is PID 1; a crash exits the container and kubelet restarts it — a probe adds no coverage.

- [ ] Write:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
  namespace: portfolio
  labels:
    app.kubernetes.io/name: worker
    app.kubernetes.io/part-of: portfolio
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: worker
  template:
    metadata:
      labels:
        app.kubernetes.io/name: worker
        app.kubernetes.io/part-of: portfolio
    spec:
      containers:
        - name: worker
          image: registry.digitalocean.com/DOCR_REGISTRY_PLACEHOLDER/portfolio-worker:latest
          envFrom:
            - secretRef:
                name: portfolio-secrets
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 192Mi
```

- [ ] Verify: `kubectl apply --dry-run=client -f k8s/worker.yaml` → `deployment.apps/worker created (dry run)`
- [ ] Commit: `git add k8s/worker.yaml && git commit -m "feat(k8s): add worker deployment"`

### Task 5: `k8s/frontend.yaml`

**Files:** Create: `k8s/frontend.yaml`
**Interfaces:** Produces Service `frontend:80` (Ingress). Deployment/container name `frontend` (CI). No env needed — Stripe publishable key is baked at image build.

- [ ] Write:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: portfolio
  labels:
    app.kubernetes.io/name: frontend
    app.kubernetes.io/part-of: portfolio
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: frontend
  template:
    metadata:
      labels:
        app.kubernetes.io/name: frontend
        app.kubernetes.io/part-of: portfolio
    spec:
      containers:
        - name: frontend
          image: registry.digitalocean.com/DOCR_REGISTRY_PLACEHOLDER/portfolio-frontend:latest
          ports:
            - name: http
              containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 10
            timeoutSeconds: 3
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 20
            timeoutSeconds: 3
          resources:
            requests:
              cpu: 25m
              memory: 32Mi
            limits:
              cpu: 100m
              memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: portfolio
  labels:
    app.kubernetes.io/name: frontend
    app.kubernetes.io/part-of: portfolio
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: frontend
  ports:
    - name: http
      port: 80
      targetPort: 80
```

- [ ] Verify: `kubectl apply --dry-run=client -f k8s/frontend.yaml` → both `created (dry run)`
- [ ] Commit: `git add k8s/frontend.yaml && git commit -m "feat(k8s): add frontend deployment and service"`

### Task 6: `k8s/redis.yaml`

**Files:** Create: `k8s/redis.yaml`
**Interfaces:** Service `redis:6379` — REDIS_URL secret value is `redis://redis:6379`.
Ephemeral by user decision: plain Deployment, emptyDir for `/data`, no AOF flag (compose's `--appendonly yes` dropped — persistence is pointless on ephemeral storage). Data loss on pod restart accepted: Redis holds only the daily token counters, which self-expire in 24h anyway; the monthly hard limit lives in Postgres.

- [ ] Write:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: portfolio
  labels:
    app.kubernetes.io/name: redis
    app.kubernetes.io/part-of: portfolio
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: redis
  ports:
    - name: redis
      port: 6379
      targetPort: 6379
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: portfolio
  labels:
    app.kubernetes.io/name: redis
    app.kubernetes.io/part-of: portfolio
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: redis
  template:
    metadata:
      labels:
        app.kubernetes.io/name: redis
        app.kubernetes.io/part-of: portfolio
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - name: redis
              containerPort: 6379
          volumeMounts:
            - name: redis-data
              mountPath: /data
          readinessProbe:
            exec:
              command: ["redis-cli", "ping"]
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
          livenessProbe:
            exec:
              command: ["redis-cli", "ping"]
            initialDelaySeconds: 15
            periodSeconds: 20
            timeoutSeconds: 3
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 256Mi
      volumes:
        - name: redis-data
          emptyDir: {}
```

- [ ] Verify: `kubectl apply --dry-run=client -f k8s/redis.yaml` → `service/redis` + `deployment.apps/redis` `created (dry run)`
- [ ] Commit: `git add k8s/redis.yaml && git commit -m "feat(k8s): add ephemeral redis deployment"`

### Task 7: `k8s/rabbitmq.yaml`

**Files:** Create: `k8s/rabbitmq.yaml`
**Interfaces:** Service `rabbitmq:5672` — RABBITMQ_URL secret value is `amqp://<user>:<pass>@rabbitmq:5672`. Management UI ClusterIP-only (debug via `kubectl port-forward svc/rabbitmq 15672:15672 -n portfolio`).
Ephemeral by user decision: plain Deployment, emptyDir for `/var/lib/rabbitmq`. In-flight queue messages are lost on pod restart — accepted (the `payment_queue` currently has no producer; worker is a consumer only).

- [ ] Write:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq
  namespace: portfolio
  labels:
    app.kubernetes.io/name: rabbitmq
    app.kubernetes.io/part-of: portfolio
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: rabbitmq
  ports:
    - name: amqp
      port: 5672
      targetPort: 5672
    - name: management
      port: 15672
      targetPort: 15672
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
  namespace: portfolio
  labels:
    app.kubernetes.io/name: rabbitmq
    app.kubernetes.io/part-of: portfolio
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app.kubernetes.io/name: rabbitmq
  template:
    metadata:
      labels:
        app.kubernetes.io/name: rabbitmq
        app.kubernetes.io/part-of: portfolio
    spec:
      containers:
        - name: rabbitmq
          image: rabbitmq:3-management
          env:
            - name: RABBITMQ_DEFAULT_USER
              valueFrom:
                secretKeyRef:
                  name: portfolio-secrets
                  key: RABBITMQ_DEFAULT_USER
            - name: RABBITMQ_DEFAULT_PASS
              valueFrom:
                secretKeyRef:
                  name: portfolio-secrets
                  key: RABBITMQ_DEFAULT_PASS
          ports:
            - name: amqp
              containerPort: 5672
            - name: management
              containerPort: 15672
          volumeMounts:
            - name: rabbitmq-data
              mountPath: /var/lib/rabbitmq
          readinessProbe:
            exec:
              command: ["rabbitmq-diagnostics", "-q", "ping"]
            initialDelaySeconds: 20
            periodSeconds: 15
            timeoutSeconds: 10
          livenessProbe:
            exec:
              command: ["rabbitmq-diagnostics", "-q", "status"]
            initialDelaySeconds: 60
            periodSeconds: 30
            timeoutSeconds: 15
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
      volumes:
        - name: rabbitmq-data
          emptyDir: {}
```

(`strategy: Recreate` because two RabbitMQ pods with the same node-name state must not overlap during a roll; with ephemeral storage a brief queue outage is already accepted.)

- [ ] Verify: `kubectl apply --dry-run=client -f k8s/rabbitmq.yaml` → both `created (dry run)`
- [ ] Commit: `git add k8s/rabbitmq.yaml && git commit -m "feat(k8s): add ephemeral rabbitmq deployment"`

### Task 8: `k8s/db-init-job.yaml`

**Files:** Create: `k8s/db-init-job.yaml`
**Interfaces:** Job name exactly `db-init` (CI deletes + waits on it). ConfigMap `db-init-sql` holds byte-identical copies of `backend/sql/*.sql`. Sentinel table `db_init_done` gates re-runs (SQL is non-idempotent: plain CREATE TABLE; seed INSERTs unguarded; `contacts` has no unique constraint so ON CONFLICT can't protect it). Script rewrites `sslmode=no-verify` → `sslmode=require` (libpq rejects the node-postgres-only value).

- [ ] Write:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: db-init-sql
  namespace: portfolio
  labels:
    app.kubernetes.io/name: db-init
    app.kubernetes.io/part-of: portfolio
data:
  00-users.sql: |
    -- Create tables
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  01-contacts.sql: |
    -- Create tables
    CREATE TABLE contacts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  02-payments.sql: |
    -- Create tables
    CREATE TABLE payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      plan VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  03-sample.sql: |
    INSERT INTO users (email, password) VALUES
    ('demo@example.com', '$2a$12$1njFBucrpXyhZUjXgcRBxecwlrP4BJipuy6QieARYd8ywjlkZbeay'); /* password123 */

    INSERT INTO contacts (user_id, name, email, phone) VALUES
    (1, 'John Doe', 'john.doe@example.com', '123-456-7890'),
    (1, 'Jane Smith', 'jane.smith@example.com', '234-567-8901'),
    (1, 'Alice Johnson', 'alice.johnson@example.com', '345-678-9012'),
    (1, 'Bob Brown', 'bob.brown@example.com', '456-789-0123'),
    (1, 'Charlie Davis', 'charlie.davis@example.com', '567-890-1234'),
    (1, 'Diana Miller', 'diana.miller@example.com', '678-901-2345'),
    (1, 'Eve Wilson', 'eve.wilson@example.com', '789-012-3456'),
    (1, 'Frank Moore', 'frank.moore@example.com', '890-123-4567'),
    (1, 'Grace Taylor', 'grace.taylor@example.com', '901-234-5678'),
    (1, 'Henry Anderson', 'henry.anderson@example.com', '012-345-6789');
  04-token_usage.sql: |
    -- Token usage tracking table for monthly hard limits
    CREATE TABLE token_usage (
      id SERIAL PRIMARY KEY,
      month_year DATE NOT NULL,
      total_tokens BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(month_year)
    );

    CREATE INDEX idx_token_usage_month ON token_usage(month_year);
---
apiVersion: batch/v1
kind: Job
metadata:
  name: db-init
  namespace: portfolio
  labels:
    app.kubernetes.io/name: db-init
    app.kubernetes.io/part-of: portfolio
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/name: db-init
        app.kubernetes.io/part-of: portfolio
    spec:
      restartPolicy: Never
      containers:
        - name: db-init
          image: postgres:15
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: portfolio-secrets
                  key: DATABASE_URL
          command:
            - /bin/sh
            - -c
            - |
              set -eu
              # DATABASE_URL uses node-postgres' sslmode=no-verify, which libpq
              # rejects; rewrite to the libpq equivalent.
              PGURL=$(printf '%s' "$DATABASE_URL" | sed 's/sslmode=no-verify/sslmode=require/')
              # Sentinel gate: SQL files are not idempotent and CI re-runs this
              # Job every deploy. Skip everything if a prior run completed.
              if [ "$(psql "$PGURL" -tAc "SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename='db_init_done'")" = "1" ]; then
                echo "db_init_done sentinel present; database already initialized. Skipping."
                exit 0
              fi
              for f in /sql/*.sql; do
                echo "Applying $f"
                psql "$PGURL" -v ON_ERROR_STOP=1 -f "$f"
              done
              psql "$PGURL" -v ON_ERROR_STOP=1 -c "CREATE TABLE db_init_done (initialized_at timestamptz NOT NULL DEFAULT now()); INSERT INTO db_init_done DEFAULT VALUES;"
              echo "Database initialization complete."
          volumeMounts:
            - name: sql
              mountPath: /sql
              readOnly: true
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
      volumes:
        - name: sql
          configMap:
            name: db-init-sql
```

- [ ] Verify: `kubectl apply --dry-run=client -f k8s/db-init-job.yaml` → `configmap/db-init-sql` + `job.batch/db-init` `created (dry run)`
- [ ] Verify SQL fidelity vs `backend/sql/`: for each of the 5 keys, diff against the repo file (trailing-newline diffs acceptable)
- [ ] Commit: `git add k8s/db-init-job.yaml && git commit -m "feat(k8s): add idempotent db-init job for managed postgres"`

### Task 9: `k8s/cluster-issuer.yaml`

**Files:** Create: `k8s/cluster-issuer.yaml`
**Interfaces:** ClusterIssuers `letsencrypt-prod` + `letsencrypt-staging` (Ingress annotation consumes). Requires cert-manager installed (runbook step 3) before first apply.

- [ ] Write:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: kelvin.joaquin@icloud.com
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: kelvin.joaquin@icloud.com
    privateKeySecretRef:
      name: letsencrypt-staging-account-key
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx
```

- [ ] Verify (schema-only; CRD may not exist locally): `python3 -c "import yaml,sys; list(yaml.safe_load_all(open('k8s/cluster-issuer.yaml'))); print('OK')"` → `OK`. Against the live cluster later: `kubectl get clusterissuer -o wide` → both READY=True
- [ ] Commit: `git add k8s/cluster-issuer.yaml && git commit -m "feat(k8s): add letsencrypt cluster issuers"`

### Task 10: `k8s/ingress.yaml`

**Files:** Create: `k8s/ingress.yaml`
**Interfaces:** Consumes Services `backend:3001`, `frontend:80`, ClusterIssuer `letsencrypt-prod`. Produces TLS secret `portfolio-tls` (via cert-manager ingress-shim — nothing else may create it). NO rewrite annotation: backend routes are registered under `/api` (droplet nginx passed the prefix through unmodified); `pathType: Prefix` preserves it. Longest-prefix matching means `/api/*` beats `/` regardless of order.

- [ ] Write:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: portfolio
  namespace: portfolio
  labels:
    app.kubernetes.io/part-of: portfolio
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - portfolio.example.com
      secretName: portfolio-tls
  rules:
    - host: portfolio.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 3001
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

- [ ] Verify: `kubectl apply --dry-run=client -f k8s/ingress.yaml` → `ingress.networking.k8s.io/portfolio created (dry run)`
- [ ] Commit: `git add k8s/ingress.yaml && git commit -m "feat(k8s): add ingress with cert-manager TLS"`

### Task 11: Deploy workflow — create `deploy-k8s.yml`, delete `deploy-services.yml`

**Files:** Create: `.github/workflows/deploy-k8s.yml`; Delete: `.github/workflows/deploy-services.yml`
**Interfaces:** Consumes everything above. Produces images `portfolio-{backend,worker,frontend}:<sha>+latest` in DOCR; Secret `portfolio-secrets` (8 keys — `JWT_SECRET` dropped: review confirmed no code reads it and the `jsonwebtoken` dependency was already removed); ConfigMap `portfolio-config` (FRONTEND_ORIGIN); pull secret `registry-<DOCR_REGISTRY>` on `default` SA.
New file rather than in-place edit: zero shared lines, and Actions history stays attributable ("Deploy Services" runs = droplet era).

- [ ] Write `.github/workflows/deploy-k8s.yml`:

```yaml
name: Deploy to DOKS

on:
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

env:
  REGISTRY: registry.digitalocean.com/${{ vars.DOCR_REGISTRY }}
  NAMESPACE: portfolio

jobs:
  deploy:
    name: Build, Push, and Deploy
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Log in to DigitalOcean Container Registry
        run: doctl registry login --expiry-seconds 3600

      - name: Build and push backend image
        run: |
          docker build \
            -t "$REGISTRY/portfolio-backend:${{ github.sha }}" \
            -t "$REGISTRY/portfolio-backend:latest" \
            ./backend
          docker push "$REGISTRY/portfolio-backend:${{ github.sha }}"
          docker push "$REGISTRY/portfolio-backend:latest"

      - name: Build and push worker image
        run: |
          docker build \
            -t "$REGISTRY/portfolio-worker:${{ github.sha }}" \
            -t "$REGISTRY/portfolio-worker:latest" \
            ./worker
          docker push "$REGISTRY/portfolio-worker:${{ github.sha }}"
          docker push "$REGISTRY/portfolio-worker:latest"

      - name: Build and push frontend image
        env:
          VITE_STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY }}
        run: |
          docker build \
            --build-arg VITE_STRIPE_PUBLISHABLE_KEY="$VITE_STRIPE_PUBLISHABLE_KEY" \
            -t "$REGISTRY/portfolio-frontend:${{ github.sha }}" \
            -t "$REGISTRY/portfolio-frontend:latest" \
            ./frontend
          docker push "$REGISTRY/portfolio-frontend:${{ github.sha }}"
          docker push "$REGISTRY/portfolio-frontend:latest"

      - name: Save DOKS kubeconfig
        run: doctl kubernetes cluster kubeconfig save "${{ vars.CLUSTER_NAME }}"

      - name: Ensure namespace exists
        run: |
          kubectl create namespace "$NAMESPACE" \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Ensure DOCR pull secret and attach to default ServiceAccount
        run: |
          doctl registry kubernetes-manifest --namespace "$NAMESPACE" | kubectl apply -f -
          kubectl patch serviceaccount default -n "$NAMESPACE" \
            -p '{"imagePullSecrets":[{"name":"registry-${{ vars.DOCR_REGISTRY }}"}]}'

      - name: Create/update application Secret
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          REDIS_URL: ${{ secrets.REDIS_URL }}
          RABBITMQ_URL: ${{ secrets.RABBITMQ_URL }}
          RABBITMQ_DEFAULT_USER: ${{ secrets.RABBITMQ_DEFAULT_USER }}
          RABBITMQ_DEFAULT_PASS: ${{ secrets.RABBITMQ_DEFAULT_PASS }}
          STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          GPT_API_KEY: ${{ secrets.GPT_API_KEY }}
        run: |
          kubectl create secret generic portfolio-secrets \
            --namespace "$NAMESPACE" \
            --from-literal=DATABASE_URL="$DATABASE_URL" \
            --from-literal=REDIS_URL="$REDIS_URL" \
            --from-literal=RABBITMQ_URL="$RABBITMQ_URL" \
            --from-literal=RABBITMQ_DEFAULT_USER="$RABBITMQ_DEFAULT_USER" \
            --from-literal=RABBITMQ_DEFAULT_PASS="$RABBITMQ_DEFAULT_PASS" \
            --from-literal=STRIPE_PUBLISHABLE_KEY="$STRIPE_PUBLISHABLE_KEY" \
            --from-literal=STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
            --from-literal=GPT_API_KEY="$GPT_API_KEY" \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Create/update application ConfigMap
        env:
          FRONTEND_ORIGIN: ${{ vars.FRONTEND_ORIGIN }}
        run: |
          kubectl create configmap portfolio-config \
            --namespace "$NAMESPACE" \
            --from-literal=FRONTEND_ORIGIN="$FRONTEND_ORIGIN" \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Remove completed db-init Job (Jobs are immutable on re-apply)
        run: kubectl delete job db-init -n "$NAMESPACE" --ignore-not-found

      - name: Apply Kubernetes manifests
        run: kubectl apply -f k8s/ -n "$NAMESPACE"

      - name: Wait for db-init Job
        run: |
          if ! kubectl wait --for=condition=complete job/db-init -n "$NAMESPACE" --timeout=300s; then
            echo "db-init did not complete; dumping logs:"
            kubectl logs job/db-init -n "$NAMESPACE" --tail=100 || true
            exit 1
          fi
          kubectl logs job/db-init -n "$NAMESPACE" --tail=50

      - name: Update Deployment images to this commit
        run: |
          kubectl set image deployment/backend  backend="$REGISTRY/portfolio-backend:${{ github.sha }}"   -n "$NAMESPACE"
          kubectl set image deployment/worker   worker="$REGISTRY/portfolio-worker:${{ github.sha }}"     -n "$NAMESPACE"
          kubectl set image deployment/frontend frontend="$REGISTRY/portfolio-frontend:${{ github.sha }}" -n "$NAMESPACE"

      - name: Wait for rollouts
        run: |
          kubectl rollout status deployment/backend  -n "$NAMESPACE" --timeout=300s
          kubectl rollout status deployment/worker   -n "$NAMESPACE" --timeout=300s
          kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=300s

      - name: Deployment summary
        if: success()
        run: |
          echo "Deployed commit ${{ github.sha }} to cluster ${{ vars.CLUSTER_NAME }}, namespace $NAMESPACE"
          kubectl get deployments,pods -n "$NAMESPACE" -o wide
```

Key design points: secrets pass via `env:` blocks, never interpolated into `run:` bodies (injection/quoting safety — deliberate hardening over the old ENV_FILE heredoc); `doctl registry kubernetes-manifest` refreshes the pull secret each run; Secret/ConfigMap land before `kubectl apply -f k8s/` so pods never crash-loop on missing config; db-init wait fails fast with logs if the Job fails; concurrency group serializes dispatches.

Known accepted tradeoff (review finding): `kubectl apply -f k8s/` resets Deployment images to `:latest` — freshly pushed with the same new code — triggering a first rollout *before* the db-init wait; `kubectl set image` then rolls a second time to the immutable sha tag. The db-init gate therefore strictly covers the Job, not the Deployments' first roll. Accepted because: the sentinel makes db-init a no-op after the first deploy, `/api/health` doesn't touch the DB (readiness isn't schema-gated anyway), and avoiding the double roll would require templating tags into manifests, breaking the "manifests are valid standalone YAML" property.

- [ ] Delete old workflow: `git rm .github/workflows/deploy-services.yml`
- [ ] Verify workflow YAML parses: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-k8s.yml')); print('OK')"` → `OK`
- [ ] Verify with actionlint (Docker fallback since not installed locally): `which actionlint && actionlint .github/workflows/deploy-k8s.yml || docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color` → exit 0 (skip if Docker down; gate on parse check)
- [ ] Verify image-name contract: `grep -o 'portfolio-\(backend\|worker\|frontend\)' .github/workflows/deploy-k8s.yml | sort -u` → exactly `portfolio-backend`, `portfolio-frontend`, `portfolio-worker`
- [ ] Verify no SSH residue in .github/: `grep -rn "SSH_\|StrictHostKeyChecking\|ENV_FILE" .github/` → no matches
- [ ] Commit: `git add -A .github && git commit -m "feat(ci): replace SSH compose deploy with direct DOKS deploy"`

### Task 12: README deployment section rewrite

**Files:** Modify: `README.md` (the `## Deployment` section through `#### Data Persistence`; keep `### Local Development` unchanged)

- [ ] Replace the section with:

```markdown
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
```

- [ ] Also update the `## Services` section: change "PostgreSQL: Database" → "PostgreSQL: DO Managed Postgres (production) / container (local dev)" and "Nginx: Reverse proxy routing requests" → "ingress-nginx (production) / Nginx container (local dev)"
- [ ] Verify: `grep -n "SSH_PRIVATE_KEY\|docker compose down" README.md` → only the "no longer used" line (or nothing)
- [ ] Commit: `git add README.md && git commit -m "docs: rewrite deployment section for DOKS"`

### Task 13: First deploy + end-to-end verification

- [ ] Run `docs/k8s-setup.md` steps 0–4 (operator, one-time; step 5 cert rehearsal optional)
- [ ] Configure GitHub variables + secrets per Task 12 table; delete retired SSH secrets after first success
- [ ] Whole-dir dry-run against live cluster: `kubectl apply --dry-run=server -f k8s/ -n portfolio` → 15 resources (1 namespace, 5 deployments, 4 services, 1 configmap, 1 job, 2 clusterissuers, 1 ingress), no errors
- [ ] Dispatch **Deploy to DOKS** from the Actions tab → all steps green; three `successfully rolled out` lines
- [ ] `kubectl -n portfolio get pods` → backend/worker/frontend/redis/rabbitmq pods Running, db-init Completed (no PVCs exist — redis/rabbitmq are ephemeral by design)
- [ ] `kubectl get certificate -n portfolio` → `portfolio-tls` READY=True
- [ ] `curl -si https://<domain>/api/health | head -1` → `HTTP/2 200`; `curl -v https://<domain>/ 2>&1 | grep issuer:` → Let's Encrypt; `curl -sI http://<domain>/ | head -1` → 308 redirect
- [ ] Exercise the demo page end-to-end (NL→SQL query returns rows; token counters update)
- [ ] Second deploy dispatch → db-init logs show sentinel skip; `SELECT count(*) FROM contacts` → 10 (no duplicates)
- [ ] Decommission droplet only after several days of stable cluster operation

## GitHub Secrets & Variables (complete list)

| Name | Kind | Example |
|---|---|---|
| `DIGITALOCEAN_ACCESS_TOKEN` | secret | `dop_v1_a1b2c3...` |
| `DOCR_REGISTRY` | variable | `kelvin-registry` |
| `CLUSTER_NAME` | variable | `portfolio-cluster` |
| `FRONTEND_ORIGIN` | variable | `https://example.com` |
| `DATABASE_URL` | secret | `postgresql://doadmin:pw@host.db.ondigitalocean.com:25060/defaultdb?sslmode=no-verify` |
| `REDIS_URL` | secret | `redis://redis:6379` |
| `RABBITMQ_URL` | secret | `amqp://user:pass@rabbitmq:5672` |
| `RABBITMQ_DEFAULT_USER` | secret | `portfolio` |
| `RABBITMQ_DEFAULT_PASS` | secret | random |
| `STRIPE_PUBLISHABLE_KEY` | secret | `pk_test_...` |
| `STRIPE_SECRET_KEY` | secret | `sk_test_...` |
| `GPT_API_KEY` | secret | DO inference key |

Retired after first success: `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `SSH_USER`, `SSH_HOST`, `ENV_FILE`.

## Verification (plan-level)

Per-task gates are inline above. End-to-end: Task 13. Local gates usable before any cluster exists: `kubectl apply --dry-run=client -f k8s/` per file, Python YAML parse of the workflow, actionlint via Docker, grep contract checks.

## Review Record

Plan generated by 3 parallel agents (workloads, CI/CD, ingress/TLS) and reviewed twice:
- **Repo cross-check review** (agent): no CRITICAL findings; SQL fidelity, code claims, env parity, workflow syntax, and Ingress path semantics all verified against the repo. 3 WARNINGs + suggestions — all integrated above (db-init failure logging, double-rollout tradeoff documented, resource count 15, JWT_SECRET dropped as dead config, diagram BE→MQ edge removed, README Services section added to Task 12, FRONTEND_ORIGIN exactness note).
- **Feasibility validation** (run inline after the validator agent hit an API session limit): version-pinned install URLs live-verified during planning; runbook→CI ordering has no races beyond the documented double-roll; sslmode split confirmed; StatefulSet/PVC choices valid for DOKS defaults.
- **Post-review revision (user decision)**: DO Load Balancer removed — single-node cluster, ingress-nginx switched from the DO-provider overlay to baremetal + `hostNetwork: true` on ports 80/443, DNS points at the node public IP. Eliminates the PROXY-protocol hairpin workaround entirely; introduces the ephemeral-node-IP caveat (auto-upgrade off, re-point DNS on node replacement), documented in the runbook.
- **Post-review revision 2 (user decision)**: Redis and RabbitMQ StatefulSets + DO block-storage PVCs replaced with plain Deployments on emptyDir — user explicitly accepts data loss on restart. Redis AOF flag dropped (pointless on ephemeral storage; daily counters self-expire, monthly limit is in Postgres). RabbitMQ uses `strategy: Recreate` to avoid overlapping brokers during a roll. No PVCs anywhere in the final manifest set.

Known open observations (accepted, no action): worker receives the full `portfolio-secrets` (least-privilege alternative documented in Task 4's fragment history); nothing currently publishes to `payment_queue` (worker is a consumer without a producer — pre-existing app behavior, out of migration scope).
