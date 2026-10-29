"""
Database migration script for Module 24: Task Assignment & Tracking
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
        print("Creating 'tasks' table if not exists...")
        create_tasks_sql = """
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            assigned_to INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            due_date DATE NOT NULL,
            status ENUM('PENDING', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
            completed_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_task_assigned_to (assigned_to),
            INDEX idx_task_status (status),
            INDEX idx_task_due_date (due_date),
            INDEX idx_task_created (created_at),
            CONSTRAINT fk_task_employee FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        cursor.execute(create_tasks_sql)
        conn.commit()
        print("✓ 'tasks' table created/verified successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Error migrating database for Module 24: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    migrate()

