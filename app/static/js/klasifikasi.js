/* Halaman Klasifikasi: form, pratinjau BMI, panggilan /api/predict, render hasil. */
(() => {
  "use strict";
  const { CATEGORIES, CATEGORY_KEYS, api, fmt, escapeHtml, calcBmi, bmiKey, bmiPosition, toast, setLoading } = SL;

  const form = document.getElementById("classifyForm");
  const loading = document.getElementById("loading");
  const progress = document.getElementById("progressFill");
  const container = document.getElementById("resultContainer");
  const submitBtn = document.getElementById("btnSubmit");
  const heightEl = document.getElementById("height");
  const weightEl = document.getElementById("weight");
  const emptyHtml = container.innerHTML;
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
    const badge = document.getElementById("pvBadge");
    badge.textContent = CATEGORIES[key].name;
    badge.className = `cat-pill cat-${key}`;
    document.getElementById("pvMarker").style.left = bmiPosition(bmi) + "%";
  }
  heightEl.addEventListener("input", updatePreview);
  weightEl.addEventListener("input", updatePreview);

  // Isi otomatis dari Beranda (?tinggi=..&berat=..)
  const params = new URLSearchParams(location.search);
  if (params.get("tinggi")) heightEl.value = params.get("tinggi");
  if (params.get("berat")) weightEl.value = params.get("berat");
  updatePreview();


  // Isi form dengan data contoh supaya fitur bisa dicoba cepat
  document.getElementById("fillSample").addEventListener("click", () => {
    form.age.value = 28; form.gender.value = "Female"; form.height.value = 162; form.weight.value = 58; form.activity.value = "3";
    form.classList.remove("was-validated");
    SL.clearFieldErrors(form);
    updatePreview();
    toast("Data contoh terisi. Klik Klasifikasi untuk melihat hasil.", "info");
  });

  form.addEventListener("reset", () => {
    form.classList.remove("was-validated");
    SL.clearFieldErrors(form);
    container.innerHTML = emptyHtml;
    setTimeout(updatePreview);
  });

  /* ---------- Loading ---------- */
  function showLoading(on) {
    form.hidden = on;
    loading.classList.toggle("active", on);
    progress.style.width = on ? "0%" : "100%";
    if (on) {
      [25, 55, 85].forEach((p, i) => setTimeout(() => { progress.style.width = p + "%"; }, (i + 1) * 350));
    }
  }

  function showError(err) {
    container.innerHTML = `
      <div class="sl-card mt-3"><div class="sl-card-body text-center">
        <i class="bi bi-exclamation-triangle-fill fs-1 text-warning"></i>
        <h2 class="h5 mt-2">Klasifikasi belum berhasil</h2>
        <p class="text-muted mb-0">${escapeHtml(err.message)}</p>
      </div></div>`;
  }

  /* ---------- Render hasil (gaya kartu hasil asli) ---------- */
  function confidenceNote(pct) {
    if (pct >= 80) return "Model ensemble sangat yakin dengan hasil ini.";
    if (pct >= 60) return "Model cukup yakin, tetapi ada kemungkinan kategori lain. Lihat probabilitas di bawah.";
    return "Keyakinan rendah: hasil dekat dengan kategori lain. Anggap sebagai perkiraan kasar.";
  }

  function renderResult(r) {
    const key = r.category.key, meta = CATEGORIES[key];
    const order = [...CATEGORY_KEYS].sort((a, b) => r.probabilities[b] - r.probabilities[a]);
    const C = 2 * Math.PI * 45;

    const probRows = order.map((k) => {
      const m = CATEGORIES[k], win = k === key;
      return `
        <div class="prob-row">
          <div class="prob-icon ${m.grad}"><i class="bi ${m.icon}"></i></div>
          <div class="prob-info">
            <div class="name">${escapeHtml(m.label)} ${win ? '<span class="chip-win">Terpilih</span>' : ""}</div>
            <div class="bar-wrap"><div class="fill" data-w="${r.probabilities[k]}" style="background:${m.color};"></div></div>
          </div>
          <div class="prob-pct ${win ? "winner" : ""}" style="color:${m.color};">${fmt(r.probabilities[k])}%</div>
        </div>`;
    }).join("");

    const modelRows = CATEGORY_KEYS.map((k) => `
      <tr class="${k === key ? "best" : ""}"><td>${escapeHtml(CATEGORIES[k].name)}</td>
      <td>${fmt(r.models.lightgbm[k])}%</td><td>${fmt(r.models.mlp[k])}%</td><td>${fmt(r.probabilities[k])}%</td></tr>`).join("");

    const warnings = r.warnings.length
      ? `<div class="alert alert-warning mt-3 mb-0" role="alert"><b>Perhatikan:</b><ul class="mb-0 ps-3">${r.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>` : "";

    container.innerHTML = `
      <div class="result-card ${meta.cls}">
        <i class="bi ${meta.icon} result-icon" aria-hidden="true"></i>
        <p class="result-label">Hasil klasifikasi · BMI ${fmt(r.bmi, 1)}</p>
        <div class="result-cat" id="resultTitle" tabindex="-1">${escapeHtml(meta.label)}</div>
        <div class="confidence-wrap mt-3">
          <div class="confidence-ring" role="img" aria-label="Keyakinan ${fmt(r.confidence)} persen">
            <svg width="110" height="110" aria-hidden="true">
              <circle cx="55" cy="55" r="45" stroke="rgba(255,255,255,0.3)" stroke-width="8" fill="none"/>
              <circle class="bar" cx="55" cy="55" r="45" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"
                stroke-dasharray="${C}" stroke-dashoffset="${C}" data-target="${C * (1 - r.confidence / 100)}"/>
            </svg>
            <div class="value">${fmt(r.confidence)}%<small>Keyakinan</small></div>
          </div>
          <div class="text-start" style="max-width:240px;">
            <div style="font-size:13px; opacity:.95;"><b>Tingkat Keyakinan Ensemble</b><br><span style="opacity:.9;">${confidenceNote(r.confidence)}</span></div>
          </div>
        </div>
      </div>
      ${warnings}

      <div class="sl-card mt-3"><div class="sl-card-body">
        <h2 class="h6 fw-bold mb-3"><i class="bi bi-pie-chart-fill text-primary"></i> Probabilitas 4 Output Kategori</h2>
        <p class="small text-muted mb-3">Hasil dari <b>ensemble 0.5 × LightGBM + 0.5 × MLP</b>. Setiap bar menunjukkan tingkat probabilitas model terhadap kategori tersebut.</p>
        ${probRows}
        <button class="btn btn-sm btn-outline-primary mt-3 px-3" type="button" data-bs-toggle="collapse" data-bs-target="#modelDetail" aria-expanded="false">
          <i class="bi bi-diagram-3"></i> Bandingkan kedua model</button>
        <div class="collapse mt-3" id="modelDetail">
          <div class="table-responsive"><table class="table table-sm model-table mb-2">
            <thead><tr><th>Kategori</th><th>LightGBM</th><th>MLP</th><th>Ensemble</th></tr></thead><tbody>${modelRows}</tbody></table></div>
          <p class="small text-muted mb-0">Bila kedua model sepakat, hasil lebih meyakinkan. Bila berbeda jauh, ensemble mencari jalan tengah.</p>
        </div>
      </div></div>

      <div class="sl-card mt-3"><div class="sl-card-body">
        <h2 class="h6 fw-bold"><i class="bi bi-lightbulb-fill text-warning"></i> Rekomendasi</h2>
        <p class="mb-0 small">${escapeHtml(r.recommendation)}</p>
      </div></div>

      <div class="sl-card mt-3"><div class="sl-card-body">
        <div class="feedback-box" id="feedbackBox">
          <h2 class="h6 fw-bold mb-2"><i class="bi bi-chat-dots-fill"></i> Apakah hasil ini benar?</h2>
          <p class="small text-muted mb-2">Umpan balik Anda membantu kami meningkatkan akurasi model.</p>
          <button class="btn-fb btn-fb-yes" type="button" data-correct="true"><i class="bi bi-hand-thumbs-up-fill"></i> Ya, Benar</button>
          <button class="btn-fb btn-fb-no" type="button" data-correct="false"><i class="bi bi-hand-thumbs-down-fill"></i> Tidak, Salah</button>
        </div>
        <p class="small text-muted text-center mt-3 mb-0">Tersimpan otomatis di <a href="${SL.PAGES.riwayat}" class="fw-semibold">Riwayat</a>. Hasil bukan diagnosis medis.</p>
      </div></div>`;

    // Animasi cincin & bar setelah elemen masuk DOM.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      container.querySelectorAll(".bar-wrap .fill").forEach((el) => (el.style.width = el.dataset.w + "%"));
      const ring = container.querySelector(".confidence-ring .bar");
      ring.style.strokeDashoffset = ring.dataset.target;
    }));

    container.querySelectorAll("#feedbackBox [data-correct]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const ok = btn.dataset.correct === "true";
        try {
          await api("/api/feedback", { method: "POST", body: { classification_id: r.id, is_correct: ok } });
          document.getElementById("feedbackBox").innerHTML = `<i class="bi bi-check-circle-fill text-success"></i> Terima kasih, umpan balik Anda tersimpan.`;
          toast(ok ? "Terima kasih! Umpan balik Anda sangat berarti. 👍" : "Terima kasih! Kami akan terus meningkatkan model. 🙏", ok ? "success" : "info");
        } catch (err) { toast(err.message, "danger"); }
      }));

    container.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    document.getElementById("resultTitle").focus({ preventScroll: true });
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
    const d = new FormData(form);
    const payload = { age: d.get("age"), gender: d.get("gender"), height: d.get("height"), weight: d.get("weight"), activity: d.get("activity") };

    setLoading(submitBtn, true, "Menghitung...");
    showLoading(true);
    try {
      const [result] = await Promise.all([api("/api/predict", { method: "POST", body: payload }), wait(1300)]);
      showLoading(false);
      renderResult(result);
      toast("Klasifikasi selesai dan tersimpan di Riwayat.");
    } catch (err) {
      showLoading(false);
      showError(err);
      SL.applyFieldErrors(form, err.fields);
      form.classList.add("was-validated");
    } finally {
      setLoading(submitBtn, false);
    }
  });
})();
