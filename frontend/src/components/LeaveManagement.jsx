import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { leaveApi } from '../services/api';
import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Clock,
  PlusCircle,
  XCircle,
  FileText,
  Filter,
  Check,
  X,
  Building,
  User,
} from 'lucide-react';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'UNPAID'];

export default function LeaveManagement() {
  const { role, user } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  const [activeSubTab, setActiveSubTab] = useState('my_leaves'); // 'my_leaves' | 'org_approvals'
  const [summary, setSummary] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [orgLeaves, setOrgLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Apply Modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leave_type: 'CASUAL',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: '',
  });

  // Review Modal state (HR/Admin)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');

  // Filters for organization leaves
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  const fetchMyLeavesAndSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, leaves] = await Promise.all([
        leaveApi.getSummary(),
        leaveApi.getMyHistory(),
      ]);
      setSummary(sum);
      setMyLeaves(leaves);
    } catch (err) {
      console.warn('Could not fetch employee leave history:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgLeaves = async () => {
    if (!isHrOrAdmin) return;
    setLoading(true);
    try {
      const params = {};
      if (filterStatus !== 'ALL') params.status = filterStatus;
      if (filterType !== 'ALL') params.leave_type = filterType;
      const data = await leaveApi.listAll(params);
      setOrgLeaves(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch organization leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLeavesAndSummary();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'org_approvals' && isHrOrAdmin) {
      fetchOrgLeaves();
    }
  }, [activeSubTab, filterStatus, filterType]);

  // Calculate duration in days
  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diff = (d2 - d1) / (1000 * 60 * 60 * 24) + 1;
    return diff > 0 ? diff : 0;
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (applyForm.end_date < applyForm.start_date) {
      setError('End date cannot be earlier than start date');
      return;
    }

    try {
      await leaveApi.apply(applyForm);
      setShowApplyModal(false);
      setApplyForm({
        leave_type: 'CASUAL',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        reason: '',
      });
      setSuccessMsg('Leave application submitted successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchMyLeavesAndSummary();
      if (isHrOrAdmin) fetchOrgLeaves();
    } catch (err) {
      setError(err.message || 'Failed to submit leave application');
    }
  };

  const handleCancelLeave = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
      await leaveApi.cancel(id);
      setSuccessMsg('Leave application cancelled.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchMyLeavesAndSummary();
      if (isHrOrAdmin) fetchOrgLeaves();
    } catch (err) {
      setError(err.message || 'Failed to cancel leave');
    }
  };

  const handleOpenReview = (leave) => {
    setSelectedLeave(leave);
    setAdminRemarks(leave.admin_remarks || '');
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (status) => {
    if (!selectedLeave) return;
    try {
      await leaveApi.review(selectedLeave.id, {
        status,
        admin_remarks: adminRemarks,
      });
      setShowReviewModal(false);
      setSelectedLeave(null);
      setSuccessMsg(`Leave request has been marked as ${status}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOrgLeaves();
      fetchMyLeavesAndSummary();
    } catch (err) {
      setError(err.message || 'Failed to review leave request');
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'APPROVED':
        return <span className="status-badge badge-active">APPROVED</span>;
      case 'PENDING':
        return <span className="status-badge badge-leave">PENDING</span>;
      case 'REJECTED':
        return <span className="status-badge badge-terminated">REJECTED</span>;
      case 'CANCELLED':
        return <span className="status-badge badge-inactive">CANCELLED</span>;
      default:
        return <span className="status-badge">{st}</span>;
    }
  };

  return (
    <div className="section-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">
            Apply for leave, track request history, and manage manager approvals
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError('');
            setShowApplyModal(true);
          }}
        >
          <PlusCircle size={18} /> Apply for Leave
        </button>
      </div>

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-blue">
              <CalendarDays size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Applications</span>
              <span className="stat-value">{summary.total_requests}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-yellow">
              <Clock size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Pending Approval</span>
              <span className="stat-value">{summary.pending}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-green">
              <CheckCircle2 size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Approved Leaves</span>
              <span className="stat-value">{summary.approved}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-purple">
              <XCircle size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Rejected / Cancelled</span>
              <span className="stat-value">{summary.rejected + summary.cancelled}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="attendance-tabs-container">
        <div className="attendance-sub-tabs">
          <button
            type="button"
            className={`sub-tab ${activeSubTab === 'my_leaves' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('my_leaves')}
          >
            <CalendarDays size={16} /> My Leave History
          </button>
          {isHrOrAdmin && (
            <button
              type="button"
              className={`sub-tab ${activeSubTab === 'org_approvals' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('org_approvals')}
            >
              <Building size={16} /> Team Leave Approvals (HR/Admin)
            </button>
          )}
        </div>

        {/* --- Subtab 1: My Leave History --- */}
        {activeSubTab === 'my_leaves' && (
          <div className="table-card">
            <div className="table-card-header">
              <h3>My Leave Applications</h3>
              <span className="badge-sub">{myLeaves.length} Records</span>
            </div>

            {loading ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading leave requests...
              </div>
            ) : myLeaves.length === 0 ? (
              <div className="empty-state">
                <CalendarDays size={40} className="empty-icon" />
                <h3>No leave applications found</h3>
                <p>Click "Apply for Leave" above to request planned time off.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Manager Remarks</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaves.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <strong>{l.leave_type}</strong>
                        </td>
                        <td>
                          {l.start_date} to {l.end_date}
                        </td>
                        <td>
                          <span className="dept-tag">{l.total_days} days</span>
                        </td>
                        <td>
                          <span className="notes-text">{l.reason}</span>
                        </td>
                        <td>{getStatusBadge(l.status)}</td>
                        <td>
                          <span className="notes-text">{l.admin_remarks || '-'}</span>
                        </td>
                        <td className="text-right">
                          {l.status === 'PENDING' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                              onClick={() => handleCancelLeave(l.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- Subtab 2: Organization Leave Approvals (HR / Admin) --- */}
        {activeSubTab === 'org_approvals' && isHrOrAdmin && (
          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Organization Leave Roster & Approvals</h3>
                <p className="table-subtitle">Review, approve, or reject employee leave requests</p>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="filters-card no-margin">
              <div className="filter-group">
                <div className="select-with-icon">
                  <Filter size={16} className="select-icon" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="filter-select"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">PENDING Only</option>
                    <option value="APPROVED">APPROVED Only</option>
                    <option value="REJECTED">REJECTED Only</option>
                    <option value="CANCELLED">CANCELLED Only</option>
                  </select>
                </div>

                <div className="select-with-icon">
                  <CalendarDays size={16} className="select-icon" />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="filter-select"
                  >
                    <option value="ALL">All Leave Types</option>
                    {LEAVE_TYPES.map((lt) => (
                      <option key={lt} value={lt}>
                        {lt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading leave requests...
              </div>
            ) : orgLeaves.length === 0 ? (
              <div className="empty-state">
                <Building size={40} className="empty-icon" />
                <h3>No leave requests found matching filters</h3>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Duration</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgLeaves.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <strong>{l.employee_name || `Emp #${l.employee_id}`}</strong>
                        </td>
                        <td>
                          <span className="dept-tag">{l.department || '-'}</span>
                        </td>
                        <td>{l.leave_type}</td>
                        <td>
                          {l.start_date} to {l.end_date}
                        </td>
                        <td>{l.total_days} days</td>
                        <td>
                          <span className="notes-text">{l.reason}</span>
                        </td>
                        <td>{getStatusBadge(l.status)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                            onClick={() => handleOpenReview(l)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- APPLY FOR LEAVE MODAL --- */}
      {showApplyModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Apply for Time Off</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowApplyModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="modal-body">
              <div className="form-group">
                <label>Leave Type *</label>
                <select
                  value={applyForm.leave_type}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, leave_type: e.target.value })
                  }
                >
                  {LEAVE_TYPES.map((lt) => (
                    <option key={lt} value={lt}>
                      {lt} Leave
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    required
                    value={applyForm.start_date}
                    onChange={(e) =>
                      setApplyForm({ ...applyForm, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="form-group flex-1">
                  <label>End Date *</label>
                  <input
                    type="date"
                    required
                    value={applyForm.end_date}
                    onChange={(e) =>
                      setApplyForm({ ...applyForm, end_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="alert alert-info">
                <CalendarDays size={18} />
                <span>
                  Total requested duration:{' '}
                  <strong>
                    {calculateDays(applyForm.start_date, applyForm.end_date)} day(s)
                  </strong>
                </span>
              </div>

              <div className="form-group">
                <label>Reason / Justification *</label>
                <textarea
                  required
                  rows={3}
                  className="attendance-note-input"
                  style={{ resize: 'vertical' }}
                  placeholder="Please describe the reason for your leave request..."
                  value={applyForm.reason}
                  onChange={(e) =>
                    setApplyForm({ ...applyForm, reason: e.target.value })
                  }
                ></textarea>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowApplyModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- REVIEW LEAVE MODAL (HR/ADMIN) --- */}
      {showReviewModal && selectedLeave && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Review Leave Request #{selectedLeave.id}</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowReviewModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="profile-details-grid">
                <div className="profile-detail-item">
                  <span className="detail-label">Employee</span>
                  <span className="detail-value">{selectedLeave.employee_name}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Department</span>
                  <span className="detail-value">{selectedLeave.department}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Type & Duration</span>
                  <span className="detail-value">
                    {selectedLeave.leave_type} ({selectedLeave.total_days} days)
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Date Range</span>
                  <span className="detail-value">
                    {selectedLeave.start_date} to {selectedLeave.end_date}
                  </span>
                </div>
                <div className="profile-detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="detail-label">Reason</span>
                  <span className="detail-value">{selectedLeave.reason}</span>
                </div>
              </div>

              <div className="form-group mt-3">
                <label>Manager Remarks / Feedback (Optional)</label>
                <textarea
                  rows={2}
                  className="attendance-note-input"
                  placeholder="e.g. Approved. Please hand over critical tasks before departure."
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                ></textarea>
              </div>

              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReviewModal(false)}
                >
                  Cancel
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#ef4444', color: '#fff' }}
                    onClick={() => handleReviewSubmit('REJECTED')}
                  >
                    <X size={16} /> Reject Leave
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#10b981', color: '#fff' }}
                    onClick={() => handleReviewSubmit('APPROVED')}
                  >
                    <Check size={16} /> Approve Leave
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

