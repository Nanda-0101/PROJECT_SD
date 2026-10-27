import os
from datetime import timedelta
from flask import Flask, session
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from config import config

# Inisialisasi ekstensi secara global (tanpa app)
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "default")

    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Konfigurasi keamanan session
    app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
    app.config.setdefault("SESSION_COOKIE_SAMESITE", "Lax")
    app.config.setdefault("PERMANENT_SESSION_LIFETIME", timedelta(days=7))

    # Inisialisasi ekstensi dengan app
    db.init_app(app)
    migrate.init_app(app, db)

    # Import models agar terdeteksi oleh SQLAlchemy & Flask-Migrate
    from app import models  # noqa: F401
    from app.models import User

    # Registrasi Blueprints di dalam application factory
    from app.routes import main_bp
    from app.ml_routes import ml_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(ml_bp)

    # Context processor untuk injeksi user yang sedang login
    @app.context_processor
    def inject_current_user():
        user_id = session.get("user_id")
        if not user_id:
            return {"current_user": None}
        return {"current_user": db.session.get(User, user_id)}

    return app