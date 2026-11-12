# app/ml_routes.py
from flask import Blueprint, jsonify, request, session

from app import db
from app.ml_model import predict as model_predict
from app.models import Feedback, Prediction, PredictionProbability

ml_bp = Blueprint("ml", __name__, url_prefix="/api/ml")

REQUIRED_FIELDS = [
    "Sex", "Age", "Height",
    "Overweight_Obese_Family", "Consumption_of_Fast_Food",
    "Frequency_of_Consuming_Vegetables", "Number_of_Main_Meals_Daily",
    "Food_Intake_Between_Meals", "Smoking", "Liquid_Intake_Daily",
    "Calculation_of_Calorie_Intake", "Physical_Exercise",
    "Schedule_Dedicated_to_Technology", "Type_of_Transportation_Used",
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
        result = model_predict({k: float(data[k]) for k in REQUIRED_FIELDS})
    except Exception as e:
        return jsonify({"error": f"Prediksi gagal: {e}"}), 500

    try:
        pred = Prediction(
            id_user=session["user_id"],
            id_category=result["prediction"] + 1,   # 1..4
            features={k: float(data[k]) for k in REQUIRED_FIELDS},
        )
        db.session.add(pred)
        db.session.flush()

        for i, prob in enumerate(result["_raw"]["ensemble"]):
            db.session.add(PredictionProbability(
                id_prediction=pred.id_prediction,
                id_category=i + 1,                 # 1..4
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