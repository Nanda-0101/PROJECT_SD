# app/history/constants.py
"""Konstanta khusus modul Riwayat.

Seluruh pemetaan di sini disalin dari skema fitur model (hf_model/config.json).
Folder hf_model sengaja tidak diimpor karena baru diunduh saat prediksi pertama
dan tidak boleh menjadi syarat untuk membuka halaman riwayat.
"""

# Kategori
# Kunci kategori dipetakan dari id_category sesuai cara app/ml_routes.py
# menyimpan data, yaitu indeks kelas model ditambah 1.

CATEGORY_KEY_BY_ID = {
    1: "under",
    2: "normal",
    3: "over",
    4: "obese",
}
CATEGORY_ID_BY_KEY = {key: cid for cid, key in CATEGORY_KEY_BY_ID.items()}

# Skema fitur. Urutan dictionary menentukan urutan tampil di modal detail.

FEATURE_SCHEMA = {
    "Sex": {
        "label": "Jenis kelamin",
        "options": {1: "Laki-laki", 2: "Perempuan"},
    },
    "Age": {"label": "Usia (tahun)", "unit": "tahun"},
    "Height": {"label": "Tinggi badan (cm)", "unit": "cm"},
    "Overweight_Obese_Family": {
        "label": "Ada anggota keluarga overweight/obesitas?",
        "options": {1: "Ya", 2: "Tidak"},
    },
    "Consumption_of_Fast_Food": {
        "label": "Mengonsumsi fast food?",
        "options": {1: "Ya", 2: "Tidak"},
    },
    "Frequency_of_Consuming_Vegetables": {
        "label": "Frekuensi makan sayur",
        "options": {1: "Jarang", 2: "Kadang-kadang", 3: "Selalu"},
    },
    "Number_of_Main_Meals_Daily": {
        "label": "Jumlah makan utama per hari",
        "options": {1: "1-2 kali", 2: "3 kali", 3: "Lebih dari 3 kali"},
    },
    "Food_Intake_Between_Meals": {
        "label": "Makan di antara waktu makan utama",
        "options": {1: "Jarang", 2: "Kadang-kadang", 3: "Biasanya", 4: "Selalu"},
    },
    "Smoking": {
        "label": "Merokok?",
        "options": {1: "Ya", 2: "Tidak"},
    },
    "Liquid_Intake_Daily": {
        "label": "Asupan cairan per hari",
        "options": {1: "Kurang dari 1 liter", 2: "1-2 liter", 3: "Lebih dari 2 liter"},
    },
    "Calculation_of_Calorie_Intake": {
        "label": "Menghitung asupan kalori?",
        "options": {1: "Ya", 2: "Tidak"},
    },
    "Physical_Exercise": {
        "label": "Frekuensi olahraga",
        "options": {
            1: "Tidak pernah",
            2: "1-2 hari/minggu",
            3: "3-4 hari/minggu",
            4: "5-6 hari/minggu",
            5: "Lebih dari 6 hari/minggu",
        },
    },
    "Schedule_Dedicated_to_Technology": {
        "label": "Waktu untuk teknologi/gadget per hari",
        "options": {1: "0-2 jam", 2: "3-5 jam", 3: "Lebih dari 5 jam"},
    },
    "Type_of_Transportation_Used": {
        "label": "Moda transportasi utama",
        "options": {
            1: "Mobil",
            2: "Sepeda motor",
            3: "Sepeda",
            4: "Transportasi umum",
            5: "Jalan kaki",
        },
    },
}


# Batas dan nilai bawaan parameter query

ALLOWED_SORTS = ("asc", "desc")
ALLOWED_RANGES = (0, 7, 30)  # 0 berarti semua waktu
DEFAULT_PER_PAGE = 10
MAX_PER_PAGE = 50
MAX_BULK_DELETE = 500
