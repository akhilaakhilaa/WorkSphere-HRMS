import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Navbar from './components/Navbar';
import DashboardAnalytics from './components/DashboardAnalytics';
import EmployeeManagement from './components/EmployeeManagement';
import AttendanceManagement from './components/AttendanceManagement';
import LeaveManagement from './components/LeaveManagement';
import PayrollManagement from './components/PayrollManagement';
import NotificationCenter from './components/NotificationCenter';
import MyProfile from './components/MyProfile';
import UserManagement from './components/UserManagement';
import ShiftManagement from './components/ShiftManagement';
import LeaveCalendar from './components/LeaveCalendar';
import DocumentManagement from './components/DocumentManagement';
import PerformanceManagement from './components/PerformanceManagement';
import AdvancedAnalytics from './components/AdvancedAnalytics';
import ErrorBoundary from './components/ErrorBoundary';

function MainApp() {
  const { isAuthenticated, loading, role } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Set initial tab upon login
  useEffect(() => {
    if (isAuthenticated) {
      setActiveTab('dashboard');
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-card">
          <div className="spinner-large"></div>
          <h2>WorkSphere HRMS</h2>
          <p>Connecting to secure backend...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="app-root">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        <ErrorBoundary key={activeTab}>
          {activeTab === 'dashboard' && <DashboardAnalytics />}
          {activeTab === 'attendance' && <AttendanceManagement />}
          {activeTab === 'shifts' && <ShiftManagement />}
          {activeTab === 'employees' && <EmployeeManagement />}
          {activeTab === 'leaves' && <LeaveManagement />}
          {activeTab === 'leave_calendar' && <LeaveCalendar />}
          {activeTab === 'payroll' && <PayrollManagement />}
          {activeTab === 'documents' && <DocumentManagement />}
          {activeTab === 'performance' && <PerformanceManagement />}
          {activeTab === 'analytics' && (role === 'ADMIN' || role === 'HR') && <AdvancedAnalytics />}
          {activeTab === 'notifications' && <NotificationCenter setActiveTab={setActiveTab} />}
          {activeTab === 'users' && role === 'ADMIN' && <UserManagement />}
          {activeTab === 'profile' && <MyProfile />}
        </ErrorBoundary>
      </main>
      <footer className="app-footer">
        <p>
          WorkSphere HRMS &bull; Modules 1–19 (Auth & Roles, Employees, Attendance, Leaves, Policies, Leave Calendar, Payroll, Analytics, Notifications, Admin Controls, Shift Management, Document Management, Performance Management, Advanced Analytics, Smart Alerts)
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
