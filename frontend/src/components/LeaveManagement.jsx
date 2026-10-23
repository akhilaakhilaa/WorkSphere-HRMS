import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { leaveApi, employeeApi } from '../services/api';
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
  Award,
  ShieldCheck,
  Edit2,
  RefreshCw,
} from 'lucide-react';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'UNPAID'];

export default function LeaveManagement() {
  const { role, user } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // Sub-tabs: 'my_balances' | 'my_leaves' | 'leave_policies' | 'org_approvals'
  const [activeSubTab, setActiveSubTab] = useState('my_balances');
  const [summary, setSummary] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [orgLeaves, setOrgLeaves] = useState([]);
  const [myBalances, setMyBalances] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [orgBalances, setOrgBalances] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [filterBalanceEmp, setFilterBalanceEmp] = useState('');

  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [orgBalancesLoading, setOrgBalancesLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

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
  const [selectedLeaveBalance, setSelectedLeaveBalance] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');

  // Edit Policy Modal (HR/Admin)
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [policyDaysInput, setPolicyDaysInput] = useState('');
  const [policySaving, setPolicySaving] = useState(false);

  // Filters for organization leaves
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Fetch employee leaves, summary, and balances
  const fetchMyData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, leaves, balances, policyList] = await Promise.all([
        leaveApi.getSummary().catch(() => null),
        leaveApi.getMyHistory().catch(() => []),
        leaveApi.getMyBalances().catch(() => []),
        leaveApi.getPolicies().catch(() => []),
      ]);
      setSummary(sum);
      setMyLeaves(leaves || []);
      setMyBalances(balances || []);
      setPolicies(policyList || []);
    } catch (err) {
      console.warn('Could not fetch employee leave data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalancesOnly = async () => {
    setBalancesLoading(true);
    try {
      const balances = await leaveApi.getMyBalances();
      setMyBalances(balances || []);
    } catch (err) {
      console.warn('Failed to load balances:', err.message);
    } finally {
      setBalancesLoading(false);
    }
  };

  const fetchPoliciesOnly = async () => {
    setPoliciesLoading(true);
    try {
      const policyList = await leaveApi.getPolicies();
      setPolicies(policyList || []);
    } catch (err) {
      console.warn('Failed to load policies:', err.message);
    } finally {
      setPoliciesLoading(false);
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
      setOrgLeaves(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch organization leaves');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgBalances = async () => {
    if (!isHrOrAdmin) return;
    setOrgBalancesLoading(true);
    try {
      const params = {};
      if (filterBalanceEmp) params.employee_id = filterBalanceEmp;
      const [bals, emps] = await Promise.all([
        leaveApi.getBalances(params),
        employeesList.length === 0 ? employeeApi.list().catch(() => []) : Promise.resolve(employeesList),
      ]);
      setOrgBalances(bals || []);
      if (employeesList.length === 0) setEmployeesList(emps || []);
    } catch (err) {
      console.warn('Failed to fetch org balances:', err.message);
    } finally {
      setOrgBalancesLoading(false);
    }
  };

  useEffect(() => {
    fetchMyData();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'org_approvals' && isHrOrAdmin) {
      fetchOrgLeaves();
    } else if (activeSubTab === 'leave_policies') {
      fetchPoliciesOnly();
      if (isHrOrAdmin) fetchOrgBalances();
    } else if (activeSubTab === 'my_balances') {
      fetchBalancesOnly();
    }
  }, [activeSubTab, filterStatus, filterType, filterBalanceEmp]);

  // Calculate duration in days
  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diff = (d2 - d1) / (1000 * 60 * 60 * 24) + 1;
    return diff > 0 ? diff : 0;
  };

  // Selected balance in apply modal
  const selectedTypeBalance = myBalances.find((b) => b.leave_type === applyForm.leave_type);
  const requestedDays = calculateDays(applyForm.start_date, applyForm.end_date);
  const isInsufficient = selectedTypeBalance && Number(selectedTypeBalance.remaining_days) < requestedDays;

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
      fetchMyData();
      if (isHrOrAdmin) fetchOrgLeaves();
    } catch (err) {
      setError(err.message || 'Failed to submit leave application');
    }
  };

  const handleCancelLeave = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await leaveApi.cancel(id);
      setSuccessMsg('Leave application cancelled.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchMyData();
      if (isHrOrAdmin) fetchOrgLeaves();
    } catch (err) {
      setError(err.message || 'Failed to cancel leave');
    }
  };

  const handleOpenReview = async (leave) => {
    setSelectedLeave(leave);
    setAdminRemarks(leave.admin_remarks || '');
    setSelectedLeaveBalance(null);
    setShowReviewModal(true);

    // Fetch applicant's balance for this leave type
    try {
      const applicantBals = await leaveApi.getBalances({ employee_id: leave.employee_id });
      const match = applicantBals.find((b) => b.leave_type === leave.leave_type);
      if (match) setSelectedLeaveBalance(match);
    } catch (err) {
      console.warn('Could not fetch applicant balance:', err);
    }
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
      setSuccessMsg(`Leave request #${selectedLeave.id} marked as ${status}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOrgLeaves();
      fetchMyData();
    } catch (err) {
      setError(err.message || 'Failed to review leave request');
    }
  };

  // Sync / initialize all balances (HR/Admin)
  const handleSyncBalances = async () => {
    setSyncLoading(true);
    try {
      const res = await leaveApi.initializeBalances({});
      setSuccessMsg(res.message || 'Leave balances synced successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchPoliciesOnly();
      fetchOrgBalances();
      fetchBalancesOnly();
    } catch (err) {
      setError(err.message || 'Failed to initialize balances');
    } finally {
      setSyncLoading(false);
    }
  };

  // Edit policy total days
  const handleOpenEditPolicy = (policy) => {
    setEditingPolicy(policy);
    setPolicyDaysInput(policy.total_days_allowed);
    setShowPolicyModal(true);
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    if (!editingPolicy) return;
    setPolicySaving(true);
    try {
      await leaveApi.updatePolicy(editingPolicy.id, {
        total_days_allowed: parseFloat(policyDaysInput),
      });
      setShowPolicyModal(false);
      setEditingPolicy(null);
      setSuccessMsg(`Updated ${editingPolicy.leave_type} allowance to ${policyDaysInput} days!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchPoliciesOnly();
      fetchBalancesOnly();
      if (isHrOrAdmin) fetchOrgBalances();
    } catch (err) {
      setError(err.message || 'Failed to update leave policy');
    } finally {
      setPolicySaving(false);
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
          <h1 className="page-title">Leave Management & Balances</h1>
          <p className="page-subtitle">
            Track leave balances, inspect organizational policies, and manage requests
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            className={`sub-tab ${activeSubTab === 'my_balances' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('my_balances')}
          >
            <Award size={16} /> My Leave Balances
          </button>
          <button
            type="button"
            className={`sub-tab ${activeSubTab === 'my_leaves' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('my_leaves')}
          >
            <CalendarDays size={16} /> My Leave History
          </button>
          <button
            type="button"
            className={`sub-tab ${activeSubTab === 'leave_policies' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('leave_policies')}
          >
            <ShieldCheck size={16} /> Leave Policies
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

        {/* --- Subtab 1: My Leave Balances (Module 11) --- */}
        {activeSubTab === 'my_balances' && (
          <div>
            {balancesLoading ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading leave balances...
              </div>
            ) : myBalances.length === 0 ? (
              <div className="empty-state">
                <Award size={40} className="empty-icon" />
                <h3>No Leave Balances Initialized</h3>
                <p>Your leave balances will appear here once allocated by HR.</p>
              </div>
            ) : (
              <div>
                {/* Balance Cards Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px',
                  }}
                >
                  {myBalances.map((bal) => {
                    const total = Number(bal.total_allowed) || 0;
                    const rem = Number(bal.remaining_days) || 0;
                    const used = Number(bal.used_days) || 0;
                    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                    const isLow = rem <= 2 && total > 0;

                    return (
                      <div
                        key={bal.id}
                        className="stat-card"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '18px',
                          border: isLow ? '1px solid #fecaca' : '1px solid var(--border-color)',
                          background: isLow ? '#fffbfb' : 'var(--bg-surface)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span
                            className="status-badge"
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                            }}
                          >
                            {bal.leave_type} LEAVE
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Used: <strong>{bal.used_days}d</strong>
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0' }}>
                          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: isLow ? '#dc2626' : 'var(--primary)' }}>
                            {bal.remaining_days}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            / {bal.total_allowed} days remaining
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div
                          style={{
                            width: '100%',
                            height: '6px',
                            background: '#e2e8f0',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginTop: '4px',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : 'var(--primary)',
                              transition: 'width 0.3s ease',
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Balances Detail Table */}
                <div className="table-card">
                  <div className="table-card-header">
                    <div>
                      <h3>Detailed Leave Allowance Ledger</h3>
                      <p className="table-subtitle">Summary of allotted, consumed, and currently available days</p>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Leave Type</th>
                          <th>Total Allowed</th>
                          <th>Days Used</th>
                          <th>Days Remaining</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myBalances.map((b) => {
                          const rem = Number(b.remaining_days);
                          return (
                            <tr key={b.id}>
                              <td>
                                <strong>{b.leave_type}</strong>
                              </td>
                              <td>{b.total_allowed} days</td>
                              <td>{b.used_days} days</td>
                              <td>
                                <strong style={{ color: rem > 0 ? '#10b981' : '#ef4444' }}>
                                  {b.remaining_days} days
                                </strong>
                              </td>
                              <td>
                                {rem > 0 ? (
                                  <span className="status-badge badge-active">Available</span>
                                ) : (
                                  <span className="status-badge badge-terminated">Exhausted</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- Subtab 2: My Leave History --- */}
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

        {/* --- Subtab 3: Leave Policies & Employee Balances Overview (Module 11) --- */}
        {activeSubTab === 'leave_policies' && (
          <div>
            {/* Policy Overview Table */}
            <div className="table-card" style={{ marginBottom: '24px' }}>
              <div className="table-card-header">
                <div>
                  <h3>Organizational Leave Policies</h3>
                  <p className="table-subtitle">Standard annual leave allowances configured for team members</p>
                </div>
                {isHrOrAdmin && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={syncLoading}
                    onClick={handleSyncBalances}
                  >
                    <RefreshCw size={14} className={syncLoading ? 'spinner' : ''} />
                    {syncLoading ? 'Syncing...' : 'Sync All Balances'}
                  </button>
                )}
              </div>

              {policiesLoading ? (
                <div className="loading-state">
                  <span className="spinner"></span> Loading policies...
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Leave Type</th>
                        <th>Standard Allowance</th>
                        <th>Category Description</th>
                        {isHrOrAdmin && <th className="text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {policies.map((pol) => (
                        <tr key={pol.id}>
                          <td>
                            <strong>{pol.leave_type}</strong>
                          </td>
                          <td>
                            <span className="dept-tag">{pol.total_days_allowed} days / year</span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {pol.leave_type === 'CASUAL' && 'Short-term personal, emergency, or ad-hoc time off'}
                            {pol.leave_type === 'SICK' && 'Medical recuperation and doctor-certified health leaves'}
                            {pol.leave_type === 'ANNUAL' && 'Planned annual vacation and rejuvenation time'}
                            {pol.leave_type === 'MATERNITY' && 'Statutory parental maternity leave benefit'}
                            {pol.leave_type === 'PATERNITY' && 'Parental paternity leave benefit'}
                            {pol.leave_type === 'UNPAID' && 'Extended leave without pay / sabbatical'}
                          </td>
                          {isHrOrAdmin && (
                            <td className="text-right">
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                onClick={() => handleOpenEditPolicy(pol)}
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* HR/Admin Employee Balances Roster */}
            {isHrOrAdmin && (
              <div className="table-card">
                <div className="table-card-header">
                  <div>
                    <h3>Staff Leave Balances Roster</h3>
                    <p className="table-subtitle">Inspect leave allowances and remaining balances across employees</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={filterBalanceEmp}
                      onChange={(e) => setFilterBalanceEmp(e.target.value)}
                      className="filter-select"
                      style={{ minWidth: '180px' }}
                    >
                      <option value="">All Employees</option>
                      {employeesList.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.department})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {orgBalancesLoading ? (
                  <div className="loading-state">
                    <span className="spinner"></span> Loading staff balances...
                  </div>
                ) : orgBalances.length === 0 ? (
                  <div className="empty-state">
                    <Award size={40} className="empty-icon" />
                    <h3>No balance records found</h3>
                    <p>Click "Sync All Balances" above to initialize balances for all active staff.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Leave Type</th>
                          <th>Allotted</th>
                          <th>Used</th>
                          <th>Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgBalances.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <strong>{b.employee_name || `Emp #${b.employee_id}`}</strong>
                            </td>
                            <td>{b.department || '-'}</td>
                            <td>
                              <span className="dept-tag">{b.leave_type}</span>
                            </td>
                            <td>{b.total_allowed} days</td>
                            <td>{b.used_days} days</td>
                            <td>
                              <strong style={{ color: Number(b.remaining_days) > 0 ? '#10b981' : '#ef4444' }}>
                                {b.remaining_days} days
                              </strong>
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
        )}

        {/* --- Subtab 4: Organization Leave Approvals (HR / Admin) --- */}
        {activeSubTab === 'org_approvals' && isHrOrAdmin && (
          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Team Leave Approvals</h3>
                <p className="table-subtitle">Review, approve, or reject employee leave applications</p>
              </div>
            </div>

            {/* Filters */}
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
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="CANCELLED">CANCELLED</option>
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
                <span className="spinner"></span> Loading team requests...
              </div>
            ) : orgLeaves.length === 0 ? (
              <div className="empty-state">
                <Building size={40} className="empty-icon" />
                <h3>No leave requests found</h3>
                <p>There are no leave requests matching the selected filters.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgLeaves.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <strong>{l.employee_name || `Emp #${l.employee_id}`}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {l.department}
                          </div>
                        </td>
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
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
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

      {/* --- APPLY LEAVE MODAL --- */}
      {showApplyModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Submit Leave Request</h3>
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

                {/* Balance display for selected type */}
                {selectedTypeBalance && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: Number(selectedTypeBalance.remaining_days) > 0 ? '#166534' : '#991b1b',
                    }}
                  >
                    <span>
                      Available Balance: <strong>{selectedTypeBalance.remaining_days} days</strong> (Total Allowed: {selectedTypeBalance.total_allowed} days)
                    </span>
                  </div>
                )}
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

              <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={18} />
                <span>
                  Total requested duration: <strong>{requestedDays} day(s)</strong>
                </span>
              </div>

              {isInsufficient && (
                <div className="alert alert-error" style={{ fontSize: '0.85rem', padding: '8px 12px' }}>
                  <AlertCircle size={16} />
                  <span>
                    Warning: Requested duration ({requestedDays} days) exceeds your available {applyForm.leave_type} balance ({selectedTypeBalance?.remaining_days} days).
                  </span>
                </div>
              )}

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
                <button type="submit" className="btn btn-primary" disabled={isInsufficient}>
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
                {selectedLeaveBalance && (
                  <div
                    className="profile-detail-item"
                    style={{
                      gridColumn: '1 / -1',
                      background: Number(selectedLeaveBalance.remaining_days) >= selectedLeave.total_days ? '#f0fdf4' : '#fef2f2',
                      padding: '10px 14px',
                      borderRadius: '6px',
                    }}
                  >
                    <span className="detail-label" style={{ color: '#0f172a' }}>Applicant's Leave Balance</span>
                    <span className="detail-value">
                      Remaining: <strong>{selectedLeaveBalance.remaining_days} days</strong> | Allotted: {selectedLeaveBalance.total_allowed} days
                      {Number(selectedLeaveBalance.remaining_days) < selectedLeave.total_days && (
                        <span style={{ color: '#ef4444', marginLeft: '8px', fontWeight: 600 }}>
                          (Insufficient for {selectedLeave.total_days} days approval)
                        </span>
                      )}
                    </span>
                  </div>
                )}
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
                    disabled={selectedLeaveBalance && Number(selectedLeaveBalance.remaining_days) < selectedLeave.total_days}
                    onClick={() => handleReviewSubmit('APPROVED')}
                  >
                    <Check size={16} /> Approve & Deduct
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT POLICY MODAL (HR/ADMIN - MODULE 11) --- */}
      {showPolicyModal && editingPolicy && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit {editingPolicy.leave_type} Leave Policy</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowPolicyModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="modal-body">
              <div className="form-group">
                <label>Leave Category</label>
                <input
                  type="text"
                  disabled
                  value={`${editingPolicy.leave_type} LEAVE`}
                  style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>Total Days Allowed (Annual Allowance) *</label>
                <input
                  type="number"
                  required
                  step="0.5"
                  min="0"
                  max="365"
                  value={policyDaysInput}
                  onChange={(e) => setPolicyDaysInput(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPolicyModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={policySaving}>
                  {policySaving ? 'Saving...' : 'Update Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
