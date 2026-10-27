/* Layout: tandai menu aktif & efek scroll navbar. Navbar/footer sudah dirender server-side (Jinja). */
(() => {
  "use strict";

  // Tunggu DOM siap (navbar sudah ada di HTML hasil render Flask)
  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const active = a.dataset.nav === page;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  });

  // Kompatibilitas: SL_LAYOUT tetap resolve agar common.js lama tidak error jika masih dipakai
  window.SL_LAYOUT = Promise.resolve();
})();