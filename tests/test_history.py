# tests/test_history.py
"""Pengujian endpoint /api/history. Jalankan dengan perintah pytest dari root project."""
from app import db
from app.models import Feedback, Prediction, PredictionProbability


# ---------------------------------------------------------------- autentikasi
def test_semua_endpoint_butuh_login(client, seeded):
    calls = [
        client.get("/api/history"),
        client.get("/api/history/stats"),
        client.get("/api/history/export"),
        client.get(f"/api/history/{seeded['a1']}"),
        client.delete(f"/api/history/{seeded['a1']}"),
        client.post("/api/history/bulk-delete", json={"ids": [1]}),
        client.delete("/api/history"),
    ]
    assert [r.status_code for r in calls] == [401] * 7


# ---------------------------------------------------------------------- daftar
def test_daftar_hanya_milik_sendiri_dan_terbaru_dulu(andi, seeded):
    data = andi.get("/api/history").get_json()
    ids = [i["id"] for i in data["items"]]
    assert seeded["b1"] not in ids
    assert data["pagination"]["total"] == 6
    assert ids[0] == seeded["a1"]


def test_bentuk_item(andi, seeded):
    item = andi.get("/api/history?per_page=1").get_json()["items"][0]
    assert item["age"] == 56 and item["height"] == 170
    assert item["gender"] == "Laki-laki"
    assert item["activity"] == "3-4 hari/minggu"
    assert item["category"] == {"id": 2, "key": "normal", "name": "Normal weight"}
    assert item["confidence"] == 80.0


def test_pagination_dan_klem_halaman(andi, seeded):
    page1 = andi.get("/api/history?per_page=4&page=1").get_json()
    page2 = andi.get("/api/history?per_page=4&page=2").get_json()
    assert len(page1["items"]) == 4 and len(page2["items"]) == 2
    assert page1["pagination"]["pages"] == 2
    ids = [i["id"] for i in page1["items"] + page2["items"]]
    assert len(set(ids)) == 6  # tidak ada duplikat walau dua baris berwaktu sama
    jauh = andi.get("/api/history?per_page=4&page=99").get_json()
    assert jauh["pagination"]["page"] == 2


def test_urutan_terlama(andi, seeded):
    ids = [i["id"] for i in andi.get("/api/history?sort=asc").get_json()["items"]]
    assert ids[0] == seeded["a4"] and ids[-1] == seeded["a1"]


def test_filter_kategori_dan_counts(andi, seeded):
    data = andi.get("/api/history?category=normal").get_json()
    assert data["pagination"]["total"] == 2
    # counts tidak ikut terpengaruh filter kategori
    assert data["counts"] == {"all": 6, "under": 2, "normal": 2, "over": 1, "obese": 1}


def test_filter_rentang_waktu(andi, seeded):
    assert andi.get("/api/history?range=7").get_json()["pagination"]["total"] == 4
    assert andi.get("/api/history?range=30").get_json()["pagination"]["total"] == 5
    assert andi.get("/api/history?range=0").get_json()["pagination"]["total"] == 6


def test_pencarian_kategori_dan_tanggal(andi, seeded):
    assert andi.get("/api/history?q=obese").get_json()["pagination"]["total"] == 1
    assert andi.get("/api/history?q=WEIGHT").get_json()["pagination"]["total"] == 5
    detail = andi.get(f"/api/history/{seeded['a1']}").get_json()
    tanggal = detail["predicted_at"][:10]
    assert andi.get(f"/api/history?q={tanggal}").get_json()["pagination"]["total"] >= 1
    assert andi.get("/api/history?q=%25").get_json()["pagination"]["total"] == 0  # wildcard di-escape


def test_parameter_tidak_valid(andi):
    for query in ("category=xyz", "sort=ngawur", "range=15", "page=abc", "per_page=x"):
        assert andi.get(f"/api/history?{query}").status_code == 422


# ---------------------------------------------------------------------- stats
def test_stats(andi, seeded):
    data = andi.get("/api/history/stats").get_json()
    assert data["total"] == 6
    assert data["max_confidence"] == 90.0 and data["min_confidence"] == 50.0
    assert data["avg_confidence"] == round((80 + 60 + 90 + 70 + 50 + 55) / 6, 2)
    assert data["top_category"]["count"] == 2


def test_stats_kosong(client, app):
    with client.session_transaction() as sess:
        sess["user_id"] = 2
    data = client.get("/api/history/stats?category=obese").get_json()
    assert data["total"] == 0 and data["avg_confidence"] is None and data["top_category"] is None


# --------------------------------------------------------------------- detail
def test_detail_lengkap(andi, seeded):
    data = andi.get(f"/api/history/{seeded['a1']}").get_json()
    assert len(data["features"]) == 14
    assert [p["key"] for p in data["probabilities"]] == ["under", "normal", "over", "obese"]
    assert data["feedback"] == {"is_accurate": True}


def test_detail_milik_orang_lain_404(andi, seeded):
    assert andi.get(f"/api/history/{seeded['b1']}").status_code == 404
    assert andi.get("/api/history/99999").status_code == 404


# ---------------------------------------------------------------------- hapus
def test_hapus_satu_ikut_menghapus_anak(andi, seeded, app):
    assert andi.delete(f"/api/history/{seeded['a1']}").status_code == 200
    with app.app_context():
        assert db.session.get(Prediction, seeded["a1"]) is None
        assert PredictionProbability.query.filter_by(id_prediction=seeded["a1"]).count() == 0
        assert Feedback.query.filter_by(id_prediction=seeded["a1"]).count() == 0
    assert andi.delete(f"/api/history/{seeded['a1']}").status_code == 404


def test_tidak_bisa_hapus_milik_orang_lain(andi, seeded, app):
    assert andi.delete(f"/api/history/{seeded['b1']}").status_code == 404
    with app.app_context():
        assert db.session.get(Prediction, seeded["b1"]) is not None


def test_hapus_massal(andi, seeded, app):
    res = andi.post("/api/history/bulk-delete", json={"ids": [seeded["a2"], seeded["a3"], seeded["b1"]]})
    assert res.get_json()["deleted"] == 2  # id milik Budi diabaikan
    with app.app_context():
        assert db.session.get(Prediction, seeded["b1"]) is not None


def test_hapus_massal_validasi(andi):
    for body in ({}, {"ids": []}, {"ids": "1"}, {"ids": [1, "2"]}, {"ids": [True]}, {"ids": list(range(501))}):
        assert andi.post("/api/history/bulk-delete", json=body).status_code == 422


def test_hapus_semua_hanya_milik_sendiri(andi, seeded, app):
    assert andi.delete("/api/history").get_json()["deleted"] == 6
    with app.app_context():
        assert Prediction.query.count() == 1
        assert PredictionProbability.query.count() == 4


# --------------------------------------------------------------------- export
def test_export_csv(andi, seeded):
    res = andi.get("/api/history/export?category=normal")
    assert res.status_code == 200
    assert res.mimetype == "text/csv"
    assert "attachment" in res.headers["Content-Disposition"]
    lines = res.get_data(as_text=True).lstrip("\ufeff").strip().splitlines()
    assert lines[0].startswith("No,Tanggal,Usia,Gender")
    assert len(lines) == 3  # header ditambah dua baris kategori normal
    assert "Normal weight" in lines[1]
