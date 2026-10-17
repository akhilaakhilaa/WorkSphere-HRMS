from datetime import date, datetime, timedelta
from decimal import Decimal

from app.database import SessionLocal
from app.models.employee import Employee
from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.payroll import PaymentMethod, PaymentStatus, Payroll
from app.models.user import User


def seed_batch2():
    db = SessionLocal()
    try:
        print("Checking Batch 2 sample data...")
        admin = db.query(User).filter(User.email == "admin@worksphere.com").first()
        alex = db.query(Employee).filter(Employee.full_name == "Alex Mercer").first()
        michael = db.query(Employee).filter(Employee.full_name == "Michael Scott").first()
        pam = db.query(Employee).filter(Employee.full_name == "Pam Beesly").first()

        # Seed Leaves if none exist
        if db.query(Leave).count() == 0 and alex:
            today = date.today()

            # Past approved sick leave for Alex
            db.add(
                Leave(
                    employee_id=alex.id,
                    leave_type=LeaveType.SICK,
                    start_date=today - timedelta(days=12),
                    end_date=today - timedelta(days=11),
                    total_days=2,
                    reason="Seasonal flu and doctor appointment",
                    status=LeaveStatus.APPROVED,
                    admin_remarks="Approved. Get well soon!",
                    reviewed_by=admin.id if admin else None,
                    reviewed_at=datetime.now() - timedelta(days=12),
                )
            )

            # Pending casual leave for Alex
            db.add(
                Leave(
                    employee_id=alex.id,
                    leave_type=LeaveType.CASUAL,
                    start_date=today + timedelta(days=5),
                    end_date=today + timedelta(days=6),
                    total_days=2,
                    reason="Attending family function",
                    status=LeaveStatus.PENDING,
                )
            )

            if michael:
                db.add(
                    Leave(
                        employee_id=michael.id,
                        leave_type=LeaveType.ANNUAL,
                        start_date=today - timedelta(days=20),
                        end_date=today - timedelta(days=16),
                        total_days=5,
                        reason="Annual family vacation",
                        status=LeaveStatus.APPROVED,
                        admin_remarks="Approved by Director",
                        reviewed_by=admin.id if admin else None,
                        reviewed_at=datetime.now() - timedelta(days=21),
                    )
                )

            if pam:
                db.add(
                    Leave(
                        employee_id=pam.id,
                        leave_type=LeaveType.CASUAL,
                        start_date=today + timedelta(days=3),
                        end_date=today + timedelta(days=4),
                        total_days=2,
                        reason="Personal work",
                        status=LeaveStatus.PENDING,
                    )
                )

            db.commit()
            print("  ✓ Seeded sample leaves.")

        # Seed Payrolls if none exist
        if db.query(Payroll).count() == 0:
            today = date.today()
            all_employees = db.query(Employee).all()

            # Previous month (September 2026): all marked as PAID
            for emp in all_employees:
                monthly_base = round(Decimal(emp.salary) / Decimal(12), 2)
                bonus = Decimal("500.00") if "Manager" in emp.designation else Decimal("0.00")
                allowance = Decimal("200.00")
                deduction = Decimal("150.00")
                tax = round(monthly_base * Decimal("0.10"), 2)
                net = monthly_base + allowance + bonus - (deduction + tax)

                db.add(
                    Payroll(
                        employee_id=emp.id,
                        month=9,
                        year=2026,
                        base_salary=monthly_base,
                        allowances=allowance,
                        bonuses=bonus,
                        deductions=deduction,
                        tax_deduction=tax,
                        net_salary=net,
                        payment_status=PaymentStatus.PAID,
                        payment_date=date(2026, 9, 30),
                        payment_method=PaymentMethod.BANK_TRANSFER,
                        notes="September 2026 Salary Disbursed",
                    )
                )

            # Current month (October 2026): marked as PENDING or PROCESSED
            for emp in all_employees:
                monthly_base = round(Decimal(emp.salary) / Decimal(12), 2)
                bonus = Decimal("0.00")
                allowance = Decimal("200.00")
                deduction = Decimal("150.00")
                tax = round(monthly_base * Decimal("0.10"), 2)
                net = monthly_base + allowance + bonus - (deduction + tax)

                db.add(
                    Payroll(
                        employee_id=emp.id,
                        month=10,
                        year=2026,
                        base_salary=monthly_base,
                        allowances=allowance,
                        bonuses=bonus,
                        deductions=deduction,
                        tax_deduction=tax,
                        net_salary=net,
                        payment_status=PaymentStatus.PENDING,
                        payment_method=PaymentMethod.BANK_TRANSFER,
                        notes="October 2026 Salary Payroll",
                    )
                )

            db.commit()
            print("  ✓ Seeded sample payrolls.")

        print("Batch 2 sample data check complete!")

    except Exception as e:
        db.rollback()
        print("Error seeding Batch 2:", e)
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_batch2()

