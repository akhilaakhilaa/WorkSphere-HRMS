
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine

try:
    with engine.connect() as connection:
        version = connection.execute(
            text("SELECT VERSION()")
        ).scalar()

        print("MySQL connection successful!")
        print("MySQL version:", version)

except SQLAlchemyError as error:
    print("MySQL connection failed.")
    print("Error type:", type(error).__name__)
    print("Error details:", error)
