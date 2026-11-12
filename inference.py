# inference.py
import json
import os
import sys
from pathlib import Path
from typing import Iterable, Union

import joblib
import pandas as pd

# Windows: hindari symlink (butuh privilege Developer Mode)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


def _hf_token():
    return os.environ.get("HF_TOKEN") or None


def _download_from_hf(repo_id: str) -> Path:
    from huggingface_hub import snapshot_download, hf_hub_download

    local_target = Path(__file__).resolve().parent / "hf_model"
    try:
        snapshot_download(
            repo_id=repo_id,
            token=_hf_token(),
            local_dir=local_target,
        )
        return local_target
    except Exception as e:
        print(f"[inference] snapshot_download gagal: {e}. Fallback per-file...", file=sys.stderr)

    local_target.mkdir(parents=True, exist_ok=True)
    for fname in ["model.joblib", "config.json", "obesity_utils.py"]:
        hf_hub_download(
            repo_id=repo_id,
            filename=fname,
            token=_hf_token(),
            local_dir=local_target,
        )
    return local_target


def load_model(repo_id: str = None, local_dir: Union[str, Path] = None):
    if repo_id:
        local_dir = _download_from_hf(repo_id)
    local_dir = Path(local_dir) if local_dir else Path(__file__).resolve().parent

    if str(local_dir) not in sys.path:
        sys.path.insert(0, str(local_dir))

    model_path = local_dir / "model.joblib"
    config_path = local_dir / "config.json"
    if not model_path.exists():
        raise FileNotFoundError(f"Tidak ditemukan: {model_path}")
    if not config_path.exists():
        raise FileNotFoundError(f"Tidak ditemukan: {config_path}")

    model = joblib.load(model_path)
    cfg = json.loads(config_path.read_text())
    return model, cfg


def _extract_per_model_proba(model, frame):
    """Ambil probabilitas per sub-model dari VotingClassifier di dalam pipeline."""
    from sklearn.ensemble import VotingClassifier
    from sklearn.pipeline import Pipeline
    from imblearn.pipeline import Pipeline as ImbPipeline

    # Cari VotingClassifier di dalam pipeline (kalau ada)
    voter = None
    if isinstance(model, VotingClassifier):
        voter = model
        pre_steps = []
    elif isinstance(model, (Pipeline, ImbPipeline)):
        voter = model.named_steps.get("model")
        if not isinstance(voter, VotingClassifier):
            voter = None
        # step sebelum "model" adalah FeatureBuilder + ColumnTransformer
        pre_steps = [(name, step) for name, step in model.steps[:-1]]
    else:
        pre_steps = []

    # Fallback: bukan VotingClassifier → hanya ensemble
    if voter is None:
        p_ens = model.predict_proba(frame.values)
        return None, None, p_ens

    try:
        # ---- PENTING: kirim DataFrame, BUKAN frame.values ----
        X_processed = frame
        for step_name, step in pre_steps:
            X_processed = step.transform(X_processed)
        # X_processed sekarang: numpy (output ColumnTransformer)

        lgbm_pipe = voter.named_estimators_["lgbm"]   # ImbPipeline([("smote", ...), ("clf", ...)])
        mlp_pipe  = voter.named_estimators_["mlp"]

        # predict_proba pada sub-pipeline. Karena sub-pipeline memiliki
        # SMOTE (passthrough saat predict) + clf, dan TIDAK memiliki
        # FeatureBuilder/ColumnTransformer, maka input harus sudah
        # berupa array hasil transformasi pipeline utama.
        p_lgbm = lgbm_pipe.predict_proba(X_processed)
        p_mlp  = mlp_pipe.predict_proba(X_processed)

        w = getattr(voter, "weights", None) or (0.5, 0.5)
        w_lgbm, w_mlp = float(w[0]), float(w[1])
        total = w_lgbm + w_mlp or 1.0
        p_ens = (w_lgbm * p_lgbm + w_mlp * p_mlp) / total

        return p_lgbm, p_mlp, p_ens
    except Exception as e:
        print(f"[inference] Gagal ekstrak per-model: {e}", file=sys.stderr)
        p_ens = model.predict_proba(frame.values)
        return None, None, p_ens


def predict(model, config, records: Union[dict, Iterable[dict]]):
    if isinstance(records, dict):
        records = [records]

    frame = pd.DataFrame(list(records))[config["feature_order"]]
    p_lgbm, p_mlp, p_ens = _extract_per_model_proba(model, frame)

    names = [config["class_names"][str(i)] for i in range(p_ens.shape[1])]

    results = []
    for i, row in enumerate(p_ens):
        k = int(row.argmax())
        item = {
            "label": names[k],
            "confidence": float(row[k]),
            "probabilities": {n: float(p) for n, p in zip(names, row)},
            "ensemble": {n: float(p) for n, p in zip(names, row)},
        }
        if p_lgbm is not None:
            item["lgbm"] = {n: float(p) for n, p in zip(names, p_lgbm[i])}
            item["mlp"]  = {n: float(p) for n, p in zip(names, p_mlp[i])}
        results.append(item)
    return results