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
  Printer,
  PieChart,
  Layers,
  TrendingUp,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollManagement() {
  const { role, user } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  const [activeSubTab, setActiveSubTab] = useState('my_payroll'); // 'my_payroll' | 'org_payroll' | 'monthly_summary'
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

  // Monthly Summary Tab filters & state
  const [summaryMonth, setSummaryMonth] = useState(currentDate.getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(currentDate.getFullYear());
  const [monthlySummaryData, setMonthlySummaryData] = useState(null);
  const [monthlyRoster, setMonthlyRoster] = useState([]);
  const [loadingSummaryTab, setLoadingSummaryTab] = useState(false);

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
    hra: '0.00',
    transport_allowance: '0.00',
    medical_allowance: '0.00',
    bonuses: '0.00',
    allowances: '0.00',
    provident_fund: '0.00',
    tax_deduction: '0.00',
    deductions: '0.00',
    notes: '',
  });

  // Payslip Modal
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Detailed Breakdown Modal
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownData, setBreakdownData] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

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

  const fetchMonthlySummaryTab = async () => {
    if (!isHrOrAdmin) return;
    setLoadingSummaryTab(true);
    try {
      const [mSummary, roster] = await Promise.all([
        payrollApi.getMonthlySummary(summaryMonth, summaryYear),
        payrollApi.listAll({ month: summaryMonth, year: summaryYear }),
      ]);
      setMonthlySummaryData(mSummary);
      setMonthlyRoster(roster);
    } catch (err) {
      setError(err.message || 'Failed to fetch monthly payroll summary');
    } finally {
      setLoadingSummaryTab(false);
    }
  };

  useEffect(() => {
    fetchMyPayrollAndSummary();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'org_payroll' && isHrOrAdmin) {
      fetchOrgPayroll();
    } else if (activeSubTab === 'monthly_summary' && isHrOrAdmin) {
      fetchMonthlySummaryTab();
    }
  }, [activeSubTab, selectedMonth, selectedYear, selectedStatus, summaryMonth, summaryYear]);

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
      if (activeSubTab === 'monthly_summary') fetchMonthlySummaryTab();
    } catch (err) {
      setError(err.message || 'Failed to generate payroll');
    }
  };

  // Handle Open Adjust Modal
  const handleOpenAdjust = (p) => {
    setAdjustData(p);
    setAdjustForm({
      hra: p.hra ? String(p.hra) : '0.00',
      transport_allowance: p.transport_allowance ? String(p.transport_allowance) : '0.00',
      medical_allowance: p.medical_allowance ? String(p.medical_allowance) : '0.00',
      bonuses: p.bonuses ? String(p.bonuses) : '0.00',
      allowances: p.allowances ? String(p.allowances) : '0.00',
      provident_fund: p.provident_fund ? String(p.provident_fund) : '0.00',
      deductions: p.deductions ? String(p.deductions) : '0.00',
      tax_deduction: p.tax_deduction ? String(p.tax_deduction) : '0.00',
      notes: p.notes || '',
    });
    setShowAdjustModal(true);
  };

  // Calculate live preview in adjust form
  const liveBase = adjustData ? Number(adjustData.base_salary || 0) : 0;
  const liveGross = liveBase +
    Number(adjustForm.hra || 0) +
    Number(adjustForm.transport_allowance || 0) +
    Number(adjustForm.medical_allowance || 0) +
    Number(adjustForm.bonuses || 0) +
    Number(adjustForm.allowances || 0);
  const liveDeductions =
    Number(adjustForm.tax_deduction || 0) +
    Number(adjustForm.provident_fund || 0) +
    Number(adjustForm.deductions || 0);
  const liveNet = liveGross - liveDeductions;

  // Handle Save Adjust
  const handleSaveAdjust = async (e) => {
    e.preventDefault();
    if (!adjustData) return;
    if (liveNet < 0) {
      setError('Deductions cannot exceed gross salary. Net salary cannot be negative.');
      return;
    }
    try {
      await payrollApi.update(adjustData.id, {
        hra: parseFloat(adjustForm.hra) || 0,
        transport_allowance: parseFloat(adjustForm.transport_allowance) || 0,
        medical_allowance: parseFloat(adjustForm.medical_allowance) || 0,
        bonuses: parseFloat(adjustForm.bonuses) || 0,
        allowances: parseFloat(adjustForm.allowances) || 0,
        provident_fund: parseFloat(adjustForm.provident_fund) || 0,
        deductions: parseFloat(adjustForm.deductions) || 0,
        tax_deduction: parseFloat(adjustForm.tax_deduction) || 0,
        notes: adjustForm.notes,
      });
      setShowAdjustModal(false);
      setAdjustData(null);
      setSuccessMsg('Salary components saved and gross/net recalculated!');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOrgPayroll();
      fetchMyPayrollAndSummary();
      if (activeSubTab === 'monthly_summary') fetchMonthlySummaryTab();
    } catch (err) {
      setError(err.message || 'Failed to adjust payroll');
    }
  };

  // Handle Open Detailed Breakdown
  const handleOpenBreakdown = async (record) => {
    setLoadingBreakdown(true);
    setShowBreakdownModal(true);
    try {
      const data = await payrollApi.getBreakdown(record.id);
      setBreakdownData(data);
    } catch (err) {
      // Fallback to record data if breakdown endpoint fails
      setBreakdownData(record);
    } finally {
      setLoadingBreakdown(false);
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
      if (activeSubTab === 'monthly_summary') fetchMonthlySummaryTab();
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
      case 'PARTIALLY_PAID':
        return <span className="status-badge badge-leave">PARTIALLY PAID</span>;
      case 'NO_RECORDS':
        return <span className="status-badge">NO RECORDS</span>;
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
            Generate monthly salaries, manage deductions & allowances, view salary breakdowns and official payslips
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

      {/* Top Level Metric Cards */}
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
            <>
              <button
                type="button"
                className={`sub-tab ${activeSubTab === 'org_payroll' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('org_payroll')}
              >
                <Building size={16} /> Company Payroll Roster
              </button>
              <button
                type="button"
                className={`sub-tab ${activeSubTab === 'monthly_summary' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('monthly_summary')}
              >
                <PieChart size={16} /> Monthly Payroll Summary
              </button>
            </>
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
                      <th>Basic Salary</th>
                      <th>Allowances & Bonuses</th>
                      <th>Gross Salary</th>
                      <th>Deductions & Taxes</th>
                      <th>Net Take-Home</th>
                      <th>Status</th>
                      <th>Disbursement</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPayrolls.map((p) => {
                      const gross = Number(p.gross_salary || (Number(p.base_salary) + Number(p.hra || 0) + Number(p.transport_allowance || 0) + Number(p.medical_allowance || 0) + Number(p.allowances || 0) + Number(p.bonuses || 0)));
                      const totalDeduct = Number(p.total_deductions || (Number(p.deductions || 0) + Number(p.tax_deduction || 0) + Number(p.provident_fund || 0)));
                      const allowancesTotal = gross - Number(p.base_salary);

                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{MONTH_NAMES[p.month - 1]} {p.year}</strong>
                          </td>
                          <td>${Number(p.base_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td style={{ color: '#059669' }}>
                            +${allowancesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            ${gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ color: '#dc2626' }}>
                            -${totalDeduct.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="salary-text">
                            ${Number(p.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td>{getStatusBadge(p.payment_status)}</td>
                          <td>{p.payment_date || 'Pending'}</td>
                          <td className="text-right">
                            <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                title="Salary Breakdown"
                                onClick={() => handleOpenBreakdown(p)}
                              >
                                <Layers size={14} /> Breakdown
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                title="Official Payslip"
                                onClick={() => {
                                  setSelectedPayslip(p);
                                  setShowPayslipModal(true);
                                }}
                              >
                                <Eye size={14} /> Payslip
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
                <p className="table-subtitle">Inspect salaries, customize allowances & deductions, and disburse payments</p>
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
                      <th>Basic Salary</th>
                      <th>Allowances & Bonuses</th>
                      <th>Gross Salary</th>
                      <th>Deductions</th>
                      <th>Net Salary</th>
                      <th>Status</th>
                      <th>Payment Date</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgPayrolls.map((p) => {
                      const gross = Number(p.gross_salary || (Number(p.base_salary) + Number(p.hra || 0) + Number(p.transport_allowance || 0) + Number(p.medical_allowance || 0) + Number(p.allowances || 0) + Number(p.bonuses || 0)));
                      const totalDeduct = Number(p.total_deductions || (Number(p.deductions || 0) + Number(p.tax_deduction || 0) + Number(p.provident_fund || 0)));
                      const allowancesTotal = gross - Number(p.base_salary);

                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.employee_name || `Emp #${p.employee_id}`}</strong>
                          </td>
                          <td>
                            <span className="dept-tag">{p.department || '-'}</span>
                          </td>
                          <td>${Number(p.base_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td style={{ color: '#059669' }}>
                            +${allowancesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            ${gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ color: '#dc2626' }}>
                            -${totalDeduct.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="salary-text">
                            ${Number(p.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td>{getStatusBadge(p.payment_status)}</td>
                          <td>{p.payment_date || '-'}</td>
                          <td className="text-right">
                            <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn-action view"
                                title="Salary Breakdown"
                                onClick={() => handleOpenBreakdown(p)}
                              >
                                <Layers size={16} />
                              </button>
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
                                title="Adjust Allowances & Deductions"
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- Subtab 3: Monthly Payroll Summary (HR/Admin) --- */}
        {activeSubTab === 'monthly_summary' && isHrOrAdmin && (
          <div className="table-card">
            <div className="table-card-header">
              <div>
                <h3>Monthly Payroll Summary & Analytics</h3>
                <p className="table-subtitle">Select month and year to view organization aggregate metrics and status</p>
              </div>
            </div>

            {/* Month & Year Selectors */}
            <div className="filters-card no-margin">
              <div className="filter-group">
                <div className="select-with-icon">
                  <Calendar size={16} className="select-icon" />
                  <select
                    value={summaryMonth}
                    onChange={(e) => setSummaryMonth(parseInt(e.target.value))}
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
                    value={summaryYear}
                    onChange={(e) => setSummaryYear(parseInt(e.target.value))}
                    className="filter-select"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {loadingSummaryTab ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading monthly summary...
              </div>
            ) : monthlySummaryData ? (
              <div>
                {/* Metrics Breakdown Cards */}
                <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-icon-wrapper icon-blue">
                      <FileSpreadsheet size={22} />
                    </div>
                    <div className="stat-content">
                      <span className="stat-label">Employees Processed</span>
                      <span className="stat-value">{monthlySummaryData.total_employees}</span>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon-wrapper icon-purple">
                      <TrendingUp size={22} />
                    </div>
                    <div className="stat-content">
                      <span className="stat-label">Total Gross Payroll</span>
                      <span className="stat-value">
                        ${Number(monthlySummaryData.total_gross_payroll || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon-wrapper icon-yellow">
                      <AlertCircle size={22} />
                    </div>
                    <div className="stat-content">
                      <span className="stat-label">Total Deductions</span>
                      <span className="stat-value" style={{ color: '#dc2626' }}>
                        -${Number(monthlySummaryData.total_deductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon-wrapper icon-green">
                      <DollarSign size={22} />
                    </div>
                    <div className="stat-content">
                      <span className="stat-label">Total Net Payroll</span>
                      <span className="stat-value" style={{ color: '#059669' }}>
                        ${Number(monthlySummaryData.total_net_payroll || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div>
                    <strong>Period: </strong> {MONTH_NAMES[summaryMonth - 1]} {summaryYear} &nbsp;&bull;&nbsp;
                    <strong> Basic Salary Total: </strong> ${Number(monthlySummaryData.total_basic_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} &nbsp;&bull;&nbsp;
                    <strong> Allowances Total: </strong> +${Number(monthlySummaryData.total_allowances || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div>
                    <span style={{ marginRight: '8px', fontSize: '0.88rem', fontWeight: 600 }}>Period Status:</span>
                    {getStatusBadge(monthlySummaryData.payroll_status)}
                  </div>
                </div>

                {/* Period Roster Table */}
                {monthlyRoster.length === 0 ? (
                  <div className="empty-state">
                    <CreditCard size={40} className="empty-icon" />
                    <h3>No payroll records found for {MONTH_NAMES[summaryMonth - 1]} {summaryYear}</h3>
                    <p>Switch to Company Payroll Roster and generate payroll for this period.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Basic Salary</th>
                          <th>Gross Salary</th>
                          <th>Deductions</th>
                          <th>Net Salary</th>
                          <th>Status</th>
                          <th className="text-right">Breakdown</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyRoster.map((r) => {
                          const gross = Number(r.gross_salary || (Number(r.base_salary) + Number(r.hra || 0) + Number(r.transport_allowance || 0) + Number(r.medical_allowance || 0) + Number(r.allowances || 0) + Number(r.bonuses || 0)));
                          const totalDeduct = Number(r.total_deductions || (Number(r.deductions || 0) + Number(r.tax_deduction || 0) + Number(r.provident_fund || 0)));

                          return (
                            <tr key={r.id}>
                              <td>
                                <strong>{r.employee_name || `Emp #${r.employee_id}`}</strong>
                              </td>
                              <td><span className="dept-tag">{r.department || '-'}</span></td>
                              <td>${Number(r.base_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td style={{ fontWeight: 600 }}>${gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td style={{ color: '#dc2626' }}>-${totalDeduct.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td className="salary-text">${Number(r.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td>{getStatusBadge(r.payment_status)}</td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                  onClick={() => handleOpenBreakdown(r)}
                                >
                                  <Layers size={14} /> View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
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
                  The system calculates monthly base salary (Annual / 12), applies standard 10% tax deduction, sets gross & net salary, and initial status as PENDING.
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

      {/* --- ADJUST PAYROLL MODAL (WITH DETAILED COMPONENTS) --- */}
      {showAdjustModal && adjustData && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Salary Breakdown Adjustments: {adjustData.employee_name}</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowAdjustModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="modal-body">
              <div style={{ marginBottom: '1rem', padding: '10px 14px', background: '#f1f5f9', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: '#475569' }}>Fixed Base Salary: </span>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                  ${liveBase.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
              </div>

              {/* Earnings Components */}
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#059669', marginBottom: '8px' }}>
                Earnings & Allowance Components
              </h4>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>House Rent Allowance (HRA) ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.hra}
                    onChange={(e) => setAdjustForm({ ...adjustForm, hra: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Transport Allowance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.transport_allowance}
                    onChange={(e) => setAdjustForm({ ...adjustForm, transport_allowance: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Medical Allowance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.medical_allowance}
                    onChange={(e) => setAdjustForm({ ...adjustForm, medical_allowance: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Performance Bonuses ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.bonuses}
                    onChange={(e) => setAdjustForm({ ...adjustForm, bonuses: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Other Allowances ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.allowances}
                    onChange={(e) => setAdjustForm({ ...adjustForm, allowances: e.target.value })}
                  />
                </div>
              </div>

              {/* Deductions Components */}
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#dc2626', marginTop: '12px', marginBottom: '8px' }}>
                Deductions & Statutory Components
              </h4>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Tax Deduction ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.tax_deduction}
                    onChange={(e) => setAdjustForm({ ...adjustForm, tax_deduction: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Provident Fund (PF) ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.provident_fund}
                    onChange={(e) => setAdjustForm({ ...adjustForm, provident_fund: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Other Deductions ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustForm.deductions}
                    onChange={(e) => setAdjustForm({ ...adjustForm, deductions: e.target.value })}
                  />
                </div>
              </div>

              {/* Live Preview Banner */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '6px',
                  background: liveNet >= 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${liveNet >= 0 ? '#bbf7d0' : '#fecaca'}`,
                  margin: '12px 0',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.78rem', color: '#475569', display: 'block' }}>Calculated Gross</span>
                  <strong style={{ color: '#059669', fontSize: '1.1rem' }}>
                    ${liveGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: '#475569', display: 'block' }}>Total Deductions</span>
                  <strong style={{ color: '#dc2626', fontSize: '1.1rem' }}>
                    -${liveDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: '#475569', display: 'block' }}>Net Take-Home</span>
                  <strong style={{ color: liveNet >= 0 ? '#047857' : '#b91c1c', fontSize: '1.2rem' }}>
                    ${liveNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              <div className="form-group">
                <label>Notes / Adjustment Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Target Achievement Bonus & PF adjustment"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
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
                <button type="submit" className="btn btn-primary" disabled={liveNet < 0}>
                  Recalculate & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DETAILED SALARY BREAKDOWN VIEW MODAL --- */}
      {showBreakdownModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>Detailed Salary Breakdown</h3>
              <button
                className="modal-close-btn"
                onClick={() => {
                  setShowBreakdownModal(false);
                  setBreakdownData(null);
                }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingBreakdown ? (
              <div className="loading-state">
                <span className="spinner"></span> Loading salary breakdown...
              </div>
            ) : breakdownData ? (
              <div className="modal-body">
                {/* Employee and Period Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                      {breakdownData.employee_name || `Employee #${breakdownData.employee_id}`}
                    </h2>
                    <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: '0.88rem' }}>
                      {breakdownData.designation || 'Staff Member'} &bull; {breakdownData.department || 'General'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                      {MONTH_NAMES[breakdownData.month - 1]} {breakdownData.year}
                    </div>
                    <div>{getStatusBadge(breakdownData.payment_status)}</div>
                  </div>
                </div>

                {/* Two-Column Breakdown: Earnings vs Deductions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                  {/* Earnings Column */}
                  <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '14px', border: '1px solid #bbf7d0' }}>
                    <h4 style={{ color: '#047857', margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 700, borderBottom: '1px solid #bbf7d0', paddingBottom: '6px' }}>
                      Earnings & Allowances
                    </h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                      <span>Basic Salary:</span>
                      <strong>${Number(breakdownData.basic_salary || breakdownData.base_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                      <span>House Rent (HRA):</span>
                      <span>+${Number(breakdownData.hra || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                      <span>Transport Allowance:</span>
                      <span>+${Number(breakdownData.transport_allowance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                      <span>Medical Allowance:</span>
                      <span>+${Number(breakdownData.medical_allowance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                      <span>Performance Bonus:</span>
                      <span>+${Number(breakdownData.bonuses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                      <span>Other Allowances:</span>
                      <span>+${Number(breakdownData.other_allowances || breakdownData.allowances || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #86efac', paddingTop: '6px', fontWeight: 700, color: '#065f46' }}>
                      <span>Gross Salary:</span>
                      <span>${Number(breakdownData.gross_salary || (Number(breakdownData.base_salary) + Number(breakdownData.hra || 0) + Number(breakdownData.transport_allowance || 0) + Number(breakdownData.medical_allowance || 0) + Number(breakdownData.allowances || 0) + Number(breakdownData.bonuses || 0))).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Deductions Column */}
                  <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '14px', border: '1px solid #fecaca' }}>
                    <h4 style={{ color: '#b91c1c', margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 700, borderBottom: '1px solid #fecaca', paddingBottom: '6px' }}>
                      Deductions & Taxes
                    </h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                      <span>Income Tax (10%):</span>
                      <span>-${Number(breakdownData.tax_deduction || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                      <span>Provident Fund (PF):</span>
                      <span>-${Number(breakdownData.provident_fund || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                      <span>Other Deductions:</span>
                      <span>-${Number(breakdownData.other_deductions || breakdownData.deductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #fca5a5', paddingTop: '6px', fontWeight: 700, color: '#991b1b' }}>
                      <span>Total Deductions:</span>
                      <span>-${Number(breakdownData.total_deductions || (Number(breakdownData.tax_deduction || 0) + Number(breakdownData.provident_fund || 0) + Number(breakdownData.deductions || 0))).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Net Salary Highlight */}
                <div style={{ background: '#ecfdf5', borderRadius: '8px', padding: '14px 18px', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>Net Take-Home Salary</span>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#065f46' }}>Gross Salary minus Total Deductions</p>
                  </div>
                  <strong style={{ fontSize: '1.6rem', color: '#065f46' }}>
                    ${Number(breakdownData.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div className="modal-footer" style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowBreakdownModal(false);
                      setBreakdownData(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* --- DETAILED PAYSLIP MODAL (WITH PRINT CAPABILITY) --- */}
      {showPayslipModal && selectedPayslip && (
        <div className="modal-backdrop">
          <div className="modal-card modal-profile" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3>WorkSphere HRMS — Official Payslip</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  className="modal-close-btn"
                  onClick={() => setShowPayslipModal(false)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="modal-body profile-content" id="printable-payslip">
              <div className="profile-banner">
                <div className="brand-badge" style={{ margin: 0, width: 48, height: 48 }}>
                  <DollarSign size={24} />
                </div>
                <div className="profile-banner-info">
                  <h2>{selectedPayslip.employee_name || 'Staff Member'}</h2>
                  <p className="profile-designation">
                    {selectedPayslip.designation || 'Specialist'} &bull; {selectedPayslip.department || 'Operations'} &bull; ID #{selectedPayslip.employee_id}
                  </p>
                  <div className="profile-badges">
                    <span className="dept-tag">
                      Pay Period: {MONTH_NAMES[selectedPayslip.month - 1]} {selectedPayslip.year}
                    </span>
                    {getStatusBadge(selectedPayslip.payment_status)}
                  </div>
                </div>
              </div>

              {/* Two Column Detailed Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '16px 0' }}>
                {/* Earnings Column */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#059669', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                    Earnings Components
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                    <span>Basic Salary:</span>
                    <strong>${Number(selectedPayslip.base_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                    <span>HRA Allowance:</span>
                    <span>+${Number(selectedPayslip.hra || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                    <span>Transport Allowance:</span>
                    <span>+${Number(selectedPayslip.transport_allowance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                    <span>Medical Allowance:</span>
                    <span>+${Number(selectedPayslip.medical_allowance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                    <span>Performance Bonus:</span>
                    <span>+${Number(selectedPayslip.bonuses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                    <span>Other Allowances:</span>
                    <span>+${Number(selectedPayslip.allowances || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: '4px', borderTop: '1px solid #cbd5e1', fontWeight: 700, color: '#059669' }}>
                    <span>Gross Earnings:</span>
                    <span>${Number(selectedPayslip.gross_salary || (Number(selectedPayslip.base_salary) + Number(selectedPayslip.hra || 0) + Number(selectedPayslip.transport_allowance || 0) + Number(selectedPayslip.medical_allowance || 0) + Number(selectedPayslip.allowances || 0) + Number(selectedPayslip.bonuses || 0))).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Deductions Column */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#dc2626', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                    Deductions & Taxes
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                    <span>Income Tax:</span>
                    <span style={{ color: '#dc2626' }}>-${Number(selectedPayslip.tax_deduction || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                    <span>Provident Fund (PF):</span>
                    <span style={{ color: '#dc2626' }}>-${Number(selectedPayslip.provident_fund || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                    <span>Other Deductions:</span>
                    <span style={{ color: '#dc2626' }}>-${Number(selectedPayslip.deductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: '36px', borderTop: '1px solid #cbd5e1', fontWeight: 700, color: '#dc2626' }}>
                    <span>Total Deductions:</span>
                    <span>-${Number(selectedPayslip.total_deductions || (Number(selectedPayslip.tax_deduction || 0) + Number(selectedPayslip.provident_fund || 0) + Number(selectedPayslip.deductions || 0))).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Net Salary Card */}
              <div className="profile-detail-item" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', padding: '16px', marginBottom: '16px' }}>
                <span className="detail-label" style={{ color: '#047857' }}>Net Take-Home Salary</span>
                <span className="detail-value" style={{ fontSize: '1.8rem', color: '#065f46' }}>
                  ${Number(selectedPayslip.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Payment Details Footer */}
              <div className="profile-details-grid">
                <div className="profile-detail-item">
                  <span className="detail-label">Payment Channel</span>
                  <span className="detail-value">{selectedPayslip.payment_method || 'BANK_TRANSFER'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Disbursement Date</span>
                  <span className="detail-value">{selectedPayslip.payment_date || 'Pending'}</span>
                </div>
                <div className="profile-detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="detail-label">Notes & Remarks</span>
                  <span className="detail-value">{selectedPayslip.notes || 'No adjustment notes recorded'}</span>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '16px' }}>
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
