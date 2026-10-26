/* Halaman Beranda: mengambil data evaluasi model lalu menampilkannya (kartu angka, tabel, bobot). */

(() => {
  "use strict";

  const { fmt, api, catPill } = SL;

  /* ---------- Konfigurasi ---------- */

  const METRIC_TILES = [
    ["accuracy", "Akurasi", "bullseye"],
    ["f1", "F1-Score", "graph-up"],
    ["precision", "Precision", "bullseye"],
    ["recall", "Recall", "activity"],
  ];

  /* ---------- Referensi elemen HTML ---------- */

  const el = {
    loading: document.getElementById("evalLoading"),
    error: document.getElementById("evalError"),
    content: document.getElementById("evalContent"),
    stats: document.getElementById("evalStats"),
    rows: document.getElementById("evalRows"),
    weightLgbm: document.getElementById("wLgbm"),
    weightMlp: document.getElementById("wMlp"),
    heroAccuracy: document.getElementById("hsAcc"),
    heroTrainCount: document.getElementById("hsN"),
    retry: document.getElementById("evalRetry"),
  };

  /* ---------- Pembuat potongan HTML ---------- */

  const statTileHtml = ([key, label, icon], overall) => `
    <div class="col-md-3 col-6">
      <div class="stat-card">
        <div class="stat-icon"><i class="bi bi-${icon}" aria-hidden="true"></i></div>
        <div class="stat-value" data-count="${overall[key].value}" data-decimals="1" data-suffix="%">${fmt(overall[key].value)}%</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;

  const metricCells = (m) => `<td>${fmt(m.precision)}%</td><td>${fmt(m.recall)}%</td><td>${fmt(m.f1)}%</td>`;

  /* ---------- Menampilkan data ---------- */

  function renderEval(info) {
    el.stats.innerHTML = METRIC_TILES.map((tile) => statTileHtml(tile, info.overall)).join("");

    const classRows = info.per_class.map((r) => `<tr><td>${catPill(r.key)}</td>${metricCells(r)}</tr>`);
    const averageRow = `<tr class="row-total"><td>Rata-rata</td>${metricCells(info.average)}</tr>`;
    el.rows.innerHTML = [...classRows, averageRow].join("");

    el.weightLgbm.textContent = fmt(info.weights.lightgbm, 1);
    el.weightMlp.textContent = fmt(info.weights.mlp, 1);

    el.heroAccuracy.dataset.count = Math.round(info.overall.accuracy.value);
    el.heroTrainCount.dataset.count = info.n_train;
    SL.countUp(el.heroAccuracy);
    SL.countUp(el.heroTrainCount);
  }

  /* ---------- Tiga keadaan tampilan ---------- */

  function showState(state) {
    el.loading.hidden = state !== "loading";
    el.content.hidden = state !== "ready";
    el.error.classList.toggle("d-none", state !== "error");
  }

  async function loadEval() {
    showState("loading");
    try {
      renderEval(await api("/api/model-info"));
      showState("ready");
      SL.observeCounts(el.content);
    } catch {
      showState("error");
    }
  }

  /* ---------- Animasi muncul saat di-scroll ---------- */

  const canObserve = "IntersectionObserver" in window;
  const revealer = canObserve && new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        revealer.unobserve(entry.target);
      }),
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((node) => (canObserve ? revealer.observe(node) : node.classList.add("in")));

  /* ---------- Mulai ---------- */

  el.retry.addEventListener("click", loadEval);
  loadEval();
})();