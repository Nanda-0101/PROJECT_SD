from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app import db


# Tabel: users
class User(db.Model):
    __tablename__ = 'users'

    id_user = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nama_lengkap = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    # Relasi
    predictions = db.relationship(
        'Prediction', back_populates='user',
        cascade='all, delete-orphan', lazy='dynamic'
    )

    # --- Helper password ---
    def set_password(self, raw_password):
        self.password = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        # kompatibel dengan data lama (plaintext "123") maupun hash
        if self.password.startswith(('pbkdf2:', 'scrypt:', 'argon2')):
            return check_password_hash(self.password, raw_password)
        return self.password == raw_password

    def __repr__(self):
        return f'<User {self.username}>'


# Tabel: categories
class Category(db.Model):
    __tablename__ = 'categories'

    id_category = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nama_kategori = db.Column(db.String(50), unique=True, nullable=False)
    encoding_value = db.Column(db.Integer, nullable=False)

    predictions = db.relationship('Prediction', back_populates='category')
    probabilities = db.relationship('PredictionProbability', back_populates='category')

    def __repr__(self):
        return f'<Category {self.nama_kategori}>'


# Tabel: genders
class Gender(db.Model):
    __tablename__ = 'genders'

    id_gender = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nama_gender = db.Column(db.String(20), unique=True, nullable=False)
    encoding_value = db.Column(db.Integer, nullable=False)

    predictions = db.relationship('Prediction', back_populates='gender')

    def __repr__(self):
        return f'<Gender {self.nama_gender}>'


# Tabel: activity_levels
class ActivityLevel(db.Model):
    __tablename__ = 'activity_levels'

    id_activity = db.Column(db.Integer, primary_key=True, autoincrement=True)
    level = db.Column(db.Integer, unique=True, nullable=False)
    deskripsi = db.Column(db.String(100))
    encoding_value = db.Column(db.Integer, nullable=False)

    predictions = db.relationship('Prediction', back_populates='activity')

    def __repr__(self):
        return f'<ActivityLevel {self.level}>'


# Tabel: predictions
class Prediction(db.Model):
    __tablename__ = 'predictions'

    id_prediction = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_user = db.Column(db.Integer, db.ForeignKey('users.id_user', ondelete='CASCADE', onupdate='CASCADE'), nullable=False)
    id_category = db.Column(db.Integer, db.ForeignKey('categories.id_category', onupdate='CASCADE'), nullable=False)
    id_gender = db.Column(db.Integer, db.ForeignKey('genders.id_gender', onupdate='CASCADE'), nullable=False)
    id_activity = db.Column(db.Integer, db.ForeignKey('activity_levels.id_activity', onupdate='CASCADE'), nullable=False)

    age = db.Column(db.Integer, nullable=False)
    height = db.Column(db.Float, nullable=False)
    weight = db.Column(db.Float, nullable=False)
    predicted_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    # Relasi
    user = db.relationship('User', back_populates='predictions')
    category = db.relationship('Category', back_populates='predictions')
    gender = db.relationship('Gender', back_populates='predictions')
    activity = db.relationship('ActivityLevel', back_populates='predictions')

    probabilities = db.relationship(
        'PredictionProbability', back_populates='prediction',
        cascade='all, delete-orphan', lazy='dynamic'
    )
    feedback = db.relationship(
        'Feedback', back_populates='prediction',
        uselist=False, cascade='all, delete-orphan'
    )

    def __repr__(self):
        return f'<Prediction {self.id_prediction}>'


# Tabel: prediction_probabilities
class PredictionProbability(db.Model):
    __tablename__ = 'prediction_probabilities'

    id_probability = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_prediction = db.Column(db.Integer, db.ForeignKey('predictions.id_prediction', ondelete='CASCADE', onupdate='CASCADE'), nullable=False)
    id_category = db.Column(db.Integer, db.ForeignKey('categories.id_category', onupdate='CASCADE'), nullable=False)
    probability = db.Column(db.Float, nullable=False)

    prediction = db.relationship('Prediction', back_populates='probabilities')
    category = db.relationship('Category', back_populates='probabilities')

    def __repr__(self):
        return f'<Prob pred={self.id_prediction} cat={self.id_category} val={self.probability}>'


# Tabel: feedback
class Feedback(db.Model):
    __tablename__ = 'feedback'

    id_feedback = db.Column(db.Integer, primary_key=True, autoincrement=True)
    id_prediction = db.Column(db.Integer, db.ForeignKey('predictions.id_prediction', ondelete='CASCADE', onupdate='CASCADE'), unique=True, nullable=False)
    is_accurate = db.Column(db.Boolean, nullable=False)
    created_at = db.Column(db.TIMESTAMP, server_default=db.func.current_timestamp())

    prediction = db.relationship('Prediction', back_populates='feedback')

    def __repr__(self):
        return f'<Feedback {self.id_feedback} accurate={self.is_accurate}>'