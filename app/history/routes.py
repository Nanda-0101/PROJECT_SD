# app/history/routes.py
"""Endpoint JSON untuk halaman Riwayat.

Semua endpoint wajib login dan hanya menyentuh data milik user yang sedang masuk.

Daftar endpoint
- GET    /api/history              daftar riwayat dengan filter dan pagination
- DELETE /api/history              hapus seluruh riwayat milik user
- GET    /api/history/stats        ringkasan statistik
- GET    /api/history/export       unduh CSV
- POST   /api/history/bulk-delete  hapus beberapa riwayat sekaligus
- GET    /api/history/<id>         detail satu riwayat
- DELETE /api/history/<id>         hapus satu riwayat
"""
from datetime import datetime

from flask import Response, current_app, jsonify, request, session
from sqlalchemy.exc import SQLAlchemyError

from app import db
from app.auth.decorators import api_login_required
from app.history import history_bp
from app.history.constants import MAX_BULK_DELETE
from app.history.services import (
    build_csv,
    delete_predictions,
    get_detail,
    get_stats,
    list_history,
    parse_filters,
)


def _error(message: str, status: int):
    return jsonify({"error": message}), status


def _filters_or_error():
    """Kembalikan (filters, None) bila valid atau (None, respons_error) bila tidak."""
    try:
        return parse_filters(request.args), None
    except ValueError as exc:
        return None, _error(str(exc), 422)


def _db_error(action: str):
    """Rollback, catat error lengkap di log, dan balas pesan umum ke klien."""
    db.session.rollback()
    current_app.logger.exception("Riwayat gagal %s", action)
    return _error(f"Gagal {action}. Silakan coba lagi.", 500)


# Baca

@history_bp.route("", methods=["GET"])
@api_login_required
def list_route():
    filters, error = _filters_or_error()
    if error:
        return error
    try:
        return jsonify(list_history(session["user_id"], filters)), 200
    except SQLAlchemyError:
        return _db_error("memuat riwayat")


@history_bp.route("/stats", methods=["GET"])
@api_login_required
def stats_route():
    filters, error = _filters_or_error()
    if error:
        return error
    try:
        return jsonify(get_stats(session["user_id"], filters)), 200
    except SQLAlchemyError:
        return _db_error("memuat statistik")


@history_bp.route("/export", methods=["GET"])
@api_login_required
def export_route():
    filters, error = _filters_or_error()
    if error:
        return error
    try:
        content = build_csv(session["user_id"], filters)
    except SQLAlchemyError:
        return _db_error("membuat berkas CSV")

    filename = f"riwayat-klasifikasi-{datetime.now():%Y%m%d-%H%M%S}.csv"
    # BOM di awal membuat Excel membaca berkas sebagai UTF-8.
    return Response(
        "\ufeff" + content,
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@history_bp.route("/<int:prediction_id>", methods=["GET"])
@api_login_required
def detail_route(prediction_id: int):
    try:
        item = get_detail(session["user_id"], prediction_id)
    except SQLAlchemyError:
        return _db_error("memuat detail riwayat")
    if item is None:
        return _error("Riwayat tidak ditemukan.", 404)
    return jsonify(item), 200


# Hapus

@history_bp.route("/<int:prediction_id>", methods=["DELETE"])
@api_login_required
def delete_one_route(prediction_id: int):
    try:
        deleted = delete_predictions(session["user_id"], [prediction_id])
    except SQLAlchemyError:
        return _db_error("menghapus riwayat")
    if not deleted:
        return _error("Riwayat tidak ditemukan.", 404)
    return jsonify({"ok": True, "deleted": deleted}), 200


@history_bp.route("/bulk-delete", methods=["POST"])
@api_login_required
def bulk_delete_route():
    data = request.get_json(silent=True) or {}
    ids = data.get("ids")

    # bool adalah turunan int di Python, jadi harus ditolak secara eksplisit.
    valid = (
        isinstance(ids, list)
        and ids
        and all(isinstance(i, int) and not isinstance(i, bool) for i in ids)
    )
    if not valid:
        return _error("Daftar id riwayat tidak valid.", 422)
    if len(ids) > MAX_BULK_DELETE:
        return _error(f"Maksimal {MAX_BULK_DELETE} riwayat per permintaan.", 422)

    try:
        deleted = delete_predictions(session["user_id"], list(set(ids)))
    except SQLAlchemyError:
        return _db_error("menghapus riwayat")
    return jsonify({"ok": True, "deleted": deleted}), 200


@history_bp.route("", methods=["DELETE"])
@api_login_required
def delete_all_route():
    try:
        deleted = delete_predictions(session["user_id"])
    except SQLAlchemyError:
        return _db_error("menghapus riwayat")
    return jsonify({"ok": True, "deleted": deleted}), 200
