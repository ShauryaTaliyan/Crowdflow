import React from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import StatCard from './Common/StatCard';
import MiniChart from './Common/MiniChart';
import { 
  Users, 
  DoorOpen, 
  Clock, 
  Gauge, 
  AlertTriangle, 
  AlertOctagon, 
  Activity, 
  Download, 
  ShieldCheck,
  Info,
  X,
  HelpCircle,
  TrendingUp,
  BarChart2,
  CheckCircle2
} from 'lucide-react';
import { useState } from 'react';
import { HEATMAP_ROWS, HEATMAP_COLS } from '../engine/simulation';

export default function AnalyticsView() {
  const {
    metrics,
    simSettings,
    simEngine,
    venue,
    addNotification,
    setActiveTab,
  } = useCrowdFlow();

  // Modal state for detailed graph / congestion breakdown explainer: 'density' | 'egress' | 'congestion' | null
  const [activeExplainer, setActiveExplainer] = useState(null);

  const history = metrics.timeSeriesHistory || [];

  // Calculate real-time Level of Service (LOS) venue spatial breakdown
  const losBreakdown = (() => {
    if (!simEngine?.densityGrid) {
      return { free: 100, moderate: 0, high: 0, critical: 0 };
    }

    let free = 0;
    let moderate = 0;
    let high = 0;
    let critical = 0;
    const total = HEATMAP_ROWS * HEATMAP_COLS;

    for (let r = 0; r < HEATMAP_ROWS; r++) {
      for (let c = 0; c < HEATMAP_COLS; c++) {
        const d = simEngine.densityGrid[r][c];
        if (d < 1.5) free++;
        else if (d < 3.0) moderate++;
        else if (d < 4.5) high++;
        else critical++;
      }
    }

    return {
      free: Math.round((free / total) * 100),
      moderate: Math.round((moderate / total) * 100),
      high: Math.round((high / total) * 100),
      critical: Math.round((critical / total) * 100),
    };
  })();

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Plain-English Overall Venue Safety & Flow Score (0-100)
  const venueScoreData = (() => {
    let score = 100;
    const peakM2 = (metrics.peakDensity || 0) * 0.64;
    const hotspots = metrics.activeHotspotsCount || 0;
    const unreachable = metrics.unreachableCount || 0;

    score -= hotspots * 15;
    score -= unreachable * 25;
    if (peakM2 > 4.5) {
      score -= 22;
    } else if (peakM2 > 3.0) {
      score -= 10;
    }

    score = Math.max(10, Math.min(100, Math.round(score)));

    let grade = 'A';
    let status = 'Optimal & Safe Flow';
    let color = '#10b981';
    let bg = 'rgba(16, 185, 129, 0.08)';
    let border = 'rgba(16, 185, 129, 0.3)';
    let summaryText = `Visitors are moving smoothly through the venue with no significant bottlenecks. Corridors are clear and exits are operating safely.`;

    if (score < 60) {
      grade = 'D';
      status = 'Severe Congestion & Bottlenecks';
      color = '#ef4444';
      bg = 'rgba(239, 68, 68, 0.08)';
      border = 'rgba(239, 68, 68, 0.3)';
      summaryText = `Warning: ${hotspots} active bottleneck choke points and dense crowds detected. Movement near exits is significantly restricted. Operational changes are recommended.`;
    } else if (score < 75) {
      grade = 'C';
      status = 'Moderate Congestion Detected';
      color = '#f59e0b';
      bg = 'rgba(245, 158, 11, 0.08)';
      border = 'rgba(245, 158, 11, 0.3)';
      summaryText = `Caution: Corridors are experiencing moderate crowd buildup. Movement is flowing, but localized slowdowns are beginning to form near aisles.`;
    } else if (score < 90) {
      grade = 'B';
      status = 'Good Flow with Minor Slowdowns';
      color = '#0284c7';
      bg = 'rgba(2, 132, 199, 0.08)';
      border = 'rgba(2, 132, 199, 0.3)';
      summaryText = `Overall venue flow is healthy and orderly. Minor pedestrian deceleration during peak influx, but exits are reachable without queuing.`;
    }

    return { score, grade, status, color, bg, border, summaryText };
  })();

  // Plain-English walking comfort description
  const peakM2 = (metrics.peakDensity || 0) * 0.64;
  const walkingExperience = 
    peakM2 < 1.5 ? { label: 'Unimpeded Free Walking', desc: 'No slowdowns; full natural walking pace', badgeBg: 'rgba(16, 185, 129, 0.15)', badgeColor: '#34d399' } :
    peakM2 < 3.0 ? { label: 'Comfortable Group Flow', desc: 'Normal walking pace with minor steering', badgeBg: 'rgba(245, 158, 11, 0.15)', badgeColor: '#fbbf24' } :
    peakM2 < 4.5 ? { label: 'Crowded Shuffle', desc: 'Pace restricted; following person ahead', badgeBg: 'rgba(249, 115, 22, 0.15)', badgeColor: '#fb923c' } :
                   { label: 'Stop-and-Go Queue', desc: 'High compression risk near choke points', badgeBg: 'rgba(239, 68, 68, 0.15)', badgeColor: '#f87171' };

  // CSV Export for records
  const exportCSV = () => {
    if (history.length === 0) {
      addNotification('No simulation data recorded yet to export.', 'warning');
      return;
    }

    const headers = ['Sim_Time_Sec', 'Active_Pedestrians', 'Exited_Total', 'Throughput_Per_Min', 'Avg_Density', 'Peak_Density', 'Bottlenecks_Count', 'Unreachable_Count'];
    const rows = history.map(h => [
      h.time,
      h.active,
      h.exitedTotal,
      h.throughput,
      h.avgDensity,
      h.peakDensity,
      h.hotspotsCount,
      h.unreachable,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crowdflow_timeseries_${venue.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification('Exported simulation timeseries to CSV.', 'success');
  };

  return (
    <div className="cf-analytics-page">
      {/* Top Header */}
      <div className="analytics-header">
        <div>
          <h2 className="page-title">Venue Crowd Analytics</h2>
          <p className="page-subtitle">
            Plain-English performance metrics, safety scoring, and crowd movement history for {venue.name}.
          </p>
        </div>

        <button className="btn-secondary" onClick={exportCSV} title="Download time-series data as CSV">
          <Download size={16} />
          <span>Export Data (CSV)</span>
        </button>
      </div>

      {/* 1. Executive Summary & Plain-English Safety Health Card */}
      <div style={{
        background: venueScoreData.bg,
        border: `1.5px solid ${venueScoreData.border}`,
        borderRadius: 10,
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Score Circle Badge */}
            <div style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              border: `3px solid ${venueScoreData.color}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: venueScoreData.color, lineHeight: 1 }}>
                {venueScoreData.score}
              </span>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' }}>/ 100</span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  background: venueScoreData.color,
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 4,
                  letterSpacing: '0.04em'
                }}>
                  GRADE {venueScoreData.grade}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                  {venueScoreData.status}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {venueScoreData.summaryText}
              </p>
            </div>
          </div>

          {/* Dedicated Fixed-Height Action Slot to completely eliminate page jumping/jittering */}
          <div style={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0
          }}>
            {metrics.activeHotspotsCount > 0 ? (
              <button
                className="btn-primary"
                onClick={() => setActiveTab('recommendations')}
                style={{
                  background: '#d97706',
                  border: 'none',
                  padding: '9px 18px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
                  cursor: 'pointer'
                }}
              >
                <AlertTriangle size={15} />
                <span>Fix {metrics.activeHotspotsCount} Bottleneck{metrics.activeHotspotsCount > 1 ? 's' : ''} in Recommendations →</span>
              </button>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#34d399'
              }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>All Corridors Clear (0 Bottlenecks)</span>
              </div>
            )}
          </div>
        </div>

        {/* Plain-English 3 Key Takeaways */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          paddingTop: 14,
          borderTop: '1px solid var(--border-subtle)'
        }}>
          {/* Takeaway 1: Walking Experience */}
          <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-card)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              🚶 Visitor Walking Experience
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                background: walkingExperience.badgeBg,
                color: walkingExperience.badgeColor,
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4
              }}>
                {walkingExperience.label}
              </span>
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)' }}>
              {walkingExperience.desc}
            </div>
          </div>

          {/* Takeaway 2: Exit Efficiency */}
          <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-card)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              🚪 Exit & Door Flow
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                background: metrics.throughputRate > 35 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                color: metrics.throughputRate > 35 ? '#34d399' : '#cbd5e1',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4
              }}>
                {metrics.throughputRate > 35 ? 'Optimal High Outflow' : 'Steady Outflow'}
              </span>
              <strong style={{ fontSize: '0.82rem', color: '#ffffff' }}>{metrics.throughputRate} p/min</strong>
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)' }}>
              {metrics.totalExited} people safely evacuated so far
            </div>
          </div>

          {/* Takeaway 3: Choke Point Status */}
          <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-card)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
              🛡️ Corridor Choke Points
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                background: metrics.activeHotspotsCount === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: metrics.activeHotspotsCount === 0 ? '#34d399' : '#f87171',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4
              }}>
                {metrics.activeHotspotsCount === 0 ? '0 Choke Points (Clear)' : `${metrics.activeHotspotsCount} Bottleneck Choke(s)`}
              </span>
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)' }}>
              {metrics.unreachableCount === 0 ? 'All emergency exit routes unobstructed' : `${metrics.unreachableCount} people blocked by obstacles`}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Metric Cards Summary */}
      <div className="kpi-grid">
        <StatCard
          label="People Inside"
          value={metrics.activePedestrians}
          unit="people"
          subLabel={`Currently inside venue (Target: ${simSettings.targetCrowdSize})`}
          icon={Users}
          variant="info"
        />

        <StatCard
          label="Total Safe Exits"
          value={metrics.totalExited}
          unit="people"
          subLabel="Safely reached building exits"
          icon={DoorOpen}
          variant="success"
        />

        <StatCard
          label="Average Trip Time"
          value={metrics.avgJourneyTime > 0 ? `${metrics.avgJourneyTime}` : '--'}
          unit="sec"
          subLabel={metrics.avgJourneyTime > 0 && metrics.avgJourneyTime <= 25 ? 'Fast transit to doors (<25s)' : 'Average time to reach nearest exit'}
          icon={Clock}
          variant="default"
        />

        <StatCard
          label="Exit Flow Rate"
          value={metrics.throughputRate}
          unit="people/min"
          subLabel={metrics.throughputRate > 40 ? 'High egress capacity' : 'Exits completed per minute'}
          icon={Gauge}
          variant={metrics.throughputRate > 40 ? 'success' : 'default'}
        />

        <StatCard
          label="Peak Crowd Density"
          value={metrics.peakDensity > 0 ? `${(metrics.peakDensity * 0.64).toFixed(1)}` : '0.0'}
          unit="people/m²"
          subLabel={
            (metrics.peakDensity * 0.64) < 2.0
              ? 'Comfortable personal space'
              : (metrics.peakDensity * 0.64) < 3.5
              ? 'Moderate crowd density'
              : 'Dense crowd — slow movement'
          }
          icon={AlertTriangle}
          variant={(metrics.peakDensity * 0.64) >= 3.5 ? 'alert' : 'default'}
        />

        <StatCard
          label="Bottleneck Choke Points"
          value={metrics.activeHotspotsCount}
          unit="spots"
          subLabel={metrics.activeHotspotsCount === 0 ? 'All corridors clear & flowing' : `${metrics.activeHotspotsCount} bottlenecks found`}
          icon={AlertOctagon}
          variant={metrics.activeHotspotsCount > 0 ? 'alert' : 'success'}
        />

        <StatCard
          label="Blocked Pathways"
          value={metrics.unreachableCount}
          unit="people"
          subLabel={metrics.unreachableCount === 0 ? 'All emergency paths accessible' : 'Visitors trapped by obstacles'}
          icon={ShieldCheck}
          variant={metrics.unreachableCount > 0 ? 'alert' : 'success'}
        />

        <StatCard
          label="Monitoring Timer"
          value={formatTime(metrics.elapsedTime)}
          unit=""
          subLabel={`${history.length} time data points`}
          icon={Activity}
          variant="default"
        />
      </div>

      {/* 3. Main Charts Grid (Clickable for Deep Dive Explainer) */}
      <div className="analytics-charts-grid">
        {/* Chart 1: Crowd Density over Time */}
        <div 
          className="dashboard-card"
          onClick={() => setActiveExplainer('density')}
          style={{
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
          title="Click to view detailed explanation and pointers for this graph"
        >
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>1. Crowd Density Progression</span>
              </h3>
              <p className="card-sub">Average venue density (blue) vs highest congestion peak (amber)</p>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#eff6ff',
              color: '#1d4ed8',
              padding: '3px 9px',
              borderRadius: 9999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: '1px solid #bfdbfe'
            }}>
              <Info size={12} /> Click to Inspect & Explain
            </span>
          </div>
          <div className="card-body">
            <MiniChart
              data={history}
              xKey="time"
              yKey="avgDensity"
              secondaryKey="peakDensity"
              color="#1a73e8"
              secondaryColor="#f59e0b"
              height={220}
              yLabel="Avg Density"
              emptyText="Start simulation to record density progression"
            />
          </div>
          <div className="chart-legend-strip">
            <div className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: '#1a73e8' }} />
              <span>Average Floor Density</span>
            </div>
            <div className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: '#f59e0b' }} />
              <span>Peak Hotspot Density</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Cumulative Exited & Throughput Rate */}
        <div 
          className="dashboard-card"
          onClick={() => setActiveExplainer('egress')}
          style={{
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
          title="Click to view detailed explanation and pointers for this graph"
        >
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>2. Egress Flow & Total Exits</span>
              </h3>
              <p className="card-sub">Flow rate per minute (green) vs cumulative safe exits (blue)</p>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              background: '#ecfdf5',
              color: '#047857',
              padding: '3px 9px',
              borderRadius: 9999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: '1px solid #a7f3d0'
            }}>
              <Info size={12} /> Click to Inspect & Explain
            </span>
          </div>
          <div className="card-body">
            <MiniChart
              data={history}
              xKey="time"
              yKey="throughput"
              secondaryKey="exitedTotal"
              color="#10b981"
              secondaryColor="#1a73e8"
              height={220}
              yLabel="Flow Rate"
              emptyText="Start simulation to record throughput curves"
            />
          </div>
          <div className="chart-legend-strip">
            <div className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: '#10b981' }} />
              <span>Flow Rate (people/min)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: '#1a73e8' }} />
              <span>Total People Safely Exited</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Spatial Congestion Distribution Breakdown (Clickable) */}
      <div 
        className="dashboard-card spatial-breakdown-card"
        onClick={() => setActiveExplainer('congestion')}
        style={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
        title="Click to view detailed pointers and explanation of Floor Area Congestion Breakdown"
      >
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 className="card-title">3. Floor Area Congestion Breakdown</h3>
            <p className="card-sub">Real-time percentage of floor space by walking condition</p>
          </div>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            background: '#fffbeb',
            color: '#b45309',
            padding: '3px 9px',
            borderRadius: 9999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            border: '1px solid #fde68a'
          }}>
            <Info size={12} /> Click to Inspect & Explain
          </span>
        </div>

        <div className="card-body">
          <div className="progress-stacked-bar">
            <div
              className="progress-segment seg-green"
              style={{ width: `${losBreakdown.free}%` }}
              title={`Free Walking: ${losBreakdown.free}%`}
            />
            <div
              className="progress-segment seg-yellow"
              style={{ width: `${losBreakdown.moderate}%` }}
              title={`Comfortable Crowd: ${losBreakdown.moderate}%`}
            />
            <div
              className="progress-segment seg-orange"
              style={{ width: `${losBreakdown.high}%` }}
              title={`Busy / Slow Pace: ${losBreakdown.high}%`}
            />
            <div
              className="progress-segment seg-red"
              style={{ width: `${losBreakdown.critical}%` }}
              title={`Bottleneck Choke: ${losBreakdown.critical}%`}
            />
          </div>

          <div className="los-grid">
            <div className="los-item" style={{ borderTop: '3px solid #16a34a' }}>
              <div className="los-badge bg-green">🟢 Level A/B (Free Walk)</div>
              <div className="los-pct">{losBreakdown.free}%</div>
              <div className="los-sub">&lt; 1.5 people/m² &bull; Unimpeded walking speed. Zero physical contact.</div>
            </div>

            <div className="los-item" style={{ borderTop: '3px solid #eab308' }}>
              <div className="los-badge bg-yellow">🟡 Level C (Comfortable Crowd)</div>
              <div className="los-pct">{losBreakdown.moderate}%</div>
              <div className="los-sub">1.5 &ndash; 3.0 people/m² &bull; Normal walking pace; minor steering around others.</div>
            </div>

            <div className="los-item" style={{ borderTop: '3px solid #ea580c' }}>
              <div className="los-badge bg-orange">🟠 Level D (Busy / Slow Shuffle)</div>
              <div className="los-pct">{losBreakdown.high}%</div>
              <div className="los-sub">3.0 &ndash; 4.5 people/m² &bull; Restricted pace; following person ahead; queues starting.</div>
            </div>

            <div className="los-item" style={{ borderTop: '3px solid #dc2626' }}>
              <div className="los-badge bg-red">🔴 Level E/F (Bottleneck Choke)</div>
              <div className="los-pct">{losBreakdown.critical}%</div>
              <div className="los-sub">&ge; 4.5 people/m² &bull; Severe stop-and-go squeezing near narrow doors or obstacles.</div>
            </div>
          </div>
        </div>
      </div>

      {/* --- DETAILED GRAPH & CONGESTION EXPLAINER MODAL --- */}
      {activeExplainer && (
        <div className="cf-modal-overlay" onClick={() => setActiveExplainer(null)}>
          <div 
            className="cf-modal-content" 
            style={{ maxWidth: 640, maxHeight: '88vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {activeExplainer === 'density' && <TrendingUp size={22} color="#1a73e8" />}
                {activeExplainer === 'egress' && <DoorOpen size={22} color="#10b981" />}
                {activeExplainer === 'congestion' && <BarChart2 size={22} color="#f59e0b" />}
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    {activeExplainer === 'density' && 'Crowd Density Progression — Guide & Pointers'}
                    {activeExplainer === 'egress' && 'Egress Flow & Total Exits — Guide & Pointers'}
                    {activeExplainer === 'congestion' && 'Floor Congestion Breakdown — Guide & Pointers'}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Plain-English breakdown and operational action steps for venue safety
                  </span>
                </div>
              </div>
              <button className="btn-close" onClick={() => setActiveExplainer(null)} title="Close Guide">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content: Density Graph */}
            {activeExplainer === 'density' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.55 }}>
                {/* Live Graph Display Inside Guide Modal */}
                <div style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: '#ffffff' }}>Live Density Progression Graph</strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>Average floor density vs highest congestion peak over time</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, background: 'rgba(56, 189, 248, 0.12)', padding: '3px 8px', borderRadius: 4 }}>
                      {history.length} Data Points Recorded
                    </span>
                  </div>
                  <MiniChart
                    data={history}
                    xKey="time"
                    yKey="avgDensity"
                    secondaryKey="peakDensity"
                    color="#38bdf8"
                    secondaryColor="#f59e0b"
                    height={190}
                    yLabel="Avg Density"
                    emptyText="Start simulation to record density progression"
                  />
                  <div className="chart-legend-strip" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="legend-item">
                      <span className="legend-color-dot" style={{ backgroundColor: '#38bdf8' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Average Floor Density (p/m²)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color-dot" style={{ backgroundColor: '#f59e0b' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Peak Hotspot Density (p/m²)</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(2, 132, 199, 0.3)', borderRadius: 8, padding: '12px 16px' }}>
                  <strong style={{ color: '#38bdf8', display: 'block', marginBottom: 4 }}>📌 What This Graph Measures</strong>
                  <span style={{ color: 'var(--text-main)' }}>
                    Tracks the physical closeness of visitors over time. It compares the general roominess across the whole venue against the single most packed bottleneck spot.
                  </span>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🧭 How to Read the Lines
                  </h4>
                  <ul style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <li>
                      <strong style={{ color: '#38bdf8' }}>🔵 Blue Line (Average Floor Density):</strong> Shows average people per square meter. If this line stays low (&lt;1.5), the building as a whole is spacious and has plenty of room.
                    </li>
                    <li>
                      <strong style={{ color: '#f59e0b' }}>🟠 Amber Line (Peak Hotspot Density):</strong> Shows the most congested single spot or doorway. Even if the blue line is low, a spike here warns that a dangerous cluster is forming at one specific gate or corridor.
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
                    🎯 Standard Safety Thresholds
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 12px', borderRadius: 6 }}>
                      <strong style={{ color: '#34d399', display: 'block', fontSize: '0.8rem' }}>🟢 Below 2.0 p/m²</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Safe & Open: Visitors maintain personal space with natural walking pace.</span>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '10px 12px', borderRadius: 6 }}>
                      <strong style={{ color: '#fbbf24', display: 'block', fontSize: '0.8rem' }}>🟡 2.0 to 3.5 p/m²</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Moderate Crowd: Walking pace slows; visitors steer around groups.</span>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 12px', borderRadius: 6 }}>
                      <strong style={{ color: '#f87171', display: 'block', fontSize: '0.8rem' }}>🔴 Above 3.5 p/m²</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>High Congestion: Slow shuffle, queues forming; potential crowd crush risk.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                    💡 Action Steps to Take
                  </h4>
                  <ul style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-muted)' }}>
                    <li>If <strong>amber spikes while blue stays flat</strong>: The bottleneck is localized. Widen that doorway or remove decorative obstacles near the choke point in the layout editor.</li>
                    <li>If <strong>both lines climb continuously</strong>: Influx exceeds building capacity. Pause entry ticketing or open auxiliary emergency exits.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Modal Content: Egress Flow */}
            {activeExplainer === 'egress' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.55 }}>
                {/* Live Graph Display Inside Guide Modal */}
                <div style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: '#ffffff' }}>Live Egress Flow & Evacuation Graph</strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>Flow rate per minute vs total evacuated visitors</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', padding: '3px 8px', borderRadius: 4 }}>
                      {metrics.totalExited} People Evacuated
                    </span>
                  </div>
                  <MiniChart
                    data={history}
                    xKey="time"
                    yKey="throughput"
                    secondaryKey="exitedTotal"
                    color="#10b981"
                    secondaryColor="#38bdf8"
                    height={190}
                    yLabel="Flow Rate"
                    emptyText="Start simulation to record throughput curves"
                  />
                  <div className="chart-legend-strip" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="legend-item">
                      <span className="legend-color-dot" style={{ backgroundColor: '#10b981' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Flow Rate (people/min)</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color-dot" style={{ backgroundColor: '#38bdf8' }} />
                      <span style={{ color: 'var(--text-muted)' }}>Total Safe Exits (people)</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 8, padding: '12px 16px' }}>
                  <strong style={{ color: '#34d399', display: 'block', marginBottom: 4 }}>📌 What This Graph Measures</strong>
                  <span style={{ color: 'var(--text-main)' }}>
                    Tracks evacuation efficiency — displaying how quickly people leave per minute alongside the cumulative total of safely evacuated visitors.
                  </span>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
                    🧭 How to Read the Lines
                  </h4>
                  <ul style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <li>
                      <strong style={{ color: '#10b981' }}>🟢 Green Line (Flow Rate — people/min):</strong> How many visitors escape per minute. A high, steady green line means exit doors are clear and operating without human queuing.
                    </li>
                    <li>
                      <strong style={{ color: '#38bdf8' }}>🔵 Blue Line (Total Safe Exits):</strong> The cumulative running count of people who successfully walked outside. Rises sharply and flattens once the venue is fully cleared.
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
                    🎯 Key Benchmarks
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 12px', borderRadius: 6 }}>
                      <strong style={{ color: '#34d399', display: 'block', fontSize: '0.8rem' }}>⚡ Target &gt; 40 people/min</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Excellent high-speed egress; doors are sufficiently wide.</span>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 12px', borderRadius: 6 }}>
                      <strong style={{ color: '#f87171', display: 'block', fontSize: '0.8rem' }}>⚠️ Flow Drops Below 15 p/min</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>People are trapped or stuck behind a barrier upstream before reaching exits.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                    💡 Action Steps to Take
                  </h4>
                  <ul style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-muted)' }}>
                    <li>Ensure every exit door is at least <strong>60 to 80 pixels wide</strong> in the layout editor so multiple people can pass through side-by-side.</li>
                    <li>Verify that exit corridors are straight and unobstructed without sharp right-angle turns.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Modal Content: Floor Congestion Breakdown */}
            {activeExplainer === 'congestion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.55 }}>
                {/* Live Distribution Bar & Metrics Inside Guide Modal */}
                <div style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: '#ffffff' }}>Live Floor Congestion Distribution (LOS)</strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>Real-time percentage breakdown across {venue.name}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#fb923c', fontWeight: 700, background: 'rgba(249, 115, 22, 0.12)', padding: '3px 8px', borderRadius: 4 }}>
                      Spatial Level of Service
                    </span>
                  </div>
                  <div className="progress-stacked-bar" style={{ height: 20, borderRadius: 6, marginBottom: 10 }}>
                    <div className="progress-segment seg-green" style={{ width: `${losBreakdown.free}%` }} />
                    <div className="progress-segment seg-yellow" style={{ width: `${losBreakdown.moderate}%` }} />
                    <div className="progress-segment seg-orange" style={{ width: `${losBreakdown.high}%` }} />
                    <div className="progress-segment seg-red" style={{ width: `${losBreakdown.critical}%` }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px 4px', borderRadius: 4, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 700 }}>Level A/B</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>{losBreakdown.free}%</div>
                    </div>
                    <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '8px 4px', borderRadius: 4, border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#facc15', fontWeight: 700 }}>Level C</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#eab308' }}>{losBreakdown.moderate}%</div>
                    </div>
                    <div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: '8px 4px', borderRadius: 4, border: '1px solid rgba(249, 115, 22, 0.25)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#fb923c', fontWeight: 700 }}>Level D</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f97316' }}>{losBreakdown.high}%</div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px 4px', borderRadius: 4, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                      <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 700 }}>Level E/F</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444' }}>{losBreakdown.critical}%</div>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: '12px 16px' }}>
                  <strong style={{ color: '#fbbf24', display: 'block', marginBottom: 4 }}>📌 What This Breakdown Measures</strong>
                  <span style={{ color: 'var(--text-main)' }}>
                    Classifies the whole floor area into 4 international comfort standards (Fruin Level of Service) to evaluate walking comfort and crowd safety.
                  </span>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
                    🧭 Understanding the 4 Levels
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ borderLeft: '4px solid #10b981', paddingLeft: 12, background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                      <strong style={{ color: '#34d399' }}>🟢 Level A/B — Free Walk (&lt; 1.5 p/m²):</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Complete freedom of movement. Full natural walking speed with zero physical contact. Should represent &gt;70% of the building.
                      </p>
                    </div>

                    <div style={{ borderLeft: '4px solid #eab308', paddingLeft: 12, background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                      <strong style={{ color: '#facc15' }}>🟡 Level C — Comfortable Crowd (1.5 – 3.0 p/m²):</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Bustling crowd flow. Normal walking pace, but people must steer slightly around others. Standard for busy expo aisles.
                      </p>
                    </div>

                    <div style={{ borderLeft: '4px solid #f97316', paddingLeft: 12, background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                      <strong style={{ color: '#fb923c' }}>🟠 Level D — Busy / Slow Shuffle (3.0 – 4.5 p/m²):</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Walking freedom is restricted. Visitors cannot overtake and must follow the person ahead. Queues begin forming.
                      </p>
                    </div>

                    <div style={{ borderLeft: '4px solid #ef4444', paddingLeft: 12, background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                      <strong style={{ color: '#f87171' }}>🔴 Level E/F — Bottleneck Choke (&ge; 4.5 p/m²):</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Severe stop-and-go squeezing near narrow doors or corners. Physical contact unavoidable. <strong>Must stay under 5% of floor area!</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                    💡 Safety Target & Recommendations
                  </h4>
                  <ul style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-muted)' }}>
                    <li><strong>Target Goal:</strong> Green + Yellow should always total <strong>85% or more</strong> of your entire venue floor.</li>
                    <li>If <strong>Red exceeds 5%</strong>: Check the Recommendations tab to open doors or remove choke-point barriers immediately.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, paddingTop: 12, borderTop: '1px solid var(--border-card)' }}>
              <button 
                className="btn-primary-glow" 
                onClick={() => setActiveExplainer(null)}
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                Got It, Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
