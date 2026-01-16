# Best Practices (Labs 1–12) – Neighborly Things Library

## 1) Separate config from code
- **ConfigMap**: non-sensitive environment variables
- **Secret**: sensitive values (e.g. `SECRET_KEY_BASE`)
- Never commit real secrets. Pass secrets via `helm --set-string` or a secret manager.

## 2) SQLite on Kubernetes
- SQLite is a **single-writer file DB**. Treat it as a *legacy/learning* persistence layer.
- Use **StatefulSet + PVC** so the database file survives pod reschedules.
- Keep backend replicas at `1`.

## 3) NetworkPolicies: least privilege
- Start with **default deny ingress** in the namespace.
- Add explicit allows:
  1. `ingress-nginx` namespace → frontend port 80
  2. frontend pods → backend port 80
- Avoid `namespaceSelector: {}` (too broad). Prefer matching `kubernetes.io/metadata.name: ingress-nginx`.

## 4) HPA needs requests
- HPA CPU utilization is calculated as a % of **CPU requests**.
- Ensure the frontend has both `requests` and `limits`, otherwise HPA is unreliable.

## 5) Rollout strategy
- Frontend: `RollingUpdate` with `maxUnavailable: 0` = zero downtime.
- Backend: StatefulSet updates are ordered and slower; keep readiness probes stable.

## 6) Probes
- Prefer HTTP probes to real endpoints (here: `/healthz`).
- Keep initial delays realistic for Rails boot time.

