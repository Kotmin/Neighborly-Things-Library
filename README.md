# Neighborly Things Library - Deployment

## Quick start (Minikube)
```bash
minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
minikube addons enable ingress
minikube addons enable metrics-server
```

## Deploy (Helm)
```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library \
  --create-namespace --namespace library \
  --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require "securerandom"; puts SecureRandom.hex(64)')"
```

## Access
```bash
echo "$(minikube ip) library.local" | sudo tee -a /etc/hosts
open http://library.local
```
If you use macOS + docker driver, you may need to run `minikube tunnel`.

