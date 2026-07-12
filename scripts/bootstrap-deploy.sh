#!/usr/bin/env bash
#
# bootstrap-deploy.sh — one-shot, idempotent bootstrap of the portfolio app
# onto the existing DOKS cluster, driven end-to-end:
#
#   1. GitHub Actions variables + secrets (derived from doctl where possible)
#   2. One-time cluster setup (ingress-nginx hostNetwork, cert-manager)
#   3. DNS A record (apex) on DigitalOcean DNS -> node public IP
#   4. Managed Postgres firewall locked to the cluster
#   5. Push main, dispatch the "Deploy to DOKS" workflow, watch it
#   6. Verify the live site
#
# Idempotent: safe to re-run. Existing GH secrets are not rotated; cluster
# installs and DNS records are skipped when already correct.
#
# Requirements: gh (authed), doctl (authed), kubectl, jq, git, openssl, curl.

set -euo pipefail

# ---------------------------------------------------------------- constants
DOMAIN="crvn.online"
CLUSTER_NAME="bloomgate-prod"
KUBE_CONTEXT="do-sgp1-${CLUSTER_NAME}"
RABBITMQ_USER="portfolio"
INGRESS_NGINX_MANIFEST="https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.0/deploy/static/provider/baremetal/deploy.yaml"
CERT_MANAGER_MANIFEST="https://github.com/cert-manager/cert-manager/releases/download/v1.18.2/cert-manager.yaml"

say()  { printf '\n==> %s\n' "$*"; }
skip() { printf '    (skip) %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- preflight
say "Preflight checks"
for cmd in gh doctl kubectl jq git openssl curl; do
  command -v "$cmd" >/dev/null || fail "missing required command: $cmd"
done
gh auth status >/dev/null || fail "gh is not authenticated (run: gh auth login)"
doctl account get >/dev/null || fail "doctl is not authenticated (run: doctl auth init)"
git rev-parse --show-toplevel >/dev/null || fail "run from inside the repo"
cd "$(git rev-parse --show-toplevel)"

if [ "$(kubectl config current-context 2>/dev/null || true)" != "$KUBE_CONTEXT" ]; then
  say "Saving kubeconfig for $CLUSTER_NAME"
  doctl kubernetes cluster kubeconfig save "$CLUSTER_NAME"
fi
kubectl get nodes >/dev/null || fail "kubectl cannot reach the cluster"

# ------------------------------------------------------------ derive values
say "Deriving values from DigitalOcean"
REGISTRY_NAME=$(doctl registry get --format Name --no-header)
CLUSTER_UUID=$(doctl kubernetes cluster list --format ID,Name --no-header | awk -v n="$CLUSTER_NAME" '$2==n {print $1}')
DB_ID=$(doctl databases list --format ID,Name --no-header | awk '$2=="bloomgate-pg" {print $1}')
[ -n "$REGISTRY_NAME" ] || fail "could not resolve DOCR registry name"
[ -n "$CLUSTER_UUID" ]  || fail "could not resolve cluster UUID for $CLUSTER_NAME"
[ -n "$DB_ID" ]         || fail "could not resolve database ID for bloomgate-pg"
echo "    registry=$REGISTRY_NAME cluster=$CLUSTER_UUID db=$DB_ID domain=$DOMAIN"

# DO API token: env var wins, else pull from doctl's config file.
DO_TOKEN="${DIGITALOCEAN_ACCESS_TOKEN:-}"
if [ -z "$DO_TOKEN" ]; then
  for cfg in "$HOME/Library/Application Support/doctl/config.yaml" "$HOME/.config/doctl/config.yaml"; do
    if [ -f "$cfg" ]; then
      DO_TOKEN=$(awk '/access-token:/ {print $2; exit}' "$cfg")
      [ -n "$DO_TOKEN" ] && break
    fi
  done
fi
[ -n "$DO_TOKEN" ] || fail "no DO token: export DIGITALOCEAN_ACCESS_TOKEN or authenticate doctl"

# ------------------------------------------- placeholder substitution (once)
say "Placeholder substitution in k8s/ and docs/"
# Check k8s/ only: docs/k8s-setup.md keeps the placeholder strings forever in
# its example commands, which must not retrigger this branch.
if grep -rlq 'portfolio\.example\.com\|DOCR_REGISTRY_PLACEHOLDER' k8s/ 2>/dev/null; then
  sed -i '' "s/portfolio\.example\.com/${DOMAIN}/g" k8s/ingress.yaml docs/k8s-setup.md
  sed -i '' "s/DOCR_REGISTRY_PLACEHOLDER/${REGISTRY_NAME}/g" k8s/*.yaml
  git add k8s/ docs/k8s-setup.md
  if git diff --cached --quiet; then
    skip "substitution produced no changes"
  else
    git commit -m "chore: set real domain and registry in k8s manifests"
  fi
else
  skip "placeholders already substituted"
fi

# ---------------------------------------------------------- GitHub variables
say "Setting GitHub Actions variables"
gh variable set DOCR_REGISTRY   --body "$REGISTRY_NAME"
gh variable set CLUSTER_NAME    --body "$CLUSTER_NAME"
gh variable set FRONTEND_ORIGIN --body "https://${DOMAIN}"

# ------------------------------------------------------------ GitHub secrets
say "Setting GitHub Actions secrets"
existing_secrets=$(gh secret list --json name --jq '.[].name')
has_secret() { printf '%s\n' "$existing_secrets" | grep -qx "$1"; }

# Always refresh the DO token (cheap, safe).
gh secret set DIGITALOCEAN_ACCESS_TOKEN --body "$DO_TOKEN"

DATABASE_URL=$(doctl databases connection "$DB_ID" --format URI --no-header | sed 's/sslmode=require/sslmode=no-verify/')
[ -n "$DATABASE_URL" ] || fail "could not fetch database connection URI"
gh secret set DATABASE_URL --body "$DATABASE_URL"

gh secret set REDIS_URL --body "redis://redis:6379"

# RabbitMQ creds: generate once; rotating on every run would desync the
# running broker (env is only read at pod start).
if has_secret RABBITMQ_URL; then
  skip "RABBITMQ_* secrets already set (not rotating)"
else
  RABBITMQ_PASS=$(openssl rand -hex 16)
  gh secret set RABBITMQ_DEFAULT_USER --body "$RABBITMQ_USER"
  gh secret set RABBITMQ_DEFAULT_PASS --body "$RABBITMQ_PASS"
  gh secret set RABBITMQ_URL --body "amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@rabbitmq:5672"
fi

# GPT_API_KEY: mint a DO Gradient serverless-inference model access key.
if has_secret GPT_API_KEY; then
  skip "GPT_API_KEY already set"
else
  say "Creating DO Gradient model access key"
  GPT_KEY=$(curl -fsS -X POST "https://api.digitalocean.com/v2/gen-ai/models/api_keys" \
    -H "Authorization: Bearer $DO_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"portfolio-crvn-online"}' | jq -r '.api_key_info.secret_key // empty') || GPT_KEY=""
  if [ -z "$GPT_KEY" ]; then
    fail "could not create a Gradient model access key via API.
  Create one manually: DO Control Panel -> Gradient AI -> Serverless inference -> Create model access key,
  then run: gh secret set GPT_API_KEY  (paste the key)  and re-run this script."
  fi
  gh secret set GPT_API_KEY --body "$GPT_KEY"
fi

# ------------------------------------------------- cluster one-time installs
say "Installing ingress-nginx (baremetal + hostNetwork)"
kubectl apply -f "$INGRESS_NGINX_MANIFEST"
host_net=$(kubectl -n ingress-nginx get deployment ingress-nginx-controller \
  -o jsonpath='{.spec.template.spec.hostNetwork}' 2>/dev/null || true)
if [ "$host_net" != "true" ]; then
  kubectl -n ingress-nginx patch deployment ingress-nginx-controller --type=json -p='[
    {"op":"add","path":"/spec/template/spec/hostNetwork","value":true},
    {"op":"replace","path":"/spec/template/spec/dnsPolicy","value":"ClusterFirstWithHostNet"}
  ]'
else
  skip "hostNetwork already enabled"
fi
kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=180s

# ingress-nginx >=1.12 strict path validation rejects the pathType:Exact ACME
# solver ingress cert-manager creates; relax it or HTTP-01 challenges never
# present.
strict=$(kubectl -n ingress-nginx get configmap ingress-nginx-controller \
  -o jsonpath='{.data.strict-validate-path-type}' 2>/dev/null || true)
if [ "$strict" != "false" ]; then
  kubectl -n ingress-nginx patch configmap ingress-nginx-controller --type merge \
    -p '{"data":{"strict-validate-path-type":"false"}}'
  kubectl -n ingress-nginx rollout restart deployment/ingress-nginx-controller
  kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=120s
else
  skip "strict-validate-path-type already disabled"
fi

say "Installing cert-manager"
kubectl apply -f "$CERT_MANAGER_MANIFEST"
kubectl wait --namespace cert-manager --for=condition=Available deployment \
  cert-manager cert-manager-webhook cert-manager-cainjector --timeout=180s

# ------------------------------------------------------------------ DNS (DO)
say "Pointing ${DOMAIN} at the node public IP"
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')
[ -n "$NODE_IP" ] || fail "could not determine node external IP"
record=$(doctl compute domain records list "$DOMAIN" --format ID,Type,Name,Data --no-header | awk '$2=="A" && $3=="@" {print $1" "$4; exit}')
if [ -z "$record" ]; then
  doctl compute domain records create "$DOMAIN" --record-type A --record-name @ --record-data "$NODE_IP" --record-ttl 300
  echo "    created @ A -> $NODE_IP"
elif [ "$(echo "$record" | awk '{print $2}')" != "$NODE_IP" ]; then
  doctl compute domain records update "$DOMAIN" --record-id "$(echo "$record" | awk '{print $1}')" \
    --record-type A --record-name @ --record-data "$NODE_IP" --record-ttl 300
  echo "    updated @ A -> $NODE_IP"
else
  skip "@ A record already points at $NODE_IP"
fi

# ------------------------------------------------------------- DB firewall
say "Restricting Managed Postgres trusted sources to the cluster"
doctl databases firewalls replace "$DB_ID" --rule "k8s:${CLUSTER_UUID}"

# ------------------------------------------------------- push and dispatch
say "Pushing main to origin"
git push origin main

say "Dispatching Deploy to DOKS workflow"
before_id=$(gh run list --workflow=deploy-k8s.yml -L1 --json databaseId --jq '.[0].databaseId // 0')
gh workflow run deploy-k8s.yml --ref main
run_id="$before_id"
for _ in $(seq 1 30); do
  sleep 2
  run_id=$(gh run list --workflow=deploy-k8s.yml -L1 --json databaseId --jq '.[0].databaseId // 0')
  [ "$run_id" != "$before_id" ] && break
done
[ "$run_id" != "$before_id" ] || fail "workflow run did not appear; check gh run list"
say "Watching run $run_id (this includes image builds; several minutes)"
gh run watch "$run_id" --exit-status

# ----------------------------------------------------------------- verify
say "Verifying live site (cert issuance + DNS may take a few minutes)"
ok_cert=false ok_health=false
for _ in $(seq 1 30); do
  if [ "$ok_cert" = false ]; then
    ready=$(kubectl get certificate portfolio-tls -n portfolio -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || true)
    [ "$ready" = "True" ] && ok_cert=true && echo "    certificate portfolio-tls READY"
  fi
  if [ "$ok_cert" = true ] && curl -fsS "https://${DOMAIN}/api/health" 2>/dev/null | grep -q '"ok"'; then
    ok_health=true && echo "    https://${DOMAIN}/api/health -> ok"
    break
  fi
  sleep 10
done
[ "$ok_health" = true ] || fail "site not healthy yet — check: kubectl get challenges -n portfolio; dig +short ${DOMAIN}"

echo "    http->https redirect: $(curl -sI "http://${DOMAIN}/" | head -1 | tr -d '\r')"
kubectl -n portfolio get pods

say "Bootstrap complete: https://${DOMAIN}"
echo "Cleanup hint (old unused GitHub secrets):"
echo "  for s in SSH_PRIVATE_KEY SSH_KNOWN_HOSTS SSH_USER SSH_HOST ENV_FILE STRIPE_PUBLISHABLE_KEY STRIPE_SECRET_KEY; do gh secret delete \$s; done"
