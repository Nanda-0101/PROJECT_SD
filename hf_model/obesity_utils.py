import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ------------------------------------------------------------------
# Skema fitur mentah (kode asli pada Obesity_Dataset.xlsx)
# ------------------------------------------------------------------
CLASS_NAMES = {0: "Underweight", 1: "Normal", 2: "Overweight", 3: "Obesity"}

FEATURE_SCHEMA = {
    "Sex": {"label": "Jenis kelamin", "options": {1: "Laki-laki", 2: "Perempuan"}},
    "Age": {"label": "Usia (tahun)", "min": 18, "max": 80, "default": 30, "train_range": [18, 54]},
    "Height": {"label": "Tinggi badan (cm)", "min": 120, "max": 220, "default": 168, "train_range": [150, 193]},
    "Overweight_Obese_Family": {"label": "Ada anggota keluarga overweight/obesitas?", "options": {1: "Ya", 2: "Tidak"}},
    "Consumption_of_Fast_Food": {"label": "Mengonsumsi fast food?", "options": {1: "Ya", 2: "Tidak"}},
    "Frequency_of_Consuming_Vegetables": {"label": "Frekuensi makan sayur", "options": {1: "Jarang", 2: "Kadang-kadang", 3: "Selalu"}},
    "Number_of_Main_Meals_Daily": {"label": "Jumlah makan utama per hari", "options": {1: "1-2 kali", 2: "3 kali", 3: "Lebih dari 3 kali"}},
    "Food_Intake_Between_Meals": {"label": "Makan di antara waktu makan utama", "options": {1: "Jarang", 2: "Kadang-kadang", 3: "Biasanya", 4: "Selalu"}},
    "Smoking": {"label": "Merokok?", "options": {1: "Ya", 2: "Tidak"}},
    "Liquid_Intake_Daily": {"label": "Asupan cairan per hari", "options": {1: "Kurang dari 1 liter", 2: "1-2 liter", 3: "Lebih dari 2 liter"}},
    "Calculation_of_Calorie_Intake": {"label": "Menghitung asupan kalori?", "options": {1: "Ya", 2: "Tidak"}},
    "Physical_Exercise": {"label": "Frekuensi olahraga", "options": {1: "Tidak pernah", 2: "1-2 hari/minggu", 3: "3-4 hari/minggu", 4: "5-6 hari/minggu", 5: "Lebih dari 6 hari/minggu"}},
    "Schedule_Dedicated_to_Technology": {"label": "Waktu untuk teknologi/gadget per hari", "options": {1: "0-2 jam", 2: "3-5 jam", 3: "Lebih dari 5 jam"}},
    "Type_of_Transportation_Used": {"label": "Moda transportasi utama", "options": {1: "Mobil", 2: "Sepeda motor", 3: "Sepeda", 4: "Transportasi umum", 5: "Jalan kaki"}},
}

RAW_FEATURES = list(FEATURE_SCHEMA.keys())          # 14 fitur asli
BINARY_YES_NO = ["Overweight_Obese_Family", "Consumption_of_Fast_Food", "Smoking", "Calculation_of_Calorie_Intake"]
NOMINAL = ["Type_of_Transportation_Used"]


class FeatureBuilder(BaseEstimator, TransformerMixin):
    """Recode fitur biner saja. Tidak menambah fitur, tidak mengurangi fitur, tidak memakai statistik data latih."""

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = pd.DataFrame(X)[RAW_FEATURES].astype(float)
        out = X.copy()
        out["Sex"] = 2.0 - X["Sex"]                       # 1=Male -> 1, 2=Female -> 0
        out = out.rename(columns={"Sex": "Sex_Male"})
        for c in BINARY_YES_NO:                           # 1=Yes -> 1, 2=No -> 0
            out[c] = 2.0 - X[c]
        return out


def build_preprocessor():
    """One-hot untuk fitur nominal, StandardScaler untuk sisanya."""
    return ColumnTransformer(
        [("nom", OneHotEncoder(handle_unknown="ignore", sparse_output=False), NOMINAL)],
        remainder=StandardScaler(),
    )
