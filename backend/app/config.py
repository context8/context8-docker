import os

API_KEY_SECRET = os.environ.get("API_KEY_SECRET", "change_me")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM = os.environ.get("RESEND_FROM", "noreply@context8.com")
JWT_SECRET = os.environ.get("JWT_SECRET", "change_me")
JWT_ALG = "HS256"
EMAIL_VERIFICATION_ENABLED = os.environ.get("EMAIL_VERIFICATION_ENABLED", "false").lower() in ("1", "true", "yes")
