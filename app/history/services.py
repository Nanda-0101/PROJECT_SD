# app/history/services.py
"""Logika bisnis Riwayat Klasifikasi.

Setiap fungsi menerima user_id dan selalu membatasi query pada milik user itu.
Dengan begitu satu pengguna tidak akan pernah bisa melihat atau menghapus
riwayat pengguna lain, apa pun id yang dikirim dari frontend.
"""
import csv
import io
from dataclasses import dataclass
from datetime import datetime, timedelta
from math import ceil

from sqlalchemy import String, and_, cast, func, or_

from app import db
from app.history.constants import (
    ALLOWED_RANGES,
    ALLOWED_SORTS,
    CATEGORY_ID_BY_KEY,
    CATEGORY_KEY_BY_ID,
    DEFAULT_PER_PAGE,
    FEATURE_SCHEMA,
    MAX_PER_PAGE,
)
from app.models import Category, Feedback, Prediction, PredictionProbability


# Parameter filter

@dataclass(frozen=True)
class HistoryFilters:
    """Kumpulan parameter yang sudah divalidasi dari query string."""

    q: str = ""
    category_id: int | None = None
    range_days: int = 0
    sort: str = "desc"
    page: int = 1
    per_page: int = DEFAULT_PER_PAGE

    @property
    def is_active(self) -> bool:
        """True bila ada filter yang mempersempit hasil."""
        return bool(self.q or self.category_id or self.range_days)


def _to_int(value, default: int, field: str) -> int:
    """Ubah teks menjadi integer atau lempar ValueError berpesan jelas."""
    if value is None or str(value).strip() == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValueError(f"Parameter {field} harus berupa angka.") from None


def parse_filters(args) -> HistoryFilters:
    """Validasi query string lalu bentuk HistoryFilters.

    Nilai yang tidak valid memunculkan ValueError dan route akan membalas 422.
    Untuk page dan per_page, angka di luar batas dirapikan otomatis.
    """
    q = (args.get("q") or "").strip()[:100]

    category_id = None
    category_key = (args.get("category") or "").strip().lower()
    if category_key:
        if category_key not in CATEGORY_ID_BY_KEY:
            raise ValueError("Kategori tidak dikenal.")
        category_id = CATEGORY_ID_BY_KEY[category_key]

    sort = (args.get("sort") or "desc").strip().lower()
    if sort not in ALLOWED_SORTS:
        raise ValueError("Urutan harus asc atau desc.")

    range_days = _to_int(args.get("range"), 0, "range")
    if range_days not in ALLOWED_RANGES:
        raise ValueError("Rentang harus 0, 7, atau 30 hari.")

    page = max(_to_int(args.get("page"), 1, "page"), 1)
    per_page = _to_int(args.get("per_page"), DEFAULT_PER_PAGE, "per_page")
    per_page = min(max(per_page, 1), MAX_PER_PAGE)

    return HistoryFilters(
        q=q,
        category_id=category_id,
        range_days=range_days,
        sort=sort,
        page=page,
        per_page=per_page,
    )


# Pembangun query

def _scoped_query(user_id: int, *entities):
    """Query dasar milik satu user.

    Prediction digabung dengan Category dan dengan baris probabilitas milik
    kategori yang terpilih. Baris probabilitas itu adalah nilai keyakinan model.
    Outer join dipakai agar riwayat tanpa data probabilitas tetap tampil.
    """
    return (
        db.session.query(*entities)
        .select_from(Prediction)
        .join(Category, Category.id_category == Prediction.id_category)
        .outerjoin(
            PredictionProbability,
            and_(
                PredictionProbability.id_prediction == Prediction.id_prediction,
                PredictionProbability.id_category == Prediction.id_category,
            ),
        )
        .filter(Prediction.id_user == user_id)
    )


def _apply_filters(query, filters: HistoryFilters, include_category: bool = True):
    """Tambahkan filter kategori, rentang waktu, dan pencarian ke query.

    include_category dimatikan saat menghitung jumlah per kategori agar angka
    pada setiap chip tetap menampilkan seluruh kategori.
    """
    if include_category and filters.category_id is not None:
        query = query.filter(Prediction.id_category == filters.category_id)

    if filters.range_days:
        since = datetime.now() - timedelta(days=filters.range_days)
        query = query.filter(Prediction.predicted_at >= since)

    if filters.q:
        # Pencarian cocok pada nama kategori atau teks tanggal berformat
        # yyyy-mm-dd hh:mm:ss. Karakter khusus LIKE di-escape otomatis.
        date_text = cast(Prediction.predicted_at, String(30))
        query = query.filter(
            or_(
                Category.nama_kategori.icontains(filters.q, autoescape=True),
                date_text.contains(filters.q, autoescape=True),
            )
        )
    return query


def _apply_order(query, sort: str):
    """Urutkan berdasarkan waktu lalu id sebagai pembeda.

    Pembeda id wajib ada karena beberapa riwayat bisa memiliki waktu yang
    sama persis, dan tanpa itu urutan antar halaman bisa saling tumpang tindih.
    """
    if sort == "asc":
        return query.order_by(Prediction.predicted_at.asc(), Prediction.id_prediction.asc())
    return query.order_by(Prediction.predicted_at.desc(), Prediction.id_prediction.desc())


# Serializer

def _pct(probability) -> float | None:
    """Ubah probabilitas 0 sampai 1 menjadi persen dengan dua desimal."""
    return None if probability is None else round(float(probability) * 100, 2)


def _num(value):
    """Ubah 56.0 menjadi 56 agar rapi dan biarkan nilai desimal apa adanya."""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def _option_label(feature: str, value) -> str | None:
    """Terjemahkan kode jawaban (misal 1) menjadi label (misal Laki-laki)."""
    if value is None:
        return None
    try:
        return FEATURE_SCHEMA[feature].get("options", {}).get(int(value))
    except (TypeError, ValueError):
        return None


def _feature_text(feature: str, value) -> str:
    """Teks siap tampil untuk satu fitur, lengkap dengan satuannya."""
    if value is None:
        return "-"
    label = _option_label(feature, value)
    if label:
        return label
    unit = FEATURE_SCHEMA[feature].get("unit")
    return f"{_num(value)} {unit}" if unit else str(_num(value))


def _serialize_category(category: Category) -> dict:
    return {
        "id": category.id_category,
        "key": CATEGORY_KEY_BY_ID.get(category.id_category, "unknown"),
        "name": category.nama_kategori,
    }


def serialize_item(prediction: Prediction, category: Category, probability) -> dict:
    """Bentuk ringkas satu riwayat untuk tabel dan kartu."""
    features = prediction.features or {}
    return {
        "id": prediction.id_prediction,
        "predicted_at": prediction.predicted_at.isoformat() if prediction.predicted_at else None,
        "age": _num(features.get("Age")),
        "gender": _option_label("Sex", features.get("Sex")),
        "height": _num(features.get("Height")),
        "activity": _option_label("Physical_Exercise", features.get("Physical_Exercise")),
        "category": _serialize_category(category),
        "confidence": _pct(probability),
    }


# Baca data

def list_history(user_id: int, filters: HistoryFilters) -> dict:
    """Daftar riwayat satu halaman beserta informasi pagination.

    Nomor halaman yang melebihi batas otomatis dibawa ke halaman terakhir.
    Hal ini berguna ketika item terakhir pada halaman terakhir baru saja dihapus.
    """
    query = _apply_filters(
        _scoped_query(user_id, Prediction, Category, PredictionProbability.probability),
        filters,
    )
    total = query.count()
    pages = max(ceil(total / filters.per_page), 1)
    page = min(filters.page, pages)

    rows = (
        _apply_order(query, filters.sort)
        .offset((page - 1) * filters.per_page)
        .limit(filters.per_page)
        .all()
    )

    return {
        "items": [serialize_item(p, c, prob) for p, c, prob in rows],
        "pagination": {
            "page": page,
            "per_page": filters.per_page,
            "total": total,
            "pages": pages,
        },
        "counts": count_by_category(user_id, filters),
    }


def _category_rows(user_id: int, filters: HistoryFilters, include_category: bool):
    """Jumlah riwayat per kategori dalam bentuk (id, nama, jumlah)."""
    query = _scoped_query(
        user_id,
        Category.id_category,
        Category.nama_kategori,
        func.count(Prediction.id_prediction),
    )
    return (
        _apply_filters(query, filters, include_category=include_category)
        .group_by(Category.id_category, Category.nama_kategori)
        .all()
    )


def count_by_category(user_id: int, filters: HistoryFilters) -> dict:
    """Jumlah per kategori untuk chip, dengan kunci all, under, normal, over, obese."""
    counts = {"all": 0, **{key: 0 for key in CATEGORY_ID_BY_KEY}}
    for category_id, _name, total in _category_rows(user_id, filters, include_category=False):
        key = CATEGORY_KEY_BY_ID.get(category_id)
        if key:
            counts[key] = total
            counts["all"] += total
    return counts


def get_stats(user_id: int, filters: HistoryFilters) -> dict:
    """Ringkasan statistik mengikuti filter yang sedang aktif."""
    total, avg_p, max_p, min_p = _apply_filters(
        _scoped_query(
            user_id,
            func.count(Prediction.id_prediction),
            func.avg(PredictionProbability.probability),
            func.max(PredictionProbability.probability),
            func.min(PredictionProbability.probability),
        ),
        filters,
    ).one()

    top_category = None
    rows = _category_rows(user_id, filters, include_category=True)
    if rows:
        # Jumlah terbanyak menang. Bila seri, id kategori terkecil dipilih.
        category_id, name, count = max(rows, key=lambda r: (r[2], -r[0]))
        top_category = {
            "key": CATEGORY_KEY_BY_ID.get(category_id, "unknown"),
            "name": name,
            "count": count,
        }

    return {
        "total": total,
        "avg_confidence": _pct(avg_p),
        "max_confidence": _pct(max_p),
        "min_confidence": _pct(min_p),
        "top_category": top_category,
    }


def get_detail(user_id: int, prediction_id: int) -> dict | None:
    """Detail lengkap satu riwayat, atau None bila tidak ada atau bukan milik user."""
    row = (
        _scoped_query(user_id, Prediction, Category, PredictionProbability.probability)
        .filter(Prediction.id_prediction == prediction_id)
        .first()
    )
    if row is None:
        return None

    prediction, category, probability = row
    item = serialize_item(prediction, category, probability)

    features = prediction.features or {}
    item["features"] = [
        {
            "key": key,
            "label": meta["label"],
            "value": _num(features.get(key)),
            "text": _feature_text(key, features.get(key)),
        }
        for key, meta in FEATURE_SCHEMA.items()
    ]

    probability_rows = (
        db.session.query(Category, PredictionProbability.probability)
        .join(PredictionProbability, PredictionProbability.id_category == Category.id_category)
        .filter(PredictionProbability.id_prediction == prediction_id)
        .order_by(Category.id_category)
        .all()
    )
    item["probabilities"] = [
        {**_serialize_category(c), "probability": _pct(p)} for c, p in probability_rows
    ]

    feedback = Feedback.query.filter_by(id_prediction=prediction_id).first()
    item["feedback"] = None if feedback is None else {"is_accurate": bool(feedback.is_accurate)}
    return item


# Hapus data

def delete_predictions(user_id: int, ids: list[int] | None = None) -> int:
    """Hapus riwayat milik user dan kembalikan jumlah yang terhapus.

    ids berisi daftar id yang ingin dihapus. Bila None, seluruh riwayat user
    dihapus. Id milik user lain otomatis diabaikan karena query dibatasi user_id.

    Tabel anak (probabilitas dan feedback) dihapus lebih dulu secara eksplisit.
    Cara ini tetap aman walau foreign key cascade pada database tidak aktif.
    Pemanggil bertanggung jawab melakukan rollback bila terjadi error.
    """
    id_query = db.session.query(Prediction.id_prediction).filter(Prediction.id_user == user_id)
    if ids is not None:
        id_query = id_query.filter(Prediction.id_prediction.in_(ids))

    target_ids = [row[0] for row in id_query.all()]
    if not target_ids:
        return 0

    for child in (PredictionProbability, Feedback):
        db.session.query(child).filter(child.id_prediction.in_(target_ids)).delete(
            synchronize_session=False
        )
    db.session.query(Prediction).filter(Prediction.id_prediction.in_(target_ids)).delete(
        synchronize_session=False
    )
    db.session.commit()
    return len(target_ids)


# Ekspor

CSV_HEADER = [
    "No",
    "Tanggal",
    "Usia",
    "Gender",
    "Tinggi (cm)",
    "Aktivitas",
    "Kategori",
    "Keyakinan (%)",
]


def build_csv(user_id: int, filters: HistoryFilters) -> str:
    """Buat isi CSV dari seluruh hasil filter tanpa pagination."""
    query = _apply_filters(
        _scoped_query(user_id, Prediction, Category, PredictionProbability.probability),
        filters,
    )
    rows = _apply_order(query, filters.sort).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_HEADER)
    for number, (prediction, category, probability) in enumerate(rows, start=1):
        item = serialize_item(prediction, category, probability)
        when = prediction.predicted_at.strftime("%Y-%m-%d %H:%M:%S") if prediction.predicted_at else ""
        writer.writerow(
            [
                number,
                when,
                item["age"] if item["age"] is not None else "",
                item["gender"] or "",
                item["height"] if item["height"] is not None else "",
                item["activity"] or "",
                category.nama_kategori,
                item["confidence"] if item["confidence"] is not None else "",
            ]
        )
    return buffer.getvalue()
