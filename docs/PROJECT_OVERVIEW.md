# Sąsiedzka Biblioteka Rzeczy – opis projektu

Ten dokument opisuje **ideę aplikacji**, **architekturę stacka**, **przebieg wdrożenia** na Minikube oraz **testy poprawności działania**.

---

## 1) Idea przykładowej aplikacji

**Nazwa:** Sąsiedzka Biblioteka Rzeczy (Neighborly Things Library)

**Story:** mieszkańcy osiedla chcą współdzielić rzadko używane przedmioty (np. wiertarka, rzutnik, maszyna do szycia), aby nie kupować ich na własność.

**Funkcje (MVP):**
- Dodawanie „przedmiotów” do katalogu
- Wyświetlanie listy przedmiotów + status dostępności
- Wypożyczanie przedmiotu (przypisanie do pożyczającego)
- Zwrot przedmiotu

**Warstwy aplikacji:**
- **Backend (Rails + SQLite):** API JSON (`/api/*`) + healthcheck (`/healthz`)
- **Frontend (Nginx + statyczny JS):** prosta aplikacja web (HTML/CSS/JS) wywołująca API

> Uwaga o „więcej JS”: wymagania stacka zawierają „JavaScript”, bo UI jest napisane w JS (tu: lekki, statyczny frontend). Rails w tym projekcie jest backendem API.

---

## 2) Architektura stack-a

**Stack:** Ruby on Rails (Backend), SQLite (DB), Nginx (Frontend/Proxy), Kubernetes (Minikube)

### Komponenty w klastrze
- **Backend**: `StatefulSet` (1 replika) + `PVC` na plik SQLite
- **Frontend**: `Deployment` (skalowalny) + `Service` (ClusterIP)
- **Ingress**: routing hosta `library.local` do frontendu
- **NetworkPolicy**: zasada *least privilege* (domyślnie deny-all, potem allow chain)
- **HPA**: autoskalowanie frontendu na podstawie CPU

### Diagram przepływu ruchu

```
Internet/Browser
   |
   v
Ingress Controller (ingress-nginx)
   |
   v
Service: library-frontend (ClusterIP)
   |
   v
Pods: library-frontend (Nginx)
   |        \
   |         \  /api/*
   |          v
   |      Service: library-backend (Headless)
   |          |
   v          v
Static UI   Pod: library-backend-0 (Rails + SQLite on PVC)
```

### Dlaczego StatefulSet dla SQLite?
SQLite to baza plikowa. Dane muszą być przechowywane na trwałym wolumenie (PVC), a backend nie może być bezpiecznie skalowany horyzontalnie dla zapisu. `StatefulSet` zapewnia:
- stabilną tożsamość poda (`*-0`)
- powiązanie z tym samym PVC po restarcie

---

## 3) Przebieg wdrożenia

Poniżej przebieg w modelu labowym (Minikube) – zgodny z PRD.

### A) Przygotowanie klastra
1. Start Minikube z Calico (NetworkPolicy):
   ```bash
   minikube start --network-plugin=cni --cni=calico --cpus=2 --memory=4096
   ```
2. Włącz dodatki:
   ```bash
   minikube addons enable ingress
   minikube addons enable metrics-server
   ```

### B) Budowa obrazów (lokalnie w Minikube)
Zobacz: `docs/BUILD_IMAGES.md`.

### C) Wdrożenie
Masz dwie ścieżki:

**1) Helm (zalecane, Lab 11):**
```bash
helm upgrade --install neighborly ./helm-chart/neighborly-library \
  --namespace library \
  --set backend.image=neighborly-backend:latest \
  --set-string backend.secret.SECRET_KEY_BASE="$(ruby -e 'require \"securerandom\"; puts SecureRandom.hex(64)')"

```

**2) Plain YAML (k8s/):**
```bash
kubectl apply -f k8s/
```

### D) Dostęp zewnętrzny
1. Ustal IP:
   ```bash
   minikube ip
   kubectl get ingress -n library -o wide
   ```
2. Dodaj `library.local` do hosts:
   - Najczęściej: `<MINIKUBE_IP> library.local`
   - Jeśli używasz `minikube tunnel` i Ingress dostaje `127.0.0.1`, wtedy mapuj `127.0.0.1 library.local`

---

## 4) Test poprawności działania

### Test 1: Healthcheck backendu
```bash
curl -sS http://library.local/healthz
```
Oczekiwane: JSON `{ "status": "ok" }`.

### Test 2: CRUD przedmiotów
```bash
# dodaj przedmiot
curl -sS -X POST http://library.local/api/items \
  -H 'Content-Type: application/json' \
  -d '{"item":{"name":"Wiertarka","category":"Narzędzia","condition":"Dobry","description":"Bosch"}}'

# pobierz listę
curl -sS http://library.local/api/items
```

### Test 3: Wypożyczenie i zwrot
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

### Test 4: Trwałość danych (StatefulSet + PVC)
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

### Test 6: HPA (autoskalowanie frontendu)
1. Sprawdź HPA:
   ```bash
   kubectl get hpa -n library
   ```
2. Wygeneruj ruch (np. kilka razy odśwież UI lub curl w pętli) i obserwuj skalowanie.

---

## Powiązane pliki
- `docs/README.md` – szybki start
- `docs/BEST_PRACTICES.md` – zasady wdrożeniowe
- `docs/BUILD_IMAGES.md` – budowa obrazów (backend + frontend)
- `.github/instructions/k8s_helm_playbook.md` – playbook dla agenta/CI
