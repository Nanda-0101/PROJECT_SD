import os

from app import create_app, db
from app.models import (
    Category,
    Feedback,
    Prediction,
    PredictionProbability,
    User,
)

# Instance app dibuat di level modul agar `flask` CLI (flask shell, flask db, dsb.)
# tetap bisa menemukan aplikasi via auto-discovery: `app` atau `application`.
app = create_app()


@app.shell_context_processor
def make_shell_context():
    """Model & db tersedia otomatis di `flask shell`."""
    return {
        "db": db,
        "User": User,
        "Category": Category,
        "Prediction": Prediction,
        "PredictionProbability": PredictionProbability,
        "Feedback": Feedback,
    }


def main():
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1").lower() in ("1", "true", "yes")
    host = os.environ.get("HOST", "127.0.0.1")

    print(f"[run] Starting app on http://{host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    main()