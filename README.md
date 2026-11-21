# Aplikasi Web Klasifikasi Tingkat Obesitas (`sakit_learn`)

Aplikasi web berbasis **Flask** dan **MySQL** untuk melakukan prediksi dan klasifikasi tingkat obesitas menggunakan model Machine Learning (*Ensemble Voting Classifier* — LightGBM & MLP) yang terintegrasi dengan Hugging Face Hub, dilengkapi sistem autentikasi pengguna dan pencatatan riwayat prediksi.

## Fitur Utama
- **Klasifikasi Obesitas**: Prediksi kategori tingkat obesitas (*Underweight*, *Normal weight*, *Overweight*, *Obese*) beserta nilai probabilitas per model (Ensemble, LightGBM, dan MLP).
- **Integrasi Hugging Face Hub**: Otomatis mengunduh dan memuat artefak model (`model.joblib`, `config.json`, `obesity_utils.py`) ke penyimpanan lokal (`hf_model/`).
- **Autentikasi Pengguna**: Fitur registrasi, login, logout, dan manajemen sesi pengguna.
- **Riwayat & Feedback Prediksi**: Menyimpan hasil klasifikasi per pengguna yang telah login serta memberikan umpan balik akurasi prediksi.
- **Automated Testing**: Pengujian unit dan integrasi menggunakan `pytest` dengan database SQLite *in-memory*.

## Struktur Direktori
```text
TK2/
├── app/
│   ├── auth/            # Blueprint & dekorator autentikasi (login, logout, session guard)
│   ├── history/         # Blueprint & API riwayat prediksi pengguna
│   ├── static/          # Aset CSS dan JavaScript frontend
│   ├── templates/       # Template HTML halaman web
│   ├── __init__.py      # Inisialisasi aplikasi Flask & database
│   ├── config.py        # Konfigurasi environment (Development, Testing, Production)
│   ├── ml_model.py      # Wrapper pemuatan model ML
│   ├── ml_routes.py     # Endpoint API klasifikasi & prediksi
│   ├── models.py        # Model tabel database (User, Prediction, Category, Feedback)
│   └── routes.py        # Routing halaman utama
├── hf_model/            # Cache lokal model dari Hugging Face (diabaikan Git)
├── tests/               # Pengujian otomatis dengan pytest
├── inference.py         # Logika unduh model HF & ekstraksi probabilitas prediksi
├── requirements.txt     # Daftar dependensi Python
└── run.py               # Entry point untuk menjalankan server Flask
```

## Instalasi & Cara Menjalankan

### 1. Clone Repositori
```bash
git clone <url-repositori-anda>
cd TK2
```

### 2. Buat & Aktifkan Virtual Environment
**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependensi
```bash
pip install -r requirements.txt
```

### 4. Persiapan Database & Konfigurasi `.env`
1. Pastikan layanan **MySQL** (misalnya lewat XAMPP/Laragon) sudah berjalan dan buat database baru bernama **`sakit_learn`**.
2. Buat file `.env` di direktori utama proyek dan sesuaikan nilainya dengan konfigurasi lokalmu:
```env
SECRET_KEY=ganti_dengan_secret_key_unik_anda
FLASK_APP=run.py
FLASK_ENV=development

# Database
DB_USER=root
DB_PASSWORD=
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=sakit_learn

DATABASE_URL=mysql+pymysql://root:@127.0.0.1:3306/sakit_learn
```

### 5. Jalankan Aplikasi
```bash
python run.py
```
Buka browser dan akses **`http://127.0.0.1:5000`**.

## Menjalankan Pengujian (Testing)
Untuk menjalankan seluruh skenario pengujian otomatis menggunakan `pytest`:
```bash
pytest
```
