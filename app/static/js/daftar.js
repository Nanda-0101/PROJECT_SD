/* Halaman Daftar: validasi, meter password, kirim ke /api/auth/register. */
(() => {
  "use strict";
  const form = document.getElementById("signupForm");
  const alertBox = document.getElementById("formAlert");
  const button = document.getElementById("btnSubmit");
  const meter = document.querySelector(".strength");
  if (SL.CONFIG.USE_MOCK) document.getElementById("mockNotice").classList.remove("d-none");
  SL.ready.then((user) => { if (user) window.location.replace(SL.PAGES.klasifikasi); });
  const meterText = document.getElementById("strengthText");
  const nameEl = document.getElementById("name");
  const usernameEl = document.getElementById("username");
  const pw = document.getElementById("password");
  const confirmEl = document.getElementById("confirm");

  function passwordLevel(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    return Math.max(1, score);
  }
  const levelText = ["Gunakan campuran huruf, angka, dan simbol.", "Lemah", "Cukup", "Baik", "Kuat"];

  function checkConfirm() {
    const mismatch = confirmEl.value !== "" && confirmEl.value !== pw.value;
    confirmEl.setCustomValidity(mismatch ? "Password belum sama." : "");
    if (form.classList.contains("was-validated") || confirmEl.value) {
      confirmEl.classList.toggle("is-invalid", mismatch);
      confirmEl.classList.toggle("is-valid", !mismatch && confirmEl.value !== "");
    }
  }

  pw.addEventListener("input", () => {
    const level = passwordLevel(pw.value);
    meter.dataset.level = level;
    meterText.textContent = level ? `Kekuatan password: ${levelText[level]}` : levelText[0];
    checkConfirm();
  });
  confirmEl.addEventListener("input", checkConfirm);

  document.getElementById("togglePw").addEventListener("click", (e) => {
    const show = pw.type === "password";
    pw.type = show ? "text" : "password";
    confirmEl.type = show ? "text" : "password";
    e.currentTarget.innerHTML = `<i class="bi bi-eye${show ? "-slash" : ""}"></i>`;
    e.currentTarget.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.innerHTML = "";
    SL.clearFieldErrors(form);
    checkConfirm();
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      form.querySelector(":invalid")?.focus();
      return;
    }
    SL.setLoading(button, true, "Membuat akun...");
    try {
      await SL.api("/api/auth/register", {
        method: "POST",
        body: { name: nameEl.value, username: usernameEl.value, password: pw.value, confirm: confirmEl.value },
      });
      window.location.href = SL.PAGES.klasifikasi;
    } catch (err) {
      SL.showAlert(alertBox, err.message);
      SL.applyFieldErrors(form, err.fields);
      SL.setLoading(button, false);
    }
  });
})();
