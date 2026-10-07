from flask import Flask

# Menginisialisasi aplikasi Flask
app = Flask(__name__)

# Mengimpor rute dari file routes.py
from app import routes
