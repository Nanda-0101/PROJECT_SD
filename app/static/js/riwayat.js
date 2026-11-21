/* Halaman Riwayat.
   Mengambil data dari API /api/history lalu merender tabel, kartu, chip kategori,
   pagination, ringkasan statistik, modal detail, hapus, dan ekspor CSV.
   Bergantung pada config.js dan common.js yang menyediakan SL_CONFIG dan SL. */
(() => {
  "use strict";

  const { escapeHtml, fmt, toast, setLoading } = window.SL;
  const API = (window.SL_CONFIG?.HISTORY_API_BASE || "/api/history").replace(/\/$/, "");
  const PAGES = window.SL.PAGES;
  const SEARCH_DELAY_MS = 300;
  const TABLE_COLUMNS = 9;

  /* ---------- State ---------- */
  const state = {
    page: 1,
    perPage: 10,
    total: 0,
    q: "",
    category: "",
    sort: "desc",
    range: "0",
    view: "table",
    items: [],
    selected: new Set(),
    pendingAction: null, // fungsi async yang dijalankan saat tombol Hapus di modal ditekan
  };

  /* ---------- Elemen ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    search: $("fSearch"),
    category: $("fCategory"),
    sort: $("fSort"),
    range: $("fRange"),
    chips: $("catChips"),
    tableWrap: $("tableWrap"),
    body: $("historyBody"),
    cards: $("cardList"),
    selAll: $("selAll"),
    bulkBar: $("bulkBar"),
    bulkCount: $("bulkCount"),
    pager: $("pager"),
    resultCount: $("resultCount"),
    loadError: $("loadError"),
    printMeta: $("printMeta"),
    detailBody: $("detailBody"),
    confirmTitle: $("confirmTitle"),
    confirmText: $("confirmText"),
    confirmOk: $("confirmOk"),
  };

  const detailModal = bootstrap.Modal.getOrCreateInstance($("detailModal"));
  const confirmModal = bootstrap.Modal.getOrCreateInstance($("confirmModal"));

  /* ---------- Helper tampilan ---------- */
  const dateFormat = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  function formatDate(iso) {
    if (!iso) return "-";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "-" : dateFormat.format(date);
  }

  // Nilai kosong ditampilkan sebagai tanda hubung. Selain itu di-escape.
  function show(value, suffix = "") {
    if (value === null || value === undefined || value === "") return "-";
    return escapeHtml(value) + suffix;
  }

  function badge(category) {
    return `<span class="badge rounded-pill cat-${escapeHtml(category.key)}" style="background:var(--cat)">${escapeHtml(category.name)}</span>`;
  }

  function confidenceCell(value) {
    if (value === null || value === undefined) return "-";
    return `<div class="conf-cell">
      <div class="mini-bar"><i style="width:${value}%;background:var(--cat)"></i></div>
      <b>${fmt(value, 1)}%</b>
    </div>`;
  }

  function hasActiveFilter() {
    return Boolean(state.q || state.category || state.range !== "0");
  }

  /* ---------- API ---------- */
  async function api(path, options = {}) {
    const headers = { Accept: "application/json" };
    if (options.body) headers["Content-Type"] = "application/json";

    const res = await fetch(`${API}${path}`, { credentials: "include", ...options, headers });
    if (res.status === 401) {
      window.location.href = PAGES.masuk;
      throw new Error("Sesi berakhir. Silakan masuk kembali.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Permintaan gagal (HTTP ${res.status}).`);
    return data;
  }

  // Parameter yang memengaruhi isi hasil. Dipakai oleh daftar, statistik, dan ekspor.
  function filterParams() {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.category) params.set("category", state.category);
    if (state.range !== "0") params.set("range", state.range);
    return params;
  }

  function listParams() {
    const params = filterParams();
    params.set("sort", state.sort);
    params.set("page", state.page);
    params.set("per_page", state.perPage);
    return params;
  }

  /* ---------- Muat data ---------- */
  let requestSeq = 0;

  async function load() {
    // Nomor urut mencegah respons lama menimpa respons yang lebih baru saat user mengetik cepat.
    const mine = ++requestSeq;
    el.body.setAttribute("aria-busy", "true");
    try {
      const [list, stats] = await Promise.all([
        api(`?${listParams()}`),
        api(`/stats?${filterParams()}`),
      ]);
      if (mine !== requestSeq) return;

      state.items = list.items;
      state.page = list.pagination.page;
      state.perPage = list.pagination.per_page;
      state.total = list.pagination.total;
      state.selected.clear();

      hideError();
      renderChips(list.counts);
      renderBody();
      renderPager(list.pagination);
      renderCount();
      renderStats(stats);
      renderBulkBar();
    } catch (err) {
      if (mine === requestSeq) showError(err.message);
    } finally {
      if (mine === requestSeq) el.body.removeAttribute("aria-busy");
    }
  }

  function showError(message) {
    el.loadError.textContent = message;
    el.loadError.hidden = false;
  }

  function hideError() {
    el.loadError.hidden = true;
  }

  function reloadFromFirstPage() {
    state.page = 1;
    load();
  }

  /* ---------- Render ---------- */
  function renderChips(counts) {
    el.chips.querySelectorAll(".chip").forEach((chip) => {
      const key = chip.dataset.key;
      const active = key === state.category;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", String(active));
      chip.querySelector(".num").textContent = counts[key === "" ? "all" : key] ?? 0;
    });
  }

  function emptyStateHtml() {
    if (hasActiveFilter()) {
      return `<div class="empty-state">
        <i class="bi bi-funnel" aria-hidden="true"></i>
        <p class="mt-2 mb-3">Tidak ada riwayat yang cocok dengan filter.</p>
        <button type="button" class="btn btn-outline-secondary btn-sm" data-action="reset">
          <i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i> Reset filter
        </button>
      </div>`;
    }
    return `<div class="empty-state">
      <i class="bi bi-inbox" aria-hidden="true"></i>
      <p class="mt-2 mb-3">Belum ada riwayat klasifikasi</p>
      <a href="${PAGES.klasifikasi}" class="btn btn-sl btn-sm">
        <i class="bi bi-play-circle-fill me-1" aria-hidden="true"></i> Mulai Klasifikasi
      </a>
    </div>`;
  }

  function actionButtons(id) {
    return `<div class="row-actions">
      <button type="button" class="btn btn-outline-primary btn-sm" data-action="detail" data-id="${id}"
              title="Lihat detail" aria-label="Lihat detail riwayat">
        <i class="bi bi-eye" aria-hidden="true"></i>
      </button>
      <button type="button" class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${id}"
              title="Hapus" aria-label="Hapus riwayat">
        <i class="bi bi-trash3" aria-hidden="true"></i>
      </button>
    </div>`;
  }

  function checkbox(id, label) {
    const checked = state.selected.has(id) ? "checked" : "";
    return `<input type="checkbox" class="form-check-input row-check" data-id="${id}" aria-label="${label}" ${checked} />`;
  }

  function rowHtml(item, index) {
    const number = (state.page - 1) * state.perPage + index + 1;
    return `<tr class="cat-${escapeHtml(item.category.key)}">
      <td>${checkbox(item.id, `Pilih riwayat nomor ${number}`)} <span class="ms-1">${number}</span></td>
      <td>${formatDate(item.predicted_at)}</td>
      <td>${show(item.age)}</td>
      <td>${show(item.gender)}</td>
      <td>${show(item.height, " cm")}</td>
      <td>${show(item.activity)}</td>
      <td>${badge(item.category)}</td>
      <td>${confidenceCell(item.confidence)}</td>
      <td>${actionButtons(item.id)}</td>
    </tr>`;
  }

  function cardHtml(item, index) {
    const number = (state.page - 1) * state.perPage + index + 1;
    return `<div class="col-md-6 col-xl-4">
      <div class="hist-card cat-${escapeHtml(item.category.key)}">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <div class="fw-bold fs-5">${escapeHtml(item.category.name)}</div>
            <div class="small text-muted">${formatDate(item.predicted_at)}</div>
          </div>
          ${checkbox(item.id, `Pilih riwayat nomor ${number}`)}
        </div>
        <div class="small mb-1">${show(item.age, " tahun")} &middot; ${show(item.gender)} &middot; ${show(item.height, " cm")}</div>
        <div class="small text-muted mb-3">Olahraga ${show(item.activity)}</div>
        ${confidenceCell(item.confidence)}
        <div class="mt-3">${actionButtons(item.id)}</div>
      </div>
    </div>`;
  }

  // Hanya tampilan yang sedang aktif yang dirender agar tidak ada checkbox ganda.
  function renderBody() {
    const asTable = state.view === "table";
    el.tableWrap.hidden = !asTable;
    el.cards.hidden = asTable;

    if (asTable) {
      el.body.innerHTML = state.items.length
        ? state.items.map(rowHtml).join("")
        : `<tr><td colspan="${TABLE_COLUMNS}">${emptyStateHtml()}</td></tr>`;
    } else {
      el.cards.innerHTML = state.items.length
        ? state.items.map(cardHtml).join("")
        : `<div class="col-12">${emptyStateHtml()}</div>`;
    }
  }

  function pageWindow(page, pages) {
    // Selalu tampilkan halaman pertama, terakhir, dan tetangga halaman aktif.
    const numbers = [...new Set([1, pages, page - 1, page, page + 1])]
      .filter((n) => n >= 1 && n <= pages)
      .sort((a, b) => a - b);
    const result = [];
    numbers.forEach((n, i) => {
      if (i > 0 && n - numbers[i - 1] > 1) result.push("gap");
      result.push(n);
    });
    return result;
  }

  function renderPager({ page, pages }) {
    if (pages <= 1) {
      el.pager.innerHTML = "";
      return;
    }
    const item = (label, target, { disabled = false, active = false, aria = "" } = {}) =>
      `<li class="page-item${disabled ? " disabled" : ""}${active ? " active" : ""}">
        <button type="button" class="page-link" data-page="${target}" ${disabled ? "disabled" : ""}
                ${active ? 'aria-current="page"' : ""} ${aria ? `aria-label="${aria}"` : ""}>${label}</button>
      </li>`;

    const parts = [item("&laquo;", page - 1, { disabled: page === 1, aria: "Halaman sebelumnya" })];
    pageWindow(page, pages).forEach((n) => {
      parts.push(
        n === "gap"
          ? '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>'
          : item(n, n, { active: n === page })
      );
    });
    parts.push(item("&raquo;", page + 1, { disabled: page === pages, aria: "Halaman berikutnya" }));
    el.pager.innerHTML = parts.join("");
  }

  function renderCount() {
    if (!state.total) {
      el.resultCount.textContent = "0 hasil";
      return;
    }
    const from = (state.page - 1) * state.perPage + 1;
    const to = from + state.items.length - 1;
    el.resultCount.textContent = `Menampilkan ${from} sampai ${to} dari ${state.total} hasil`;
  }

  function renderStats(stats) {
    const percent = (value) => (value === null ? "-" : `${fmt(value, 1)}%`);
    $("riwayatTotal").textContent = stats.total;
    $("riwayatAvgConf").textContent = percent(stats.avg_confidence);
    $("riwayatMaxConf").textContent = percent(stats.max_confidence);
    $("riwayatMinConf").textContent = percent(stats.min_confidence);
    $("riwayatTopCat").textContent = stats.top_category
      ? `${stats.top_category.name} (${stats.top_category.count})`
      : "—";
  }

  function renderBulkBar() {
    const count = state.selected.size;
    el.bulkBar.hidden = count === 0;
    el.bulkCount.textContent = count;

    const onPage = state.items.length;
    el.selAll.checked = onPage > 0 && count === onPage;
    el.selAll.indeterminate = count > 0 && count < onPage;
  }

  /* ---------- Detail ---------- */
  function feedbackText(feedback) {
    if (!feedback) return "Belum dinilai";
    return feedback.is_accurate ? "Hasil dinilai akurat" : "Hasil dinilai kurang akurat";
  }

  function renderDetail(d) {
    const probabilities = d.probabilities
      .map(
        (p) => `<div class="mb-2 cat-${escapeHtml(p.key)}">
          <div class="d-flex justify-content-between small">
            <span>${escapeHtml(p.name)}</span><b>${fmt(p.probability, 2)}%</b>
          </div>
          <div class="mini-bar"><i style="width:${p.probability}%;background:var(--cat)"></i></div>
        </div>`
      )
      .join("");

    const features = d.features
      .map((f) => `<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.text)}</dd>`)
      .join("");

    el.detailBody.innerHTML = `
      <div class="cat-${escapeHtml(d.category.key)} mb-3">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
          ${badge(d.category)}
          <span class="small text-muted">${formatDate(d.predicted_at)}</span>
        </div>
        <div class="small">Keyakinan model <b>${show(d.confidence === null ? null : fmt(d.confidence, 2), "%")}</b>
          &middot; ${escapeHtml(feedbackText(d.feedback))}</div>
      </div>
      <h3 class="h6">Probabilitas per kategori</h3>
      <div class="mb-3">${probabilities || '<p class="small text-muted mb-0">Data probabilitas tidak tersedia.</p>'}</div>
      <h3 class="h6">Data masukan</h3>
      <dl class="detail-grid small">${features}</dl>`;
  }

  async function openDetail(id) {
    el.detailBody.innerHTML = '<p class="text-muted mb-0">Memuat detail...</p>';
    detailModal.show();
    try {
      renderDetail(await api(`/${id}`));
    } catch (err) {
      el.detailBody.innerHTML = "";
      const p = document.createElement("p");
      p.className = "text-danger mb-0";
      p.textContent = err.message;
      el.detailBody.append(p);
    }
  }

  /* ---------- Hapus ---------- */
  function askConfirm({ title, text, action }) {
    state.pendingAction = action;
    el.confirmTitle.textContent = title;
    el.confirmText.textContent = text;
    confirmModal.show();
  }

  el.confirmOk.addEventListener("click", async () => {
    if (!state.pendingAction) return;
    setLoading(el.confirmOk, true, "Menghapus...");
    try {
      await state.pendingAction();
      confirmModal.hide();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setLoading(el.confirmOk, false);
      state.pendingAction = null;
    }
  });

  function confirmDeleteOne(id) {
    askConfirm({
      title: "Hapus riwayat ini?",
      text: "Riwayat yang dihapus tidak dapat dikembalikan.",
      action: async () => {
        await api(`/${id}`, { method: "DELETE" });
        toast("Riwayat dihapus.");
        await load();
      },
    });
  }

  function confirmDeleteSelected() {
    const ids = [...state.selected];
    askConfirm({
      title: `Hapus ${ids.length} riwayat?`,
      text: "Riwayat yang dipilih akan dihapus permanen.",
      action: async () => {
        const { deleted } = await api("/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
        toast(`${deleted} riwayat dihapus.`);
        await load();
      },
    });
  }

  function confirmDeleteAll() {
    askConfirm({
      title: "Hapus semua riwayat?",
      text: "Seluruh riwayat Anda, termasuk yang tidak tampil karena filter, akan dihapus permanen.",
      action: async () => {
        const { deleted } = await api("", { method: "DELETE" });
        toast(deleted ? `${deleted} riwayat dihapus.` : "Tidak ada riwayat untuk dihapus.", deleted ? "success" : "info");
        state.page = 1;
        await load();
      },
    });
  }

  /* ---------- Ekspor CSV ---------- */
  async function exportCsv() {
    const button = $("btnExport");
    const params = filterParams();
    params.set("sort", state.sort);

    setLoading(button, true, "");
    try {
      const res = await fetch(`${API}/export?${params}`, { credentials: "include" });
      if (res.status === 401) {
        window.location.href = PAGES.masuk;
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ekspor gagal.");
      }
      const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await res.blob());
      link.download = match ? match[1] : "riwayat-klasifikasi.csv";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast("CSV berhasil diunduh.");
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setLoading(button, false);
    }
  }

  
  /* ---------- Cetak ---------- */
function updatePrintMeta() {
  el.printMeta.textContent =
    `Ringkasan riwayat klasifikasi Sakit-Learn, dicetak ${dateFormat.format(new Date())}.`;
}

  /* ---------- Reset filter ---------- */
  function resetFilters() {
    state.q = "";
    state.category = "";
    state.range = "0";
    el.search.value = "";
    el.category.value = "";
    el.range.value = "0";
    reloadFromFirstPage();
  }

  /* ---------- Event ---------- */
  let searchTimer = 0;
  el.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = el.search.value.trim();
      reloadFromFirstPage();
    }, SEARCH_DELAY_MS);
  });

  el.category.addEventListener("change", () => {
    state.category = el.category.value;
    reloadFromFirstPage();
  });

  el.sort.addEventListener("change", () => {
    state.sort = el.sort.value;
    reloadFromFirstPage();
  });

  el.range.addEventListener("change", () => {
    state.range = el.range.value;
    reloadFromFirstPage();
  });

  el.chips.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.key;
    el.category.value = state.category;
    reloadFromFirstPage();
  });

  el.pager.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    load();
  });

  // Satu handler untuk tombol aksi dan checkbox di tabel maupun kartu.
  function handleListClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === "detail") openDetail(id);
    else if (button.dataset.action === "delete") confirmDeleteOne(id);
    else if (button.dataset.action === "reset") resetFilters();
  }

  function handleListChange(event) {
    const box = event.target.closest(".row-check");
    if (!box) return;
    const id = Number(box.dataset.id);
    if (box.checked) state.selected.add(id);
    else state.selected.delete(id);
    renderBulkBar();
  }

  [el.body, el.cards].forEach((host) => {
    host.addEventListener("click", handleListClick);
    host.addEventListener("change", handleListChange);
  });

  el.selAll.addEventListener("change", () => {
    state.selected = new Set(el.selAll.checked ? state.items.map((item) => item.id) : []);
    el.body.querySelectorAll(".row-check").forEach((box) => {
      box.checked = state.selected.has(Number(box.dataset.id));
    });
    renderBulkBar();
  });

  $("btnBulkDelete").addEventListener("click", confirmDeleteSelected);
  $("btnClearAll").addEventListener("click", confirmDeleteAll);
  $("btnExport").addEventListener("click", exportCsv);

  $("btnPrint").addEventListener("click", () => window.print());
  window.addEventListener("beforeprint", updatePrintMeta);

  [["btnViewTable", "table"], ["btnViewCard", "card"]].forEach(([id, view]) => {
    $(id).addEventListener("click", () => {
      state.view = view;
      $("btnViewTable").setAttribute("aria-pressed", String(view === "table"));
      $("btnViewCard").setAttribute("aria-pressed", String(view === "card"));
      state.selected.clear();
      renderBody();
      renderBulkBar();
    });
  });

  /* ---------- Mulai ---------- */
  load();
})();
