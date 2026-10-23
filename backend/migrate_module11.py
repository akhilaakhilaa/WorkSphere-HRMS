"""
Safe database migration script for Module 11: Leave Policies & Balances.
Creates the `leave_policies` and `leave_balances` tables and initializes defaults.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.database import Base, SessionLocal, engine
from app.models.leave import LeaveBalance, LeavePolicy
from app.leave_policy_service import ensure_default_policies, init_all_active_employees_balances


def migrate():
    print("=" * 60)
    print("MIGRATING MODULE 11: LEAVE POLICIES & BALANCES")
    print("=" * 60)

    # 1. Create tables if not existing
    print("Creating tables 'leave_policies' and 'leave_balances' if not existing...")
    Base.metadata.create_all(bind=engine)
    print("  ✓ Tables created successfully.")

    # 2. Seed default policies
    db = SessionLocal()
    try:
        policies = ensure_default_policies(db)
        print(f"  ✓ {len(policies)} leave policies configured:")
        for p in policies:
            print(f"      - {p.leave_type.value}: {p.total_days_allowed} days allowed")

        # 3. Initialize balances for all active employees
        created = init_all_active_employees_balances(db)
        print(f"  ✓ Initialized {created} employee leave balance records.")

    finally:
        db.close()

    print("=" * 60)
    print("MODULE 11 MIGRATION COMPLETED SUCCESSFULLY")
    print("=" * 60)


if __name__ == "__main__":
    migrate()

