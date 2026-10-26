from app import create_app, db
from app.models import (
    User, Category, Gender, ActivityLevel, Prediction,
    PredictionProbability, Feedback
)

app = create_app()

# Shell context agar bisa akses model di `flask shell`
@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'User': User,
        'Category': Category,
        'Gender': Gender,
        'ActivityLevel': ActivityLevel,
        'Prediction': Prediction,
        'PredictionProbability': PredictionProbability,
        'Feedback': Feedback,
    }


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)