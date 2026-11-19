from app import create_app, db

app = create_app()

with app.app_context():
    db.session.execute(db.text("SET FOREIGN_KEY_CHECKS=0"))
    for table in ("feedback", "prediction_probabilities", "predictions"):
        db.session.execute(db.text(f"DROP TABLE IF EXISTS {table}"))
    db.session.execute(db.text("SET FOREIGN_KEY_CHECKS=1"))
    db.session.commit()

    db.create_all()
    print("Tabel berhasil dibuat ulang sesuai models.py")