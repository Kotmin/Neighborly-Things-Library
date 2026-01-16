# Neighborly Things Library

Neighborly Things Library is a Ruby on Rails API (SQLite) deployed to Kubernetes (Minikube) with an Nginx frontend/proxy.

This repository contains:
- `neighborly_things_library/` – **git submodule** with the full Rails application
- `k8s/` – plain Kubernetes manifests
- `helm-chart/neighborly-library/` – Helm Chart (Labs 1–12)
- `docs/` and `.github/instructions/` – collaboration playbooks and snippets for VS Code agents

## Clone with submodule
```bash
git clone --recurse-submodules https://github.com/Kotmin/Neighborly-Things-Library
```

## Minikube bootstrap
```bash
minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
minikube addons enable ingress
minikube addons enable metrics-server
```

## Deploy (recommended: Helm)
```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library \
  --namespace library \
  --set backend.image=neighborly-backend:latest \
  --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require \"securerandom\"; puts SecureRandom.hex(64)')"

```

## Access
Add to `/etc/hosts`:
```bash
echo "$(minikube ip) library.local" | sudo tee -a /etc/hosts
```

Open: `http://library.local`

If ingress does not receive an external address on your platform, run:
```bash
minikube tunnel
```

## Documentation
- `.github/instructions/k8s_helm_playbook.md`
- `docs/BEST_PRACTICES.md`
- `docs/snippets/*.md`


Setting up minikube (1.37.0-0) 