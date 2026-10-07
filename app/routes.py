from flask import render_template
from app import app

@app.route('/')
def home():
    # Mengarahkan halaman utama untuk membaca file HTML di dalam folder templates
    return render_template('index.html')
