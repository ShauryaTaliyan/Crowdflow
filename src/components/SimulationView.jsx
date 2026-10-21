import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  HEATMAP_CELL_SIZE, 
  NAV_CELL_SIZE 
} from '../constants/presets';
import { HEATMAP_COLS, HEATMAP_ROWS } from '../engine/simulation';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  Flame, 
  AlertTriangle, 
  Compass, 
  Eye, 
  Layers, 
  Info, 
  HelpCircle,
  DoorOpen,
  Users,
  Clock,
  Sparkles,
  Camera,
  FlaskConical,
  Radio
} from 'lucide-react';

export default function SimulationView() {
  const {
    venue,
    simEngine,
    navEngine,
    simSettings,
    setSimSettings,
    simStatus,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    metrics,
    blueprint,
    cameras = [],
    occupancy = {},
    setActiveTab,
    openPhoneCameraConnectFlow,
  } = useCrowdFlow();

  const canvasRef = useRef(null);
  const [showLegend, setShowLegend] = useState(true);
  const [showGateToggles, setShowGateToggles] = useState(false);

  // Cached Blueprint Image
  const blueprintImgRef = useRef(null);
  useEffect(() => {
    if (blueprint.imageSrc) {
      const img = new Image();
      img.src = blueprint.imageSrc;
      img.onload = () => {
        blueprintImgRef.current = img;
      };
    } else {
      blueprintImgRef.current = null;
    }
  }, [blueprint.imageSrc]);

  // Global Keyboard Controls for Demo Simulation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in any text or number input, textarea, or select
      const targetTag = document.activeElement?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return;
      }

      // Spacebar: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        if (simStatus === 'running') {
          pauseSimulation();
        } else {
          startSimulation();
        }
        return;
      }

      // ArrowUp or '+' / '=': Increase crowd size by 10
      if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') {
        e.preventDefault();
        setSimSettings(prev => ({
          ...prev,
          crowdSize: Math.min(500, (prev.crowdSize || 80) + 10)
        }));
        return;
      }

      // ArrowDown or '-' / '_': Decrease crowd size by 10
      if (e.key === 'ArrowDown' || e.key === '-' || e.key === '_') {
        e.preventDefault();
        setSimSettings(prev => ({
          ...prev,
          crowdSize: Math.max(5, (prev.crowdSize || 80) - 10)
        }));
        return;
      }

      // ArrowRight or '>' / '.': Increase speed multiplier by 0.1x
      if (e.key === 'ArrowRight' || e.key === '>' || e.key === '.') {
        e.preventDefault();
        setSimSettings(prev => {
          const cur = prev.walkingSpeedMultiplier || 1.0;
          return {
            ...prev,
            walkingSpeedMultiplier: Math.min(3.0, parseFloat((cur + 0.1).toFixed(1)))
          };
        });
        return;
      }

      // ArrowLeft or '<' / ',': Decrease speed multiplier by 0.1x
      if (e.key === 'ArrowLeft' || e.key === '<' || e.key === ',') {
        e.preventDefault();
        setSimSettings(prev => {
          const cur = prev.walkingSpeedMultiplier || 1.0;
          return {
            ...prev,
            walkingSpeedMultiplier: Math.max(0.1, parseFloat((cur - 0.1).toFixed(1)))
          };
        });
        return;
      }

      // 'r' or 'R': Reset simulation
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        resetSimulation();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [simStatus, startSimulation, pauseSimulation, resetSimulation, setSimSettings]);

  // Main Canvas Rendering Loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Background fill
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle architectural grid dots for humanized blueprint feel
    ctx.fillStyle = '#e2e8f0';
    for (let gx = 0; gx < CANVAS_WIDTH; gx += 40) {
      for (let gy = 0; gy < CANVAS_HEIGHT; gy += 40) {
        ctx.fillRect(gx - 1, gy - 1, 2, 2);
      }
    }

    // 2. Blueprint Background (if enabled)
    if (simSettings.showBlueprint && blueprint.show && blueprintImgRef.current) {
      ctx.save();
      ctx.globalAlpha = blueprint.opacity * 0.45;
      ctx.drawImage(blueprintImgRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    // 3. Static Venue Geometry
    // Walkable Zones
    (venue.walkableZones || []).forEach(zone => {
      ctx.save();
      ctx.fillStyle = 'rgba(26, 115, 232, 0.03)';
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.restore();
    });

    // Stalls / Booths
    (venue.stalls || []).forEach(stall => {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(stall.x, stall.y, stall.w, stall.h);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(stall.x, stall.y, stall.w, stall.h);

      // Soft top accent banner
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(stall.x, stall.y, stall.w, Math.min(14, stall.h / 3));
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(stall.x, stall.y, stall.w, Math.min(14, stall.h / 3));

      // Stall Label
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stall.name || 'Booth', stall.x + stall.w / 2, stall.y + stall.h / 2 + 4);
      ctx.restore();
    });

    // Walls (solid slate 700)
    (venue.walls || []).forEach(wall => {
      ctx.save();
      ctx.fillStyle = '#334155';
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
      ctx.restore();
    });

    // Obstacles
    (venue.obstacles || []).forEach(obs => {
      ctx.save();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      ctx.restore();
    });

    // Entrances (with animated entry arrows)
    (venue.entrances || []).forEach(ent => {
      const isEnabled = ent.enabled !== false;
      ctx.save();
      ctx.fillStyle = isEnabled ? 'rgba(16, 185, 129, 0.15)' : '#f1f5f9';
      ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
      ctx.strokeStyle = isEnabled ? '#059669' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(ent.x, ent.y, ent.w, ent.h);

      ctx.fillStyle = isEnabled ? '#065f46' : '#64748b';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isEnabled ? 'Entry →' : 'Closed', ent.x + ent.w / 2, ent.y + ent.h / 2 + 4);
      ctx.restore();
    });

    // Exits
    (venue.exits || []).forEach(exit => {
      const isEnabled = exit.enabled !== false;
      ctx.save();
      ctx.fillStyle = isEnabled ? 'rgba(239, 68, 68, 0.15)' : '#f1f5f9';
      ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
      ctx.strokeStyle = isEnabled ? '#dc2626' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);

      ctx.fillStyle = isEnabled ? '#991b1b' : '#64748b';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isEnabled ? 'Exit →' : 'Closed', exit.x + exit.w / 2, exit.y + exit.h / 2 + 4);
      ctx.restore();
    });

    // 3b. Dual Gates (Both Entrance and Exit)
    (venue.dualGates || []).forEach(gate => {
      const isEnabled = gate.enabled !== false;
      ctx.save();
      ctx.fillStyle = isEnabled ? 'rgba(13, 148, 136, 0.16)' : '#f1f5f9';
      ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
      ctx.strokeStyle = isEnabled ? '#0d9488' : '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);

      ctx.fillStyle = isEnabled ? '#0f766e' : '#64748b';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isEnabled ? 'IN ⇄ OUT' : 'Closed', gate.x + gate.w / 2, gate.y + gate.h / 2 + 4);
      ctx.restore();
    });

    // 3c. Attractions / Points of Interest (Crowd Magnets)
    (venue.attractions || []).forEach(att => {
      if (att.enabled === false) return;
      ctx.save();
      const now = performance.now();
      const pulse = (Math.sin(now / 350) + 1) / 2; // 0 to 1

      // Glowing aura
      ctx.fillStyle = 'rgba(254, 243, 199, 0.55)';
      ctx.fillRect(att.x, att.y, att.w, att.h);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(att.x, att.y, att.w, att.h);
      ctx.setLineDash([]);

      // Pulsing golden beacon rings around center
      const centerX = att.x + att.w / 2;
      const centerY = att.y + att.h / 2;
      const ringRadius = 14 + pulse * 12;
      ctx.strokeStyle = `rgba(217, 119, 6, ${0.6 - pulse * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Center star badge
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', centerX, centerY);

      // Label
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`★ ${att.name || 'Attraction Stage'}`, centerX, att.y + att.h - 8);

      ctx.restore();
    });

    // 4. Navigation Flow Field Vectors (if toggled)
    if (simSettings.showFlowVectors && navEngine?.globalField?.vectors) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1;
      const vecs = navEngine.globalField.vectors;

      for (let r = 1; r < vecs.length; r += 2) {
        for (let c = 1; c < vecs[r].length; c += 2) {
          const v = vecs[r][c];
          if (v.blocked || v.unreachable || (v.dx === 0 && v.dy === 0)) continue;

          const cx = c * NAV_CELL_SIZE + NAV_CELL_SIZE / 2;
          const cy = r * NAV_CELL_SIZE + NAV_CELL_SIZE / 2;
          const arrowLen = 9;

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + v.dx * arrowLen, cy + v.dy * arrowLen);
          ctx.stroke();

          // Arrow head
          ctx.beginPath();
          ctx.arc(cx + v.dx * arrowLen, cy + v.dy * arrowLen, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = '#38bdf8';
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 4b. Camera View FOV Cones & Viewpoints on Simulation Canvas
    if (simSettings.showCameraViews !== false && cameras && cameras.length > 0) {
      cameras.forEach(cam => {
        const mx = cam.marker_x ?? 150;
        const my = cam.marker_y ?? 150;
        const isStreaming = cam.status === 'streaming';
        const isStale = cam.status === 'stale';

        // Draw Field of View (FOV) Cone
        const fovAngleRad = ((cam.fov_angle || 45) * Math.PI) / 180;
        const fovDepth = cam.fov_depth || 85;
        const baseAngle = ((cam.fov_rotation ?? 45) * Math.PI) / 180;

        ctx.save();
        ctx.translate(mx, my);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, fovDepth, baseAngle - fovAngleRad / 2, baseAngle + fovAngleRad / 2);
        ctx.closePath();

        const coneGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, fovDepth);
        if (isStreaming) {
          coneGrad.addColorStop(0, 'rgba(6, 182, 212, 0.32)');
          coneGrad.addColorStop(1, 'rgba(6, 182, 212, 0.02)');
        } else if (isStale) {
          coneGrad.addColorStop(0, 'rgba(234, 179, 8, 0.25)');
          coneGrad.addColorStop(1, 'rgba(234, 179, 8, 0.02)');
        } else {
          coneGrad.addColorStop(0, 'rgba(148, 163, 184, 0.20)');
          coneGrad.addColorStop(1, 'rgba(148, 163, 184, 0.02)');
        }
        ctx.fillStyle = coneGrad;
        ctx.fill();
        ctx.strokeStyle = isStreaming ? 'rgba(6, 182, 212, 0.65)' : 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Draw Camera Marker Body
        ctx.beginPath();
        ctx.arc(mx, my, 8, 0, Math.PI * 2);
        ctx.fillStyle = isStreaming ? '#0284c7' : isStale ? '#d97706' : '#64748b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Count tag
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(mx - 32, my - 24, 64, 16);
        ctx.strokeStyle = isStreaming ? '#06b6d4' : '#64748b';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - 32, my - 24, 64, 16);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`📹 ${cam.latest_count ?? 0}p`, mx, my - 12);
        ctx.textAlign = 'left';
      });
    }

    // 5. Dynamic Density Heatmap Overlay
    if (simSettings.showHeatmap && simEngine?.densityGrid) {
      ctx.save();
      const grid = simEngine.densityGrid;

      for (let r = 0; r < HEATMAP_ROWS; r++) {
        for (let c = 0; c < HEATMAP_COLS; c++) {
          const d = grid[r][c];
          if (d < 0.3) continue; // transparent if sparse

          let color;
          let alpha = Math.min(0.68, d * 0.14);

          if (d < 1.5) {
            // Low Density: Green / Teal
            color = `rgba(16, 185, 129, ${alpha})`;
          } else if (d < 3.0) {
            // Moderate Density: Yellow
            color = `rgba(234, 179, 8, ${alpha + 0.1})`;
          } else if (d < 4.5) {
            // High Density: Orange
            color = `rgba(249, 115, 22, ${alpha + 0.18})`;
          } else {
            // Critical Bottleneck: Red
            color = `rgba(239, 68, 68, ${alpha + 0.24})`;
          }

          ctx.fillStyle = color;
          ctx.fillRect(
            c * HEATMAP_CELL_SIZE,
            r * HEATMAP_CELL_SIZE,
            HEATMAP_CELL_SIZE,
            HEATMAP_CELL_SIZE
          );
        }
      }
      ctx.restore();
    }

    // 6. Bottleneck Hotspot Pulsing Warning Badges
    if (simSettings.showBottlenecks && simEngine?.activeHotspots) {
      const now = performance.now();
      const pulse = (Math.sin(now / 180) + 1) / 2; // 0 to 1

      simEngine.activeHotspots.forEach(h => {
        ctx.save();
        // Pulsing warning outer circle
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 14 + pulse * 8, 0, Math.PI * 2);
        ctx.stroke();

        // Warning core
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Warning density label
        ctx.fillStyle = '#fee2e2';
        ctx.font = 'bold 9px Inter, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`CHOKE: ${h.density.toFixed(1)}p`, h.x, h.y - 12);
        ctx.restore();
      });
    }

    // 7. Animated Moving Pedestrians
    if (simEngine?.pedestrians) {
      const agents = simEngine.pedestrians;

      for (let i = 0; i < agents.length; i++) {
        const p = agents[i];

        // Trails (if enabled)
        if (simSettings.showTrails && p.history && p.history.length > 1) {
          ctx.save();
          ctx.strokeStyle = 'rgba(26, 115, 232, 0.2)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.history[0].x, p.history[0].y);
          for (let h = 1; h < p.history.length; h++) {
            ctx.lineTo(p.history[h].x, p.history[h].y);
          }
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();

        if (p.status === 'unreachable') {
          // Purple marker for stranded agents
          ctx.fillStyle = '#7c3aed';
          ctx.strokeStyle = '#6d28d9';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Color based on pedestrian speed / congestion deceleration
          let agentColor = '#1a73e8'; // Free-flowing Google blue
          if (p.currentSpeed < 0.6) {
            agentColor = '#dc2626'; // Stalled / Bottleneck queue red
          } else if (p.currentSpeed < 1.0) {
            agentColor = '#d97706'; // Slowing amber
          }

          // Clean pedestrian circle with crisp white outline
          ctx.fillStyle = agentColor;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Glowing cyan ring for live camera twin observations
          if (p.isLiveTwin || simSettings.isLiveTwinMode) {
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 2.5, 0, Math.PI * 2);
            ctx.stroke();
          } else if (p.state === 'visiting_attraction') {
            // Glowing golden amber halo for crowd lingering at demo attraction
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 2.8, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Direction vector indicator (tiny velocity nose)
          if (Math.hypot(p.vx, p.vy) > 0.1) {
            const angle = Math.atan2(p.vy, p.vx);
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + Math.cos(angle) * (p.radius + 3), p.y + Math.sin(angle) * (p.radius + 3));
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    }
  }, [venue, simEngine, navEngine, simSettings, blueprint, cameras]);

  // Continuous animation frame loop
  useEffect(() => {
    let animId;
    const loop = () => {
      renderFrame();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [renderFrame]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="cf-simulation-page">
      {/* Simulation Command Bar */}
      <div className="sim-control-bar" style={{ flexWrap: 'wrap', gap: 10 }}>
        {/* Mode Selector: Live Monitoring Twin vs Demo Simulation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-subtle)',
          padding: 3,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-card)'
        }}>
          <button
            type="button"
            onClick={() => setSimSettings(prev => ({ ...prev, isDemoSimulation: false, isLiveTwinMode: true }))}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: !simSettings.isDemoSimulation ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
              color: !simSettings.isDemoSimulation ? '#ffffff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              boxShadow: !simSettings.isDemoSimulation ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none'
            }}
            title="Simulate real people detected by live cameras"
          >
            <Radio size={13} />
            <span>Live Twin</span>
          </button>

          <button
            type="button"
            onClick={() => setSimSettings(prev => ({ ...prev, isDemoSimulation: true, isLiveTwinMode: false }))}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: simSettings.isDemoSimulation ? 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)' : 'transparent',
              color: simSettings.isDemoSimulation ? '#ffffff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              boxShadow: simSettings.isDemoSimulation ? '0 2px 8px rgba(26, 115, 232, 0.35)' : 'none'
            }}
            title="Enable demo simulation with manual crowd, speed, and pause controls"
          >
            <FlaskConical size={13} />
            <span>Demo Simulation</span>
          </button>
        </div>

        {/* --- CONTROLS IN LIVE TWIN MODE (Default): Real Observations Only --- */}
        {!simSettings.isDemoSimulation && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--green-subtle)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px'
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: (occupancy?.total_estimated_occupancy || 0) > 0 ? '#10b981' : '#f59e0b',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)'
            }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--green-text)', fontWeight: 700, textTransform: 'uppercase' }}>
                Live Camera Population
              </span>
              <span style={{ fontSize: '0.88rem', color: '#ffffff', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                {occupancy?.total_estimated_occupancy || 0} Individuals Observed
              </span>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--green-text)', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
              Strictly Live
            </span>
          </div>
        )}

        {/* --- CONTROLS IN DEMO SIMULATION MODE ONLY: Playback, Speed, Add/Remove Individuals --- */}
        {simSettings.isDemoSimulation && (
          <>
            {/* Playback Controls (Play / Pause / Reset) */}
            <div className="playback-group">
              {simStatus !== 'running' ? (
                <button className="btn-primary-glow" onClick={startSimulation} title="Start / Resume Demo Simulation">
                  <Play size={18} fill="currentColor" />
                  <span>{simStatus === 'paused' ? 'Resume' : 'Start Simulation'}</span>
                </button>
              ) : (
                <button className="btn-secondary" onClick={pauseSimulation} title="Pause Simulation">
                  <Pause size={18} fill="currentColor" />
                  <span>Pause</span>
                </button>
              )}

              <button className="btn-secondary" onClick={resetSimulation} title="Reset Simulation State">
                <RotateCcw size={16} />
                <span>Reset</span>
              </button>
            </div>

            {/* Add / Remove Individuals (Crowd Population Slider + Direct Number Input) */}
            <div className="slider-group" style={{ minWidth: 235 }}>
              <div className="slider-item">
                <div className="slider-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="slider-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={13} style={{ color: '#6366f1' }} />
                    <span>Crowd Population:</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input
                      type="number"
                      min="5"
                      max="500"
                      step="5"
                      value={simSettings.crowdSize || 80}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setSimSettings(prev => ({ ...prev, crowdSize: Math.max(5, Math.min(500, val)) }));
                        }
                      }}
                      className="keyboard-ctrl-input"
                      style={{
                        width: 56,
                        padding: '2px 4px',
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        borderRadius: 4,
                        border: '1px solid var(--border-card)',
                        background: 'var(--bg-subtle)',
                        color: 'var(--primary)'
                      }}
                      title="Type crowd population directly with keyboard (5 - 500)"
                    />
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary)' }}>p</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setSimSettings(prev => ({ ...prev, crowdSize: Math.max(5, (prev.crowdSize || 80) - 20) }))}
                    style={{ padding: '2px 6px', fontSize: '0.72rem', borderRadius: 4, border: '1px solid var(--border-card)', background: 'var(--bg-subtle)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 700 }}
                    title="Remove 20 individuals"
                  >
                    -20
                  </button>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    step="5"
                    value={simSettings.crowdSize || 80}
                    onChange={(e) => setSimSettings(prev => ({ ...prev, crowdSize: parseInt(e.target.value, 10) }))}
                    className="cf-slider"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setSimSettings(prev => ({ ...prev, crowdSize: Math.min(500, (prev.crowdSize || 80) + 20) }))}
                    style={{ padding: '2px 6px', fontSize: '0.72rem', borderRadius: 4, border: '1px solid var(--border-card)', background: 'var(--bg-subtle)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 700 }}
                    title="Add 20 individuals"
                  >
                    +20
                  </button>
                </div>
              </div>
            </div>

            {/* Walking Speed Multiplier Slider + Direct Number Input */}
            <div className="slider-group" style={{ minWidth: 175 }}>
              <div className="slider-item">
                <div className="slider-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="slider-title">Speed:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input
                      type="number"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={Number((simSettings.walkingSpeedMultiplier || 1.0).toFixed(1))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          setSimSettings(prev => ({ ...prev, walkingSpeedMultiplier: Math.max(0.1, Math.min(3.0, parseFloat(val.toFixed(1)))) }));
                        }
                      }}
                      className="keyboard-ctrl-input"
                      style={{
                        width: 52,
                        padding: '2px 4px',
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        borderRadius: 4,
                        border: '1px solid var(--border-card)',
                        background: 'var(--bg-subtle)',
                        color: 'var(--text-main)'
                      }}
                      title="Type speed multiplier directly with keyboard (0.1x - 3.0x)"
                    />
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)' }}>x</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.1"
                  value={simSettings.walkingSpeedMultiplier || 1.0}
                  onChange={(e) => setSimSettings(prev => ({ ...prev, walkingSpeedMultiplier: parseFloat(e.target.value) }))}
                  className="cf-slider"
                />
              </div>
            </div>

            {/* Sim Rate Chips */}
            <div className="clock-rate-group">
              <span className="clock-rate-label">Rate:</span>
              {[1, 2, 4, 8].map(rate => (
                <button
                  key={rate}
                  className={`btn-chip ${(simSettings.simClockRate || 1) === rate ? 'active' : ''}`}
                  onClick={() => setSimSettings(prev => ({ ...prev, simClockRate: rate }))}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Keyboard Shortcuts Hint Pill */}
            <div
              className="keyboard-hints-pill"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                borderRadius: 5,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-card)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)'
              }}
              title="Keyboard Controls: [↑/↓] Crowd Population • [←/→] Speed Multiplier • [Space] Play/Pause • Or type directly into the number boxes"
            >
              <span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>⌨ Keys:</span>
              <span><kbd style={{ padding: '1px 5px', background: 'var(--bg-app)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 3, fontWeight: 700, fontSize: '0.7rem', color: '#f1f5f9' }}>↑</kbd><kbd style={{ padding: '1px 5px', background: 'var(--bg-app)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 3, fontWeight: 700, fontSize: '0.7rem', color: '#f1f5f9', marginLeft: 2 }}>↓</kbd> Pop</span>
              <span><kbd style={{ padding: '1px 5px', background: 'var(--bg-app)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 3, fontWeight: 700, fontSize: '0.7rem', color: '#f1f5f9' }}>←</kbd><kbd style={{ padding: '1px 5px', background: 'var(--bg-app)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 3, fontWeight: 700, fontSize: '0.7rem', color: '#f1f5f9', marginLeft: 2 }}>→</kbd> Spd</span>
              <span><kbd style={{ padding: '1px 5px', background: 'var(--bg-app)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 3, fontWeight: 700, fontSize: '0.7rem', color: '#f1f5f9' }}>Space</kbd> Pause/Play</span>
            </div>
          </>
        )}

        {/* Gate Manager Popover Toggle */}
        <button
          className={`btn-secondary ${showGateToggles ? 'active' : ''}`}
          onClick={() => setShowGateToggles(!showGateToggles)}
          title="Toggle Entrance & Exit Gate availability"
        >
          <DoorOpen size={16} />
          <span>Gates</span>
        </button>

        {/* Visual Layer Toggles */}
        <div className="layer-toggles-group">
          <button
            className={`btn-chip ${simSettings.showCameraViews !== false ? 'active' : ''}`}
            onClick={() => setSimSettings(prev => ({ ...prev, showCameraViews: prev.showCameraViews === false }))}
            title="Toggle Live Camera View Cones & FOV Projections"
          >
            <Camera size={14} className="text-blue" />
            <span>Camera Cones</span>
          </button>

          <button
            className={`btn-chip ${simSettings.showHeatmap ? 'active' : ''}`}
            onClick={() => setSimSettings(prev => ({ ...prev, showHeatmap: !prev.showHeatmap }))}
            title="Toggle Density Heatmap Layer"
          >
            <Flame size={14} className="text-orange" />
            <span>Heatmap</span>
          </button>

          <button
            className={`btn-chip ${simSettings.showBottlenecks ? 'active' : ''}`}
            onClick={() => setSimSettings(prev => ({ ...prev, showBottlenecks: !prev.showBottlenecks }))}
            title="Toggle Bottleneck Warning Rings"
          >
            <AlertTriangle size={14} className="text-amber" />
            <span>Choke Points</span>
          </button>

          <button
            className={`btn-chip ${simSettings.showFlowVectors ? 'active' : ''}`}
            onClick={() => setSimSettings(prev => ({ ...prev, showFlowVectors: !prev.showFlowVectors }))}
            title="Toggle Navigation Flow Vector Lines"
          >
            <Compass size={14} className="text-blue" />
            <span>Vectors</span>
          </button>
        </div>
      </div>

      {/* Gate Manager Overlay Panel */}
      {showGateToggles && (
        <div className="gates-manager-drawer">
          <div className="drawer-header">
            <h4>Entrance & Exit Gate Availability</h4>
            <button className="btn-close" onClick={() => setShowGateToggles(false)}>&times;</button>
          </div>
          <div className="drawer-content">
            <div className="gate-list-section">
              <h5>Entrances</h5>
              {(venue.entrances || []).map(ent => (
                <label key={ent.id} className="gate-toggle-row">
                  <input
                    type="checkbox"
                    checked={ent.enabled !== false}
                    onChange={(e) => {
                      const updated = (venue.entrances || []).map(item =>
                        item.id === ent.id ? { ...item, enabled: e.target.checked } : item
                      );
                      // will trigger nav rebuild in context
                      venue.entrances = updated;
                      setSimSettings(prev => ({ ...prev }));
                    }}
                  />
                  <span>{ent.name}</span>
                </label>
              ))}
            </div>

            <div className="gate-list-section">
              <h5>Exits</h5>
              {(venue.exits || []).map(exit => (
                <label key={exit.id} className="gate-toggle-row">
                  <input
                    type="checkbox"
                    checked={exit.enabled !== false}
                    onChange={(e) => {
                      const updated = (venue.exits || []).map(item =>
                        item.id === exit.id ? { ...item, enabled: e.target.checked } : item
                      );
                      venue.exits = updated;
                      setSimSettings(prev => ({ ...prev }));
                    }}
                  />
                  <span>{exit.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {!simSettings.isDemoSimulation ? (
        <div style={{
          background: (occupancy?.total_estimated_occupancy || 0) > 0 
            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.05) 100%)' 
            : 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.05) 100%)',
          border: (occupancy?.total_estimated_occupancy || 0) > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={18} style={{ color: (occupancy?.total_estimated_occupancy || 0) > 0 ? '#10b981' : '#f59e0b', flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
              {(occupancy?.total_estimated_occupancy || 0) > 0 ? (
                <span>
                  <strong style={{ color: '#10b981' }}>Live Digital Twin Active:</strong> Simulating exactly <strong style={{ color: '#ffffff' }}>{occupancy.total_estimated_occupancy} real individuals</strong> observed across connected cameras. Synthetic demo crowd controls are hidden.
                </span>
              ) : (
                <span>
                  <strong style={{ color: '#f59e0b' }}>Live Digital Twin Active (0 Live Individuals Observed):</strong> This simulation strictly visualizes real individuals observed by connected cameras. Connect a phone camera, webcam, or video stream in Live Monitoring to stream individuals into this venue simulation. Zero fake demo pedestrians are generated.
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn-secondary"
              onClick={() => setSimSettings(prev => ({ ...prev, isDemoSimulation: true, isLiveTwinMode: false }))}
              style={{ padding: '6px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap', borderColor: 'rgba(16, 185, 129, 0.3)' }}
            >
              <FlaskConical size={14} style={{ color: '#10b981', marginRight: 4 }} />
              <span>Enable Demo Simulation</span>
            </button>
            <button
              className="btn-primary"
              onClick={() => setActiveTab('monitoring')}
              style={{ padding: '6px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
            >
              <span>Open Live Monitoring →</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.05) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FlaskConical size={18} style={{ color: '#818cf8', flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
              <strong style={{ color: '#a5b4fc' }}>Demo Simulation Mode Active:</strong> Manual simulation parameters unlocked. You can play/pause, adjust walking speed, change simulation clock rate, and add or remove individuals above.
            </div>
          </div>

          <button
            className="btn-secondary"
            onClick={() => setSimSettings(prev => ({ ...prev, isDemoSimulation: false, isLiveTwinMode: true }))}
            style={{ padding: '6px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
          >
            <Radio size={14} style={{ color: '#10b981', marginRight: 4 }} />
            <span>Switch Back to Live Twin</span>
          </button>
        </div>
      )}

      {/* Main Simulation Canvas Viewport */}
      <div className="sim-canvas-container">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="sim-viewport-canvas"
        />

        {/* Live Floating HUD */}
        <div className="sim-floating-hud">
          <div className="hud-metric">
            <span className="hud-label">Inside</span>
            <span className="hud-val text-blue">{metrics.activePedestrians}</span>
          </div>
          <div className="hud-divider" />
          <div className="hud-metric">
            <span className="hud-label">Exited</span>
            <span className="hud-val text-green">{metrics.totalExited}</span>
          </div>
          <div className="hud-divider" />
          <div className="hud-metric">
            <span className="hud-label">Flow Rate</span>
            <span className="hud-val">{metrics.throughputRate} <span className="hud-sub">people/min</span></span>
          </div>
          <div className="hud-divider" />
          <div className="hud-metric">
            <span className="hud-label">Avg. Trip Time</span>
            <span className="hud-val">{metrics.avgJourneyTime > 0 ? `${metrics.avgJourneyTime}s` : '--'}</span>
          </div>
          <div className="hud-divider" />
          <div className="hud-metric">
            <span className="hud-label">Choke Points</span>
            <span className={`hud-val ${metrics.activeHotspotsCount > 0 ? 'text-red' : 'text-green'}`}>
              {metrics.activeHotspotsCount}
            </span>
          </div>
          {metrics.unreachableCount > 0 && (
            <>
              <div className="hud-divider" />
              <div className="hud-metric">
                <span className="hud-label">Blocked</span>
                <span className="hud-val text-magenta">{metrics.unreachableCount}</span>
              </div>
            </>
          )}
          <div className="hud-divider" />
          <div className="hud-metric">
            <span className="hud-label">Elapsed Time</span>
            <span className="hud-val font-mono">{formatTime(metrics.elapsedTime)}</span>
          </div>
        </div>

        {/* Floating Heatmap Legend */}
        {showLegend && (
          <div className="sim-floating-legend">
            <div className="legend-head">
              <span className="legend-title">Density Heatmap Scale</span>
              <button className="legend-close-btn" onClick={() => setShowLegend(false)}>&times;</button>
            </div>
            <div className="legend-tiers">
              <div className="legend-tier">
                <span className="tier-swatch tier-green" />
                <div className="tier-desc">
                  <strong>Low Density (&lt; 1.5 p/m²)</strong>
                  <span>Free-flowing pedestrian velocity</span>
                </div>
              </div>
              <div className="legend-tier">
                <span className="tier-swatch tier-yellow" />
                <div className="tier-desc">
                  <strong>Moderate Density (1.5 - 3.0 p/m²)</strong>
                  <span>Minor social deceleration</span>
                </div>
              </div>
              <div className="legend-tier">
                <span className="tier-swatch tier-orange" />
                <div className="tier-desc">
                  <strong>High Congestion (3.0 - 4.5 p/m²)</strong>
                  <span>Queue formation & aisle slowing</span>
                </div>
              </div>
              <div className="legend-tier">
                <span className="tier-swatch tier-red" />
                <div className="tier-desc">
                  <strong>Bottleneck Choke (&ge; 4.5 p/m²)</strong>
                  <span>Severe turbulent queuing</span>
                </div>
              </div>
            </div>
            <div className="legend-disclaimer">
              <Info size={12} />
              <span>Density = occupants per 25px grid cell. Educational 2D simulation model.</span>
            </div>
          </div>
        )}

        {!showLegend && (
          <button className="btn-legend-pill" onClick={() => setShowLegend(true)}>
            <Flame size={14} className="text-orange" />
            <span>Show Legend</span>
          </button>
        )}
      </div>
    </div>
  );
}
