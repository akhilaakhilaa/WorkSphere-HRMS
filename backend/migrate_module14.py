"""
WorkSphere HRMS - Module 14 Database Migration
Creates `shifts` and `employee_shifts` tables.
Adds shift and lateness/early departure columns to `attendances` table.
Seeds standard organization shifts (Morning, Evening, Night).
Preserves all existing data, attendance records, and relationships.
"""

from sqlalchemy import text
from app.database import engine

def migrate():
    print("Running Module 14 migration for Shifts and Attendance...")
    with engine.connect() as conn:
        tables = [row[0] for row in conn.execute(text("SHOW TABLES")).fetchall()]

        # 1. Create `shifts` table
        if "shifts" not in tables:
            print("Creating `shifts` table...")
            conn.execute(text("""
                CREATE TABLE shifts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    start_time TIME NOT NULL,
                    end_time TIME NOT NULL,
                    description TEXT NULL,
                    grace_period_minutes INT NOT NULL DEFAULT 15,
                    is_overnight TINYINT(1) NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_shifts_name (name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """))
            conn.commit()
            print("✓ `shifts` table created.")
        else:
            print("`shifts` table already exists.")

        # 2. Seed standard shifts if not present
        existing_shifts = [row[0] for row in conn.execute(text("SELECT name FROM shifts")).fetchall()]
        seed_shifts = [
            ("Morning Shift", "09:00:00", "17:00:00", "Standard morning business shift (9 AM - 5 PM)", 15, 0),
            ("Evening Shift", "14:00:00", "22:00:00", "Afternoon and evening shift (2 PM - 10 PM)", 15, 0),
            ("Night Shift", "22:00:00", "06:00:00", "Overnight night shift (10 PM - 6 AM next day)", 15, 1),
        ]
        for name, start_t, end_t, desc, grace, overnight in seed_shifts:
            if name not in existing_shifts:
                print(f"Seeding shift: {name}...")
                conn.execute(text("""
                    INSERT INTO shifts (name, start_time, end_time, description, grace_period_minutes, is_overnight)
                    VALUES (:name, :start_time, :end_time, :description, :grace, :overnight)
                """), {
                    "name": name,
                    "start_time": start_t,
                    "end_time": end_t,
                    "description": desc,
                    "grace": grace,
                    "overnight": overnight,
                })
                conn.commit()
                print(f"✓ Seeded {name}.")

        # 3. Create `employee_shifts` table
        if "employee_shifts" not in tables:
            print("Creating `employee_shifts` table...")
            conn.execute(text("""
                CREATE TABLE employee_shifts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    employee_id INT NOT NULL,
                    shift_id INT NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NULL,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_emp_shifts_emp (employee_id),
                    INDEX idx_emp_shifts_shift (shift_id),
                    INDEX idx_emp_shifts_active (is_active),
                    CONSTRAINT fk_emp_shifts_emp FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
                    CONSTRAINT fk_emp_shifts_shift FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """))
            conn.commit()
            print("✓ `employee_shifts` table created.")
        else:
            print("`employee_shifts` table already exists.")

        # 4. Add shift columns to `attendances` table
        att_cols = [row[0] for row in conn.execute(text("DESCRIBE attendances")).fetchall()]
        columns_to_add = [
            ("shift_id", "INT NULL AFTER employee_id"),
            ("is_late", "TINYINT(1) NOT NULL DEFAULT 0 AFTER status"),
            ("late_minutes", "INT NOT NULL DEFAULT 0 AFTER is_late"),
            ("is_early_departure", "TINYINT(1) NOT NULL DEFAULT 0 AFTER late_minutes"),
            ("early_departure_minutes", "INT NOT NULL DEFAULT 0 AFTER is_early_departure"),
        ]

        for col_name, col_def in columns_to_add:
            if col_name not in att_cols:
                print(f"Adding column '{col_name}' to `attendances`...")
                conn.execute(text(f"ALTER TABLE attendances ADD COLUMN {col_name} {col_def}"))
                conn.commit()
                print(f"✓ Column '{col_name}' added.")
            else:
                print(f"Column '{col_name}' already exists in `attendances`.")

        # Check foreign key for shift_id on attendances
        fk_check = conn.execute(text("""
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'attendances' AND COLUMN_NAME = 'shift_id' AND REFERENCED_TABLE_NAME = 'shifts'
        """)).fetchall()
        if not fk_check:
            print("Adding foreign key constraint for attendances.shift_id...")
            try:
                conn.execute(text("""
                    ALTER TABLE attendances 
                    ADD CONSTRAINT fk_attendances_shift 
                    FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE SET NULL
                """))
                conn.commit()
                print("✓ Foreign key constraint added.")
            except Exception as e:
                print(f"Note on foreign key: {e}")

        # Verification
        shifts_count = conn.execute(text("SELECT COUNT(*) FROM shifts")).scalar()
        emp_shifts_count = conn.execute(text("SELECT COUNT(*) FROM employee_shifts")).scalar()
        print(f"Migration completed successfully! Total shifts: {shifts_count}, Active assignments: {emp_shifts_count}")

if __name__ == "__main__":
    migrate()

