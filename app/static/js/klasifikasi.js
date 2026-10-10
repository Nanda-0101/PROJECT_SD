/* Halaman Klasifikasi: form interaktif, pratinjau BMI, panggilan /api/predict, render hasil. */
(() => {
  "use strict";
  const { CATEGORIES, CATEGORY_KEYS, api, fmt, escapeHtml, calcBmi, bmiKey, bmiPosition, toast, setLoading } = SL;

  const form = document.getElementById("classifyForm");
  const panel = document.getElementById("resultPanel");
  const submitBtn = document.getElementById("btnSubmit");
  const heightEl = document.getElementById("height");
  const weightEl = document.getElementById("weight");
  const emptyHtml = panel.innerHTML;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Pratinjau BMI langsung ---------- */
  function updatePreview() {
    const h = parseFloat(heightEl.value), w = parseFloat(weightEl.value);
    const valid = h >= 50 && h <= 250 && w >= 10 && w <= 300;
    document.getElementById("previewEmpty").hidden = valid;
    document.getElementById("previewBody").hidden = !valid;
    if (!valid) return;
    const bmi = calcBmi(h, w), key = bmiKey(bmi);
    document.getElementById("pvBmi").textContent = fmt(bmi, 1);
    document.getElementById("pvLabel").textContent = CATEGORIES[key].name;
    document.getElementById("pvBadge").className = `cat-badge cat-${key}`;
    document.getElementById("pvMarker").style.left = bmiPosition(bmi) + "%";
  }
  heightEl.addEventListener("input", updatePreview);
  weightEl.addEventListener("input", updatePreview);

  // Isi otomatis dari Beranda (?tinggi=..&berat=..)
  const params = new URLSearchParams(location.search);
  if (params.get("tinggi")) heightEl.value = params.get("tinggi");
  if (params.get("berat")) weightEl.value = params.get("berat");
  updatePreview();

  form.addEventListener("reset", () => {
    form.classList.remove("was-validated");
    SL.clearFieldErrors(form);
    panel.innerHTML = emptyHtml;
    setTimeout(updatePreview);
  });

  /* ---------- Tampilan proses ---------- */
  function showLoading() {
    const steps = ["Membaca data Anda", "LightGBM menghitung probabilitas", "MLP menghitung probabilitas", "Menggabungkan hasil (0,5 × 0,5)"];
    panel.innerHTML = `
      <div class="card-sl p-4 text-center">
        <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Memproses</span></div>
        <h2 class="h5 mt-3 mb-0">Model sedang menghitung...</h2>
        <ul class="calc-steps">${steps.map((s) => `<li><i class="bi bi-circle"></i>${s}</li>`).join("")}</ul>
      </div>`;
    panel.querySelectorAll("li").forEach((li, i) => setTimeout(() => li.classList.add("done"), (i + 1) * 300));
  }

  function showError(err) {
    panel.innerHTML = `
      <div class="card-sl p-4 text-center">
        <i class="bi bi-exclamation-triangle-fill fs-1 text-warning"></i>
        <h2 class="h5 mt-2">Klasifikasi belum berhasil</h2>
        <p class="text-body-secondary mb-0">${escapeHtml(err.message)}</p>
      </div>`;
  }

  /* ---------- Render hasil ---------- */
  function confidenceNote(pct) {
    if (pct >= 80) return "Keyakinan tinggi: model sangat condong ke kategori ini.";
    if (pct >= 60) return "Keyakinan sedang: ada kemungkinan kategori lain, lihat probabilitas di bawah.";
    return "Keyakinan rendah: hasil dekat dengan kategori lain. Anggap sebagai perkiraan kasar.";
  }

  function renderResult(r) {
    const key = r.category.key;
    const order = [...CATEGORY_KEYS].sort((a, b) => r.probabilities[b] - r.probabilities[a]);
    const C = 2 * Math.PI * 45;

    const probRows = order.map((k) => `
      <div class="prob-row cat-${k}">
        <div class="prob-name"><span class="cat-dot"></span>${escapeHtml(CATEGORIES[k].label)}
          ${k === key ? '<span class="badge text-bg-success">Terpilih</span>' : ""}</div>
        <div class="prob-pct">${fmt(r.probabilities[k])}%</div>
        <div class="prob-bar"><i data-w="${r.probabilities[k]}"></i></div>
      </div>`).join("");

    const modelRows = CATEGORY_KEYS.map((k) => {
      const l = r.models.lightgbm[k], m = r.models.mlp[k], e = r.probabilities[k];
      return `<tr class="${k === key ? "best" : ""}"><td>${escapeHtml(CATEGORIES[k].name)}</td><td>${fmt(l)}%</td><td>${fmt(m)}%</td><td>${fmt(e)}%</td></tr>`;
    }).join("");

    const warnings = r.warnings.length
      ? `<div class="alert alert-warning mt-3 mb-0" role="alert"><strong>Perhatikan:</strong><ul class="mb-0 ps-3">${r.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>` : "";

    panel.innerHTML = `
      <div class="verdict cat-${key}">
        <div class="d-flex flex-wrap align-items-center gap-4">
          <div class="flex-grow-1">
            <i class="bi bi-${CATEGORIES[key].icon} verdict-icon" aria-hidden="true"></i>
            <div class="small text-body-secondary">Hasil klasifikasi · BMI ${fmt(r.bmi, 1)}</div>
            <h2 tabindex="-1" id="verdictTitle">${escapeHtml(r.category.label)}</h2>
            <p class="mb-0 small">${confidenceNote(r.confidence)}</p>
          </div>
          <div class="ring" role="img" aria-label="Keyakinan ${fmt(r.confidence)} persen">
            <svg width="104" height="104"><circle class="track" cx="52" cy="52" r="45"/><circle class="bar" cx="52" cy="52" r="45"
              stroke-dasharray="${C}" stroke-dashoffset="${C}" data-target="${C * (1 - r.confidence / 100)}"/></svg>
            <div class="num"><span>${fmt(r.confidence)}%</span><small>keyakinan</small></div>
          </div>
        </div>
        ${warnings}
      </div>

      <div class="card-sl p-4 mt-3">
        <h3 class="h6 mb-0">Probabilitas tiap kategori</h3>
        <p class="small text-body-secondary mb-2">Gabungan 0,5 × LightGBM + 0,5 × MLP. Totalnya 100%.</p>
        ${probRows}
        <button class="btn btn-sm btn-outline-secondary mt-3" type="button" data-bs-toggle="collapse" data-bs-target="#modelDetail" aria-expanded="false">
          <i class="bi bi-diagram-3 me-1"></i> Bandingkan kedua model</button>
        <div class="collapse mt-3" id="modelDetail">
          <div class="table-responsive"><table class="table table-sm model-table mb-2">
            <thead><tr><th>Kategori</th><th>LightGBM</th><th>MLP</th><th>Ensemble</th></tr></thead><tbody>${modelRows}</tbody></table></div>
          <p class="small text-body-secondary mb-0">Bila kedua model sepakat, hasil lebih meyakinkan. Bila berbeda jauh, ensemble mencari jalan tengah.</p>
        </div>
      </div>

      <div class="card-sl p-4 mt-3">
        <h3 class="h6"><i class="bi bi-lightbulb-fill text-warning me-1"></i> Saran untuk Anda</h3>
        <p class="mb-3">${escapeHtml(r.recommendation)}</p>
        <div class="feedback" id="feedbackBox">
          <div class="fw-semibold mb-2">Apakah hasil ini sesuai dengan kondisi Anda?</div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-success" data-correct="true"><i class="bi bi-hand-thumbs-up-fill"></i> Ya, sesuai</button>
            <button class="btn btn-sm btn-outline-danger" data-correct="false"><i class="bi bi-hand-thumbs-down-fill"></i> Tidak sesuai</button>
          </div>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-3 small text-body-secondary">
          <span>Tersimpan otomatis di Riwayat. Hasil bukan diagnosis medis.</span>
          <a href="${SL.PAGES.riwayat}" class="fw-semibold">Buka Riwayat</a>
        </div>
      </div>`;

    // Animasi bar & cincin dijalankan setelah elemen masuk DOM.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      panel.querySelectorAll(".prob-bar i").forEach((el) => (el.style.width = el.dataset.w + "%"));
      const bar = panel.querySelector(".ring .bar");
      bar.style.strokeDashoffset = bar.dataset.target;
    }));

    panel.querySelectorAll("#feedbackBox button").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const isCorrect = btn.dataset.correct === "true";
        try {
          await api("/api/feedback", { method: "POST", body: { classification_id: r.id, is_correct: isCorrect } });
          document.getElementById("feedbackBox").innerHTML = `<i class="bi bi-check-circle-fill text-success"></i> Terima kasih, umpan balik Anda tersimpan.`;
        } catch (err) { toast(err.message, "danger"); }
      }));

    if (matchMedia("(max-width: 991px)").matches) panel.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    document.getElementById("verdictTitle").focus({ preventScroll: true });
  }

  /* ---------- Kirim form ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    SL.clearFieldErrors(form);
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      form.querySelector(":invalid")?.focus();
      return;
    }
    const data = new FormData(form);
    const payload = {
      age: data.get("age"), gender: data.get("gender"), height: data.get("height"),
      weight: data.get("weight"), activity: data.get("activity"),
    };

    setLoading(submitBtn, true, "Menghitung...");
    showLoading();
    try {
      const [result] = await Promise.all([api("/api/predict", { method: "POST", body: payload }), wait(1300)]);
      renderResult(result);
      toast("Klasifikasi selesai dan tersimpan di Riwayat.");
    } catch (err) {
      showError(err);
      SL.applyFieldErrors(form, err.fields);
      form.classList.add("was-validated");
    } finally {
      setLoading(submitBtn, false);
    }
  });
})();
