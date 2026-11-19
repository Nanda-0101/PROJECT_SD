# app/history/__init__.py
"""Modul Riwayat Klasifikasi.

- constants.py menyimpan pemetaan kode ke label dan batas parameter.
- services.py berisi query database dan logika bisnis tanpa urusan HTTP.
- routes.py berisi endpoint, validasi input, dan bentuk respons JSON.
"""
from flask import Blueprint

history_bp = Blueprint("history", __name__, url_prefix="/api/history")

# Import agar route terdaftar pada blueprint.
from app.history import routes  # noqa: E402,F401
