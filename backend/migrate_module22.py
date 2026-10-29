"""
Database migration script for Module 22: Resignation & Exit Management
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
        # Create resignations table if not exists
        print("Creating 'resignations' table if not exists...")
        create_resignations_sql = """
        CREATE TABLE IF NOT EXISTS resignations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            reason TEXT NOT NULL,
            notice_period INT NOT NULL,
            status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
            last_working_day DATE NULL,
            reviewed_by INT NULL,
            reviewed_at DATETIME NULL,
            reviewer_comments TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_resignation_emp (employee_id),
            INDEX idx_resignation_status (status),
            INDEX idx_resignation_created (created_at),
            CONSTRAINT fk_resignation_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            CONSTRAINT fk_resignation_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        cursor.execute(create_resignations_sql)
        conn.commit()
        print("✓ 'resignations' table created/verified successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Error migrating database for Module 22: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    migrate()

