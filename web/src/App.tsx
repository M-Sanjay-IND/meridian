import { useState, useEffect } from 'react';

interface SlotItem {
  start: string;
  end: string;
  available: boolean;
  remaining: number;
}

export function App() {
  const [hosts, setHosts] = useState<any[]>([]);
  const [selectedHost, setSelectedHost] = useState<number>(7);
  const [serviceId] = useState<number>(3);
  const [date, setDate] = useState<string>('2026-10-15');
  const [tz, setTz] = useState<string>('Asia/Kolkata');
  const [studentId, setStudentId] = useState<number>(42);

  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load hosts on mount
  useEffect(() => {
    fetch('/api/hosts')
      .then(res => res.json())
      .then(data => {
        if (data.hosts) setHosts(data.hosts);
      })
      .catch(() => {});
  }, []);

  // Fetch slots whenever host, service, date, or tz changes
  useEffect(() => {
    setLoading(true);
    setSelectedSlot(null);
    setStatusMessage(null);

    fetch(`/api/slots?hostId=${selectedHost}&serviceId=${serviceId}&from=${date}&to=${date}&tz=${encodeURIComponent(tz)}`)
      .then(res => res.json())
      .then(data => {
        if (data.slots) {
          setSlots(data.slots);
        } else {
          setSlots([]);
        }
      })
      .catch(err => {
        setStatusMessage({ type: 'error', text: `Failed to load slots: ${err.message}` });
      })
      .finally(() => setLoading(false));
  }, [selectedHost, serviceId, date, tz]);

  // Handle booking submission
  const handleBook = async () => {
    if (!selectedSlot) return;

    setStatusMessage({ type: 'info', text: 'Submitting atomic slot claim...' });

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          hostId: selectedHost,
          studentId,
          start: selectedSlot.start,
          end: selectedSlot.end,
          note: 'Office hours booked via Web UI',
        }),
      });

      const data = await res.json();

      if (res.status === 201) {
        setStatusMessage({
          type: 'success',
          text: `Booking confirmed! ID: ${data.id}. Status: ${data.status}. Token: ${data.cancellationToken}`,
        });
      } else if (res.status === 409) {
        setStatusMessage({
          type: 'error',
          text: `Slot Contention (409): ${data.error?.message || 'Slot already taken by another request'}. Fresh alternatives loaded.`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Booking failed (${res.status}): ${data.error?.message || 'Error occurred'}`,
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Network error: ${err.message}` });
    }
  };

  const formatSlotTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="container">
      <header>
        <div className="brand">
          <div className="brand-logo">M</div>
          <div className="brand-text">
            <h1>Meridian Campus Scheduler</h1>
            <p>High-concurrency office hours & laboratory station booking</p>
          </div>
        </div>
        <div className="status-badge">
          <span className="status-dot"></span>
          Engine Live
        </div>
      </header>

      <div className="grid">
        {/* Controls Column */}
        <div className="card">
          <h2>Booking Parameters</h2>

          <div className="field">
            <label>Supervisor / Host</label>
            <select value={selectedHost} onChange={e => setSelectedHost(Number(e.target.value))}>
              {hosts.map(h => (
                <option key={h.id} value={h.id}>{h.name} ({h.email})</option>
              ))}
              {hosts.length === 0 && <option value={7}>Prof. Rao (ID 7)</option>}
            </select>
          </div>

          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="field">
            <label>Time Zone View</label>
            <div className="tz-toggle">
              <button
                type="button"
                className={`tz-btn ${tz === 'Asia/Kolkata' ? 'active' : ''}`}
                onClick={() => setTz('Asia/Kolkata')}
              >
                IST (Asia/Kolkata)
              </button>
              <button
                type="button"
                className={`tz-btn ${tz === 'America/Los_Angeles' ? 'active' : ''}`}
                onClick={() => setTz('America/Los_Angeles')}
              >
                PDT / PST (LA)
              </button>
            </div>
          </div>

          <div className="field">
            <label>Student ID</label>
            <input
              type="number"
              value={studentId}
              onChange={e => setStudentId(Number(e.target.value))}
            />
          </div>

          {selectedSlot && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Selected Time Slot:</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-blue)', margin: '0.25rem 0' }}>
                {formatSlotTime(selectedSlot.start)} — {formatSlotTime(selectedSlot.end)}
              </div>
              <button className="btn-primary" onClick={handleBook}>
                Confirm Booking (Atomic Claim)
              </button>
            </div>
          )}

          {statusMessage && (
            <div className={`alert alert-${statusMessage.type}`}>
              {statusMessage.text}
            </div>
          )}
        </div>

        {/* Slot Grid Column */}
        <div className="card">
          <h2>Available Slots ({tz})</h2>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Computing genuinely free slots across time zones and buffers...</p>
          ) : slots.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No slots available for the selected criteria or holiday/override in effect.</p>
          ) : (
            <div className="slots-grid">
              {slots.map((s, idx) => {
                const isSelected = selectedSlot?.start === s.start;
                return (
                  <div
                    key={idx}
                    className={`slot-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedSlot(s)}
                  >
                    <div className="badge-rem">{s.remaining} left</div>
                    <div className="slot-time">
                      {formatSlotTime(s.start)} - {formatSlotTime(s.end)}
                    </div>
                    <div className="slot-sub">
                      {new Date(s.start).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
