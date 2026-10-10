/* Pengaturan frontend.
   USE_MOCK = true  -> semua data disimpan di browser (js/mock-api.js), TANPA backend.
   USE_MOCK = false -> frontend memanggil backend sungguhan di API_BASE. */
window.SL_CONFIG = {
  USE_MOCK: true,
  API_BASE: "", // contoh nanti: "http://127.0.0.1:5000"
};
