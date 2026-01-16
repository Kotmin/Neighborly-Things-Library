# Build images (Minikube docker)

```bash
git submodule update --init --recursive

eval "$(minikube docker-env)"

cd neighborly_things_library
docker build --target prod -t neighborly-backend:latest .

# Frontend uses nginx + ConfigMap (no build required).
# Optional: build a self-contained frontend image:
# cd ../frontend
# docker build --target prod -t neighborly-backend:latest .
```
