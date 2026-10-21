import React, { useState } from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import { 
  Lightbulb, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle2, 
  CheckSquare,
  Square,
  Check,
  Info, 
  ArrowRight, 
  ShieldAlert, 
  Sparkles,
  Sliders,
  DoorOpen,
  ShieldCheck
} from 'lucide-react';

export default function RecommendationsView() {
  const {
    recommendations,
    setActiveTab,
    metrics,
    venue,
    simStatus,
    startSimulation,
    applyRecommendationLayoutChange,
    applyMultipleRecommendationLayoutChanges,
  } = useCrowdFlow();

  const [selectedRecIds, setSelectedRecIds] = useState(new Set());

  const actionableRecs = recommendations.filter(r => Boolean(r.layoutChange));

  const toggleSelect = (recId) => {
    setSelectedRecIds(prev => {
      const next = new Set(prev);
      if (next.has(recId)) {
        next.delete(recId);
      } else {
        next.add(recId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRecIds.size === actionableRecs.length && actionableRecs.length > 0) {
      setSelectedRecIds(new Set());
    } else {
      setSelectedRecIds(new Set(actionableRecs.map(r => r.id)));
    }
  };

  const handleApplySelected = () => {
    const selectedChanges = recommendations
      .filter(r => selectedRecIds.has(r.id) && r.layoutChange)
      .map(r => r.layoutChange);

    if (selectedChanges.length > 0) {
      applyMultipleRecommendationLayoutChanges(selectedChanges);
    }
  };

  const criticalCount = recommendations.filter(r => r.severity === 'critical').length;
  const highCount = recommendations.filter(r => r.severity === 'high').length;
  const mediumCount = recommendations.filter(r => r.severity === 'medium').length;

  return (
    <div className="cf-recommendations-page">
      {/* Top Banner */}
      <div className="recommendations-hero">
        <div className="hero-text">
          <div className="hero-badge">
            <ShieldCheck size={14} className="text-blue" />
            <span>Smart Layout Optimization & Flow Pacing</span>
          </div>
          <h2 className="hero-title">Crowd Flow Optimization & Congestion Relief</h2>
          <p className="hero-subtitle">
            Actionable layout and operational recommendations for {venue.name}. Solutions systematically widen constricted exit doors, clear obstacles from high-traffic aisles, adjust booth setbacks, and open dual-flow gates to eliminate choke points and reduce crowd density.
          </p>
        </div>

        <div className="hero-stats-group">
          <div className="rec-summary-pill border-red">
            <span className="pill-count">{criticalCount}</span>
            <span className="pill-label">Blocked Paths</span>
          </div>
          <div className="rec-summary-pill border-orange">
            <span className="pill-count">{highCount}</span>
            <span className="pill-label">Choke Points</span>
          </div>
          <div className="rec-summary-pill border-yellow">
            <span className="pill-count">{mediumCount}</span>
            <span className="pill-label">Flow Optimizations</span>
          </div>
        </div>
      </div>

      {/* Simulation status advisory - only shown when paused/ready so running layout never shifts */}
      {simStatus !== 'running' && (
        <div className="rec-status-banner" style={{ marginBottom: 16 }}>
          <Info size={18} className="text-blue" />
          <span>
            Simulation is currently {simStatus}. Start simulation to observe live pedestrian movement and generate real-time crowd safety recommendations.
          </span>
          <button className="btn-xs btn-primary" onClick={startSimulation} style={{ marginLeft: 'auto' }}>
            Run Simulation Now
          </button>
        </div>
      )}

      {/* Batch Recommendation Multi-Select Bar */}
      {actionableRecs.length > 0 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 8,
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={handleSelectAll}
              className="btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600
              }}
              title="Select or deselect all operational recommendations"
            >
              {selectedRecIds.size === actionableRecs.length && actionableRecs.length > 0 ? (
                <>
                  <CheckSquare size={16} style={{ color: 'var(--primary)' }} />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={16} />
                  <span>Select All ({actionableRecs.length})</span>
                </>
              )}
            </button>

            <span style={{ fontSize: '0.84rem', color: 'var(--text-main)', fontWeight: 600 }}>
              {selectedRecIds.size === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>Tick the checkboxes below to select multiple recommendations to apply simultaneously.</span>
              ) : (
                <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} className="text-blue" />
                  <strong>{selectedRecIds.size} of {actionableRecs.length} recommendations selected</strong>
                </span>
              )}
            </span>
          </div>

          {selectedRecIds.size > 0 && (
            <button
              className="btn-primary-glow"
              onClick={handleApplySelected}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 20px',
                fontWeight: 700,
                fontSize: '0.88rem'
              }}
              title="Apply all selected door and barrier recommendations to the layout editor together"
            >
              <Sparkles size={16} />
              <span>Apply {selectedRecIds.size} Selected Recommendations to Layout</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* Recommendations Cards List */}
      <div className="recommendations-list">
        {recommendations.map((rec) => {
          const isCritical = rec.severity === 'critical';
          const isHigh = rec.severity === 'high';
          const isMedium = rec.severity === 'medium';
          const isSelected = selectedRecIds.has(rec.id);

          return (
            <div
              key={rec.id}
              className={`recommendation-card border-${rec.severity}`}
              style={{
                borderColor: isSelected ? 'var(--primary)' : undefined,
                background: isSelected ? 'rgba(249, 115, 22, 0.06)' : undefined,
                boxShadow: isSelected ? '0 0 0 2px var(--primary), 0 4px 12px rgba(249, 115, 22, 0.15)' : undefined,
                transition: 'all 0.18s ease'
              }}
            >
              <div className="rec-header">
                <div className="rec-title-wrap">
                  {/* Tick Select Checkbox */}
                  {rec.layoutChange && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(rec.id);
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: isSelected ? '2px solid var(--primary)' : '2px solid var(--border-card)',
                        background: isSelected ? 'var(--primary)' : 'var(--bg-app)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 6px rgba(249, 115, 22, 0.3)' : 'none'
                      }}
                      title={isSelected ? 'Deselect this recommendation' : 'Select to apply with other recommendations'}
                    >
                      {isSelected && <Check size={16} strokeWidth={3} />}
                    </div>
                  )}

                  <div className="rec-icon-wrapper">
                    {isCritical ? (
                      <AlertOctagon size={20} className="text-red" />
                    ) : isHigh ? (
                      <AlertTriangle size={20} className="text-orange" />
                    ) : isMedium ? (
                      <Lightbulb size={20} className="text-amber" />
                    ) : (
                      <CheckCircle2 size={20} className="text-green" />
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 className="rec-title" style={{ margin: 0 }}>{rec.title}</h3>
                      {isSelected && (
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(249, 115, 22, 0.15)',
                          color: 'var(--primary)'
                        }}>
                          SELECTED FOR BATCH APPLY
                        </span>
                      )}
                    </div>
                    <div className="rec-meta">
                      <span className={`severity-badge badge-${rec.severity}`}>
                        {rec.severity.toUpperCase()}
                      </span>
                      <span className="rec-category">{rec.category}</span>
                      {rec.impactMetric && (
                        <span className="rec-impact">{rec.impactMetric}</span>
                      )}
                    </div>
                  </div>
                </div>

                {rec.layoutChange ? (
                  <button
                    className="btn-primary-glow"
                    onClick={() => applyRecommendationLayoutChange(rec.layoutChange)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      borderRadius: 6,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title="Automatically apply this change to the layout editor ready to be submitted"
                  >
                    <Sparkles size={15} />
                    <span>Apply to Layout Editor</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => setActiveTab('layout')}
                    title="Open Venue Layout Editor"
                  >
                    <span>View Layout Editor</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>

              <div className="rec-body">
                {/* 1. Problem */}
                <div className="rec-section">
                  <span className="rec-section-label">ISSUE OBSERVED</span>
                  <p className="rec-text">{rec.problem}</p>
                </div>

                {/* 2. Evidence */}
                <div className="rec-section evidence-box">
                  <span className="rec-section-label">SIMULATION OBSERVATION</span>
                  <p className="rec-text font-mono">{rec.evidence}</p>
                </div>

                {/* 3. Action */}
                <div className="rec-section action-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="rec-section-label" style={{ margin: 0 }}>RECOMMENDED INTERVENTION</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 8px', borderRadius: 4 }}>
                      {rec.category === 'Egress Capacity' ? '🚪 Egress Expansion' :
                       rec.category === 'Corridor Optimization' ? '🧹 Obstacle Clearance' :
                       rec.category === 'Aisle Clearance' ? '📐 Aisle Setback' :
                       rec.category === 'Emergency Egress' ? '🚨 Emergency Portal' :
                       rec.category === 'Door Operations' ? '🚪 Door Controls' :
                       '⚡ Flow Optimization'}
                    </span>
                  </div>
                  <p className="rec-text">{rec.action}</p>

                  {/* Interactive Layout Change Pill */}
                  {rec.layoutChange && (
                    <div
                      onClick={() => applyRecommendationLayoutChange(rec.layoutChange)}
                      style={{
                        marginTop: 10,
                        padding: '9px 12px',
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Click to automatically apply this layout change into the editor"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sparkles size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                          Proposed Change: {rec.layoutChange.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#38bdf8', fontWeight: 700, fontSize: '0.78rem' }}>
                        <span>Put in Layout Editor</span>
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Rationale */}
                <div className="rec-section rationale-box">
                  <span className="rec-section-label">WHY THIS HELPS (ZERO STRUCTURAL DEMOLITION)</span>
                  <p className="rec-text">{rec.rationale}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety & Certification Legal Disclaimer */}
      <div className="prototype-disclaimer-banner">
        <ShieldAlert size={20} className="disclaimer-icon text-amber" />
        <div className="disclaimer-text">
          <strong>Non-Structural Operational Guidance:</strong> All suggestions are restricted to physical door state control (open/close) and temporary mobile barrier placement. No wall alterations or permanent structural changes are permitted.
        </div>
      </div>
    </div>
  );
}
