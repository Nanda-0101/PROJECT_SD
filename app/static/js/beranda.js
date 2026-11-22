/* ==========================================================================
   Beranda
   Tab kategori (.cat-tab) yang mengganti isi panel penjelasan.
   Gaya komponen ada di beranda.css.
   ========================================================================== */
(() => {
  "use strict";

  const KEYS = ["under", "normal", "over", "obese"];
  const NAMES = { under: "Underweight", normal: "Normal weight", over: "Overweight", obese: "Obese" };

  const CATEGORIES = {
    under: {
      desc: "Berat badan berada di bawah rentang yang dianggap sehat untuk tinggi badan.",
      tips: [
        "Perhatikan kecukupan kalori dan protein harian.",
        "Tetap aktif dan cukup beristirahat.",
        "Jika berat badan turun tanpa sebab yang jelas, periksakan ke tenaga kesehatan.",
      ],
    },
    normal: {
      desc: "Berat badan berada dalam rentang yang dianggap sehat untuk tinggi badan.",
      tips: [
        "Pertahankan pola makan yang seimbang.",
        "Tetap aktif bergerak secara rutin.",
        "Pantau berkala lewat Riwayat agar hasilnya tetap stabil.",
      ],
    },
    over: {
      desc: "Berat badan berada di atas rentang yang dianggap sehat untuk tinggi badan.",
      tips: [
        "Atur porsi dan kurangi makanan serta minuman tinggi gula.",
        "Tambah aktivitas fisik secara bertahap.",
        "Pantau perkembangan dari waktu ke waktu lewat Riwayat.",
      ],
    },
    obese: {
      desc: "Berat badan berada jauh di atas rentang yang dianggap sehat untuk tinggi badan.",
      tips: [
        "Konsultasikan dengan dokter atau ahli gizi untuk rencana yang aman.",
        "Mulai dari perubahan kecil yang bisa dijaga rutin.",
        "Ingat bahwa hasil ini indikatif dan bukan diagnosis.",
      ],
    },
  };

  const panel = document.getElementById("catPanel");
  const tabs = document.querySelectorAll(".cat-tab");

  if (!panel || !tabs.length) return;

  const select = (key) => {
    const data = CATEGORIES[key];

    tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.key === key)));

    panel.classList.remove(...KEYS.map((k) => `cat-${k}`));
    panel.classList.add(`cat-${key}`);
    panel.setAttribute("aria-labelledby", `tab-${key}`);

    document.getElementById("catTitle").textContent = NAMES[key];
    document.getElementById("catDesc").textContent = data.desc;

    // textContent aman dari injeksi karena teks berasal dari konstanta di atas
    document.getElementById("catTips").replaceChildren(
      ...data.tips.map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      })
    );
  };

  tabs.forEach((tab) => tab.addEventListener("click", () => select(tab.dataset.key)));
})();
