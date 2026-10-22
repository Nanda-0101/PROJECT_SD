/* Halaman Riwayat: daftar, filter, detail, hapus, ekspor CSV, dan grafik. Semua data dari /api/history*. */

// IIFE: membungkus semua kode agar variabelnya tidak bocor ke global.
(() => {
  "use strict"; // mode ketat

  // Fungsi bantu dari common.js (objek global SL).
  // api = kirim request, fmt = format angka, fmtDate = format tanggal,
  // escapeHtml = amankan teks sebelum masuk HTML, toast = notifikasi kecil, catPill = label kategori.
  const { CATEGORIES, CATEGORY_KEYS, api, fmt, fmtDate, escapeHtml, toast, catPill } = SL;

  /* ---------- Konstanta (ubah di sini, bukan di tengah kode) ---------- */

  const CHART_ORDER = ["normal", "under", "over", "obese"]; // urutan kategori di grafik donat
  const PAGE_SIZE = 8; // jumlah baris per halaman tabel
  const SEARCH_DEBOUNCE_MS = 250; // jeda setelah berhenti mengetik sebelum mencari (hemat request)
  const CSV_REVOKE_DELAY_MS = 1000; // waktu tunggu sebelum URL unduhan dibuang dari memori
  const COLOR = {
    text: "#697083", // warna teks grafik
    grid: "rgba(20,23,31,.06)", // warna garis kisi grafik
    blue: "#0a6cf0", // warna garis pada grafik tren
    blueSoft: "rgba(10,108,240,.14)", // warna isi di bawah garis
  };

  /* ---------- Referensi & state (data yang berubah selama halaman terbuka) ---------- */

  const $ = (id) => document.getElementById(id); // singkatan: $("fSearch") = document.getElementById("fSearch")
  const timezoneOffsetMinutes = -new Date().getTimezoneOffset(); // selisih zona waktu dari UTC, agar "harian" sesuai jam setempat

  let pageSize = PAGE_SIZE; // dinaikkan sementara saat mencetak supaya semua baris ikut
  const selected = new Set(); // id riwayat yang dicentang untuk hapus massal
  const NOTE_KEY = "sakitlearn_notes"; // kunci penyimpanan catatan di browser
  let view = "table"; // tampilan aktif, "table" atau "card"
  let page = 1; // halaman tabel yang sedang dibuka
  let lastCounts = {}; // jumlah riwayat per kategori, dipakai untuk label chip
  let rows = []; // daftar riwayat yang sedang tampil di tabel
  let hasAny = false; // apakah ada riwayat sama sekali (tanpa memperhitungkan filter)
  let pendingDelete = null; // yang akan dihapus: id angka, atau "all"; null = tidak ada
  let tableRequestId = 0; // nomor permintaan tabel terakhir (untuk membuang jawaban usang)
  let searchTimer; // penampung timer debounce pencarian
  const charts = {}; // grafik yang sedang aktif, disimpan agar bisa dihancurkan sebelum digambar ulang

  const detailModal = new bootstrap.Modal($("detailModal")); // objek untuk membuka/menutup modal detail
  const confirmModal = new bootstrap.Modal($("confirmModal")); // objek untuk modal konfirmasi hapus

  /* ==========================================================================
     RINGKASAN & GRAFIK
     ========================================================================== */

  function renderSummary(stats) {
    const hasData = stats.total > 0;
    const percent = (value) => (hasData ? `${fmt(value)}%` : "0%"); // tanpa data, tampilkan 0% (bukan NaN)

    $("riwayatTotal").textContent = stats.total;
    $("riwayatAvgConf").textContent = percent(stats.avg_confidence);
    $("riwayatMaxConf").textContent = percent(stats.max_confidence);
    $("riwayatMinConf").textContent = percent(stats.min_confidence);
    $("riwayatTopCat").innerHTML = stats.top_category ? catPill(stats.top_category.key) : "—";
  }

  /* --- Konfigurasi tiap grafik (fungsi yang MENGEMBALIKAN pengaturan Chart.js) --- */

  // Grafik donat: jumlah riwayat per kategori
  const pieConfig = (stats) => ({
    type: "doughnut",
    data: {
      labels: CHART_ORDER.map((key) => CATEGORIES[key].name),
      datasets: [
        {
          data: CHART_ORDER.map((key) => stats.by_category[key]),
          backgroundColor: CHART_ORDER.map((key) => CATEGORIES[key].color),
          borderWidth: 3,
          borderColor: "rgba(255,255,255,.9)",
          hoverOffset: 6, // irisan menonjol saat disorot
        },
      ],
    },
    options: {
      maintainAspectRatio: false, // tinggi mengikuti .chart-box, bukan rasio bawaan
      cutout: "62%", // ukuran lubang donat
      plugins: { legend: { position: "bottom" } },
    },
  });

  // Grafik batang: tingkat keyakinan tiap klasifikasi terbaru
  const barConfig = (stats) => ({
    type: "bar",
    data: {
      labels: stats.recent.map((item) => `#${item.id}`),
      datasets: [
        {
          label: "Keyakinan (%)",
          data: stats.recent.map((item) => item.confidence),
          backgroundColor: stats.recent.map((item) => CATEGORIES[item.category].color), // warna batang = warna kategori
          borderRadius: 8,
          borderSkipped: false, // sudut membulat di semua sisi
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          max: 100, // skala persen selalu 0-100
          grid: { color: COLOR.grid },
          border: { display: false },
          ticks: { callback: (value) => `${value}%` }, // tambah tanda % pada angka sumbu
        },
      },
    },
  });

  // Grafik garis: jumlah klasifikasi per hari
  const lineConfig = (stats) => ({
    type: "line",
    data: {
      // "2026-10-01" -> "01 Okt"
      labels: stats.by_day.map((day) =>
        new Date(`${day.date}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      ),
      datasets: [
        {
          label: "Jumlah klasifikasi",
          data: stats.by_day.map((day) => day.count),
          borderColor: COLOR.blue,
          backgroundColor: COLOR.blueSoft,
          fill: true, // warnai area di bawah garis
          tension: 0.35, // kelengkungan garis
          pointRadius: 4,
          pointBackgroundColor: "#fff",
          pointBorderColor: COLOR.blue,
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          grid: { color: COLOR.grid },
          border: { display: false },
          ticks: { stepSize: 1, precision: 0 }, // sumbu hanya bilangan bulat (tidak ada "1,5 klasifikasi")
        },
      },
    },
  });

  // Gambar satu grafik; jika sebelumnya sudah ada, hancurkan dulu agar tidak bertumpuk.
  function drawChart(name, canvasId, config) {
    charts[name]?.destroy();
    charts[name] = new Chart($(canvasId), config);
  }

  // Hancurkan SEMUA grafik dan kosongkan daftarnya (mencegah destroy dua kali nanti).
  function destroyCharts() {
    Object.values(charts).forEach((chart) => chart.destroy());
    Object.keys(charts).forEach((name) => delete charts[name]);
  }

  function renderCharts(stats) {
    // Pengaturan umum Chart.js. Sengaja di dalam fungsi ini (bukan di level atas): bila CDN Chart.js
    // gagal dimuat, hanya grafik yang gagal, sedangkan tabel & fitur lain tetap berjalan.
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; // font grafik = font situs
    Chart.defaults.color = COLOR.text;

    drawChart("pie", "pieChart", pieConfig(stats));
    drawChart("bar", "barChart", barConfig(stats));
    drawChart("line", "lineChart", lineConfig(stats));
  }

  async function loadStats() {
    const stats = await api(`/api/history/stats?tz=${timezoneOffsetMinutes}`);
    hasAny = stats.total > 0;
    lastCounts = stats.by_category;
    renderChips();
    renderSummary(stats);

    // Ada data: tampilkan kanvas grafik & sembunyikan "Belum ada data". Tidak ada data: kebalikannya.
    document.querySelectorAll(".chart-empty").forEach((box) => {
      box.hidden = hasAny;
    });
    document.querySelectorAll(".chart-box canvas").forEach((canvas) => {
      canvas.hidden = !hasAny;
    });

    if (hasAny) renderCharts(stats);
    else destroyCharts();

    // Tidak ada data = tombol ekspor & hapus semua dimatikan
    $("btnExport").disabled = !hasAny;
    $("btnClearAll").disabled = !hasAny;
    return stats;
  }

  /* ==========================================================================
     TABEL
     ========================================================================== */

  // Mengubah nilai filter di layar menjadi teks query URL, mis. "q=obese&category=&sort=desc"
  const buildQuery = () =>
    new URLSearchParams({
      q: $("fSearch").value,
      category: $("fCategory").value,
      sort: $("fSort").value,
    }).toString();

  // Tampilan kosong #1: belum pernah ada riwayat -> ajak mulai klasifikasi
  const noHistoryHtml = () => `
    <tr><td colspan="9">
      <div class="empty-state"><i class="bi bi-inbox" aria-hidden="true"></i>
        <p class="mt-2 mb-3">Belum ada riwayat klasifikasi</p>
        <a href="${SL.PAGES.klasifikasi}" class="btn btn-sl btn-sm">
          <i class="bi bi-play-circle-fill me-1" aria-hidden="true"></i> Mulai Klasifikasi
        </a>
      </div>
    </td></tr>`;

  // Tampilan kosong #2: riwayat ada, tetapi tidak ada yang cocok dengan filter -> beri tombol reset
  const noMatchHtml = () => `
    <tr><td colspan="9">
      <div class="empty-state"><i class="bi bi-funnel" aria-hidden="true"></i>
        <p class="mt-2 mb-0">Tidak ada riwayat yang cocok.
          <button class="btn btn-link p-0 align-baseline" id="resetFilter" type="button">Reset filter</button></p>
      </div>
    </td></tr>`;

  // Satu baris tabel untuk satu riwayat. data-act & data-id dibaca oleh event klik tabel.
  const rowHtml = (row, index) => `
    <tr>
      <td><input type="checkbox" class="form-check-input row-check" data-id="${Number(row.id)}" aria-label="Pilih riwayat" ${selected.has(Number(row.id)) ? "checked" : ""} /> <span class="ms-1">${(page - 1) * pageSize + index + 1}</span></td>
      <td><small>${fmtDate(row.created_at)}</small>${noteIcon(row.id)}</td>
      <td>${fmt(row.age, 0)}</td>
      <td>${row.gender === "Male" ? "L" : "P"}</td>
      <td>${fmt(row.height, 0)} cm</td>
      <td>${fmt(row.weight, 0)} kg</td>
      <td>${escapeHtml(String(row.activity))}</td>
      <td>${catPill(row.category.key)}
        <span class="conf-cell ms-2" title="Keyakinan model"><span class="mini-bar"><i style="width:${Number(row.confidence)}%; background:${CATEGORIES[row.category.key].color};"></i></span><small>${fmt(row.confidence, 0)}%</small></span>
      </td>
      <td><span class="row-actions">
        <button class="btn btn-sm btn-outline-primary" data-act="detail" data-id="${Number(row.id)}"
                title="Detail" aria-label="Lihat detail"><i class="bi bi-eye" aria-hidden="true"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-act="delete" data-id="${Number(row.id)}"
                title="Hapus" aria-label="Hapus"><i class="bi bi-trash" aria-hidden="true"></i></button>
      </span></td>
    </tr>`;

  function resetFilters() {
    $("fSearch").value = "";
    $("fCategory").value = "";
    $("fSort").value = "desc";
    $("fRange").value = "0";
    loadTable();
  }

  function renderTable() {
    const body = $("historyBody");
    $("resultCount").textContent = rows.length ? `${rows.length} hasil` : "";

    if (!rows.length && !hasAny) {
      // kasus 1: memang belum ada riwayat
      body.innerHTML = noHistoryHtml();
    } else if (!rows.length) {
      // kasus 2: ada riwayat, tapi filter tak menemukan apa pun
      body.innerHTML = noMatchHtml();
      $("resetFilter").addEventListener("click", resetFilters);
    } else {
      // kasus 3: tampilkan baris-barisnya
      // kasus 3: tampilkan hanya baris di halaman aktif
      const maxPage = Math.ceil(rows.length / pageSize);
      page = Math.min(page, maxPage); // jaga agar halaman tidak melewati batas (mis. setelah hapus)
      body.innerHTML = rows.slice((page - 1) * pageSize, page * pageSize).map(rowHtml).join("");
    }
    renderPager();
    renderTrend();
    renderAchievements();
    updateBulk();
    setView(view); // kartu dan tabel selalu sinkron
  }

  // Tombol halaman. Disembunyikan bila datanya cuma satu halaman.
  function renderPager() {
    const maxPage = Math.ceil(rows.length / pageSize);
    $("pager").innerHTML =
      maxPage < 2
        ? ""
        : Array.from(
            { length: maxPage },
            (_, i) =>
              `<li class="page-item ${i + 1 === page ? "active" : ""}"><button class="page-link" type="button" data-page="${i + 1}">${i + 1}</button></li>`,
          ).join("");
  }

  /* ---------- Catatan pribadi (disimpan di browser) ---------- */

  // Catatan disimpan sebagai objek {id: teks} di localStorage. try/catch dipakai karena storage bisa diblokir browser.
  function readNotes() {
    try {
      return JSON.parse(localStorage.getItem(NOTE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveNote(id, text) {
    const notes = readNotes();
    if (text.trim()) notes[id] = text.trim().slice(0, 200); // maksimal 200 karakter
    else delete notes[id]; // catatan dikosongkan = dihapus
    try {
      localStorage.setItem(NOTE_KEY, JSON.stringify(notes));
    } catch {
      toast("Catatan gagal disimpan", "danger");
    }
  }

  const noteIcon = (id) =>
    readNotes()[id] ? `<i class="bi bi-sticky-fill note-icon" title="${escapeHtml(readNotes()[id])}" aria-label="Ada catatan"></i>` : "";

  // Bagian catatan di bawah isi modal detail
  const noteBlock = (id) => `
    <h3 class="h6 fw-bold mt-4">Catatan Pribadi</h3>
    <textarea class="form-control mb-2" id="noteInput" rows="2" maxlength="200"
      placeholder="Misal habis diet 2 minggu">${escapeHtml(readNotes()[id] || "")}</textarea>
    <button class="btn btn-sm btn-sl" id="noteSave" type="button" data-id="${Number(id)}">Simpan catatan</button>`;

  /* ---------- Pita pencapaian ---------- */

  function renderAchievements() {
    // Pencapaian hanya dihitung bila tidak ada pencarian atau kategori, supaya hasilnya tidak menyesatkan
    const unfiltered = $("fSearch").value === "" && $("fCategory").value === "";
    const oldest = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const list = [];

    if (unfiltered && oldest.length) {
      let normalStreak = 0; // berapa tes terbaru berturut-turut yang berkategori normal
      for (let i = oldest.length - 1; i >= 0 && oldest[i].category.key === "normal"; i--) normalStreak++;

      let drops = 0; // berapa kali BMI turun berturut-turut sampai tes terbaru
      for (let i = oldest.length - 1; i > 0 && oldest[i].bmi < oldest[i - 1].bmi; i--) drops++;

      if (normalStreak >= 3) list.push(["bi-trophy-fill", `${normalStreak} tes terakhir di kategori Normal`]);
      if (drops >= 2) list.push(["bi-graph-down-arrow", `BMI turun ${drops} kali berturut-turut`]);
      if (oldest.length >= 5) list.push(["bi-patch-check-fill", `${oldest.length} tes tercatat`]);
    }
    $("achRow").innerHTML = list.map(([icon, text]) => `<span class="ach"><i class="bi ${icon}" aria-hidden="true"></i>${text}</span>`).join("");
  }

  /* ---------- Grafik tren BMI (SVG buatan sendiri tanpa library) ---------- */

  const shortDate = (value) => new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

  function renderTrend() {
    const box = $("trendBox");
    const oldest = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Butuh minimal 2 titik supaya ada garis yang bisa dilihat
    if (oldest.length < 2) {
      box.innerHTML = '<div class="text-muted small py-3">Grafik muncul setelah Anda punya minimal 2 riwayat.</div>';
      $("trendNote").textContent = "";
      return;
    }

    // Ukuran kanvas dan margin. Margin kiri lebih lebar untuk angka sumbu
    const W = 640, H = 220, padL = 36, padR = 16, padT = 14, padB = 28;
    const values = oldest.map((row) => Number(row.bmi));
    const lo = Math.min(15, Math.floor(Math.min(...values)) - 1); // batas bawah skala
    const hi = Math.max(30, Math.ceil(Math.max(...values)) + 1); // batas atas skala

    // Ubah nilai BMI dan urutan titik jadi koordinat piksel
    const y = (bmi) => padT + (1 - (bmi - lo) / (hi - lo)) * (H - padT - padB);
    const x = (i) => padL + (i / (oldest.length - 1)) * (W - padL - padR); // jarak antar titik dibuat sama

    const grid = [20, 25, 30]
      .filter((v) => v > lo && v < hi)
      .map((v) => `<line class="trend-grid" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text class="trend-label" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`)
      .join("");
    const band = `<rect class="trend-band" x="${padL}" width="${W - padL - padR}" y="${y(24.9)}" height="${y(18.5) - y(24.9)}"/>`;
    const line = oldest.map((row, i) => `${x(i)},${y(row.bmi)}`).join(" ");
    const dots = oldest
      .map((row, i) => `<circle class="trend-dot" cx="${x(i)}" cy="${y(row.bmi)}" r="5.5" fill="${CATEGORIES[row.category.key].color}" data-id="${Number(row.id)}"><title>${shortDate(row.created_at)} - BMI ${fmt(row.bmi)} (${CATEGORIES[row.category.key].name})</title></circle>`)
      .join("");
    const dates = `<text class="trend-label" x="${padL}" y="${H - 8}">${shortDate(oldest[0].created_at)}</text><text class="trend-label" x="${W - padR}" y="${H - 8}" text-anchor="end">${shortDate(oldest[oldest.length - 1].created_at)}</text>`;

    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik perubahan BMI">${band}${grid}<polyline class="trend-line" points="${line}"/>${dots}${dates}</svg>`;

    // Kalimat ringkasan, membandingkan tes pertama dengan yang terbaru
    const change = values[values.length - 1] - values[0];
    $("trendNote").textContent =
      Math.abs(change) < 0.05
        ? `BMI Anda stabil di ${fmt(values[0])} sejak tes pertama. Pita hijau menandai rentang normal.`
        : `Sejak tes pertama BMI Anda ${change > 0 ? "naik" : "turun"} ${fmt(Math.abs(change))} (dari ${fmt(values[0])} jadi ${fmt(values[values.length - 1])}). Pita hijau menandai rentang normal.`;
  }

  /* ---------- Bandingkan dua tes ---------- */

  function renderCompare() {
    // Ambil dua riwayat yang dicentang lalu urutkan, yang lama jadi kolom A
    const pair = rows.filter((row) => selected.has(Number(row.id))).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (pair.length !== 2) return;
    const [a, b] = pair;

    // Satu baris perbandingan angka. Kolom terakhir berisi selisih B dikurangi A
    const numRow = (label, key, unit, digits = 1) => {
      const diff = Number(b[key]) - Number(a[key]);
      const badge = Math.abs(diff) < 0.05 ? '<span class="delta same">sama</span>' : `<span class="delta ${diff > 0 ? "up" : "down"}"><i class="bi bi-arrow-${diff > 0 ? "up" : "down"}-short" aria-hidden="true"></i>${fmt(Math.abs(diff), digits)} ${unit}</span>`;
      return `<tr><th scope="row">${label}</th><td>${fmt(a[key], digits)} ${unit}</td><td>${fmt(b[key], digits)} ${unit}</td><td>${badge}</td></tr>`;
    };
    const sameCat = a.category.key === b.category.key;

    $("comparePanel").innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <b><i class="bi bi-arrow-left-right" aria-hidden="true"></i> Perbandingan dua tes</b>
        <button class="btn-close" id="compareClose" type="button" aria-label="Tutup perbandingan"></button>
      </div>
      <div class="table-responsive"><table class="table table-sm align-middle">
        <thead><tr><th></th><th>Tes lama</th><th>Tes baru</th><th>Perubahan</th></tr></thead>
        <tbody>
          <tr><th scope="row">Tanggal</th><td>${fmtDate(a.created_at)}</td><td>${fmtDate(b.created_at)}</td><td></td></tr>
          ${numRow("Tinggi", "height", "cm", 0)}
          ${numRow("Berat", "weight", "kg")}
          ${numRow("BMI", "bmi", "")}
          ${numRow("Keyakinan", "confidence", "%", 0)}
          <tr><th scope="row">Kategori</th><td>${catPill(a.category.key)}</td><td>${catPill(b.category.key)}</td>
            <td><span class="delta ${sameCat ? "same" : "up"}">${sameCat ? "tetap" : "berubah"}</span></td></tr>
        </tbody>
      </table></div>`;
    $("comparePanel").hidden = false;
    $("comparePanel").scrollIntoView?.({ behavior: "smooth", block: "nearest" }); // tanda tanya supaya aman di lingkungan uji
  }

  /* ---------- Pilih banyak lalu hapus ---------- */

  function updateBulk() {
    const visibleIds = rows.map((row) => Number(row.id));
    [...selected].forEach((id) => !visibleIds.includes(id) && selected.delete(id)); // buang yang sudah tidak ada
    $("bulkBar").hidden = selected.size === 0;
    $("bulkCount").textContent = selected.size;
    $("bulkCompare").hidden = selected.size !== 2; // perbandingan butuh tepat dua tes
    if (selected.size !== 2) $("comparePanel").hidden = true; // panel ditutup kalau pilihan berubah

    // Kotak "pilih semua" tercentang bila semua baris di halaman ini terpilih
    const pageIds = rows.slice((page - 1) * pageSize, page * pageSize).map((row) => Number(row.id));
    $("selAll").checked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  }

  function handleCheck(event) {
    const box = event.target.closest(".row-check");
    if (!box) return;
    const id = Number(box.dataset.id);
    if (box.checked) selected.add(id);
    else selected.delete(id);
    updateBulk();
  }

  /* ---------- Tampilan kartu dan selisih BMI ---------- */

  // Hasilnya objek {id: selisih}. Tiap tes dibandingkan dengan tes yang tepat sebelumnya secara waktu.
  function buildBmiDeltas() {
    const oldestFirst = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const deltas = {};
    oldestFirst.forEach((item, i) => {
      if (i > 0) deltas[item.id] = item.bmi - oldestFirst[i - 1].bmi; // tes pertama tidak punya pembanding
    });
    return deltas;
  }

  // Lencana kecil, misalnya "naik 1,2". Kalau selisihnya hampir nol dianggap tetap.
  function deltaHtml(delta) {
    if (delta === undefined) return '<span class="delta same">Tes pertama</span>';
    if (Math.abs(delta) < 0.05) return '<span class="delta same">BMI tetap</span>';
    const up = delta > 0;
    return `<span class="delta ${up ? "up" : "down"}"><i class="bi bi-arrow-${up ? "up" : "down"}-short" aria-hidden="true"></i>${fmt(Math.abs(delta))} dari tes lalu</span>`;
  }

  function cardHtml(row, delta) {
    const color = CATEGORIES[row.category.key].color;
    return `
      <div class="col-md-6 col-xl-4">
        <article class="hist-card" style="--cat:${color}">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div><div class="bmi">${fmt(row.bmi)}</div><small class="text-muted">BMI</small></div>
            ${catPill(row.category.key)}
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span>${deltaHtml(delta)}${noteIcon(row.id)}</span>
            <input type="checkbox" class="form-check-input row-check" data-id="${Number(row.id)}" aria-label="Pilih riwayat" ${selected.has(Number(row.id)) ? "checked" : ""} />
          </div>
          <p class="small text-muted mb-2">${fmtDate(row.created_at)} · ${fmt(row.age, 0)} th · ${fmt(row.height, 0)} cm · ${fmt(row.weight, 0)} kg</p>
          <div class="conf-cell w-100 mb-3"><span class="mini-bar"><i style="width:${Number(row.confidence)}%; background:${color};"></i></span><small>${fmt(row.confidence, 0)}%</small></div>
          <span class="row-actions">
            <button class="btn btn-sm btn-outline-primary" data-act="detail" data-id="${Number(row.id)}" title="Detail" aria-label="Lihat detail"><i class="bi bi-eye" aria-hidden="true"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-act="delete" data-id="${Number(row.id)}" title="Hapus" aria-label="Hapus"><i class="bi bi-trash" aria-hidden="true"></i></button>
          </span>
        </article>
      </div>`;
  }

  // Isi kartu untuk halaman yang sedang dibuka. Kosong kalau tidak ada data, karena tabel sudah memberi pesan kosong.
  function renderCards() {
    const deltas = buildBmiDeltas();
    $("cardList").innerHTML = rows
      .slice((page - 1) * pageSize, page * pageSize)
      .map((row) => cardHtml(row, deltas[row.id]))
      .join("");
  }

  // Ganti tampilan. Tabel dan kartu memakai data yang sama, jadi tidak perlu minta ke server lagi.
  function setView(next) {
    view = next;
    $("btnViewTable").setAttribute("aria-pressed", next === "table");
    $("btnViewCard").setAttribute("aria-pressed", next === "card");
    // Tabel tetap dipakai untuk pesan kosong, jadi disembunyikan hanya saat kartu aktif dan ada data
    $("tableWrap").hidden = next === "card" && rows.length > 0;
    $("cardList").hidden = next !== "card" || rows.length === 0;
    if (next === "card") renderCards();
  }

  /* ---------- Chip kategori (filter cepat) ---------- */

  function renderChips() {
    const active = $("fCategory").value;
    const total = Object.values(lastCounts).reduce((a, b) => a + b, 0);
    const chip = (key, label, count, color) =>
      `<button type="button" class="chip ${active === key ? "active" : ""}" data-key="${key}" style="--cat:${color}">
        <span class="dot"></span>${escapeHtml(label)}<span class="num">${count}</span></button>`;
    $("catChips").innerHTML =
      chip("", "Semua", total, "#697083") +
      CHART_ORDER.map((key) => chip(key, CATEGORIES[key].name, lastCounts[key] || 0, CATEGORIES[key].color)).join("");
  }

  async function loadTable() {
    // Setiap pemanggilan mendapat nomor baru. Jika jawaban lama tiba terlambat (nomornya
    // sudah tertinggal), jawaban itu dibuang supaya tidak menimpa hasil pencarian terbaru.
    const requestId = ++tableRequestId;
    page = 1; // filter baru selalu mulai dari halaman pertama
    try {
      const { items } = await api(`/api/history?${buildQuery()}`);
      if (requestId !== tableRequestId) return; // jawaban usang -> abaikan
      rows = filterByRange(items); // server tidak punya filter tanggal, jadi disaring di sini
      hideLoadError(); // berhasil: hapus pesan error lama (jika ada)
      renderChips();
      renderTable();
    } catch (error) {
      if (requestId === tableRequestId) showLoadError(error);
    }
  }

  // Buang riwayat yang lebih tua dari rentang yang dipilih. Nilai 0 berarti semua waktu.
  function filterByRange(items) {
    const days = Number($("fRange").value);
    if (!days) return items;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000; // batas waktu dalam milidetik
    return items.filter((item) => new Date(item.created_at).getTime() >= cutoff);
  }

  function showLoadError(error) {
    const box = $("loadError");
    box.textContent = error.message;
    box.classList.remove("d-none");
  }

  function hideLoadError() {
    $("loadError").classList.add("d-none");
  }

  /* ==========================================================================
     DETAIL
     ========================================================================== */

  function showDetail(id) {
    const row = rows.find((item) => item.id === id); // cari data berdasarkan id
    if (!row) return; // tidak ketemu (mis. sudah terhapus): keluar

    // Satu baris probabilitas per kategori: nama, persen, dan batang berwarna
    const probabilityBars = CATEGORY_KEYS.map((key) => {
      const percent = Number(row.probabilities[key]); // dipaksa angka agar aman dipakai di atribut style
      return `
        <div class="mb-2">
          <div class="d-flex justify-content-between small"><span>${escapeHtml(CATEGORIES[key].name)}</span><b>${fmt(percent)}%</b></div>
          <div class="mini-bar"><i style="width:${percent}%; background:${CATEGORIES[key].color};"></i></div>
        </div>`;
    }).join("");

    $("detailBody").innerHTML = `
      <div class="mb-3">
        <span class="cat-pill cat-${escapeHtml(row.category.key)}" style="font-size:.9rem">${escapeHtml(CATEGORIES[row.category.key].label)}</span>
        <span class="ms-2 small text-muted">keyakinan ${fmt(row.confidence)}%</span>
      </div>
      <dl class="detail-grid mb-4">
        <dt>Tanggal</dt><dd>${fmtDate(row.created_at)}</dd>
        <dt>Usia</dt><dd>${fmt(row.age, 0)} tahun</dd>
        <dt>Gender</dt><dd>${row.gender === "Male" ? "Laki-laki" : "Perempuan"}</dd>
        <dt>Tinggi</dt><dd>${fmt(row.height, 0)} cm</dd>
        <dt>Berat</dt><dd>${fmt(row.weight, 0)} kg</dd>
        <dt>BMI</dt><dd>${fmt(row.bmi)}</dd>
        <dt>Aktivitas</dt><dd>Tingkat ${escapeHtml(String(row.activity))} dari 4</dd>
      </dl>
      <h3 class="h6 fw-bold">Probabilitas</h3>${probabilityBars}${noteBlock(row.id)}`;

    detailModal.show();
  }

  /* ==========================================================================
     HAPUS
     ========================================================================== */

  // Tahap 1: pengguna menekan tombol hapus -> simpan targetnya, minta konfirmasi lewat modal
  function askDelete(target) {
    pendingDelete = target;
    $("confirmText").textContent =
      Array.isArray(target)
        ? `${target.length} riwayat terpilih akan dihapus permanen.`
        : target === "all"
          ? "Semua riwayat klasifikasi Anda akan dihapus permanen."
          : "Riwayat ini akan dihapus permanen.";
    confirmModal.show();
  }

  // Tahap 2: pengguna menekan "Hapus" di modal -> kirim permintaan hapus ke server
  async function confirmDelete() {
    const target = pendingDelete;
    pendingDelete = null; // langsung dikosongkan: klik ganda tidak menghapus dua kali
    if (target === null) return;
    confirmModal.hide();

    const isAll = target === "all";
    const isBulk = Array.isArray(target);
    try {
      if (isBulk) {
        // server hanya punya hapus satu, jadi kirim semuanya bersamaan lalu tunggu selesai
        await Promise.all(target.map((id) => api(`/api/history/${id}`, { method: "DELETE" })));
      } else {
        await api(isAll ? "/api/history" : `/api/history/${target}`, { method: "DELETE" });
      }
      selected.clear(); // pilihan dikosongkan setelah hapus apa pun
      toast(isBulk ? `${target.length} riwayat dihapus` : isAll ? "Semua riwayat dihapus" : "Riwayat dihapus", isAll || isBulk ? "warning" : "info");
      await loadStats(); // ringkasan & grafik dihitung ulang dulu...
      await loadTable(); // ...baru tabel (tabel butuh nilai hasAny dari loadStats)
    } catch (error) {
      toast(error.message, "danger");
    }
  }

  /* ==========================================================================
     EKSPOR CSV (dibuat di browser dari data riwayat)
     ========================================================================== */

  const CSV_HEADER = [
    "Tanggal (UTC)",
    "Usia",
    "Gender",
    "Tinggi (cm)",
    "Berat (kg)",
    "Aktivitas",
    "BMI",
    "Kategori",
    "Keyakinan (%)",
  ];

  // Setiap sel dibungkus tanda kutip; tanda kutip di dalam nilai digandakan (aturan standar CSV)
  const csvCell = (value) => `"${String(value).replace(/"/g, '""')}"`;

  function buildCsv(items) {
    const dataRows = items.map((row) => [
      row.created_at,
      row.age,
      row.gender,
      row.height,
      row.weight,
      row.activity,
      row.bmi,
      row.category.name,
      row.confidence,
    ]);
    return [CSV_HEADER, ...dataRows].map((line) => line.map(csvCell).join(",")).join("\r\n");
  }

  function downloadCsv(text, filename) {
    // "\ufeff" (BOM) membuat Excel membaca file sebagai UTF-8 sehingga huruf tidak rusak
    const url = URL.createObjectURL(new Blob([`\ufeff${text}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link); // beberapa browser (Firefox lama) hanya mau mengunduh bila tautan ada di halaman
    link.click();
    link.remove();
    // URL dibuang BELUM seketika: browser perlu waktu memulai unduhan; membuang terlalu cepat bisa membatalkannya
    setTimeout(() => URL.revokeObjectURL(url), CSV_REVOKE_DELAY_MS);
  }

  async function exportCsv() {
    try {
      const { items } = await api("/api/history"); // ambil SEMUA riwayat, tanpa filter layar
      if (!items.length) {
        toast("Tidak ada data untuk diexport", "warning");
        return;
      }
      downloadCsv(buildCsv(items), "riwayat_sakitlearn.csv");
      toast("CSV berhasil diunduh");
    } catch (error) {
      toast(error.message, "danger");
    }
  }

  /* ==========================================================================
     EVENT & MULAI
     ========================================================================== */

  // Satu pendengar untuk seluruh tabel (event delegation): berlaku juga untuk baris yang dibuat belakangan.
  // Satu fungsi klik dipakai tabel dan kartu (event delegation), jadi baris baru ikut bekerja
  function handleActionClick(event) {
    const button = event.target.closest("button[data-act]"); // tombol yang diklik atau induknya bila yang diklik ikon
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.act === "detail") showDetail(id);
    else askDelete(id);
  }
  $("historyBody").addEventListener("click", handleActionClick);
  $("cardList").addEventListener("click", handleActionClick);

  // Kotak centang di tabel dan kartu
  $("historyBody").addEventListener("change", handleCheck);
  $("cardList").addEventListener("change", handleCheck);
  $("selAll").addEventListener("change", (event) => {
    rows.slice((page - 1) * pageSize, page * pageSize).forEach((row) => {
      if (event.target.checked) selected.add(Number(row.id));
      else selected.delete(Number(row.id));
    });
    renderTable(); // gambar ulang supaya centang tiap baris ikut berubah
  });
  $("bulkCompare").addEventListener("click", renderCompare);
  // Tombol tutup dibuat ulang tiap perbandingan dibuka, jadi dipasang lewat delegation
  $("comparePanel").addEventListener("click", (event) => {
    if (event.target.closest("#compareClose")) $("comparePanel").hidden = true;
  });
  // Klik titik di grafik = buka detail tes itu
  $("trendBox").addEventListener("click", (event) => {
    const dot = event.target.closest(".trend-dot");
    if (dot) showDetail(Number(dot.dataset.id));
  });
  $("bulkClear").addEventListener("click", () => {
    selected.clear();
    renderTable();
  });
  $("bulkDelete").addEventListener("click", () => askDelete([...selected]));

  // Simpan catatan dari modal detail
  $("detailBody").addEventListener("click", (event) => {
    const button = event.target.closest("#noteSave");
    if (!button) return;
    saveNote(Number(button.dataset.id), $("noteInput").value);
    toast("Catatan disimpan");
    renderTable(); // ikon catatan di baris ikut muncul
  });

  // Cetak. Sebelum dialog cetak terbuka, tampilkan SEMUA baris dalam bentuk tabel, sesudahnya kembalikan.
  let viewBeforePrint = "table";
  window.addEventListener("beforeprint", () => {
    $("printMeta").textContent = `Laporan riwayat Sakit-Learn, dicetak ${new Date().toLocaleString("id-ID")}`;
    viewBeforePrint = view;
    view = "table";
    pageSize = 1e6; // angka besar supaya tidak terpotong per halaman
    renderTable();
  });
  window.addEventListener("afterprint", () => {
    view = viewBeforePrint;
    pageSize = PAGE_SIZE;
    renderTable();
  });
  $("btnPrint").addEventListener("click", () => window.print());

  $("btnViewTable").addEventListener("click", () => setView("table"));
  $("btnViewCard").addEventListener("click", () => setView("card"));
  $("fRange").addEventListener("change", loadTable);

  // Klik chip = isi dropdown kategori lalu muat ulang tabel
  $("catChips").addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    $("fCategory").value = chip.dataset.key;
    loadTable();
  });

  // Klik nomor halaman = pindah halaman tanpa meminta data lagi ke server
  $("pager").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button) return;
    page = Number(button.dataset.page);
    renderTable();
  });

  $("btnClearAll").addEventListener("click", () => askDelete("all"));
  $("confirmOk").addEventListener("click", confirmDelete);
  $("btnExport").addEventListener("click", exportCsv);

  // Pencarian: tunggu pengguna berhenti mengetik (debounce) agar tidak mengirim request tiap huruf
  $("fSearch").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadTable, SEARCH_DEBOUNCE_MS);
  });
  $("fCategory").addEventListener("change", loadTable);
  $("fSort").addEventListener("change", loadTable);

  // Saat halaman dibuka: statistik dulu, baru tabel (urutan penting, lihat catatan di confirmDelete)
  (async () => {
    try {
      await loadStats();
      await loadTable();
    } catch (error) {
      showLoadError(error);
    }
  })();
})();
