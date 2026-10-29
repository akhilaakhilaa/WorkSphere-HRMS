import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { announcementApi } from '../services/api';
import {
  Megaphone,
  Plus,
  Search,
  Calendar,
  Clock,
  User,
  Edit2,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  Send,
  Radio,
  FileText,
} from 'lucide-react';

export default function Announcements() {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // State
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  // Forms
  const [formData, setFormData] = useState({
    title: '',
    message: '',
  });

  // Auto clear success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load announcements
  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await announcementApi.list();
      setAnnouncements(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error loading announcements:', err);
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    if (!searchQuery.trim()) return announcements;
    const q = searchQuery.toLowerCase();
    return announcements.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        (a.creator_name && a.creator_name.toLowerCase().includes(q))
    );
  }, [announcements, searchQuery]);

  // Open Create Modal
  const openCreateModal = () => {
    setFormData({ title: '', message: '' });
    setShowCreateModal(true);
  };

  // Submit Create
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (formData.title.trim().length < 3) {
      setError('Title must be at least 3 characters long.');
      return;
    }
    if (formData.message.trim().length < 5) {
      setError('Message must be at least 5 characters long.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await announcementApi.create({
        title: formData.title.trim(),
        message: formData.message.trim(),
      });
      setSuccessMessage('Announcement published successfully! All employees have been notified.');
      setShowCreateModal(false);
      setFormData({ title: '', message: '' });
      await loadAnnouncements();
    } catch (err) {
      console.error('Error creating announcement:', err);
      setError(err.message || 'Failed to publish announcement');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (ann) => {
    setSelectedAnnouncement(ann);
    setFormData({ title: ann.title, message: ann.message });
    setShowEditModal(true);
  };

  // Submit Edit
  const handleUpdateAnnouncement = async (e) => {
    e.preventDefault();
    if (!selectedAnnouncement) return;
    if (formData.title.trim().length < 3) {
      setError('Title must be at least 3 characters long.');
      return;
    }
    if (formData.message.trim().length < 5) {
      setError('Message must be at least 5 characters long.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await announcementApi.update(selectedAnnouncement.id, {
        title: formData.title.trim(),
        message: formData.message.trim(),
      });
      setSuccessMessage('Announcement updated successfully.');
      setShowEditModal(false);
      setSelectedAnnouncement(null);
      await loadAnnouncements();
    } catch (err) {
      console.error('Error updating announcement:', err);
      setError(err.message || 'Failed to update announcement');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (ann) => {
    setSelectedAnnouncement(ann);
    setShowDeleteModal(true);
  };

  // Submit Delete
  const handleDeleteAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    setActionLoading(true);
    setError(null);
    try {
      await announcementApi.delete(selectedAnnouncement.id);
      setSuccessMessage('Announcement removed successfully.');
      setShowDeleteModal(false);
      setSelectedAnnouncement(null);
      await loadAnnouncements();
    } catch (err) {
      console.error('Error deleting announcement:', err);
      setError(err.message || 'Failed to delete announcement');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Details Modal
  const openDetailModal = (ann) => {
    setSelectedAnnouncement(ann);
    setShowDetailModal(true);
  };

  return (
    <div className="announcements-page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-info">
          <div className="page-title-row">
            <Megaphone className="page-title-icon" size={28} />
            <h1 className="page-title">Company Announcements</h1>
          </div>
          <p className="page-subtitle">
            Stay updated with organization-wide news, policy updates, company events, and notices.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadAnnouncements}
            disabled={loading}
            title="Refresh Announcements"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {isHrOrAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
            >
              <Plus size={16} />
              <span>Create Announcement</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="alert-close-btn"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="alert-close-btn"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="filter-card" style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 260 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search announcements by title, keyword, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
            Showing <strong>{filteredAnnouncements.length}</strong> of{' '}
            <strong>{announcements.length}</strong>
          </div>
        </div>
      </div>

      {/* Announcements Board Grid */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p>Loading company announcements...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="card" style={{ padding: 50, textAlign: 'center', color: '#64748b' }}>
          <Radio size={44} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>No Announcements Found</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {announcements.length === 0
              ? 'There are currently no company announcements published. Check back later!'
              : 'No announcements matched your search query.'}
          </p>
          {isHrOrAdmin && announcements.length === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateModal}
              style={{ marginTop: 16 }}
            >
              <Plus size={15} />
              <span>Publish First Announcement</span>
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          {filteredAnnouncements.map((ann) => (
            <div
              key={ann.id}
              className="card announcement-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 20,
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                background: 'var(--bg-surface)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div>
                {/* Header Metadata */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <span
                    className="badge"
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {ann.creator_role || 'MANAGEMENT'}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.75rem',
                      color: '#64748b',
                    }}
                  >
                    <Calendar size={13} />
                    <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Title */}
                <h3
                  style={{
                    margin: '0 0 10px',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    lineHeight: 1.35,
                    cursor: 'pointer',
                  }}
                  onClick={() => openDetailModal(ann)}
                >
                  {ann.title}
                </h3>

                {/* Short message preview */}
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    color: '#475569',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {ann.message}
                </p>
              </div>

              {/* Card Footer */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Posted by <strong>{ann.creator_name || ann.creator_email || 'HR'}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => openDetailModal(ann)}
                    title="Read Announcement"
                  >
                    <Eye size={13} />
                    <span>View</span>
                  </button>

                  {isHrOrAdmin && (
                    <>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => openEditModal(ann)}
                        title="Edit Announcement"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon text-danger"
                        onClick={() => openDeleteModal(ann)}
                        title="Delete Announcement"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE ANNOUNCEMENT (HR/Admin)                                     */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Megaphone size={20} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Publish New Announcement</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">
                    Announcement Title <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Annual Company Retreat & Team Outing"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    Min 3 characters.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Message Body <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows={6}
                    className="form-control"
                    placeholder="Write your announcement details here. This will be visible on all employee announcement boards..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    Min 5 characters.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT ANNOUNCEMENT (HR/Admin)                                       */}
      {/* ========================================================================= */}
      {showEditModal && selectedAnnouncement && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit Announcement</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateAnnouncement}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Announcement Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Message Body</label>
                  <textarea
                    rows={6}
                    className="form-control"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowEditModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ANNOUNCEMENT DETAIL VIEW (All users)                               */}
      {/* ========================================================================= */}
      {showDetailModal && selectedAnnouncement && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div>
                <span
                  className="badge"
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  {selectedAnnouncement.creator_role || 'MANAGEMENT NOTICE'}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.25rem', lineHeight: 1.3 }}>
                  {selectedAnnouncement.title}
                </h3>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    Posted by{' '}
                    <strong>
                      {selectedAnnouncement.creator_name || selectedAnnouncement.creator_email}
                    </strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Published on {new Date(selectedAnnouncement.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDetailModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 20,
                  fontSize: '0.95rem',
                  color: '#334155',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedAnnouncement.message}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowDetailModal(false)}
              >
                Back to Announcements
              </button>
              {isHrOrAdmin && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setShowDetailModal(false);
                    openEditModal(selectedAnnouncement);
                  }}
                >
                  <Edit2 size={14} />
                  <span>Edit Announcement</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION (HR/Admin)                                     */}
      {/* ========================================================================= */}
      {showDeleteModal && selectedAnnouncement && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={20} className="text-danger" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Delete Announcement</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>
                Are you sure you want to permanently delete the announcement{' '}
                <strong>"{selectedAnnouncement.title}"</strong>?
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                This action will remove it from all employee boards.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteAnnouncement}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Delete Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

