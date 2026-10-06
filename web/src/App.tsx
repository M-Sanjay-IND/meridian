import { useState, useEffect } from 'react';

interface SlotItem {
  start: string;
  end: string;
  available: boolean;
  remaining: number;
  reason?: string;
}

interface ConfirmedBooking {
  id: number;
  hostName: string;
  start: string;
  end: string;
  cancellationToken: string;
  status: string;
}

interface LabUnit {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  status: string;
  statusClass: string;
  benchesUsed: number;
  benchesTotal: number;
  openCount: number;
  barUsedClass: string;
  barUsedWidth: string;
  barOpenWidth: string;
  zone: string;
  spec2Label: string;
  spec2Val: string;
  spec3Label: string;
  spec3Val: string;
  hostId: number;
}

interface FacultyUnit {
  id: number;
  nodeTag: string;
  initials: string;
  name: string;
  openSlots: number;
  discipline: string;
  tagline: string;
  timeZone: string;
  tzOffset: string;
  bufferText: string;
  bufferDesc: string;
  affiliation: string;
  tier: string;
  windows: string[];
  moreWindows: number;
}

const API_BASE = (import.meta.env.VITE_API_URL as string) || '';

const LABS_DATA: LabUnit[] = [
  {
    id: 'LAB-01',
    name: 'Lab Alpha',
    title: 'Lab Alpha Robotics Prototyping Cluster',
    subtitle: 'Robotics Prototyping & Actuators',
    status: 'ACTIVE',
    statusClass: 'bg-state-available-subtle text-state-available border border-state-available',
    benchesUsed: 14,
    benchesTotal: 20,
    openCount: 6,
    barUsedClass: 'bg-espresso-primary',
    barUsedWidth: '70%',
    barOpenWidth: '30%',
    zone: 'Engineering Quad / L1',
    spec2Label: 'Enforced Buffer:',
    spec2Val: '15m Clean Calibration',
    spec3Label: 'Isolation Tier:',
    spec3Val: 'ISO Class 7',
    hostId: 7,
  },
  {
    id: 'LAB-02',
    name: 'Lab Beta',
    title: 'Lab Beta Quantum Emulation Network',
    subtitle: 'Quantum Emulation Network',
    status: 'ACTIVE',
    statusClass: 'bg-state-available-subtle text-state-available border border-state-available',
    benchesUsed: 18,
    benchesTotal: 24,
    openCount: 6,
    barUsedClass: 'bg-state-confirmed',
    barUsedWidth: '75%',
    barOpenWidth: '25%',
    zone: 'Cyber Annex / Sub-B1',
    spec2Label: 'Cryo Cycle:',
    spec2Val: '30m Interval Check',
    spec3Label: 'Primary Rig:',
    spec3Val: 'Rigel Cryo-Array',
    hostId: 3,
  },
  {
    id: 'LAB-03',
    name: 'Lab Gamma',
    title: 'Lab Gamma High-Frequency Telemetry',
    subtitle: 'High-Frequency Telemetry & RF',
    status: 'ACTIVE',
    statusClass: 'bg-state-available-subtle text-state-available border border-state-available',
    benchesUsed: 12,
    benchesTotal: 24,
    openCount: 12,
    barUsedClass: 'bg-espresso-primary',
    barUsedWidth: '50%',
    barOpenWidth: '50%',
    zone: 'Applied Physics / Tower-3',
    spec2Label: 'Shielding:',
    spec2Val: 'Faraday Cage Spec A',
    spec3Label: 'Bandwidth:',
    spec3Val: '110 GHz Realtime',
    hostId: 11,
  },
  {
    id: 'LAB-04',
    name: 'Lab Delta',
    title: 'Lab Delta Biomechanical Kinetics',
    subtitle: 'Biomechanical Kinetics Hub',
    status: 'HIGH CAP',
    statusClass: 'bg-state-available-subtle text-state-available border border-state-available',
    benchesUsed: 22,
    benchesTotal: 30,
    openCount: 8,
    barUsedClass: 'bg-espresso-primary',
    barUsedWidth: '73%',
    barOpenWidth: '27%',
    zone: 'Kinetics Atrium / Ground',
    spec2Label: 'Optical Capture:',
    spec2Val: '32 Vicon Cameras',
    spec3Label: 'Force Plates:',
    spec3Val: '8 Embedded Bertec',
    hostId: 9,
  },
  {
    id: 'LAB-05',
    name: 'Lab Epsilon',
    title: 'Lab Epsilon Autonomous Systems Sandbox',
    subtitle: 'Autonomous Systems Sandbox',
    status: 'CONSTRAINED',
    statusClass: 'bg-state-confirmed-subtle text-state-confirmed border border-state-confirmed',
    benchesUsed: 10,
    benchesTotal: 12,
    openCount: 2,
    barUsedClass: 'bg-state-contested',
    barUsedWidth: '83%',
    barOpenWidth: '17%',
    zone: 'North Hangar / Bay 02',
    spec2Label: 'Flight Volume:',
    spec2Val: 'Net-Enclosed 1400m³',
    spec3Label: 'Lock Protocol:',
    spec3Val: 'Strict 1-Host Priority',
    hostId: 4,
  },
];

const FACULTY_DATA: FacultyUnit[] = [
  {
    id: 7,
    nodeTag: 'HOST NODE #07',
    initials: 'KR',
    name: 'Dr. K. Raman',
    openSlots: 6,
    discipline: 'Robotics & Cybernetics Faculty Lead',
    tagline: 'Primary arbiter for High-Torque Multi-Axis Actuation & Autonomous Kinetic Trials.',
    timeZone: 'Asia/Kolkata (IST)',
    tzOffset: 'UTC +05:30',
    bufferText: '15 MIN BUFFER',
    bufferDesc: 'Mandatory flush',
    affiliation: 'Lab Alpha & Delta',
    tier: 'Priority L1 Thesis',
    windows: ['10:00 - 11:30', '13:15 - 14:45', '15:00 - 16:30'],
    moreWindows: 3,
  },
  {
    id: 3,
    nodeTag: 'HOST NODE #03',
    initials: 'EV',
    name: 'Dr. Elena Vasquez',
    openSlots: 3,
    discipline: 'Quantum Computing & State Tomography',
    tagline: 'Principal Investigator for Sub-Kelvin Qubit Registers & Cryogenic Circuit Calibration.',
    timeZone: 'America/Los_Angeles',
    tzOffset: 'UTC -07:00 (PDT)',
    bufferText: '30 MIN BUFFER',
    bufferDesc: 'Thermal reset window',
    affiliation: 'Lab Beta (Quantum)',
    tier: '120 Sec Arbitration',
    windows: ['09:00 - 10:30', '11:00 - 12:30', '16:00 - 17:30'],
    moreWindows: 0,
  },
  {
    id: 11,
    nodeTag: 'HOST NODE #11',
    initials: 'MS',
    name: 'Prof. M. Sterling',
    openSlots: 4,
    discipline: 'RF Engineering & Radar Synthesis',
    tagline: 'Director of High-Bandwidth Anechoic Chambers & Sub-THz Array Instrumentation.',
    timeZone: 'Europe/London (BST)',
    tzOffset: 'UTC +01:00',
    bufferText: '20 MIN BUFFER',
    bufferDesc: 'RF spectrum purge',
    affiliation: 'Lab Gamma (Telemetry)',
    tier: 'Radiation Safety B',
    windows: ['11:00 - 12:00', '14:00 - 15:30'],
    moreWindows: 2,
  },
  {
    id: 4,
    nodeTag: 'HOST NODE #04',
    initials: 'AT',
    name: 'Dr. Aris Thorne',
    openSlots: 2,
    discipline: 'Swarm Avionics & Unmanned Vehicles',
    tagline: 'Overseeing Micro-UAV Telemetry, LIDAR Mapping, and High-Speed Spatial Collision Avoidance.',
    timeZone: 'America/New_York',
    tzOffset: 'UTC -04:00 (EDT)',
    bufferText: '15 MIN BUFFER',
    bufferDesc: 'Hangar safety check',
    affiliation: 'Lab Epsilon (Sandbox)',
    tier: 'Class IV Active',
    windows: ['13:30 - 15:00', '16:15 - 17:45'],
    moreWindows: 0,
  },
  {
    id: 9,
    nodeTag: 'HOST NODE #09',
    initials: 'PN',
    name: 'Dr. Priya Nair',
    openSlots: 5,
    discipline: 'Neural Interfaces & Biotelemetry',
    tagline: 'Synchronous high-density EEG processing, EMG kinetic tracking, and real-time biomechanics.',
    timeZone: 'Asia/Kolkata (IST)',
    tzOffset: 'UTC +05:30',
    bufferText: '15 MIN BUFFER',
    bufferDesc: 'Electrode calibration',
    affiliation: 'Lab Delta (Kinetics)',
    tier: 'IRB-2025-081 Active',
    windows: ['08:30 - 10:00', '11:15 - 12:45'],
    moreWindows: 3,
  },
  {
    id: 14,
    nodeTag: 'HOST NODE #14',
    initials: 'HV',
    name: 'Prof. H. Vogt',
    openSlots: 1,
    discipline: 'Superconducting Resonators & Cryo-Optics',
    tagline: 'Low-noise submillimeter astronomical detector testing and ultra-cold vacuum physics.',
    timeZone: 'Europe/Berlin (CEST)',
    tzOffset: 'UTC +02:00',
    bufferText: '45 MIN BUFFER',
    bufferDesc: 'Vacuum stabilization',
    affiliation: 'Lab Beta & Gamma',
    tier: 'Staff Attendant Req',
    windows: ['17:00 - 18:30'],
    moreWindows: 0,
  },
];

export function App() {
  // Navigation & Filtering State
  const [activeNav, setActiveNav] = useState<'supervisors-labs' | 'schedule-slot' | 'my-bookings' | 'telemetry'>('supervisors-labs');
  const [activeFilter, setActiveFilter] = useState<'all' | 'faculty' | 'labs'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOpenToday, setFilterOpenToday] = useState<boolean>(true);

  // Guidelines Modal State
  const [guidelinesModalOpen, setGuidelinesModalOpen] = useState<boolean>(false);
  const [guidelinesTitle, setGuidelinesTitle] = useState<string>('LAB SPECIFICATION');

  // Booking Modal & Live Slots State
  const [bookingModalOpen, setBookingModalOpen] = useState<boolean>(false);
  const [selectedUnitName, setSelectedUnitName] = useState<string>('Dr. K. Raman');
  const [selectedHostId, setSelectedHostId] = useState<number>(7);
  const [serviceId] = useState<number>(3);
  const [date, setDate] = useState<string>('2026-10-15');
  const [tz, setTz] = useState<string>('Asia/Kolkata');
  const [studentId, setStudentId] = useState<number>(42);

  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [bookingStatus, setBookingStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Confirmed Bookings list
  const [myBookings, setMyBookings] = useState<ConfirmedBooking[]>([]);

  // Telemetry info
  const [engineHealth, setEngineHealth] = useState<any>({ status: 'ok', version: '1.0.0', uptime: '99.98%' });

  // Fetch health on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then(res => res.json())
      .then(data => setEngineHealth(data))
      .catch(() => {});
  }, []);

  // Fetch slots whenever booking modal is open or parameters change
  useEffect(() => {
    if (!bookingModalOpen && activeNav !== 'schedule-slot') return;

    setLoadingSlots(true);
    setSelectedSlot(null);
    setBookingStatus(null);

    fetch(`${API_BASE}/api/slots?hostId=${selectedHostId}&serviceId=${serviceId}&from=${date}&to=${date}&tz=${encodeURIComponent(tz)}&studentId=${studentId}`)
      .then(res => res.json())
      .then(data => {
        if (data.slots && Array.isArray(data.slots)) {
          setSlots(data.slots);
        } else {
          setSlots([]);
        }
      })
      .catch(err => {
        setBookingStatus({ type: 'error', text: `Failed to fetch slots: ${err.message}` });
      })
      .finally(() => setLoadingSlots(false));
  }, [bookingModalOpen, activeNav, selectedHostId, serviceId, date, tz, studentId]);

  // Open booking modal for a specific faculty or lab
  const openBookingModal = (unitName: string, hostId: number = 7) => {
    setSelectedUnitName(unitName);
    setSelectedHostId(hostId);
    setBookingStatus(null);
    setSelectedSlot(null);
    setBookingModalOpen(true);
  };

  // Open specs modal
  const openGuidelines = (title: string) => {
    setGuidelinesTitle(title);
    setGuidelinesModalOpen(true);
  };

  // Handle slot booking submission
  const handleBookSlot = async () => {
    if (!selectedSlot) return;

    setBookingStatus({ type: 'info', text: 'Arbitrating temporal lock & submitting atomic claim...' });

    try {
      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          hostId: selectedHostId,
          studentId,
          start: selectedSlot.start,
          end: selectedSlot.end,
          note: `Booked via Meridian UI for ${selectedUnitName}`,
        }),
      });

      const data = await res.json();

      if (res.status === 201) {
        const newBooking: ConfirmedBooking = {
          id: data.id,
          hostName: selectedUnitName,
          start: selectedSlot.start,
          end: selectedSlot.end,
          cancellationToken: data.cancellationToken || 'meridian-tok-valid',
          status: data.status || 'CONFIRMED',
        };
        setMyBookings(prev => [newBooking, ...prev]);
        setBookingStatus({
          type: 'success',
          text: `Slot Claim Validated! Booking #${data.id} confirmed. Cancellation Token: ${data.cancellationToken}`,
        });
        // Refresh slot grid
        fetch(`${API_BASE}/api/slots?hostId=${selectedHostId}&serviceId=${serviceId}&from=${date}&to=${date}&tz=${encodeURIComponent(tz)}&studentId=${studentId}`)
          .then(r => r.json())
          .then(d => d.slots && setSlots(d.slots));
      } else if (res.status === 409) {
        const code = data.error?.code || 'CONFLICT';
        const msg = data.error?.message || 'Contested slot or student timetable clash';
        setBookingStatus({
          type: 'error',
          text: `Arbitration Rejection (409 ${code}): ${msg}. Fresh alternatives computed.`,
        });
      } else {
        setBookingStatus({
          type: 'error',
          text: `Booking failed (${res.status}): ${data.error?.message || 'Internal validation error'}`,
        });
      }
    } catch (err: any) {
      setBookingStatus({ type: 'error', text: `Network arbitration fault: ${err.message}` });
    }
  };

  // Format slot time
  const formatSlotTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Filtered lists
  const query = searchQuery.toLowerCase().trim();

  const filteredLabs = LABS_DATA.filter(lab => {
    if (activeFilter === 'faculty') return false;
    if (!query) return true;
    return lab.name.toLowerCase().includes(query) || lab.subtitle.toLowerCase().includes(query) || lab.title.toLowerCase().includes(query);
  });

  const filteredFaculty = FACULTY_DATA.filter(fac => {
    if (activeFilter === 'labs') return false;
    const matchesOpen = !filterOpenToday || fac.openSlots > 0;
    if (!matchesOpen) return false;
    if (!query) return true;
    return (
      fac.name.toLowerCase().includes(query) ||
      fac.discipline.toLowerCase().includes(query) ||
      fac.tagline.toLowerCase().includes(query) ||
      fac.nodeTag.toLowerCase().includes(query) ||
      fac.affiliation.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-canvas-base text-on-surface font-body-md text-body-md antialiased min-h-screen flex flex-col">
      {/* FIXED HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-pure border-b border-border-structural">
        <div className="h-16 w-full px-gutter-desktop flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-lg">
            <div className="flex items-center gap-space-sm pr-space-md border-r border-border-hairline cursor-pointer" onClick={() => setActiveNav('supervisors-labs')}>
              <img
                alt="Meridian Precision Logo"
                className="h-8 w-auto object-contain"
                src="https://lh3.googleusercontent.com/aida/AEtjO1WL7KalY7unTUecWFbmhjqcZciVZUWoTxR6kjI7XeJvb-5Zf2D1aO452DyEU2Vtoa3Nh6HyhpgXiVPp_GBb587WhPWooxK013rN_A0iCEVoRgEgsXLULxYKH2fLKzwgiVEBq0jPl7VvjTxZKMjI2BdR-ogAJ04TxOXpY2zuykdiFQcvaPUTSEfGctRbrS1bcxeGEu1mdRkA66_p3OH-oLx7aKRrhU4KWJSocH7obooxnMEpq6kZPb26nxE"
              />
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm uppercase text-espresso-primary tracking-tight font-bold">MERIDIAN</span>
                <span className="font-label-sm text-label-sm text-espresso-muted uppercase tracking-wider">SCHEDULING ENGINE</span>
              </div>
            </div>

            {/* NAV LINKS */}
            <nav className="hidden xl:flex items-center gap-space-xs">
              <button
                onClick={() => {
                  setActiveNav('schedule-slot');
                  openBookingModal('Dr. K. Raman (Host #7)', 7);
                }}
                className={`px-space-md py-space-xs font-label-md text-label-md uppercase tracking-wider border transition-colors cursor-pointer ${
                  activeNav === 'schedule-slot'
                    ? 'bg-espresso-primary text-on-primary border-border-structural'
                    : 'text-on-surface-variant hover:text-on-surface border-transparent'
                }`}
              >
                Schedule Slot
              </button>
              <button
                onClick={() => setActiveNav('supervisors-labs')}
                className={`px-space-md py-space-xs font-label-md text-label-md uppercase tracking-wider border transition-colors cursor-pointer ${
                  activeNav === 'supervisors-labs'
                    ? 'bg-espresso-primary text-on-primary border-border-structural'
                    : 'text-on-surface-variant hover:text-on-surface border-transparent'
                }`}
              >
                Supervisors &amp; Labs
              </button>
              <button
                onClick={() => setActiveNav('my-bookings')}
                className={`px-space-md py-space-xs font-label-md text-label-md uppercase tracking-wider border transition-colors cursor-pointer ${
                  activeNav === 'my-bookings'
                    ? 'bg-espresso-primary text-on-primary border-border-structural'
                    : 'text-on-surface-variant hover:text-on-surface border-transparent'
                }`}
              >
                My Bookings ({myBookings.length})
              </button>
              <button
                onClick={() => setActiveNav('telemetry')}
                className={`px-space-md py-space-xs font-label-md text-label-md uppercase tracking-wider border transition-colors cursor-pointer ${
                  activeNav === 'telemetry'
                    ? 'bg-espresso-primary text-on-primary border-border-structural'
                    : 'text-on-surface-variant hover:text-on-surface border-transparent'
                }`}
              >
                System Telemetry / Engine Status
              </button>
            </nav>
          </div>

          {/* HEADER RIGHT */}
          <div className="flex items-center gap-space-md">
            <div
              className="hidden md:flex items-center gap-space-xs px-space-sm py-1 bg-surface-subtle border border-border-hairline cursor-pointer select-none"
              title="Click to toggle timezone"
              onClick={() => setTz(tz === 'Asia/Kolkata' ? 'America/Los_Angeles' : 'Asia/Kolkata')}
            >
              <span className="font-label-sm text-label-sm text-espresso-muted uppercase">TZ</span>
              <span className="font-label-sm text-label-sm font-medium text-espresso-primary">
                {tz === 'Asia/Kolkata' ? 'Host: Asia/Kolkata (IST) ⇄ Local: PDT / UTC-7' : 'View: America/Los_Angeles (PDT) ⇄ Host: IST'}
              </span>
            </div>

            <div className="flex items-center gap-space-xs px-space-sm py-1 bg-state-available-subtle border border-state-available">
              <span className="w-2 h-2 bg-state-available rounded-none inline-block animate-pulse"></span>
              <span className="font-label-sm text-label-sm font-semibold uppercase text-state-available">Engine: Active · 0 locks waiting</span>
            </div>

            <div className="flex items-center gap-space-xs pl-space-sm border-l border-border-hairline">
              <img
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover border border-border-structural"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqL5lLKC8HlWI3IiKb2DKEC4sq8QC2-ezDPl17BTXkpbA1RqkSc2kH_BylqC3py3vpEs5FIX4l_OdGTlr5ml9E1IKVNVjka4YM0yJFS5qWM-FNrDRJ1ZkpFvna04wVpiz9u4CCgyA7iGYjFzY-4hvNM66dw2GCwTiss2ev3maNBoTLXQMmF59nlPrI6Uzsno6THHqWFHdNC-UhQWV3QE_419FJ_ARDOY3bVt7N0qLq08DghKLIKl1b7A"
              />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="w-full pt-16 bg-canvas-base flex-1">
        <div className="flex flex-col w-full">
          {/* OPERATIONAL SUB-HEADER / CONTROL STRIP */}
          <section className="w-full bg-surface-pure border-b border-border-structural px-gutter-desktop py-space-md">
            <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
              <div>
                <div className="flex items-center gap-space-xs text-label-sm font-label-sm text-espresso-muted uppercase tracking-wider mb-1">
                  <span>INSTITUTIONAL DIRECTORY</span>
                  <span>/</span>
                  <span className="text-espresso-primary font-bold">SECTION 1.2 &amp; 4.2 COMPLIANT</span>
                  <span>/</span>
                  <span className="text-state-available font-semibold">ARBITRATION LOCKS ACTIVE</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-espresso-primary tracking-tight font-bold m-0 uppercase">
                  Supervisors &amp; Laboratory Infrastructure
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl mt-1">
                  Real-time deterministic registry of faculty host arbiters, apparatus capacities, and enforced operational buffers across 5 physical research clusters.
                </p>
              </div>

              {/* QUICK REGISTRY METRICS */}
              <div className="flex items-center gap-space-md flex-wrap">
                <div className="bg-surface-subtle px-space-md py-space-sm border border-border-hairline flex flex-col">
                  <span className="font-label-sm text-label-sm text-espresso-muted uppercase">FACULTY NODES</span>
                  <span className="font-headline-sm text-headline-sm font-bold text-espresso-primary">15 REGISTERED</span>
                </div>
                <div className="bg-surface-subtle px-space-md py-space-sm border border-border-hairline flex flex-col">
                  <span className="font-label-sm text-label-sm text-espresso-muted uppercase">AGGREGATE BENCHES</span>
                  <span className="font-headline-sm text-headline-sm font-bold text-espresso-primary">110 STATIONS</span>
                </div>
                <div className="bg-state-available-subtle px-space-md py-space-sm border border-state-available flex flex-col">
                  <span className="font-label-sm text-label-sm text-state-available uppercase">CURRENT AVAILABLE SLOTS</span>
                  <span className="font-headline-sm text-headline-sm font-bold text-state-available">42 VALIDATED</span>
                </div>
              </div>
            </div>
          </section>

          {/* INTERACTIVE FILTER & QUERY BAR */}
          <section className="w-full bg-canvas-base border-b border-border-structural px-gutter-desktop py-space-md">
            <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
              {/* SEGMENTED VIEW FILTER TABS */}
              <div className="inline-flex flex-wrap items-center bg-surface-pure border border-border-structural p-0.5" role="tablist">
                <button
                  className={`px-space-md py-space-xs font-label-md text-label-md uppercase tracking-wider transition-colors cursor-pointer ${
                    activeFilter === 'all'
                      ? 'bg-espresso-primary text-on-primary'
                      : 'text-espresso-primary hover:bg-surface-subtle'
                  }`}
                  onClick={() => setActiveFilter('all')}
                >
                  All Units (20)
                </button>
                <button
                  className={`px-space-md py-space-xs font-label-md text-label-md uppercase tracking-wider transition-colors cursor-pointer ${
                    activeFilter === 'faculty'
                      ? 'bg-espresso-primary text-on-primary'
                      : 'text-espresso-primary hover:bg-surface-subtle'
                  }`}
                  onClick={() => setActiveFilter('faculty')}
                >
                  Faculty Supervisors (15)
                </button>
                <button
                  className={`px-space-md py-space-xs font-label-md text-label-md uppercase tracking-wider transition-colors cursor-pointer ${
                    activeFilter === 'labs'
                      ? 'bg-espresso-primary text-on-primary'
                      : 'text-espresso-primary hover:bg-surface-subtle'
                  }`}
                  onClick={() => setActiveFilter('labs')}
                >
                  Lab Stations (5)
                </button>
              </div>

              {/* SEARCH AND TOGGLES */}
              <div className="flex items-center gap-space-sm flex-wrap flex-1 max-w-2xl justify-end">
                <div className="relative flex-1 min-w-[260px]">
                  <span className="material-symbols-outlined absolute left-space-sm top-1/2 -translate-y-1/2 text-espresso-muted pointer-events-none text-[18px]">
                    search
                  </span>
                  <input
                    className="w-full pl-9 pr-space-md py-2 bg-surface-pure border border-border-hairline text-espresso-ink font-label-md text-label-md uppercase placeholder:text-espresso-muted focus:border-state-confirmed focus:outline-none"
                    placeholder="FILTER BY HOST ID, FACULTY NAME, LAB CLUSTER..."
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  className="flex items-center gap-space-xs px-space-md py-2 bg-surface-pure border border-border-structural font-label-md text-label-md uppercase tracking-wider text-espresso-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                  onClick={() => setFilterOpenToday(!filterOpenToday)}
                >
                  <span className="w-3.5 h-3.5 border border-border-structural bg-espresso-primary flex items-center justify-center p-0.5">
                    {filterOpenToday && <span className="w-2 h-2 bg-canvas-base block"></span>}
                  </span>
                  <span>Open Today Only</span>
                </button>
                <button
                  className="px-space-sm py-2 text-espresso-muted hover:text-espresso-primary font-label-sm text-label-sm uppercase tracking-wider cursor-pointer"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterOpenToday(true);
                    setActiveFilter('all');
                  }}
                  title="Reset filters"
                >
                  CLEAR
                </button>
              </div>
            </div>
          </section>

          {/* MAIN DIRECTORY MATRIX LAYOUT */}
          <div className="w-full max-w-[1600px] mx-auto px-gutter-desktop py-space-xl flex flex-col gap-space-xl">
            {/* MY BOOKINGS PANEL (IF NAV SELECTED) */}
            {activeNav === 'my-bookings' && (
              <section className="bg-surface-pure border-2 border-border-structural p-space-md shadow-[4px_4px_0px_0px_#2B1704]">
                <div className="flex items-center justify-between border-b border-border-structural pb-space-xs mb-space-md">
                  <div className="flex items-center gap-space-sm">
                    <span className="px-1.5 py-0.5 bg-espresso-primary text-on-primary font-label-sm text-label-sm uppercase">SESSION AUDIT</span>
                    <h2 className="font-headline-sm text-headline-sm uppercase tracking-tight text-espresso-primary font-bold m-0">
                      My Confirmed Reservations
                    </h2>
                  </div>
                  <span className="font-label-sm text-label-sm text-espresso-muted uppercase">{myBookings.length} ACTIVE CLAIMS</span>
                </div>

                {myBookings.length === 0 ? (
                  <div className="py-space-lg text-center font-label-md text-label-md text-espresso-muted uppercase">
                    No active slot claims recorded in this session. Click "View Slots &amp; Book" on any supervisor or lab station to claim.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
                    {myBookings.map(b => (
                      <div key={b.id} className="bg-surface-subtle border border-border-structural p-space-md flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-label-sm font-bold text-espresso-primary">BOOKING #{b.id}</span>
                            <span className="px-1.5 py-0.5 bg-state-available-subtle text-state-available border border-state-available font-label-sm uppercase font-bold">
                              {b.status}
                            </span>
                          </div>
                          <h4 className="font-headline-sm text-espresso-primary font-bold">{b.hostName}</h4>
                          <div className="font-label-sm text-espresso-muted mt-1">
                            {formatSlotTime(b.start)} — {formatSlotTime(b.end)} ({new Date(b.start).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })})
                          </div>
                          <div className="mt-2 p-1 bg-surface-pure border border-border-hairline text-[11px] font-mono break-all text-espresso-muted">
                            Token: {b.cancellationToken}
                          </div>
                        </div>
                        <button
                          className="mt-space-md w-full py-1 bg-surface-pure text-state-contested border border-state-contested font-label-sm uppercase hover:bg-state-contested hover:text-on-primary transition-colors cursor-pointer"
                          onClick={async () => {
                            if (!confirm(`Cancel booking #${b.id}?`)) return;
                            try {
                              const r = await fetch(`${API_BASE}/api/bookings/${b.id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${b.cancellationToken}` },
                              });
                              if (r.ok) {
                                setMyBookings(prev => prev.filter(x => x.id !== b.id));
                                alert(`Booking #${b.id} successfully cancelled.`);
                              } else {
                                alert(`Failed to cancel booking: ${r.statusText}`);
                              }
                            } catch (e: any) {
                              alert(`Error: ${e.message}`);
                            }
                          }}
                        >
                          Cancel Reservation
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* TELEMETRY ENGINE STATUS (IF NAV SELECTED) */}
            {activeNav === 'telemetry' && (
              <section className="bg-surface-pure border-2 border-border-structural p-space-md shadow-[4px_4px_0px_0px_#2B1704]">
                <div className="flex items-center justify-between border-b border-border-structural pb-space-xs mb-space-md">
                  <div className="flex items-center gap-space-sm">
                    <span className="px-1.5 py-0.5 bg-espresso-primary text-on-primary font-label-sm text-label-sm uppercase">SYSTEM TELEMETRY</span>
                    <h2 className="font-headline-sm text-headline-sm uppercase tracking-tight text-espresso-primary font-bold m-0">
                      Meridian Engine Operational Status
                    </h2>
                  </div>
                  <span className="font-label-sm text-label-sm text-state-available font-bold uppercase">ISO-8601 REAL-TIME SYNC</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
                  <div className="bg-surface-subtle p-space-md border border-border-hairline">
                    <span className="font-label-sm text-espresso-muted uppercase block">API Status</span>
                    <span className="font-headline-sm font-bold text-state-available uppercase">{engineHealth.status || 'OK'}</span>
                  </div>
                  <div className="bg-surface-subtle p-space-md border border-border-hairline">
                    <span className="font-label-sm text-espresso-muted uppercase block">Engine Core Version</span>
                    <span className="font-headline-sm font-bold text-espresso-primary">v{engineHealth.version || '1.0.0'}</span>
                  </div>
                  <div className="bg-surface-subtle p-space-md border border-border-hairline">
                    <span className="font-label-sm text-espresso-muted uppercase block">Advisory Locks Waiting</span>
                    <span className="font-headline-sm font-bold text-state-available">0 (Zero Queue Delay)</span>
                  </div>
                  <div className="bg-surface-subtle p-space-md border border-border-hairline">
                    <span className="font-label-sm text-espresso-muted uppercase block">Deterministic Timestamp</span>
                    <span className="font-label-sm font-mono text-espresso-primary mt-1 block truncate">
                      {engineHealth.timestamp || new Date().toISOString()}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* SECTION 1: PHYSICAL LABORATORY STATIONS (§4.2) */}
            {activeFilter !== 'faculty' && (
              <section className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between border-b border-border-structural pb-space-xs">
                  <div className="flex items-center gap-space-sm">
                    <span className="px-1.5 py-0.5 bg-espresso-primary text-on-primary font-label-sm text-label-sm uppercase">INDEX §4.2</span>
                    <h2 className="font-headline-sm text-headline-sm uppercase tracking-tight text-espresso-primary font-bold m-0">
                      Physical Lab Stations &amp; Apparatus Capacities
                    </h2>
                  </div>
                  <span className="font-label-sm text-label-sm text-espresso-muted uppercase">5 SYNCHRONIZED CLUSTERS</span>
                </div>

                {/* Laboratory Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-space-md">
                  {filteredLabs.map(lab => (
                    <article
                      key={lab.id}
                      className="bg-surface-pure border border-border-structural flex flex-col justify-between hover:border-state-confirmed transition-colors p-space-md group"
                    >
                      <div>
                        <div className="flex items-center justify-between border-b border-border-hairline pb-space-xs mb-space-sm">
                          <span className="font-label-sm text-label-sm text-espresso-muted uppercase font-bold">[{lab.id}]</span>
                          <span className={`px-1.5 py-0.5 font-label-sm text-label-sm uppercase font-bold ${lab.statusClass}`}>
                            {lab.status}
                          </span>
                        </div>
                        <h3 className="font-headline-sm text-headline-sm uppercase text-espresso-primary font-bold tracking-tight mb-1">
                          {lab.name}
                        </h3>
                        <p className="font-label-sm text-label-sm text-espresso-muted uppercase mb-space-md">
                          {lab.subtitle}
                        </p>

                        {/* Capacity Metrics Gauge */}
                        <div className="bg-surface-subtle p-space-sm border border-border-hairline mb-space-md">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="font-label-sm text-label-sm text-espresso-muted uppercase">Bench Saturation</span>
                            <span className="font-label-md text-label-md font-bold text-espresso-primary">
                              {lab.benchesUsed} / {lab.benchesTotal}
                            </span>
                          </div>
                          {/* Industrial Bar Indicator */}
                          <div className="w-full h-2 bg-surface-container border border-border-hairline overflow-hidden flex">
                            <div className={`h-full ${lab.barUsedClass}`} style={{ width: lab.barUsedWidth }}></div>
                            <div className="h-full bg-state-available" style={{ width: lab.barOpenWidth }}></div>
                          </div>
                          <div className="flex justify-between items-center mt-2 pt-1 border-t border-border-hairline">
                            <span className="font-label-sm text-label-sm text-state-available font-semibold uppercase">
                              {lab.openCount} Stations Open
                            </span>
                            <span className="font-label-sm text-label-sm text-espresso-muted uppercase">
                              CAP: {lab.benchesTotal} BENCHES
                            </span>
                          </div>
                        </div>

                        {/* Architectural Details Specs */}
                        <div className="space-y-1 mb-space-md">
                          <div className="flex justify-between font-label-sm text-label-sm">
                            <span className="text-espresso-muted uppercase">Floor/Zone:</span>
                            <span className="text-espresso-primary font-medium uppercase">{lab.zone}</span>
                          </div>
                          <div className="flex justify-between font-label-sm text-label-sm">
                            <span className="text-espresso-muted uppercase">{lab.spec2Label}</span>
                            <span className="text-espresso-primary font-medium uppercase">{lab.spec2Val}</span>
                          </div>
                          <div className="flex justify-between font-label-sm text-label-sm">
                            <span className="text-espresso-muted uppercase">{lab.spec3Label}</span>
                            <span className="text-espresso-primary font-medium uppercase">{lab.spec3Val}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-space-sm border-t border-border-hairline flex flex-col gap-space-xs">
                        <button
                          className="w-full py-space-xs bg-espresso-primary text-on-primary font-label-md text-label-md uppercase tracking-wider hover:bg-state-confirmed hover:text-espresso-ink border border-border-structural transition-colors cursor-pointer"
                          onClick={() => openBookingModal(lab.name, lab.hostId)}
                        >
                          View Slots &amp; Book
                        </button>
                        <button
                          className="w-full py-space-xs bg-surface-pure text-espresso-primary font-label-sm text-label-sm uppercase tracking-wider hover:bg-surface-subtle border border-border-hairline transition-colors cursor-pointer"
                          onClick={() => openGuidelines(`${lab.name} (${lab.benchesTotal} Cap)`)}
                        >
                          Equipment Specs
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 2: FACULTY SUPERVISORS DIRECTORY (§1.2) */}
            {activeFilter !== 'labs' && (
              <section className="flex flex-col gap-space-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-structural pb-space-xs gap-space-xs">
                  <div className="flex items-center gap-space-sm">
                    <span className="px-1.5 py-0.5 bg-espresso-primary text-on-primary font-label-sm text-label-sm uppercase">INDEX §1.2</span>
                    <h2 className="font-headline-sm text-headline-sm uppercase tracking-tight text-espresso-primary font-bold m-0">
                      Faculty Supervisors &amp; Primary Host Nodes
                    </h2>
                  </div>
                  <div className="flex items-center gap-space-sm font-label-sm text-label-sm text-espresso-muted uppercase">
                    <span>ARBITRATION TIMELINE: CURRENT CYCLE</span>
                    <span className="w-1.5 h-1.5 bg-state-available"></span>
                  </div>
                </div>

                {/* Supervisor Matrix Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
                  {filteredFaculty.map(fac => {
                    const isHighlight = fac.id === 7 || fac.id === 3;
                    return (
                      <article
                        key={fac.id}
                        className={`bg-surface-pure p-space-md flex flex-col justify-between hover:border-state-confirmed transition-colors ${
                          isHighlight
                            ? 'border-2 border-border-structural shadow-[2px_2px_0px_0px_#2B1704]'
                            : 'border border-border-structural'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between border-b border-border-hairline pb-space-sm mb-space-sm">
                            <div className="flex items-center gap-space-sm">
                              <div className="w-10 h-10 border border-border-structural bg-surface-subtle flex items-center justify-center font-headline-sm font-bold text-espresso-primary">
                                {fac.initials}
                              </div>
                              <div>
                                <div className="flex items-center gap-space-xs">
                                  <span className="font-label-sm text-label-sm font-bold text-espresso-primary uppercase">{fac.nodeTag}</span>
                                  <span className="w-2 h-2 bg-state-available inline-block"></span>
                                </div>
                                <h3 className="font-headline-sm text-headline-sm uppercase text-espresso-primary font-bold tracking-tight">
                                  {fac.name}
                                </h3>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 bg-state-available-subtle text-state-available border border-state-available font-label-sm text-label-sm font-bold uppercase">
                                {fac.openSlots} SLOTS OPEN {fac.id === 7 || fac.id === 3 ? 'TODAY' : ''}
                              </span>
                            </div>
                          </div>

                          {/* Discipline & Research Tagline */}
                          <div className="mb-space-md">
                            <div className="font-label-md text-label-md text-espresso-primary font-semibold uppercase tracking-wide">
                              {fac.discipline}
                            </div>
                            <div className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                              {fac.tagline}
                            </div>
                          </div>

                          {/* Parameters Grid */}
                          <div className="grid grid-cols-2 gap-space-xs bg-surface-subtle p-space-sm border border-border-hairline mb-space-md">
                            <div className="flex flex-col">
                              <span className="font-label-sm text-label-sm text-espresso-muted uppercase">HOST TIME ZONE</span>
                              <span className="font-label-md text-label-md text-espresso-primary font-bold">{fac.timeZone}</span>
                              <span className="font-label-sm text-label-sm text-espresso-muted">{fac.tzOffset}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-label-sm text-label-sm text-espresso-muted uppercase">BUFFER RULE (§1.2)</span>
                              <span className="font-label-md text-label-md text-state-buffer font-bold">{fac.bufferText}</span>
                              <span className="font-label-sm text-label-sm text-espresso-muted">{fac.bufferDesc}</span>
                            </div>
                            <div className="flex flex-col mt-2 pt-2 border-t border-border-hairline">
                              <span className="font-label-sm text-label-sm text-espresso-muted uppercase">LAB AFFILIATION</span>
                              <span className="font-label-md text-label-md text-espresso-primary">{fac.affiliation}</span>
                            </div>
                            <div className="flex flex-col mt-2 pt-2 border-t border-border-hairline">
                              <span className="font-label-sm text-label-sm text-espresso-muted uppercase">CLEARANCE / LOCK</span>
                              <span className="font-label-md text-label-md text-espresso-primary">{fac.tier}</span>
                            </div>
                          </div>

                          {/* Upcoming Available Windows Preview */}
                          <div className="mb-space-md">
                            <span className="font-label-sm text-label-sm text-espresso-muted uppercase tracking-wider block mb-1">
                              TODAY'S VERIFIED WINDOWS ({fac.tzOffset.includes('IST') ? 'IST / LOCAL' : 'LOCAL'})
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {fac.windows.map((win, idx) => (
                                <button
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-surface-pure border border-state-available text-state-available font-label-sm text-label-sm hover:bg-state-available hover:text-on-primary transition-colors cursor-pointer"
                                  onClick={() => openBookingModal(fac.name, fac.id)}
                                  title="Quick-book slot"
                                >
                                  {win}
                                </button>
                              ))}
                              {fac.moreWindows > 0 && (
                                <span className="px-1.5 py-0.5 bg-surface-pure border border-border-hairline text-espresso-muted font-label-sm text-label-sm">
                                  +{fac.moreWindows} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-space-sm border-t border-border-structural flex items-center gap-space-xs">
                          <button
                            className="flex-1 py-space-xs bg-espresso-primary text-on-primary font-label-md text-label-md uppercase tracking-wider hover:bg-state-confirmed hover:text-espresso-ink border border-border-structural transition-colors text-center cursor-pointer"
                            onClick={() => openBookingModal(fac.name, fac.id)}
                          >
                            View Slots &amp; Book
                          </button>
                          <button
                            className="px-space-sm py-space-xs bg-surface-pure text-espresso-primary font-label-md text-label-md uppercase border border-border-structural hover:bg-surface-subtle cursor-pointer"
                            onClick={() => openGuidelines(`${fac.nodeTag} (${fac.name})`)}
                            title="Host Guidelines"
                          >
                            <span className="material-symbols-outlined text-[16px] block">info</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* SECTION 3: SYSTEM OPERATIONAL DIRECTIVES & BUFFER PROTOCOL NOTE (§1.2 & §4.2) */}
            <section className="w-full bg-surface-pure border border-border-structural p-space-lg">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-space-xs text-label-sm font-label-sm text-state-confirmed font-bold uppercase mb-1">
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                    <span>SYSTEM ENFORCEMENT: DETERMINISTIC TIME-LOCK RULES</span>
                  </div>
                  <h4 className="font-headline-sm text-headline-sm uppercase text-espresso-primary font-bold m-0">
                    Buffer Enforcement &amp; Simultaneous Multi-Lab Arbitration
                  </h4>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1 mb-0">
                    Per campus charter §1.2, all scheduled slots include a strict mandatory buffer (15m standard, up to 45m for cryogenic systems) that cannot be overridden by host discretion. Simultaneous reservations across physically incompatible stations trigger immediate RFC-compliant 409 Conflict status.
                  </p>
                </div>
                <div className="flex items-center gap-space-sm w-full lg:w-auto">
                  <button
                    className="px-space-md py-space-sm bg-surface-subtle border border-border-structural text-espresso-primary font-label-md text-label-md uppercase tracking-wider hover:bg-espresso-primary hover:text-on-primary transition-colors text-center w-full lg:w-auto cursor-pointer"
                    onClick={() => openGuidelines('Full Institutional Runbook PDF (v4.19)')}
                  >
                    Full Arbitration Runbook
                  </button>
                  <button
                    className="px-space-md py-space-sm bg-espresso-primary border border-border-structural text-on-primary font-label-md text-label-md uppercase tracking-wider hover:bg-state-confirmed hover:text-espresso-ink transition-colors text-center w-full lg:w-auto cursor-pointer"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                    Back to Top
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* MODAL 1: EQUIPMENT GUIDELINES & PROTOCOL VIEWER */}
      {guidelinesModalOpen && (
        <div className="fixed inset-0 z-50 bg-espresso-ink/60 flex items-center justify-center p-gutter">
          <div className="bg-surface-pure border-2 border-border-structural max-w-2xl w-full shadow-[8px_8px_0px_0px_#2B1704] flex flex-col">
            {/* Modal Header */}
            <div className="bg-surface-subtle border-b border-border-structural px-space-md py-space-sm flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-sm text-label-sm bg-espresso-primary text-on-primary px-1 font-bold">SPEC §4.2</span>
                <span className="font-label-md text-label-md text-espresso-primary font-bold uppercase tracking-wider">
                  {guidelinesTitle}
                </span>
              </div>
              <button
                className="w-6 h-6 border border-border-structural bg-surface-pure flex items-center justify-center font-label-sm font-bold hover:bg-state-contested hover:text-on-primary transition-colors cursor-pointer"
                onClick={() => setGuidelinesModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-space-lg space-y-space-md">
              <div>
                <span className="font-label-sm text-label-sm text-espresso-muted uppercase tracking-wider block">FACILITY REGIME &amp; BUFFER PROTOCOL</span>
                <h3 className="font-headline-sm text-headline-sm uppercase text-espresso-primary font-bold mt-0.5">
                  Operational Safety &amp; Lock-Out Parameters
                </h3>
              </div>
              <div className="space-y-space-sm text-body-md text-on-surface">
                <div className="p-space-sm bg-surface-subtle border border-border-hairline flex flex-col">
                  <span className="font-label-sm text-label-sm text-espresso-primary font-bold uppercase">1. Mandatory Post-Slot Calibration Window</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Every booking automatically reserves an adjacent 15–45 minute system lock down. Researchers must vacate the physical bench 5 minutes prior to the end of the scheduled segment.
                  </span>
                </div>
                <div className="p-space-sm bg-surface-subtle border border-border-hairline flex flex-col">
                  <span className="font-label-sm text-label-sm text-espresso-primary font-bold uppercase">2. Remote Host Synchronous Check-in</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    For cross-continental supervisory arbitrations (e.g. Asia/Kolkata Host with PDT Researchers), the engine drops temporal locks if primary host handshake is not established within 120 seconds.
                  </span>
                </div>
                <div className="p-space-sm bg-surface-subtle border border-border-hairline flex flex-col">
                  <span className="font-label-sm text-label-sm text-espresso-primary font-bold uppercase">3. Equipment Guidelines &amp; PPE</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Static discharge footwear mandatory in Labs Alpha &amp; Beta. RF containment locks in Lab Gamma prohibit unsanctioned cellular devices within the 50-meter perimeter.
                  </span>
                </div>
              </div>
              <div className="pt-space-sm border-t border-border-hairline flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-espresso-muted uppercase">DIGITAL AUDIT STAMP: MERIDIAN-4.19.8</span>
                <button
                  className="px-space-md py-space-xs bg-espresso-primary text-on-primary font-label-md text-label-md uppercase tracking-wider hover:bg-state-confirmed hover:text-espresso-ink border border-border-structural transition-colors cursor-pointer"
                  onClick={() => setGuidelinesModalOpen(false)}
                >
                  Acknowledge Guidelines
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INTERACTIVE TIME-LOCK & SLOT BOOKING DRAWER */}
      {bookingModalOpen && (
        <div className="fixed inset-0 z-50 bg-espresso-ink/60 flex items-center justify-center p-gutter">
          <div className="bg-surface-pure border-2 border-border-structural max-w-3xl w-full shadow-[8px_8px_0px_0px_#2B1704] flex flex-col max-h-[90vh] overflow-hidden">
            {/* Drawer Header */}
            <div className="bg-surface-subtle border-b border-border-structural px-space-md py-space-sm flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-sm text-label-sm bg-espresso-primary text-on-primary px-1 font-bold">ARBITRATION LOCK</span>
                <span className="font-label-md text-label-md text-espresso-primary font-bold uppercase tracking-wider">
                  SCHEDULE APPOINTMENT: {selectedUnitName}
                </span>
              </div>
              <button
                className="w-6 h-6 border border-border-structural bg-surface-pure flex items-center justify-center font-label-sm font-bold hover:bg-state-contested hover:text-on-primary transition-colors cursor-pointer"
                onClick={() => setBookingModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-space-lg overflow-y-auto space-y-space-md flex-1">
              {/* Parameters Strip */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm bg-surface-subtle p-space-sm border border-border-hairline">
                <div>
                  <label className="font-label-sm text-espresso-muted uppercase block">Target Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-surface-pure border border-border-hairline px-2 py-1 font-label-md text-espresso-primary mt-0.5"
                  />
                </div>
                <div>
                  <label className="font-label-sm text-espresso-muted uppercase block">Timezone View</label>
                  <select
                    value={tz}
                    onChange={e => setTz(e.target.value)}
                    className="w-full bg-surface-pure border border-border-hairline px-2 py-1 font-label-md text-espresso-primary mt-0.5"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PDT -07:00)</option>
                    <option value="UTC">UTC (Universal Coordinated)</option>
                  </select>
                </div>
                <div>
                  <label className="font-label-sm text-espresso-muted uppercase block">Student ID (Invitee)</label>
                  <input
                    type="number"
                    value={studentId}
                    onChange={e => setStudentId(Number(e.target.value))}
                    className="w-full bg-surface-pure border border-border-hairline px-2 py-1 font-label-md text-espresso-primary mt-0.5"
                  />
                </div>
                <div>
                  <label className="font-label-sm text-espresso-muted uppercase block">Host Arbiter ID</label>
                  <select
                    value={selectedHostId}
                    onChange={e => setSelectedHostId(Number(e.target.value))}
                    className="w-full bg-surface-pure border border-border-hairline px-2 py-1 font-label-md text-espresso-primary mt-0.5"
                  >
                    <option value={7}>Host #7 (Dr. K. Raman)</option>
                    <option value={3}>Host #3 (Dr. Elena Vasquez)</option>
                    <option value={11}>Host #11 (Prof. M. Sterling)</option>
                    <option value={4}>Host #4 (Dr. Aris Thorne)</option>
                    <option value={9}>Host #9 (Dr. Priya Nair)</option>
                    <option value={14}>Host #14 (Prof. H. Vogt)</option>
                  </select>
                </div>
              </div>

              {/* Status Alert */}
              {bookingStatus && (
                <div
                  className={`p-space-sm border font-label-md uppercase tracking-wide flex items-center justify-between ${
                    bookingStatus.type === 'success'
                      ? 'bg-state-available-subtle border-state-available text-state-available'
                      : bookingStatus.type === 'error'
                      ? 'bg-state-contested-subtle border-state-contested text-state-contested'
                      : 'bg-surface-subtle border-border-structural text-espresso-primary'
                  }`}
                >
                  <span>{bookingStatus.text}</span>
                  <button onClick={() => setBookingStatus(null)} className="ml-2 font-bold cursor-pointer">✕</button>
                </div>
              )}

              {/* Verified Windows Matrix */}
              <div>
                <div className="flex justify-between items-center mb-space-xs border-b border-border-hairline pb-1">
                  <span className="font-label-sm text-espresso-muted uppercase font-bold">
                    AVAILABLE TIME SLOTS ({tz})
                  </span>
                  <span className="font-label-sm text-espresso-muted uppercase">
                    ENFORCED 15M/30M BUFFER INCLUDED
                  </span>
                </div>

                {loadingSlots ? (
                  <div className="py-space-lg text-center font-label-md text-espresso-muted animate-pulse">
                    Computing deterministic availability across timezones and campus buffers...
                  </div>
                ) : slots.length === 0 ? (
                  <div className="py-space-lg text-center font-label-md text-espresso-muted">
                    No available slots found for Host #{selectedHostId} on {date}. Select another date or supervisor.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-space-xs">
                    {slots.map((s, idx) => {
                      const isSelected = selectedSlot?.start === s.start;
                      const isAvail = s.available;

                      return (
                        <div
                          key={idx}
                          onClick={() => isAvail && setSelectedSlot(s)}
                          className={`p-space-sm border flex flex-col justify-between transition-colors select-none ${
                            !isAvail
                              ? 'bg-surface-subtle border-border-hairline opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'bg-espresso-primary text-on-primary border-border-structural shadow-[2px_2px_0px_0px_#2B1704] cursor-pointer'
                              : 'bg-surface-pure border-border-structural hover:border-state-confirmed cursor-pointer'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className={isSelected ? 'text-surface-subtle' : 'text-espresso-muted'}>
                              {isAvail ? `${s.remaining} OPEN` : s.reason?.toUpperCase() || 'LOCKED'}
                            </span>
                            {isAvail && (
                              <span className={`w-2 h-2 ${isSelected ? 'bg-state-available' : 'bg-state-available'}`}></span>
                            )}
                          </div>
                          <div className="font-label-md font-bold my-1 text-center">
                            {formatSlotTime(s.start)} - {formatSlotTime(s.end)}
                          </div>
                          <div className={`text-[10px] uppercase text-center ${isSelected ? 'text-surface-subtle' : 'text-espresso-muted'}`}>
                            {new Date(s.start).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Slot Confirmation Bar */}
              {selectedSlot && (
                <div className="p-space-md bg-surface-subtle border border-border-structural flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
                  <div>
                    <span className="font-label-sm text-espresso-muted uppercase block">Selected Slot Confirmation</span>
                    <span className="font-headline-sm font-bold text-espresso-primary">
                      {formatSlotTime(selectedSlot.start)} — {formatSlotTime(selectedSlot.end)} ({tz})
                    </span>
                    <span className="font-label-sm text-espresso-muted block mt-0.5">
                      Invitee: Student #{studentId} · Arbiter: {selectedUnitName}
                    </span>
                  </div>
                  <button
                    className="w-full sm:w-auto px-space-lg py-space-sm bg-espresso-primary text-on-primary font-label-md uppercase tracking-wider hover:bg-state-confirmed hover:text-espresso-ink border border-border-structural transition-colors cursor-pointer"
                    onClick={handleBookSlot}
                  >
                    Confirm Booking (Atomic Claim)
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="bg-surface-subtle border-t border-border-structural px-space-md py-space-sm flex justify-between items-center">
              <span className="font-label-sm text-espresso-muted uppercase">RFC-COMPLIANT ADVISORY LOCKS ACTIVE</span>
              <button
                className="px-space-md py-space-xs bg-surface-pure text-espresso-primary font-label-sm uppercase border border-border-hairline hover:bg-surface-subtle cursor-pointer"
                onClick={() => setBookingModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="w-full bg-surface-pure border-t border-border-structural py-space-md mt-auto">
        <div className="w-full px-gutter-desktop flex flex-col md:flex-row items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-md font-label-sm text-label-sm text-espresso-muted uppercase">
            <span className="text-espresso-primary font-bold">MERIDIAN CORE v4.19</span>
            <span>Deterministic Slot Arbitration</span>
            <span>ISO-8601 Synchronized</span>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant">
            © 2025 Meridian Academic Research Campus. Operational Continuity Protocol Active.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
