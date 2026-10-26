/* Pengaturan frontend. */
window.SL_CONFIG = {
  USE_MOCK: false,               // <-- WAJIB false: pakai backend Flask asli
  API_BASE: "",                  // karena satu origin (Flask yang serve static juga)
  COMPONENTS_PATH: "/static/components/",
  PAGES: {
    beranda: "/",
    masuk: "/masuk",
    daftar: "/daftar",
    klasifikasi: "/klasifikasi",
    riwayat: "/riwayat",
    tentang: "/tentang",
  },
};