# Sąsiedzka Biblioteka Rzeczy – opis projektu (PROJECT_OVERVIEW)

Ten dokument opisuje:
1) ideę przykładowej aplikacji,  
2) architekturę stacka,  
3) przebieg wdrożenia (**Helm** i **plain YAML**),  
4) testy poprawności działania (+ praktyczne komendy podglądu w Minikube).

Repo utrzymuje **dwie ścieżki wdrożenia**:
- **Helm Chart** (zalecane do instalacji/parametryzacji + testy `helm test`),
- **Plain manifests (`k8s/`)** jako deklaratywna wersja referencyjna.

> Uwaga praktyczna: w repo są też dodatkowe materiały w `.github/instructions/` – traktuj je jako „playbook” dla współpracy (np. z agentem w VS Code).

---

## 0) Minikube – komendy „operatorskie” (start/stop/status/dashboard)

Start klastra (Calico jest wymagane dla NetworkPolicy):
```bash
minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
```
Addons (Ingress + Metrics Server dla HPA):
```bash
minikube addons enable ingress
minikube addons enable metrics-server
```

Status / diagnostyka:
```bash
minikube status
kubectl get nodes -o wide
kubectl -n kube-system get pods
```

Dashboard:
```bash
minikube dashboard
# albo port-forward:
minikube dashboard --url
```

Tunnel (czasem wymagany zależnie od drivera / środowiska):
```bash
minikube tunnel
```

Zatrzymanie / pauza:
```bash
minikube stop
minikube pause
minikube unpause
```

Pełne usunięcie klastra (hard reset):
```bash
minikube delete
# a potem ponowny start:
minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
```

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

**Wybrany stack (wymagania):** JavaScript – Ruby – SQLite – Rails

> Wymaganie “JavaScript” jest spełnione przez frontend (Nginx serwuje prosty UI w HTML/JS).
> Celem projektu jest walidacja stacka + wdrożenia K8s (nie rozbudowane SPA).

---

## 2) Architektura stack-a

**Stack:** Ruby on Rails (Backend/API), SQLite (DB), Nginx (Frontend/Proxy), Kubernetes (Minikube)

### Obiekty K8s (minimum wymagane)
- `StatefulSet` (backend Rails + SQLite)
- `PersistentVolumeClaim` (trwałość SQLite)
- `Deployment` (frontend Nginx – bezstanowy)
- `Service` (frontend + backend)
- `ConfigMap` (konfiguracja Rails, config Nginx, statyczny frontend)
- `Secret` (SECRET_KEY_BASE)
- `Ingress` (`library.local`)

Dodatkowe:
- `NetworkPolicy` (least privilege)
- `HPA` (frontend)
- `resources` (requests/limits) – wymagane dla HPA
- `probes`: liveness/readiness/startup
- `PDB`, `automountServiceAccountToken: false`, `affinity/podAntiAffinity`
- (w Helm) testy `helm test` + RBAC demo

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
  |      Service: rails-backend-svc (ClusterIP)
  |         |
  v         v
Static UI   Pod: rails-backend-0 (StatefulSet, SQLite na PVC /rails/storage)
```

### Backend Services – headless vs ClusterIP

Backend ma **dwa Service**:
- `rails-backend` (**headless**, `clusterIP: None`) – wspiera StatefulSet (`spec.serviceName`) i stabilną tożsamość/DNS poda.
- `rails-backend-svc` (**ClusterIP**) – stabilny endpoint dla Nginx (`proxy_pass`) i testów.

### Secrets i values
W Helm domyślne ustawienia są w `helm-chart/neighborly-library/values.yaml`, a wartości wrażliwe (np. `SECRET_KEY_BASE`) przekazujemy w czasie instalacji/upgrade.


Rails w trybie `production` wymaga ustawienia `SECRET_KEY_BASE`. W repo są dwie ścieżki wdrożenia:

#### Helm (wymuszone przez `required`)
W Helm Secret jest generowany z template i ma walidację:

- template używa:
  - `required "backend.secret.SECRET_KEY_BASE is required" .Values.backend.secret.SECRET_KEY_BASE`

To znaczy: **jeśli nie podasz wartości – `helm upgrade/install` przerwie się z błędem** (celowe i bezpieczne).

**Instalacja/upgrade z ustawieniem sekretu:**
```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library \
  --namespace library --create-namespace \
  --set backend.image=neighborly-backend:latest \
  --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require "securerandom"; puts SecureRandom.hex(64)')"
```

**Kolejne upgrady (bez ponownego generowania):**
```bash
helm upgrade neighborly ./helm-chart/neighborly-library -n library --reuse-values
```

#### Plain manifests (`k8s/`) – placeholder + podmiana przy deployu
W `k8s/` Secret ma placeholder:
- `SECRET_KEY_BASE: "replace-me-with-a-real-secret"`

**Bezpieczna praktyka:** nie commitujemy prawdziwych sekretów. Podmieniamy je w czasie wdrożenia, np.:

Opcja A (wygeneruj i zastosuj Secret bez edycji pliku):
```bash
kubectl -n library-k8s create secret generic rails-secrets \
  --from-literal=SECRET_KEY_BASE="$(ruby -e 'require "securerandom"; puts SecureRandom.hex(64)')" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Dlaczego StatefulSet dla SQLite?

SQLite to baza plikowa – zapis musi trafiać na trwały wolumen (PVC). Backend pozostaje pojedynczą instancją (**replicas=1**) z powodu ograniczeń współbieżnego zapisu do jednego pliku DB.
StatefulSet zapewnia:
- stałą tożsamość poda (`rails-backend-0`),
- powiązanie z tym samym PVC po restarcie.

> Jeśli kiedykolwiek chcesz **2 instancje backendu**, w praktyce oznacza to zmianę DB (np. Postgres) albo inny model persystencji.



---

## 2.1) Źródła prawdy dla frontendu (ważne info o „dryfie”)

Na tym etapie repo celowo trzyma **kilka kopii** frontendu (dla wygody w labach), ale to może powodować „działa stara wersja”:
- katalog `frontend/` (źródło plików),
- ConfigMap dla plain K8s w `k8s/` (statyczny snapshot),
- pliki dla Helma (ConfigMap generowana z chartu).

**Zasada:** jeśli zmieniasz UI – pilnuj, którą ścieżkę wdrożenia testujesz (Helm vs `k8s/`).

---

## 3) Przebieg wdrożenia

### A) Przygotowanie klastra (Minikube)

1) Start Minikube z Calico:
```bash
minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
```

2) Addons:
```bash
minikube addons enable ingress
minikube addons enable metrics-server
```

Szybkie sprawdzenie:
```bash
kubectl -n kube-system get pods | egrep -i "metrics-server|ingress-nginx|calico|tigera" || true
```

### B) Budowa obrazu backendu (ważne)

Backend jest w katalogu `neighborly_things_library/` (submodule).  
Dockerfile ma różne stage – w K8s potrzebujesz **prod stage**.

```bash
eval "$(minikube docker-env)"
cd neighborly_things_library
docker build --target prod -t neighborly-backend:latest .
cd ..
```

### C) Wdrożenie (2 ścieżki)

#### 1) Helm (zalecane)
```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library   --namespace library --create-namespace   --set backend.image=neighborly-backend:latest   --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require "securerandom"; puts SecureRandom.hex(64)')"
```

Podgląd:
```bash
kubectl -n library get pods,svc,ingress,hpa
```

#### 2) Plain YAML (k8s/)
Najprościej uruchamiać w osobnym namespace (żeby nie mieszać z Helm):
```bash
kubectl create ns library-k8s --dry-run=client -o yaml | kubectl apply -f -
kubectl -n library-k8s apply -f k8s/
kubectl -n library-k8s get pods,svc,ingress,hpa
```

> Manifesty w `k8s/` mają `metadata.namespace` ustawione „na sztywno”, flaga `-n` nie zmieni namespace.

### D) Dostęp zewnętrzny (Ingress / hosts)

1) IP minikube + ingress:
```bash
minikube ip
kubectl -n library get ingress -o wide
# albo w wersji plain:
kubectl -n library-k8s get ingress -o wide
```

2) `/etc/hosts`:
- `<MINIKUBE_IP> library.local`

```bash
echo "$(minikube ip) library.local" | sudo tee -a /etc/hosts

```


> Zależnie od drivera czasem potrzebujesz `minikube tunnel`.
> Mapuj host na to, co widzisz w `kubectl get ingress -o wide` (kolumna ADDRESS).

---

## 4) Test poprawności działania

### Test 1: Ingress + UI
```bash
curl -sS -I http://library.local/
```
Oczekiwane: `200 OK` z Nginx.

### Test 2: Healthcheck backendu
```bash
curl -sS http://library.local/healthz
```
Oczekiwane: `200`.

### Test 3: CRUD przedmiotów (API)

Dodanie:
```bash
curl -sS -i -X POST http://library.local/api/items   -H 'Content-Type: application/json'   -d '{"item":{"name":"Wiertarka","category":"Narzedzia","condition":"Dobry"}}'
```
Krótka lista
```bash
curl -sS -i -X POST http://library.local/api/items   -H 'Content-Type: application/json'   -d '{"item":{"name":"Wiertarka","category":"Narzedzia","condition":"Dobry"}}'
curl -sS -i -X POST http://library.local/api/items   -H 'Content-Type: application/json'   -d '{"item":{"name":"Rzutnik","category":"Potworek","condition":"Złowrogi"}}'
curl -sS -i -X POST http://library.local/api/items   -H 'Content-Type: application/json'   -d '{"item":{"name":"Rower z ekrspresem do kawy","category":"Pojazd","condition":"Sprawny"}}'
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
3) Sprawdź listę – rekord powinien pozostać:
```bash
curl -sS http://library.local/api/items
```

### Test 5: NetworkPolicy (least privilege)

**A) “Hacker” (powinno być zablokowane):**
```bash
kubectl -n library run hacker --image=busybox -it --rm --restart=Never -- sh
# w środku:
wget -qO- http://rails-backend-svc/healthz
```
Oczekiwane: timeout / brak połączenia.

**B) Test pozytywny (z frontendu):**
```bash
FRONT_POD="$(kubectl -n library get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}')"
kubectl -n library exec -it "$FRONT_POD" -- sh -lc 'wget -qSO- http://rails-backend-svc/healthz 2>&1 | head -n 20'
```
Oczekiwane: `200 OK`.

### Test 6: HPA (autoskalowanie frontendu)

1) Status i metryki:
```bash
kubectl -n library get hpa
kubectl -n library describe hpa frontend-hpa || true
kubectl top pods -n library || true
```

Jeśli widzisz `<unknown>` przy HPA:
- upewnij się, że działa metrics-server:
```bash
kubectl -n kube-system get pods | grep metrics-server || true
kubectl get apiservices | grep metrics || true
```

2) Load generator (ważne: NetworkPolicy może blokować „losowe” pody)
- **wariant A (najprostszy):** generuj ruch z namespace `ingress-nginx`:
```bash
kubectl -n ingress-nginx run load-generator --image=busybox -it --rm --restart=Never --   sh -c 'while true; do wget -q -O- http://frontend.library.svc.cluster.local/ >/dev/null; done'
```

- **wariant B (jeśli polityka pozwala na label):** generator w `library` z etykietą dopuszczoną przez allow-rule:
```bash
kubectl -n library run load-generator --image=busybox -it --rm --restart=Never   --labels app.kubernetes.io/component=helm-test --   sh -c 'while true; do wget -q -O- http://frontend >/dev/null; done'
```

- **wariant C (z hosta):**
```bash
while true; do curl -sS http://library.local/ >/dev/null; done
```
- **wariant D (z użyciem skryptu pochodzącego z repo aplikacji):**
```bash
cd neighborly_things_library/ 
SEED_ITEMS=20000 SEED_CONCURRENCY=20 BASE_URL=http://library.local/  ./scripts/api_smoke_and_bench.sh
```


3) Obserwuj skalowanie:
```bash
watch kubectl -n library get hpa
watch kubectl -n library get pods -l app=frontend
```

---

## 5) Helm test suite – co to znaczy?

Jeśli w `helm upgrade --install ...` widzisz `TEST SUITE: None`, oznacza to, że chart **nie zawiera** zasobów `helm test`
(Pod/Job z adnotacją `helm.sh/hook: test`).

W tym repo **chart zawiera testy**, więc:
```bash
helm test neighborly -n library
```

### Podejrzenie logów z testów (wariant „na szybko”)

Jeśli używasz `--logs`, czasem możesz zobaczyć komunikat typu `pod ... not found` – to normalne, gdy testowy Pod został już usunięty po sukcesie.
W praktyce działa „złapanie” logów od razu po starcie testów:

```bash
helm test neighborly -n library --logs
# jeśli logów brakuje, spróbuj szybko:
kubectl -n library logs -l "helm.sh/hook=test" --tail=200 || true
kubectl -n library get pods -l "helm.sh/hook=test"
```

---

## 6) RBAC (Role/RoleBinding + ServiceAccount)

RBAC w K8s to: **Role/RoleBinding** przypisywane do **Subject** (użytkownik/grupa/ServiceAccount) i ograniczające działania (verbs) na zasobach (resources).
Najprostszy scenariusz:
- utworzyć ServiceAccount,
- utworzyć Role (np. `get/list pods`),
- utworzyć RoleBinding wiążący Role z ServiceAccount,
- uruchomić Pod z tym SA i wykonać test dostępu do API.

Pomocniczo:
```bash
kubectl auth can-i get pods -n library
kubectl auth can-i list pods -n library
```

> Uwaga: aplikacyjne Pody mogą mieć `automountServiceAccountToken: false` (lepsze security).
> Dla testów RBAC chart tworzy osobne zasoby testowe z dedykowanym SA.

Testy RBAC (Helm):
```bash
helm test neighborly -n library
```

---

## 7) „Clean-room” – usuń i odtwórz (Helm → plain → Helm)

### A) Usuń wdrożenie Helm (i wyczyść namespace)
```bash
helm -n library uninstall neighborly
kubectl -n library get all,ingress,cm,secret,pvc || true

# hard reset (usuwa wszystko w namespace, włącznie z PVC -> dane SQLite znikną):
kubectl delete ns library
```

### B) Postaw plain w `library-k8s`
```bash
kubectl create ns library-k8s --dry-run=client -o yaml | kubectl apply -f -
kubectl -n library-k8s apply -f k8s/
kubectl -n library-k8s get pods,svc,ingress,hpa
```

Test:
```bash
curl -sS -I http://library.local/
curl -sS http://library.local/healthz
```

Cleanup:
```bash
kubectl delete ns library-k8s
```

### C) Postaw z powrotem Helm
```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library   --namespace library --create-namespace   --set backend.image=neighborly-backend:latest   --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require "securerandom"; puts SecureRandom.hex(64)')"

kubectl -n library get pods,svc,ingress,hpa
helm test neighborly -n library
```

## 8) Affinity (frontend) – rozkład replik na węzłach

Dla frontendu (`Deployment`) dodaliśmy **podAntiAffinity** w trybie *soft* (`preferredDuringSchedulingIgnoredDuringExecution`).
Cel: gdy klaster ma **więcej niż 1 node**, Kubernetes będzie **preferował rozkład replik frontendu na różne węzły** (`topologyKey: kubernetes.io/hostname`).
Na 1-node Minikube ta reguła nie zmienia zachowania, ale też **nie psuje schedulingu**.

### Co dokładnie dodaliśmy?
W `Deployment` frontendu (Helm i analogicznie w plain, jeśli utrzymujesz oba źródła) jest:

- `affinity.podAntiAffinity.preferredDuringSchedulingIgnoredDuringExecution`
- selector po labelu `app: frontend` (w Helm: `{{ include "nl.frontendName" . }}`)

### Jak to przetestować 


1) Uruchom Minikube jako multi-node (np. 2 węzły):
```bash
minikube delete
minikube start --nodes=2 --network-plugin=cni --cni=calico --cpus=2 --memory=4096
minikube addons enable ingress
minikube addons enable metrics-server
kubectl get nodes -o wide
```

2) Zainstaluj chart (lub odtwórz plain), a potem sprawdź na jakich node’ach stoją pody:
```bash
kubectl -n library get pods -l app=frontend -o wide
```

Oczekiwane: przy `replicas >= 2` zobaczysz pody na różnych node’ach (o ile scheduler ma taką możliwość).

3) Dodatkowo podejrzyj decyzje schedulera:
```bash
kubectl -n library describe pod -l app=frontend | sed -n '1,120p'
```

### Alternatywa: topologySpreadConstraints
Zamiast (lub obok) `podAntiAffinity` można użyć `topologySpreadConstraints`, które często są czytelniejsze do “równomiernego” rozkładania podów:

- `topologyKey: kubernetes.io/hostname`
- `maxSkew: 1`
- `whenUnsatisfiable: ScheduleAnyway` (soft) lub `DoNotSchedule` (hard)

Tylko rozważenie – szczególnie jeśli chcemy precyzyjnej kontroli rozkładu replik.
