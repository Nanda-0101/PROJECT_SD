/* Halaman Klasifikasi: kirim data ke /api/ml/predict (Flask), render hasil
   dengan probabilitas per model (LightGBM, MLP, Ensemble) + feedback. */
(() => {
  "use strict";

  const CLASS_LABELS = ["Underweight", "Normal weight", "Overweight", "Obese"];

  const META = {
    "Underweight":   { color: "#06b6d4", icon: "bi-arrow-down-circle" },
    "Normal weight": { color: "#16a34a", icon: "bi-check-circle" },
    "Overweight":    { color: "#f5a700", icon: "bi-exclamation-circle" },
    "Obese":         { color: "#e5384f", icon: "bi-x-octagon" },
  };

  const RECOMMENDATIONS = {
    "Underweight":   "Tingkatkan asupan kalori bergizi dan konsultasikan ke ahli gizi.",
    "Normal weight": "Pertahankan pola makan sehat dan aktivitas fisik rutin.",
    "Overweight":    "Kurangi makanan tinggi gula/lemak dan tingkatkan olahraga.",
    "Obese":         "Segera konsultasi ke dokter atau ahli gizi untuk program penurunan berat badan.",
  };

  const form = document.getElementById("classifyForm");
  const submitBtn = document.getElementById("btnSubmit");
  const container = document.getElementById("resultContainer");
  const emptyHtml = container.innerHTML;

  const fmt = (n, d = 1) => Number(n).toFixed(d);
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

    const winnerIdx =
      typeof apiData.prediction === "number"
        ? apiData.prediction
        : CLASS_LABELS.reduce(
            (best, label, i) => (ensemble[label] > ensemble[CLASS_LABELS[best]] ? i : best),
            0
          );

    const winnerLabel = CLASS_LABELS[winnerIdx] ?? "Normal weight";
    const confidence =
      typeof apiData.confidence === "number"
        ? apiData.confidence
        : ensemble[winnerLabel] ?? 0;

    return { ensemble, lgbm, mlp, winnerIdx, winnerLabel, confidence, hasPerModel };
  }

  /* ---------- Baris probabilitas untuk 1 model ---------- */
  function renderProbRows(probMap, winnerLabel) {
    const sorted = [...CLASS_LABELS].sort((a, b) => (probMap[b] ?? 0) - (probMap[a] ?? 0));

    return sorted
      .map((label) => {
        const pct = probMap[label] ?? 0;
        const meta = META[label];
        const isWinner = label === winnerLabel;
        return `
          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span>
                <i class="bi ${meta.icon} me-1" style="color:${meta.color}" aria-hidden="true"></i>
                <b>${escapeHtml(label)}</b>
              </span>
              <b style="color:${meta.color}">${fmt(pct, 2)}%</b>
            </div>
            <div class="progress" style="height:10px;">
              <div class="progress-bar" role="progressbar"
                   style="width:${pct}%; background:${meta.color};"
                   aria-valuenow="${fmt(pct, 1)}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
          </div>`;
      })
      .join("");
  }

  /* ---------- Kartu probabilitas untuk 1 model ---------- */
  function renderModelCard(title, icon, probMap, winnerLabel, subtitle) {
    return `
      <div class="sl-card mt-3">
        <div class="sl-card-head">
          <i class="bi ${icon}" aria-hidden="true"></i> ${title}
        </div>
        <div class="sl-card-body">
          ${subtitle ? `<p class="small text-muted mb-3">${subtitle}</p>` : ""}
          ${renderProbRows(probMap, winnerLabel)}
        </div>
      </div>`;
  }

  /* ---------- Tabel perbandingan ---------- */
  function renderCompareTable(lgbm, mlp, ensemble, winnerLabel) {
    const rows = CLASS_LABELS.map((label) => {
      const isWinner = label === winnerLabel;
      return `
        <tr class="${isWinner ? "table-success fw-semibold" : ""}">
          <td>
            <i class="bi ${META[label].icon} me-1" style="color:${META[label].color}" aria-hidden="true"></i>
            ${escapeHtml(label)}
          </td>
          <td class="text-end">${fmt(lgbm[label], 2)}%</td>
          <td class="text-end">${fmt(mlp[label], 2)}%</td>
          <td class="text-end"><b>${fmt(ensemble[label], 2)}%</b></td>
        </tr>`;
    }).join("");

    return `
      <div class="sl-card mt-3">
        <div class="sl-card-head">
          <i class="bi bi-table" aria-hidden="true"></i> Perbandingan Model
        </div>
        <div class="sl-card-body">
          <p class="small text-muted mb-3">
            Ensemble = weighted average <b>0.5 × LightGBM + 0.5 × MLP</b>.
            Baris hijau menandai kategori terpilih.
          </p>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Kelas Target</th>
                  <th scope="col" class="text-end">LightGBM</th>
                  <th scope="col" class="text-end">MLP</th>
                  <th scope="col" class="text-end">Ensemble</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  /* ---------- Render hasil lengkap + feedback ---------- */
  function renderResult(apiData) {
    const { ensemble, lgbm, mlp, winnerLabel, confidence, hasPerModel } = normalize(apiData);
    const meta = META[winnerLabel];
    const idPrediction = apiData.id_prediction;

    const mainCard = `
      <div class="sl-card mt-3" style="border-left:6px solid ${meta.color};">
        <div class="sl-card-body text-center">
          <i class="bi ${meta.icon} fs-1" style="color:${meta.color};" aria-hidden="true"></i>
          <h2 class="h4 mt-2 mb-1">${escapeHtml(winnerLabel)}</h2>
          <p class="mb-0 text-muted">
            Kategori terpilih · keyakinan ensemble <b>${fmt(confidence, 2)}%</b>
          </p>
        </div>
      </div>`;

    const cards = hasPerModel
      ? [
          renderModelCard("LightGBM", "bi-lightning-charge-fill", lgbm, winnerLabel,
            "Probabilitas dari model LightGBM (50% bobot ensemble)."),
          renderModelCard("MLP (Multi-Layer Perceptron)", "bi-diagram-3-fill", mlp, winnerLabel,
            "Probabilitas dari model MLP (50% bobot ensemble)."),
          renderModelCard("Ensemble (0.5 × LightGBM + 0.5 × MLP)", "bi-pie-chart-fill", ensemble, winnerLabel,
            "Hasil gabungan — inilah prediksi akhir yang dipakai."),
        ].join("")
      : renderModelCard("Probabilitas 4 Kategori", "bi-pie-chart-fill", ensemble, winnerLabel,
          "Hasil dari weighted average 0.5 × LightGBM + 0.5 × MLP.");

    const compareTable = hasPerModel
      ? renderCompareTable(lgbm, mlp, ensemble, winnerLabel)
      : "";

    const recommendation = `
      <div class="sl-card mt-3">
        <div class="sl-card-head">
          <i class="bi bi-lightbulb-fill" aria-hidden="true"></i> Rekomendasi
        </div>
        <div class="sl-card-body">
          <p class="mb-0">${escapeHtml(RECOMMENDATIONS[winnerLabel] ?? "")}</p>
        </div>
      </div>`;

    const feedbackCard = idPrediction ? `
      <div class="sl-card mt-3">
        <div class="sl-card-head">
          <i class="bi bi-chat-dots-fill" aria-hidden="true"></i> Apakah hasil ini benar?
        </div>
        <div class="sl-card-body" id="feedbackBox">
          <p class="small text-muted mb-3">Umpan balik Anda membantu kami meningkatkan akurasi model.</p>
          <div class="d-flex gap-2 flex-wrap">
            <button type="button" class="btn btn-outline-success" data-correct="true">
              <i class="bi bi-hand-thumbs-up-fill me-1" aria-hidden="true"></i> Ya, Benar
            </button>
            <button type="button" class="btn btn-outline-danger" data-correct="false">
              <i class="bi bi-hand-thumbs-down-fill me-1" aria-hidden="true"></i> Tidak, Salah
            </button>
          </div>
        </div>
      </div>` : "";

    const disclaimer = `
      <p class="small text-muted text-center mt-3 mb-0">
        Hasil bersifat indikatif, bukan diagnosis medis.
      </p>`;

    container.innerHTML =
      mainCard + cards + compareTable + recommendation + feedbackCard + disclaimer;

    // --- Wire feedback buttons ---
    if (idPrediction) {
      container.querySelectorAll("#feedbackBox [data-correct]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const isAccurate = btn.dataset.correct === "true";
          // Disable kedua tombol
          container.querySelectorAll("#feedbackBox [data-correct]").forEach((b) => (b.disabled = true));

          try {
            const base = (window.SL_CONFIG?.ML_API_BASE || "").replace(/\/$/, "");
            const res = await fetch(`${base}/feedback`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({
                id_prediction: idPrediction,
                is_accurate: isAccurate,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

            const box = document.getElementById("feedbackBox");
            if (box) {
              box.innerHTML = `
                <div class="alert alert-success mb-0 d-flex align-items-center gap-2" role="alert">
                  <i class="bi bi-check-circle-fill" aria-hidden="true"></i>
                  <span>Terima kasih! Umpan balik Anda sudah tersimpan.</span>
                </div>`;
            }
          } catch (err) {
            container.querySelectorAll("#feedbackBox [data-correct]").forEach((b) => (b.disabled = false));
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
    const payload = {
      Age: Number(d.get("age")),
      Gender_Encoded: d.get("gender") === "Male" ? 1 : 0,
      Height_winsorized: Number(d.get("height")),
      Weight_winsorized: Number(d.get("weight")),
      PhysicalActivityLevel: Number(d.get("activity")),
    };

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