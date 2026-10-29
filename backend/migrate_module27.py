"""
Database migration script for Module 27: Profile & Settings Management
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
        print("Creating 'user_notification_preferences' table if not exists...")
        create_pref_sql = """
        CREATE TABLE IF NOT EXISTS user_notification_preferences (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            notify_leaves BOOLEAN NOT NULL DEFAULT TRUE,
            notify_attendance BOOLEAN NOT NULL DEFAULT TRUE,
            notify_tasks BOOLEAN NOT NULL DEFAULT TRUE,
            notify_announcements BOOLEAN NOT NULL DEFAULT TRUE,
            notify_payroll BOOLEAN NOT NULL DEFAULT TRUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_pref_user (user_id),
            CONSTRAINT fk_pref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        cursor.execute(create_pref_sql)
        conn.commit()
        print("✓ 'user_notification_preferences' table created/verified successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Error migrating database for Module 27: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    migrate()

