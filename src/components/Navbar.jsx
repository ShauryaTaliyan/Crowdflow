import React, { useRef } from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import ThemeSwitcher from './ThemeSwitcher';
import { 
  LayoutDashboard, 
  Map, 
  Play, 
  BarChart3, 
  GitCompare, 
  Lightbulb, 
  Download, 
  Upload, 
  RotateCcw,
  Sparkles,
  Layers,
  Video,
  Smartphone,
  Radio,
  Activity,
  ShieldCheck
} from 'lucide-react';

export default function Navbar() {
  const {
    activeTab,
    setActiveTab,
    venue,
    exportLayoutJSON,
    importLayoutJSON,
    resetSimulation,
    recommendations,
    cameras = [],
    isBackendConnected,
    openPhoneCameraConnectFlow
  } = useCrowdFlow();

  const fileInputRef = useRef(null);

  const activeStreamingCams = cameras.filter(c => c.status === 'streaming').length;

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'layout', label: 'Layout Editor', icon: Map },
    { id: 'simulation', label: 'Simulation', icon: Play },
    { 
      id: 'monitoring', 
      label: 'Live Monitoring', 
      icon: Video, 
      badge: activeStreamingCams > 0 ? activeStreamingCams : null, 
      badgeColor: '#10b981' 
    },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'comparison', label: 'Compare Layouts', icon: GitCompare },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb, badge: recommendations.filter(r => r.severity === 'critical' || r.severity === 'high').length },
  ];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      importLayoutJSON(file);
      e.target.value = '';
    }
  };

  return (
    <header className="cf-navbar">
      <div className="navbar-top">
        {/* Tactical Branding */}
        <div className="navbar-brand" onClick={() => setActiveTab('dashboard')} title="CrowdFlow Operations Command">
          <div className="brand-logo">
            <img src="/logo-square.png" alt="CrowdFlow Logo" className="brand-logo-img" />
          </div>
          <div className="brand-text">
            <div className="brand-title-wrap">
              <span className="brand-title">CrowdFlow</span>
              <span className="brand-badge">OPS CORE</span>
            </div>
            <span className="brand-sub">Spatial Intelligence & Crowd Safety Platform</span>
          </div>
        </div>

        {/* Global Telemetry & Actions */}
        <div className="navbar-controls">
          {/* Active Venue Indicator */}
          <div className="venue-selector-box" title="Active Venue Floor Plan">
            <span className="selector-label">VENUE:</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {venue?.name || 'CrowdFlow Exhibition Hall Demo'}
            </span>
          </div>

          {/* Theme Selector (Chrome Light / Titanium / Silver) */}
          <ThemeSwitcher />

          {/* Quick Actions: Export, Import */}
          <div className="quick-actions">
            <button
              className="btn-nav-action"
              onClick={exportLayoutJSON}
              title="Export Venue Layout as JSON"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
            <button
              className="btn-nav-action"
              onClick={() => fileInputRef.current?.click()}
              title="Import Layout JSON"
            >
              <Upload size={14} />
              <span>Import</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="navbar-tabs" aria-label="Main Navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="tab-alert-badge">{tab.badge}</span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
