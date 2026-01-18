# Sąsiedzka Biblioteka Rzeczy – opis projektu (PROJECT_OVERVIEW)

Ten dokument opisuje:
1) ideę przykładowej aplikacji,
2) architekturę stacka,
3) przebieg wdrożenia (Helm i plain YAML),
4) testy poprawności działania.

---

## 1) Idea przykładowej aplikacji

**Nazwa:** Sąsiedzka Biblioteka Rzeczy (Neighborly Things Library)

**Story:** mieszkańcy osiedla współdzielą rzadko używane przedmioty (np. wiertarka, rzutnik, maszyna do szycia), zamiast kupować je na własność.

**MVP (funkcje):**
- dodawanie „przedmiotów” do katalogu,
- lista przedmiotów,
- wypożyczenie przedmiotu,
- zwrot przedmiotu,
- healthcheck aplikacji.

**API (Rails):**
- `GET /healthz` (healthcheck)
- `GET /api/items`, `POST /api/items`
- `POST /api/loans`
- `POST /api/returns`

**Wybrany stack (wymagania):**
- **JavaScript** (lekki frontend: HTML/CSS/JS)
- **Ruby** (Rails)
- **SQLite** (baza plikowa)
- **Rails** (API + healthcheck)

> Uwaga o “więcej JS”: wymaganie “JavaScript” jest spełnione przez frontend w JS. Celem projektu jest walidacja stacka i wdrożenia K8s, nie budowa rozbudowanego SPA.

---

## 2) Architektura stack-a

**Stack:** Ruby on Rails (Backend/API), SQLite (DB), Nginx (Frontend/Proxy), Kubernetes (Minikube)

### Obiekty K8s (minimum wymagane)
- `StatefulSet` (backend Rails + SQLite)
- `PersistentVolumeClaim` (trwałość pliku SQLite)
- `Deployment` (frontend Nginx – bezstanowy)
- `Service` (dla frontendu i backendu)
- `ConfigMap` (konfiguracja, nginx config, frontend static)
- `Secret` (SECRET_KEY_BASE)
- `Ingress` (`library.local`)
- (bonus) `NetworkPolicy`, `HPA`, `probes`, `resources`

### Ruch w systemie (high level)

```
Browser
  |
  v
Ingress Controller (ingress-nginx)
  |
  v
Service: frontend (ClusterIP)
  |
  v
Pods: frontend (Nginx)
  |       \
  |        \  /api/*
  |         v
  |      Service: backend (DNS)
  |         |
  v         v
Static UI   Pod: rails-backend-0 (Rails + SQLite na PVC)
```

### Helm vs plain `k8s/` – różnice w backend Service

Repo wspiera dwie ścieżki wdrożenia:

- **Helm** (chart w `helm-chart/neighborly-library/`)
  - Nginx proxy `/api/*` -> **`rails-backend-svc`** (Service ClusterIP)
  - StatefulSet: `rails-backend` + PVC `/rails/storage`

- **Plain YAML** (manifests w `k8s/`)
  - Nginx proxy `/api/*` -> **`rails-backend`** (Service headless)
  - Uwaga: w aktualnym stanie `k8s/` nadal używa ścieżki `/app/storage` (do ujednolicenia w refaktorze).

### Dlaczego StatefulSet dla SQLite?

SQLite to baza plikowa – zapis musi trafiać na trwały wolumen (PVC). Backend pozostaje pojedynczą instancją (brak bezpiecznego zapisu multi-replica). StatefulSet zapewnia:
- stałą tożsamość poda (`rails-backend-0`),
- powiązanie z tym samym PVC po restarcie.

---

## 3) Przebieg wdrożenia

### A) Przygotowanie klastra (Minikube)

1) Start Minikube z Calico (wymagane dla NetworkPolicy):

```bash
minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
```

2) Addons:

```bash
minikube addons enable ingress
minikube addons enable metrics-server
```

### B) Budowa obrazu backendu (ważne)

Backend jest w katalogu `neighborly_things_library/` (submodule).
Dockerfile ma różne stage – w K8s potrzebujesz **prod stage**.

```bash
eval "$(minikube docker-env)"
cd neighborly_things_library
docker build --target prod -t neighborly-backend:latest .
```

### C) Wdrożenie (2 ścieżki)

#### 1) Helm (zalecane)

```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library \
  --namespace library --create-namespace \
  --set backend.image=neighborly-backend:latest \
  --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require "securerandom"; puts SecureRandom.hex(64)')"
```

#### 2) Plain YAML (k8s/)

```bash
kubectl apply -f k8s/
```

### D) Dostęp zewnętrzny (Ingress / hosts)

1) IP minikube:

```bash
minikube ip
kubectl -n library get ingress -o wide
```

2) `/etc/hosts`:
- standard: `<MINIKUBE_IP> library.local`

> W zależności od drivera Minikube (np. Docker Desktop) czasem wymagany jest `minikube tunnel`.
> Wtedy ingress może wystawić adres bliższy `127.0.0.1` – mapujesz host na to, co faktycznie widzisz w `kubectl get ingress -o wide`.

---

## 4) Test poprawności działania

### Test 1: Ingress + UI

```bash
curl -sS -I http://library.local/
```

Oczekiwane: `200 OK` i odpowiedź z Nginx.

### Test 2: Healthcheck backendu

```bash
curl -sS http://library.local/healthz
```

Oczekiwane: `200` (JSON lub plain).

### Test 3: CRUD przedmiotów (API)

Dodanie (wariant Rails-owy z `item:{...}`):

```bash
curl -sS -i -X POST http://library.local/api/items \
  -H 'Content-Type: application/json' \
  -d '{"item":{"name":"Wiertarka", "category":"Narzędzia","description":"Bosch"}}'
```

Lista:

```bash
curl -sS http://library.local/api/items
```

### Test 4: Trwałość danych (StatefulSet + PVC)

1) Dodaj przedmiot (Test 3).  
2) Usuń pod backendu:

```bash
kubectl -n library delete pod rails-backend-0
kubectl -n library wait --for=condition=Ready pod/rails-backend-0 --timeout=180s
```

```bash
# wypożycz item_id=1
curl -sS -X POST http://library.local/api/loans \
  -H 'Content-Type: application/json' \
  -d '{"item_id":1,"borrower_name":"Ania"}'

# zwróć
curl -sS -X POST http://library.local/api/returns \
  -H 'Content-Type: application/json' \
  -d '{"item_id":1}'

```

3) Sprawdź listę – rekord powinien pozostać:

```bash
curl -sS http://library.local/api/items
```

### Test 4.5: Trwałość danych (StatefulSet + PVC)
1. Dodaj przedmiot.
2. Usuń backend pod:
   ```bash
   kubectl delete pod -n library rails-backend-0
   ```
3. Poczekaj aż StatefulSet odtworzy poda.
4. Sprawdź listę przedmiotów – rekord powinien istnieć.

### Test 5: Izolacja NetworkPolicy
1. Uruchom tymczasowy pod i spróbuj dobrać się do backendu:
   ```bash
   kubectl run hacker --image=busybox -it --rm -n library -- sh
   wget -qO- http://rails-backend:80/healthz
   ```
2. Oczekiwane: **timeout / brak połączenia** (deny-all + brak allow).


### Test 5: NetworkPolicy (least privilege)

**A) “Hacker” (powinno być zablokowane):**

```bash
kubectl -n library run hacker --image=busybox -it --rm --restart=Never -- sh
# w środku:
wget -qO- http://rails-backend-svc/healthz
```

Oczekiwane: timeout / brak połączenia (jeśli polityka dopuszcza tylko frontend -> backend).

**B) Test pozytywny (z frontendu):**

```bash
FRONT_POD="$(kubectl -n library get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}')"
kubectl -n library exec -it "$FRONT_POD" -- sh -lc 'wget -qSO- http://rails-backend-svc/healthz 2>&1 | head -n 20'
```

Oczekiwane: `200 OK`.

> Uwaga: w ścieżce plain YAML backend service nazywa się `rails-backend` (headless), więc testy DNS mogą się różnić.
> Docelowo w refaktorze ujednolicimy service’y między Helm i k8s/.

### Test 6: HPA (autoskalowanie frontendu)

1) HPA status:

```bash
kubectl -n library get hpa
kubectl -n library describe hpa frontend-hpa || true
```

2) Load generator:

```bash
kubectl -n library run load-generator --image=busybox -it --rm --restart=Never -- \
  sh -c "while true; do wget -q -O- http://frontend >/dev/null; done"
```

3) Obserwuj skalowanie:

```bash
watch kubectl -n library get hpa
watch kubectl -n library get pods
```

alt.
1. Sprawdź HPA:
   ```bash
   kubectl get hpa -n library
   ```
2. Wygeneruj ruch (np. kilka razy odśwież UI lub curl w pętli) i obserwuj skalowanie.



---

## Powiązane pliki
- `docs/README.md` – szybki start
- `docs/BEST_PRACTICES.md` – zasady wdrożeniowe
- `docs/BUILD_IMAGES.md` – budowa obrazów (backend + opcjonalnie frontend)
- `.github/instructions/k8s_helm_playbook.md` – playbook dla agenta/CI
