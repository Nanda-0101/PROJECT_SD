/* Sakit-Learn · memuat komponen bersama (navbar & footer) ke setiap halaman.
   Edit components/navbar.html atau components/footer.html, perubahannya langsung berlaku di semua halaman.
   Butuh server (Live Server). Membuka file HTML dengan klik dua kali tidak bisa memuat komponen. */
(() => {
  "use strict";
  const slots = { "site-navbar": "components/navbar.html", "site-footer": "components/footer.html" };

  async function load(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      el.innerHTML = await res.text();
    } catch {
      el.innerHTML = `<div class="alert alert-warning m-3 small" role="alert">Komponen <code>${url}</code> gagal dimuat. Buka halaman lewat <strong>Live Server</strong>, bukan dengan klik dua kali file HTML.</div>`;
    }
  }

  window.SL_LAYOUT = (async () => {
    await Promise.all(Object.entries(slots).map(([id, url]) => load(id, url)));
    const page = document.body.dataset.page;
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const active = a.dataset.nav === page;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  })();
})();
