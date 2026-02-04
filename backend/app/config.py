import os

API_KEY_SECRET = os.environ.get("API_KEY_SECRET", "change_me")
JWT_SECRET = os.environ.get("JWT_SECRET", "change_me")
JWT_ALG = "HS256"
