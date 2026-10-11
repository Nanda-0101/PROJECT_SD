/* Halaman Beranda: widget contoh hasil, kalkulator BMI cepat, dan data evaluasi model dari API. */
(() => {
  "use strict";
  const { CATEGORIES, CATEGORY_KEYS, calcBmi, bmiKey, bmiPosition, fmt, api, escapeHtml, catPill } = SL;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Widget contoh hasil (ilustrasi, bukan hasil model) ---------- */
  const SAMPLES = {
    under:  { bmi: 16.4, p: { under: 85, normal: 10, over: 3, obese: 2 } },
    normal: { bmi: 22.4, p: { under: 3, normal: 85, over: 9, obese: 3 } },
    over:   { bmi: 26.8, p: { under: 2, normal: 35, over: 55, obese: 8 } },
    obese:  { bmi: 33.2, p: { under: 1, normal: 5, over: 35, obese: 59 } },
  };
  const pred = document.getElementById("pred");
  const bars = document.getElementById("pdBars");
  const tabs = document.getElementById("pdTabs");
  const ring = document.getElementById("pdRing");
  const RING_C = 2 * Math.PI * 42;
  let current = "normal", timer = null;

  bars.innerHTML = CATEGORY_KEYS.map((k) => `
    <div class="pb-row cat-${k}" data-k="${k}"><span>${escapeHtml(CATEGORIES[k].name)}</span>
    <span class="pb-track"><i class="pb-fill"></i></span><b>0%</b></div>`).join("");
  tabs.innerHTML = CATEGORY_KEYS.map((k) => `<button type="button" data-k="${k}" aria-pressed="false">${escapeHtml(CATEGORIES[k].name.split(" ")[0])}</button>`).join("");

  function showSample(key) {
    current = key;
    const s = SAMPLES[key];
    pred.className = pred.className.replace(/\bcat-\w+/g, "").trim() + ` cat-${key}`;
    document.getElementById("pdBmi").textContent = s.bmi.toFixed(1);
    document.getElementById("pdName").textContent = CATEGORIES[key].name;
    document.getElementById("pdConf").textContent = s.p[key];
    ring.style.strokeDashoffset = RING_C * (1 - s.p[key] / 100);
    bars.querySelectorAll(".pb-row").forEach((row) => {
      const k = row.dataset.k;
      row.classList.toggle("on", k === key);
      row.querySelector(".pb-fill").style.width = s.p[k] + "%";
      row.querySelector("b").textContent = s.p[k] + "%";
    });
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === key)));
  }
  function startCycle() {
    if (reduced) return;
    stopCycle();
    timer = setInterval(() => showSample(CATEGORY_KEYS[(CATEGORY_KEYS.indexOf(current) + 1) % CATEGORY_KEYS.length]), 3600);
  }
  function stopCycle() { clearInterval(timer); }
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]");
    if (b) { showSample(b.dataset.k); startCycle(); }
  });
  pred.addEventListener("pointerenter", stopCycle);
  pred.addEventListener("pointerleave", startCycle);
  pred.addEventListener("focusin", stopCycle);
  pred.addEventListener("focusout", startCycle);
  // set kondisi awal dengan sedikit jeda supaya transisi terlihat saat halaman dibuka
  requestAnimationFrame(() => setTimeout(() => { showSample("normal"); startCycle(); }, 250));

  /* ---------- Kalkulator BMI cepat ---------- */
  const height = document.getElementById("qHeight");
  const weight = document.getElementById("qWeight");

  function updateQuickBmi() {
    const h = Number(height.value), w = Number(weight.value);
    const bmi = calcBmi(h, w), key = bmiKey(bmi);
    document.getElementById("qHeightOut").textContent = `${h} cm`;
    document.getElementById("qWeightOut").textContent = `${w} kg`;
    document.getElementById("qBmi").textContent = fmt(bmi, 1);
    const badge = document.getElementById("qBadge");
    badge.textContent = CATEGORIES[key].name;
    badge.className = `cat-pill cat-${key}`;
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
      ["accuracy", "Akurasi", "bullseye"],
      ["f1", "F1-Score", "graph-up"],
      ["precision", "Precision", "bullseye"],
      ["recall", "Recall", "activity"],
    ];
    document.getElementById("evalStats").innerHTML = tiles.map(([k, label, icon]) => `
      <div class="col-md-3 col-6"><div class="stat-card">
        <div class="stat-icon"><i class="bi bi-${icon}"></i></div>
        <div class="stat-value" data-count="${info.overall[k].value}" data-decimals="1" data-suffix="%">${fmt(info.overall[k].value)}%</div>
        <div class="stat-label">${label} (±${fmt(info.overall[k].margin)}%)</div>
      </div></div>`).join("");

    const rows = info.per_class.map((r) => `
      <tr><td>${catPill(r.key)}</td>
      <td>${fmt(r.precision)}%</td><td>${fmt(r.recall)}%</td><td>${fmt(r.f1)}%</td><td><b>95.0% ± ${fmt(r.margin)}%</b></td></tr>`);
    const a = info.average;
    rows.push(`<tr class="row-total"><td>Rata-rata</td><td>${fmt(a.precision)}%</td>
      <td>${fmt(a.recall)}%</td><td>${fmt(a.f1)}%</td><td>95.0% ± ${fmt(a.margin)}%</td></tr>`);
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
