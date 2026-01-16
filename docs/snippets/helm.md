# Helm Snippets

## Install/upgrade chart
```bash
cd ..
helm upgrade --install neighborly ./helm-chart/neighborly-library \
  --namespace library \
  --set backend.image=neighborly-backend:latest \
  --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require \"securerandom\"; puts SecureRandom.hex(64)')"

```

## Render templates locally (debug)
```bash
helm template neighborly ./helm-chart/neighborly-library --namespace library
```

## Validate rendered YAML with kubectl (server-side dry run)
```bash
helm template neighborly ./helm-chart/neighborly-library --namespace library \
  | kubectl apply --dry-run=server -f -
```
