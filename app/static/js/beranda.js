/* Halaman Beranda: mengambil data evaluasi model lalu menampilkannya (kartu angka, tabel, bobot). */

// IIFE: fungsi yang langsung dijalankan. Tujuannya agar variabel di bawah tidak "bocor" ke global.
(() => {
  "use strict"; // mode ketat: JavaScript menolak kesalahan yang biasanya diam-diam diabaikan

  // Mengambil fungsi bantu dari objek global SL (dibuat oleh common.js).
  // fmt = format angka, api = kirim request ke server, catPill = label kategori berwarna.
  const { fmt, api, catPill } = SL;

  /* ---------- Konfigurasi ---------- */

  // Empat kartu angka. Tiap item: [kunci data di server, tulisan di kartu, nama ikon Bootstrap].
  // Mau menambah/mengganti kartu? Cukup ubah daftar ini.
  const METRIC_TILES = [
    ["accuracy", "Akurasi", "bullseye"],
    ["f1", "F1-Score", "graph-up"],
    ["precision", "Precision", "bullseye"],
    ["recall", "Recall", "activity"],
  ];

  /* ---------- Referensi elemen HTML (diambil sekali, dipakai berulang) ---------- */

  const el = {
    loading: document.getElementById("evalLoading"), // kotak skeleton saat memuat
    error: document.getElementById("evalError"), // kotak peringatan jika gagal
    content: document.getElementById("evalContent"), // isi utama jika berhasil
    stats: document.getElementById("evalStats"), // tempat 4 kartu angka
    rows: document.getElementById("evalRows"), // <tbody> tabel per kategori
    weightLgbm: document.getElementById("wLgbm"), // teks bobot LightGBM
    weightMlp: document.getElementById("wMlp"), // teks bobot MLP
    heroAccuracy: document.getElementById("hsAcc"), // angka akurasi di hero
    heroTrainCount: document.getElementById("hsN"), // angka jumlah data latih di hero
    retry: document.getElementById("evalRetry"), // tombol "Coba lagi"
  };

  /* ---------- Pembuat potongan HTML ---------- */

  // Satu kartu angka. data-count/decimals/suffix dibaca common.js untuk animasi hitung-naik.
  const statTileHtml = ([key, label, icon], overall) => `
    <div class="col-md-3 col-6">
      <div class="stat-card">
        <div class="stat-icon"><i class="bi bi-${icon}" aria-hidden="true"></i></div>
        <div class="stat-value" data-count="${overall[key].value}" data-decimals="1" data-suffix="%">${fmt(overall[key].value)}%</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;

  // Satu baris tabel: nama kategori + 3 metrik. Dipakai untuk baris kelas dan baris rata-rata.
  const metricCells = (m) => `<td>${fmt(m.precision)}%</td><td>${fmt(m.recall)}%</td><td>${fmt(m.f1)}%</td>`;

  /* ---------- Menampilkan data ---------- */

  function renderEval(info) {
    // 1) Empat kartu angka: ubah tiap item METRIC_TILES menjadi HTML, gabung jadi satu teks.
    el.stats.innerHTML = METRIC_TILES.map((tile) => statTileHtml(tile, info.overall)).join("");

    // 2) Tabel: satu baris per kategori, lalu satu baris "Rata-rata" di paling bawah.
    const classRows = info.per_class.map((r) => `<tr><td>${catPill(r.key)}</td>${metricCells(r)}</tr>`);
    const averageRow = `<tr class="row-total"><td>Rata-rata</td>${metricCells(info.average)}</tr>`;
    el.rows.innerHTML = [...classRows, averageRow].join("");

    // 3) Bobot ensemble ditulis dengan 1 angka di belakang koma (mis. 0.5).
    el.weightLgbm.textContent = fmt(info.weights.lightgbm, 1);
    el.weightMlp.textContent = fmt(info.weights.mlp, 1);

    // 4) Samakan angka di hero dengan data asli model, lalu jalankan animasi hitung-naik.
    el.heroAccuracy.dataset.count = Math.round(info.overall.accuracy.value);
    el.heroTrainCount.dataset.count = info.n_train;
    SL.countUp(el.heroAccuracy);
    SL.countUp(el.heroTrainCount);
  }

  /* ---------- Tiga keadaan tampilan: memuat / berhasil / gagal ---------- */

  function showState(state) {
    el.loading.hidden = state !== "loading"; // skeleton hanya saat memuat
    el.content.hidden = state !== "ready"; // isi hanya saat berhasil
    el.error.classList.toggle("d-none", state !== "error"); // peringatan hanya saat gagal
  }

  async function loadEval() {
    showState("loading"); // setiap (ulang) memuat, mulai dari keadaan "memuat"
    try {
      renderEval(await api("/api/model-info")); // ambil data dari server lalu tampilkan
      showState("ready");
      SL.observeCounts(el.content); // angka metrik berhitung naik begitu terlihat di layar
    } catch {
      showState("error"); // server mati/ jaringan putus -> tampilkan peringatan + tombol coba lagi
    }
  }


  /* ---------- Kartu kategori interaktif ---------- */

  // Isi penjelasan tiap kategori. Rentang BMI mengikuti standar WHO.
  // Tiap item berisi [kunci, nama, rentang BMI, penjelasan, warna]
  const CATEGORY_INFO = [
    ["under", "Underweight", "BMI di bawah 18,5", "Berat badan kurang dari yang dianjurkan untuk tinggi badan. Perlu perhatian pada asupan gizi.", "#0a6cf0"],
    ["normal", "Normal weight", "BMI 18,5 sampai 24,9", "Berat badan ideal. Pertahankan pola makan seimbang dan rutin bergerak.", "#2ba24c"],
    ["over", "Overweight", "BMI 25 sampai 29,9", "Berat badan sedikit berlebih. Mulai atur porsi makan dan tambah aktivitas fisik.", "#f59f00"],
    ["obese", "Obese", "BMI 30 ke atas", "Berat badan jauh di atas anjuran dan berisiko bagi kesehatan. Sebaiknya konsultasi ke tenaga kesehatan.", "#e5384f"],
  ];

  // Tips singkat untuk tiap kategori, tampil di bawah penjelasan
  const CATEGORY_TIPS = {
    under: ["Tambah porsi makan sedikit demi sedikit, tiga kali sehari plus camilan bergizi", "Perbanyak protein seperti telur, ikan, dan kacang", "Latihan beban ringan membantu menambah massa otot"],
    normal: ["Pertahankan makan seimbang dan cukup sayur buah", "Bergerak aktif minimal 150 menit per minggu", "Tidur 7 sampai 8 jam supaya metabolisme terjaga"],
    over: ["Kurangi minuman manis dan gorengan", "Jalan kaki 30 menit hampir setiap hari", "Pantau berat badan seminggu sekali, tidak perlu tiap hari"],
    obese: ["Konsultasi ke dokter atau ahli gizi untuk rencana yang aman", "Mulai dari aktivitas ringan lalu naikkan pelan-pelan", "Catat apa yang dimakan supaya pola kebiasaan kelihatan"],
  };

  const catTabs = document.getElementById("catTabs");
  const catPanel = document.getElementById("catPanel");

  // Bikin 4 tombol kategori sekali saja
  catTabs.innerHTML = CATEGORY_INFO.map(
    ([key, name, range, , color]) => `
    <div class="col-md-3 col-6">
      <button class="cat-tab" type="button" role="tab" data-key="${key}" style="--cat:${color}">
        <span class="dot"></span><b>${name}</b><small>${range}</small>
      </button>
    </div>`,
  ).join("");

  // Pilih satu kategori lalu isi panel penjelasannya
  function selectCategory(key) {
    const info = CATEGORY_INFO.find((item) => item[0] === key);
    catTabs.querySelectorAll(".cat-tab").forEach((tab) => tab.setAttribute("aria-selected", tab.dataset.key === key));
    catPanel.style.setProperty("--cat", info[4]);
    catPanel.innerHTML = `<h3 class="h5">${info[1]}</h3><p>${info[3]}</p><ul>${CATEGORY_TIPS[key].map((tip) => `<li>${tip}</li>`).join("")}</ul>`;
  }

  // Satu pendengar klik untuk semua tombol (event delegation)
  catTabs.addEventListener("click", (event) => {
    const tab = event.target.closest(".cat-tab");
    if (tab) selectCategory(tab.dataset.key);
  });
  selectCategory("normal"); // kategori awal yang terbuka


  /* ---------- Kalkulator BMI cepat ---------- */

  const qTinggi = document.getElementById("qTinggi");
  const qBerat = document.getElementById("qBerat");
  const qEmpty = document.getElementById("qEmpty");
  const qResult = document.getElementById("qResult");
  let qKey = "normal"; // kategori hasil terakhir, dipakai tombol penjelasan

  function hitungBmi() {
    const tinggi = Number(qTinggi.value);
    const berat = Number(qBerat.value);
    const valid = tinggi >= 100 && tinggi <= 250 && berat >= 20 && berat <= 300;

    qResult.hidden = !valid; // hasil hanya tampil kalau kedua angka masuk akal
    qEmpty.hidden = valid;
    if (!valid) return;

    const meter = tinggi / 100;
    const bmi = berat / (meter * meter); // rumus BMI = berat dibagi tinggi kuadrat (meter)
    qKey = bmi < 18.5 ? "under" : bmi < 25 ? "normal" : bmi < 30 ? "over" : "obese";
    const info = CATEGORY_INFO.find((item) => item[0] === qKey);

    document.getElementById("qBmi").textContent = bmi.toFixed(1).replace(".", ",");
    const label = document.getElementById("qCat");
    label.textContent = info[1];
    label.style.color = info[4]; // warna teks mengikuti kategori

    // Posisi penanda. Skala 15 sampai 40, jadi nilai di luar itu ditahan di ujung
    const persen = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));
    document.getElementById("qPin").style.left = `${persen}%`;

    // Rentang berat ideal untuk tinggi ini, dari BMI 18,5 sampai 24,9
    const minIdeal = 18.5 * meter * meter;
    const maxIdeal = 24.9 * meter * meter;
    const selisih = berat < minIdeal ? minIdeal - berat : berat > maxIdeal ? berat - maxIdeal : 0;
    const arah = berat < minIdeal ? "naik" : "turun";
    document.getElementById("qIdeal").textContent =
      `Berat ideal untuk tinggi ${tinggi} cm sekitar ${minIdeal.toFixed(0)} sampai ${maxIdeal.toFixed(0)} kg.` +
      (selisih ? ` Kira-kira perlu ${arah} ${selisih.toFixed(1).replace(".", ",")} kg.` : " Berat Anda sudah di rentang ini.");
  }

  qTinggi.addEventListener("input", hitungBmi);
  qBerat.addEventListener("input", hitungBmi);

  // Tombol penjelasan membuka kategori hasil lalu menggulung layar ke panelnya
  document.getElementById("qLearn").addEventListener("click", () => {
    selectCategory(qKey);
    catPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* ---------- Animasi muncul saat di-scroll ---------- */

  // IntersectionObserver memberi tahu saat elemen masuk layar, lalu kita tambahkan kelas "in"
  const canObserve = "IntersectionObserver" in window; // browser lama atau uji tanpa fitur ini langsung tampilkan semua
  const revealer = canObserve && new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        revealer.unobserve(entry.target); // cukup sekali, tidak perlu diawasi lagi
      }),
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((node) => (canObserve ? revealer.observe(node) : node.classList.add("in")));

  /* ---------- Mulai ---------- */

  el.retry.addEventListener("click", loadEval); // klik "Coba lagi" = muat ulang
  loadEval(); // muat data saat halaman dibuka
})();
