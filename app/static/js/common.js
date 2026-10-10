/* Sakit-Learn · utilitas bersama: API client, navbar, toast, kategori, BMI.
   Dipakai semua halaman lewat objek global `SL`. */
(() => {
  "use strict";

  const CONFIG = Object.assign({ USE_MOCK: true, API_BASE: "" }, window.SL_CONFIG);
  const PAGES = { beranda: "index.html", masuk: "masuk.html", daftar: "daftar.html", klasifikasi: "klasifikasi.html", riwayat: "riwayat.html", tentang: "tentang.html" };

  const CATEGORIES = {
    under:  { key: "under",  name: "Underweight",   label: "Kurus (Underweight)",   color: "#2f8fd8", icon: "arrow-down-circle-fill" },
    normal: { key: "normal", name: "Normal weight", label: "Berat badan normal",    color: "#14a37f", icon: "check-circle-fill" },
    over:   { key: "over",   name: "Overweight",    label: "Kelebihan berat badan", color: "#e8920c", icon: "exclamation-circle-fill" },
    obese:  { key: "obese",  name: "Obese",         label: "Obesitas",              color: "#e04f5f", icon: "x-octagon-fill" },
  };
  const CATEGORY_KEYS = Object.keys(CATEGORIES);

  /* ---------- format & BMI ---------- */
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n, digits = 1) => Number(n).toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmtDate = (iso) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const calcBmi = (heightCm, weightKg) => weightKg / (heightCm / 100) ** 2;
  const bmiKey = (bmi) => (bmi < 18.5 ? "under" : bmi < 25 ? "normal" : bmi < 30 ? "over" : "obese");
  const bmiPosition = (bmi) => Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100)); // skala 15-40

  /* ---------- navigasi ---------- */
  const currentFile = () => (location.pathname.split("/").pop() || PAGES.beranda) + location.search;
  /** Hanya izinkan redirect ke halaman milik situs ini. */
  const safeNext = (value) => {
    const file = String(value || "").split("?")[0].split("#")[0];
    return Object.values(PAGES).includes(file) ? value : PAGES.klasifikasi;
  };
  const loginUrl = (next) => `${PAGES.masuk}?next=${encodeURIComponent(next)}`;

  /* ---------- API (mock atau backend sungguhan, sesuai config.js) ---------- */
  class ApiError extends Error {
    constructor(message, status = 0, fields = {}) { super(message); this.status = status; this.fields = fields; }
  }

  async function api(path, { method = "GET", body } = {}) {
    let status, data;
    if (CONFIG.USE_MOCK) {
      ({ status, data } = await window.SLMock.handle(path, { method, body }));
    } else {
      const options = { method, credentials: "include", headers: { Accept: "application/json" } };
      if (body !== undefined) { options.headers["Content-Type"] = "application/json"; options.body = JSON.stringify(body); }
      let res;
      try { res = await fetch(CONFIG.API_BASE + path, options); }
      catch { throw new ApiError("Tidak bisa terhubung ke server. Periksa koneksi Anda lalu coba lagi."); }
      status = res.status;
      data = await res.json().catch(() => ({}));
    }
    if (status === 401 && !path.startsWith("/api/auth/")) {
      window.location.href = loginUrl(currentFile());
      throw new ApiError(data.error || "Sesi berakhir.", 401);
    }
    if (status >= 400) throw new ApiError(data.error || "Terjadi kesalahan pada server.", status, data.fields);
    return data;
  }

  /* ---------- UI helpers ---------- */
  function toast(message, type = "success") {
    const icons = { success: "check-circle-fill", danger: "x-circle-fill", warning: "exclamation-triangle-fill", info: "info-circle-fill" };
    const el = document.createElement("div");
    el.className = `toast align-items-center text-bg-${type} border-0`;
    el.setAttribute("role", "alert");
    el.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi bi-${icons[type] || icons.info} me-1"></i><span></span></div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Tutup"></button></div>`;
    el.querySelector("span").textContent = message;
    document.getElementById("toastContainer").append(el);
    el.addEventListener("hidden.bs.toast", () => el.remove());
    new bootstrap.Toast(el, { delay: 3500 }).show();
  }

  function setLoading(button, loading, loadingText = "Memproses...") {
    if (loading) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${loadingText}`;
    } else {
      button.disabled = false;
      if (button.dataset.label) button.innerHTML = button.dataset.label;
    }
  }

  function showAlert(container, message, type = "danger") {
    container.innerHTML = `<div class="alert alert-${type} py-2 mb-3" role="alert"></div>`;
    container.firstElementChild.textContent = message;
  }

  function applyFieldErrors(form, fields = {}) {
    Object.entries(fields).forEach(([name, message]) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;
      input.classList.add("is-invalid");
      const box = input.closest(".field")?.querySelector(".invalid-feedback");
      if (box) box.textContent = message;
    });
  }
  const clearFieldErrors = (form) => form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));

  /* ---------- navbar & status login ---------- */
  async function logout() {
    try { await api("/api/auth/logout", { method: "POST", body: {} }); } finally { window.location.href = PAGES.beranda; }
  }

  function renderNavUser(user) {
    const box = document.getElementById("navAuth");
    if (!box) return;
    box.innerHTML = `
      <div class="dropdown">
        <button class="btn user-chip dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          <span class="avatar" aria-hidden="true">${escapeHtml(user.name.slice(0, 1).toUpperCase())}</span><span>${escapeHtml(user.name)}</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><span class="dropdown-item-text small text-body-secondary">@${escapeHtml(user.username)}</span></li>
          <li><button class="dropdown-item text-danger" type="button" id="btnLogout"><i class="bi bi-box-arrow-right"></i> Keluar</button></li>
        </ul>
      </div>`;
    document.getElementById("btnLogout").addEventListener("click", logout);
  }

  /** Skala BMI dipakai di beberapa halaman: <div data-spectrum="awalan"></div> -> penanda berid "awalanMarker". */
  document.querySelectorAll("[data-spectrum]").forEach((el) => {
    el.innerHTML = `<div class="spectrum-track" role="img" aria-label="Skala BMI dari kurus sampai obesitas">
      <div class="spectrum"><span class="s-under"></span><span class="s-normal"></span><span class="s-over"></span><span class="s-obese"></span></div>
      <div class="spectrum-marker" id="${el.dataset.spectrum}Marker" style="left:40%"></div></div>
      <div class="spectrum-ticks" aria-hidden="true"><span style="left:14%">18,5</span><span style="left:40%">25</span><span style="left:60%">30</span></div>`;
  });

  /** Resolve dengan data user (atau null). Halaman privat otomatis diarahkan ke Masuk. */
  const ready = (async () => {
    await window.SL_LAYOUT; // tunggu navbar & footer selesai dimuat
    let user = null;
    try { user = (await api("/api/auth/me")).user; } catch { /* anggap belum masuk */ }
    if (user) {
      renderNavUser(user);
      document.querySelectorAll(".lock-icon").forEach((el) => el.remove());
    }
    document.querySelectorAll("[data-guest-only]").forEach((el) => { el.hidden = !!user; });
    if (document.body.hasAttribute("data-protected") && !user) window.location.replace(loginUrl(currentFile()));
    return user;
  })();

  window.SL = { CONFIG, PAGES, CATEGORIES, CATEGORY_KEYS, ApiError, api, ready, safeNext, escapeHtml, fmt, fmtDate, calcBmi, bmiKey, bmiPosition, toast, setLoading, showAlert, applyFieldErrors, clearFieldErrors };
})();
