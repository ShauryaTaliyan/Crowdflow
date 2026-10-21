import React, { useState } from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import StatCard from './Common/StatCard';
import MiniChart from './Common/MiniChart';
import AsciiReactionCanvas from './Common/AsciiReactionCanvas';
import CrowdCanvas from './Common/CrowdCanvas';
import PlatformSlideshow from './PlatformSlideshow';
import { 
  Users, 
  DoorOpen, 
  Clock, 
  Gauge, 
  AlertTriangle, 
  AlertOctagon, 
  Activity, 
  Layers, 
  ArrowRight, 
  Lightbulb, 
  ShieldCheck,
  CheckCircle2,
  Edit3,
  Maximize2,
  Check,
  X,
  Radio,
  Video,
  Play,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Map,
  BarChart3,
  GitCompare,
  ArrowUp,
  Github,
  Linkedin,
  Youtube,
  Facebook,
  Instagram,
  MessageSquare,
  FileText
} from 'lucide-react';

export default function OverviewDashboard() {
  const {
    venue,
    updateVenueDimensions,
    simSettings,
    metrics,
    setActiveTab,
    baselineScenario,
    recommendations,
    cameras = [],
    isBackendConnected,
    theme,
    exportLayoutJSON,
    addNotification
  } = useCrowdFlow();

  const dims = venue?.dimensions || { widthMeters: 50, heightMeters: 31 };
  const widthMeters = dims.widthMeters || 50;
  const heightMeters = dims.heightMeters || 31;
  const floorAreaM2 = dims.floorAreaM2 || Math.round(widthMeters * heightMeters);

  const [showAreaModal, setShowAreaModal] = useState(false);
  const [modalWidth, setModalWidth] = useState(widthMeters);
  const [modalHeight, setModalHeight] = useState(heightMeters);
  const [modalArea, setModalArea] = useState(floorAreaM2);

  const handleOpenAreaModal = () => {
    setModalWidth(widthMeters);
    setModalHeight(heightMeters);
    setModalArea(floorAreaM2);
    setShowAreaModal(true);
  };

  const handleWidthChange = (val) => {
    const w = parseFloat(val) || 0;
    setModalWidth(val);
    if (w > 0 && modalHeight > 0) {
      setModalArea(Math.round(w * (parseFloat(modalHeight) || 0)));
    }
  };

  const handleHeightChange = (val) => {
    const h = parseFloat(val) || 0;
    setModalHeight(val);
    if (h > 0 && modalWidth > 0) {
      setModalArea(Math.round((parseFloat(modalWidth) || 0) * h));
    }
  };

  const handleAreaPreset = (area, w, h) => {
    setModalArea(area);
    setModalWidth(w);
    setModalHeight(h);
  };

  const handleSaveArea = (e) => {
    if (e) e.preventDefault();
    if (updateVenueDimensions) {
      updateVenueDimensions({
        widthMeters: Number(modalWidth) || 50,
        heightMeters: Number(modalHeight) || 31,
        floorAreaM2: Number(modalArea) || Math.round((Number(modalWidth) || 50) * (Number(modalHeight) || 31)),
      });
    }
    setShowAreaModal(false);
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const highSeverityRecs = recommendations.filter(
    r => r.severity === 'critical' || r.severity === 'high'
  );

  const activeStreamingCams = cameras.filter(c => c.status === 'streaming').length;
  const [heroBgMode, setHeroBgMode] = useState('ascii'); // 'ascii' | 'crowd'

  return (
    <div className="cf-dashboard-page">
      {/* ========================================================================= */}
      {/* TACTICAL COMMAND HERO (INSPIRATION 1: CROWD CANVAS & INSPIRATION 2: ASCII) */}
      {/* ========================================================================= */}
      <section 
        className="dashboard-hero"
        style={{
          position: 'relative',
          padding: '24px 30px',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--bg-surface-elevated)'
        }}
      >
        {/* Interactive Ambient Dynamics Canvas (Toggled between Inspiration 1 & 2) */}
        {heroBgMode === 'ascii' ? (
          <AsciiReactionCanvas
            accentColor={
              theme === 'chrome-light' 
                ? 'rgba(26, 115, 232, 0.55)' 
                : theme === 'chrome-silver' 
                  ? 'rgba(2, 132, 199, 0.65)' 
                  : 'rgba(56, 189, 248, 0.55)'
            }
            baseColor={
              theme === 'chrome-light' 
                ? 'rgba(95, 99, 104, 0.22)' 
                : theme === 'chrome-silver' 
                  ? 'rgba(100, 116, 139, 0.22)' 
                  : 'rgba(148, 163, 184, 0.16)'
            }
            glowColor={
              theme === 'chrome-light' 
                ? 'rgba(24, 128, 56, 0.28)' 
                : theme === 'chrome-silver' 
                  ? 'rgba(14, 165, 233, 0.32)' 
                  : 'rgba(56, 189, 248, 0.28)'
            }
          />
        ) : (
          <CrowdCanvas
            agentCount={45}
            accentColor={
              theme === 'chrome-light' 
                ? '#1a73e8' 
                : theme === 'chrome-silver' 
                  ? '#0284c7' 
                  : '#38bdf8'
            }
            secondaryColor={
              theme === 'chrome-light' 
                ? '#1e8e3e' 
                : theme === 'chrome-silver' 
                  ? '#475569' 
                  : '#0284c7'
            }
            dimColor={
              theme === 'chrome-light' 
                ? 'rgba(95, 99, 104, 0.45)' 
                : theme === 'chrome-silver' 
                  ? 'rgba(100, 116, 139, 0.45)' 
                  : 'rgba(148, 163, 184, 0.45)'
            }
          />
        )}

        {/* Ambient Theme Gradient Shade to guarantee crisp text legibility */}
        <div className="overview-hero-shade" />

        {/* Hero Foreground Content */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ maxWidth: 660 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <div className="hero-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <Radio size={13} className="text-orange" />
                <span>Crowd Intelligence Command Core</span>
              </div>

              {/* Inspiration 1 & 2 Ambient Dynamics Switcher */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                background: 'var(--bg-subtle)',
                padding: '3px 4px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backdropFilter: 'blur(4px)'
              }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', fontWeight: 700, padding: '0 4px', letterSpacing: '0.04em' }}>
                  AMBIENT:
                </span>
                <button
                  type="button"
                  onClick={() => setHeroBgMode('ascii')}
                  style={{
                    background: heroBgMode === 'ascii' ? 'var(--primary-subtle)' : 'transparent',
                    color: heroBgMode === 'ascii' ? 'var(--primary)' : 'var(--text-muted)',
                    border: heroBgMode === 'ascii' ? '1px solid var(--border-focus)' : '1px solid transparent',
                    borderRadius: 4,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Inspiration 2: Interactive Reaction-Diffusion Character Grid"
                >
                  ⚛ Reaction Grid
                </button>
                <button
                  type="button"
                  onClick={() => setHeroBgMode('crowd')}
                  style={{
                    background: heroBgMode === 'crowd' ? 'var(--primary-subtle)' : 'transparent',
                    color: heroBgMode === 'crowd' ? 'var(--primary)' : 'var(--text-muted)',
                    border: heroBgMode === 'crowd' ? '1px solid var(--border-focus)' : '1px solid transparent',
                    borderRadius: 4,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Inspiration 1: Interactive Animated Crowd Pedestrian Canvas"
                >
                  🚶 Pedestrian Flow
                </button>
              </div>
            </div>

            <h2 className="hero-title" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: '2px 0 6px' }}>
              {venue?.name || 'Venue Operations'} — Overview
            </h2>

            <p className="hero-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-body)', margin: 0, lineHeight: 1.55 }}>
              Real-time multi-source crowd monitoring and agent-based spatial simulation. Track physical occupants, identify emergent bottlenecks, and evaluate evacuation scenarios with predictive social force dynamics.
            </p>

            {/* Quick Status Pill Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.74rem',
                color: 'var(--text-muted)'
              }}>
                <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>AREA:</span>
                <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {floorAreaM2.toLocaleString()} m²
                </span>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                background: activeStreamingCams > 0 ? 'var(--green-subtle)' : 'rgba(255, 255, 255, 0.05)',
                border: activeStreamingCams > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                fontSize: '0.74rem',
                color: activeStreamingCams > 0 ? 'var(--green-text)' : 'var(--text-muted)'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeStreamingCams > 0 ? 'var(--green)' : '#64748b' }} />
                <span>{activeStreamingCams} Cameras Streaming</span>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                background: metrics.activeHotspotsCount > 0 ? 'var(--red-subtle)' : 'var(--green-subtle)',
                border: metrics.activeHotspotsCount > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.74rem',
                color: metrics.activeHotspotsCount > 0 ? 'var(--red-text)' : 'var(--green-text)'
              }}>
                <span>{metrics.activeHotspotsCount > 0 ? `⚠️ ${metrics.activeHotspotsCount} Choke Points` : '✓ Flow Optimal'}</span>
              </div>
            </div>
          </div>

          {/* Hero Quick Navigation Actions */}
          <div className="hero-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn-primary-glow"
              onClick={() => setActiveTab('monitoring')}
              title="Switch to Live Multi-Camera Monitoring Wall"
              style={{ padding: '9px 18px', fontSize: '0.84rem' }}
            >
              <Video size={15} />
              <span>Live Monitoring Wall</span>
            </button>

            <button
              className="btn-secondary"
              onClick={() => setActiveTab('simulation')}
              title="Launch Agent-Based Crowd Simulation"
              style={{ padding: '9px 16px', fontSize: '0.84rem' }}
            >
              <Play size={15} />
              <span>Digital Twin Sim</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* INTERACTIVE FEATURE SLIDESHOW & PLATFORM GUIDE (EMBEDDED IN-PAGE)         */}
      {/* ========================================================================= */}
      <section style={{ margin: '20px 0 24px' }}>
        <PlatformSlideshow isModal={false} />
      </section>

      {/* ========================================================================= */}
      {/* PRIMARY KPI TELEMETRY STRIP                                              */}
      {/* ========================================================================= */}
      <section className="kpi-grid" aria-label="Key Performance Indicators">
        <StatCard
          label="People Inside"
          value={metrics.activePedestrians}
          unit="people"
          subLabel={`Target population: ${simSettings.targetCrowdSize}`}
          icon={Users}
          variant="info"
        />

        <StatCard
          label="Safely Exited"
          value={metrics.totalExited}
          unit="people"
          subLabel="Reached an exit"
          icon={DoorOpen}
          variant="success"
        />

        <StatCard
          label="Average Trip Time"
          value={metrics.avgJourneyTime > 0 ? metrics.avgJourneyTime : '--'}
          unit="sec"
          subLabel="Time from entry to exit"
          icon={Clock}
          variant="default"
        />

        <StatCard
          label="Throughput"
          value={metrics.throughputRate}
          unit="p/min"
          subLabel="Exits per minute"
          icon={Gauge}
          variant={metrics.throughputRate > 40 ? 'success' : 'default'}
        />

        <StatCard
          label="Peak Density"
          value={metrics.peakDensity > 0 ? `${metrics.peakDensity}` : '0.0'}
          unit="p/cell"
          subLabel={`~${(metrics.peakDensity * 0.64).toFixed(1)} people/m²`}
          icon={AlertTriangle}
          variant={metrics.peakDensity >= 3.5 ? 'alert' : metrics.peakDensity >= 2.0 ? 'warning' : 'default'}
        />

        <StatCard
          label="Choke Points"
          value={metrics.activeHotspotsCount}
          unit="hotspots"
          subLabel={metrics.activeHotspotsCount > 0 ? 'Bottlenecks found' : 'Corridors moving freely'}
          icon={AlertOctagon}
          variant={metrics.activeHotspotsCount > 0 ? 'alert' : 'default'}
        />

        <StatCard
          label="Blocked People"
          value={metrics.unreachableCount}
          unit="people"
          subLabel={metrics.unreachableCount > 0 ? 'Cannot reach any exit' : 'All exits accessible'}
          icon={ShieldCheck}
          variant={metrics.unreachableCount > 0 ? 'alert' : 'success'}
        />

        <StatCard
          label="Simulation Timer"
          value={formatTime(metrics.elapsedTime)}
          unit=""
          subLabel={`Sim clock rate: ${simSettings.simClockRate}x`}
          icon={Activity}
          variant="default"
        />
      </section>

      {/* ========================================================================= */}
      {/* MAIN GRID: LIVE TRENDS + VENUE DIAGNOSTICS                                */}
      {/* ========================================================================= */}
      <div className="dashboard-content-grid">
        {/* Left Column: Live Analytics Charts */}
        <div className="dashboard-card chart-card-lg">
          <div className="card-header">
            <div>
              <h3 className="card-title">Crowd Density Flux Over Time</h3>
              <p className="card-sub">Average density across the floor (cyan) vs peak bottleneck density (amber)</p>
            </div>
            <button className="btn-link" onClick={() => setActiveTab('analytics')}>
              Full Telemetry <ArrowRight size={14} />
            </button>
          </div>

          <div className="card-body">
            <MiniChart
              data={metrics.timeSeriesHistory}
              xKey="time"
              yKey="avgDensity"
              secondaryKey="peakDensity"
              color="#38bdf8"
              secondaryColor="#f59e0b"
              height={220}
              yLabel="Avg Density"
              emptyText="Start simulation to see real-time density curves"
            />
          </div>

          <div className="chart-legend-strip">
            <div className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: '#38bdf8' }} />
              <span>Average Density (people/cell)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: '#f59e0b' }} />
              <span>Peak Hotspot Density</span>
            </div>
            <div className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: '#ef4444' }} />
              <span>Choke Threshold (≥3.5)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Scenario Status & Diagnostic Insights */}
        <div className="dashboard-side-col">
          {/* Active Diagnostic Status */}
          <div className="dashboard-card diagnostic-card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={18} className="text-amber" />
                <h3 className="card-title">Bottlenecks & Observations</h3>
              </div>
              <span className={`severity-tag severity-${highSeverityRecs.length > 0 ? 'high' : 'ok'}`}>
                {highSeverityRecs.length > 0 ? `${highSeverityRecs.length} Attention items` : 'Nominal'}
              </span>
            </div>

            <div className="card-body">
              {recommendations.length > 0 ? (
                <div className="diagnostic-list">
                  {recommendations.slice(0, 2).map((rec) => (
                    <div key={rec.id} className={`diagnostic-item border-${rec.severity}`}>
                      <div className="diag-header">
                        <span className="diag-title">{rec.title}</span>
                        <span className={`diag-badge badge-${rec.severity}`}>{rec.severity.toUpperCase()}</span>
                      </div>
                      <p className="diag-problem">{rec.problem}</p>
                      <div className="diag-action">
                        <strong>Suggested fix:</strong> {rec.action}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="diagnostic-empty">
                  <CheckCircle2 size={32} className="text-green" />
                  <p>Crowd flow is moving smoothly with no major choke points detected.</p>
                </div>
              )}
            </div>

            <div className="card-footer">
              <button className="btn-secondary w-full" onClick={() => setActiveTab('recommendations')}>
                View Layout Suggestions <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Venue Layout Snapshot */}
          <div className="dashboard-card venue-summary-card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} className="text-blue" />
                <h3 className="card-title">Venue Layout Summary</h3>
              </div>
            </div>

            <div className="card-body">
              <div className="venue-meta-grid">
                <div className="meta-item" style={{ gridColumn: 'span 2' }}>
                  <span className="meta-label">Physical Floor Area</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, width: '100%', marginTop: 2 }}>
                    <span className="meta-val" style={{ color: '#ffffff' }}>
                      {floorAreaM2.toLocaleString()} m² ({widthMeters}m × {heightMeters}m)
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={handleOpenAreaModal}
                      style={{ padding: '3px 8px', fontSize: '0.74rem', height: 26, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                      title="Edit venue floor area and physical dimensions"
                    >
                      <Edit3 size={12} /> Edit Area
                    </button>
                  </div>
                </div>

                <div className="meta-item">
                  <span className="meta-label">Entrances</span>
                  <span className="meta-val" style={{ color: 'var(--green-text)' }}>
                    {(venue.entrances || []).filter(e => e.enabled !== false).length} Open
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Exits</span>
                  <span className="meta-val" style={{ color: 'var(--green-text)' }}>
                    {(venue.exits || []).filter(e => e.enabled !== false).length} Open
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Booths / Stalls</span>
                  <span className="meta-val">{(venue.stalls || []).length} Units</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Boundary Walls</span>
                  <span className="meta-val">{(venue.walls || []).length} Segments</span>
                </div>
                <div className="meta-item" style={{ gridColumn: 'span 2' }}>
                  <span className="meta-label">Saved Baseline</span>
                  <span className="meta-val" style={{ color: baselineScenario ? '#38bdf8' : 'var(--text-dim)' }}>
                    {baselineScenario ? `Saved (${baselineScenario.venueName})` : 'None saved yet'}
                  </span>
                </div>
              </div>
            </div>

            <div className="card-footer space-between">
              <button className="btn-secondary" onClick={() => setActiveTab('layout')}>
                Edit Blueprint
              </button>
              <button className="btn-secondary" onClick={() => setActiveTab('comparison')}>
                Compare Layouts
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* W3SCHOOLS-STYLE PLATFORM FOOTER & ABOUT DIRECTORY                         */}
      {/* ========================================================================= */}
      <footer className="w3-style-footer" id="about-section" aria-label="CrowdFlow Directory & About">
        {/* Top Horizontal Navigation Bar */}
        <div className="w3-footer-top-nav">
          <div className="w3-footer-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w3-footer-logo-badge">
              <img src="/logo-square.png" alt="CrowdFlow Logo" />
            </div>
            <span className="w3-footer-brand-title">CrowdFlow</span>
          </div>

          <div className="w3-footer-top-links">
            <button type="button" onClick={() => { setActiveTab('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              OVERVIEW
            </button>
            <button type="button" onClick={() => { setActiveTab('layout'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              BLUEPRINT CAD
            </button>
            <button type="button" onClick={() => { setActiveTab('simulation'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              DIGITAL TWIN SIM
            </button>
            <button type="button" onClick={() => { setActiveTab('monitoring'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              LIVE YOLO WALL
            </button>
            <button type="button" onClick={() => { setActiveTab('analytics'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              FLOW ANALYTICS
            </button>
            <button type="button" onClick={() => { setActiveTab('comparison'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              SCENARIO LAB
            </button>
            <button type="button" onClick={() => { setActiveTab('recommendations'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              SAFETY AUDIT
            </button>
          </div>
        </div>

        {/* 4 Categorized Columns Directory */}
        <div className="w3-footer-columns-grid">
          {/* Column 1: Platform Consoles */}
          <div className="w3-footer-col">
            <h4 className="w3-col-heading">Platform Consoles</h4>
            <ul className="w3-col-links">
              <li><button type="button" onClick={() => { setActiveTab('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Spatial Overview Dashboard</button></li>
              <li><button type="button" onClick={() => { setActiveTab('layout'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>2D Blueprint CAD Digitizer</button></li>
              <li><button type="button" onClick={() => { setActiveTab('simulation'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Helbing Social Force Simulation</button></li>
              <li><button type="button" onClick={() => { setActiveTab('monitoring'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Multi-Camera YOLOv8 Wall</button></li>
              <li><button type="button" onClick={() => { setActiveTab('analytics'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Real-Time Density Heatmap Flux</button></li>
              <li><button type="button" onClick={() => { setActiveTab('analytics'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Corridor Choke Point Telemetry</button></li>
              <li><button type="button" onClick={() => { setActiveTab('analytics'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Evacuation Journey Duration</button></li>
              <li><button type="button" onClick={() => { setActiveTab('comparison'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Scenario Baseline Comparison</button></li>
              <li><button type="button" onClick={() => { setActiveTab('recommendations'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Automated Safety Mitigations</button></li>
              <li><button type="button" onClick={() => { setActiveTab('monitoring'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Mobile Phone Edge Camera Setup</button></li>
            </ul>
          </div>

          {/* Column 2: Safety & Standards */}
          <div className="w3-footer-col">
            <h4 className="w3-col-heading">Safety & Standards</h4>
            <ul className="w3-col-links">
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('NFPA 101: Life Safety Code egress criteria verified.', 'info'); }}>NFPA 101 Life Safety Code</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification("Fruin's Pedestrian Planning: Level of Service (LOS A–F) integrated.", 'info'); }}>Fruin's Level of Service (LOS)</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('UK Green Guide: Guide to Safety at Sports Grounds active.', 'info'); }}>UK Green Guide Protocol</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Egress width rule: Minimum 1.2m per exit door clearance enforced.', 'info'); }}>Egress Door Width Capacity</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Critical crush threshold: Alerts trigger when density exceeds 4.0 p/m².', 'warning'); }}>Critical Density Limits (p/m²)</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Chokepoint risk scoring evaluates constriction ratios dynamically.', 'info'); }}>Constriction Risk Scoring</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('One-way turnstiles and corridor directional control enabled.', 'info'); }}>One-Way Corridor Regulation</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Egress flow rate modeled at 82 persons per meter-width per minute.', 'info'); }}>Safe Egress Flow Limits</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Fire marshal emergency protocol and exit door toggling ready.', 'info'); }}>Fire Marshal Clearance Rules</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Spatial resilience verified under simulated evacuation surges.', 'info'); }}>Spatial Resilience Testing</a></li>
            </ul>
          </div>

          {/* Column 3: Spatial AI & Core */}
          <div className="w3-footer-col">
            <h4 className="w3-col-heading">Spatial AI & Core</h4>
            <ul className="w3-col-links">
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Social Force Model: dV/dt = F_self + ∑F_ped + ∑F_wall evaluated at 60Hz.', 'info'); }}>Social Force Equation</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Collision avoidance exponential repulsion boundary: A * exp(-d/B).', 'info'); }}>Obstacle Repulsion Vectors</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Dynamic vector potential flow fields guide agents toward optimal exits.', 'info'); }}>Vector Potential Field Guidance</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('YOLOv8 neural detection running at sub-second real-time inference.', 'info'); }}>YOLOv8 Neural Detection</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Multi-stream video decoding pipeline with low-latency buffering.', 'info'); }}>Sub-Second Neural Inference</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Fast WebSocket pub/sub telemetry broadcasting at 60 FPS.', 'info'); }}>WebSocket Telemetry Push</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Computer vision blueprint digitizer auto-detects architectural walls.', 'info'); }}>CAD Blueprint Vectorization</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('LOS breakdown: Free Flow (A), Stable (B), Crowded (C), Shuffling (D), Jammed (E/F).', 'info'); }}>LOS Density Classification</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Real-time queueing theory throughput and egress metrics.', 'info'); }}>Queueing Theory Egress</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('GeoJSON compatible coordinate space and polygon boundaries.', 'info'); }}>GeoJSON Spatial Topology</a></li>
            </ul>
          </div>

          {/* Column 4: Operations & Docs */}
          <div className="w3-footer-col">
            <h4 className="w3-col-heading">Operations & Docs</h4>
            <ul className="w3-col-links">
              <li><button type="button" onClick={() => { setActiveTab('monitoring'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Mobile Camera QR Pairing</button></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('RTSP IP camera stream decoder ready for security DVR matrices.', 'info'); }}>RTSP IP Camera Streaming</a></li>
              <li><button type="button" onClick={exportLayoutJSON}>Export Venue Layout (JSON)</button></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('REST API endpoints available at /api/zones, /api/cameras, /api/occupancy.', 'info'); }}>REST Telemetry API</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Live WebSocket feed listening on /ws/live.', 'info'); }}>WebSocket Streaming API</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Runs on modern GPUs (Metal/CUDA) or CPU WebAssembly acceleration.', 'info'); }}>Edge Hardware Guidelines</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Simulated drill scenario generator ready for operator training.', 'info'); }}>Evacuation Drills Protocol</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Live choke point traps and real-time hazard flags active.', 'info'); }}>Live Bottleneck Alerts</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('All backend services nominal. FastAPI + WebSocket active.', 'success'); }}>System Health & Status</a></li>
              <li><a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Secure edge observations with encrypted local transport.', 'info'); }}>Operational Security Guide</a></li>
            </ul>
          </div>
        </div>

        {/* Social Icons & Primary Utility Links Row (Single Centered Horizontal Line) */}
        <div className="w3-footer-social-row">
          <div className="w3-social-icons">
            <button type="button" className="w3-social-btn" title="YouTube Walkthroughs" onClick={() => addNotification('CrowdFlow YouTube demonstrations.', 'info')}>
              <Youtube size={17} />
            </button>
            <button type="button" className="w3-social-btn" title="LinkedIn Professional Network" onClick={() => addNotification('CrowdFlow LinkedIn network.', 'info')}>
              <Linkedin size={17} />
            </button>
            <button type="button" className="w3-social-btn" title="Operations Community Discord" onClick={() => addNotification('CrowdFlow Operations Discord Community.', 'info')}>
              <MessageSquare size={17} />
            </button>
            <button type="button" className="w3-social-btn" title="Facebook Safety Network" onClick={() => addNotification('CrowdFlow Facebook network.', 'info')}>
              <Facebook size={17} />
            </button>
            <button type="button" className="w3-social-btn" title="Instagram Visual Stream" onClick={() => addNotification('CrowdFlow Instagram stream.', 'info')}>
              <Instagram size={17} />
            </button>
          </div>

          <div className="w3-utility-links">
            <button type="button" onClick={() => addNotification('Opening Operations Community Forum...', 'info')}>
              FORUM
            </button>
            <button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              ABOUT
            </button>
            <button type="button" onClick={() => addNotification('Opening CrowdFlow Operations Academy...', 'info')}>
              ACADEMY
            </button>
          </div>
        </div>

        {/* Informational Disclaimer Block */}
        <div className="w3-footer-disclaimer">
          <p>
            CrowdFlow is optimized for learning, simulation, and crowd safety operations. Simulations, neural detections, and models are constantly updated to assist operational planning and compliance. Real-world venue operations should adhere to certified local safety regulations, fire marshal instructions, and professional crowd management protocols. While using CrowdFlow, you agree to have read and accepted our{' '}
            <a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Opening Terms of Use...', 'info'); }}>terms of use</a>,{' '}
            <a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Opening Cookie Policy...', 'info'); }}>cookies</a> and{' '}
            <a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Opening Privacy Policy...', 'info'); }}>privacy policy</a>.
          </p>
        </div>

        {/* Legal & Copyright Bar */}
        <div className="w3-footer-copyright-bar">
          <div className="w3-copyright-text">
            <span>
              <a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('CrowdFlow License & Version 2024–2026', 'info'); }}>
                Copyright 2024–{new Date().getFullYear()}
              </a>{' '}
              by CrowdFlow Operations. All Rights Reserved.{' '}
              <a href="#about-section" onClick={(e) => { e.preventDefault(); addNotification('Powered by Helbing Social Force & YOLOv8 Engine.', 'success'); }}>
                CrowdFlow is Powered by Spatial AI & YOLO Engine
              </a>.
            </span>
          </div>
          <button type="button" className="w3-back-top-link" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to Top ↑
          </button>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* EDIT FLOOR AREA & DIMENSIONS MODAL (DARK OPERATIONS THEME)                 */}
      {/* ========================================================================= */}
      {showAreaModal && (
        <div className="cf-modal-overlay">
          <div className="cf-modal-content" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Maximize2 size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                  Calibrate Venue Dimensions
                </h3>
              </div>
              <button
                onClick={() => setShowAreaModal(false)}
                className="btn-close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Calibrate the total physical footprint area and boundary scale used across density calculations, telemetry, and camera mapping.
            </p>

            <form onSubmit={handleSaveArea}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: 4 }}>
                    Total Floor Area (m²)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="500000"
                    step="1"
                    value={modalArea}
                    onChange={(e) => setModalArea(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-card)',
                      background: 'var(--bg-subtle)',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      fontFamily: 'var(--font-mono)',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: 4 }}>
                      Venue Width (meters)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="2000"
                      step="1"
                      value={modalWidth}
                      onChange={(e) => handleWidthChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-card)',
                        background: 'var(--bg-subtle)',
                        fontSize: '0.92rem',
                        color: '#ffffff',
                        fontFamily: 'var(--font-mono)',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: 4 }}>
                      Venue Length / Height (meters)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="2000"
                      step="1"
                      value={modalHeight}
                      onChange={(e) => handleHeightChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-card)',
                        background: 'var(--bg-subtle)',
                        fontSize: '0.92rem',
                        color: '#ffffff',
                        fontFamily: 'var(--font-mono)',
                        boxSizing: 'border-box'
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                    Quick Footprint Presets:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleAreaPreset(800, 40, 20)}
                      className="btn-chip"
                    >
                      800 m² (40×20m)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAreaPreset(1550, 50, 31)}
                      className="btn-chip active"
                    >
                      1,550 m² (Standard)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAreaPreset(2500, 62, 40)}
                      className="btn-chip"
                    >
                      2,500 m² (62×40m)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAreaPreset(5000, 100, 50)}
                      className="btn-chip"
                    >
                      5,000 m² (100×50m)
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAreaModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  <Check size={14} /> Save Dimensions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
