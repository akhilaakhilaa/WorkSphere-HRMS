import os
from pathlib import Path
from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_FILE, override=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://worksphere_app:WorkSphere2026_App@localhost:3306/worksphere_db",
)
SECRET_KEY = os.getenv(
    "SECRET_KEY", "worksphere_hrms_super_secret_jwt_key_2026_secure_random_string_xyz"
)
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

