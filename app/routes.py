from flask import Blueprint, render_template, request, session, redirect, url_for
from app import db
from app.models import User

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def beranda():
    return render_template("index.html")


@main_bp.route("/masuk", methods=["GET", "POST"])
def masuk():
    # Sudah login? langsung ke klasifikasi
    if session.get("user_id"):
        return redirect(url_for("main.klasifikasi"))

    error = None
    username = ""

    if request.method == "POST":
        username = (request.form.get("username") or "").strip().lower()
        password = request.form.get("password") or ""

        if not username or not password:
            error = "Username dan password wajib diisi."
        else:
            user = User.query.filter(db.func.lower(User.username) == username).first()
            if not user or not user.check_password(password):
                error = "Username atau password salah."
            else:
                session.clear()
                session["user_id"] = user.id_user
                session.permanent = True
                return redirect(url_for("main.klasifikasi"))

    return render_template("masuk.html", error=error, username=username)


@main_bp.route("/keluar", methods=["POST"])
def keluar():
    session.clear()
    return redirect(url_for("main.beranda"))


@main_bp.route("/daftar")
def daftar():
    return render_template("daftar.html")


@main_bp.route("/klasifikasi")
def klasifikasi():
    if not session.get("user_id"):
        return redirect(url_for("main.masuk"))
    return render_template("klasifikasi.html")


@main_bp.route("/riwayat")
def riwayat():
    if not session.get("user_id"):
        return redirect(url_for("main.masuk"))
    return render_template("riwayat.html")


@main_bp.route("/tentang")
def tentang():
    return render_template("tentang.html")