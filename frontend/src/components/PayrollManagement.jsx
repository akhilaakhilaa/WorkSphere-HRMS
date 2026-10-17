import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { payrollApi, employeeApi } from '../services/api';
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  PlusCircle,
  CreditCard,
  Edit,
  Eye,
  Filter,
  Building,
  X,
  Check,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollManagement() {
  const { role, user } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  const [activeSubTab, setActiveSubTab] = useState('my_payroll'); // 'my_payroll' | 'org_payroll'
  const [summary, setSummary] = useState(null);
  const [myPayrolls, setMyPayrolls] = useState([]);
  const [orgPayrolls, setOrgPayrolls] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected period filters for org payroll
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Generate Modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    employee_id: '',
  });

  // Adjust Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustData, setAdjustData] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    bonuses: '0.00',
    allowances: '0.00',
    deductions: '0.00',
    tax_deduction: '0.00',
    notes: '',
  });

  // Payslip Modal
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Mark Paid Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingRecord, setPayingRecord] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');

  const fetchMyPayrollAndSummary = async () => {
    setLoading(true);
    try {
      const [sum, myPay] = await Promise.all([
        payrollApi.getSummary(),
        payrollApi.getMyHistory(),
      ]);
      setSummary(sum);
      setMyPayrolls(myPay);
    } catch (err) {
      console.warn('Could not fetch payroll records:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgPayroll = async () => {
    if (!isHrOrAdmin) return;
    setLoading(true);
    try {
      const params = {};
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;

      const [data, emps, sum] = await Promise.all([
        payrollApi.listAll(params),
        employeesList.length === 0 ? employeeApi.list() : Promise.resolve(employeesList),
        payrollApi.getSummary(selectedMonth, selectedYear),
      ]);
      setOrgPayrolls(data);
      if (employeesList.length === 0) setEmployeesList(emps);
      setSummary(sum);
    } catch (err) {
      setError(err.message || 'Failed to load organization payrolls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyPayrollAndSummary();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'org_payroll' && isHrOrAdmin) {
      fetchOrgPayroll();
    }
  }, [activeSubTab, selectedMonth, selectedYear, selectedStatus]);

  // Handle Generate Payroll
  const handleGeneratePayroll = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        month: parseInt(generateForm.month),
        year: parseInt(generateForm.year),
      };
      if (generateForm.employee_id) {
        payload.employee_id = parseInt(generateForm.employee_id);
      }

      await payrollApi.generate(payload);
      setShowGenerateModal(false);
      setSuccessMsg(`Payroll generated for ${MONTH_NAMES[payload.month - 1]} ${payload.year}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOrgPayroll();
      fetchMyPayrollAndSummary();
    } catch (err) {
      setError(err.message || 'Failed to generate payroll');
    }
  };

  // Handle Open Adjust Modal
  const handleOpenAdjust = (p) => {
    setAdjustData(p);
    setAdjustForm({
      bonuses: p.bonuses,
      allowances: p.allowances,
      deductions: p.deductions,
      tax_deduction: p.tax_deduction,
      notes: p.notes || '',
    });
    setShowAdjustModal(true);
  };

  // Handle Save Adjust
  const handleSaveAdjust = async (e) => {
    e.preventDefault();
    if (!adjustData) return;
    try {
      await payrollApi.update(adjustData.id, {
        bonuses: parseFloat(adjustForm.bonuses),
        allowances: parseFloat(adjustForm.allowances),
        deductions: parseFloat(adjustForm.deductions),
        tax_deduction: parseFloat(adjustForm.tax_deduction),
        notes: adjustForm.notes,
      });
      setShowAdjustModal(false);
      setAdjustData(null);
      setSuccessMsg('Payroll adjustments saved & net salary recalculated!');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOrgPayroll();
      fetchMyPayrollAndSummary();
    } catch (err) {
      setError(err.message || 'Failed to adjust payroll');
    }
  };

  // Handle Mark Paid
  const handleConfirmPayment = async () => {
    if (!payingRecord) return;
    try {
      await payrollApi.markPaid(payingRecord.id, paymentMethod);
      setShowPayModal(false);
      setPayingRecord(null);
      setSuccessMsg('Salary marked as PAID and notification sent to employee!');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOrgPayroll();
      fetchMyPayrollAndSummary();
    } catch (err) {
      setError(err.message || 'Failed to process payment');
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'PAID':
        return <span className="status-badge badge-active">PAID</span>;
      case 'PROCESSED':
        return <span className="status-badge badge-leave">PROCESSED</span>;
      case 'PENDING':
        return <span className="status-badge badge-terminated">PENDING</span>;
      default:
        return <span className="status-badge">{st}</span>;
    }
  };

  return (
    <div className="section-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll Management</h1>
          <p className="page-subtitle">
            Generate monthly salaries, manage deductions & bonuses, and view payslips
          </p>
        </div>
        {isHrOrAdmin && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setError('');
              setShowGenerateModal(true);
            }}
          >
            <PlusCircle size={18} /> Generate Monthly Payroll
          </button>
        )}
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

      {/* KPI Cards */}
      {summary && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-blue">
              <FileSpreadsheet size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Payroll Records</span>
              <span className="stat-value">{summary.total_payrolls}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-green">
              <DollarSign size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Disbursed (Paid)</span>
              <span className="stat-value">
                ${Number(summary.total_paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-yellow">
              <Clock size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Pending Payout</span>
              <span className="stat-value">
                ${Number(summary.total_pending_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-purple">
              <CreditCard size={22} />
            </div>
            <div className="stat-content">
              <span className="stat-label">Paid vs Pending Staff</span>
              <span className="stat-value">
                {summary.paid_count} / {summary.pending_count + summary.processed_count}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="attendance-tabs-container">
        <div className="attendance-sub-tabs">
          <button
            type="button"
            className={`sub-tab ${activeSubTab === 'my_payroll' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('my_payroll')}
          >
            <CreditCard size={16} /> My Payslips
          </button>
          {isHrOrAdmin && (
            <button
              type="button"
              className={`sub-tab ${activeSubTab === 'org_payroll' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('org_payroll')}
            >
              <Building size={16} /> Company Payroll Roster (HR/Admin)
            </button>
          )}
        </div>

        {/* --- Subtab 1: My Payslips --- */}
        {activeSubTab === 'my_payroll' && (
          <div className="table-card">
            <div className="table-card-header">
              <h3>My Compensation & Payslip History</h3>
              <span className="badge-sub">{myPayrolls.length} Payslips</span>
            </div>

            {loading ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading payslips...
              </div>
            ) : myPayrolls.length === 0 ? (
              <div className="empty-state">
                <CreditCard size={40} className="empty-icon" />
                <h3>No payslips generated yet</h3>
                <p>When HR generates your monthly salary, your official payslip will appear here.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Pay Period</th>
                      <th>Base Salary</th>
                      <th>Allowances & Bonus</th>
                      <th>Deductions & Tax</th>
                      <th>Net Disbursed</th>
                      <th>Status</th>
                      <th>Disbursement Date</th>
                      <th className="text-right">Payslip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPayrolls.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{MONTH_NAMES[p.month - 1]} {p.year}</strong>
                        </td>
                        <td>${Number(p.base_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td>+${(Number(p.allowances) + Number(p.bonuses)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td style={{ color: '#dc2626' }}>
                          -${(Number(p.deductions) + Number(p.tax_deduction)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="salary-text">
                          ${Number(p.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td>{getStatusBadge(p.payment_status)}</td>
                        <td>{p.payment_date || 'Pending'}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                            onClick={() => {
                              setSelectedPayslip(p);
                              setShowPayslipModal(true);
                            }}
                          >
                            <Eye size={14} /> View
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

        {/* --- Subtab 2: Organization Payroll (HR/Admin) --- */}
        {activeSubTab === 'org_payroll' && isHrOrAdmin && (
          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Organization Payroll Register</h3>
                <p className="table-subtitle">Inspect salaries, add bonuses or deductions, and disburse payments</p>
              </div>
            </div>

            {/* Filter controls */}
            <div className="filters-card no-margin">
              <div className="filter-group">
                <div className="select-with-icon">
                  <Calendar size={16} className="select-icon" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="filter-select"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="select-with-icon">
                  <Calendar size={16} className="select-icon" />
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="filter-select"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="select-with-icon">
                  <Filter size={16} className="select-icon" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="filter-select"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">PENDING</option>
                    <option value="PROCESSED">PROCESSED</option>
                    <option value="PAID">PAID</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading organization payroll...
              </div>
            ) : orgPayrolls.length === 0 ? (
              <div className="empty-state">
                <DollarSign size={40} className="empty-icon" />
                <h3>No payroll generated for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h3>
                <p>Click "Generate Monthly Payroll" to compute salaries for this period.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Base</th>
                      <th>Bonus/Allow</th>
                      <th>Tax/Deduct</th>
                      <th>Net Salary</th>
                      <th>Status</th>
                      <th>Disbursement</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgPayrolls.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.employee_name || `Emp #${p.employee_id}`}</strong>
                        </td>
                        <td>
                          <span className="dept-tag">{p.department || '-'}</span>
                        </td>
                        <td>${Number(p.base_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td style={{ color: '#059669' }}>
                          +${(Number(p.allowances) + Number(p.bonuses)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ color: '#dc2626' }}>
                          -${(Number(p.deductions) + Number(p.tax_deduction)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="salary-text">
                          ${Number(p.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td>{getStatusBadge(p.payment_status)}</td>
                        <td>{p.payment_date || '-'}</td>
                        <td className="text-right">
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="btn-action view"
                              title="View Payslip"
                              onClick={() => {
                                setSelectedPayslip(p);
                                setShowPayslipModal(true);
                              }}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn-action edit"
                              title="Adjust Bonus/Deductions"
                              onClick={() => handleOpenAdjust(p)}
                            >
                              <Edit size={16} />
                            </button>
                            {p.payment_status !== 'PAID' && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                                title="Mark as Paid"
                                onClick={() => {
                                  setPayingRecord(p);
                                  setShowPayModal(true);
                                }}
                              >
                                Disburse
                              </button>
                            )}
                          </div>
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

      {/* --- GENERATE PAYROLL MODAL --- */}
      {showGenerateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Generate Monthly Payroll Batch</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowGenerateModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGeneratePayroll} className="modal-body">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Pay Month *</label>
                  <select
                    value={generateForm.month}
                    onChange={(e) =>
                      setGenerateForm({ ...generateForm, month: e.target.value })
                    }
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Pay Year *</label>
                  <select
                    value={generateForm.year}
                    onChange={(e) =>
                      setGenerateForm({ ...generateForm, year: e.target.value })
                    }
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Target Employees</label>
                <select
                  value={generateForm.employee_id}
                  onChange={(e) =>
                    setGenerateForm({ ...generateForm, employee_id: e.target.value })
                  }
                >
                  <option value="">All Active Staff Members (Bulk Generation)</option>
                  {employeesList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="alert alert-info">
                <FileSpreadsheet size={18} />
                <span>
                  The system calculates monthly base salary (Annual / 12), applies estimated 10% tax deduction, and sets initial status as PENDING.
                </span>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGenerateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Compute & Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADJUST PAYROLL MODAL --- */}
      {showAdjustModal && adjustData && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Salary Adjustments: {adjustData.employee_name}</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowAdjustModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="modal-body">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Performance Bonuses ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.bonuses}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, bonuses: e.target.value })
                    }
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Allowances ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.allowances}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, allowances: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Deductions ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.deductions}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, deductions: e.target.value })
                    }
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Tax Deduction ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.tax_deduction}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, tax_deduction: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes / Adjustment Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Target Achievement Bonus"
                  value={adjustForm.notes}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, notes: e.target.value })
                  }
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAdjustModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Recalculate & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PAYSLIP DETAILS MODAL --- */}
      {showPayslipModal && selectedPayslip && (
        <div className="modal-backdrop">
          <div className="modal-card modal-profile">
            <div className="modal-header">
              <h3>Salary Statement / Payslip</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowPayslipModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body profile-content">
              <div className="profile-banner">
                <div className="brand-badge" style={{ margin: 0, width: 48, height: 48 }}>
                  <DollarSign size={24} />
                </div>
                <div className="profile-banner-info">
                  <h2>{selectedPayslip.employee_name || 'Staff Member'}</h2>
                  <p className="profile-designation">
                    {selectedPayslip.designation} &bull; {selectedPayslip.department}
                  </p>
                  <div className="profile-badges">
                    <span className="dept-tag">
                      Period: {MONTH_NAMES[selectedPayslip.month - 1]} {selectedPayslip.year}
                    </span>
                    {getStatusBadge(selectedPayslip.payment_status)}
                  </div>
                </div>
              </div>

              <div className="profile-details-grid">
                <div className="profile-detail-item">
                  <span className="detail-label">Monthly Base Salary</span>
                  <span className="detail-value">
                    ${Number(selectedPayslip.base_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="profile-detail-item">
                  <span className="detail-label">Allowances</span>
                  <span className="detail-value text-success">
                    +${Number(selectedPayslip.allowances).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="profile-detail-item">
                  <span className="detail-label">Bonuses</span>
                  <span className="detail-value text-success">
                    +${Number(selectedPayslip.bonuses).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="profile-detail-item">
                  <span className="detail-label">Other Deductions</span>
                  <span className="detail-value" style={{ color: '#dc2626' }}>
                    -${Number(selectedPayslip.deductions).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="profile-detail-item">
                  <span className="detail-label">Tax Deduction (10%)</span>
                  <span className="detail-value" style={{ color: '#dc2626' }}>
                    -${Number(selectedPayslip.tax_deduction).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="profile-detail-item">
                  <span className="detail-label">Disbursement Method</span>
                  <span className="detail-value">{selectedPayslip.payment_method}</span>
                </div>

                <div className="profile-detail-item" style={{ gridColumn: '1 / -1', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                  <span className="detail-label" style={{ color: '#047857' }}>Take-Home Net Salary</span>
                  <span className="detail-value" style={{ fontSize: '1.6rem', color: '#065f46' }}>
                    ${Number(selectedPayslip.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPayslipModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MARK AS PAID MODAL --- */}
      {showPayModal && payingRecord && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Confirm Salary Disbursement</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowPayModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <p>
                Disburse <strong>${Number(payingRecord.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> to <strong>{payingRecord.employee_name}</strong> for {MONTH_NAMES[payingRecord.month - 1]} {payingRecord.year}?
              </p>

              <div className="form-group mt-3">
                <label>Payment Channel</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Wire Transfer</option>
                  <option value="DIRECT_DEPOSIT">Direct Deposit</option>
                  <option value="CHEQUE">Corporate Cheque</option>
                  <option value="CASH">Cash Voucher</option>
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPayModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmPayment}
                >
                  <Check size={16} /> Confirm & Mark Disbursed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

