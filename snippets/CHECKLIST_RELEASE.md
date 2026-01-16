# Release checklist (copy/paste)

- [ ] Cluster started with `--cni=calico`
- [ ] `ingress` + `metrics-server` addons enabled
- [ ] Backend image exists locally/registry and listens on configured port
- [ ] `SECRET_KEY_BASE` injected (not a placeholder)
- [ ] Backend PVC bound (`kubectl -n <ns> get pvc`)
- [ ] Ingress host mapped to Minikube IP (`/etc/hosts`)
- [ ] NetworkPolicy verified (busybox cannot reach backend)
- [ ] HPA created and metrics available (`kubectl -n <ns> get hpa`)

