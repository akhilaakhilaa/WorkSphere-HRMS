"""
Database migration script for Module 23: Internal Announcements System
WorkSphere HRMS
"""

import sys
import pymysql

DB_CONFIG = {
    "host": "localhost",
    "port": 3306,
    "user": "worksphere_app",
    "password": "WorkSphere2026_App",
    "database": "worksphere_db",
}


def migrate():
    print("Connecting to MySQL worksphere_db...")
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:
        print("Creating 'announcements' table if not exists...")
        create_announcements_sql = """
        CREATE TABLE IF NOT EXISTS announcements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            created_by INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_announcement_creator (created_by),
            INDEX idx_announcement_created (created_at),
            CONSTRAINT fk_announcement_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        cursor.execute(create_announcements_sql)
        conn.commit()
        print("✓ 'announcements' table created/verified successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Error migrating database for Module 23: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    migrate()

