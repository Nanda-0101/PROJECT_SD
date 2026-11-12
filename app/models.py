# app/models.py
from werkzeug.security import generate_password_hash, check_password_hash

from app import db


class User(db.Model):
    __tablename__ = "users"

    id_user = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nama_lengkap = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    predictions = db.relationship(
        "Prediction", back_populates="user",
        cascade="all, delete-orphan", lazy="dynamic",
    )

    def set_password(self, raw_password: str) -> None:
        self.password = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        # Kompatibel dengan data lama plaintext (mis. "123") maupun hash baru
        if self.password.startswith(("pbkdf2:", "scrypt:", "argon2")):
            return check_password_hash(self.password, raw_password)
        return self.password == raw_password

    def __repr__(self) -> str:
        return f"<User {self.username}>"


class Category(db.Model):
    __tablename__ = "categories"

    id_category = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nama_kategori = db.Column(db.String(50), unique=True, nullable=False)
    encoding_value = db.Column(db.Integer, nullable=False)  # 0..3

    predictions = db.relationship("Prediction", back_populates="category")
    probabilities = db.relationship("PredictionProbability", back_populates="category")

    def __repr__(self) -> str:
        return f"<Category {self.nama_kategori}>"


class Prediction(db.Model):
    __tablename__ = "predictions"

    id_prediction = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_user = db.Column(
        db.Integer,
        db.ForeignKey("users.id_user", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    id_category = db.Column(
        db.Integer,
        db.ForeignKey("categories.id_category", onupdate="CASCADE"),
        nullable=False,
    )
    features = db.Column(db.JSON, nullable=False)  # 14 fitur mentah
    predicted_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    user = db.relationship("User", back_populates="predictions")
    category = db.relationship("Category", back_populates="predictions")
    probabilities = db.relationship(
        "PredictionProbability", back_populates="prediction",
        cascade="all, delete-orphan", lazy="dynamic",
    )
    feedback = db.relationship(
        "Feedback", back_populates="prediction",
        uselist=False, cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Prediction {self.id_prediction} cat={self.id_category}>"


class PredictionProbability(db.Model):
    __tablename__ = "prediction_probabilities"

    id_probability = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_prediction = db.Column(
        db.Integer,
        db.ForeignKey("predictions.id_prediction", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    id_category = db.Column(
        db.Integer,
        db.ForeignKey("categories.id_category", onupdate="CASCADE"),
        nullable=False,
    )
    probability = db.Column(db.Float, nullable=False)

    prediction = db.relationship("Prediction", back_populates="probabilities")
    category = db.relationship("Category", back_populates="probabilities")

    def __repr__(self) -> str:
        return f"<Prob pred={self.id_prediction} cat={self.id_category} val={self.probability}>"


class Feedback(db.Model):
    __tablename__ = "feedback"

    id_feedback = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_prediction = db.Column(
        db.Integer,
        db.ForeignKey("predictions.id_prediction", ondelete="CASCADE", onupdate="CASCADE"),
        unique=True, nullable=False,
    )
    is_accurate = db.Column(db.Boolean, nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    prediction = db.relationship("Prediction", back_populates="feedback")

    def __repr__(self) -> str:
        return f"<Feedback {self.id_feedback} accurate={self.is_accurate}>"