import os
import json
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb
from huggingface_hub import hf_hub_download

MODEL_REPO = os.environ.get("HF_MODEL_REPO", "nanda010101/sakit-learn-models")
HF_TOKEN = os.environ.get("HF_TOKEN")

FILES = {"lgbm": "lgbm_model.txt", "mlp": "nn_model.joblib", "scaler": "scaler.json"}
FEATURES = ["Age", "Gender_Encoded", "Height_winsorized", "Weight_winsorized", "PhysicalActivityLevel"]

CLASS_LABELS = ["Underweight", "Normal weight", "Overweight", "Obese"]


def _download():
    kwargs = {"repo_id": MODEL_REPO}
    if HF_TOKEN:
        kwargs["token"] = HF_TOKEN
    return {name: hf_hub_download(filename=fname, **kwargs) for name, fname in FILES.items()}


print(f"[ml_model] Mengunduh model dari {MODEL_REPO} ...")
_paths = _download()
print("[ml_model] Model siap.")

_lgbm = lgb.Booster(model_file=_paths["lgbm"])
_mlp = joblib.load(_paths["mlp"])

with open(_paths["scaler"]) as f:
    _scaler = json.load(f)
_mean = np.array(_scaler["mean"])
_scale = np.array(_scaler["scale"])


def _to_label_map(prob_array):
    return {label: round(float(prob_array[i]) * 100, 2) for i, label in enumerate(CLASS_LABELS)}


def predict(payload: dict) -> dict:
    row = [float(payload[f]) for f in FEATURES]
    df = pd.DataFrame([row], columns=FEATURES)
    X = (df.values - _mean) / _scale

    p1 = _lgbm.predict(X)[0]
    p2 = _mlp.predict_proba(X)[0]
    final = 0.5 * p1 + 0.5 * p2

    winner_idx = int(np.argmax(final))
    winner_label = CLASS_LABELS[winner_idx]

    return {
        "lgbm": _to_label_map(p1),
        "mlp": _to_label_map(p2),
        "ensemble": _to_label_map(final),
        "prediction": winner_idx,
        "prediction_label": winner_label,
        "confidence": round(float(final[winner_idx]) * 100, 2),
        "_raw": {"ensemble": final.tolist()},
    }