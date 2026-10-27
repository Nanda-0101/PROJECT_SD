/* Sakit-Learn · utilitas UI bersama tanpa backend. Dipakai lewat objek global `SL`. */
(() => {
  "use strict";

  const PAGES = (window.SL_CONFIG && window.SL_CONFIG.PAGES) || {
    beranda: "/", masuk: "/masuk", daftar: "/daftar",
    klasifikasi: "/klasifikasi", riwayat: "/riwayat", tentang: "/tentang",
  };

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n, digits = 1) => Number(n).toFixed(digits);

  function toast(message, type = "success") {
    const host = document.getElementById("toastContainer");
    if (!host) return;
    const icons = { success: "check-circle-fill", danger: "x-circle-fill", warning: "exclamation-triangle-fill", info: "info-circle-fill" };
    const el = document.createElement("div");
    el.className = `toast sl-toast sl-toast-${type} align-items-center border-0`;
    el.setAttribute("role", "alert");
    el.innerHTML = `<div class="d-flex"><div class="toast-body d-flex align-items-center">
      <i class="bi bi-${icons[type] || icons.info} toast-icon"></i><span></span></div>
      <button type="button" class="btn-close btn-close-white me-3 m-auto" data-bs-dismiss="toast" aria-label="Tutup"></button></div>`;
    el.querySelector("span").textContent = message;
    host.append(el);
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

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (canHover && !reduced) {
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest?.(".glass-spot");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", e.clientX - r.left + "px");
        card.style.setProperty("--my", e.clientY - r.top + "px");
      }
    }, { passive: true });
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

  const navHost = document.getElementById("site-navbar");
  const onScroll = () => navHost && navHost.classList.toggle("is-scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function countUp(el, to = Number(el.dataset.count), { duration = 1100 } = {}) {
    const decimals = Number(el.dataset.decimals || 0), suffix = el.dataset.suffix || "";
    const fmtNum = (n) =>
      n.toLocaleString(el.dataset.locale || "en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (reduced || !Number.isFinite(to)) { el.textContent = fmtNum(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtNum(to * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function observeCounts(root = document) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { countUp(en.target); io.unobserve(en.target); }
    }), { threshold: .4 });
    root.querySelectorAll("[data-count]").forEach((el) => io.observe(el));
  }
  document.addEventListener("DOMContentLoaded", () => observeCounts());

  window.SL = { PAGES, escapeHtml, fmt, toast, setLoading, showAlert, countUp, observeCounts };
})();