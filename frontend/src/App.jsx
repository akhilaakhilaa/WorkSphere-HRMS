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
        {activeTab === 'dashboard' && <DashboardAnalytics />}
        {activeTab === 'attendance' && <AttendanceManagement />}
        {activeTab === 'employees' && <EmployeeManagement />}
        {activeTab === 'leaves' && <LeaveManagement />}
        {activeTab === 'payroll' && <PayrollManagement />}
        {activeTab === 'notifications' && <NotificationCenter setActiveTab={setActiveTab} />}
        {activeTab === 'users' && role === 'ADMIN' && <UserManagement />}
        {activeTab === 'profile' && <MyProfile />}
      </main>
      <footer className="app-footer">
        <p>
          WorkSphere HRMS &bull; Modules 1–7 Complete (Auth & Roles, Employees, Attendance, Leaves, Payroll, Dashboard & Analytics, Notifications)
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
