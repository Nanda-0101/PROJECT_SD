from flask import render_template
from app import app


@app.route("/")
def beranda():          # sebelumnya: home
    return render_template("index.html")


@app.route("/masuk")
def masuk():
    return render_template("masuk.html")


@app.route("/daftar")
def daftar():
    return render_template("daftar.html")


@app.route("/klasifikasi")
def klasifikasi():
    return render_template("klasifikasi.html")


@app.route("/riwayat")
def riwayat():
    return render_template("riwayat.html")


@app.route("/tentang")
def tentang():
    return render_template("tentang.html")