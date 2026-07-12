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
