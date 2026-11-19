# app/__init__.py
import os
from datetime import timedelta

from flask import Flask, session
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

from app.config import config

# Ekstensi global (tanpa app)
db = SQLAlchemy()
migrate = Migrate()


def create_app(config_name: str | None = None) -> Flask:
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "default")

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Keamanan session
    app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
    app.config.setdefault("SESSION_COOKIE_SAMESITE", "Lax")
    app.config.setdefault("PERMANENT_SESSION_LIFETIME", timedelta(days=7))

    db.init_app(app)
    migrate.init_app(app, db)

    # Import models agar terdeteksi oleh Flask-Migrate
    from app import models  # noqa: F401
    from app.models import User

    # Model ML dimuat lazy saat pertama kali dipakai di app.ml_model
    from app import ml_model  # noqa: F401

    # Registrasi Blueprint
    from app.routes import main_bp  # kalau ada
    from app.ml_routes import ml_bp
    from app.history import history_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(ml_bp)
    app.register_blueprint(history_bp)

    # Context processor user
    @app.context_processor
    def inject_current_user():
        uid = session.get("user_id")
        return {"current_user": db.session.get(User, uid) if uid else None}

    return app