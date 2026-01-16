# Minikube Snippets

## Start cluster with Calico (NetworkPolicy)
```bash
minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
```

## Enable addons
```bash
minikube addons enable ingress
minikube addons enable metrics-server
```

## Ingress access
Depending on driver/OS, you may need a tunnel:
```bash
minikube tunnel
```

## Hosts entry
```bash
echo "$(minikube ip) library.local" | sudo tee -a /etc/hosts
```
