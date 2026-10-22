/* ==========================================================================
   efek.js
   Efek interaktif yang dipakai bersama di Beranda, Riwayat, dan Daftar.
   Isinya ada empat hal yaitu bar scroll, tombol ke atas, cahaya kartu, dan riak tombol.
   File ini berdiri sendiri, jadi kalau dihapus halaman tetap jalan normal.
   ========================================================================== */

(() => {
  "use strict";

  // Pengguna yang mematikan animasi dan perangkat sentuh tidak butuh efek kursor
  const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const hasMouse = window.matchMedia?.("(hover: hover)").matches;

  /* ---------- Bar kemajuan scroll dan tombol ke atas ---------- */

  const bar = document.createElement("div");
  bar.id = "fxProgress";
  bar.setAttribute("aria-hidden", "true");

  const topBtn = document.createElement("button");
  topBtn.id = "fxTop";
  topBtn.type = "button";
  topBtn.setAttribute("aria-label", "Kembali ke atas");
  topBtn.innerHTML = '<i class="bi bi-arrow-up" aria-hidden="true"></i>';
  topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" }));

  document.body.append(bar, topBtn);

  // Hitung seberapa jauh halaman sudah digulung (0 sampai 1) lalu pakai untuk bar dan tombol
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = `scaleX(${ratio})`;
    topBtn.classList.toggle("show", window.scrollY > 400); // tombol muncul setelah turun 400px
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Cahaya yang mengikuti kursor di kartu ---------- */

  // Daftar kelas kartu yang dapat efek. Kartu hasil render ulang ikut kena lewat event delegation.
  const CARD_SELECTOR = ".glass, .sl-card, .stat-card, .step-card, .hist-card";

  if (hasMouse && !calm) {
    document.addEventListener("mousemove", (event) => {
      const card = event.target.closest?.(CARD_SELECTOR);
      if (!card) return;

      // Lapisan cahaya dibuat sekali saja saat kartu pertama kali disorot
      if (!card.classList.contains("fx-card")) {
        card.classList.add("fx-card");
        const spot = document.createElement("span");
        spot.className = "fx-spot";
        spot.setAttribute("aria-hidden", "true");
        card.append(spot);
      }

      // Posisi kursor relatif terhadap kartu dikirim ke CSS lewat variabel
      const box = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - box.left}px`);
      card.style.setProperty("--my", `${event.clientY - box.top}px`);
    });
  }

  /* ---------- Riak saat tombol diklik ---------- */

  const RIPPLE_SELECTOR = ".btn, .chip, .cat-tab, .view-toggle button";

  if (!calm) {
    document.addEventListener("pointerdown", (event) => {
      const host = event.target.closest?.(RIPPLE_SELECTOR);
      if (!host || host.disabled) return;

      host.classList.add("fx-ripple-host");
      const dot = document.createElement("span");
      dot.className = "fx-ripple";
      const box = host.getBoundingClientRect();
      dot.style.left = `${event.clientX - box.left}px`;
      dot.style.top = `${event.clientY - box.top}px`;
      host.append(dot);
      dot.addEventListener("animationend", () => dot.remove()); // dibersihkan setelah animasi selesai
    });
  }
})();
