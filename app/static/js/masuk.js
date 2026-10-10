/* Halaman Masuk: kirim kredensial ke /api/auth/login. */
(() => {
  "use strict";
  const form = document.getElementById("loginForm");
  const alertBox = document.getElementById("formAlert");
  const button = document.getElementById("btnSubmit");
  const nextUrl = SL.safeNext(new URLSearchParams(location.search).get("next"));
  SL.ready.then((user) => { if (user) window.location.replace(nextUrl); });
  const username = document.getElementById("username");
  const password = document.getElementById("password");

  document.getElementById("togglePw").addEventListener("click", (e) => {
    const input = document.getElementById("password");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    e.currentTarget.innerHTML = `<i class="bi bi-eye${show ? "-slash" : ""}"></i>`;
    e.currentTarget.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
  });

  document.getElementById("fillDemo")?.addEventListener("click", () => {
    username.value = "demo";
    password.value = "demo123";
    form.classList.remove("was-validated");
    password.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.innerHTML = "";
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }
    SL.setLoading(button, true, "Memeriksa...");
    try {
      await SL.api("/api/auth/login", { method: "POST", body: { username: username.value, password: password.value } });
      window.location.href = nextUrl;
    } catch (err) {
      SL.showAlert(alertBox, err.message);
      password.value = "";
      password.focus();
      SL.setLoading(button, false);
    }
  });
})();
