import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';
import {
  Bell,
  CheckCheck,
  Filter,
  Search,
  CalendarDays,
  CreditCard,
  Clock,
  Info,
  AlertCircle,
  CheckCircle2,
  Send,
  RefreshCw,
  ExternalLink,
  Megaphone,
} from 'lucide-react';

export default function NotificationCenter({ setActiveTab }) {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtering & Search
  const [activeCategory, setActiveCategory] = useState('ALL'); // ALL, UNREAD, LEAVE, PAYROLL, ATTENDANCE, SYSTEM
  const [searchTerm, setSearchTerm] = useState('');

  // Broadcast Alert Form (HR/Admin)
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [broadcastData, setBroadcastData] = useState({
    title: '',
    message: '',
    type: 'SYSTEM',
    target_role: 'ALL',
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [listRes, sumRes] = await Promise.all([
        notificationApi.list({ limit: 100 }),
        notificationApi.getSummary(),
      ]);
      setNotifications(listRes);
      setSummary(sumRes);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      if (summary && summary.unread > 0) {
        setSummary((prev) => ({ ...prev, unread: prev.unread - 1 }));
      }
    } catch (err) {
      setError('Could not mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (summary) {
        setSummary((prev) => ({ ...prev, unread: 0 }));
      }
      setSuccessMsg('All notifications marked as read');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Failed to mark all as read');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastData.title.trim() || !broadcastData.message.trim()) {
      setError('Title and message are required for broadcast');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const res = await notificationApi.broadcastAlert({
        title: broadcastData.title.trim(),
        message: broadcastData.message.trim(),
        type: broadcastData.type,
        target_role: broadcastData.target_role,
      });
      setSuccessMsg(`Broadcast sent to ${res.recipients_count} recipient(s) successfully!`);
      setBroadcastData({
        title: '',
        message: '',
        type: 'SYSTEM',
        target_role: 'ALL',
      });
      setShowBroadcastForm(false);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to send broadcast');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNavigate = (link, type) => {
    if (!setActiveTab) return;
    if (link === '/leaves' || type === 'LEAVE') {
      setActiveTab('leaves');
    } else if (link === '/payroll' || type === 'PAYROLL') {
      setActiveTab('payroll');
    } else if (link === '/attendance' || type === 'ATTENDANCE') {
      setActiveTab('attendance');
    } else {
      setActiveTab('dashboard');
    }
  };

  // Filtered Notifications
  const filteredNotifications = notifications.filter((notif) => {
    // Category Filter
    if (activeCategory === 'UNREAD' && notif.is_read) return false;
    if (activeCategory === 'LEAVE' && notif.type !== 'LEAVE') return false;
    if (activeCategory === 'PAYROLL' && notif.type !== 'PAYROLL') return false;
    if (activeCategory === 'ATTENDANCE' && notif.type !== 'ATTENDANCE') return false;
    if (activeCategory === 'SYSTEM' && notif.type !== 'SYSTEM') return false;

    // Search Term Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = notif.title?.toLowerCase().includes(q);
      const matchMsg = notif.message?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg) return false;
    }

    return true;
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'LEAVE':
        return <CalendarDays size={20} className="text-purple-600" />;
      case 'PAYROLL':
        return <CreditCard size={20} className="text-emerald-600" />;
      case 'ATTENDANCE':
        return <Clock size={20} className="text-amber-600" />;
      case 'SYSTEM':
      default:
        return <Info size={20} className="text-indigo-600" />;
    }
  };

  const getCategoryBadgeClass = (type) => {
    switch (type) {
      case 'LEAVE':
        return 'badge-purple';
      case 'PAYROLL':
        return 'badge-green';
      case 'ATTENDANCE':
        return 'badge-amber';
      case 'SYSTEM':
      default:
        return 'badge-indigo';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="section-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Notification Center</h1>
          <p className="page-subtitle">
            Module 7: Real-time alerts for leave approvals, payroll disbursements, attendance logs, and organization announcements.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={fetchData}
            disabled={loading}
            title="Refresh notifications"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {summary && summary.unread > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleMarkAllRead}
              disabled={actionLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCheck size={16} />
              <span>Mark All Read</span>
            </button>
          )}

          {isHrOrAdmin && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowBroadcastForm(!showBroadcastForm)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Megaphone size={16} />
              <span>{showBroadcastForm ? 'Close Form' : 'Broadcast Alert'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Broadcast Form (HR & Admin) */}
      {showBroadcastForm && isHrOrAdmin && (
        <div
          className="card"
          style={{
            background: '#f8fafc',
            border: '2px dashed #6366f1',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Megaphone size={20} color="#6366f1" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Broadcast Organization Alert / Announcement
            </h3>
          </div>
          <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Alert Title *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. System Maintenance / Townhall"
                  value={broadcastData.title}
                  onChange={(e) => setBroadcastData({ ...broadcastData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  className="form-control"
                  value={broadcastData.type}
                  onChange={(e) => setBroadcastData({ ...broadcastData, type: e.target.value })}
                >
                  <option value="SYSTEM">SYSTEM (General Announcement)</option>
                  <option value="LEAVE">LEAVE (Leave Policy Update)</option>
                  <option value="PAYROLL">PAYROLL (Payroll Notice)</option>
                  <option value="ATTENDANCE">ATTENDANCE (Attendance Advisory)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Target Audience
                </label>
                <select
                  className="form-control"
                  value={broadcastData.target_role}
                  onChange={(e) => setBroadcastData({ ...broadcastData, target_role: e.target.value })}
                >
                  <option value="ALL">All Employees & Staff</option>
                  <option value="EMPLOYEE">Employees Only</option>
                  <option value="HR">HR Team Only</option>
                  <option value="ADMIN">Admins Only</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                Notification Message *
              </label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Enter alert message details for employees..."
                value={broadcastData.message}
                onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
                required
              ></textarea>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowBroadcastForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={actionLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={16} />
                <span>{actionLoading ? 'Dispatching...' : 'Dispatch Alert'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper icon-blue">
              <Bell size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Notifications</div>
              <div className="stat-value">{summary.total}</div>
            </div>
          </div>

          <div className="stat-card">
            <div
              className="stat-icon-wrapper"
              style={{
                background: summary.unread > 0 ? '#fef2f2' : '#f1f5f9',
                color: summary.unread > 0 ? '#ef4444' : '#64748b',
              }}
            >
              <AlertCircle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Unread Alerts</div>
              <div
                className="stat-value"
                style={{ color: summary.unread > 0 ? '#ef4444' : 'inherit' }}
              >
                {summary.unread}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper icon-purple">
              <CalendarDays size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Leave Alerts</div>
              <div className="stat-value">{summary.leave_count}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper icon-green">
              <CreditCard size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Payroll Notices</div>
              <div className="stat-value">{summary.payroll_count}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper icon-yellow">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Attendance Alerts</div>
              <div className="stat-value">{summary.attendance_count}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Notifications' },
            { id: 'UNREAD', label: `Unread (${summary?.unread || 0})` },
            { id: 'LEAVE', label: 'Leaves' },
            { id: 'PAYROLL', label: 'Payroll' },
            { id: 'ATTENDANCE', label: 'Attendance' },
            { id: 'SYSTEM', label: 'System' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: activeCategory === tab.id ? '#4f46e5' : '#cbd5e1',
                background: activeCategory === tab.id ? '#4f46e5' : '#ffffff',
                color: activeCategory === tab.id ? '#ffffff' : '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }}
          />
          <input
            type="text"
            className="form-control"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px', height: '38px', borderRadius: '20px' }}
          />
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="loading-state" style={{ padding: '60px 0', textAlign: 'center' }}>
          <span className="spinner-large"></span>
          <p style={{ marginTop: '14px', color: '#64748b' }}>Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            color: '#64748b',
          }}
        >
          <Bell size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>
            No notifications found
          </h3>
          <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
            {searchTerm || activeCategory !== 'ALL'
              ? 'Try adjusting your search or category filter.'
              : 'You are all caught up! No recent notifications.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredNotifications.map((notif) => {
            const isUnread = !notif.is_read;
            return (
              <div
                key={notif.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: isUnread ? '1.5px solid #a5b4fc' : '1px solid #e2e8f0',
                  background: isUnread ? '#f8faff' : '#ffffff',
                  boxShadow: isUnread
                    ? '0 2px 8px rgba(79, 70, 229, 0.08)'
                    : '0 1px 3px rgba(0,0,0,0.03)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'background 0.2s',
                }}
              >
                {/* Left Section: Icon + Details */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
                  {/* Category Icon */}
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background:
                        notif.type === 'LEAVE'
                          ? '#f3e8ff'
                          : notif.type === 'PAYROLL'
                          ? '#ecfdf5'
                          : notif.type === 'ATTENDANCE'
                          ? '#fffbeb'
                          : '#eef2ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h4
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          margin: 0,
                        }}
                      >
                        {notif.title}
                      </h4>

                      {/* Type Badge */}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          textTransform: 'uppercase',
                          background:
                            notif.type === 'LEAVE'
                              ? '#e9d5ff'
                              : notif.type === 'PAYROLL'
                              ? '#d1fae5'
                              : notif.type === 'ATTENDANCE'
                              ? '#fef3c7'
                              : '#e0e7ff',
                          color:
                            notif.type === 'LEAVE'
                              ? '#7e22ce'
                              : notif.type === 'PAYROLL'
                              ? '#065f46'
                              : notif.type === 'ATTENDANCE'
                              ? '#92400e'
                              : '#3730a3',
                        }}
                      >
                        {notif.type}
                      </span>

                      {/* Unread Pill */}
                      {isUnread && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: '#ef4444',
                            color: '#ffffff',
                          }}
                        >
                          NEW
                        </span>
                      )}

                      {/* Date */}
                      <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: 'auto' }}>
                        {formatDate(notif.created_at)}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '0.88rem',
                        color: '#334155',
                        margin: '6px 0 0',
                        lineHeight: '1.45',
                      }}
                    >
                      {notif.message}
                    </p>
                  </div>
                </div>

                {/* Right Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {/* Jump Link */}
                  {(notif.link || notif.type !== 'SYSTEM') && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleNavigate(notif.link, notif.type)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="View details"
                    >
                      <span>View</span>
                      <ExternalLink size={14} />
                    </button>
                  )}

                  {/* Mark as Read Button */}
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(notif.id)}
                      style={{
                        background: '#e0e7ff',
                        color: '#4338ca',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Mark as read"
                    >
                      <CheckCheck size={14} />
                      <span>Mark Read</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

