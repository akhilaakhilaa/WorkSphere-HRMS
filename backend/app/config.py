import os
from datetime import date
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

# Standard daily work hours threshold for overtime calculation
STANDARD_WORK_HOURS = 8.0

# Automatic absent-marking scheduler configuration (set to False for live commits after test verification)
AUTO_ABSENT_DRY_RUN = os.getenv("AUTO_ABSENT_DRY_RUN", "false").lower() in ("true", "1")

# Default public holidays (YYYY-MM-DD)
DEFAULT_PUBLIC_HOLIDAYS = [
    "2026-01-01",  # New Year's Day
    "2026-01-26",  # Republic Day
    "2026-05-01",  # Labor Day
    "2026-08-15",  # Independence Day
    "2026-10-02",  # Gandhi Jayanti
    "2026-12-25",  # Christmas Day
]


def parse_public_holidays(raw: str | None = None) -> set[date]:
    """Parse comma-separated ISO date strings into a set of date objects."""
    val = raw if raw is not None else os.getenv("PUBLIC_HOLIDAYS")
    holidays: set[date] = set()
    if val:
        for item in val.split(","):
            item = item.strip()
            if item:
                try:
                    holidays.add(date.fromisoformat(item))
                except ValueError:
                    pass
    else:
        for item in DEFAULT_PUBLIC_HOLIDAYS:
            try:
                holidays.add(date.fromisoformat(item))
            except ValueError:
                pass
    return holidays


PUBLIC_HOLIDAYS = parse_public_holidays()


