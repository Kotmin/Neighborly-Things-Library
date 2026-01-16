# kubectl Snippets

## Inspect objects
```bash
kubectl -n library get all
kubectl -n library get pods -o wide
kubectl -n library describe pod <name>
```

## Rollout & rollback
```bash
kubectl -n library rollout status deploy/frontend
kubectl -n library rollout history deploy/frontend
kubectl -n library rollout undo deploy/frontend
```

## Persistence test (SQLite)
```bash
kubectl -n library delete pod rails-backend-0
kubectl -n library get pods -w
```

## NetworkPolicy test (expected timeout)
```bash
kubectl -n library run hacker --rm -it --image=busybox -- wget -qO- http://rails-backend:80/healthz
```
