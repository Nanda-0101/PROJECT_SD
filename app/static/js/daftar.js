/* Halaman Daftar: validasi form, meter kekuatan password, kirim data ke /api/auth/register. */

// IIFE: membungkus semua kode agar variabelnya tidak bocor ke global.
(() => {
  "use strict"; // mode ketat: kesalahan tidak lagi diam-diam diabaikan

  /* ---------- Teks & konstanta (ubah di sini bila ingin ganti tulisan) ---------- */

  const HINT_TEXT = "Gunakan campuran huruf, angka, dan simbol."; // teks bantuan saat password kosong
  const STRENGTH_LABELS = ["", "Lemah", "Cukup", "Baik", "Kuat"]; // indeks 1-4 = level kekuatan
  const MISMATCH_MESSAGE = "Konfirmasi harus sama dengan password."; // pesan bawaan browser untuk field konfirmasi

  /* ---------- Referensi elemen HTML ---------- */

  const form = document.getElementById("signupForm");
  const alertBox = document.getElementById("formAlert"); // tempat pesan error dari server
  const submitButton = document.getElementById("btnSubmit");
  const nameInput = document.getElementById("name");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirm");
  const strengthMeter = document.querySelector(".strength"); // 4 kotak warna
  const strengthText = document.getElementById("strengthText"); // tulisan "Kekuatan password: ..."
  const toggleButton = document.getElementById("togglePw"); // tombol ikon mata

  let isSubmitting = false; // penanda: mencegah form terkirim dua kali bila tombol diklik cepat

  /* ---------- Meter kekuatan password ---------- */

  // Mengembalikan level 0-4. Setiap syarat terpenuhi = +1 poin.
  function getPasswordLevel(password) {
    if (!password) return 0; // kosong = tidak ada level
    let score = 0;
    if (password.length >= 6) score++; // syarat 1: minimal 6 karakter
    if (password.length >= 10) score++; // syarat 2: minimal 10 karakter
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++; // syarat 3: huruf kecil DAN besar
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++; // syarat 4: angka DAN simbol
    return Math.max(1, score); // sudah mengetik = minimal level 1
  }

  function updateStrengthMeter() {
    const level = getPasswordLevel(passwordInput.value);
    strengthMeter.dataset.level = level; // CSS (daftar.css) membaca data-level untuk mewarnai kotak
    strengthText.textContent = level ? `Kekuatan password: ${STRENGTH_LABELS[level]}` : HINT_TEXT;
  }

  /* ---------- Daftar syarat password (dicentang otomatis) ---------- */

  const pwRules = document.querySelectorAll("#pwRules li");
  // Tiap syarat berisi fungsi yang mengembalikan true bila terpenuhi
  const RULE_TESTS = {
    len: (pw) => pw.length >= 6,
    case: (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    num: (pw) => /\d/.test(pw),
    sym: (pw) => /[^A-Za-z0-9]/.test(pw),
  };

  function updateRules() {
    pwRules.forEach((item) => {
      const passed = RULE_TESTS[item.dataset.rule](passwordInput.value);
      item.classList.toggle("ok", passed); // kelas ok = hijau
      item.querySelector("i").className = passed ? "bi bi-check-circle-fill" : "bi bi-circle"; // ganti ikon
    });
  }

  /* ---------- Bar kemajuan pengisian ---------- */

  const progressBar = document.getElementById("formProgress");

  // Hitung berapa dari 4 kolom yang sudah valid, lalu jadikan persen
  function updateProgress() {
    const fields = [nameInput, usernameInput, passwordInput, confirmInput];
    const done = fields.filter((field) => field.value !== "" && field.checkValidity()).length;
    progressBar.style.width = `${(done / fields.length) * 100}%`;
  }

  /* ---------- Peringatan Caps Lock ---------- */

  const capsWarn = document.getElementById("capsWarn");
  const checkCaps = (event) => capsWarn.classList.toggle("d-none", !event.getModifierState?.("CapsLock"));

  /* ---------- Validasi konfirmasi password ---------- */

  function validateConfirm() {
    const hasTyped = confirmInput.value !== ""; // apakah sudah diisi
    const mismatch = hasTyped && confirmInput.value !== passwordInput.value; // diisi tapi berbeda

    // setCustomValidity: beri tahu browser bahwa field ini tidak valid (teks kosong = valid)
    confirmInput.setCustomValidity(mismatch ? MISMATCH_MESSAGE : "");

    // Tampilkan warna merah/hijau hanya bila pengguna sudah mengetik atau sudah mencoba kirim
    if (hasTyped || form.classList.contains("was-validated")) {
      confirmInput.classList.toggle("is-invalid", mismatch);
      confirmInput.classList.toggle("is-valid", hasTyped && !mismatch);
    }
  }

  /* ---------- Tombol tampilkan/sembunyikan password ---------- */

  function togglePasswordVisibility() {
    const willShow = passwordInput.type === "password"; // sekarang tersembunyi? berarti akan ditampilkan
    const newType = willShow ? "text" : "password";
    passwordInput.type = newType; // kedua kolom ikut berubah supaya konsisten
    confirmInput.type = newType;
    toggleButton.querySelector("i").className = willShow ? "bi bi-eye-slash" : "bi bi-eye"; // ganti ikon
    toggleButton.setAttribute("aria-label", willShow ? "Sembunyikan password" : "Tampilkan password"); // untuk pembaca layar
  }

  /* ---------- Kirim form ---------- */

  async function handleSubmit(event) {
    event.preventDefault(); // cegah browser memuat ulang halaman
    if (isSubmitting) return; // sedang mengirim? abaikan klik berikutnya

    alertBox.innerHTML = ""; // hapus pesan error sebelumnya
    SL.clearFieldErrors(form); // hapus tanda merah dari error server sebelumnya

    // Rapikan spasi di awal/akhir. Dilakukan SEBELUM validasi agar nama "   " (spasi saja) ditolak.
    nameInput.value = nameInput.value.trim();
    usernameInput.value = usernameInput.value.trim();
    validateConfirm(); // pastikan status konfirmasi terbaru ikut diperiksa

    if (!form.checkValidity()) {
      // ada field yang belum memenuhi aturan HTML?
      form.classList.add("was-validated"); // tampilkan semua pesan error Bootstrap
      form.querySelector(":invalid")?.focus(); // arahkan kursor ke field bermasalah pertama
      return;
    }

    isSubmitting = true;
    SL.setLoading(submitButton, true, "Membuat akun..."); // tombol berubah jadi "memuat"
    try {
      await SL.api("/api/auth/register", {
        method: "POST",
        body: {
          name: nameInput.value,
          username: usernameInput.value,
          password: passwordInput.value, // password sengaja TIDAK di-trim: spasi bisa jadi bagian password
          confirm: confirmInput.value,
        },
      });
      window.location.href = SL.PAGES.klasifikasi; // berhasil: pindah ke halaman klasifikasi
    } catch (error) {
      SL.showAlert(alertBox, error.message); // tampilkan alasan gagal dari server
      SL.applyFieldErrors(form, error.fields); // tandai field yang bermasalah (mis. username terpakai)
      SL.setLoading(submitButton, false); // kembalikan tombol agar bisa dicoba lagi
      isSubmitting = false;
    }
  }

  /* ---------- Mulai: pasang semua event ---------- */

  // Sudah login? Tidak perlu mendaftar lagi, langsung ke halaman klasifikasi.
  SL.ready.then((user) => {
    if (user) window.location.replace(SL.PAGES.klasifikasi);
  });

  // Bila mode demo (tanpa server) aktif, tampilkan pemberitahuannya.
  if (SL.CONFIG.USE_MOCK) document.getElementById("mockNotice").classList.remove("d-none");

  passwordInput.addEventListener("input", () => {
    updateStrengthMeter(); // perbarui meter setiap tombol ditekan
    validateConfirm(); // password berubah -> cek ulang kecocokan konfirmasi
    updateRules(); // centang syarat yang sudah terpenuhi
  });
  confirmInput.addEventListener("input", validateConfirm);
  form.addEventListener("input", updateProgress); // setiap kolom berubah, bar ikut maju
  passwordInput.addEventListener("keydown", checkCaps);
  passwordInput.addEventListener("keyup", checkCaps);
  toggleButton.addEventListener("click", togglePasswordVisibility);
  form.addEventListener("submit", handleSubmit);
})();
