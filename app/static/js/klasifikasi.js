/* Halaman Klasifikasi: kirim 14 fitur mentah ke /api/ml/predict (Flask),
   render hasil dengan probabilitas per model (LightGBM, MLP, Ensemble) + feedback.
   Sesuai model Ensemble v3 (dataset Obesity Koklu & Sulak, 2024). */
(() => {
  "use strict";

  // Harus SAMA PERSIS dengan config["class_names"] di HF Hub
  const CLASS_LABELS = ["Underweight", "Normal", "Overweight", "Obesity"];

  const META = {
    Underweight: {
      color: "#06b6d4",
      bg: "#ecfeff",
      border: "#a5f3fc",
      icon: "bi-arrow-down-circle",
      emoji: "🩵",
    },
    Normal: {
      color: "#16a34a",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      icon: "bi-check-circle",
      emoji: "💚",
    },
    Overweight: {
      color: "#f5a700",
      bg: "#fffbeb",
      border: "#fde68a",
      icon: "bi-exclamation-circle",
      emoji: "💛",
    },
    Obesity: {
      color: "#e5384f",
      bg: "#fef2f2",
      border: "#fecaca",
      icon: "bi-x-octagon",
      emoji: "❤️",
    },
  };

  const RECOMMENDATIONS = {
    Underweight: "Tingkatkan asupan kalori bergizi dan konsultasikan ke ahli gizi.",
    Normal: "Pertahankan pola makan sehat dan aktivitas fisik rutin.",
    Overweight: "Kurangi makanan tinggi gula/lemak dan tingkatkan olahraga.",
    Obesity: "Segera konsultasi ke dokter atau ahli gizi untuk program penurunan berat badan.",
  };

  const FEATURE_FIELDS = [
    "Sex", "Age", "Height",
    "Overweight_Obese_Family", "Consumption_of_Fast_Food",
    "Frequency_of_Consuming_Vegetables", "Number_of_Main_Meals_Daily",
    "Food_Intake_Between_Meals", "Smoking", "Liquid_Intake_Daily",
    "Calculation_of_Calorie_Intake", "Physical_Exercise",
    "Schedule_Dedicated_to_Technology", "Type_of_Transportation_Used",
  ];

  const form = document.getElementById("classifyForm");
  const submitBtn = document.getElementById("btnSubmit");
  const container = document.getElementById("resultContainer");
  const emptyHtml = container.innerHTML;

  const fmt = (n, d = 1) => Number(n).toFixed(d);
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Helper: argmax per-model ---------- */
  function argmaxLabel(probMap) {
    if (!probMap) return null;
    let best = CLASS_LABELS[0];
    for (const label of CLASS_LABELS) {
      if ((probMap[label] ?? 0) > (probMap[best] ?? 0)) best = label;
    }
    return best;
  }

  /* ---------- Normalisasi respons backend ---------- */
  function normalize(apiData) {
    const hasPerModel = apiData.lgbm && apiData.mlp && apiData.ensemble;
    let ensemble, lgbm, mlp;

    if (hasPerModel) {
      ensemble = apiData.ensemble;
      lgbm = apiData.lgbm;
      mlp = apiData.mlp;
    } else {
      ensemble = {};
      CLASS_LABELS.forEach((label, i) => {
        const v = apiData.probabilities?.[`Class_${i}`];
        ensemble[label] = typeof v === "number" ? v * 100 : 0;
      });
      lgbm = null;
      mlp = null;
    }

    // Prediksi final = argmax ensemble (atau field prediction dari server)
    const winnerIdx =
      typeof apiData.prediction === "number"
        ? apiData.prediction
        : CLASS_LABELS.reduce(
            (best, label, i) => (ensemble[label] > ensemble[CLASS_LABELS[best]] ? i : best),
            0
          );

    const winnerLabel = CLASS_LABELS[winnerIdx] ?? "Normal";
    const confidence =
      typeof apiData.confidence === "number"
        ? apiData.confidence
        : ensemble[winnerLabel] ?? 0;

    // Pemenang per-model (argmax masing-masing), untuk badge di kartu model
    const lgbmWinner = hasPerModel ? argmaxLabel(lgbm) : null;
    const mlpWinner = hasPerModel ? argmaxLabel(mlp) : null;

    return {
      ensemble, lgbm, mlp,
      winnerIdx, winnerLabel, confidence,
      hasPerModel,
      lgbmWinner, mlpWinner,
    };
  }

  /* ---------- Bar probabilitas (satu kelas) ---------- */
  function renderProbBar(label, pct, isWinner) {
    const m = META[label];
    return `
      <div class="prob-row ${isWinner ? "prob-row--winner" : ""}">
        <div class="prob-row__head">
          <span class="prob-row__label">
            <i class="bi ${m.icon}" style="color:${m.color}" aria-hidden="true"></i>
            <span>${escapeHtml(label)}</span>
            ${isWinner ? `<span class="prob-row__badge" style="background:${m.color}">Terpilih</span>` : ""}
          </span>
          <span class="prob-row__value" style="color:${m.color}">${fmt(pct, 2)}%</span>
        </div>
        <div class="prob-row__track">
          <div class="prob-row__fill" style="width:${pct}%; background:linear-gradient(90deg, ${m.color}cc, ${m.color});"></div>
        </div>
      </div>`;
  }

  /* ---------- Kartu probabilitas untuk satu model ---------- */
  function renderModelCard({ title, icon, badge, accent, probMap, subtitle }) {
    // Pemenang = argmax probabilitas model ini (bukan pemenang global)
    const modelWinner = argmaxLabel(probMap);

    const sorted = [...CLASS_LABELS].sort((a, b) => (probMap[b] ?? 0) - (probMap[a] ?? 0));
    const rows = sorted
      .map((l) => renderProbBar(l, probMap[l] ?? 0, l === modelWinner))
      .join("");

    return `
      <div class="prob-card" style="--accent:${accent};">
        <div class="prob-card__head">
          <div class="prob-card__title">
            <span class="prob-card__icon" style="background:${accent}1a; color:${accent};">
              <i class="bi ${icon}" aria-hidden="true"></i>
            </span>
            <div>
              <div class="prob-card__name">${title}</div>
              <div class="prob-card__sub">${badge}</div>
            </div>
          </div>
        </div>
        <div class="prob-card__body">
          ${subtitle ? `<p class="prob-card__desc">${subtitle}</p>` : ""}
          ${rows}
        </div>
      </div>`;
  }

  /* ---------- Tabel perbandingan ---------- */
  function renderCompareTable(lgbm, mlp, ensemble, winnerLabel) {
    const modelList = [
      { key: "lgbm", title: "LightGBM", color: "#8b5cf6", icon: "bi-lightning-charge-fill", data: lgbm },
      { key: "mlp", title: "MLP", color: "#0ea5e9", icon: "bi-diagram-3-fill", data: mlp },
      { key: "ens", title: "Ensemble", color: "#16a34a", icon: "bi-pie-chart-fill", data: ensemble },
    ];

    // Pemenang per kolom model (untuk menandai sel yang jadi argmax di kolom itu)
    const colWinners = modelList.map((m) => argmaxLabel(m.data));

    const rows = CLASS_LABELS.map((label) => {
      const m = META[label];
      const isWinner = label === winnerLabel; // untuk highlight baris (pemenang ensemble)

      const cells = modelList
        .map((model, idx) => {
          const pct = model.data[label] ?? 0;
          // highlight sel jika kelas ini adalah argmax dari kolom model tsb
          const isColWinner = colWinners[idx] === label;
          return `
            <td class="cmp-cell ${isColWinner ? "cmp-cell--winner" : ""}">
              <div class="cmp-bar">
                <div class="cmp-bar__fill" style="width:${pct}%; background:${model.color};"></div>
              </div>
              <span class="cmp-value" style="color:${pct > 0 ? model.color : "#94a3b8"}">${fmt(pct, 2)}%</span>
            </td>`;
        })
        .join("");

      return `
        <tr class="${isWinner ? "cmp-row--winner" : ""}">
          <td class="cmp-label">
            <i class="bi ${m.icon}" style="color:${m.color}" aria-hidden="true"></i>
            <span>${escapeHtml(label)}</span>
            ${isWinner ? `<span class="cmp-badge" style="background:${m.color}">✓</span>` : ""}
          </td>
          ${cells}
        </tr>`;
    }).join("");

    return `
      <div class="prob-card mt-3" style="--accent:#6366f1;">
        <div class="prob-card__head">
          <div class="prob-card__title">
            <span class="prob-card__icon" style="background:#6366f11a; color:#6366f1;">
              <i class="bi bi-table" aria-hidden="true"></i>
            </span>
            <div>
              <div class="prob-card__name">Perbandingan Model</div>
              <div class="prob-card__sub">Ensemble = 0.5 × LightGBM + 0.5 × MLP</div>
            </div>
          </div>
        </div>
        <div class="prob-card__body">
          <div class="table-responsive">
            <table class="cmp-table">
              <thead>
                <tr>
                  <th>Kelas</th>
                  ${modelList.map((m) => `
                    <th class="text-center">
                      <i class="bi ${m.icon}" style="color:${m.color}"></i>
                      <span>${m.title}</span>
                    </th>`).join("")}
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  /* ---------- Hero winner (pakai pemenang ENSEMBLE) ---------- */
  function renderHeroCard(winnerLabel, confidence) {
    const m = META[winnerLabel];
    return `
      <div class="winner-hero" style="--w-color:${m.color}; --w-bg:${m.bg}; --w-border:${m.border};">
        <div class="winner-hero__glow"></div>
        <div class="winner-hero__icon">
          <i class="bi ${m.icon}" aria-hidden="true"></i>
        </div>
        <div class="winner-hero__body">
          <div class="winner-hero__eyebrow">Kategori terpilih (ensemble)</div>
          <h2 class="winner-hero__title">${escapeHtml(winnerLabel)}</h2>
          <div class="winner-hero__confidence">
            <span class="winner-hero__conf-value">${fmt(confidence, 2)}%</span>
            <span class="winner-hero__conf-label">keyakinan ensemble</span>
          </div>
          <div class="winner-hero__meter">
            <div class="winner-hero__meter-fill" style="width:${confidence}%"></div>
          </div>
        </div>
      </div>`;
  }

  /* ---------- Feedback card ---------- */
  function renderFeedbackCard(idPrediction) {
    if (!idPrediction) return "";
    return `
      <div class="feedback-card mt-3">
        <div class="feedback-card__head">
          <span class="feedback-card__icon">
            <i class="bi bi-chat-dots-fill" aria-hidden="true"></i>
          </span>
          <div>
            <div class="feedback-card__title">Apakah hasil ini benar?</div>
            <div class="feedback-card__sub">Umpan balik Anda membantu kami meningkatkan akurasi model.</div>
          </div>
        </div>
        <div class="feedback-card__body" id="feedbackBox">
          <button type="button" class="feedback-btn feedback-btn--yes" data-correct="true">
            <i class="bi bi-hand-thumbs-up-fill" aria-hidden="true"></i>
            <span>Ya, Benar</span>
          </button>
          <button type="button" class="feedback-btn feedback-btn--no" data-correct="false">
            <i class="bi bi-hand-thumbs-down-fill" aria-hidden="true"></i>
            <span>Tidak, Salah</span>
          </button>
        </div>
      </div>`;
  }

  /* ---------- Render hasil lengkap ---------- */
  function renderResult(apiData) {
    const {
      ensemble, lgbm, mlp,
      winnerLabel, confidence, hasPerModel,
      lgbmWinner, mlpWinner,
    } = normalize(apiData);

    const m = META[winnerLabel] || META["Normal"];
    const idPrediction = apiData.id_prediction;

    // Hero & rekomendasi = pemenang ENSEMBLE (prediksi final)
    const hero = renderHeroCard(winnerLabel, confidence);

    const cards = hasPerModel
      ? [
          renderModelCard({
            title: "LightGBM",
            icon: "bi-lightning-charge-fill",
            accent: "#8b5cf6",
            badge: "Gradient Boosting",
            probMap: lgbm,
            subtitle: "Probabilitas per kelas dari model pohon (50% bobot ensemble).",
          }),
          renderModelCard({
            title: "MLP",
            icon: "bi-diagram-3-fill",
            accent: "#0ea5e9",
            badge: "Neural Network",
            probMap: mlp,
            subtitle: "Probabilitas per kelas dari jaringan saraf (50% bobot ensemble).",
          }),
          renderModelCard({
            title: "Ensemble 0.5/0.5",
            icon: "bi-pie-chart-fill",
            accent: m.color,
            badge: "0.5 × LGBM + 0.5 × MLP",
            probMap: ensemble,
            subtitle: "Rata-rata probabilitas — inilah prediksi akhir yang dipakai.",
          }),
        ].join("")
      : renderModelCard({
          title: "Probabilitas 4 Kelas",
          icon: "bi-pie-chart-fill",
          accent: m.color,
          badge: "Ensemble",
          probMap: ensemble,
          subtitle: "Hasil dari weighted average 0.5 × LightGBM + 0.5 × MLP.",
        });

    const compareTable = hasPerModel
      ? renderCompareTable(lgbm, mlp, ensemble, winnerLabel)
      : "";

    // Info kecil: siapa menang di model mana
    const modelWinnersNote = hasPerModel
      ? `<p class="small text-muted text-center mt-2 mb-0">
           LightGBM → <strong>${escapeHtml(lgbmWinner || "-")}</strong> ·
           MLP → <strong>${escapeHtml(mlpWinner || "-")}</strong> ·
           Ensemble → <strong>${escapeHtml(winnerLabel)}</strong>
         </p>`
      : "";

    const recommendation = `
      <div class="reco-card mt-3" style="--reco-color:${m.color}; --reco-bg:${m.bg};">
        <div class="reco-card__icon">
          <i class="bi bi-lightbulb-fill" aria-hidden="true"></i>
        </div>
        <div>
          <div class="reco-card__title">Rekomendasi</div>
          <p class="reco-card__text">${escapeHtml(RECOMMENDATIONS[winnerLabel] ?? "")}</p>
        </div>
      </div>`;

    const feedback = renderFeedbackCard(idPrediction);

    const disclaimer = `
      <p class="small text-muted text-center mt-3 mb-0">
        Hasil bersifat indikatif, bukan diagnosis medis.
      </p>`;

    container.innerHTML = `
      <div class="result-wrap">
        ${hero}
        <div class="prob-grid">${cards}</div>
        ${modelWinnersNote}
        ${compareTable}
        ${recommendation}
        ${feedback}
        ${disclaimer}
      </div>`;

    /* Wire feedback buttons */
    if (idPrediction) {
      container.querySelectorAll("#feedbackBox [data-correct]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const isAccurate = btn.dataset.correct === "true";
          container.querySelectorAll("#feedbackBox [data-correct]").forEach((b) => {
            b.disabled = true;
            b.classList.add("is-loading");
          });

          try {
            const base = (window.SL_CONFIG?.ML_API_BASE || "").replace(/\/$/, "");
            const res = await fetch(`${base}/feedback`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ id_prediction: idPrediction, is_accurate: isAccurate }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

            const box = document.getElementById("feedbackBox");
            if (box) {
              box.innerHTML = `
                <div class="feedback-success">
                  <i class="bi bi-check-circle-fill" aria-hidden="true"></i>
                  <span>Terima kasih! Umpan balik Anda sudah tersimpan.</span>
                </div>`;
            }
          } catch (err) {
            container.querySelectorAll("#feedbackBox [data-correct]").forEach((b) => {
              b.disabled = false;
              b.classList.remove("is-loading");
            });
            alert("Gagal menyimpan feedback: " + err.message);
          }
        });
      });
    }
  }

  /* ---------- Loading / Error ---------- */
  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.innerHTML = on
      ? `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Menghitung...`
      : `<i class="bi bi-search me-1" aria-hidden="true"></i> Klasifikasi`;
  }

  function showError(msg) {
    container.innerHTML = `
      <div class="sl-card mt-3"><div class="sl-card-body text-center">
        <i class="bi bi-exclamation-triangle-fill fs-1 text-warning" aria-hidden="true"></i>
        <h2 class="h5 mt-2">Klasifikasi belum berhasil</h2>
        <p class="text-muted mb-0">${escapeHtml(msg)}</p>
      </div></div>`;
  }

  /* ---------- Submit ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    form.classList.add("was-validated");

    if (!form.checkValidity()) {
      form.querySelector(":invalid")?.focus();
      return;
    }

    const d = new FormData(form);
    const payload = {};
    for (const key of FEATURE_FIELDS) {
      payload[key] = Number(d.get(key));
    }

    const bad = Object.entries(payload).filter(([, v]) => Number.isNaN(v));
    if (bad.length) {
      showError(`Nilai tidak valid untuk: ${bad.map(([k]) => k).join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      const base = (window.SL_CONFIG?.ML_API_BASE || "").replace(/\/$/, "");
      const res = await fetch(`${base}/predict`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      renderResult(data);
      container.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  });

  /* ---------- Reset ---------- */
  form.addEventListener("reset", () => {
    form.classList.remove("was-validated");
    container.innerHTML = emptyHtml;
  });
})();