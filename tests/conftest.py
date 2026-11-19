# tests/conftest.py
"""Fixture bersama untuk pengujian. Memakai SQLite in-memory dari TestingConfig."""
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

# Agar paket app dan modul inference bisa diimpor dari folder tests.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app, db  # noqa: E402
from app.models import Category, Feedback, Prediction, PredictionProbability, User  # noqa: E402

CATEGORIES = [(1, "Underweight"), (2, "Normal weight"), (3, "Overweight"), (4, "Obese")]


@pytest.fixture()
def app():
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        for cid, name in CATEGORIES:
            db.session.add(Category(id_category=cid, nama_kategori=name, encoding_value=cid - 1))
        db.session.add_all(
            [
                User(id_user=1, nama_lengkap="Andi", username="andi", password="x"),
                User(id_user=2, nama_lengkap="Budi", username="budi", password="x"),
            ]
        )
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


def add_prediction(user_id, category_id, confidence, when, sex=1, age=30, height=170.0, exercise=3):
    """Buat satu riwayat lengkap dengan probabilitas seperti hasil ml_routes."""
    pred = Prediction(
        id_user=user_id,
        id_category=category_id,
        predicted_at=when,
        features={"Sex": float(sex), "Age": float(age), "Height": height, "Physical_Exercise": float(exercise)},
    )
    db.session.add(pred)
    db.session.flush()
    rest = (1 - confidence) / 3
    for cid in range(1, 5):
        db.session.add(
            PredictionProbability(
                id_prediction=pred.id_prediction,
                id_category=cid,
                probability=confidence if cid == category_id else rest,
            )
        )
    db.session.commit()
    return pred.id_prediction


@pytest.fixture()
def seeded(app):
    """Data uji. Andi punya 5 riwayat dan Budi punya 1."""
    now = datetime.now()
    ids = {}
    with app.app_context():
        ids["a1"] = add_prediction(1, 2, 0.80, now - timedelta(days=1), sex=1, age=56)
        ids["a2"] = add_prediction(1, 3, 0.60, now - timedelta(days=3), sex=2, age=32)
        ids["a3"] = add_prediction(1, 4, 0.90, now - timedelta(days=10), age=69)
        ids["a4"] = add_prediction(1, 2, 0.70, now - timedelta(days=40), age=41)
        same = now - timedelta(days=2)  # dua riwayat dengan waktu persis sama
        ids["a5"] = add_prediction(1, 1, 0.50, same)
        ids["a6"] = add_prediction(1, 1, 0.55, same)
        ids["b1"] = add_prediction(2, 2, 0.95, now - timedelta(days=1))
        db.session.add(Feedback(id_prediction=ids["a1"], is_accurate=True))
        db.session.commit()
    return ids


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def andi(client):
    with client.session_transaction() as sess:
        sess["user_id"] = 1
    return client
