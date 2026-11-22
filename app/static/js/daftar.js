/* 
   Halaman Daftar
  */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const form = $("signupForm");
  if (!form) return;

  const el = {
    name: $("nama_lengkap"),
    user: $("username"),
    pw: $("password"),
    pw2: $("password2"),
    agree: $("agree"),
    btn: $("btnSignup"),
    progress: $("formProgress"),
    strength: $("strength"),
    strengthLabel: $("strengthLabel"),
    rules: $("pwRules"),
  };

  const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
  const LEVEL_LABELS = ["Belum diisi", "Lemah", "Cukup", "Baik", "Kuat"];
  const touched = new Set();

  /* ---------- Aturan password ---------- */

  const passwordRules = (value) => ({
    len: value.length >= 8,
    letter: /[A-Za-z]/.test(value),
    digit: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  });

  /* ---------- Validator tiap kolom (string kosong berarti valid) ---------- */

  const validators = {
    name: () => {
      const len = el.name.value.trim().replace(/\s+/g, " ").length;
      return len >= 2 && len <= 100 ? "" : "Nama lengkap harus 2 sampai 100 karakter.";
    },
    user: () => {
      const value = el.user.value.trim().toLowerCase();
      return USERNAME_RE.test(value)
        ? ""
        : "Username 3 sampai 30 karakter. Gunakan huruf, angka, titik, atau garis bawah.";
    },
    pw: () => {
      const r = passwordRules(el.pw.value);
      if (!(r.len && r.letter && r.digit)) return "Password minimal 8 karakter dan memuat huruf serta angka.";
      if (el.pw.value === el.user.value.trim().toLowerCase()) return "Password tidak boleh sama dengan username.";
      return "";
    },
    pw2: () => {
      if (!el.pw2.value) return "Ketik ulang password Anda.";
      return el.pw2.value === el.pw.value ? "" : "Konfirmasi password tidak cocok.";
    },
    agree: () => (el.agree.checked ? "" : "Centang pernyataan ini untuk melanjutkan."),
  };

  /* ---------- Tampilan status valid atau tidak ---------- */

  function render(field) {
    const input = el[field];
    const message = validators[field]();
    const show = touched.has(field) && message;

    input.classList.toggle("is-invalid", Boolean(show));
    if (show) {
      const holder = input.closest(".input-group, .form-check");
      const feedback = holder && holder.querySelector(".invalid-feedback");
      if (feedback) feedback.textContent = message;
    }
  }

  function updateProgress() {
    const fields = Object.keys(validators);
    const done = fields.filter((f) => !validators[f]()).length;
    el.progress.style.width = `${(done / fields.length) * 100}%`;
  }

  function updateStrength() {
    const value = el.pw.value;
    const r = passwordRules(value);
    let level = 0;

    if (value) {
      level = [r.len, r.letter, r.digit, r.symbol].filter(Boolean).length;
      if (!r.len) level = Math.min(level, 1);
      level = Math.max(level, 1);
    }

    el.strength.dataset.level = level;
    el.strengthLabel.dataset.level = level;
    el.strengthLabel.textContent = LEVEL_LABELS[level];

    el.rules.querySelectorAll("li").forEach((li) => {
      const ok = r[li.dataset.rule];
      li.classList.toggle("ok", ok);
      const icon = li.querySelector("i");
      icon.classList.toggle("bi-check-circle-fill", ok);
      icon.classList.toggle("bi-circle", !ok);
    });
  }

  /* ---------- Event ---------- */

  const bind = (field, eventName = "input") => {
    el[field].addEventListener(eventName, () => {
      touched.add(field);
      render(field);
      if (field === "pw") {
        updateStrength();
        if (touched.has("pw2")) render("pw2");
      }
      updateProgress();
    });
  };

  ["name", "user", "pw", "pw2"].forEach((f) => bind(f));
  bind("agree", "change");

  // Username selalu huruf kecil agar sama dengan yang disimpan server
  el.user.addEventListener("blur", () => {
    el.user.value = el.user.value.trim().toLowerCase();
    render("user");
    updateProgress();
  });

  // Tombol mata untuk dua kolom password
  document.querySelectorAll(".pw-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $(btn.dataset.target);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = `<i class="bi bi-eye${show ? "-slash" : ""}" aria-hidden="true"></i>`;
      btn.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
    });
  });

  form.addEventListener("submit", (e) => {
    const fields = Object.keys(validators);
    fields.forEach((f) => {
      touched.add(f);
      render(f);
    });

    const firstInvalid = fields.find((f) => validators[f]());
    if (firstInvalid) {
      e.preventDefault();
      el[firstInvalid].focus();
      return;
    }

    window.SL?.setLoading(el.btn, true, "Membuat akun...");
  });

  // Pulihkan tombol jika halaman dibuka lagi lewat tombol kembali
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.SL?.setLoading(el.btn, false);
  });

  updateStrength();
  updateProgress();
})();
