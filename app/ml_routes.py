from flask import Blueprint, request, jsonify, session
from app import db
from app.ml_model import predict as model_predict
from app.models import Prediction, PredictionProbability, Feedback, Gender, ActivityLevel

ml_bp = Blueprint("ml", __name__, url_prefix="/api/ml")

REQUIRED_FIELDS = [
    "Age", "Gender_Encoded", "Height_winsorized",
    "Weight_winsorized", "PhysicalActivityLevel",
]


@ml_bp.route("/predict", methods=["POST"])
def predict_route():
    if not session.get("user_id"):
        return jsonify({"error": "Silakan masuk terlebih dahulu."}), 401

    data = request.get_json(silent=True) or {}
    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        return jsonify({"error": f"Field wajib: {', '.join(missing)}"}), 422

    try:
        result = model_predict(data)
    except Exception as e:
        return jsonify({"error": f"Prediksi gagal: {e}"}), 500

    try:
        gender = Gender.query.filter_by(encoding_value=int(data["Gender_Encoded"])).first()
        activity = ActivityLevel.query.filter_by(encoding_value=int(data["PhysicalActivityLevel"]) - 1).first()
        if not gender or not activity:
            return jsonify({"error": "Gender atau activity tidak valid."}), 422

        pred = Prediction(
            id_user=session["user_id"],
            id_category=result["prediction"] + 1,
            id_gender=gender.id_gender,
            id_activity=activity.id_activity,
            age=int(data["Age"]),
            height=float(data["Height_winsorized"]),
            weight=float(data["Weight_winsorized"]),
        )
        db.session.add(pred)
        db.session.flush()

        for i, prob in enumerate(result["_raw"]["ensemble"]):
            db.session.add(PredictionProbability(
                id_prediction=pred.id_prediction,
                id_category=i + 1,
                probability=float(prob),
            ))

        db.session.commit()
        result["id_prediction"] = pred.id_prediction
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Gagal menyimpan prediksi: {e}"}), 500

    result.pop("_raw", None)
    return jsonify(result), 200


@ml_bp.route("/feedback", methods=["POST"])
def feedback_route():
    if not session.get("user_id"):
        return jsonify({"error": "Silakan masuk terlebih dahulu."}), 401

    data = request.get_json(silent=True) or {}
    id_pred = data.get("id_prediction")
    is_accurate = data.get("is_accurate")

    if not isinstance(id_pred, int) or not isinstance(is_accurate, bool):
        return jsonify({"error": "Data feedback tidak valid."}), 422

    pred = Prediction.query.filter_by(
        id_prediction=id_pred, id_user=session["user_id"]
    ).first()
    if not pred:
        return jsonify({"error": "Prediksi tidak ditemukan."}), 404

    fb = Feedback.query.filter_by(id_prediction=id_pred).first()
    if fb:
        fb.is_accurate = is_accurate
    else:
        db.session.add(Feedback(id_prediction=id_pred, is_accurate=is_accurate))

    db.session.commit()
    return jsonify({"ok": True, "is_accurate": is_accurate}), 200