import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('WorkSphere ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '40px 24px',
            maxWidth: '640px',
            margin: '40px auto',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #fee2e2',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            {this.props.title || 'Something went wrong'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering this module.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            <RefreshCw size={16} />
            <span>Reload Module</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

