# app/auth/decorators.py
"""Dekorator keamanan yang dipakai bersama oleh endpoint API."""
from functools import wraps

from flask import jsonify, session


def api_login_required(view):
    """Tolak request tanpa sesi login dengan respons JSON 401.

    Pesan dan kode status sengaja sama dengan yang dipakai di app/ml_routes.py
    sehingga frontend cukup menangani satu bentuk error untuk semua API.
    """

    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Silakan masuk terlebih dahulu."}), 401
        return view(*args, **kwargs)

    return wrapper
