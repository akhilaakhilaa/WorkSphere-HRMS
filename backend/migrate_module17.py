"""
Database migration script for Module 17: Performance Management System
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
        # Create performance_reviews table
        print("Creating 'performance_reviews' table if not exists...")
        create_performance_sql = """
        CREATE TABLE IF NOT EXISTS performance_reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            reviewer_id INT NULL,
            review_period VARCHAR(50) NOT NULL,
            rating INT NOT NULL,
            feedback TEXT NOT NULL,
            goals TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_perf_emp (employee_id),
            INDEX idx_perf_reviewer (reviewer_id),
            INDEX idx_perf_period (review_period),
            INDEX idx_perf_rating (rating),
            UNIQUE KEY uq_employee_review_period (employee_id, review_period),
            CONSTRAINT fk_perf_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            CONSTRAINT fk_perf_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        cursor.execute(create_performance_sql)
        conn.commit()

        # Check if 'goals' column exists, add if missing
        cursor.execute("SHOW COLUMNS FROM performance_reviews LIKE 'goals';")
        if not cursor.fetchone():
            print("Adding missing 'goals' column to 'performance_reviews'...")
            cursor.execute("ALTER TABLE performance_reviews ADD COLUMN goals TEXT NULL AFTER feedback;")
            conn.commit()
            print("✓ 'goals' column added.")

        print("✓ 'performance_reviews' table created/verified successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    migrate()
