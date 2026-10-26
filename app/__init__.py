import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import timedelta
from config import config

db = SQLAlchemy()
migrate = Migrate()


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "default")

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Session cookie: hanya dikirim lewat HTTP (matikan saat dev pakai http)
    app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
    app.config.setdefault("SESSION_COOKIE_SAMESITE", "Lax")
    app.config.setdefault("PERMANENT_SESSION_LIFETIME", timedelta(days=7))

    db.init_app(app)
    migrate.init_app(app, db)

    from app import models  # noqa: F401

    # Blueprint halaman (HTML)
    from app.routes import main_bp
    app.register_blueprint(main_bp)

    # Blueprint API autentikasi (JSON)
    from app.auth import auth_api_bp
    from app.auth import api as auth_api_module  # noqa: F401 (agar route terdaftar)
    app.register_blueprint(auth_api_bp)

    return app