/* Halaman Beranda: kalkulator BMI cepat + data evaluasi model dari API. */
(() => {
  "use strict";
  const { CATEGORIES, calcBmi, bmiKey, bmiPosition, fmt, api, escapeHtml } = SL;

  /* ---------- Kalkulator BMI cepat ---------- */
  const height = document.getElementById("qHeight");
  const weight = document.getElementById("qWeight");

  function updateQuickBmi() {
    const h = Number(height.value), w = Number(weight.value);
    const bmi = calcBmi(h, w), key = bmiKey(bmi);
    document.getElementById("qHeightOut").textContent = `${h} cm`;
    document.getElementById("qWeightOut").textContent = `${w} kg`;
    document.getElementById("qBmi").textContent = fmt(bmi, 1);
    document.getElementById("qLabel").textContent = CATEGORIES[key].name;
    document.getElementById("qBadge").className = `cat-badge cat-${key}`;
    document.getElementById("qMarker").style.left = bmiPosition(bmi) + "%";
    document.getElementById("qGo").href = `${SL.PAGES.klasifikasi}?tinggi=${h}&berat=${w}`;
  }
  height.addEventListener("input", updateQuickBmi);
  weight.addEventListener("input", updateQuickBmi);
  updateQuickBmi();

  /* ---------- Evaluasi model ---------- */
  const el = {
    loading: document.getElementById("evalLoading"),
    error: document.getElementById("evalError"),
    content: document.getElementById("evalContent"),
  };

  function renderEval(info) {
    const tiles = [
      ["accuracy", "Akurasi", "var(--c-normal)"],
      ["f1", "F1-score", "var(--brand)"],
      ["precision", "Precision", "var(--c-over)"],
      ["recall", "Recall", "var(--c-obese)"],
    ];
    document.getElementById("evalStats").innerHTML = tiles.map(([k, label, color]) => `
      <div class="col-6 col-lg-3"><div class="stat-tile" style="--tile:${color}">
        <div class="val">${fmt(info.overall[k].value)}%</div>
        <div class="lbl">${label} (±${fmt(info.overall[k].margin)}%)</div>
      </div></div>`).join("");

    const rows = info.per_class.map((r) => `
      <tr><td><span class="cat-badge cat-${r.key}"><span class="cat-dot"></span>${escapeHtml(r.name)}</span></td>
      <td>${fmt(r.precision)}%</td><td>${fmt(r.recall)}%</td><td>${fmt(r.f1)}%</td><td><strong>95,0% ± ${fmt(r.margin)}%</strong></td></tr>`);
    const a = info.average;
    rows.push(`<tr class="table-light"><td><strong>Rata-rata</strong></td><td><strong>${fmt(a.precision)}%</strong></td>
      <td><strong>${fmt(a.recall)}%</strong></td><td><strong>${fmt(a.f1)}%</strong></td><td><strong>95,0% ± ${fmt(a.margin)}%</strong></td></tr>`);
    document.getElementById("evalRows").innerHTML = rows.join("");

    document.getElementById("evalWeights").innerHTML = `
      <span>Hasil akhir =</span><span class="weight-pill">LightGBM × ${fmt(info.weights.lightgbm, 1)}</span>
      <span>+</span><span class="weight-pill">MLP × ${fmt(info.weights.mlp, 1)}</span>
      <span class="ms-md-2">dilatih dari ${info.n_train.toLocaleString("id-ID")} data.</span>`;
  }

  async function loadEval() {
    el.error.classList.add("d-none");
    el.error.classList.remove("d-flex");
    el.loading.hidden = false;
    try {
      renderEval(await api("/api/model-info"));
      el.loading.hidden = true;
      el.content.hidden = false;
    } catch {
      el.loading.hidden = true;
      el.error.classList.remove("d-none");
      el.error.classList.add("d-flex");
    }
  }
  document.getElementById("evalRetry").addEventListener("click", loadEval);
  loadEval();
})();
