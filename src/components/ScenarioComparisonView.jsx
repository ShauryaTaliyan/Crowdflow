import React from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import { 
  GitCompare, 
  Bookmark, 
  RotateCcw, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Clock, 
  Gauge, 
  Users, 
  ArrowRight,
  Info
} from 'lucide-react';

export default function ScenarioComparisonView() {
  const {
    venue,
    simSettings,
    metrics,
    baselineScenario,
    saveBaselineScenario,
    clearBaselineScenario,
    setActiveTab,
  } = useCrowdFlow();

  const currentScenario = {
    venueName: venue.name,
    venue: venue,
    settings: simSettings,
    metrics: metrics,
  };

  const hasSimulatedCurrent = metrics.elapsedTime > 5 || metrics.totalExited > 0;
  const hasBaseline = Boolean(baselineScenario);

  // Helper for delta calculation
  const calcDelta = (currentVal, baselineVal, lowerIsBetter = false) => {
    if (!hasBaseline || baselineVal === 0 || baselineVal === undefined) {
      return { diff: 0, pct: 0, improved: null };
    }
    const diff = Math.round((currentVal - baselineVal) * 10) / 10;
    const pct = Math.round(((currentVal - baselineVal) / baselineVal) * 100);
    const improved = lowerIsBetter ? diff < 0 : diff > 0;
    return { diff, pct, improved };
  };

  const journeyDelta = calcDelta(
    metrics.avgJourneyTime,
    baselineScenario?.metrics?.avgJourneyTime || 0,
    true
  );

  const throughputDelta = calcDelta(
    metrics.throughputRate,
    baselineScenario?.metrics?.throughputRate || 0,
    false
  );

  const peakDensityDelta = calcDelta(
    metrics.peakDensity,
    baselineScenario?.metrics?.peakDensity || 0,
    true
  );

  const hotspotsDelta = calcDelta(
    metrics.activeHotspotsCount,
    baselineScenario?.metrics?.activeHotspotsCount || 0,
    true
  );

  const unreachableDelta = calcDelta(
    metrics.unreachableCount,
    baselineScenario?.metrics?.unreachableCount || 0,
    true
  );

  return (
    <div className="cf-comparison-page">
      {/* Top Banner & Snapshot Action */}
      <div className="comparison-hero">
        <div className="hero-text">
          <div className="hero-badge">
            <GitCompare size={14} />
            <span>Layout Comparison</span>
          </div>
          <h2 className="hero-title">Compare Two Layouts</h2>
          <p className="hero-subtitle">
            Save a baseline scenario, tweak your doors or walkways, and see side-by-side if crowd flow actually improved.
          </p>
        </div>

        <div className="hero-actions">
          <button className="btn-primary-glow" onClick={saveBaselineScenario}>
            <Bookmark size={16} />
            <span>{hasBaseline ? 'Update Baseline' : 'Save Current as Baseline'}</span>
          </button>
          {hasBaseline && (
            <button className="btn-secondary" onClick={clearBaselineScenario}>
              <span>Clear Baseline</span>
            </button>
          )}
        </div>
      </div>

      {/* Snapshot Information Banner */}
      {!hasBaseline ? (
        <div className="comparison-callout">
          <Info size={20} className="text-blue" />
          <div className="callout-body">
            <strong>How to compare layouts:</strong>
            <p>
              1. Run the simulation on your initial layout for a few seconds, then click <strong>"Save Current as Baseline"</strong>.
              <br />
              2. Go to <strong>Layout Editor</strong>, widen a corridor or open an extra door, then run the simulation again.
              <br />
              3. Come back here to see if the new layout lowered congestion and helped people exit faster.
            </p>
          </div>
        </div>
      ) : (
        <div className="comparison-meta-strip">
          <div className="meta-card">
            <span className="meta-tag">Baseline</span>
            <h4 className="meta-name">{baselineScenario.venueName}</h4>
            <span className="meta-date">Saved at {new Date(baselineScenario.savedAt).toLocaleTimeString()}</span>
          </div>
          <div className="vs-badge">VS</div>
          <div className="meta-card active-border">
            <span className="meta-tag">Current Layout</span>
            <h4 className="meta-name">{venue.name}</h4>
            <span className="meta-date">
              {hasSimulatedCurrent ? `Simulated (${metrics.elapsedTime}s elapsed)` : 'Ready to simulate'}
            </span>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Table */}
      {/* Side-by-Side Comparison Table */}
      <div className="dashboard-card comparison-table-card">
        <div className="card-header">
          <h3 className="card-title">Side-by-Side Comparison</h3>
          <span className="table-status-hint">
            {hasBaseline ? 'Direct numbers comparing baseline vs. current design' : 'Save a baseline first to compare'}
          </span>
        </div>

        <div className="card-body p-0">
          <table className="cf-table">
            <colgroup>
              <col style={{ width: '27%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Baseline</th>
                <th>Current Layout</th>
                <th>Difference (Δ)</th>
                <th>Change</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Average Trip Time */}
              <tr>
                <td>
                  <strong>Average Trip Time</strong>
                  <div className="cell-sub">Average time for a person to reach an exit</div>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline ? `${baselineScenario.metrics.avgJourneyTime || '--'} s` : 'N/A'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasSimulatedCurrent && metrics.avgJourneyTime > 0 ? `${metrics.avgJourneyTime} s` : '--'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline && hasSimulatedCurrent ? (
                      <span className={journeyDelta.diff < 0 ? 'text-green' : journeyDelta.diff > 0 ? 'text-red' : ''}>
                        {journeyDelta.diff > 0 ? `+${journeyDelta.diff}` : journeyDelta.diff} s
                      </span>
                    ) : '--'}
                  </span>
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent && journeyDelta.pct !== 0 ? (
                    <span className={`delta-badge ${journeyDelta.improved ? 'badge-good' : 'badge-bad'}`}>
                      {journeyDelta.pct > 0 ? `+${journeyDelta.pct}%` : `${journeyDelta.pct}%`}
                    </span>
                  ) : <span className="cf-val-slot">--</span>}
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent ? (
                    journeyDelta.improved ? (
                      <span className="eval-tag good">Faster Exit</span>
                    ) : journeyDelta.diff > 0 ? (
                      <span className="eval-tag bad">Slower Exit</span>
                    ) : (
                      <span className="eval-tag neutral">About Same</span>
                    )
                  ) : <span className="cf-val-slot">--</span>}
                </td>
              </tr>

              {/* Row 2: Throughput Rate */}
              <tr>
                <td>
                  <strong>Throughput Rate</strong>
                  <div className="cell-sub">People safely exiting per minute</div>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline ? `${baselineScenario.metrics.throughputRate} p/min` : 'N/A'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasSimulatedCurrent ? `${metrics.throughputRate} p/min` : '--'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline && hasSimulatedCurrent ? (
                      <span className={throughputDelta.diff > 0 ? 'text-green' : throughputDelta.diff < 0 ? 'text-red' : ''}>
                        {throughputDelta.diff > 0 ? `+${throughputDelta.diff}` : throughputDelta.diff}
                      </span>
                    ) : '--'}
                  </span>
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent && throughputDelta.pct !== 0 ? (
                    <span className={`delta-badge ${throughputDelta.improved ? 'badge-good' : 'badge-bad'}`}>
                      {throughputDelta.pct > 0 ? `+${throughputDelta.pct}%` : `${throughputDelta.pct}%`}
                    </span>
                  ) : <span className="cf-val-slot">--</span>}
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent ? (
                    throughputDelta.improved ? (
                      <span className="eval-tag good">Higher Flow</span>
                    ) : throughputDelta.diff < 0 ? (
                      <span className="eval-tag bad">Lower Flow</span>
                    ) : (
                      <span className="eval-tag neutral">About Same</span>
                    )
                  ) : <span className="cf-val-slot">--</span>}
                </td>
              </tr>

              {/* Row 3: Peak Observed Density */}
              <tr>
                <td>
                  <strong>Peak Density</strong>
                  <div className="cell-sub">Highest crowd concentration in a single area</div>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline ? `${baselineScenario.metrics.peakDensity} p/cell` : 'N/A'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasSimulatedCurrent ? `${metrics.peakDensity} p/cell` : '--'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline && hasSimulatedCurrent ? (
                      <span className={peakDensityDelta.diff < 0 ? 'text-green' : peakDensityDelta.diff > 0 ? 'text-red' : ''}>
                        {peakDensityDelta.diff > 0 ? `+${peakDensityDelta.diff}` : peakDensityDelta.diff}
                      </span>
                    ) : '--'}
                  </span>
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent && peakDensityDelta.pct !== 0 ? (
                    <span className={`delta-badge ${peakDensityDelta.improved ? 'badge-good' : 'badge-bad'}`}>
                      {peakDensityDelta.pct > 0 ? `+${peakDensityDelta.pct}%` : `${peakDensityDelta.pct}%`}
                    </span>
                  ) : <span className="cf-val-slot">--</span>}
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent ? (
                    peakDensityDelta.improved ? (
                      <span className="eval-tag good">Less Crowded</span>
                    ) : peakDensityDelta.diff > 0 ? (
                      <span className="eval-tag bad">More Crowded</span>
                    ) : (
                      <span className="eval-tag neutral">About Same</span>
                    )
                  ) : <span className="cf-val-slot">--</span>}
                </td>
              </tr>

              {/* Row 4: Bottleneck Choke Points */}
              <tr>
                <td>
                  <strong>Choke Points</strong>
                  <div className="cell-sub">Corridor locations where people get stuck</div>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline ? `${baselineScenario.metrics.activeHotspotsCount} spots` : 'N/A'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasSimulatedCurrent ? `${metrics.activeHotspotsCount} spots` : '--'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline && hasSimulatedCurrent ? (
                      <span className={hotspotsDelta.diff < 0 ? 'text-green' : hotspotsDelta.diff > 0 ? 'text-red' : ''}>
                        {hotspotsDelta.diff > 0 ? `+${hotspotsDelta.diff}` : hotspotsDelta.diff}
                      </span>
                    ) : '--'}
                  </span>
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent ? (
                    <span className={`delta-badge ${hotspotsDelta.improved ? 'badge-good' : hotspotsDelta.diff > 0 ? 'badge-bad' : 'badge-neutral'}`}>
                      {hotspotsDelta.diff > 0 ? `+${hotspotsDelta.diff}` : `${hotspotsDelta.diff}`}
                    </span>
                  ) : <span className="cf-val-slot">--</span>}
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent ? (
                    hotspotsDelta.improved ? (
                      <span className="eval-tag good">Fewer Choke Points</span>
                    ) : hotspotsDelta.diff > 0 ? (
                      <span className="eval-tag bad">More Choke Points</span>
                    ) : (
                      <span className="eval-tag neutral">Same</span>
                    )
                  ) : <span className="cf-val-slot">--</span>}
                </td>
              </tr>

              {/* Row 5: Unreachable Pedestrians */}
              <tr>
                <td>
                  <strong>Blocked People</strong>
                  <div className="cell-sub">People with no walkable path to an exit</div>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline ? `${baselineScenario.metrics.unreachableCount}` : 'N/A'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasSimulatedCurrent ? `${metrics.unreachableCount}` : '--'}
                  </span>
                </td>
                <td>
                  <span className="cf-val-slot">
                    {hasBaseline && hasSimulatedCurrent ? (
                      <span className={unreachableDelta.diff < 0 ? 'text-green' : unreachableDelta.diff > 0 ? 'text-red' : ''}>
                        {unreachableDelta.diff > 0 ? `+${unreachableDelta.diff}` : unreachableDelta.diff}
                      </span>
                    ) : '--'}
                  </span>
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent ? (
                    <span className={`delta-badge ${unreachableDelta.improved ? 'badge-good' : unreachableDelta.diff > 0 ? 'badge-bad' : 'badge-neutral'}`}>
                      {unreachableDelta.diff}
                    </span>
                  ) : <span className="cf-val-slot">--</span>}
                </td>
                <td>
                  {hasBaseline && hasSimulatedCurrent ? (
                    metrics.unreachableCount === 0 ? (
                      <span className="eval-tag good">All Connected</span>
                    ) : (
                      <span className="eval-tag bad">Blocked Paths</span>
                    )
                  ) : <span className="cf-val-slot">--</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Engineering Evaluation Verdict */}
      <div className="dashboard-card verdict-card">
        <div className="card-header">
          <h3 className="card-title">Comparison Summary</h3>
          <span className="verdict-header-status">
            {hasBaseline ? (hasSimulatedCurrent ? 'Live Comparative Evaluation' : 'Baseline Active') : 'Reference Benchmark'}
          </span>
        </div>
        <div className="card-body">
          {(() => {
            if (!hasBaseline) {
              return (
                <div className="verdict-content neutral">
                  <div className="verdict-icon-box neutral">
                    <Info size={22} className="text-blue" />
                  </div>
                  <div className="verdict-text-wrap">
                    <h4>Similar Flow Performance</h4>
                    <p>
                      Current layout is running at reference benchmark flow. Click <strong>"Save Current as Baseline"</strong> above, then modify corridors or doors in the Layout Editor to test for improved crowd throughput.
                    </p>
                  </div>
                </div>
              );
            }

            const improvedMetrics = [];
            if (hotspotsDelta.improved) improvedMetrics.push(`${Math.abs(hotspotsDelta.diff)} fewer bottleneck choke point(s)`);
            if (peakDensityDelta.improved) improvedMetrics.push(`${Math.abs(peakDensityDelta.pct)}% lower peak crowding`);
            if (journeyDelta.improved && metrics.avgJourneyTime > 0) improvedMetrics.push(`${Math.abs(journeyDelta.diff)}s faster exit time`);
            if (throughputDelta.improved && metrics.throughputRate > 0) improvedMetrics.push(`+${throughputDelta.diff} people/min throughput`);
            if (unreachableDelta.improved) improvedMetrics.push(`cleared blocked pathways`);

            const regressedCount = [
              journeyDelta.diff > 2.0,
              peakDensityDelta.diff > 0.8,
              hotspotsDelta.diff > 0,
              throughputDelta.diff < -5,
              unreachableDelta.diff > 0
            ].filter(Boolean).length;

            const isImproved = hasSimulatedCurrent && improvedMetrics.length >= 1 && improvedMetrics.length > regressedCount;
            const isRegressed = hasSimulatedCurrent && regressedCount >= 2 && regressedCount > improvedMetrics.length;

            if (isImproved) {
              return (
                <div className="verdict-content good">
                  <div className="verdict-icon-box good">
                    <CheckCircle2 size={22} className="text-green" />
                  </div>
                  <div className="verdict-text-wrap">
                    <h4>Noticeable Improvement</h4>
                    <p>
                      This layout configuration improved crowd safety: achieved{' '}
                      <strong>{improvedMetrics.join(', ')}</strong> compared to the baseline design.
                    </p>
                  </div>
                </div>
              );
            }

            if (isRegressed) {
              return (
                <div className="verdict-content bad">
                  <div className="verdict-icon-box bad">
                    <AlertTriangle size={22} className="text-red" />
                  </div>
                  <div className="verdict-text-wrap">
                    <h4>More Congestion Detected</h4>
                    <p>
                      This configuration caused more choke points or slower exit times compared to the baseline. Try widening aisles or opening auxiliary exits.
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div className="verdict-content neutral">
                <div className="verdict-icon-box neutral">
                  <Info size={22} className="text-blue" />
                </div>
                <div className="verdict-text-wrap">
                  <h4>Similar Flow Performance</h4>
                  <p>
                    {hasSimulatedCurrent
                      ? 'Crowd movement and exit times are very close to the baseline. Try applying additional door widening or booth setbacks to observe larger differences.'
                      : 'Baseline scenario is saved. Run or step the simulation on your modified layout to observe comparative differences in flow performance.'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
