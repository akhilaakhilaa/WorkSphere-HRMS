import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { resignationApi } from '../services/api';
import {
  LogOut,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Check,
  X,
  Eye,
  RefreshCw,
  Send,
  User,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

const NOTICE_PERIOD_OPTIONS = [15, 30, 45, 60, 90];

export default function ResignationManagement() {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // Loading and alerts
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Data
  const [resignations, setResignations] = useState([]);
  const [summary, setSummary] = useState(null);

  // Filters (HR/Admin)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Employee Submission Form
  const [submitForm, setSubmitForm] = useState({
    reason: '',
    notice_period: 30,
  });
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // HR Review Modal
  const [selectedResignation, setSelectedResignation] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    status: 'APPROVED',
    reviewer_comments: '',
    last_working_day: '',
  });

  // Details Modal
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Cancellation Modal
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Auto clear success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isHrOrAdmin) {
        const [listRes, summaryRes] = await Promise.all([
          resignationApi.list(),
          resignationApi.getSummary().catch(() => null),
        ]);
        setResignations(Array.isArray(listRes) ? listRes : []);
        setSummary(summaryRes);
      } else {
        const [myRes, summaryRes] = await Promise.all([
          resignationApi.getMy(),
          resignationApi.getSummary().catch(() => null),
        ]);
        setResignations(Array.isArray(myRes) ? myRes : []);
        setSummary(summaryRes);
      }
    } catch (err) {
      console.error('Error fetching resignation data:', err);
      setError(err.message || 'Failed to load resignation records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isHrOrAdmin]);

  // Find active resignation for employee (either PENDING or APPROVED)
  const activeResignation = useMemo(() => {
    if (isHrOrAdmin) return null;
    return resignations.find(
      (r) => r.status === 'PENDING' || r.status === 'APPROVED'
    ) || (resignations.length > 0 ? resignations[0] : null);
  }, [resignations, isHrOrAdmin]);

  // Submit Resignation
  const handleSubmitResignation = async (e) => {
    if (e) e.preventDefault();
    if (!submitForm.reason.trim() || submitForm.reason.trim().length < 5) {
      setError('Please provide a detailed reason for resignation (minimum 5 characters).');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await resignationApi.submit({
        reason: submitForm.reason.trim(),
        notice_period: parseInt(submitForm.notice_period, 10),
      });

      setSuccessMessage('Resignation request submitted successfully. HR has been notified.');
      setShowSubmitModal(false);
      setSubmitForm({ reason: '', notice_period: 30 });
      await loadData();
    } catch (err) {
      console.error('Error submitting resignation:', err);
      setError(err.message || 'Failed to submit resignation request');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Review Modal
  const openReviewModal = (res, defaultStatus = 'APPROVED') => {
    setSelectedResignation(res);
    setReviewForm({
      status: defaultStatus,
      reviewer_comments: '',
      last_working_day: res.last_working_day ? res.last_working_day.slice(0, 10) : '',
    });
    setShowReviewModal(true);
  };

  // Submit Review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedResignation) return;

    setActionLoading(true);
    setError(null);
    try {
      await resignationApi.review(selectedResignation.id, {
        status: reviewForm.status,
        reviewer_comments: reviewForm.reviewer_comments.trim() || null,
        last_working_day: reviewForm.last_working_day || null,
      });

      const label = reviewForm.status === 'APPROVED' ? 'approved' : 'rejected';
      setSuccessMessage(`Resignation request for ${selectedResignation.employee_name} has been ${label}.`);
      setShowReviewModal(false);
      setSelectedResignation(null);
      await loadData();
    } catch (err) {
      console.error('Error reviewing resignation:', err);
      setError(err.message || 'Failed to review resignation');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Resignation (Employee or HR/Admin)
  const handleCancelResignation = async () => {
    if (!selectedResignation) return;
    setActionLoading(true);
    setError(null);
    try {
      await resignationApi.cancel(selectedResignation.id);
      setSuccessMessage('Resignation request successfully cancelled.');
      setShowCancelModal(false);
      setSelectedResignation(null);
      await loadData();
    } catch (err) {
      console.error('Error cancelling resignation:', err);
      setError(err.message || 'Failed to cancel resignation request');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Resignations (for HR/Admin)
  const filteredResignations = useMemo(() => {
    return resignations.filter((r) => {
      // Status
      if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.employee_name && r.employee_name.toLowerCase().includes(q);
        const matchCode = r.employee_code && r.employee_code.toLowerCase().includes(q);
        const matchDept = r.department && r.department.toLowerCase().includes(q);
        const matchReason = r.reason && r.reason.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDept && !matchReason) return false;
      }
      return true;
    });
  }, [resignations, statusFilter, searchQuery]);

  return (
    <div className="resignation-page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <div className="page-title-row">
            <LogOut className="page-title-icon" size={28} />
            <h1 className="page-title">
              {isHrOrAdmin ? 'Resignation & Exit Management' : 'My Resignation & Exit Status'}
            </h1>
          </div>
          <p className="page-subtitle">
            {isHrOrAdmin
              ? 'Review, approve, or reject employee exit requests and monitor offboarding notice periods.'
              : 'Submit resignation notice, track review progress, and review offboarding milestones.'}
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadData}
            disabled={loading}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="alert-close-btn"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="alert-close-btn"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EMPLOYEE VIEW                                                             */}
      {/* ========================================================================= */}
      {!isHrOrAdmin && (
        <div className="employee-resignation-view">
          {/* Active Resignation Status View */}
          {activeResignation ? (
            <div className="resignation-exit-card">
              {/* Status Banner */}
              <div
                className={`resignation-status-banner ${activeResignation.status.toLowerCase()}`}
              >
                {activeResignation.status === 'PENDING' && (
                  <>
                    <Clock size={28} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                        Resignation Request Under Review
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
                        Your resignation notice submitted on{' '}
                        {new Date(activeResignation.created_at).toLocaleDateString()} is currently
                        being reviewed by the HR department.
                      </p>
                    </div>
                  </>
                )}

                {activeResignation.status === 'APPROVED' && (
                  <>
                    <CheckCircle2 size={28} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                        Resignation Approved & Exit Scheduled
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
                        Your resignation notice has been formally approved. Please review your
                        last working day and complete the transition checklist below.
                      </p>
                    </div>
                  </>
                )}

                {activeResignation.status === 'REJECTED' && (
                  <>
                    <AlertTriangle size={28} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                        Resignation Request Rejected
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
                        Your resignation request was not approved. Please consult with your
                        department lead or HR representative.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="resignation-details-grid">
                <div className="resignation-detail-item">
                  <div className="resignation-detail-label">Request Date</div>
                  <div className="resignation-detail-value">
                    {new Date(activeResignation.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="resignation-detail-item">
                  <div className="resignation-detail-label">Notice Period</div>
                  <div className="resignation-detail-value">
                    {activeResignation.notice_period} Days
                  </div>
                </div>

                <div className="resignation-detail-item">
                  <div className="resignation-detail-label">
                    {activeResignation.status === 'APPROVED'
                      ? 'Confirmed Last Day'
                      : 'Proposed Last Day'}
                  </div>
                  <div className="resignation-detail-value">
                    {activeResignation.last_working_day || 'Calculating...'}
                  </div>
                </div>

                <div className="resignation-detail-item">
                  <div className="resignation-detail-label">Current Status</div>
                  <div className="resignation-detail-value">
                    <span
                      className={`badge ${
                        activeResignation.status === 'APPROVED'
                          ? 'badge-completed'
                          : activeResignation.status === 'PENDING'
                          ? 'badge-pending'
                          : 'badge-overdue'
                      }`}
                    >
                      {activeResignation.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resignation Reason Box */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#64748b',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  Submitted Reason
                </div>
                <p style={{ margin: 0, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {activeResignation.reason}
                </p>
              </div>

              {/* Reviewer Comments (if reviewed) */}
              {activeResignation.reviewer_comments && (
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#1d4ed8',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    HR / Management Remarks
                  </div>
                  <p style={{ margin: 0, color: '#1e3a8a', lineHeight: 1.5 }}>
                    {activeResignation.reviewer_comments}
                  </p>
                  {activeResignation.reviewer_email && (
                    <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: 4 }}>
                      Reviewed by {activeResignation.reviewer_email} on{' '}
                      {activeResignation.reviewed_at
                        ? new Date(activeResignation.reviewed_at).toLocaleDateString()
                        : ''}
                    </div>
                  )}
                </div>
              )}

              {/* Handover & Next Steps for Approved */}
              {activeResignation.status === 'APPROVED' && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 8,
                    padding: 18,
                    marginBottom: 16,
                  }}
                >
                  <h4 style={{ margin: '0 0 10px', color: '#166534', fontSize: '0.95rem' }}>
                    Offboarding & Clearance Checklist
                  </h4>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      color: '#15803d',
                      fontSize: '0.85rem',
                      lineHeight: 1.6,
                    }}
                  >
                    <li>Complete active task assignments and initiate knowledge transfer.</li>
                    <li>Consolidate code, project documentation, and credentials for your team lead.</li>
                    <li>Schedule exit interview with the People Operations / HR team.</li>
                    <li>Return company equipment, laptop, security badge, and company tokens.</li>
                    <li>Final salary, leave encashment, and experience certificate will be processed on your final settlement.</li>
                  </ul>
                </div>
              )}

              {/* Pending Actions (Cancel Resignation) */}
              {activeResignation.status === 'PENDING' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn btn-outline text-danger"
                    onClick={() => {
                      setSelectedResignation(activeResignation);
                      setShowCancelModal(true);
                    }}
                  >
                    Cancel Resignation Request
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Resignation Submission Form */
            <div className="card" style={{ maxWidth: 720, margin: '0 auto', padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div
                  style={{
                    background: '#fee2e2',
                    color: '#dc2626',
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LogOut size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                    Submit Resignation Request
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Please provide your formal reason and intended notice period for management review.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 14,
                  fontSize: '0.85rem',
                  color: '#475569',
                  marginBottom: 20,
                }}
              >
                <strong>Company Policy Notice:</strong> Standard organizational notice period is
                30 days. Proposed last working day will automatically be computed based on your
                selected notice duration.
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setShowSubmitModal(true);
                }}
              >
                {/* Notice Period Selection */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">
                    Notice Period (Days) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    {NOTICE_PERIOD_OPTIONS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={`preset-pill-btn ${
                          submitForm.notice_period === days ? 'active' : ''
                        }`}
                        style={{
                          padding: '6px 14px',
                          background: submitForm.notice_period === days ? '#2563eb' : '#f1f5f9',
                          color: submitForm.notice_period === days ? '#ffffff' : '#334155',
                          borderColor: submitForm.notice_period === days ? '#2563eb' : '#cbd5e1',
                          fontWeight: 600,
                        }}
                        onClick={() => setSubmitForm({ ...submitForm, notice_period: days })}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    className="form-control"
                    value={submitForm.notice_period}
                    onChange={(e) =>
                      setSubmitForm({ ...submitForm, notice_period: parseInt(e.target.value, 10) || 1 })
                    }
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    Estimated last working day:{' '}
                    <strong>
                      {new Date(
                        Date.now() + (submitForm.notice_period || 30) * 86400000
                      ).toLocaleDateString()}
                    </strong>
                  </div>
                </div>

                {/* Reason */}
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">
                    Reason for Resignation <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows={4}
                    className="form-control"
                    placeholder="Please explain the reason for your resignation (e.g., career advancement, higher education, personal relocation, health reasons)..."
                    value={submitForm.reason}
                    onChange={(e) => setSubmitForm({ ...submitForm, reason: e.target.value })}
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    Minimum 5 characters required.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!submitForm.reason.trim() || submitForm.reason.trim().length < 5}
                  >
                    <Send size={15} />
                    <span>Proceed to Submit</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Past Resignation History */}
          {resignations.length > 1 && (
            <div className="table-card" style={{ marginTop: 28 }}>
              <div className="table-header">
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  Resignation Request History
                </h4>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Request Date</th>
                      <th>Notice Period</th>
                      <th>Proposed Last Day</th>
                      <th>Status</th>
                      <th>Reviewed At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resignations.map((r) => (
                      <tr key={r.id}>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td>{r.notice_period} Days</td>
                        <td>{r.last_working_day || '—'}</td>
                        <td>
                          <span
                            className={`badge ${
                              r.status === 'APPROVED'
                                ? 'badge-completed'
                                : r.status === 'PENDING'
                                ? 'badge-pending'
                                : 'badge-overdue'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td>
                          {r.reviewed_at
                            ? new Date(r.reviewed_at).toLocaleDateString()
                            : '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              setSelectedResignation(r);
                              setShowDetailModal(true);
                            }}
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* HR / ADMIN MANAGEMENT VIEW                                                */}
      {/* ========================================================================= */}
      {isHrOrAdmin && (
        <div className="hr-resignation-view">
          {/* KPI Summary Cards */}
          {summary && (
            <div className="kpi-grid" style={{ marginBottom: 24 }}>
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-title">Total Requests</span>
                  <LogOut className="kpi-icon" size={20} />
                </div>
                <div className="kpi-value">{summary.total_requests}</div>
                <div className="kpi-footer">All time resignation submissions</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-title">Pending Review</span>
                  <Clock className="kpi-icon text-warning" size={20} />
                </div>
                <div className="kpi-value text-warning">{summary.pending}</div>
                <div className="kpi-footer">Awaiting HR/Admin decision</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-title">Approved Exits</span>
                  <CheckCircle2 className="kpi-icon text-success" size={20} />
                </div>
                <div className="kpi-value text-success">{summary.approved}</div>
                <div className="kpi-footer">Scheduled for offboarding</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-title">Rejected</span>
                  <AlertCircle className="kpi-icon text-danger" size={20} />
                </div>
                <div className="kpi-value text-danger">{summary.rejected}</div>
                <div className="kpi-footer">Declined or retracted</div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="filter-card" style={{ marginBottom: 20, padding: 16 }}>
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Search Bar */}
              <div className="search-bar" style={{ minWidth: 260, flex: 1 }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by employee name, code, department, reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="REJECTED">Rejected Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Resignations Table */}
          <div className="table-card">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Notice Period</th>
                    <th>Submission Date</th>
                    <th>Last Working Day</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        <div>Loading resignation requests...</div>
                      </td>
                    </tr>
                  ) : filteredResignations.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                        No resignation requests found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredResignations.map((r) => {
                      const isPending = r.status === 'PENDING';
                      return (
                        <tr key={r.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {r.employee_name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {r.employee_code}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-outline">
                              {r.department || 'General'}
                            </span>
                          </td>
                          <td>
                            <strong>{r.notice_period}</strong> Days
                          </td>
                          <td>{new Date(r.created_at).toLocaleDateString()}</td>
                          <td>
                            <strong>{r.last_working_day || '—'}</strong>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                r.status === 'APPROVED'
                                  ? 'badge-completed'
                                  : r.status === 'PENDING'
                                  ? 'badge-pending'
                                  : 'badge-overdue'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => {
                                  setSelectedResignation(r);
                                  setShowDetailModal(true);
                                }}
                                title="View Details"
                              >
                                <Eye size={13} />
                                <span>Details</span>
                              </button>

                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => openReviewModal(r, 'APPROVED')}
                                    title="Approve Resignation"
                                    style={{ background: '#10b981', borderColor: '#10b981' }}
                                  >
                                    <Check size={13} />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline text-danger"
                                    onClick={() => openReviewModal(r, 'REJECTED')}
                                    title="Reject Resignation"
                                  >
                                    <X size={13} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBMISSION CONFIRMATION (Employee)                                 */}
      {/* ========================================================================= */}
      {showSubmitModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} className="text-warning" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Confirm Resignation Notice</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowSubmitModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#334155' }}>
                Are you sure you want to formally submit your resignation notice?
              </p>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: 12,
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <strong>Notice Period:</strong> {submitForm.notice_period} Days
                </div>
                <div style={{ marginTop: 4 }}>
                  <strong>Estimated Last Day:</strong>{' '}
                  {new Date(
                    Date.now() + (submitForm.notice_period || 30) * 86400000
                  ).toLocaleDateString()}
                </div>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Once submitted, this will be sent to HR and department leadership for formal review.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowSubmitModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitResignation}
                disabled={actionLoading}
              >
                {actionLoading ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REVIEW RESIGNATION (HR/Admin)                                      */}
      {/* ========================================================================= */}
      {showReviewModal && selectedResignation && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {reviewForm.status === 'APPROVED' ? (
                  <CheckCircle2 size={20} className="text-success" />
                ) : (
                  <AlertCircle size={20} className="text-danger" />
                )}
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  {reviewForm.status === 'APPROVED' ? 'Approve' : 'Reject'} Resignation Request
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowReviewModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReview}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Employee Info Header */}
                <div
                  style={{
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <strong>Employee:</strong> {selectedResignation.employee_name} (
                    {selectedResignation.employee_code})
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <strong>Department:</strong> {selectedResignation.department || 'General'}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <strong>Notice Period:</strong> {selectedResignation.notice_period} Days
                  </div>
                </div>

                {/* Status Selection */}
                <div className="form-group">
                  <label className="form-label">Review Decision</label>
                  <select
                    className="form-control"
                    value={reviewForm.status}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, status: e.target.value })
                    }
                  >
                    <option value="APPROVED">Approve Resignation</option>
                    <option value="REJECTED">Reject Resignation</option>
                  </select>
                </div>

                {/* Confirmed Last Working Day */}
                {reviewForm.status === 'APPROVED' && (
                  <div className="form-group">
                    <label className="form-label">Confirmed Last Working Day</label>
                    <input
                      type="date"
                      className="form-control"
                      value={reviewForm.last_working_day}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, last_working_day: e.target.value })
                      }
                    />
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                      Defaults to calculated notice period expiration. Adjust if early release or
                      extension was negotiated.
                    </div>
                  </div>
                )}

                {/* Reviewer Comments */}
                <div className="form-group">
                  <label className="form-label">
                    Reviewer Remarks / Feedback (Optional)
                  </label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder={
                      reviewForm.status === 'APPROVED'
                        ? 'e.g., Approved. Handover to be completed with team lead.'
                        : 'e.g., Rejected following retention discussion and salary adjustment.'
                    }
                    value={reviewForm.reviewer_comments}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, reviewer_comments: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowReviewModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${
                    reviewForm.status === 'APPROVED' ? 'btn-primary' : 'btn-danger'
                  }`}
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? 'Processing...'
                    : `Confirm ${reviewForm.status === 'APPROVED' ? 'Approval' : 'Rejection'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESIGNATION DETAILS                                                */}
      {/* ========================================================================= */}
      {showDetailModal && selectedResignation && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={20} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Resignation Request Details</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDetailModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="resignation-details-grid" style={{ marginBottom: 0 }}>
                <div className="resignation-detail-item">
                  <div className="resignation-detail-label">Employee</div>
                  <div className="resignation-detail-value">
                    {selectedResignation.employee_name || '—'}
                  </div>
                </div>

                <div className="resignation-detail-item">
                  <div className="resignation-detail-label">Status</div>
                  <div className="resignation-detail-value">
                    <span
                      className={`badge ${
                        selectedResignation.status === 'APPROVED'
                          ? 'badge-completed'
                          : selectedResignation.status === 'PENDING'
                          ? 'badge-pending'
                          : 'badge-overdue'
                      }`}
                    >
                      {selectedResignation.status}
                    </span>
                  </div>
                </div>

                <div className="resignation-detail-item">
                  <div className="resignation-detail-label">Notice Period</div>
                  <div className="resignation-detail-value">
                    {selectedResignation.notice_period} Days
                  </div>
                </div>

                <div className="resignation-detail-item">
                  <div className="resignation-detail-label">Last Working Day</div>
                  <div className="resignation-detail-value">
                    {selectedResignation.last_working_day || '—'}
                  </div>
                </div>
              </div>

              <div>
                <div className="resignation-detail-label">Reason for Resignation</div>
                <div
                  style={{
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    fontSize: '0.9rem',
                    color: '#334155',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                  }}
                >
                  {selectedResignation.reason}
                </div>
              </div>

              {selectedResignation.reviewer_comments && (
                <div>
                  <div className="resignation-detail-label">Reviewer Comments</div>
                  <div
                    style={{
                      background: '#eff6ff',
                      padding: 12,
                      borderRadius: 6,
                      border: '1px solid #bfdbfe',
                      fontSize: '0.9rem',
                      color: '#1e3a8a',
                      lineHeight: 1.5,
                    }}
                  >
                    {selectedResignation.reviewer_comments}
                  </div>
                  {selectedResignation.reviewer_email && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                      Reviewed by {selectedResignation.reviewer_email} on{' '}
                      {selectedResignation.reviewed_at
                        ? new Date(selectedResignation.reviewed_at).toLocaleDateString()
                        : ''}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CANCEL RESIGNATION CONFIRMATION                                    */}
      {/* ========================================================================= */}
      {showCancelModal && selectedResignation && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} className="text-danger" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Cancel Resignation</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCancelModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>
                Are you sure you want to cancel your pending resignation request?
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                This will delete the pending request. You will remain an active employee.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
              >
                Keep Request
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancelResignation}
                disabled={actionLoading}
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

