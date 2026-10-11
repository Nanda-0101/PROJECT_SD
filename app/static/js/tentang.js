/* Halaman About: isi metrik, bobot, dan rentang data dari API; buka FAQ lewat #hash. */
(() => {
  "use strict";
  const { api, fmt } = SL;

  async function loadModelInfo() {
    try {
      const info = await api("/api/model-info");
      const w1 = fmt(info.weights.lightgbm, 1), w2 = fmt(info.weights.mlp, 1);
      ["wLgbm", "fLgbm"].forEach((id) => { document.getElementById(id).textContent = w1; });
      ["wMlp", "fMlp"].forEach((id) => { document.getElementById(id).textContent = w2; });
      document.getElementById("mAcc").textContent = Math.round(info.overall.accuracy.value) + "%";
      document.getElementById("mN").textContent = info.n_train.toLocaleString("en-US");
      document.getElementById("mF1").textContent = (info.overall.f1.value / 100).toFixed(2);
      const r = info.optimal_range;
      document.getElementById("rangeText").textContent =
        `Usia ${r.age[0]}–${r.age[1]} tahun, tinggi ${r.height[0]}–${r.height[1]} cm, berat ${r.weight[0]}–${r.weight[1]} kg, aktivitas ${r.activity[0]}–${r.activity[1]}.`;
    } catch { /* teks bawaan di HTML tetap tampil */ }
  }

  // Tautan seperti tentang.html#faq3 langsung membuka jawabannya.
  function openFaqFromHash() {
    if (!/^#faq\d+$/.test(location.hash)) return;
    const target = document.querySelector(location.hash);
    if (target) {
      bootstrap.Collapse.getOrCreateInstance(target, { toggle: false }).show();
      target.scrollIntoView({ block: "center" });
    }
  }

  loadModelInfo();
  openFaqFromHash();
})();
