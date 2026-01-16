# K8s/Helm Playbook (Neighborly Things Library)

This repository contains:
- `k8s/` – plain Kubernetes manifests (declarative baseline)
- `helm-chart/neighborly-library/` – Helm Chart (Lab 11) generating equivalent resources
- `neighborly_things_library/` – **git submodule** with the full Rails application (backend)

## Goals (PRD, Labs 1–12)
- **Backend**: Rails + SQLite file DB -> `StatefulSet` + `PVC` (persistence)
- **Frontend**: Nginx proxy / static -> `Deployment` + `RollingUpdate` + `HPA` (autoscaling)
- **Security**: `NetworkPolicy` default-deny, allow only **Ingress -> Frontend -> Backend**
- **External access**: `Ingress` on `library.local`

## Minikube bootstrap
```bash
minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
minikube addons enable ingress
minikube addons enable metrics-server
```

### Ingress access tip (Minikube)
Depending on driver/OS, you may need:
```bash
minikube tunnel
```
Run it in a separate terminal.

Update hosts file (example):
```bash
echo "$(minikube ip) library.local" | sudo tee -a /etc/hosts
```

## Deploy with Helm (recommended)
```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library \
  --create-namespace --namespace library \
  --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require "securerandom"; puts SecureRandom.hex(64)')"
```

## Deploy with plain manifests (alternative)
```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/
```

## Smoke tests
- Check pods:
```bash
kubectl -n library get pods -o wide
```
- Persistence test:
```bash
kubectl -n library delete pod rails-backend-0
kubectl -n library get pods -w
```
- Security test (should TIMEOUT):
```bash
kubectl -n library run hacker --rm -it --image=busybox -- wget -qO- http://rails-backend:80/healthz
```

