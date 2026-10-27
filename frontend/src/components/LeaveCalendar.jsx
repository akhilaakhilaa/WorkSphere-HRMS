import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { leaveApi, employeeApi } from '../services/api';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  CalendarCheck,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Info,
  Building,
  Briefcase,
  X,
  ShieldAlert,
} from 'lucide-react';

export default function LeaveCalendar() {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // Current calendar view date (defaults to current month/year)
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'

  // Data states
  const [calendarLeaves, setCalendarLeaves] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [includePending, setIncludePending] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Details Modal
  const [selectedLeave, setSelectedLeave] = useState(null);

  // Departments list extracted from availability or employees
  const departments = availability?.department_summaries?.map((d) => d.department) || [
    'Engineering',
    'Human Resources',
    'Sales',
    'Marketing',
    'Finance',
  ];

  // Helper: Format Date YYYY-MM-DD
  const formatDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Compute month start and end dates
  const getMonthDateRange = (dateObj) => {
    const start = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const end = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
    return {
      start_date: formatDateStr(start),
      end_date: formatDateStr(end),
    };
  };

  // Compute week start and end dates (Sunday to Saturday)
  const getWeekDateRange = (dateObj) => {
    const day = dateObj.getDay();
    const start = new Date(dateObj);
    start.setDate(dateObj.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start_date: formatDateStr(start),
      end_date: formatDateStr(end),
      startObj: start,
      endObj: end,
    };
  };

  // Load all data
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const range = viewMode === 'month' ? getMonthDateRange(currentDate) : getWeekDateRange(currentDate);

      // Load calendar leaves
      const leavesPromise = leaveApi.getCalendar({
        start_date: range.start_date,
        end_date: range.end_date,
        department: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
        employee_id: selectedEmployeeId || undefined,
        include_pending: includePending,
      });

      // Load team availability for today
      const availPromise = leaveApi.getTeamAvailability({
        department: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
      });

      // Load conflicts for HR/Admin
      const conflictsPromise = isHrOrAdmin
        ? leaveApi.getConflicts({
            department: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
            start_date: range.start_date,
            end_date: range.end_date,
          }).catch(() => [])
        : Promise.resolve([]);

      // Load employees list for filter dropdown if HR/Admin
      const employeesPromise = isHrOrAdmin ? employeeApi.list().catch(() => []) : Promise.resolve([]);

      const [leavesData, availData, conflictsData, empList] = await Promise.all([
        leavesPromise,
        availPromise,
        conflictsPromise,
        employeesPromise,
      ]);

      setCalendarLeaves(leavesData || []);
      setAvailability(availData);
      setConflicts(conflictsData || []);
      if (empList && empList.length > 0) setEmployees(empList);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load leave calendar data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentDate, viewMode, selectedDepartment, selectedEmployeeId, includePending]);

  // Month navigation handlers
  const prevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const gotoToday = () => {
    setCurrentDate(new Date());
  };

  // Leave Type Color mapping
  const getChipClass = (leaveType) => {
    switch (leaveType) {
      case 'ANNUAL':
        return 'chip-annual';
      case 'CASUAL':
        return 'chip-casual';
      case 'SICK':
        return 'chip-sick';
      case 'MATERNITY':
      case 'PATERNITY':
        return 'chip-maternity';
      case 'UNPAID':
      default:
        return 'chip-unpaid';
    }
  };

  // Filter leaves matching text search
  const filteredLeaves = calendarLeaves.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.employee_name.toLowerCase().includes(q) ||
      l.department.toLowerCase().includes(q) ||
      l.leave_type.toLowerCase().includes(q)
    );
  });

  // Build Monthly Calendar Grid Cells
  const renderMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = formatDateStr(new Date());
    const cells = [];

    // 1. Previous month padding cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = formatDateStr(prevDate);
      cells.push({
        date: prevDate,
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // 2. Current month cells
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      const dateStr = formatDateStr(currDate);
      cells.push({
        date: currDate,
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // 3. Next month padding cells to complete 35 or 42 cells grid
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = formatDateStr(nextDate);
      cells.push({
        date: nextDate,
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return (
      <div className="calendar-month-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((wd) => (
          <div key={wd} className="calendar-weekday-header">
            {wd}
          </div>
        ))}

        {cells.map((cell) => {
          // Leaves covering this cell's date
          const dayLeaves = filteredLeaves.filter(
            (l) => l.start_date <= cell.dateStr && l.end_date >= cell.dateStr
          );

          return (
            <div
              key={cell.dateStr}
              className={`calendar-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${
                cell.isToday ? 'is-today' : ''
              }`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="calendar-day-number">{cell.dayNum}</span>
                {dayLeaves.length > 2 && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {dayLeaves.length} away
                  </span>
                )}
              </div>

              <div className="calendar-day-leaves">
                {dayLeaves.map((l) => (
                  <div
                    key={`${l.id}-${cell.dateStr}`}
                    className={`calendar-leave-chip ${getChipClass(l.leave_type)} ${
                      !l.is_confirmed ? 'pending' : ''
                    }`}
                    onClick={() => setSelectedLeave(l)}
                    title={`${l.employee_name} (${l.department}) - ${l.leave_type} [${l.status}]`}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.employee_name.split(' ')[0]}
                    </span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>
                      {!l.is_confirmed ? 'P' : l.leave_type.slice(0, 1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Build Weekly View Columns
  const renderWeekGrid = () => {
    const week = getWeekDateRange(currentDate);
    const days = [];
    const todayStr = formatDateStr(new Date());

    for (let i = 0; i < 7; i++) {
      const d = new Date(week.startObj);
      d.setDate(week.startObj.getDate() + i);
      const dateStr = formatDateStr(d);
      days.push({
        date: d,
        dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        isToday: dateStr === todayStr,
      });
    }

    return (
      <div className="calendar-week-grid">
        {days.map((day) => {
          const dayLeaves = filteredLeaves.filter(
            (l) => l.start_date <= day.dateStr && l.end_date >= day.dateStr
          );

          return (
            <div key={day.dateStr} className={`calendar-week-col ${day.isToday ? 'is-today' : ''}`}>
              <div className="week-col-header">
                <div className="week-col-day">{day.dayName}</div>
                <div className="week-col-date">{day.dayNum}</div>
                {day.isToday && (
                  <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                    Today
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {dayLeaves.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '20px' }}>
                    All staff available
                  </div>
                ) : (
                  dayLeaves.map((l) => (
                    <div
                      key={`${l.id}-${day.dateStr}`}
                      className={`calendar-leave-chip ${getChipClass(l.leave_type)} ${
                        !l.is_confirmed ? 'pending' : ''
                      }`}
                      style={{ padding: '6px 8px', borderRadius: '6px' }}
                      onClick={() => setSelectedLeave(l)}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{l.employee_name}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                          {l.department} &bull; {l.leave_type}
                        </div>
                      </div>
                      <span className="badge" style={{ fontSize: '0.65rem', background: '#fff', color: '#1e293b' }}>
                        {l.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const monthYearLabel = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <CalendarIcon size={28} style={{ color: 'var(--primary)', verticalAlign: 'middle', marginRight: '8px' }} />
            Leave Calendar & Team Availability
          </h1>
          <p className="page-subtitle">
            Visual roster of approved leaves, team coverage metrics, and scheduling conflict analysis.
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. TEAM AVAILABILITY KPI SUMMARY CARDS (MODULE 15B)            */}
      {/* ------------------------------------------------------------- */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper icon-blue">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Active Staff</span>
            <span className="stat-value">{availability?.total_active_employees ?? '—'}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper icon-amber">
            <CalendarCheck size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">On Approved Leave Today</span>
            <span className="stat-value highlight" style={{ color: '#d97706' }}>
              {availability?.employees_on_leave_today_count ?? '0'}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper icon-green">
            <UserCheck size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Not Recorded On Leave</span>
            <span className="stat-value" style={{ color: '#059669' }}>
              {availability?.employees_not_on_leave_today_count ?? '—'}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper icon-purple">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Upcoming Leaves (30d)</span>
            <span className="stat-value">{availability?.upcoming_leaves?.length ?? '0'}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. LEAVE CONFLICT WARNINGS PANEL (MODULE 15C - HR/ADMIN)       */}
      {/* ------------------------------------------------------------- */}
      {isHrOrAdmin && conflicts.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              fontWeight: 700,
              color: '#b45309',
            }}
          >
            <ShieldAlert size={20} />
            <span>Team Coverage & Overlap Warnings ({conflicts.length})</span>
          </div>
          <div
            style={{
              background: '#fff',
              border: '1px solid #fef3c7',
              borderTop: 'none',
              borderBottomLeftRadius: '8px',
              borderBottomRightRadius: '8px',
              padding: '16px',
            }}
          >
            {conflicts.map((conf) => (
              <div key={conf.id} className={`conflict-card ${conf.severity.toLowerCase()}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span
                      className="badge"
                      style={{
                        background: conf.severity === 'HIGH' ? '#fee2e2' : '#fef3c7',
                        color: conf.severity === 'HIGH' ? '#991b1b' : '#92400e',
                        fontWeight: 700,
                        marginRight: '8px',
                      }}
                    >
                      {conf.severity} PRIORITY
                    </span>
                    <strong style={{ fontSize: '0.95rem' }}>{conf.department} Department</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '8px' }}>
                      ({conf.start_date} &rarr; {conf.end_date}, {conf.total_days_overlap} days concurrent)
                    </span>
                  </div>
                  <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}>
                    {conf.conflict_type}
                  </span>
                </div>
                <p style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>{conf.message}</p>
                <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#6b7280' }}>
                  <strong>Recommendation:</strong> {conf.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. FILTERS & CONTROLS BAR                                     */}
      {/* ------------------------------------------------------------- */}
      <div className="filters-card" style={{ marginBottom: '1.25rem', padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Department Filter */}
          <div className="select-with-icon" style={{ minWidth: '180px' }}>
            <Building size={16} className="select-icon" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Employee Filter (HR/Admin) */}
          {isHrOrAdmin && employees.length > 0 && (
            <div className="select-with-icon" style={{ minWidth: '200px' }}>
              <Users size={16} className="select-icon" />
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="filter-select"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.department})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="select-with-icon" style={{ flex: 1, minWidth: '180px' }}>
            <Search size={16} className="select-icon" />
            <input
              type="text"
              placeholder="Search by employee name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-date-input"
              style={{ width: '100%', paddingLeft: '2.2rem' }}
            />
          </div>

          {/* Include Pending Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={includePending}
              onChange={(e) => setIncludePending(e.target.checked)}
            />
            <span style={{ fontWeight: 500 }}>Show Pending Requests</span>
          </label>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. CALENDAR MAIN CARD (MONTH / WEEK VIEW)                     */}
      {/* ------------------------------------------------------------- */}
      <div className="leave-calendar-card">
        {/* Navigation & View Toggle Bar */}
        <div className="calendar-top-controls">
          <div className="calendar-month-nav">
            <button className="btn btn-secondary btn-sm" onClick={prevPeriod} title="Previous">
              <ChevronLeft size={18} />
            </button>
            <h2 className="calendar-month-title">{monthYearLabel}</h2>
            <button className="btn btn-secondary btn-sm" onClick={nextPeriod} title="Next">
              <ChevronRight size={18} />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={gotoToday} style={{ marginLeft: '6px' }}>
              Today
            </button>
          </div>

          {/* View mode toggle */}
          <div className="calendar-view-toggle">
            <button
              type="button"
              className={`calendar-view-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Month View
            </button>
            <button
              type="button"
              className={`calendar-view-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Week View
            </button>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '8px 20px',
            background: '#ffffff',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.78rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>LEAVE TYPES:</span>
          <span className="calendar-leave-chip chip-annual">Annual</span>
          <span className="calendar-leave-chip chip-casual">Casual</span>
          <span className="calendar-leave-chip chip-sick">Sick</span>
          <span className="calendar-leave-chip chip-maternity">Maternity/Paternity</span>
          <span className="calendar-leave-chip chip-unpaid">Unpaid</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1px dashed #64748b', borderRadius: '2px' }}></span>
            Dashed = Pending Review
          </span>
        </div>

        {/* Calendar Body */}
        {loading ? (
          <div className="loading-state" style={{ minHeight: '350px' }}>
            <span className="spinner"></span> Loading team calendar...
          </div>
        ) : viewMode === 'month' ? (
          renderMonthGrid()
        ) : (
          renderWeekGrid()
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. SIDE-BY-SIDE: TODAY'S LEAVES & DEPARTMENT COVERAGE         */}
      {/* ------------------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Today's On-Leave Roster */}
        <div className="table-card" style={{ marginBottom: 0 }}>
          <div className="table-card-header">
            <div>
              <h3>Who is Away Today</h3>
              <p className="table-subtitle">{formatDateStr(new Date())}</p>
            </div>
            <span className="badge-sub">{availability?.on_leave_today?.length || 0} Staff</span>
          </div>

          <div style={{ padding: '16px' }}>
            {!availability?.on_leave_today || availability.on_leave_today.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                <CheckCircle2 size={36} style={{ color: '#10b981', marginBottom: '8px' }} />
                <p style={{ fontWeight: 600 }}>Full Attendance Today</p>
                <small>No employees are recorded on approved leave today.</small>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {availability.on_leave_today.map((emp) => (
                  <div
                    key={emp.leave_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>{emp.employee_name}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {emp.department} {emp.designation ? `&bull; ${emp.designation}` : ''}
                      </div>
                    </div>
                    <span className={`calendar-leave-chip ${getChipClass(emp.leave_type)}`}>
                      {emp.leave_type} ({emp.total_days}d)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Department Coverage Summary */}
        <div className="table-card" style={{ marginBottom: 0 }}>
          <div className="table-card-header">
            <div>
              <h3>Department Availability</h3>
              <p className="table-subtitle">Operational coverage rates for today</p>
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {availability?.department_summaries?.map((d) => (
                <div key={d.department}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <strong>{d.department}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {d.employees_not_on_leave_today} / {d.total_active_employees} Available ({d.coverage_rate_percentage}%)
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      background: '#e2e8f0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${d.coverage_rate_percentage}%`,
                        height: '100%',
                        background:
                          d.coverage_rate_percentage >= 80
                            ? '#10b981'
                            : d.coverage_rate_percentage >= 50
                            ? '#f59e0b'
                            : '#ef4444',
                        transition: 'width 0.3s ease',
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. UPCOMING LEAVES LIST                                       */}
      {/* ------------------------------------------------------------- */}
      {availability?.upcoming_leaves && availability.upcoming_leaves.length > 0 && (
        <div className="table-card">
          <div className="table-card-header">
            <div>
              <h3>Upcoming Approved Leaves</h3>
              <p className="table-subtitle">Confirmed scheduled leaves for the next 30 days</p>
            </div>
            <span className="badge-sub">{availability.upcoming_leaves.length} Scheduled</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Leave Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {availability.upcoming_leaves.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.employee_name}</strong>
                    </td>
                    <td>{u.department}</td>
                    <td>
                      <span className={`calendar-leave-chip ${getChipClass(u.leave_type)}`} style={{ display: 'inline-block' }}>
                        {u.leave_type}
                      </span>
                    </td>
                    <td>{u.start_date}</td>
                    <td>{u.end_date}</td>
                    <td>{u.total_days} {u.total_days === 1 ? 'day' : 'days'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. LEAVE DETAILS MODAL                                        */}
      {/* ------------------------------------------------------------- */}
      {selectedLeave && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Leave Request Details</h3>
              <button className="btn-close" onClick={() => setSelectedLeave(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#e0e7ff',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                  }}
                >
                  {selectedLeave.employee_name.slice(0, 1)}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{selectedLeave.employee_name}</h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {selectedLeave.department} &bull; {selectedLeave.designation || 'Staff'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Leave Type</span>
                  <span className={`calendar-leave-chip ${getChipClass(selectedLeave.leave_type)}`} style={{ display: 'inline-block', marginTop: '4px' }}>
                    {selectedLeave.leave_type}
                  </span>
                </div>

                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Status</span>
                  <span
                    className={`badge ${selectedLeave.is_confirmed ? 'badge-success' : ''}`}
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      background: selectedLeave.is_confirmed ? '#ecfdf5' : '#fef3c7',
                      color: selectedLeave.is_confirmed ? '#047857' : '#92400e',
                    }}
                  >
                    {selectedLeave.status}
                  </span>
                </div>

                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Date Range</span>
                  <strong style={{ fontSize: '0.85rem' }}>
                    {selectedLeave.start_date} &rarr; {selectedLeave.end_date}
                  </strong>
                </div>

                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Total Duration</span>
                  <strong style={{ fontSize: '0.85rem' }}>{selectedLeave.total_days} Days</strong>
                </div>
              </div>

              {selectedLeave.reason && (
                <div style={{ padding: '12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.88rem' }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Reason / Purpose:
                  </strong>
                  <span>{selectedLeave.reason}</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setSelectedLeave(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

