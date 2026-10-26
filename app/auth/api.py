from flask import jsonify, request, session
from app import db
from app.models import User
from app.auth import auth_api_bp


def _public_user(user):
    """Data user yang aman dikirim ke frontend (tanpa password)."""
    return {
        "id": user.id_user,
        "name": user.nama_lengkap,
        "username": user.username,
    }


@auth_api_bp.route("/login", methods=["POST"])
def login():
    """Login memakai username + password dari tabel `users`."""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username dan password wajib diisi."}), 422

    user = User.query.filter(db.func.lower(User.username) == username).first()

    # Pesan sengaja disamakan untuk mencegah user enumeration
    if not user or not user.check_password(password):
        return jsonify({"error": "Username atau password salah."}), 401

    # Simpan id user di session (cookie HttpOnly oleh Flask secara default)
    session.clear()
    session["user_id"] = user.id_user
    session.permanent = True

    return jsonify({"user": _public_user(user)}), 200


@auth_api_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True}), 200


@auth_api_bp.route("/me", methods=["GET"])
def me():
    """Return user yang sedang login, atau null bila belum login."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"user": None}), 200

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return jsonify({"user": None}), 200

    return jsonify({"user": _public_user(user)}), 200