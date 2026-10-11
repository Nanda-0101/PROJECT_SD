/* Pengaturan frontend.
   USE_MOCK = true  -> data disimpan di browser (js/mock-api.js), tanpa endpoint backend.
   USE_MOCK = false -> frontend memanggil backend sungguhan di API_BASE. */
window.SL_CONFIG = {
  USE_MOCK: true,
  API_BASE: "",
  COMPONENTS_PATH: "/static/components/", // folder navbar.html & footer.html
  PAGES: { // harus sama dengan rute di app/routes.py
    beranda: "/", masuk: "/masuk", daftar: "/daftar",
    klasifikasi: "/klasifikasi", riwayat: "/riwayat", tentang: "/tentang",
  },
};
