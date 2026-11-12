---
license: mit
library_name: sklearn
pipeline_tag: tabular-classification
tags:
  - tabular-classification
  - obesity
  - lightgbm
  - mlp
  - ensemble
  - scikit-learn
metrics:
  - accuracy
  - f1
---

# Obesity Status Classifier — Ensemble LightGBM + MLP

Model klasifikasi status obesitas (4 kelas: Underweight, Normal, Overweight, Obesity) dari kebiasaan hidup dan karakteristik dasar
(usia, tinggi badan, pola makan, aktivitas, transportasi, dll). Model yang dideploy adalah **ensemble probabilitas
0.5 x LightGBM + 0.5 x MLP** (scikit-learn), lengkap dengan preprocessing di dalam pipeline.

> **Bukan alat diagnosis medis.** Model hanya untuk skrining/edukasi dan dilatih pada data survei terbatas.

## Data
- Sumber: Obesity Dataset (Koklu & Sulak, 2024), 1.610 baris, 14 fitur, 4 kelas. Tanpa missing value dan duplikat.
- Distribusi kelas: Underweight 73, Normal 658, Overweight 592, Obesity 287 (tidak seimbang).
- Rentang usia 18-54 tahun, tinggi 150-193 cm. Model **tidak valid di luar rentang ini**.
- Split: 80 % latih / 20 % uji (stratified, seed 42).

## Metode
- Fitur: 14 fitur asli, tanpa feature engineering dan tanpa feature selection.
- Preprocessing: recode biner, one-hot untuk moda transportasi, StandardScaler.
- Skenario yang dideploy: **D: + SMOTE + Tuning** (SMOTE pada data latih di dalam pipeline; hyperparameter dituning dengan RandomizedSearchCV, macro-F1, 5-fold).
- Ensemble: P = 0.5 x P(LightGBM) + 0.5 x P(MLP); bobot tetap, tidak dituning.

## Hasil pada data uji (n = 322)

| Model | Accuracy | Precision (macro) | Recall (macro) | F1 (macro) | ROC-AUC (OvR) |
|---|---|---|---|---|---|
| LightGBM | 0.845 | 0.877 | 0.785 | 0.818 | 0.968 |
| MLP | 0.829 | 0.784 | 0.830 | 0.803 | 0.961 |
| Ensemble 0.5/0.5 | 0.863 | 0.852 | 0.821 | 0.834 | 0.970 |

F1-score per kelas untuk model yang dideploy:

| Kelas | F1 |
|---|---|
| Underweight | 0.741 |
| Normal | 0.909 |
| Overweight | 0.831 |
| Obesity | 0.855 |

## Cara menggunakan

```python
from huggingface_hub import snapshot_download
import sys
path = snapshot_download("username/obesity-ensemble-lgbm-mlp")
sys.path.insert(0, path)
from inference import load_model, predict

model, config = load_model(local_dir=path)
sample = dict(Sex=1, Age=45, Height=172, Overweight_Obese_Family=1, Consumption_of_Fast_Food=1,
              Frequency_of_Consuming_Vegetables=1, Number_of_Main_Meals_Daily=3, Food_Intake_Between_Meals=3,
              Smoking=2, Liquid_Intake_Daily=2, Calculation_of_Calorie_Intake=2, Physical_Exercise=3,
              Schedule_Dedicated_to_Technology=2, Type_of_Transportation_Used=1)
print(predict(model, config, sample))
```

Kode fitur mengikuti kamus data dataset (lihat `config.json` bagian `feature_schema`). Aplikasi Streamlit tersedia di `app.py`
(`pip install -r requirements.txt && streamlit run app.py`). Gunakan versi library pada `requirements.txt` karena berkas
`model.joblib` adalah pickle scikit-learn.

## Keterbatasan
- Usia sangat berkorelasi dengan kelas pada data ini sehingga model dapat memanfaatkannya sebagai jalan pintas; generalisasi ke populasi lain belum teruji.
- Tanpa berat badan/BMI; data kuesioner rentan bias pelaporan; kelas Underweight sangat sedikit (73 sampel).
- Hubungan fitur-kelas adalah asosiasi, bukan sebab-akibat.

## Sitasi data
Koklu, N., & Sulak, S.A. (2024). Using artificial intelligence techniques for the analysis of obesity status according to the
individuals' social and physical activities. Sinop Universitesi Fen Bilimleri Dergisi, 9(1), 217-239.
https://doi.org/10.33484/sinopfbd.1445215

Periksa ketentuan lisensi dataset sebelum mengubah lisensi model pada metadata di atas.
