"""
Comprehensive Integration Test Suite for Module 19: Smart Notifications & Alerts
WorkSphere HRMS

Tests:
1. Unauthenticated requests are rejected (401).
2. Authenticated users see only their own notifications.
3. Unread count calculation.
4. Marking individual notifications as read (both PATCH and PUT).
5. Marking all notifications as read (scoped to current user).
6. Cross-user isolation: user cannot view, read, or delete another user's notification (404).
7. Deleting notifications (DELETE /api/notifications/{id}).
8. Late attendance event generation with deduplication.
9. Leave approval notification generation.
10. Leave rejection notification generation.
11. Deduplication on repeated leave reviews with identical status.
12. Successful payroll processing notification generation.
13. Failed payroll validation does not emit false success alerts.
14. Deduplication on retried payroll batch runs.
15. Document expiry status safe reporting (no invented fields).
16. Cleanup of test-created notifications, attendance, and leave records.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
import sys

from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.notification import Notification, NotificationType
from app.models.payroll import PaymentMethod, PaymentStatus, Payroll
from app.models.user import User
from app.utils.notifications import notify_user

client = TestClient(app)


def test_module19():
    print("================================================================")
    print("TESTING MODULE 19: SMART NOTIFICATIONS & ALERTS")
    print("================================================================")

    db = SessionLocal()

    # 1. Authenticate users
    r_admin = client.post(
        "/api/auth/login",
        json={"email": "admin@worksphere.com", "password": "Admin@123"},
    )
    assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]
    admin_user_id = r_admin.json()["user_id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    r_hr = client.post(
        "/api/auth/login",
        json={"email": "hr@worksphere.com", "password": "Hr@123"},
    )
    assert r_hr.status_code == 200, f"HR login failed: {r_hr.text}"
    hr_token = r_hr.json()["access_token"]
    hr_user_id = r_hr.json()["user_id"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    r_emp = client.post(
        "/api/auth/login",
        json={"email": "employee@worksphere.com", "password": "Employee@123"},
    )
    assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
    emp_token = r_emp.json()["access_token"]
    emp_user_id = r_emp.json()["user_id"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    emp_profile = db.query(Employee).filter(Employee.user_id == emp_user_id).first()
    assert emp_profile is not None, "Employee profile not found"
    emp_id = emp_profile.id

    print(f"  ✓ Authenticated Admin (#{admin_user_id}), HR (#{hr_user_id}), and Employee (#{emp_user_id})")

    # Tracking lists for guaranteed cleanup
    created_notif_ids = []
    created_att_ids = []
    created_leave_ids = []
    created_payroll_ids = []

    try:
        # -------------------------------------------------------------
        # SCENARIO 1: UNAUTHENTICATED REQUESTS REJECTION (401)
        # -------------------------------------------------------------
        print("\n[Scenario 1: Unauthenticated Requests (401)]")
        endpoints = [
            ("GET", "/api/notifications"),
            ("GET", "/api/notifications/unread-count"),
            ("GET", "/api/notifications/summary"),
            ("PATCH", "/api/notifications/1/read"),
            ("PATCH", "/api/notifications/read-all"),
            ("DELETE", "/api/notifications/1"),
        ]
        for meth, ep in endpoints:
            r = client.request(meth, ep)
            assert r.status_code == 401, f"Expected 401 on {meth} {ep}, got {r.status_code}"
        print("  ✓ All notification endpoints strictly reject unauthenticated requests with 401")

        # -------------------------------------------------------------
        # SCENARIO 2: AUTHENTICATED USER SEES ONLY THEIR OWN NOTIFICATIONS
        # -------------------------------------------------------------
        print("\n[Scenario 2: User Scoping & Ownership Isolation]")
        # Seed test notification for Employee and one for HR
        notif_emp = Notification(
            user_id=emp_user_id,
            title="Employee Exclusive Alert",
            message="Confidential test notification for employee",
            type=NotificationType.SYSTEM,
            is_read=False,
        )
        notif_hr = Notification(
            user_id=hr_user_id,
            title="HR Exclusive Alert",
            message="Confidential test notification for HR",
            type=NotificationType.SYSTEM,
            is_read=False,
        )
        db.add_all([notif_emp, notif_hr])
        db.commit()
        db.refresh(notif_emp)
        db.refresh(notif_hr)
        created_notif_ids.extend([notif_emp.id, notif_hr.id])

        # Employee list must include their own, but NOT HR's
        r_emp_list = client.get("/api/notifications", headers=emp_headers)
        assert r_emp_list.status_code == 200
        emp_notif_ids = [n["id"] for n in r_emp_list.json()]
        assert notif_emp.id in emp_notif_ids, "Employee's notification missing from their list"
        assert notif_hr.id not in emp_notif_ids, "Cross-user leakage: Employee received HR notification!"

        # HR list must include HR's, but NOT Employee's
        r_hr_list = client.get("/api/notifications", headers=hr_headers)
        assert r_hr_list.status_code == 200
        hr_notif_ids = [n["id"] for n in r_hr_list.json()]
        assert notif_hr.id in hr_notif_ids
        assert notif_emp.id not in hr_notif_ids
        print("  ✓ User scoping validated: Employee and HR only receive their own notifications")

        # -------------------------------------------------------------
        # SCENARIO 3: UNREAD COUNT & SUMMARY CALCULATION
        # -------------------------------------------------------------
        print("\n[Scenario 3: Unread Count and Summary Calculations]")
        r_unread = client.get("/api/notifications/unread-count", headers=emp_headers)
        assert r_unread.status_code == 200
        unread_data = r_unread.json()
        assert "unread_count" in unread_data
        assert unread_data["unread_count"] >= 1

        r_sum = client.get("/api/notifications/summary", headers=emp_headers)
        assert r_sum.status_code == 200
        sum_data = r_sum.json()
        assert "total" in sum_data
        assert "unread" in sum_data
        assert sum_data["unread"] == unread_data["unread_count"]
        print(f"  ✓ Unread count verified ({sum_data['unread']} unread of {sum_data['total']} total)")

        # -------------------------------------------------------------
        # SCENARIO 4: MARK INDIVIDUAL AS READ (PATCH & PUT)
        # -------------------------------------------------------------
        print("\n[Scenario 4: Marking Individual Notification as Read]")
        # Test PATCH
        r_patch_read = client.patch(f"/api/notifications/{notif_emp.id}/read", headers=emp_headers)
        assert r_patch_read.status_code == 200, f"PATCH read failed: {r_patch_read.text}"
        assert r_patch_read.json()["is_read"] is True
        assert r_patch_read.json()["read_at"] is not None

        # Reset is_read to test PUT compatibility
        notif_emp.is_read = False
        db.commit()

        # Test PUT
        r_put_read = client.put(f"/api/notifications/{notif_emp.id}/read", headers=emp_headers)
        assert r_put_read.status_code == 200, f"PUT read failed: {r_put_read.text}"
        assert r_put_read.json()["is_read"] is True
        print("  ✓ Individual mark-as-read works via both PATCH and PUT (records read_at timestamp)")

        # -------------------------------------------------------------
        # SCENARIO 5: MARK ALL AS READ (USER-SCOPED)
        # -------------------------------------------------------------
        print("\n[Scenario 5: Scoped Mark-All-As-Read]")
        # Ensure HR's notification remains unread
        notif_hr_db = db.query(Notification).filter(Notification.id == notif_hr.id).first()
        notif_hr_db.is_read = False
        db.commit()

        # Employee calls read-all
        r_read_all = client.patch("/api/notifications/read-all", headers=emp_headers)
        assert r_read_all.status_code == 200
        assert r_read_all.json()["message"] == "All notifications marked as read"

        # Verify Employee's unread is now 0
        r_emp_unread = client.get("/api/notifications/unread-count", headers=emp_headers)
        assert r_emp_unread.json()["unread_count"] == 0

        # Verify HR's notification was NOT altered by Employee's read-all
        db.refresh(notif_hr_db)
        assert notif_hr_db.is_read is False, "Violation: Employee read-all marked HR's notification as read!"
        print("  ✓ Mark-all-as-read strictly confined to calling user's records")

        # -------------------------------------------------------------
        # SCENARIO 6: CROSS-USER TAMPERING REJECTION (404)
        # -------------------------------------------------------------
        print("\n[Scenario 6: Cross-User Tampering Rejection]")
        # Employee attempts to GET HR's notification
        r_probe_get = client.get(f"/api/notifications/{notif_hr.id}", headers=emp_headers)
        assert r_probe_get.status_code == 404, f"Expected 404, got {r_probe_get.status_code}"

        # Employee attempts to PATCH read HR's notification
        r_probe_patch = client.patch(f"/api/notifications/{notif_hr.id}/read", headers=emp_headers)
        assert r_probe_patch.status_code == 404, f"Expected 404, got {r_probe_patch.status_code}"

        # Employee attempts to DELETE HR's notification
        r_probe_del = client.delete(f"/api/notifications/{notif_hr.id}", headers=emp_headers)
        assert r_probe_del.status_code == 404, f"Expected 404, got {r_probe_del.status_code}"
        print("  ✓ Cross-user ID tampering safely blocked with 404 (GET, PATCH, DELETE)")

        # -------------------------------------------------------------
        # SCENARIO 7: NOTIFICATION DELETION
        # -------------------------------------------------------------
        print("\n[Scenario 7: Notification Deletion]")
        del_target_id = notif_emp.id
        r_del = client.delete(f"/api/notifications/{del_target_id}", headers=emp_headers)
        assert r_del.status_code == 200
        assert r_del.json()["message"] == "Notification deleted successfully"

        # Verify record no longer exists
        db.commit()
        check_del = db.query(Notification).filter(Notification.id == del_target_id).first()
        assert check_del is None
        print("  ✓ Authorized notification deletion succeeded")

        # -------------------------------------------------------------
        # SCENARIO 8: LATE ATTENDANCE ALERT & DEDUPLICATION
        # -------------------------------------------------------------
        print("\n[Scenario 8: Late Attendance Notification & Deduplication]")
        test_att_date = date(2025, 3, 10)
        # Clean any prior record on test date
        db.query(Attendance).filter(Attendance.employee_id == emp_id, Attendance.date == test_att_date).delete()
        db.commit()

        # Check in with a late timestamp
        late_checkin_time = datetime.combine(test_att_date, datetime.min.time()).replace(hour=10, minute=45)
        late_att = Attendance(
            employee_id=emp_id,
            date=test_att_date,
            check_in=late_checkin_time,
            status=AttendanceStatus.PRESENT,
            is_late=True,
            late_minutes=75,
        )
        db.add(late_att)
        db.commit()
        db.refresh(late_att)
        created_att_ids.append(late_att.id)

        # 1. Dispatch Late Attendance Alert for employee
        n_late1 = notify_user(
            db,
            user_id=emp_user_id,
            title="Late Attendance Alert",
            message=f"You checked in at 10:45 AM on {test_att_date}, recorded after scheduled grace period.",
            notif_type=NotificationType.ATTENDANCE,
            link="/attendance",
            related_entity_id=late_att.id,
            prevent_duplicate=True,
        )
        db.commit()
        assert n_late1 is not None
        created_notif_ids.append(n_late1.id)

        # 2. Attempt duplicate dispatch for the same late attendance record
        n_late2 = notify_user(
            db,
            user_id=emp_user_id,
            title="Late Attendance Alert",
            message="Duplicate attempt when updating attendance record",
            notif_type=NotificationType.ATTENDANCE,
            link="/attendance",
            related_entity_id=late_att.id,
            prevent_duplicate=True,
        )
        db.commit()
        assert n_late2.id == n_late1.id, "Violation: Duplicate notification created for same late attendance entity!"
        print(f"  ✓ Late attendance alert created with deduplication verified (notif_id={n_late1.id})")

        # -------------------------------------------------------------
        # SCENARIO 9: LEAVE APPROVAL & REJECTION NOTIFICATIONS
        # -------------------------------------------------------------
        print("\n[Scenario 9: Leave Approval & Rejection Notifications]")
        test_leave = Leave(
            employee_id=emp_id,
            leave_type=LeaveType.CASUAL,
            start_date=date(2025, 7, 1),
            end_date=date(2025, 7, 2),
            total_days=2,
            reason="Module 19 Smart Alerts Leave Test",
            status=LeaveStatus.PENDING,
        )
        db.add(test_leave)
        db.commit()
        db.refresh(test_leave)
        created_leave_ids.append(test_leave.id)

        # 1. Approve leave
        r_app = client.put(
            f"/api/leaves/{test_leave.id}/review",
            json={"status": "APPROVED", "admin_remarks": "Approved test leave"},
            headers=admin_headers,
        )
        assert r_app.status_code == 200, f"Leave approval failed: {r_app.text}"

        # Verify notification created
        db.commit()
        app_notifs = db.query(Notification).filter(
            Notification.user_id == emp_user_id,
            Notification.type == NotificationType.LEAVE,
            Notification.related_entity_id == test_leave.id,
        ).all()
        created_notif_ids.extend([n.id for n in app_notifs])
        assert len(app_notifs) == 1
        assert "Approved" in app_notifs[0].title
        assert "2025-07-01 to 2025-07-02" in app_notifs[0].message
        print(f"  ✓ Leave approval alert received by employee: '{app_notifs[0].title}'")

        # 2. Reject leave (transition from APPROVED to REJECTED)
        r_rej = client.put(
            f"/api/leaves/{test_leave.id}/review",
            json={"status": "REJECTED", "admin_remarks": "Rejected after reconsidering"},
            headers=admin_headers,
        )
        assert r_rej.status_code == 200

        db.commit()
        rej_notifs = db.query(Notification).filter(
            Notification.user_id == emp_user_id,
            Notification.type == NotificationType.LEAVE,
            Notification.related_entity_id == test_leave.id,
        ).all()
        created_notif_ids.extend([n.id for n in rej_notifs if n.id not in created_notif_ids])
        assert len(rej_notifs) == 2, f"Expected 2 notifications (1 approved, 1 rejected), got {len(rej_notifs)}"
        assert any("Rejected" in n.title for n in rej_notifs)
        print("  ✓ Leave rejection alert received upon status transition")

        # -------------------------------------------------------------
        # SCENARIO 10: REPEATED LEAVE REVIEWS PREVENT DUPLICATES
        # -------------------------------------------------------------
        print("\n[Scenario 10: Repeated Leave Reviews Deduplication]")
        # Submit the same REJECTED status again
        r_rej_repeat = client.put(
            f"/api/leaves/{test_leave.id}/review",
            json={"status": "REJECTED", "admin_remarks": "Rejected repeat attempt"},
            headers=admin_headers,
        )
        assert r_rej_repeat.status_code == 200

        db.commit()
        notifs_repeat = db.query(Notification).filter(
            Notification.user_id == emp_user_id,
            Notification.type == NotificationType.LEAVE,
            Notification.related_entity_id == test_leave.id,
        ).all()
        assert len(notifs_repeat) == 2, f"Duplicate notification created on repeated status: {len(notifs_repeat)} vs 2"
        print("  ✓ Repeated review with unchanged status generated NO duplicate notification")

        # -------------------------------------------------------------
        # SCENARIO 11: PAYROLL PROCESSING NOTIFICATION & DEDUPLICATION
        # -------------------------------------------------------------
        print("\n[Scenario 11: Payroll Processing Alerts & Deduplication]")
        test_month = 11
        test_year = 2029
        # Clean any pre-existing payroll for test period
        db.query(Payroll).filter(Payroll.month == test_month, Payroll.year == test_year).delete()
        db.commit()

        # Generate payroll
        r_pay = client.post(
            "/api/payroll/generate",
            json={"month": test_month, "year": test_year, "employee_id": emp_id},
            headers=admin_headers,
        )
        assert r_pay.status_code == 201, f"Payroll generation failed: {r_pay.text}"
        pay_json = r_pay.json()
        assert len(pay_json) == 1
        created_payroll_id = pay_json[0]["id"]
        created_payroll_ids.append(created_payroll_id)

        # Check payroll notification
        db.commit()
        pay_notifs = db.query(Notification).filter(
            Notification.user_id == emp_user_id,
            Notification.type == NotificationType.PAYROLL,
            Notification.related_entity_id == created_payroll_id,
        ).all()
        created_notif_ids.extend([n.id for n in pay_notifs])
        assert len(pay_notifs) == 1
        assert "New Payroll Generated" in pay_notifs[0].title
        print(f"  ✓ Payroll generation alert received: '{pay_notifs[0].title}'")

        # Retry payroll run for the same period (simulating batch rerun)
        r_pay_retry = client.post(
            "/api/payroll/generate",
            json={"month": test_month, "year": test_year, "employee_id": emp_id},
            headers=admin_headers,
        )
        assert r_pay_retry.status_code == 201
        db.commit()
        pay_notifs_after = db.query(Notification).filter(
            Notification.user_id == emp_user_id,
            Notification.type == NotificationType.PAYROLL,
            Notification.related_entity_id == created_payroll_id,
        ).all()
        assert len(pay_notifs_after) == 1, f"Duplicate payroll notification on retry: {len(pay_notifs_after)} vs 1"
        print("  ✓ Retried payroll run generated NO duplicate notification")

        # -------------------------------------------------------------
        # SCENARIO 12: FAILED PAYROLL DOES NOT EMIT FALSE SUCCESS
        # -------------------------------------------------------------
        print("\n[Scenario 12: Failed Operations Safeguard]")
        # Submit invalid month (13) to trigger failure
        r_pay_fail = client.post(
            "/api/payroll/generate",
            json={"month": 13, "year": test_year, "employee_id": emp_id},
            headers=admin_headers,
        )
        assert r_pay_fail.status_code in [400, 422], f"Expected failure on invalid month, got {r_pay_fail.status_code}"

        # Ensure no notification for month 13 exists
        fail_notifs = db.query(Notification).filter(
            Notification.user_id == emp_user_id,
            Notification.type == NotificationType.PAYROLL,
            Notification.message.like(f"%13/{test_year}%"),
        ).all()
        assert len(fail_notifs) == 0, "Violation: False success notification sent for failed payroll operation!"
        print("  ✓ Failed operation safely prevented from generating notifications")

        # -------------------------------------------------------------
        # SCENARIO 13: DOCUMENT EXPIRY STATUS INSPECTION
        # -------------------------------------------------------------
        print("\n[Scenario 13: Document Expiry Limitation Status]")
        r_doc_exp = client.get("/api/notifications/document-expiry-status", headers=emp_headers)
        assert r_doc_exp.status_code == 200
        doc_exp_data = r_doc_exp.json()
        assert doc_exp_data["supported"] is False
        assert "does not contain an expiry date" in doc_exp_data["reason"]
        print("  ✓ Document expiry safely reported as disabled without schema fabrication")

        print("\n================================================================")
        print("MODULE 19 INTEGRATION TESTS PASSED SUCCESSFULLY! (13/13 SCENARIOS)")
        print("================================================================")

    finally:
        # Cleanup test records
        if created_notif_ids:
            db.query(Notification).filter(Notification.id.in_(created_notif_ids)).delete(synchronize_session=False)
        if created_att_ids:
            db.query(Attendance).filter(Attendance.id.in_(created_att_ids)).delete(synchronize_session=False)
        if created_leave_ids:
            db.query(Leave).filter(Leave.id.in_(created_leave_ids)).delete(synchronize_session=False)
        if created_payroll_ids:
            db.query(Payroll).filter(Payroll.id.in_(created_payroll_ids)).delete(synchronize_session=False)
        db.commit()
        db.close()


if __name__ == "__main__":
    test_module19()
