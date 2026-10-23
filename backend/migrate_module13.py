"""
WorkSphere HRMS - Module 13 Database Migration
Adds `username` column to `users` table with unique constraint.
Safely backfills `username` for existing users from email prefix.
Preserves all existing data, passwords, roles, and relationships.
"""

from sqlalchemy import text
from app.database import engine

def migrate():
    print("Running Module 13 migration for Users table...")
    with engine.connect() as conn:
        # Check existing columns in users
        existing_cols = [
            row[0] for row in conn.execute(text("DESCRIBE users")).fetchall()
        ]
        print(f"Existing columns in users: {existing_cols}")

        if "username" not in existing_cols:
            print("Adding column 'username' to users table...")
            conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(100) NULL AFTER id"))
            conn.commit()
            print("✓ Column 'username' added.")
        else:
            print("Column 'username' already exists.")

        # Backfill username from email prefix for rows where username is NULL or empty
        print("Backfilling usernames for existing users...")
        conn.execute(text("""
            UPDATE users 
            SET username = LOWER(SUBSTRING_INDEX(email, '@', 1))
            WHERE username IS NULL OR username = ''
        """))
        conn.commit()
        print("✓ Usernames backfilled.")

        # Ensure NOT NULL
        conn.execute(text("ALTER TABLE users MODIFY COLUMN username VARCHAR(100) NOT NULL"))
        conn.commit()

        # Check existing indexes on users
        existing_indexes = [
            row[2] for row in conn.execute(text("SHOW INDEX FROM users")).fetchall()
        ]
        if "uq_users_username" not in existing_indexes and "username" not in existing_indexes:
            print("Adding unique index on username...")
            conn.execute(text("ALTER TABLE users ADD UNIQUE INDEX uq_users_username (username)"))
            conn.commit()
            print("✓ Unique index 'uq_users_username' created.")
        else:
            print("Unique index on username already exists.")

        # Verification
        users = conn.execute(text("SELECT id, username, email, role, is_active FROM users")).fetchall()
        print(f"Migration verification: {len(users)} users in database:")
        for u in users:
            print(f"  ID={u[0]}: username='{u[1]}', email='{u[2]}', role='{u[3]}', active={u[4]}")

if __name__ == "__main__":
    migrate()

