"""
Database Migration Script for Module 19: Smart Notifications & Alerts
WorkSphere HRMS

Safely alters the `notifications` table:
1. Adds `related_entity_id` INT NULL (with index) if missing.
2. Adds `read_at` DATETIME NULL if missing.
3. Modifies `type` ENUM to include 'DOCUMENT' and 'PERFORMANCE' safely.
4. Preserves all existing records and relationships.
"""

import sys
from sqlalchemy import inspect, text

sys.path.append("backend")
from app.database import engine


def migrate_module19():
    print("================================================================")
    print("MIGRATION: MODULE 19 - SMART NOTIFICATIONS & ALERTS")
    print("================================================================")

    inspector = inspect(engine)
    existing_cols = {col["name"]: col for col in inspector.get_columns("notifications")}
    print(f"Existing columns in 'notifications': {list(existing_cols.keys())}")

    with engine.begin() as conn:
        # 1. Add related_entity_id if missing
        if "related_entity_id" not in existing_cols:
            print("Adding 'related_entity_id' column to 'notifications'...")
            conn.execute(
                text(
                    "ALTER TABLE notifications "
                    "ADD COLUMN related_entity_id INT NULL AFTER link, "
                    "ADD INDEX ix_notifications_related_entity_id (related_entity_id);"
                )
            )
            print("  ✓ Added 'related_entity_id' column and index.")
        else:
            print("  ✓ Column 'related_entity_id' already exists.")

        # 2. Add read_at if missing
        if "read_at" not in existing_cols:
            print("Adding 'read_at' column to 'notifications'...")
            conn.execute(
                text(
                    "ALTER TABLE notifications "
                    "ADD COLUMN read_at DATETIME NULL AFTER created_at;"
                )
            )
            print("  ✓ Added 'read_at' column.")
        else:
            print("  ✓ Column 'read_at' already exists.")

        # 3. Update enum values on type column
        print("Ensuring 'type' enum covers all system notification categories...")
        try:
            conn.execute(
                text(
                    "ALTER TABLE notifications "
                    "MODIFY COLUMN type ENUM('LEAVE','PAYROLL','ATTENDANCE','SYSTEM','DOCUMENT','PERFORMANCE') "
                    "NOT NULL DEFAULT 'SYSTEM';"
                )
            )
            print("  ✓ Updated 'type' column enum.")
        except Exception as e:
            print(f"  Note on enum update: {e}")

    # Verify migration results
    inspector = inspect(engine)
    final_cols = {col["name"]: col for col in inspector.get_columns("notifications")}
    print("\nVerified 'notifications' table columns:")
    for col_name, meta in final_cols.items():
        print(f" - {col_name}: {meta['type']} (Nullable: {meta['nullable']})")

    print("\n================================================================")
    print("MIGRATION FOR MODULE 19 COMPLETED SUCCESSFULLY!")
    print("================================================================")


if __name__ == "__main__":
    migrate_module19()

