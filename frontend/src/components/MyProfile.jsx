import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { employeeApi } from '../services/api';
import {
  User,
  Mail,
  Shield,
  Briefcase,
  Building,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function MyProfile() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const data = await employeeApi.getMyProfile();
        setProfile(data);
      } catch (err) {
        setError('No linked employee record found for this user account.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="section-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Account & Profile</h1>
          <p className="page-subtitle">Personal details, organization role, and employment credentials</p>
        </div>
      </div>

      <div className="profile-layout-grid">
        {/* Left card: User Account Identity */}
        <div className="card-custom">
          <div className="profile-card-header">
            <div className="avatar-huge">
              {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <h2>{profile?.full_name || 'WorkSphere User'}</h2>
            <p className="text-muted">{user?.email}</p>
            <div className="mt-2">
              <span className={`role-pill badge-${role.toLowerCase()}`}>{role}</span>
            </div>
          </div>

          <div className="profile-card-details">
            <div className="info-row">
              <span className="info-icon"><Mail size={16} /></span>
              <span className="info-label">Account Email</span>
              <span className="info-val">{user?.email}</span>
            </div>
            <div className="info-row">
              <span className="info-icon"><Shield size={16} /></span>
              <span className="info-label">System Role</span>
              <span className="info-val">{role}</span>
            </div>
            <div className="info-row">
              <span className="info-icon"><CheckCircle size={16} /></span>
              <span className="info-label">Account Status</span>
              <span className="info-val text-success">Active</span>
            </div>
          </div>
        </div>

        {/* Right card: Employee Record Details */}
        <div className="card-custom">
          <h3 className="card-custom-title">
            <Briefcase size={20} /> Employment Record
          </h3>

          {loading ? (
            <div className="loading-state">
              <span className="spinner"></span> Loading employment information...
            </div>
          ) : error ? (
            <div className="alert alert-info">
              <AlertCircle size={18} /> {error}
            </div>
          ) : profile ? (
            <div className="profile-details-grid-large">
              <div className="profile-detail-card">
                <span className="label">Full Legal Name</span>
                <span className="value">{profile.full_name}</span>
              </div>

              <div className="profile-detail-card">
                <span className="label">Employee ID</span>
                <span className="value">EMP-{String(profile.id).padStart(4, '0')}</span>
              </div>

              <div className="profile-detail-card">
                <span className="label">Designation</span>
                <span className="value">{profile.designation}</span>
              </div>

              <div className="profile-detail-card">
                <span className="label">Department</span>
                <span className="value">{profile.department}</span>
              </div>

              <div className="profile-detail-card">
                <span className="label">Joining Date</span>
                <span className="value">{profile.joining_date}</span>
              </div>

              <div className="profile-detail-card">
                <span className="label">Employment Status</span>
                <span className="value text-success">{profile.status}</span>
              </div>

              <div className="profile-detail-card full-width">
                <span className="label">Annual Salary</span>
                <span className="value text-highlight">
                  ${Number(profile.salary).toLocaleString('en-US', { minimumFractionDigits: 2 })} / year
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

