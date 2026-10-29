"""
Database migration script for Module 21: Employee Onboarding System
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
        # Create onboarding_tasks table if not exists
        print("Creating 'onboarding_tasks' table if not exists...")
        create_onboarding_sql = """
        CREATE TABLE IF NOT EXISTS onboarding_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            task_name VARCHAR(255) NOT NULL,
            status ENUM('PENDING', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
            due_date DATE NOT NULL,
            completed_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_onboarding_emp (employee_id),
            INDEX idx_onboarding_status (status),
            INDEX idx_onboarding_due (due_date),
            CONSTRAINT fk_onboarding_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        cursor.execute(create_onboarding_sql)
        conn.commit()
        print("✓ 'onboarding_tasks' table created/verified successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Error migrating database for Module 21: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    migrate()

