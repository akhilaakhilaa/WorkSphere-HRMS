import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';
import {
  Briefcase,
  Users,
  Clock,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  Bell,
  CheckCheck,
  ExternalLink,
  ShieldCheck,
  CalendarRange,
  Calendar,
  FolderArchive,
  Award,
  BarChart3,
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, role, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotificationData = async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.list({ limit: 6 }),
        notificationApi.getUnreadCount(),
      ]);
      setNotifications(listRes);
      setUnreadCount(countRes.unread_count || 0);
    } catch (err) {}
  };

  useEffect(() => {
    if (user) {
      fetchNotificationData();
      const interval = setInterval(fetchNotificationData, 12000); // Poll every 12 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {}
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      handleMarkRead(notif.id);
    }
    setShowNotifDropdown(false);

    if (notif.link === '/leaves' || notif.type === 'LEAVE') {
      setActiveTab('leaves');
    } else if (notif.link === '/payroll' || notif.type === 'PAYROLL') {
      setActiveTab('payroll');
    } else if (notif.link === '/documents' || notif.type === 'DOCUMENT') {
      setActiveTab('documents');
    } else if (notif.link === '/performance' || notif.type === 'PERFORMANCE') {
      setActiveTab('performance');
    } else if (notif.link === '/attendance' || notif.type === 'ATTENDANCE') {
      setActiveTab('attendance');
    } else {
      setActiveTab('notifications');
    }
  };

  const getRoleBadgeClass = () => {
    switch (role) {
      case 'ADMIN':
        return 'badge-admin';
      case 'HR':
        return 'badge-hr';
      case 'EMPLOYEE':
      default:
        return 'badge-employee';
    }
  };

  const formatShortTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <div className="navbar-brand" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon-wrapper">
            <Briefcase size={22} />
          </div>
          <div className="brand-text">
            <span className="brand-name">WorkSphere</span>
            <span className="brand-sub">HRMS</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="navbar-nav">
          <button
            type="button"
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            <Clock size={18} />
            <span>Attendance</span>
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'shifts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shifts')}
          >
            <CalendarRange size={18} />
            <span>Shifts</span>
          </button>

          {(role === 'HR' || role === 'ADMIN') && (
            <button
              type="button"
              className={`nav-link ${activeTab === 'employees' ? 'active' : ''}`}
              onClick={() => setActiveTab('employees')}
            >
              <Users size={18} />
              <span>Employees</span>
            </button>
          )}

          {role === 'ADMIN' && (
            <button
              type="button"
              className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <ShieldCheck size={18} />
              <span>Users</span>
            </button>
          )}

          <button
            type="button"
            className={`nav-link ${activeTab === 'leaves' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaves')}
          >
            <CalendarDays size={18} />
            <span>Leaves</span>
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'leave_calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('leave_calendar')}
          >
            <Calendar size={18} />
            <span>Calendar</span>
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'payroll' ? 'active' : ''}`}
            onClick={() => setActiveTab('payroll')}
          >
            <CreditCard size={18} />
            <span>Payroll</span>
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FolderArchive size={18} />
            <span>Documents</span>
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
            <Award size={18} />
            <span>Performance</span>
          </button>

          {(role === 'HR' || role === 'ADMIN') && (
            <button
              type="button"
              className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart3 size={18} />
              <span>Analytics</span>
            </button>
          )}

          <button
            type="button"
            className={`nav-link ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  marginLeft: '2px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <UserIcon size={18} />
            <span>Profile</span>
          </button>
        </nav>

        {/* User Badge, Notifications Bell & Actions */}
        <div className="navbar-user">
          {/* Notification Bell Dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn-action"
              style={{
                color: showNotifDropdown ? '#ffffff' : '#94a3b8',
                background: showNotifDropdown ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                position: 'relative',
                padding: '6px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              title="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #0f172a',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Drawer */}
            {showNotifDropdown && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '40px',
                  width: '340px',
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '12px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
                  border: '1px solid #e2e8f0',
                  zIndex: 300,
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span
                        style={{
                          background: '#fee2e2',
                          color: '#dc2626',
                          fontSize: '0.72rem',
                          padding: '1px 7px',
                          borderRadius: '10px',
                          fontWeight: 700,
                        }}
                      >
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#4f46e5',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Items List */}
                <div style={{ maxHeight: '310px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid #f1f5f9',
                          background: notif.is_read ? '#ffffff' : '#f0fdf4',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: notif.is_read ? 600 : 700, color: '#0f172a' }}>
                            {notif.title}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {formatShortTime(notif.created_at)}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: '0.76rem',
                            color: '#475569',
                            margin: '3px 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {notif.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: '10px 16px',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    textAlign: 'center',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifDropdown(false);
                      setActiveTab('notifications');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#4f46e5',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      width: '100%',
                    }}
                  >
                    <span>View Notification Center</span>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="user-details">
            <span className="user-name">
              {user?.full_name || user?.email?.split('@')[0]}
            </span>
            <span className={`role-pill ${getRoleBadgeClass()}`}>
              {role}
            </span>
          </div>

          <button
            type="button"
            className="btn-logout"
            onClick={logout}
            title="Log out"
          >
            <LogOut size={18} />
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
