import React, { useState, useEffect, useCallback } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, ANIMATION, SHADOW } from '../styles/theme';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current settings when opened
  useEffect(() => {
    if (!open) return;
    fetch('/api/settings/owner')
      .then((r) => r.json())
      .then((data) => {
        setName(data.name);
        setPhone(data.phone);
        setError(null);
      })
      .catch(() => setError('Failed to load settings'));
  }, [open]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/owner', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Save failed');
      } else {
        onClose();
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeButton} onClick={onClose}>
          ×
        </button>

        <div style={styles.content}>
          <h2 style={styles.title}>Owner Settings</h2>

          <label style={styles.label}>Owner Name</label>
          <input
            style={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. David Reyes"
          />

          <label style={styles.label}>Owner Phone</label>
          <input
            style={styles.input}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +18015550000"
          />

          {error && <div style={styles.error}>{error}</div>}

          <button
            style={{
              ...styles.saveButton,
              opacity: saving ? 0.6 : 1,
            }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: `modalOverlayIn ${ANIMATION.normal} ${ANIMATION.easeOut}`,
    backdropFilter: 'blur(8px)',
  },
  panel: {
    backgroundColor: THEME.bg.card,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.xl,
    maxWidth: '440px',
    width: '90%',
    position: 'relative',
    animation: `modalPanelIn ${ANIMATION.normal} ${ANIMATION.easeOut}`,
    boxShadow: SHADOW.xl,
  },
  closeButton: {
    position: 'absolute',
    top: '12px',
    right: '16px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.sm,
    color: THEME.text.primary,
    fontSize: '20px',
    cursor: 'pointer',
    zIndex: 1,
    fontFamily: THEME.font.sans,
    transition: `all ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  content: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: THEME.text.accent,
    margin: '0 0 4px 0',
    letterSpacing: '-0.01em',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: THEME.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  input: {
    padding: '10px 14px',
    fontSize: '15px',
    fontFamily: THEME.font.sans,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.md,
    backgroundColor: THEME.bg.primary,
    color: THEME.text.primary,
    outline: 'none',
    transition: `border-color ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
  error: {
    fontSize: '14px',
    color: THEME.status.emergency,
    padding: '6px 0',
  },
  saveButton: {
    marginTop: '4px',
    padding: '10px 20px',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: THEME.font.sans,
    color: '#FFFFFF',
    background: THEME.accent.gradient,
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    transition: `opacity ${ANIMATION.fast} ${ANIMATION.easeOut}`,
  },
};
