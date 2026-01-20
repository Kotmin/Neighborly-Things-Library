# Neighborly Things Library - Deployment

Project overview (idea, architecture, deployment flow, tests): **docs/PROJECT_OVERVIEW.md**

## Quick start (Minikube)

```bash
minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
minikube addons enable ingress
minikube addons enable metrics-server
```

## Build images (recommended)

See: **docs/BUILD_IMAGES.md**

## Deploy (Helm)

```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library \
  --namespace library --create-namespace \
  --set backend.image=neighborly-backend:latest \
  --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require "securerandom"; puts SecureRandom.hex(64)')"
```

## Access

```bash
echo "$(minikube ip) library.local" | sudo tee -a /etc/hosts
open http://library.local
```

You can also open `http://<minikube-ip>/` (catch-all ingress rule).
If you use macOS + docker driver, you may need to run `minikube tunnel`.
