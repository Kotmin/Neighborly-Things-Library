# Building container images (local Minikube)

The Kubernetes manifests and Helm chart expect a backend image named `neighborly-backend:latest` by default.

Because `neighborly_things_library/` is a git submodule, you need to initialize it:
```bash
git submodule update --init --recursive
```

## Option A (simplest): build directly into Minikube Docker
This avoids pushing to a registry.

```bash
eval "$(minikube docker-env)"
cd neighborly_things_library

docker build -t neighborly-backend:latest .
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
By default the frontend uses `nginx:1.27` and relies on `ConfigMap` for reverse proxy configuration.
If you later add a real SPA build, create your own image and set `frontend.image`.
