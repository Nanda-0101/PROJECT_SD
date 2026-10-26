from flask import Blueprint, render_template, session

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def beranda():
    return render_template("index.html")


@main_bp.route("/masuk")
def masuk():
    # Kalau sudah login, langsung lempar ke klasifikasi
    if session.get("user_id"):
        from flask import redirect, url_for
        return redirect(url_for("main.klasifikasi"))
    return render_template("masuk.html")


@main_bp.route("/daftar")
def daftar():
    return render_template("daftar.html")


@main_bp.route("/klasifikasi")
def klasifikasi():
    return render_template("klasifikasi.html")


@main_bp.route("/riwayat")
def riwayat():
    return render_template("riwayat.html")


@main_bp.route("/tentang")
def tentang():
    return render_template("tentang.html")