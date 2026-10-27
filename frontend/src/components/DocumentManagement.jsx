import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { documentApi, employeeApi } from '../services/api';
import {
  FileText,
  UploadCloud,
  Download,
  Eye,
  Trash2,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  File,
  Image as ImageIcon,
  Shield,
  AlertTriangle,
  X,
  RefreshCw,
  HardDrive,
  FolderArchive,
  Layers,
  Plus,
  Users,
  Calendar,
  ExternalLink,
} from 'lucide-react';

const DOC_TYPE_META = {
  IDENTITY: {
    label: 'Identity / Govt ID',
    bg: '#eff6ff',
    color: '#1d4ed8',
    border: '#bfdbfe',
  },
  CERTIFICATE: {
    label: 'Professional Certificate',
    bg: '#f5f3ff',
    color: '#6d28d9',
    border: '#ddd6fe',
  },
  EDUCATION: {
    label: 'Education / Degree',
    bg: '#ecfdf5',
    color: '#047857',
    border: '#a7f3d0',
  },
  EMPLOYMENT: {
    label: 'Employment Record',
    bg: '#fffbeb',
    color: '#b45309',
    border: '#fde68a',
  },
  OTHER: {
    label: 'Other Document',
    bg: '#f8fafc',
    color: '#475569',
    border: '#e2e8f0',
  },
};

export default function DocumentManagement() {
  const { user, role } = useAuth();
  const isHrOrAdmin = role === 'HR' || role === 'ADMIN';

  // State
  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadEmployeeId, setUploadEmployeeId] = useState('');
  const [uploadDocType, setUploadDocType] = useState('IDENTITY');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewContentType, setPreviewContentType] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Delete modal state
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch employees list if HR or Admin
  useEffect(() => {
    let isMounted = true;
    if (isHrOrAdmin) {
      const fetchEmployees = async () => {
        try {
          const fetchMethod = typeof employeeApi.list === 'function' ? employeeApi.list : employeeApi.getAll;
          if (typeof fetchMethod === 'function') {
            const data = await fetchMethod();
            if (isMounted) {
              if (Array.isArray(data)) {
                setEmployees(data);
              } else if (data && Array.isArray(data.items)) {
                setEmployees(data.items);
              } else {
                setEmployees([]);
              }
            }
          }
        } catch (err) {
          console.warn('Could not load employees for filter:', err);
          if (isMounted) {
            setEmployees([]);
          }
        }
      };
      fetchEmployees();
    }
    return () => {
      isMounted = false;
    };
  }, [isHrOrAdmin]);

  // Load summary metrics
  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const targetEmpId = isHrOrAdmin ? (selectedEmployeeId || undefined) : user?.employee_id;
      const data = await documentApi.getSummary(targetEmpId);
      setSummary(data || null);
    } catch (err) {
      console.warn('Failed to load document summary:', err);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Load documents list
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (selectedType && selectedType !== 'ALL') {
        params.document_type = selectedType;
      }
      if (isHrOrAdmin && selectedEmployeeId) {
        params.employee_id = selectedEmployeeId;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const data = await documentApi.list(params);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  // Initial load & when filters change
  useEffect(() => {
    fetchDocuments();
    fetchSummary();
  }, [selectedType, selectedEmployeeId]);

  // Handle Search input on form submit or keypress
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('ALL');
    setSelectedEmployeeId('');
    setTimeout(() => {
      fetchDocuments();
      fetchSummary();
    }, 0);
  };

  // Open upload modal with defaults
  const handleOpenUploadModal = () => {
    setUploadError(null);
    setSelectedFile(null);
    setUploadDescription('');
    setUploadDocType('IDENTITY');
    if (isHrOrAdmin) {
      setUploadEmployeeId(selectedEmployeeId || (employees[0]?.id ? String(employees[0].id) : ''));
    } else {
      setUploadEmployeeId(user?.employee_id ? String(user.employee_id) : '');
    }
    setShowUploadModal(true);
  };

  // File selection & validation
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate size (5MB = 5 * 1024 * 1024 = 5,242,880)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is 5 MB.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size === 0) {
      setUploadError('Selected file is empty (0 bytes). Please select a valid document.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate extension
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
    const parts = file.name.split('.');
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
    if (!allowedExts.includes(ext)) {
      setUploadError(`Unsupported file type (.${ext}). Only PDF, JPG, JPEG, and PNG files are allowed.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  // Submit document upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    const empId = isHrOrAdmin ? uploadEmployeeId : user?.employee_id;
    if (!empId) {
      setUploadError('No valid employee selected for this upload.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('employee_id', String(empId));
      formData.append('document_type', uploadDocType);
      if (uploadDescription.trim()) {
        formData.append('description', uploadDescription.trim());
      }

      await documentApi.upload(formData);

      setShowUploadModal(false);
      setSuccessMessage(`Document "${selectedFile.name}" uploaded successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);

      // Refresh list and metrics
      fetchDocuments();
      fetchSummary();
    } catch (err) {
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  // Preview document
  const handleViewPreview = async (doc) => {
    try {
      setPreviewDoc(doc);
      setPreviewBlobUrl(null);
      setPreviewError(null);
      setPreviewLoading(true);
      setPreviewModalOpen(true);

      const { url, contentType } = await documentApi.getViewBlobUrl(doc.id);
      setPreviewBlobUrl(url);
      setPreviewContentType(contentType);
    } catch (err) {
      setPreviewError(err.message || 'Failed to preview document.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewModalOpen(false);
    setPreviewDoc(null);
    setPreviewBlobUrl(null);
    setPreviewError(null);
  };

  // Download document
  const handleDownload = async (doc) => {
    try {
      await documentApi.download(doc.id, doc.original_file_name || doc.file_name);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  // Delete document
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmDoc) return;
    try {
      setDeleting(true);
      await documentApi.delete(deleteConfirmDoc.id);
      setDeleteConfirmDoc(null);
      setSuccessMessage(`Document deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchDocuments();
      fetchSummary();
    } catch (err) {
      alert(`Failed to delete document: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const isPdf = (doc) => {
    return (
      (doc.content_type && doc.content_type.includes('pdf')) ||
      (doc.original_file_name && doc.original_file_name.toLowerCase().endsWith('.pdf'))
    );
  };

  return (
    <div className="document-management-page" style={{ paddingBottom: '3rem' }}>
      {/* ------------------------------------------------------------- */}
      {/* 1. PAGE HEADER                                                */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                color: '#fff',
                padding: '8px',
                borderRadius: '10px',
                display: 'inline-flex',
              }}
            >
              <FolderArchive size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Document Management System
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '3px 0 0' }}>
                Securely store, organize, preview, and download employee identity, education, and HR records
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              fetchDocuments();
              fetchSummary();
            }}
            disabled={loading || summaryLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
            title="Refresh documents"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenUploadModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
            }}
          >
            <UploadCloud size={16} />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {successMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '1.25rem',
          }}
        >
          <CheckCircle2 size={18} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{successMessage}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '1.25rem',
          }}
        >
          <AlertCircle size={18} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. SUMMARY METRICS CARDS                                      */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Total Documents */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#eef2ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FolderArchive size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Total Documents
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {summary ? summary.total_documents : documents.length}
            </div>
          </div>
        </div>

        {/* Total Storage Used */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HardDrive size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Storage Consumed
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {summary ? (summary.total_size_formatted || `${summary.total_size_mb || 0} MB`) : '0 B'}
            </div>
          </div>
        </div>

        {/* Type Breakdown Quick Stats */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
            Categories
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(summary?.type_breakdown || summary?.by_type || {}).map(([type, count]) => {
              const meta = DOC_TYPE_META[type] || DOC_TYPE_META.OTHER;
              return (
                <span
                  key={type}
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: meta.bg,
                    color: meta.color,
                    border: `1px solid ${meta.border}`,
                  }}
                >
                  {type}: {count}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. FILTERS & SEARCH CONTROLS                                  */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '14px 18px',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search filename or employee name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Type Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.88rem',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Categories</option>
              <option value="IDENTITY">Identity Documents</option>
              <option value="CERTIFICATE">Certificates</option>
              <option value="EDUCATION">Education Records</option>
              <option value="EMPLOYMENT">Employment Documents</option>
              <option value="OTHER">Other Documents</option>
            </select>
          </div>

          {/* Employee Filter (HR/Admin only) */}
          {isHrOrAdmin && (
            <div style={{ minWidth: '200px' }}>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.88rem',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Employees</option>
                {(employees || []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.department})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. DOCUMENTS TABLE / LIST                                     */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner-large" style={{ margin: '0 auto 16px' }}></div>
            <p style={{ fontWeight: 600 }}>Loading secure documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#f1f5f9',
                color: '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <FolderArchive size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
              No Documents Found
            </h3>
            <p style={{ fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 20px' }}>
              {searchQuery || selectedType !== 'ALL' || selectedEmployeeId
                ? 'No documents matched your filter criteria. Try adjusting or clearing your filters.'
                : 'No documents have been uploaded yet. Click "Upload Document" above to get started.'}
            </p>
            <button
              type="button"
              onClick={handleOpenUploadModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              <UploadCloud size={16} />
              <span>Upload First Document</span>
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', color: '#475569' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Document</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Employee</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Category</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Size</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700 }}>Uploaded</th>
                  <th style={{ padding: '12px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const meta = DOC_TYPE_META[doc.document_type] || DOC_TYPE_META.OTHER;
                  const docIsPdf = isPdf(doc);

                  return (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                    >
                      {/* Document Name & Type Icon */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '8px',
                              background: docIsPdf ? '#fee2e2' : '#e0e7ff',
                              color: docIsPdf ? '#dc2626' : '#4338ca',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {docIsPdf ? <FileText size={20} /> : <ImageIcon size={20} />}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: 'var(--text-main)',
                                wordBreak: 'break-word',
                                maxWidth: '280px',
                              }}
                            >
                              {doc.original_file_name || doc.file_name}
                            </div>
                            {doc.description && (
                              <div
                                style={{
                                  fontSize: '0.78rem',
                                  color: 'var(--text-muted)',
                                  marginTop: '2px',
                                  maxWidth: '280px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {doc.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Employee Info */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {doc.employee_name || `Employee #${doc.employee_id}`}
                        </div>
                        {doc.department && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            {doc.department}
                          </div>
                        )}
                      </td>

                      {/* Document Category Badge */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`,
                          }}
                        >
                          {meta.label}
                        </span>
                      </td>

                      {/* File Size */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {formatFileSize(doc.file_size)}
                      </td>

                      {/* Upload Date */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {doc.uploaded_at
                          ? new Date(doc.uploaded_at).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleViewPreview(doc)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                            title="Preview Document"
                          >
                            <Eye size={14} />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: '#e0e7ff',
                              color: '#4338ca',
                              border: '1px solid #c7d2fe',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                            title="Download File"
                          >
                            <Download size={14} />
                            <span>Download</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmDoc(doc)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Delete Document"
                          >
                            <Trash2 size={14} />
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

      {/* ------------------------------------------------------------- */}
      {/* 5. UPLOAD DOCUMENT MODAL                                      */}
      {/* ------------------------------------------------------------- */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    background: '#e0e7ff',
                    color: '#4f46e5',
                    padding: '8px',
                    borderRadius: '8px',
                  }}
                >
                  <UploadCloud size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Upload Document
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUploadSubmit} style={{ padding: '24px' }}>
              {uploadError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Employee Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Target Employee <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {isHrOrAdmin ? (
                  <select
                    value={uploadEmployeeId}
                    onChange={(e) => setUploadEmployeeId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.88rem',
                      background: '#fff',
                    }}
                  >
                    <option value="">Select an employee...</option>
                    {(employees || []).map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code || `ID: ${emp.id}`} - {emp.department})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={`${user?.full_name || 'My Profile'} (Employee #${user?.employee_id})`}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: '#f1f5f9',
                      color: '#475569',
                      fontSize: '0.88rem',
                    }}
                  />
                )}
              </div>

              {/* Document Type Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Document Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    background: '#fff',
                  }}
                >
                  <option value="IDENTITY">Identity / Govt ID (Passport, Aadhaar, SSN)</option>
                  <option value="CERTIFICATE">Professional Certificate</option>
                  <option value="EDUCATION">Education / Degree / Transcript</option>
                  <option value="EMPLOYMENT">Employment Record / Offer / Contract</option>
                  <option value="OTHER">Other Record</option>
                </select>
              </div>

              {/* File Picker */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Select File <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '10px',
                    padding: '20px',
                    textAlign: 'center',
                    background: selectedFile ? '#f0fdf4' : '#f8fafc',
                    cursor: 'pointer',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  {selectedFile ? (
                    <div>
                      <CheckCircle2 size={32} style={{ color: '#16a34a', marginBottom: '8px' }} />
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#166534' }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '4px' }}>
                        {formatFileSize(selectedFile.size)} &bull; {selectedFile.type || 'file'}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        style={{
                          marginTop: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Change file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <UploadCloud size={32} style={{ color: '#6366f1', marginBottom: '8px' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        Click to choose a file from your computer
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Supported formats: PDF, JPG, JPEG, PNG (Max: 5 MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Description / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master's degree diploma, National ID scan"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: uploading || !selectedFile ? '#94a3b8' : '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: uploading || !selectedFile ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {uploading ? (
                    <>
                      <div className="spinner-small" style={{ width: '14px', height: '14px' }}></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      <span>Upload Document</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. DOCUMENT PREVIEW MODAL                                     */}
      {/* ------------------------------------------------------------- */}
      {previewModalOpen && previewDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '900px',
              width: '100%',
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    background: isPdf(previewDoc) ? '#fee2e2' : '#e0e7ff',
                    color: isPdf(previewDoc) ? '#dc2626' : '#4338ca',
                    padding: '6px',
                    borderRadius: '6px',
                  }}
                >
                  {isPdf(previewDoc) ? <FileText size={18} /> : <ImageIcon size={18} />}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {previewDoc.original_file_name || previewDoc.file_name}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {previewDoc.employee_name} &bull; {formatFileSize(previewDoc.file_size)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleDownload(previewDoc)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: '#e0e7ff',
                    color: '#4338ca',
                    border: '1px solid #c7d2fe',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={handleClosePreview}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div
              style={{
                flex: 1,
                background: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'auto',
                position: 'relative',
              }}
            >
              {previewLoading && (
                <div style={{ color: '#fff', textAlign: 'center' }}>
                  <div className="spinner-large" style={{ margin: '0 auto 12px' }}></div>
                  <p style={{ fontWeight: 600 }}>Loading preview...</p>
                </div>
              )}

              {previewError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '20px',
                    borderRadius: '8px',
                    maxWidth: '400px',
                    textAlign: 'center',
                  }}
                >
                  <AlertCircle size={32} style={{ margin: '0 auto 8px', color: '#dc2626' }} />
                  <p style={{ fontWeight: 700 }}>Unable to Preview File</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>{previewError}</p>
                </div>
              )}

              {!previewLoading && !previewError && previewBlobUrl && (
                <>
                  {previewContentType.includes('pdf') ? (
                    <iframe
                      src={previewBlobUrl}
                      title="Document Preview"
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                      }}
                    >
                      <img
                        src={previewBlobUrl}
                        alt="Document Preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. DELETE CONFIRMATION MODAL                                  */}
      {/* ------------------------------------------------------------- */}
      {deleteConfirmDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Trash2 size={24} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>
              Delete Document?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to delete{' '}
              <strong>"{deleteConfirmDoc.original_file_name || deleteConfirmDoc.file_name}"</strong>? This will permanently
              remove the record from the database and delete the physical file from the storage system.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmDoc(null)}
                disabled={deleting}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deleting ? (
                  <>
                    <div className="spinner-small" style={{ width: '14px', height: '14px' }}></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

