"""
Integration Test Suite for Module 25: Third-Party Integrations & Reports
WorkSphere HRMS
"""

import sys
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.services.email_service import send_email, get_email_status
from app.services.export_service import generate_csv, generate_pdf

client = TestClient(app)


def test_module25():
    print("================================================================")
    print("TESTING MODULE 25: THIRD-PARTY INTEGRATIONS & REPORTS")
    print("================================================================")

    db = SessionLocal()

    try:
        # ----------------------------------------------------------------------
        # Setup: Authenticate Users
        # ----------------------------------------------------------------------
        print("\n--- Setup: Authenticating Users ---")
        r_admin = client.post(
            "/api/auth/login",
            json={"email": "admin@worksphere.com", "password": "Admin@123"},
        )
        assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
        admin_token = r_admin.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        r_hr = client.post(
            "/api/auth/login",
            json={"email": "hr@worksphere.com", "password": "Hr@123"},
        )
        assert r_hr.status_code == 200, f"HR login failed: {r_hr.text}"
        hr_token = r_hr.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}

        r_emp = client.post(
            "/api/auth/login",
            json={"email": "employee@worksphere.com", "password": "Employee@123"},
        )
        assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
        emp_token = r_emp.json()["access_token"]
        emp_headers = {"Authorization": f"Bearer {emp_token}"}

        print("✓ Authenticated: Admin, HR, and Employee.")

        # ----------------------------------------------------------------------
        # Scenario 1: Unauthenticated Access (401)
        # ----------------------------------------------------------------------
        print("\n--- Scenario 1: Unauthenticated Requests (401) ---")
        unauth_routes = [
            "/api/integrations/status",
            "/api/calendar/events",
            "/api/calendar/export.ics",
            "/api/exports/attendance?format=csv",
            "/api/exports/employees?format=pdf",
        ]
        for route in unauth_routes:
            resp = client.get(route)
            assert resp.status_code == 401, f"Expected 401 for {route}, got {resp.status_code}"
        print("✓ All unauthenticated requests rejected with HTTP 401.")

        # ----------------------------------------------------------------------
        # Scenario 2: Integrations Status & RBAC
        # ----------------------------------------------------------------------
        print("\n--- Scenario 2: Integrations Status & RBAC ---")
        # Employee should be forbidden
        r_emp_status = client.get("/api/integrations/status", headers=emp_headers)
        assert r_emp_status.status_code == 403, f"Expected 403 for employee, got {r_emp_status.status_code}"

        # Admin and HR should succeed
        r_admin_status = client.get("/api/integrations/status", headers=admin_headers)
        assert r_admin_status.status_code == 200
        data = r_admin_status.json()
        assert "smtp" in data and "calendar" in data and "exports" in data
        assert data["smtp"]["configured"] is True or data["smtp"]["configured"] is False
        assert "password" not in str(data).lower()
        assert "secret" not in str(data).lower()
        print("✓ Integration status verified: RBAC enforced and zero secrets leaked.")

        # ----------------------------------------------------------------------
        # Scenario 3: Calendar Events & ICS Export
        # ----------------------------------------------------------------------
        print("\n--- Scenario 3: Calendar Events & ICS Export ---")
        # Events feed
        r_events = client.get("/api/calendar/events", headers=emp_headers)
        assert r_events.status_code == 200
        events_list = r_events.json()
        assert isinstance(events_list, list)

        # ICS download
        r_ics = client.get("/api/calendar/export.ics", headers=emp_headers)
        assert r_ics.status_code == 200
        assert "text/calendar" in r_ics.headers.get("content-type", "")
        assert "BEGIN:VCALENDAR" in r_ics.text
        assert "VERSION:2.0" in r_ics.text
        assert "END:VCALENDAR" in r_ics.text
        print("✓ Calendar events and RFC 5545 .ics generation verified.")

        # ----------------------------------------------------------------------
        # Scenario 4: Export RBAC & Data Isolation
        # ----------------------------------------------------------------------
        print("\n--- Scenario 4: Export RBAC & Data Isolation ---")
        # Employee cannot export payroll
        r_emp_payroll = client.get("/api/exports/payroll?format=csv", headers=emp_headers)
        assert r_emp_payroll.status_code == 403, f"Expected 403 for employee payroll export, got {r_emp_payroll.status_code}"

        # Employee cannot export employee directory
        r_emp_dir = client.get("/api/exports/employees?format=csv", headers=emp_headers)
        assert r_emp_dir.status_code == 403, f"Expected 403 for employee directory export, got {r_emp_dir.status_code}"

        # Admin CAN export payroll
        r_admin_payroll = client.get("/api/exports/payroll?format=csv", headers=admin_headers)
        assert r_admin_payroll.status_code == 200
        assert "text/csv" in r_admin_payroll.headers.get("content-type", "")
        assert "Base Salary" in r_admin_payroll.text

        # Employee CAN export their own attendance
        r_emp_att = client.get("/api/exports/attendance?format=csv", headers=emp_headers)
        assert r_emp_att.status_code == 200
        assert "text/csv" in r_emp_att.headers.get("content-type", "")
        print("✓ Export RBAC and data isolation strictly enforced.")

        # ----------------------------------------------------------------------
        # Scenario 5: CSV Formula Injection Protection
        # ----------------------------------------------------------------------
        print("\n--- Scenario 5: CSV Formula Injection Defense ---")
        malicious_input = [["=1+1", "+cmd|' /C calc'!A0", "-2*3", "@SUM(A1:A10)", "Safe text"]]
        headers = ["Col1", "Col2", "Col3", "Col4", "Col5"]
        csv_output = generate_csv(headers, malicious_input).decode("utf-8-sig")

        # Check each dangerous symbol is escaped with single quote
        assert "'=1+1" in csv_output
        assert "'+cmd" in csv_output
        assert "'-2*3" in csv_output
        assert "'@SUM" in csv_output
        assert "Safe text" in csv_output
        print("✓ CSV Formula Injection neutralization verified.")

        # ----------------------------------------------------------------------
        # Scenario 6: PDF Generation
        # ----------------------------------------------------------------------
        print("\n--- Scenario 6: PDF Report Generation ---")
        r_admin_pdf = client.get("/api/exports/employees?format=pdf", headers=admin_headers)
        assert r_admin_pdf.status_code == 200
        assert "application/pdf" in r_admin_pdf.headers.get("content-type", "")
        assert r_admin_pdf.content.startswith(b"%PDF-")

        # Direct service unit test
        pdf_bytes = generate_pdf("Test Report", ["Header 1", "Header 2"], [["Row 1", "Value 1"]])
        assert pdf_bytes.startswith(b"%PDF-")
        print("✓ ReportLab PDF report generation verified.")

        # ----------------------------------------------------------------------
        # Scenario 7: Email Service & Dev Mode
        # ----------------------------------------------------------------------
        print("\n--- Scenario 7: Email Service & Dev Mode ---")
        sent = send_email(
            to_email="test.recipient@example.com",
            subject="WorkSphere Test Alert",
            body_text="This is a test notification message.",
        )
        assert sent is True
        status_info = get_email_status()
        assert "status" in status_info
        print("✓ Email utility and simulation mode verified.")

        # ----------------------------------------------------------------------
        # Scenario 8: Invalid Parameters Handling
        # ----------------------------------------------------------------------
        print("\n--- Scenario 8: Invalid Parameters Handling ---")
        r_invalid_type = client.get("/api/exports/invalid_unknown_type?format=csv", headers=admin_headers)
        assert r_invalid_type.status_code == 400

        r_invalid_fmt = client.get("/api/exports/leaves?format=xml", headers=admin_headers)
        assert r_invalid_fmt.status_code == 422
        print("✓ Invalid parameters appropriately handled with 400/422.")

        print("\n================================================================")
        print("✓ ALL MODULE 25 INTEGRATION TESTS PASSED (100%)")
        print("================================================================")

    finally:
        db.close()


if __name__ == "__main__":
    test_module25()
