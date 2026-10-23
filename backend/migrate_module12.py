"""
WorkSphere HRMS - Module 12 Database Migration
Adds detailed salary breakdown columns to `payrolls` table:
- hra (Decimal)
- transport_allowance (Decimal)
- medical_allowance (Decimal)
- gross_salary (Decimal)
- provident_fund (Decimal)

Safely backfills `gross_salary = base_salary + allowances + bonuses` for existing records.
Preserves all existing data and constraints.
"""

from sqlalchemy import text
from app.database import engine

def migrate():
    print("Running Module 12 migration for Payrolls table...")
    with engine.connect() as conn:
        # Check existing columns in payrolls
        existing_cols = [
            row[0] for row in conn.execute(text("DESCRIBE payrolls")).fetchall()
        ]
        print(f"Existing columns in payrolls: {existing_cols}")

        columns_to_add = [
            ("hra", "DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER base_salary"),
            ("transport_allowance", "DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER hra"),
            ("medical_allowance", "DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER transport_allowance"),
            ("gross_salary", "DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER bonuses"),
            ("provident_fund", "DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER gross_salary"),
        ]

        for col_name, col_def in columns_to_add:
            if col_name not in existing_cols:
                print(f"Adding column '{col_name}'...")
                conn.execute(text(f"ALTER TABLE payrolls ADD COLUMN {col_name} {col_def}"))
                conn.commit()
                print(f"✓ Column '{col_name}' added successfully.")
            else:
                print(f"Column '{col_name}' already exists. Skipping.")

        # Backfill gross_salary for existing rows where gross_salary == 0
        print("Backfilling gross_salary for existing records...")
        conn.execute(text("""
            UPDATE payrolls 
            SET gross_salary = base_salary + allowances + bonuses 
            WHERE gross_salary = 0.00 OR gross_salary IS NULL
        """))
        conn.commit()
        print("✓ Backfill completed successfully.")

        # Verify
        result = conn.execute(text("SELECT COUNT(*), SUM(gross_salary), SUM(net_salary) FROM payrolls")).fetchone()
        print(f"Migration verification: {result[0]} payroll records found. Total gross: {result[1]}, Total net: {result[2]}")

if __name__ == "__main__":
    migrate()

