import React, { useState, useEffect, useRef } from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import { 
  Compass, 
  Map, 
  Play, 
  Video, 
  BarChart3, 
  GitCompare, 
  Lightbulb, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  PlayCircle, 
  PauseCircle, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  Maximize2 
} from 'lucide-react';

export const SLIDES = [
  {
    id: 'overview',
    number: '01',
    tabId: 'dashboard',
    tabName: 'Overview',
    badge: 'CORE MISSION',
    icon: Compass,
    title: 'CrowdFlow Spatial Intelligence & Safety Core',
    subtitle: 'Holistic real-time crowd dynamics, digital twin simulation, and safety management',
    description: 'CrowdFlow bridges physical venue monitoring and predictive computer simulation into a unified operational dashboard. Designed for venue managers, festival directors, and safety engineers to understand crowd pressure, anticipate emergent chokepoints, and ensure crowd safety.',
    highlights: [
      'Real-time KPI telemetry (active occupants, exit throughput, and trip times)',
      'Dual-mode ambient visualization (pedestrian flow vectors and reaction-diffusion grid)',
      'Instant safety alerting on emergent crowd congestion and bottlenecks'
    ],
    preview: {
      type: 'kpi',
      stat1: { label: 'Occupancy', val: '80+' },
      stat2: { label: 'Throughput', val: '24/min' },
      stat3: { label: 'Safety Index', val: 'Optimal' },
    }
  },
  {
    id: 'layout',
    number: '02',
    tabId: 'layout',
    tabName: 'Layout Editor',
    badge: 'DESIGN & MAPPING',
    icon: Map,
    title: 'Interactive 2D Venue Layout & Blueprint Digitizer',
    subtitle: 'Architectural space planning with automated computer vision blueprint detection',
    description: 'Craft high-fidelity spatial models of your arena, exhibition hall, or festival grounds. Draw boundary perimeters, partition walls, one-way turnstiles, and emergency egress exits. Upload CAD architectural drawings or floor plan images to auto-convert them into navigable digital twins.',
    highlights: [
      'Precision drawing tools for walls, columns, entry gates, and egress doors',
      'AI Blueprint Digitizer: Auto-detect candidate walls and doors from image files',
      'Area and metric calibration tools for realistic meter-to-pixel scaling'
    ],
    preview: {
      type: 'editor',
      items: ['Main Entrance Gate', 'Central Exhibition Hall', 'North Walkway Corridor', 'East Exit Egress']
    }
  },
  {
    id: 'simulation',
    number: '03',
    tabId: 'simulation',
    tabName: 'Simulation',
    badge: 'PHYSICS & TWINS',
    icon: Play,
    title: 'Agent-Based Social Force Crowd Simulation',
    subtitle: 'Predictive pedestrian physics modeling evacuation flows and emergent turbulence',
    description: 'Simulate hundreds of individual pedestrians using Helbing’s classical Social Force Model. Each autonomous agent navigates dynamic vector flow fields, maintains personal comfort boundaries, avoids physical obstacles, and seeks the nearest or fastest exit paths.',
    highlights: [
      'Multi-agent physics with collision repulsion, velocity vectors, and cadence',
      'Live density heatmap overlay and real-time bottleneck choke point detection',
      'Adjust crowd volume, walking velocities, and slow-motion/fast-forward sim clock rates'
    ],
    preview: {
      type: 'sim',
      tags: ['Social Force Model', 'Dynamic Vector Fields', 'Density Heatmap', 'Choke Point Traps']
    }
  },
  {
    id: 'monitoring',
    number: '04',
    tabId: 'monitoring',
    tabName: 'Live Monitoring',
    badge: 'YOLO AI & VISION',
    icon: Video,
    title: 'Live Multi-Camera YOLOv8 Vision Wall',
    subtitle: 'Multi-stream physical crowd counting with mobile camera QR pairing',
    description: 'Connect live camera feeds into an automated YOLOv8 computer vision detection pipeline. Use your desktop webcam, stream over RTSP, or instantly pair any smartphone camera via QR code to count real-world humans, monitor zonal occupancy thresholds, and mirror observations into the digital twin.',
    highlights: [
      'YOLOv8 deep learning neural network for real-time person detection',
      'Instant mobile phone camera streaming with secure WebSocket pairing',
      'Zonal crowd occupancy thresholds with automatic caution & critical alerts'
    ],
    preview: {
      type: 'cameras',
      cams: ['Entrance Cam 01', 'Atrium Cam 02', 'Mobile Phone Stream', 'Exit Corridor Cam']
    }
  },
  {
    id: 'analytics',
    number: '05',
    tabId: 'analytics',
    tabName: 'Analytics',
    badge: 'DEEP METRICS',
    icon: BarChart3,
    title: 'Deep Spatial Telemetry & Fruin Level-of-Service',
    subtitle: 'Comprehensive evacuation progression curves and international safety standards',
    description: 'Dive deep into chronological crowd progression analytics. Review peak bottleneck times, egress throughput curves, evacuation completion benchmarks, and Fruin Level-of-Service (LOS A to F) safety classifications to verify regulatory compliance.',
    highlights: [
      'Historical time-series charting of crowd density flux and egress speed',
      'Fruin Level-of-Service (LOS) distribution for international venue safety compliance',
      'Interactive plain-English explainers for crowd dynamics & choke point causes'
    ],
    preview: {
      type: 'analytics',
      metrics: ['LOS A-B: 78% Safe', 'LOS C-D: 18% Stable', 'LOS E-F: 4% Choke', 'Evacuation: 94.2%']
    }
  },
  {
    id: 'comparison',
    number: '06',
    tabId: 'comparison',
    tabName: 'Compare & Recommend',
    badge: 'ACTIONABLE AI',
    icon: Lightbulb,
    title: 'Scenario Comparison & AI Safety Recommendations',
    subtitle: 'A/B layout validation and one-click architectural & operational fixes',
    description: 'Capture baseline layouts and test alternative architectural designs side-by-side to find the optimal floor configuration. An automated rule-based expert system detects safety flaws and generates prioritized structural fixes (e.g. widening bottleneck exits) with 1-click execution.',
    highlights: [
      'Side-by-side comparative A/B delta table across evacuation times and peak densities',
      'Automated rule engine detects trapped pedestrians, blind corners, and slow exits',
      'One-click application of recommended architectural modifications'
    ],
    preview: {
      type: 'recommendations',
      fixes: ['Widen Exit Portals (+1.8m)', 'Add Staggered Guide Barriers', 'Balance Egress Rerouting']
    }
  }
];

export default function PlatformSlideshow({ isModal = false, onClose = () => {} }) {
  const { setActiveTab } = useCrowdFlow();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef(null);

  const currentSlide = SLIDES[currentIndex];
  const Icon = currentSlide.icon;

  // Auto-advance slideshow timer (pauses when user hovers to read)
  useEffect(() => {
    if (!isPlaying || isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isHovered, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
      } else if (e.key === 'Escape' && isModal) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModal, onClose]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  const handleJumpToFeature = (tabId) => {
    setActiveTab(tabId);
    if (isModal) {
      onClose();
    }
  };

  const content = (
    <div 
      className={`platform-slideshow-container ${isModal ? 'modal-mode' : 'embedded-mode'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Dynamic Animated Progress Bar for Auto-play */}
      {isPlaying && !isHovered && (
        <div className="slideshow-progress-track">
          <div
            key={currentIndex}
            className="slideshow-progress-bar"
            style={{ animationDuration: '4500ms' }}
          />
        </div>
      )}

      {/* Slideshow Top Header */}
      <div className="slideshow-header">
        <div className="slideshow-header-left">
          <div className="slideshow-badge">
            <Sparkles size={13} style={{ color: 'var(--primary)' }} />
            <span>PLATFORM GUIDE & FEATURE TOUR</span>
          </div>
          <span className="slideshow-step-counter">
            Feature {currentSlide.number} of {String(SLIDES.length).padStart(2, '0')}
          </span>
        </div>

        <div className="slideshow-header-controls">
          {/* Autoplay button */}
          <button
            type="button"
            className="slideshow-btn-icon"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause Auto-Play' : 'Resume Auto-Play (4.5s per feature)'}
          >
            {isPlaying && !isHovered ? (
              <PauseCircle size={16} style={{ color: 'var(--primary)' }} />
            ) : (
              <PlayCircle size={16} />
            )}
            <span style={{ fontSize: '0.74rem', fontWeight: 600 }}>
              {isHovered && isPlaying ? 'Paused (Hovering)' : isPlaying ? 'Auto: Running' : 'Paused'}
            </span>
          </button>

          {/* Close button if in modal */}
          {isModal && (
            <button
              type="button"
              className="slideshow-btn-close"
              onClick={onClose}
              title="Close Platform Tour"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Slide Card Body with Smooth Glide Entrance */}
      <div className="slideshow-body" key={currentIndex}>
        {/* Left Information Section */}
        <div className="slideshow-info-pane">
          <div className="slide-tagline-wrap">
            <span className="slide-category-badge">{currentSlide.badge}</span>
            <span className="slide-tab-hint">Available in: <strong>{currentSlide.tabName}</strong></span>
          </div>

          <div className="slide-title-wrap">
            <div className="slide-icon-box">
              <Icon size={24} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 className="slide-title">{currentSlide.title}</h3>
              <p className="slide-subtitle">{currentSlide.subtitle}</p>
            </div>
          </div>

          <p className="slide-description">{currentSlide.description}</p>

          <div className="slide-highlights-list">
            {currentSlide.highlights.map((item, idx) => (
              <div key={idx} className="slide-highlight-item">
                <CheckCircle2 size={15} className="slide-check-icon" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Direct Feature Navigation Button */}
          <div className="slide-action-row">
            <button
              type="button"
              className="btn-primary-glow slide-jump-btn"
              onClick={() => handleJumpToFeature(currentSlide.tabId)}
              title={`Switch to ${currentSlide.tabName} section`}
            >
              <span>Explore {currentSlide.tabName}</span>
              <ArrowRight size={14} />
            </button>
            <span className="slide-action-hint">Click to jump directly to this operational screen</span>
          </div>
        </div>

        {/* Right Graphical Preview Section */}
        <div className="slideshow-visual-pane">
          <div className="visual-preview-card">
            <div className="preview-card-header">
              <div className="preview-card-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <span className="preview-card-title">{currentSlide.tabName} Preview</span>
            </div>

            <div className="preview-card-content">
              {currentSlide.preview.type === 'kpi' && (
                <div className="preview-kpi-grid">
                  <div className="preview-kpi-box">
                    <span className="preview-kpi-label">Active Flow</span>
                    <span className="preview-kpi-val" style={{ color: 'var(--primary)' }}>80 Pedestrians</span>
                    <span className="preview-kpi-sub">Continuous seed generation</span>
                  </div>
                  <div className="preview-kpi-box">
                    <span className="preview-kpi-label">Egress Efficiency</span>
                    <span className="preview-kpi-val" style={{ color: 'var(--green-text)' }}>24 exits/min</span>
                    <span className="preview-kpi-sub">Nominal corridor travel</span>
                  </div>
                  <div className="preview-kpi-box" style={{ gridColumn: 'span 2' }}>
                    <span className="preview-kpi-label">System State</span>
                    <span className="preview-kpi-val" style={{ color: 'var(--primary)' }}>Flow Optimal ✓</span>
                    <span className="preview-kpi-sub">Zero critical bottleneck turbulence</span>
                  </div>
                </div>
              )}

              {currentSlide.preview.type === 'editor' && (
                <div className="preview-editor-box">
                  <div className="preview-editor-blueprint-mock">
                    <div className="mock-grid-line" />
                    <div className="mock-room-gate" />
                    <div className="mock-room-hall" />
                  </div>
                  <div className="preview-editor-list">
                    {currentSlide.preview.items.map((it, i) => (
                      <div key={i} className="preview-editor-item">
                        <span className="preview-bullet" />
                        <span>{it}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentSlide.preview.type === 'sim' && (
                <div className="preview-sim-box">
                  <div className="preview-sim-canvas-mock">
                    <div className="sim-mock-agent a1" />
                    <div className="sim-mock-agent a2" />
                    <div className="sim-mock-agent a3" />
                    <div className="sim-mock-agent a4" />
                    <div className="sim-mock-goal" />
                  </div>
                  <div className="preview-tag-cloud">
                    {currentSlide.preview.tags.map((t, i) => (
                      <span key={i} className="preview-tag">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {currentSlide.preview.type === 'cameras' && (
                <div className="preview-cam-box">
                  <div className="preview-cam-grid">
                    {currentSlide.preview.cams.map((c, i) => (
                      <div key={i} className="preview-cam-tile">
                        <span className="preview-rec-dot" />
                        <span className="preview-cam-name">{c}</span>
                        <span className="preview-cam-yolo">YOLO: 0-14 tracked</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentSlide.preview.type === 'analytics' && (
                <div className="preview-analytics-box">
                  <div className="preview-mini-chart-mock">
                    <div className="mock-bar b1" />
                    <div className="mock-bar b2" />
                    <div className="mock-bar b3" />
                    <div className="mock-bar b4" />
                    <div className="mock-bar b5" />
                  </div>
                  <div className="preview-analytics-stats">
                    {currentSlide.preview.metrics.map((m, i) => (
                      <div key={i} className="preview-metric-pill">{m}</div>
                    ))}
                  </div>
                </div>
              )}

              {currentSlide.preview.type === 'recommendations' && (
                <div className="preview-rec-box">
                  <div className="preview-rec-header">
                    <ShieldCheck size={16} style={{ color: 'var(--green-text)' }} />
                    <span>Rule Engine Prescriptions</span>
                  </div>
                  <div className="preview-rec-items">
                    {currentSlide.preview.fixes.map((f, i) => (
                      <div key={i} className="preview-rec-item">
                        <span className="rec-fix-dot" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slideshow Bottom Navigation Controls */}
      <div className="slideshow-footer">
        {/* Previous Button */}
        <button
          type="button"
          className="slideshow-nav-btn prev"
          onClick={handlePrev}
          title="Previous feature (Left Arrow key)"
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>

        {/* Step Indicator Dots */}
        <div className="slideshow-dots-bar" role="tablist" aria-label="Feature Slides">
          {SLIDES.map((s, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`slideshow-dot ${isActive ? 'active' : ''}`}
                onClick={() => setCurrentIndex(idx)}
                title={`Jump to Feature ${s.number}: ${s.tabName}`}
              >
                <span className="dot-number">{s.number}</span>
                <span className="dot-label">{s.tabName}</span>
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          className="slideshow-nav-btn next"
          onClick={handleNext}
          title="Next feature (Right Arrow key)"
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="cf-modal-overlay slideshow-modal-overlay" onClick={onClose}>
        <div 
          className="slideshow-modal-window"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  return content;
}
