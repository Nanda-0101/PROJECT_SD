# app/ml_model.py
import os
from flask import current_app
from inference import load_model, predict as _predict


class _ModelHolder:
    _model = None
    _config = None

    @classmethod
    def get(cls):
        if cls._model is None:
            repo = None
            if current_app:
                repo = current_app.config.get("HF_MODEL_REPO")
            repo = repo or os.environ.get("HF_MODEL_REPO")
            cls._model, cls._config = load_model(repo_id=repo)
        return cls._model, cls._config


def _class_order(config):
    return [config["class_names"][str(i)] for i in range(len(config["class_names"]))]


def predict(payload: dict) -> dict:
    model, config = _ModelHolder.get()

    missing = [k for k in config["feature_order"] if k not in payload]
    if missing:
        raise ValueError(f"Field wajib: {', '.join(missing)}")

    clean = {k: float(payload[k]) for k in config["feature_order"]}
    result = _predict(model, config, clean)[0]

    order = _class_order(config)
    idx = order.index(result["label"])

    # -------- Konversi 0..1 → 0..100 dengan 2 desimal --------
    def to_pct(d):
        return {k: round(v * 100, 2) for k, v in d.items()}

    response = {
        "prediction": idx,
        "prediction_label": result["label"],
        "confidence": round(result["confidence"] * 100, 2),
        "ensemble": to_pct(result["ensemble"]),
        "_raw": {"ensemble": [result["ensemble"][c] for c in order]},
    }

    # Sertakan per model jika ada
    if "lgbm" in result:
        response["lgbm"] = to_pct(result["lgbm"])
    if "mlp" in result:
        response["mlp"] = to_pct(result["mlp"])

    return response