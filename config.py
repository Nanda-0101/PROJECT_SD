import os
from dotenv import load_dotenv

# Load file .env
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))


class Config:
    """Konfigurasi dasar aplikasi."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-secret-key')

    # Database URI
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'mysql+pymysql://root:@127.0.0.1:3306/sakit_learn'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,   # cek koneksi sebelum dipakai
        'pool_recycle': 280,     # recycle koneksi tiap ~4 menit
    }


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


# Mapping config berdasarkan nama environment
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig,
}