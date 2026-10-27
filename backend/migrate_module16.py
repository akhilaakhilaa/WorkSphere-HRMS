"""
Database migration script for Module 16: Document Management System
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
        # Create documents table
        print("Creating 'documents' table if not exists...")
        create_documents_sql = """
        CREATE TABLE IF NOT EXISTS documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_url VARCHAR(500) NOT NULL,
            uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            original_file_name VARCHAR(255) NOT NULL,
            document_type VARCHAR(50) NOT NULL DEFAULT 'OTHER',
            file_size INT NOT NULL DEFAULT 0,
            content_type VARCHAR(100) NOT NULL,
            uploaded_by INT NULL,
            description VARCHAR(500) NULL,
            INDEX idx_doc_emp (employee_id),
            INDEX idx_doc_type (document_type),
            INDEX idx_doc_uploaded_at (uploaded_at),
            CONSTRAINT fk_doc_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            CONSTRAINT fk_doc_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        cursor.execute(create_documents_sql)
        conn.commit()
        print("✓ 'documents' table created/verified successfully.")

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    migrate()

