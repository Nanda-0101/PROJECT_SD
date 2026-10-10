/* Halaman Tentang: isi rentang data & info model dari API, buka FAQ lewat #hash. */
(() => {
  "use strict";
  const { api, fmt } = SL;

  const rangeLabels = {
    age: ["Usia", "tahun"], height: ["Tinggi badan", "cm"], weight: ["Berat badan", "kg"], activity: ["Tingkat aktivitas", ""],
  };

  async function loadModelInfo() {
    const body = document.getElementById("rangeRows");
    try {
      const info = await api("/api/model-info");
      document.getElementById("nTrain").textContent = info.n_train.toLocaleString("id-ID");
      document.getElementById("formula").textContent =
        `Probabilitas akhir = (${fmt(info.weights.lightgbm, 1)} × LightGBM) + (${fmt(info.weights.mlp, 1)} × MLP)`;
      body.innerHTML = Object.entries(info.optimal_range).map(([key, [lo, hi]]) => {
        const [label, unit] = rangeLabels[key];
        return `<tr><td>${label}</td><td><strong>${lo} - ${hi}</strong> ${unit}</td></tr>`;
      }).join("");
    } catch {
      body.innerHTML = `<tr><td colspan="2" class="text-body-secondary">Rentang data belum bisa dimuat. Muat ulang halaman untuk mencoba lagi.</td></tr>`;
    }
  }

  // Tautan seperti /tentang#faq-data langsung membuka jawabannya.
  function openFaqFromHash() {
    const target = document.querySelector(location.hash && /^#faq-[\w-]+$/.test(location.hash) ? location.hash : null);
    if (target?.classList.contains("accordion-collapse")) {
      bootstrap.Collapse.getOrCreateInstance(target, { toggle: false }).show();
      target.scrollIntoView({ block: "center" });
    }
  }

  loadModelInfo();
  openFaqFromHash();
})();
