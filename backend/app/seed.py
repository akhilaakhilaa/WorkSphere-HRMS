from datetime import date, datetime, timedelta
from decimal import Decimal
from app.database import Base, engine, SessionLocal
from app.models.user import User, UserRole
from app.models.employee import Employee, EmployeeStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.utils.security import hash_password


def init_db():
    print("Creating database tables if not exist...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


def seed_data():
    db = SessionLocal()
    try:
        init_db()

        # 1. Seed Admin User
        admin_user = db.query(User).filter(User.email == "admin@worksphere.com").first()
        if not admin_user:
            admin_user = User(
                email="admin@worksphere.com",
                password_hash=hash_password("Admin@123"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin_user)
            db.flush()
            print("Created Admin user: admin@worksphere.com / Admin@123")

        # 2. Seed HR User
        hr_user = db.query(User).filter(User.email == "hr@worksphere.com").first()
        if not hr_user:
            hr_user = User(
                email="hr@worksphere.com",
                password_hash=hash_password("Hr@123"),
                role=UserRole.HR,
                is_active=True,
            )
            db.add(hr_user)
            db.flush()
            print("Created HR user: hr@worksphere.com / Hr@123")

        # 3. Seed Employee User
        emp_user = (
            db.query(User).filter(User.email == "employee@worksphere.com").first()
        )
        if not emp_user:
            emp_user = User(
                email="employee@worksphere.com",
                password_hash=hash_password("Employee@123"),
                role=UserRole.EMPLOYEE,
                is_active=True,
            )
            db.add(emp_user)
            db.flush()
            print("Created Employee user: employee@worksphere.com / Employee@123")

        db.commit()

        # Seed Employee profiles
        # Admin Employee Profile
        admin_emp = db.query(Employee).filter(Employee.user_id == admin_user.id).first()
        if not admin_emp:
            admin_emp = Employee(
                user_id=admin_user.id,
                full_name="Sarah Connor",
                designation="System Administrator & Director",
                department="Management",
                joining_date=date(2023, 1, 15),
                salary=Decimal("125000.00"),
                status=EmployeeStatus.ACTIVE,
            )
            db.add(admin_emp)

        # HR Employee Profile
        hr_emp = db.query(Employee).filter(Employee.user_id == hr_user.id).first()
        if not hr_emp:
            hr_emp = Employee(
                user_id=hr_user.id,
                full_name="Rachel Green",
                designation="Senior HR Manager",
                department="Human Resources",
                joining_date=date(2023, 6, 1),
                salary=Decimal("85000.00"),
                status=EmployeeStatus.ACTIVE,
            )
            db.add(hr_emp)

        # Standard Employee Profile
        std_emp = db.query(Employee).filter(Employee.user_id == emp_user.id).first()
        if not std_emp:
            std_emp = Employee(
                user_id=emp_user.id,
                full_name="Alex Mercer",
                designation="Software Engineer",
                department="Engineering",
                joining_date=date(2024, 2, 10),
                salary=Decimal("75000.00"),
                status=EmployeeStatus.ACTIVE,
            )
            db.add(std_emp)

        # Additional sample employees without login yet
        extra_emps = [
            (
                "Michael Scott",
                "Regional Branch Manager",
                "Operations",
                date(2022, 5, 20),
                Decimal("90000.00"),
                EmployeeStatus.ACTIVE,
            ),
            (
                "Pam Beesly",
                "Office Coordinator",
                "Human Resources",
                date(2023, 3, 11),
                Decimal("52000.00"),
                EmployeeStatus.ACTIVE,
            ),
            (
                "Jim Halpert",
                "Senior Account Executive",
                "Sales",
                date(2022, 8, 1),
                Decimal("78000.00"),
                EmployeeStatus.ACTIVE,
            ),
            (
                "Dwight Schrute",
                "Assistant to the Regional Manager",
                "Sales",
                date(2021, 11, 4),
                Decimal("82000.00"),
                EmployeeStatus.ACTIVE,
            ),
        ]

        for name, desig, dept, jdate, sal, stat in extra_emps:
            existing = db.query(Employee).filter(Employee.full_name == name).first()
            if not existing:
                db.add(
                    Employee(
                        full_name=name,
                        designation=desig,
                        department=dept,
                        joining_date=jdate,
                        salary=sal,
                        status=stat,
                    )
                )

        db.commit()

        # Seed sample attendance for Alex Mercer for previous days
        if std_emp:
            today = date.today()
            for days_ago in range(5, 0, -1):
                past_date = today - timedelta(days=days_ago)
                # Skip weekends
                if past_date.weekday() >= 5:
                    continue
                att_record = (
                    db.query(Attendance)
                    .filter(
                        Attendance.employee_id == std_emp.id,
                        Attendance.date == past_date,
                    )
                    .first()
                )
                if not att_record:
                    cin = datetime.combine(past_date, datetime.min.time()).replace(
                        hour=9, minute=0
                    )
                    cout = datetime.combine(past_date, datetime.min.time()).replace(
                        hour=17, minute=30
                    )
                    db.add(
                        Attendance(
                            employee_id=std_emp.id,
                            date=past_date,
                            check_in=cin,
                            check_out=cout,
                            working_hours=Decimal("8.50"),
                            status=AttendanceStatus.PRESENT,
                            notes="Regular day work",
                        )
                    )

            db.commit()
            print("Seeded sample attendance records.")

        print("Database seeded successfully!")

    except Exception as e:
        db.rollback()
        print("Error seeding database:", e)
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()

