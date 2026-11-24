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


@main_bp.route("/daftar", methods=["GET", "POST"])
def daftar():
    if session.get("user_id"):
        return redirect(url_for("main.klasifikasi"))

    error = None
    nama_lengkap = ""
    username = ""

    if request.method == "POST":
        nama_lengkap = (request.form.get("nama_lengkap") or "").strip()
        username = (request.form.get("username") or "").strip().lower()
        password = request.form.get("password") or ""
        konfirmasi_password = request.form.get("konfirmasi_password") or ""

        if not nama_lengkap or not username or not password:
            error = "Nama lengkap, username, dan password wajib diisi."
        elif konfirmasi_password and password != konfirmasi_password:
            error = "Konfirmasi password tidak cocok."
        elif User.query.filter(db.func.lower(User.username) == username).first():
            error = "Username sudah digunakan, silakan pilih yang lain."
        else:
            user_baru = User(
                nama_lengkap=nama_lengkap,
                username=username,
            )
            user_baru.set_password(password)

            db.session.add(user_baru)
            db.session.commit()

            session.clear()
            session["user_id"] = user_baru.id_user
            session.permanent = True
            return redirect(url_for("main.klasifikasi"))

    return render_template(
        "daftar.html",
        error=error,
        nama_lengkap=nama_lengkap,
        username=username,
    )


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