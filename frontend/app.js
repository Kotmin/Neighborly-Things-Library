const $ = (sel) => document.querySelector(sel);

async function jsonFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof body === "string" ? body : (body.message || body.error || JSON.stringify(body));
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return body;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

function renderItems(items) {
  const tbody = $("#items");
  tbody.innerHTML = "";
  for (const item of items) {
    const tr = document.createElement("tr");
    const badge = item.available ? '<span class="badge ok">tak</span>' : '<span class="badge no">nie</span>';
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.condition)}</td>
      <td>${badge}</td>
      <td>
        <button class="mini" data-action="borrow" data-id="${item.id}" ${item.available ? "" : "disabled"}>Wypożycz</button>
        <button class="mini" data-action="return" data-id="${item.id}" ${item.available ? "disabled" : ""}>Zwróć</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

async function refreshItems() {
  try {
    $("#items-result").textContent = "Ładowanie…";
    const items = await jsonFetch("/api/items");
    renderItems(items);
    $("#items-result").textContent = `OK • ${items.length} rekordów`;
  } catch (e) {
    $("#items-result").textContent = `Błąd: ${e.message}`;
  }
}

async function createItem(form) {
  const data = Object.fromEntries(new FormData(form));
  try {
    $("#create-item-result").textContent = "Zapisywanie…";
    const item = await jsonFetch("/api/items", {
      method: "POST",
      body: JSON.stringify({ item: data }),
    });
    $("#create-item-result").textContent = `Dodano: #${item.id} ${item.name}`;
    form.reset();
    await refreshItems();
  } catch (e) {
    $("#create-item-result").textContent = `Błąd: ${e.message}`;
  }
}

async function borrow(itemId, borrowerName) {
  try {
    $("#loan-result").textContent = "Wypożyczanie…";
    const loan = await jsonFetch("/api/loans", {
      method: "POST",
      body: JSON.stringify({ item_id: itemId, borrower_name: borrowerName }),
    });
    $("#loan-result").textContent = `OK • wypożyczono #${loan.item_id} dla ${loan.borrower_name}`;
    await refreshItems();
  } catch (e) {
    $("#loan-result").textContent = `Błąd: ${e.message}`;
  }
}

async function returnItem(itemId) {
  try {
    $("#loan-result").textContent = "Zwracanie…";
    const loan = await jsonFetch("/api/returns", {
      method: "POST",
      body: JSON.stringify({ item_id: itemId }),
    });
    $("#loan-result").textContent = `OK • zwrócono #${loan.item_id} (ostatni wypożyczający: ${loan.borrower_name})`;
    await refreshItems();
  } catch (e) {
    $("#loan-result").textContent = `Błąd: ${e.message}`;
  }
}

async function health() {
  try {
    const res = await jsonFetch("/healthz", { headers: { "Accept": "application/json" } });
    $("#health-result").textContent = JSON.stringify(res, null, 2);
  } catch (e) {
    $("#health-result").textContent = `Błąd: ${e.message}`;
  }
}

// Wire UI
$("#refresh").addEventListener("click", refreshItems);
$("#health").addEventListener("click", health);

$("#create-item-form").addEventListener("submit", (e) => {
  e.preventDefault();
  createItem(e.target);
});

$("#borrow").addEventListener("click", () => {
  const id = Number($("#item-id").value);
  const name = $("#borrower-name").value.trim();
  if (!id || !name) {
    $("#loan-result").textContent = "Podaj ID przedmiotu i imię wypożyczającego.";
    return;
  }
  borrow(id, name);
});

$("#return").addEventListener("click", () => {
  const id = Number($("#item-id").value);
  if (!id) {
    $("#loan-result").textContent = "Podaj ID przedmiotu.";
    return;
  }
  returnItem(id);
});

// Row actions
$("#items").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;

  if (action === "borrow") {
    const name = prompt("Podaj imię wypożyczającego:");
    if (!name) return;
    borrow(id, name.trim());
  } else if (action === "return") {
    returnItem(id);
  }
});

// Initial load
refreshItems();
