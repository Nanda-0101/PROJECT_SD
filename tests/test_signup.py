# tests/test_signup.py
"""Pengujian pendaftaran akun di /daftar. Jalankan dengan perintah pytest dari root project."""
from app import db
from app.models import User

VALID = {
    "nama_lengkap": "Citra Dewi",
    "username": "citra.dewi",
    "password": "Rahasia123!",
    "password2": "Rahasia123!",
    "agree": "on",
}


def kirim(client, **ubah):
    """Kirim form pendaftaran. Kolom bisa diganti lewat argumen, atau dibuang dengan nilai None."""
    data = {**VALID, **ubah}
    data = {k: v for k, v in data.items() if v is not None}
    return client.post("/daftar", data=data)


def test_halaman_daftar_tampil(client):
    res = client.get("/daftar")
    assert res.status_code == 200
    assert b"Buat Akun" in res.data


def test_daftar_berhasil_membuat_user_dan_langsung_login(client, app):
    res = kirim(client)
    assert res.status_code == 302
    assert res.headers["Location"].endswith("/klasifikasi")

    with app.app_context():
        user = User.query.filter_by(username="citra.dewi").one()
        assert user.nama_lengkap == "Citra Dewi"
        assert user.password != VALID["password"]  # tersimpan sebagai hash
        assert user.check_password(VALID["password"])
        user_id = user.id_user

    with client.session_transaction() as sess:
        assert sess["user_id"] == user_id


def test_username_disimpan_huruf_kecil_dan_nama_dirapikan(client, app):
    kirim(client, username="Citra.Dewi", nama_lengkap="  Citra    Dewi ")
    with app.app_context():
        user = User.query.filter_by(username="citra.dewi").one()
        assert user.nama_lengkap == "Citra Dewi"


def test_username_duplikat_ditolak_tanpa_membedakan_huruf_besar_kecil(client, app):
    res = kirim(client, username="ANDI")  # andi sudah ada di fixture
    assert res.status_code == 200
    assert b"Username sudah dipakai." in res.data
    with app.app_context():
        assert User.query.filter(db.func.lower(User.username) == "andi").count() == 1


def test_password_tanpa_angka_ditolak(client):
    res = kirim(client, password="abcdefgh", password2="abcdefgh")
    assert res.status_code == 200
    assert b"Password harus memuat huruf dan angka." in res.data


def test_password_terlalu_pendek_ditolak(client):
    res = kirim(client, password="Ab1", password2="Ab1")
    assert res.status_code == 200
    assert b"Password harus 8 sampai 128 karakter." in res.data


def test_password_sama_dengan_username_ditolak(client):
    res = kirim(client, username="citra12345", password="citra12345", password2="citra12345")
    assert res.status_code == 200
    assert b"Password tidak boleh sama dengan username." in res.data


def test_konfirmasi_password_harus_cocok(client):
    res = kirim(client, password2="Berbeda123!")
    assert res.status_code == 200
    assert b"Konfirmasi password tidak cocok." in res.data


def test_wajib_menyetujui_pernyataan(client, app):
    res = kirim(client, agree=None)
    assert res.status_code == 200
    assert b"Centang pernyataan ini untuk melanjutkan." in res.data
    with app.app_context():
        assert User.query.filter_by(username="citra.dewi").first() is None


def test_username_dengan_karakter_terlarang_ditolak(client):
    res = kirim(client, username="citra dewi!")
    assert res.status_code == 200
    assert b"Username 3 sampai 30 karakter." in res.data


def test_isian_dipertahankan_saat_gagal_tetapi_password_tidak(client):
    res = kirim(client, password2="Berbeda123!")
    html = res.get_data(as_text=True)
    assert 'value="Citra Dewi"' in html
    assert 'value="citra.dewi"' in html
    assert "Rahasia123!" not in html


def test_yang_sudah_login_dialihkan_dari_halaman_daftar(andi):
    res = andi.get("/daftar")
    assert res.status_code == 302
    assert res.headers["Location"].endswith("/klasifikasi")
