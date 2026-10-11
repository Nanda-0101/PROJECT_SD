/* Sakit-Learn · utilitas bersama: API client, navbar, toast, kategori, BMI.
   Dipakai semua halaman lewat objek global `SL`. */
(() => {
  "use strict";

  const CONFIG = Object.assign({ USE_MOCK: true, API_BASE: "" }, window.SL_CONFIG);
  const PAGES = Object.assign({ beranda: "/", masuk: "/masuk", daftar: "/daftar", klasifikasi: "/klasifikasi", riwayat: "/riwayat", tentang: "/tentang" }, CONFIG.PAGES);

  const CATEGORIES = {
    under:  { key: "under",  name: "Underweight",   label: "Kurus (Underweight)",   color: "#06b6d4", grad: "bg-grad-cyan",   cls: "result-underweight", icon: "bi-arrow-down-circle" },
    normal: { key: "normal", name: "Normal weight", label: "Berat Badan Normal",    color: "#16a34a", grad: "bg-grad-green",  cls: "result-normal",      icon: "bi-check-circle" },
    over:   { key: "over",   name: "Overweight",    label: "Kelebihan Berat Badan", color: "#f5a700", grad: "bg-grad-orange", cls: "result-overweight",  icon: "bi-exclamation-circle" },
    obese:  { key: "obese",  name: "Obese",         label: "Obesitas",              color: "#e5384f", grad: "bg-grad-red",    cls: "result-obese",       icon: "bi-x-octagon" },
  };
  const CATEGORY_KEYS = Object.keys(CATEGORIES);

  /* ---------- format & BMI ---------- */
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n, digits = 1) => Number(n).toFixed(digits);
  const fmtDate = (iso) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const calcBmi = (heightCm, weightKg) => weightKg / (heightCm / 100) ** 2;
  const bmiKey = (bmi) => (bmi < 18.5 ? "under" : bmi < 25 ? "normal" : bmi < 30 ? "over" : "obese");
  const bmiPosition = (bmi) => Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100)); // skala 15-40

  /* ---------- navigasi ---------- */
  const currentFile = () => location.pathname + location.search;
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
    el.className = `toast sl-toast sl-toast-${type} align-items-center border-0`;
    el.setAttribute("role", "alert");
    el.innerHTML = `<div class="d-flex"><div class="toast-body d-flex align-items-center"><i class="bi bi-${icons[type] || icons.info} toast-icon"></i><span></span></div>
      <button type="button" class="btn-close btn-close-white me-3 m-auto" data-bs-dismiss="toast" aria-label="Tutup"></button></div>`;
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
    const initial = escapeHtml((user.name || "?").trim().charAt(0).toUpperCase());
    box.innerHTML = `
      <span class="user-chip"><span class="avatar" aria-hidden="true">${initial}</span>${escapeHtml(user.name)}</span>
      <button class="btn btn-outline-danger btn-sm" type="button" id="btnLogout" title="Keluar" aria-label="Keluar"><i class="bi bi-box-arrow-right"></i></button>`;
    document.getElementById("btnLogout").addEventListener("click", logout);
  }

  /** Skala BMI dipakai di beberapa halaman: <div data-spectrum="awalan"></div> -> penanda berid "awalanMarker". */
  document.querySelectorAll("[data-spectrum]").forEach((el) => {
    el.innerHTML = `<div class="spectrum-track" role="img" aria-label="Skala BMI dari kurus sampai obesitas">
      <div class="spectrum"><span class="s-under"></span><span class="s-normal"></span><span class="s-over"></span><span class="s-obese"></span></div>
      <div class="spectrum-marker" id="${el.dataset.spectrum}Marker" style="left:40%"></div></div>
      <div class="spectrum-ticks" aria-hidden="true"><span style="left:14%">18,5</span><span style="left:40%">25</span><span style="left:60%">30</span></div>`;
  });

  /* ---------- efek UI: kilau kursor, parallax latar, navbar saat scroll, count-up ---------- */
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (canHover && !reduced) {
    // Kilau cahaya mengikuti kursor pada elemen .glass-spot
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest?.(".glass-spot");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", e.clientX - r.left + "px");
        card.style.setProperty("--my", e.clientY - r.top + "px");
      }
    }, { passive: true });
    // Bola warna di latar bergeser tipis mengikuti kursor
    let raf = 0;
    document.addEventListener("pointermove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const root = document.documentElement.style;
        root.setProperty("--px", (e.clientX / innerWidth - .5).toFixed(3));
        root.setProperty("--py", (e.clientY / innerHeight - .5).toFixed(3));
      });
    }, { passive: true });
  }

  // Navbar lebih pekat setelah halaman di-scroll
  const navHost = document.getElementById("site-navbar");
  const onScroll = () => navHost && navHost.classList.toggle("is-scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /** Animasi angka naik. el.dataset: count (tujuan), decimals, suffix, locale (opsional). */
  function countUp(el, to = Number(el.dataset.count), { duration = 1100 } = {}) {
    const decimals = Number(el.dataset.decimals || 0), suffix = el.dataset.suffix || "";
    const fmtNum = (n) => n.toLocaleString(el.dataset.locale || "en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (reduced || !Number.isFinite(to)) { el.textContent = fmtNum(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtNum(to * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  /** Jalankan count-up saat elemen terlihat di layar. Panggil ulang bila data diubah. */
  function observeCounts(root = document) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { countUp(en.target); io.unobserve(en.target); }
    }), { threshold: .4 });
    root.querySelectorAll("[data-count]").forEach((el) => io.observe(el));
  }
  document.addEventListener("DOMContentLoaded", () => observeCounts());

  /** Pil kategori berwarna. */
  const catPill = (key) => `<span class="cat-pill cat-${key}">${escapeHtml(CATEGORIES[key].name)}</span>`;

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

  window.SL = { CONFIG, PAGES, CATEGORIES, CATEGORY_KEYS, ApiError, api, ready, safeNext, escapeHtml, fmt, fmtDate, calcBmi, bmiKey, bmiPosition, toast, setLoading, showAlert, countUp, observeCounts, catPill, applyFieldErrors, clearFieldErrors };
})();
