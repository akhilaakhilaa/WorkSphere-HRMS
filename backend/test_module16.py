"""
Integration Test Suite for Module 16: Document Management System
WorkSphere HRMS
"""

import io
import os
from pathlib import Path
from starlette.testclient import TestClient

from app.main import app
from app.config import DOCUMENTS_UPLOAD_DIR
from app.database import SessionLocal
from app.models.document import Document, DocumentType
from app.models.employee import Employee
from app.models.user import User

client = TestClient(app)


def test_module16():
    print("================================================================")
    print("TESTING MODULE 16: DOCUMENT MANAGEMENT SYSTEM")
    print("================================================================")

    db = SessionLocal()

    # 1. Authenticate users
    r_admin = client.post("/api/auth/login", json={"email": "admin@worksphere.com", "password": "Admin@123"})
    assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    r_hr = client.post("/api/auth/login", json={"email": "hr@worksphere.com", "password": "Hr@123"})
    assert r_hr.status_code == 200, f"HR login failed: {r_hr.text}"
    hr_token = r_hr.json()["access_token"]
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    r_emp = client.post("/api/auth/login", json={"email": "employee@worksphere.com", "password": "Employee@123"})
    assert r_emp.status_code == 200, f"Employee login failed: {r_emp.text}"
    emp_token = r_emp.json()["access_token"]
    emp_user_id = r_emp.json()["user_id"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    emp1 = db.query(Employee).filter(Employee.user_id == emp_user_id).first()
    assert emp1 is not None, "Test employee 1 not found"
    emp1_id = emp1.id

    # Retrieve a second employee
    emp2 = db.query(Employee).filter(Employee.id != emp1_id).first()
    assert emp2 is not None, "Test employee 2 not found"
    emp2_id = emp2.id

    print(f"  ✓ Authenticated Admin, HR, and Employee (emp1_id={emp1_id}, emp2_id={emp2_id})")

    created_doc_ids = []

    try:
        # -------------------------------------------------------------
        # SCENARIO 1: UNAUTHENTICATED REQUEST REJECTION (401)
        # -------------------------------------------------------------
        print("\n[Scenario 1: Unauthenticated Request Rejection]")

        r = client.get("/api/documents")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("  ✓ GET /api/documents rejects unauthenticated request (401)")

        r = client.get("/api/documents/summary")
        assert r.status_code == 401
        print("  ✓ GET /api/documents/summary rejects unauthenticated request (401)")

        fake_file = io.BytesIO(b"%PDF-1.4 dummy pdf content")
        r = client.post("/api/documents/upload", files={"file": ("test.pdf", fake_file, "application/pdf")})
        assert r.status_code == 401
        print("  ✓ POST /api/documents/upload rejects unauthenticated request (401)")

        r = client.get("/api/documents/1/download")
        assert r.status_code == 401
        print("  ✓ GET /api/documents/{id}/download rejects unauthenticated request (401)")

        r = client.delete("/api/documents/1")
        assert r.status_code == 401
        print("  ✓ DELETE /api/documents/{id} rejects unauthenticated request (401)")

        # -------------------------------------------------------------
        # SCENARIO 2: FILE VALIDATION & SECURITY CHECKS
        # -------------------------------------------------------------
        print("\n[Scenario 2: File Validation & Security Checks]")

        # 2.1 Empty file rejection (400)
        empty_file = io.BytesIO(b"")
        r = client.post(
            "/api/documents/upload",
            headers=emp_headers,
            files={"file": ("empty.pdf", empty_file, "application/pdf")},
            data={"document_type": "IDENTITY"},
        )
        assert r.status_code == 400, f"Expected 400 for empty file, got {r.status_code}"
        assert "empty" in r.text.lower()
        print("  ✓ Empty file (0 bytes) rejected with 400 Bad Request")

        # 2.2 Invalid extension rejection (415)
        exe_file = io.BytesIO(b"binary executable payload")
        r = client.post(
            "/api/documents/upload",
            headers=emp_headers,
            files={"file": ("malware.exe", exe_file, "application/pdf")},
            data={"document_type": "IDENTITY"},
        )
        assert r.status_code == 415, f"Expected 415 for exe file, got {r.status_code}"
        assert "extension" in r.text.lower()
        print("  ✓ Disallowed extension (.exe) rejected with 415 Unsupported Media Type")

        # 2.3 Invalid MIME type rejection (415)
        sh_file = io.BytesIO(b"#!/bin/bash echo hello")
        r = client.post(
            "/api/documents/upload",
            headers=emp_headers,
            files={"file": ("script.pdf", sh_file, "application/x-sh")},
            data={"document_type": "IDENTITY"},
        )
        assert r.status_code == 415, f"Expected 415 for invalid MIME type, got {r.status_code}"
        assert "mime" in r.text.lower()
        print("  ✓ Disallowed MIME type ('application/x-sh') rejected with 415 Unsupported Media Type")

        # 2.4 Oversized file rejection (> 5 MB) (413)
        large_content = b"0" * (5 * 1024 * 1024 + 1024)  # 5 MB + 1 KB
        large_file = io.BytesIO(large_content)
        r = client.post(
            "/api/documents/upload",
            headers=emp_headers,
            files={"file": ("large_scan.pdf", large_file, "application/pdf")},
            data={"document_type": "CERTIFICATE"},
        )
        assert r.status_code == 413, f"Expected 413 for oversized file, got {r.status_code}"
        assert "exceeds" in r.text.lower()
        print("  ✓ Oversized file (> 5 MB) rejected with 413 Payload Too Large")

        # 2.5 Nonexistent employee ID rejection (404)
        valid_pdf = io.BytesIO(b"%PDF-1.4 test valid pdf content")
        r = client.post(
            "/api/documents/upload",
            headers=hr_headers,
            files={"file": ("doc.pdf", valid_pdf, "application/pdf")},
            data={"employee_id": 999999, "document_type": "EDUCATION"},
        )
        assert r.status_code == 404, f"Expected 404 for invalid employee, got {r.status_code}"
        print("  ✓ Nonexistent employee ID rejected with 404 Not Found")

        # -------------------------------------------------------------
        # SCENARIO 3: EMPLOYEE UPLOAD & ACCESS CONTROL
        # -------------------------------------------------------------
        print("\n[Scenario 3: Employee Upload & Access Control]")

        # 3.1 Employee uploads document for self (Succeeds 201)
        valid_pdf = io.BytesIO(b"%PDF-1.4 Passport Scan Content Sample for Testing")
        r_up1 = client.post(
            "/api/documents/upload",
            headers=emp_headers,
            files={"file": ("My_Passport.pdf", valid_pdf, "application/pdf")},
            data={"document_type": "IDENTITY", "description": "National Passport Scan"},
        )
        assert r_up1.status_code == 201, f"Failed employee upload: {r_up1.text}"
        doc1 = r_up1.json()
        doc1_id = doc1["id"]
        created_doc_ids.append(doc1_id)
        assert doc1["employee_id"] == emp1_id
        assert doc1["original_file_name"] == "My_Passport.pdf"
        assert doc1["document_type"] == "IDENTITY"
        assert doc1["content_type"] == "application/pdf"
        assert doc1["file_size"] > 0
        assert "uploads/documents/" in doc1["file_url"]
        # Verify file exists on disk
        stored_path = DOCUMENTS_UPLOAD_DIR / doc1["file_name"]
        assert stored_path.is_file(), f"Stored file not found at {stored_path}"
        print(f"  ✓ Employee successfully uploaded document #{doc1_id} ('{doc1['original_file_name']}')")

        # 3.2 Employee tries to upload for another employee (403 Forbidden)
        fake_cert = io.BytesIO(b"%PDF-1.4 Fake Cert")
        r_tamper = client.post(
            "/api/documents/upload",
            headers=emp_headers,
            files={"file": ("Cert.pdf", fake_cert, "application/pdf")},
            data={"employee_id": emp2_id, "document_type": "CERTIFICATE"},
        )
        assert r_tamper.status_code == 403, f"Expected 403, got {r_tamper.status_code}"
        print("  ✓ Employee forbidden from uploading documents for another employee (403 Forbidden)")

        # 3.3 Path traversal in original filename safely sanitized
        traversal_file = io.BytesIO(b"\x89PNG\r\n\x1a\nPNG image data")
        r_trav = client.post(
            "/api/documents/upload",
            headers=emp_headers,
            files={"file": ("../../etc/passwd_photo.png", traversal_file, "image/png")},
            data={"document_type": "CERTIFICATE"},
        )
        assert r_trav.status_code == 201
        doc_trav = r_trav.json()
        created_doc_ids.append(doc_trav["id"])
        assert ".." not in doc_trav["file_name"]
        assert "/" not in doc_trav["file_name"]
        assert "\\" not in doc_trav["file_name"]
        print("  ✓ Path traversal filename safely sanitized; file stored strictly in upload directory")

        # -------------------------------------------------------------
        # SCENARIO 4: HR UPLOADS FOR EMPLOYEE 2 & CROSS-USER ISOLATION
        # -------------------------------------------------------------
        print("\n[Scenario 4: HR Upload & Cross-Employee Isolation]")

        # 4.1 HR uploads document for Employee 2
        emp2_pdf = io.BytesIO(b"%PDF-1.4 Offer Letter for Employee 2")
        r_hr_up = client.post(
            "/api/documents/upload",
            headers=hr_headers,
            files={"file": ("Emp2_OfferLetter.pdf", emp2_pdf, "application/pdf")},
            data={"employee_id": emp2_id, "document_type": "EMPLOYMENT"},
        )
        assert r_hr_up.status_code == 201
        doc2 = r_hr_up.json()
        doc2_id = doc2["id"]
        created_doc_ids.append(doc2_id)
        assert doc2["employee_id"] == emp2_id
        print(f"  ✓ HR successfully uploaded document #{doc2_id} for Employee #{emp2_id}")

        # 4.2 Employee 1 list query only returns Employee 1's documents
        r_emp_list = client.get("/api/documents", headers=emp_headers)
        assert r_emp_list.status_code == 200
        emp_docs = r_emp_list.json()
        emp_doc_ids = [d["id"] for d in emp_docs]
        assert doc1_id in emp_doc_ids
        assert doc2_id not in emp_doc_ids, "Employee 1 must NOT see Employee 2's document in list"
        assert all(d["employee_id"] == emp1_id for d in emp_docs)
        print("  ✓ GET /api/documents isolates employee view: Employee 1 sees only own documents")

        # 4.3 Employee 1 queries with employee_id=emp2_id (403 Forbidden)
        r_forbidden_query = client.get(f"/api/documents?employee_id={emp2_id}", headers=emp_headers)
        assert r_forbidden_query.status_code == 403
        print("  ✓ GET /api/documents?employee_id={other} blocked for EMPLOYEE (403 Forbidden)")

        # 4.4 Employee 1 attempts to get metadata of Employee 2's document (403 Forbidden)
        r_get_tamper = client.get(f"/api/documents/{doc2_id}", headers=emp_headers)
        assert r_get_tamper.status_code == 403
        print("  ✓ GET /api/documents/{doc2_id} blocked for EMPLOYEE (403 Forbidden)")

        # 4.5 Employee 1 attempts to download Employee 2's document (403 Forbidden)
        r_dl_tamper = client.get(f"/api/documents/{doc2_id}/download", headers=emp_headers)
        assert r_dl_tamper.status_code == 403
        print("  ✓ GET /api/documents/{doc2_id}/download blocked for EMPLOYEE (403 Forbidden)")

        # 4.6 Employee 1 attempts to view Employee 2's document inline (403 Forbidden)
        r_view_tamper = client.get(f"/api/documents/{doc2_id}/view", headers=emp_headers)
        assert r_view_tamper.status_code == 403
        print("  ✓ GET /api/documents/{doc2_id}/view blocked for EMPLOYEE (403 Forbidden)")

        # 4.7 Employee 1 attempts to delete Employee 2's document (403 Forbidden)
        r_del_tamper = client.delete(f"/api/documents/{doc2_id}", headers=emp_headers)
        assert r_del_tamper.status_code == 403
        print("  ✓ DELETE /api/documents/{doc2_id} blocked for EMPLOYEE (403 Forbidden)")

        # -------------------------------------------------------------
        # SCENARIO 5: VIEW, DOWNLOAD & METADATA VERIFICATION
        # -------------------------------------------------------------
        print("\n[Scenario 5: View, Download & Metadata Verification]")

        # 5.1 Employee 1 downloads own document (attachment)
        r_dl = client.get(f"/api/documents/{doc1_id}/download", headers=emp_headers)
        assert r_dl.status_code == 200
        assert r_dl.headers["content-type"] == "application/pdf"
        assert "attachment" in r_dl.headers.get("content-disposition", "")
        assert doc1["original_file_name"] in r_dl.headers.get("content-disposition", "")
        assert b"Passport Scan Content" in r_dl.content
        print(f"  ✓ Downloaded own document #{doc1_id} with correct attachment header and binary content")

        # 5.2 Employee 1 views own document (inline)
        r_view = client.get(f"/api/documents/{doc1_id}/view", headers=emp_headers)
        assert r_view.status_code == 200
        assert r_view.headers["content-type"] == "application/pdf"
        assert "inline" in r_view.headers.get("content-disposition", "")
        print(f"  ✓ Viewed own document #{doc1_id} inline with correct headers")

        # 5.3 HR & Admin can download & view any employee's document
        r_hr_dl = client.get(f"/api/documents/{doc1_id}/download", headers=hr_headers)
        assert r_hr_dl.status_code == 200
        print("  ✓ HR successfully downloaded Employee 1's document")

        r_admin_view = client.get(f"/api/documents/{doc2_id}/view", headers=admin_headers)
        assert r_admin_view.status_code == 200
        print("  ✓ Admin successfully viewed Employee 2's document inline")

        # 5.4 Summary metrics endpoint
        r_summary = client.get("/api/documents/summary", headers=admin_headers)
        assert r_summary.status_code == 200
        sum_data = r_summary.json()
        assert sum_data["total_documents"] >= 3
        assert sum_data["total_size_bytes"] > 0
        assert "IDENTITY" in sum_data["type_breakdown"]
        print(f"  ✓ Documents summary: {sum_data['total_documents']} files ({sum_data['total_size_formatted']})")

        # -------------------------------------------------------------
        # SCENARIO 6: DOCUMENT DELETION & SAFE FILE REMOVAL
        # -------------------------------------------------------------
        print("\n[Scenario 6: Document Deletion & Storage Removal]")

        # 6.1 Employee 1 deletes own document trav
        trav_id = doc_trav["id"]
        stored_trav_file = DOCUMENTS_UPLOAD_DIR / doc_trav["file_name"]
        assert stored_trav_file.is_file(), "File should exist before deletion"

        r_del = client.delete(f"/api/documents/{trav_id}", headers=emp_headers)
        assert r_del.status_code == 200
        created_doc_ids.remove(trav_id)
        assert not stored_trav_file.is_file(), "File must be removed from disk after deletion"
        print(f"  ✓ Employee deleted document #{trav_id}; file was deleted from disk and DB")

        # 6.2 Verify subsequent download returns 404
        r_dl_after = client.get(f"/api/documents/{trav_id}/download", headers=emp_headers)
        assert r_dl_after.status_code == 404
        print("  ✓ Subsequent access to deleted document returns 404 Not Found")

        # 6.3 Admin deletes doc2
        r_admin_del = client.delete(f"/api/documents/{doc2_id}", headers=admin_headers)
        assert r_admin_del.status_code == 200
        created_doc_ids.remove(doc2_id)
        print(f"  ✓ Admin deleted document #{doc2_id}")

        print("\n================================================================")
        print("ALL MODULE 16 TESTS PASSED SUCCESSFULLY! (100%)")
        print("================================================================")

    finally:
        # Cleanup any remaining test documents
        for did in created_doc_ids:
            doc = db.query(Document).filter(Document.id == did).first()
            if doc:
                p = DOCUMENTS_UPLOAD_DIR / doc.file_name
                if p.is_file():
                    try:
                        p.unlink()
                    except Exception:
                        pass
                db.delete(doc)
        db.commit()
        db.close()
        print("  ✓ Cleaned up test files and records.")


if __name__ == "__main__":
    test_module16()

