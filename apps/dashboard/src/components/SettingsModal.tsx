import React, { useState, useEffect, useCallback } from 'react';
import { THEME } from '@apm/shared';
import { RADIUS, ANIMATION, SHADOW } from '../styles/theme';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Property {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  property_id: string;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  status: string;
}

export const SettingsModal: React.FC<Props> = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Booking form state
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [creatingBooking, setCreatingBooking] = useState(false);

  // Load current settings + bookings + properties when opened
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

    fetch('/api/properties')
      .then((r) => r.json())
      .then((data) => {
        setProperties(data);
        if (data.length > 0 && !propertyId) setPropertyId(data[0].id);
      })
      .catch(() => {});

    loadBookings();
  }, [open]);

  const loadBookings = () => {
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((data) => setBookings(data))
      .catch(() => {});
  };

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

  const handleCreateBooking = async () => {
    setCreatingBooking(true);
    setBookingError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          guest_name: guestName,
          guest_phone: guestPhone,
          check_in: checkIn,
          check_out: checkOut,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error || 'Failed to create booking');
      } else {
        setGuestName('');
        setGuestPhone('');
        setCheckIn('');
        setCheckOut('');
        loadBookings();
      }
    } catch {
      setBookingError('Network error');
    } finally {
      setCreatingBooking(false);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    try {
      await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      loadBookings();
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p.name]));

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

          {/* ── Divider ── */}
          <div style={styles.divider} />

          <h2 style={styles.title}>Test Bookings</h2>

          <div style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.label}>Guest Name</label>
              <input
                style={styles.input}
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Guest Phone</label>
              <input
                style={styles.input}
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="e.g. +18015551234"
              />
            </div>
          </div>

          <label style={styles.label}>Property</label>
          <select
            style={styles.input}
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div style={styles.formRow}>
            <div style={styles.formField}>
              <label style={styles.label}>Check-in</label>
              <input
                style={styles.input}
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div style={styles.formField}>
              <label style={styles.label}>Check-out</label>
              <input
                style={styles.input}
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>

          {bookingError && <div style={styles.error}>{bookingError}</div>}

          <button
            style={{
              ...styles.saveButton,
              opacity: creatingBooking ? 0.6 : 1,
            }}
            onClick={handleCreateBooking}
            disabled={creatingBooking}
          >
            {creatingBooking ? 'Creating...' : 'Create Booking'}
          </button>

          {/* ── Existing Bookings ── */}
          {bookings.length > 0 && (
            <div style={styles.bookingList}>
              {bookings.map((b) => (
                <div key={b.id} style={styles.bookingItem}>
                  <div style={styles.bookingInfo}>
                    <span style={styles.bookingName}>{b.guest_name}</span>
                    <span style={styles.bookingDetail}>
                      {propertyMap[b.property_id] || b.property_id} &middot;{' '}
                      {new Date(b.check_in).toLocaleDateString()} &ndash;{' '}
                      {new Date(b.check_out).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    style={styles.deleteButton}
                    onClick={() => handleDeleteBooking(b.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
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
    maxWidth: '600px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
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
    width: '100%',
    boxSizing: 'border-box',
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
  divider: {
    height: '1px',
    backgroundColor: THEME.bg.border,
    margin: '8px 0',
  },
  formRow: {
    display: 'flex',
    gap: '12px',
  },
  formField: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  bookingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '4px',
  },
  bookingItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: THEME.bg.primary,
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.md,
  },
  bookingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  bookingName: {
    fontSize: '14px',
    fontWeight: 600,
    color: THEME.text.primary,
  },
  bookingDetail: {
    fontSize: '12px',
    color: THEME.text.secondary,
  },
  deleteButton: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: `1px solid ${THEME.bg.border}`,
    borderRadius: RADIUS.sm,
    color: THEME.status.emergency,
    fontSize: '16px',
    cursor: 'pointer',
    fontFamily: THEME.font.sans,
    flexShrink: 0,
  },
};
