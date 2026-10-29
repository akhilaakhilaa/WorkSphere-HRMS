"""
Database migration script for Module 26: Employee Feedback System
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
        print("Creating 'feedback' table if not exists...")
        create_feedback_sql = """
        CREATE TABLE IF NOT EXISTS feedback (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            message TEXT NOT NULL,
            rating INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_feedback_employee (employee_id),
            INDEX idx_feedback_rating (rating),
            INDEX idx_feedback_created (created_at),
            CONSTRAINT fk_feedback_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        cursor.execute(create_feedback_sql)
        conn.commit()
        print("✓ 'feedback' table created/verified successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Error migrating database for Module 26: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    migrate()

