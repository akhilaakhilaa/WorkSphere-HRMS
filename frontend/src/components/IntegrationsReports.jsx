import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { integrationApi } from '../services/api';
import {
  Download,
  Calendar,
  FileSpreadsheet,
  FileText,
  Mail,
  ShieldCheck,
  Server,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
} from 'lucide-react';

const REPORT_OPTIONS = [
  { id: 'attendance', label: 'Attendance Records', desc: 'Daily punch logs, hours worked, and attendance status', roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
  { id: 'leaves', label: 'Leave Requests', desc: 'Leave history, categories, durations, and approval status', roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
  { id: 'performance', label: 'Performance Reviews', desc: 'Periodic appraisals, ratings, feedback, and reviewers', roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
  { id: 'tasks', label: 'Assigned Tasks', desc: 'Task lists, deadlines, priority, and completion status', roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
  { id: 'resignations', label: 'Exit & Resignations', desc: 'Resignation requests, notice periods, and reviews', roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
  { id: 'employees', label: 'Employee Directory', desc: 'Master employee roster, departments, and roles', roles: ['ADMIN', 'HR'], privileged: true },
  { id: 'payroll', label: 'Payroll Ledger', desc: 'Base compensation, allowances, deductions, and net salary', roles: ['ADMIN', 'HR'], privileged: true },
];

export default function IntegrationsReports() {
  const { role, user } = useAuth();
  const isAdminOrHr = role === 'ADMIN' || role === 'HR';

  // State
  const [selectedReport, setSelectedReport] = useState('attendance');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');
  const [exportError, setExportError] = useState('');

  const [calEvents, setCalEvents] = useState([]);
  const [loadingCal, setLoadingCal] = useState(false);
  const [downloadingIcs, setDownloadingIcs] = useState(false);

  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Load calendar events & system status
  useEffect(() => {
    loadCalendarEvents();
    if (isAdminOrHr) {
      loadSystemStatus();
    }
  }, [isAdminOrHr]);

  const loadCalendarEvents = async () => {
    setLoadingCal(true);
    try {
      const data = await integrationApi.getCalendarEvents();
      setCalEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load calendar events', err);
    } finally {
      setLoadingCal(false);
    }
  };

  const loadSystemStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await integrationApi.getStatus();
      setIntegrationStatus(data);
    } catch (err) {
      console.error('Failed to load integration status', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleExport = async (e) => {
    e.preventDefault();
    setExporting(true);
    setExportError('');
    setExportSuccess('');

    try {
      await integrationApi.exportReport(selectedReport, exportFormat);
      setExportSuccess(`Successfully downloaded ${selectedReport.toUpperCase()} report in ${exportFormat.toUpperCase()} format.`);
      setTimeout(() => setExportSuccess(''), 5000);
    } catch (err) {
      setExportError(err.message || 'Export failed. Please check permissions or try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadIcs = async () => {
    setDownloadingIcs(true);
    try {
      await integrationApi.exportCalendarIcs();
    } catch (err) {
      alert(`Failed to download calendar: ${err.message}`);
    } finally {
      setDownloadingIcs(false);
    }
  };

  return (
    <div className="section-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Integrations & Data Reports</h1>
          <p className="page-subtitle">
            Export company records securely, sync live calendars, and inspect third-party services.
          </p>
        </div>
      </div>

      {exportSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} /> {exportSuccess}
        </div>
      )}

      {exportError && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} /> {exportError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Card 1: Data Reports Export Center */}
        <div className="card-custom">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <FileSpreadsheet size={22} className="text-primary" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Report Export Center</h3>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Generate sanitized CSV spreadsheets or professionally formatted PDF documents. Sensitive spreadsheets feature automatic Formula Injection Defense.
          </p>

          <form onSubmit={handleExport}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem', fontSize: '0.875rem' }}>
                Select Dataset
              </label>
              <select
                className="form-control"
                value={selectedReport}
                onChange={(e) => setSelectedReport(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                {REPORT_OPTIONS.map((opt) => {
                  const allowed = opt.roles.includes(role);
                  return (
                    <option key={opt.id} value={opt.id} disabled={!allowed}>
                      {opt.label} {opt.privileged ? '(HR & Admin Only)' : ''} {!allowed ? '— Restricted' : ''}
                    </option>
                  );
                })}
              </select>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                {REPORT_OPTIONS.find((o) => o.id === selectedReport)?.desc}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem', fontSize: '0.875rem' }}>
                Export Format
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="radio"
                    name="exportFormat"
                    value="csv"
                    checked={exportFormat === 'csv'}
                    onChange={() => setExportFormat('csv')}
                  />
                  <span>CSV (Excel & Sheets with formula protection)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="radio"
                    name="exportFormat"
                    value="pdf"
                    checked={exportFormat === 'pdf'}
                    onChange={() => setExportFormat('pdf')}
                  />
                  <span>PDF (Printable Document)</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={exporting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {exporting ? (
                <>
                  <RefreshCw size={16} className="spin" /> Generating {exportFormat.toUpperCase()}...
                </>
              ) : (
                <>
                  <Download size={16} /> Download {exportFormat.toUpperCase()} Report
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck size={18} className="text-success" />
            <span>
              <strong>RBAC & Privacy Enforced:</strong> Regular employees only receive their own records. Directory and organization payroll are restricted to authorized administrators.
            </span>
          </div>
        </div>

        {/* Card 2: Live Calendar Synchronization */}
        <div className="card-custom">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar size={22} className="text-primary" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Calendar Sync (.ics)</h3>
            </div>
            <button
              onClick={handleDownloadIcs}
              className="btn btn-secondary btn-sm"
              disabled={downloadingIcs}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
            >
              <Download size={14} /> {downloadingIcs ? 'Exporting...' : 'Export Feed (.ics)'}
            </button>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            Subscribe or import approved leaves, shift rotations, and deadline tasks into Google Calendar, Outlook, or Apple Calendar.
          </p>

          <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem' }}>
            {loadingCal ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                Loading upcoming calendar events...
              </div>
            ) : calEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                No active calendar events found for your schedule.
              </div>
            ) : (
              calEvents.slice(0, 10).map((ev, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderBottom: idx === calEvents.length - 1 ? 'none' : '1px solid #f1f5f9',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{ev.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{ev.description || 'Calendar Event'}</div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '999px',
                      background:
                        ev.type === 'leave'
                          ? '#e0e7ff'
                          : ev.type === 'shift'
                          ? '#ecfdf5'
                          : ev.type === 'task'
                          ? '#fef3c7'
                          : '#f1f5f9',
                      color:
                        ev.type === 'leave'
                          ? '#3730a3'
                          : ev.type === 'shift'
                          ? '#065f46'
                          : ev.type === 'task'
                          ? '#92400e'
                          : '#334155',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    {ev.type || 'Event'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Admin Integrations Status Grid */}
      {isAdminOrHr && (
        <div className="card-custom">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Server size={22} className="text-primary" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>External Integrations Status</h3>
            </div>
            <button
              onClick={loadSystemStatus}
              className="btn btn-outline btn-sm"
              disabled={loadingStatus}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
            >
              <RefreshCw size={14} className={loadingStatus ? 'spin' : ''} /> Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* SMTP Status */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={16} /> SMTP Email Service
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    background: integrationStatus?.smtp?.configured ? '#dcfce7' : '#fee2e2',
                    color: integrationStatus?.smtp?.configured ? '#166534' : '#991b1b',
                  }}
                >
                  {integrationStatus?.smtp?.dev_mode ? 'DEV SIMULATION' : integrationStatus?.smtp?.configured ? 'LIVE' : 'UNCONFIGURED'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', display: 'grid', gap: '0.35rem' }}>
                <div>Host: <strong>{integrationStatus?.smtp?.host || 'smtp.gmail.com'}</strong></div>
                <div>Port: <strong>{integrationStatus?.smtp?.port || '587'} (TLS: {integrationStatus?.smtp?.tls ? 'Active' : 'Off'})</strong></div>
                <div>Sender: <strong>{integrationStatus?.smtp?.from_address || 'noreply@worksphere.com'}</strong></div>
              </div>
            </div>

            {/* Calendar Protocol */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={16} /> iCalendar RFC 5545
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#dcfce7', color: '#166534' }}>
                  ACTIVE
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', display: 'grid', gap: '0.35rem' }}>
                <div>Format: <strong>iCalendar 2.0 (.ics)</strong></div>
                <div>Endpoints: <strong>/api/calendar/events & .ics</strong></div>
                <div>Events Supported: <strong>Leaves, Shifts, Tasks</strong></div>
              </div>
            </div>

            {/* Export Engine */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={16} /> Data Export Engine
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#dcfce7', color: '#166534' }}>
                  READY
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', display: 'grid', gap: '0.35rem' }}>
                <div>Engines: <strong>ReportLab 5.1 (PDF), Python CSV</strong></div>
                <div>Security: <strong>Formula Injection Sanitization</strong></div>
                <div>Reports: <strong>7 Standard HRMS Datasets</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

