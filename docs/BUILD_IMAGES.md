# Building container images (local Minikube)

The Kubernetes manifests and Helm chart expect a local backend image by default:
- Backend (Rails API): `neighborly-backend:latest`

Frontend uses the public `nginx:1.27` image and mounts static UI from a Kubernetes ConfigMap,
so you do **not** need to build a separate frontend image to see the app UI.

Because `neighborly_things_library/` is a git submodule, you need to initialize it:
```bash
git submodule update --init --recursive
```

## Option A (simplest): build directly into Minikube Docker
This avoids pushing to a registry.

```bash
eval "$(minikube docker-env)"
cd neighborly_things_library

docker build --target prod -t neighborly-backend:latest .


# Optional: if you want a self-contained frontend image (instead of ConfigMap), build it from ./frontend
# cd ../frontend
# docker build --target prod -t neighborly-backend:latest .
```

## Option B: use a registry
Build and push to your registry, then override image in Helm:
```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library \
  --namespace library --create-namespace \
  --set backend.image=ghcr.io/<you>/neighborly-backend:... \
  --set-string backend.secret.SECRET_KEY_BASE=... 
```

## Frontend image
In this repo the frontend is a minimal static UI (HTML/CSS/JS) that talks to the Rails API.
It is served by Nginx and proxies `/api/*` to the backend.

The Nginx proxy config is provided via Kubernetes `ConfigMap` (`frontend-nginx-config`).
