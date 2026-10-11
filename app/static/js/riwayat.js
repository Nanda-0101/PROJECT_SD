/* Halaman Riwayat: daftar, filter, detail, hapus, ekspor, dan grafik. Semua data dari /api/history*. */
(() => {
  "use strict";
  const { CATEGORIES, CATEGORY_KEYS, api, fmt, fmtDate, escapeHtml, toast, catPill } = SL;

  const $ = (id) => document.getElementById(id);
  const tz = -new Date().getTimezoneOffset(); // menit dari UTC, untuk pengelompokan harian
  let rows = [];
  let hasAny = false; // apakah ada riwayat sama sekali (tanpa filter)
  let pendingDelete = null;
  const charts = {};
  const detailModal = new bootstrap.Modal($("detailModal"));
  const confirmModal = new bootstrap.Modal($("confirmModal"));

  /* ---------- Ringkasan & grafik ---------- */
  function renderSummary(s) {
    $("riwayatTotal").textContent = s.total;
    $("riwayatAvgConf").textContent = s.total ? fmt(s.avg_confidence) + "%" : "0%";
    $("riwayatMaxConf").textContent = s.total ? fmt(s.max_confidence) + "%" : "0%";
    $("riwayatMinConf").textContent = s.total ? fmt(s.min_confidence) + "%" : "0%";
    $("riwayatTopCat").innerHTML = s.top_category ? catPill(s.top_category.key) : "—";
  }

  function drawChart(name, canvas, config) {
    charts[name]?.destroy();
    charts[name] = new Chart($(canvas), config);
  }

  function renderCharts(s) {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = "#697083";
    const order = ["normal", "under", "over", "obese"];

    drawChart("pie", "pieChart", {
      type: "doughnut",
      data: { labels: order.map((k) => CATEGORIES[k].name), datasets: [{ data: order.map((k) => s.by_category[k]), backgroundColor: order.map((k) => CATEGORIES[k].color), borderWidth: 3, borderColor: "rgba(255,255,255,.9)", hoverOffset: 6 }] },
      options: { maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom" } } },
    });
    drawChart("bar", "barChart", {
      type: "bar",
      data: { labels: s.recent.map((r) => "#" + r.id), datasets: [{ label: "Keyakinan (%)", data: s.recent.map((r) => r.confidence), backgroundColor: s.recent.map((r) => CATEGORIES[r.category].color), borderRadius: 8, borderSkipped: false, maxBarThickness: 48 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, max: 100, grid: { color: "rgba(20,23,31,.06)" }, border: { display: false }, ticks: { callback: (v) => v + "%" } } } },
    });
    drawChart("line", "lineChart", {
      type: "line",
      data: { labels: s.by_day.map((d) => new Date(d.date + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short" })),
        datasets: [{ label: "Jumlah klasifikasi", data: s.by_day.map((d) => d.count), borderColor: "#0a6cf0", backgroundColor: "rgba(10,108,240,.14)", fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: "#fff", pointBorderColor: "#0a6cf0", pointBorderWidth: 2 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(20,23,31,.06)" }, border: { display: false }, ticks: { stepSize: 1, precision: 0 } } } },
    });
  }

  async function loadStats() {
    const stats = await api(`/api/history/stats?tz=${tz}`);
    hasAny = stats.total > 0;
    renderSummary(stats);
    document.querySelectorAll(".chart-empty").forEach((el) => { el.hidden = hasAny; });
    document.querySelectorAll(".chart-box canvas").forEach((el) => { el.hidden = !hasAny; });
    if (hasAny) renderCharts(stats);
    else Object.values(charts).forEach((c) => c.destroy());
    $("btnExport").disabled = !hasAny;
    $("btnClearAll").disabled = !hasAny;
    return stats;
  }

  /* ---------- Tabel ---------- */
  const query = () => new URLSearchParams({ q: $("fSearch").value, category: $("fCategory").value, sort: $("fSort").value }).toString();

  function renderTable() {
    const body = $("historyBody");
    $("resultCount").textContent = rows.length ? `${rows.length} hasil` : "";
    if (!rows.length && !hasAny) {
      body.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="bi bi-inbox"></i>
        <p class="mt-2 mb-3">Belum ada riwayat klasifikasi</p>
        <a href="${SL.PAGES.klasifikasi}" class="btn btn-sl btn-sm"><i class="bi bi-play-circle-fill me-1"></i> Mulai Klasifikasi</a></div></td></tr>`;
      return;
    }
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="bi bi-funnel"></i>
        <p class="mt-2 mb-0">Tidak ada riwayat yang cocok. <button class="btn btn-link p-0 align-baseline" id="resetFilter" type="button">Reset filter</button></p></div></td></tr>`;
      $("resetFilter").addEventListener("click", () => { $("fSearch").value = ""; $("fCategory").value = ""; $("fSort").value = "desc"; loadTable(); });
      return;
    }
    body.innerHTML = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><small>${fmtDate(r.created_at)}</small></td>
        <td>${fmt(r.age, 0)}</td><td>${r.gender === "Male" ? "L" : "P"}</td>
        <td>${fmt(r.height, 0)} cm</td><td>${fmt(r.weight, 0)} kg</td><td>${r.activity}</td>
        <td>${catPill(r.category.key)}</td>
        <td><span class="row-actions">
          <button class="btn btn-sm btn-outline-primary" data-act="detail" data-id="${r.id}" title="Detail" aria-label="Lihat detail"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-act="delete" data-id="${r.id}" title="Hapus" aria-label="Hapus"><i class="bi bi-trash"></i></button>
        </span></td>
      </tr>`).join("");
  }

  async function loadTable() {
    try {
      rows = (await api(`/api/history?${query()}`)).items;
      renderTable();
    } catch (err) { showLoadError(err); }
  }

  function showLoadError(err) {
    const box = $("loadError");
    box.textContent = err.message;
    box.classList.remove("d-none");
  }

  /* ---------- Detail ---------- */
  function showDetail(id) {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    const probs = CATEGORY_KEYS.map((k) => `
      <div class="mb-2"><div class="d-flex justify-content-between small"><span>${escapeHtml(CATEGORIES[k].name)}</span><b>${fmt(r.probabilities[k])}%</b></div>
      <div class="mini-bar"><i style="width:${r.probabilities[k]}%; background:${CATEGORIES[k].color};"></i></div></div>`).join("");
    $("detailBody").innerHTML = `
      <div class="mb-3"><span class="cat-pill cat-${r.category.key}" style="font-size:.9rem">${escapeHtml(CATEGORIES[r.category.key].label)}</span>
        <span class="ms-2 small text-muted">keyakinan ${fmt(r.confidence)}%</span></div>
      <dl class="detail-grid mb-4">
        <dt>Tanggal</dt><dd>${fmtDate(r.created_at)}</dd>
        <dt>Usia</dt><dd>${fmt(r.age, 0)} tahun</dd>
        <dt>Gender</dt><dd>${r.gender === "Male" ? "Laki-laki" : "Perempuan"}</dd>
        <dt>Tinggi</dt><dd>${fmt(r.height, 0)} cm</dd><dt>Berat</dt><dd>${fmt(r.weight, 0)} kg</dd>
        <dt>BMI</dt><dd>${fmt(r.bmi)}</dd><dt>Aktivitas</dt><dd>Tingkat ${r.activity} dari 4</dd>
      </dl>
      <h3 class="h6 fw-bold">Probabilitas</h3>${probs}`;
    detailModal.show();
  }

  /* ---------- Hapus ---------- */
  function askDelete(target) {
    pendingDelete = target;
    $("confirmText").textContent = target === "all" ? "Semua riwayat klasifikasi Anda akan dihapus permanen." : "Riwayat ini akan dihapus permanen.";
    confirmModal.show();
  }

  $("confirmOk").addEventListener("click", async () => {
    const target = pendingDelete;
    confirmModal.hide();
    try {
      await api(target === "all" ? "/api/history" : `/api/history/${target}`, { method: "DELETE" });
      toast(target === "all" ? "Semua riwayat dihapus" : "Riwayat dihapus", target === "all" ? "warning" : "info");
      await loadStats();
      await loadTable();
    } catch (err) { toast(err.message, "danger"); }
  });

  /* ---------- Event ---------- */
  $("historyBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    btn.dataset.act === "detail" ? showDetail(id) : askDelete(id);
  });
  $("btnClearAll").addEventListener("click", () => askDelete("all"));

  /* Ekspor CSV dibuat di browser dari data riwayat. */
  $("btnExport").addEventListener("click", async () => {
    try {
      const { items } = await api("/api/history");
      if (!items.length) { toast("Tidak ada data untuk diexport", "warning"); return; }
      const head = ["Tanggal (UTC)", "Usia", "Gender", "Tinggi (cm)", "Berat (kg)", "Aktivitas", "BMI", "Kategori", "Keyakinan (%)"];
      const lines = [head, ...items.map((r) => [r.created_at, r.age, r.gender, r.height, r.weight, r.activity, r.bmi, r.category.name, r.confidence])]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
      link.download = "riwayat_sakitlearn.csv";
      link.click();
      URL.revokeObjectURL(link.href);
      toast("CSV berhasil diunduh");
    } catch (err) { toast(err.message, "danger"); }
  });

  let timer;
  $("fSearch").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(loadTable, 250); });
  $("fCategory").addEventListener("change", loadTable);
  $("fSort").addEventListener("change", loadTable);

  (async () => {
    try {
      await loadStats();
      await loadTable();
    } catch (err) { showLoadError(err); }
  })();
})();
