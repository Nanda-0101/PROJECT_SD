/* Data Evaluasi Model */
(() => {
  "use strict";
  const { fmt, api, catPill } = SL;

  /* ---------- Evaluasi model ---------- */
  const el = {
    loading: document.getElementById("evalLoading"),
    error: document.getElementById("evalError"),
    content: document.getElementById("evalContent"),
  };

  function renderEval(info) {
    const tiles = [
      ["accuracy", "Akurasi", "bullseye"],
      ["f1", "F1-Score", "graph-up"],
      ["precision", "Precision", "bullseye"],
      ["recall", "Recall", "activity"],
    ];
    document.getElementById("evalStats").innerHTML = tiles.map(([k, label, icon]) => `
      <div class="col-md-3 col-6"><div class="stat-card">
        <div class="stat-icon"><i class="bi bi-${icon}"></i></div>
        <div class="stat-value" data-count="${info.overall[k].value}" data-decimals="1" data-suffix="%">${fmt(info.overall[k].value)}%</div>
        <div class="stat-label">${label}</div>
      </div></div>`).join("");

    const rows = info.per_class.map((r) => `
      <tr><td>${catPill(r.key)}</td>
      <td>${fmt(r.precision)}%</td><td>${fmt(r.recall)}%</td><td>${fmt(r.f1)}%</td></tr>`);
    const a = info.average;
    rows.push(`<tr class="row-total"><td>Rata-rata</td><td>${fmt(a.precision)}%</td>
      <td>${fmt(a.recall)}%</td><td>${fmt(a.f1)}%</td></tr>`);
    document.getElementById("evalRows").innerHTML = rows.join("");

    document.getElementById("wLgbm").textContent = fmt(info.weights.lightgbm, 1);
    document.getElementById("wMlp").textContent = fmt(info.weights.mlp, 1);

    // Selaraskan angka hero dengan data model
    const acc = document.getElementById("hsAcc"), n = document.getElementById("hsN");
    acc.dataset.count = Math.round(info.overall.accuracy.value);
    n.dataset.count = info.n_train;
    SL.countUp(acc); SL.countUp(n);
  }

  async function loadEval() {
    el.error.classList.add("d-none");
    el.error.classList.remove("d-flex");
    el.loading.hidden = false;
    try {
      renderEval(await api("/api/model-info"));
      el.loading.hidden = true;
      el.content.hidden = false;
      SL.observeCounts(el.content); // angka metrik berhitung naik saat terlihat
    } catch {
      el.loading.hidden = true;
      el.error.classList.remove("d-none");
      el.error.classList.add("d-flex");
    }
  }
  document.getElementById("evalRetry").addEventListener("click", loadEval);
  loadEval();
})();