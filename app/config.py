# app/config.py
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Config:
    # Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

    # Database — fleksibel: bisa via DATABASE_URL atau komponen DB_*
    _db_url = os.environ.get("DATABASE_URL")
    if _db_url:
        SQLALCHEMY_DATABASE_URI = _db_url
    else:
        _u = os.environ.get("DB_USER", "root")
        _p = os.environ.get("DB_PASSWORD", "")
        _h = os.environ.get("DB_HOST", "127.0.0.1")
        _port = os.environ.get("DB_PORT", "3306")
        _n = os.environ.get("DB_NAME", "sakit_learn")
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{_u}:{_p}@{_h}:{_port}/{_n}?charset=utf8mb4"
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }

    # Hugging Face
    HF_MODEL_REPO = os.environ.get("HF_MODEL_REPO", "nanda010101/sakit-learn-models")
    HF_TOKEN = os.environ.get("HF_TOKEN")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


# Dict yang dipakai oleh create_app()
config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}