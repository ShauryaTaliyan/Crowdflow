import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/presets';
import StatCard from './Common/StatCard';
import {
  Smartphone,
  Video,
  Camera,
  Layers,
  Upload,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  RefreshCw,
  Sliders,
  X,
  HelpCircle,
  Eye,
  Info,
  Radio,
  Compass,
  Pencil,
  Maximize2,
  Minimize2,
  Users
} from 'lucide-react';

function getHeadingLabel(deg) {
  const norm = ((deg % 360) + 360) % 360;
  if (norm >= 337.5 || norm < 22.5) return 'East (0°)';
  if (norm >= 22.5 && norm < 67.5) return 'South-East (45°)';
  if (norm >= 67.5 && norm < 112.5) return 'South (90°)';
  if (norm >= 112.5 && norm < 157.5) return 'South-West (135°)';
  if (norm >= 157.5 && norm < 202.5) return 'West (180°)';
  if (norm >= 202.5 && norm < 247.5) return 'North-West (225°)';
  if (norm >= 247.5 && norm < 292.5) return 'North (270°)';
  return 'North-East (315°)';
}

export default function LiveMonitoringView() {
  const {
    venue,
    theme,
    blueprint,
    monitoringZones = [],
    cameras = [],
    occupancy = {},
    liveEvents = [],
    historyObservations = [],
    activePhoneSession,
    setActivePhoneSession,
    isBackendConnected,
    fetchMonitoringData,
    createPhoneCameraSession,
    addMonitoringZone,
    deleteMonitoringZone,
    updateCamera,
    deleteCamera,
    clearOfflineCameras,
    deleteAllCameras,
    injectSimulatedObservation,
    addNotification,
    showPhoneModal,
    setShowPhoneModal,
    openPhoneCameraConnectFlow,
    // Global Persistent Desktop Webcam
    isWebcamActive,
    webcamStream,
    webcamCount,
    startDesktopWebcam,
    stopDesktopWebcam,
  } = useCrowdFlow();

  // Canvas Reference
  const canvasRef = useRef(null);
  const blueprintImgRef = useRef(null);

  // Active UI Modals & State (showPhoneModal is shared via context)
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showRtspModal, setShowRtspModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [showWebcamModal, setShowWebcamModal] = useState(false);

  // Auto-redirect / Transition effect when phone camera connects & streams
  const [phoneConnectSuccess, setPhoneConnectSuccess] = useState(false);
  const autoCloseTimerRef = useRef(null);

  useEffect(() => {
    if (!showPhoneModal || !activePhoneSession) {
      setPhoneConnectSuccess(false);
      return;
    }

    const currentCam = cameras.find(
      c => c.id === activePhoneSession.camera_id || c.session_token === activePhoneSession.session_token
    );

    if (currentCam && (currentCam.status === 'streaming' || (currentCam.status === 'connected' && (currentCam.latest_count ?? 0) > 0))) {
      setPhoneConnectSuccess(true);
      setSelectedCameraId(currentCam.id);
      if (currentCam.assigned_zone_id) {
        setSelectedZoneId(currentCam.assigned_zone_id);
      }

      // Automatically redirect view to live canvas by closing modal after 1.2s
      if (!autoCloseTimerRef.current) {
        autoCloseTimerRef.current = setTimeout(() => {
          setShowPhoneModal(false);
          setPhoneConnectSuccess(false);
          autoCloseTimerRef.current = null;
          addNotification(`📱 Mobile camera connected! Live observations streaming to blueprint.`, 'success');
        }, 1200);
      }
    }

    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [showPhoneModal, activePhoneSession, cameras, setShowPhoneModal, addNotification]);

  // Selected Zone for Inspection
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Dragging Camera Marker on Canvas
  const [draggingCamId, setDraggingCamId] = useState(null);

  // Enlarged Camera View Modal & Live Snapshot Cache
  const [enlargedCamera, setEnlargedCamera] = useState(null);
  const [cameraSnapshots, setCameraSnapshots] = useState({});
  const enlargedWebcamVideoRef = useRef(null);

  // Poll camera snapshots for active feeds
  useEffect(() => {
    let isMounted = true;
    const fetchSnapshots = async () => {
      const activeCams = enlargedCamera 
        ? [enlargedCamera] 
        : cameras.filter(c => c.status === 'streaming' || c.status === 'connected');

      for (const cam of activeCams) {
        try {
          const res = await fetch(`/api/cameras/${cam.id}/snapshot`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.image_base64 && isMounted) {
              setCameraSnapshots(prev => ({
                ...prev,
                [cam.id]: data
              }));
            }
          }
        } catch (e) {
          // ignore
        }
      }
    };

    fetchSnapshots();
    const snapInterval = setInterval(fetchSnapshots, 1600);
    return () => {
      isMounted = false;
      clearInterval(snapInterval);
    };
  }, [cameras, enlargedCamera]);

  // Mirror webcam stream to enlarged viewer when webcam is enlarged
  useEffect(() => {
    if (enlargedCamera && (enlargedCamera.type === 'webcam' || enlargedCamera.id?.includes('webcam')) && isWebcamActive && webcamStream) {
      if (enlargedWebcamVideoRef.current && enlargedWebcamVideoRef.current.srcObject !== webcamStream) {
        enlargedWebcamVideoRef.current.srcObject = webcamStream;
        enlargedWebcamVideoRef.current.play().catch(() => {});
      }
    }
  }, [enlargedCamera, isWebcamActive, webcamStream]);

  // Form states & Active Spatial Zone editing
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [newZoneForm, setNewZoneForm] = useState({
    id: '',
    name: 'New Spatial Zone',
    x: 200,
    y: 150,
    w: 220,
    h: 180,
    threshold_low: 8,
    threshold_med: 18,
    threshold_high: 35,
    threshold_crit: 50,
    aggregation_policy: 'MAX',
    color: '#3b82f6',
  });

  const [rtspForm, setRtspForm] = useState({
    name: 'IP Security Camera 1',
    rtsp_url: 'rtsp://192.168.1.100:554/stream1',
    assigned_zone_id: monitoringZones[0]?.id || '',
  });

  const [simForm, setSimForm] = useState({
    cameraId: 'cam_sim_1',
    count: 24,
    zoneId: monitoringZones[0]?.id || '',
  });

  // Cached Blueprint Image
  useEffect(() => {
    if (blueprint.imageSrc) {
      const img = new Image();
      img.src = blueprint.imageSrc;
      img.onload = () => {
        blueprintImgRef.current = img;
        drawMonitoringCanvas();
      };
    } else {
      blueprintImgRef.current = null;
      drawMonitoringCanvas();
    }
  }, [blueprint.imageSrc]);

  // Redraw when zones, cameras, or occupancy updates
  useEffect(() => {
    drawMonitoringCanvas();
  }, [monitoringZones, cameras, occupancy, selectedZoneId, selectedCameraId]);

  // --- Canvas Rendering Pipeline ---
  const drawMonitoringCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0f172a'; // Deep slate night mode for high contrast visualizer
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Blueprint Layer
    if (blueprintImgRef.current) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(blueprintImgRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    } else {
      // Draw subtle grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // Draw basic walls from venue geometry as structural blueprint reference
      ctx.fillStyle = '#334155';
      (venue?.walls || []).forEach(w => {
        ctx.fillRect(w.x, w.y, w.w, w.h);
      });
      (venue?.stalls || []).forEach(s => {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(s.x, s.y, s.w, s.h);
      });
    }

    // 2. Monitoring Zones Layer
    const zoneMetrics = occupancy.zones || {};

    monitoringZones.forEach(zone => {
      const zInfo = zoneMetrics[zone.id] || { count: 0, tier: 'low', color: '#10b981' };
      const isSelected = selectedZoneId === zone.id;

      // Color coding based on occupancy tier
      let fillColor = 'rgba(16, 185, 129, 0.18)'; // Low - Green
      let strokeColor = '#10b981';

      if (zInfo.tier === 'critical') {
        fillColor = 'rgba(239, 68, 68, 0.38)'; // Critical - Red
        strokeColor = '#ef4444';
      } else if (zInfo.tier === 'high') {
        fillColor = 'rgba(249, 115, 22, 0.30)'; // High - Orange
        strokeColor = '#f97316';
      } else if (zInfo.tier === 'moderate') {
        fillColor = 'rgba(234, 179, 8, 0.22)'; // Moderate - Yellow
        strokeColor = '#eab308';
      }

      // Draw Zone Polygon / Rect
      ctx.fillStyle = fillColor;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

      ctx.strokeStyle = isSelected ? '#38bdf8' : strokeColor;
      ctx.lineWidth = isSelected ? 3.5 : 2;
      ctx.setLineDash(isSelected ? [6, 4] : []);
      ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
      ctx.setLineDash([]);

      // Zone Header Badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(zone.x + 4, zone.y + 4, Math.min(zone.w - 8, 170), 38);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(zone.x + 4, zone.y + 4, Math.min(zone.w - 8, 170), 38);

      // Text: Zone Name
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(zone.name.slice(0, 22), zone.x + 10, zone.y + 18);

      // Text: Live Occupancy
      ctx.fillStyle = strokeColor;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`👥 ${zInfo.count} observed`, zone.x + 10, zone.y + 34);

      // Warning pulse if critical
      if (zInfo.tier === 'critical') {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 3;
        ctx.strokeRect(zone.x - 2, zone.y - 2, zone.w + 4, zone.h + 4);
      }
    });

    // 3. Camera Markers & FOV Cones Layer
    cameras.forEach(cam => {
      const mx = cam.marker_x ?? 150;
      const my = cam.marker_y ?? 150;
      const isStreaming = cam.status === 'streaming';
      const isStale = cam.status === 'stale';
      const isSelected = selectedCameraId === cam.id;

      // Draw Field of View (FOV) Cone
      const fovAngleRad = ((cam.fov_angle || 45) * Math.PI) / 180;
      const fovDepth = cam.fov_depth || 85;
      const baseAngle = ((cam.fov_rotation || 45) * Math.PI) / 180;

      ctx.save();
      ctx.translate(mx, my);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, fovDepth, baseAngle - fovAngleRad / 2, baseAngle + fovAngleRad / 2);
      ctx.closePath();

      // Cone fill
      const coneGradient = ctx.createRadialGradient(0, 0, 5, 0, 0, fovDepth);
      if (isStreaming) {
        coneGradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        coneGradient.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
      } else if (isStale) {
        coneGradient.addColorStop(0, 'rgba(234, 179, 8, 0.30)');
        coneGradient.addColorStop(1, 'rgba(234, 179, 8, 0.02)');
      } else {
        coneGradient.addColorStop(0, 'rgba(148, 163, 184, 0.20)');
        coneGradient.addColorStop(1, 'rgba(148, 163, 184, 0.02)');
      }
      ctx.fillStyle = coneGradient;
      ctx.fill();
      ctx.strokeStyle = isStreaming ? 'rgba(56, 189, 248, 0.5)' : 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Draw Camera Marker Body
      ctx.beginPath();
      ctx.arc(mx, my, isSelected ? 12 : 10, 0, Math.PI * 2);
      ctx.fillStyle = isStreaming ? '#0284c7' : isStale ? '#d97706' : '#475569';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner Lens icon
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fillStyle = isStreaming ? '#38bdf8' : '#cbd5e1';
      ctx.fill();

      // Live Count Tag above camera
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(mx - 38, my - 28, 76, 18);
      ctx.strokeStyle = isStreaming ? '#38bdf8' : '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx - 38, my - 28, 76, 18);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      const countLabel = isStreaming ? `📸 ${cam.latest_count ?? 0}` : isStale ? `⚠️ ${cam.latest_count ?? 0}` : `⏸ 0`;
      ctx.fillText(countLabel, mx, my - 15);
      ctx.textAlign = 'left';
    });

  }, [monitoringZones, cameras, occupancy, selectedZoneId, selectedCameraId, venue]);

  // Handle Canvas Mouse Clicks & Marker Dragging
  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // 1. Check Camera Markers
    for (const cam of cameras) {
      const cx = cam.marker_x ?? 150;
      const cy = cam.marker_y ?? 150;
      if (Math.hypot(clickX - cx, clickY - cy) <= 18) {
        setDraggingCamId(cam.id);
        setSelectedCameraId(cam.id);
        return;
      }
    }

    // 2. Check Zones
    for (const zone of monitoringZones) {
      if (
        clickX >= zone.x &&
        clickX <= zone.x + zone.w &&
        clickY >= zone.y &&
        clickY <= zone.y + zone.h
      ) {
        setSelectedZoneId(zone.id);
        setSelectedCameraId(null);
        return;
      }
    }

    setSelectedZoneId(null);
    setSelectedCameraId(null);
  };

  const handleCanvasMouseMove = (e) => {
    if (!draggingCamId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const curX = Math.round((e.clientX - rect.left) * scaleX);
    const curY = Math.round((e.clientY - rect.top) * scaleY);

    const cam = cameras.find(c => c.id === draggingCamId);
    if (cam) {
      updateCamera({ ...cam, marker_x: curX, marker_y: curY });
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggingCamId) {
      setDraggingCamId(null);
    }
  };

  // --- Spatial Zone Handlers (Add, Edit, Delete, Save) ---
  const handleOpenAddZone = () => {
    setEditingZoneId(null);
    setNewZoneForm({
      id: '',
      name: `Spatial Zone ${monitoringZones.length + 1}`,
      x: 180,
      y: 120,
      w: 240,
      h: 180,
      threshold_low: 8,
      threshold_med: 18,
      threshold_high: 35,
      threshold_crit: 50,
      aggregation_policy: 'MAX',
      color: '#3b82f6',
    });
    setShowZoneModal(true);
  };

  const handleOpenEditZone = (zone) => {
    setEditingZoneId(zone.id);
    setNewZoneForm({
      id: zone.id,
      name: zone.name || 'Spatial Zone',
      x: Math.round(zone.x ?? 100),
      y: Math.round(zone.y ?? 100),
      w: Math.round(zone.w ?? 220),
      h: Math.round(zone.h ?? 180),
      threshold_low: zone.threshold_low ?? 8,
      threshold_med: zone.threshold_med ?? 18,
      threshold_high: zone.threshold_high ?? 35,
      threshold_crit: zone.threshold_crit ?? 50,
      aggregation_policy: zone.aggregation_policy || 'MAX',
      color: zone.color || '#3b82f6',
    });
    setShowZoneModal(true);
  };

  const handleDeleteZone = async (zone) => {
    if (window.confirm(`Delete spatial zone "${zone.name}"? Cameras assigned to this zone will be unassigned.`)) {
      await deleteMonitoringZone(zone.id);
      if (selectedZoneId === zone.id) {
        setSelectedZoneId(null);
      }
    }
  };

  const handleSaveZone = async () => {
    const zoneId = editingZoneId || newZoneForm.id || `zone_${Date.now()}`;
    await addMonitoringZone({
      ...newZoneForm,
      id: zoneId,
      threshold_low: parseInt(newZoneForm.threshold_low, 10) || 5,
      threshold_med: parseInt(newZoneForm.threshold_med, 10) || 15,
      threshold_high: parseInt(newZoneForm.threshold_high, 10) || 30,
      threshold_crit: parseInt(newZoneForm.threshold_crit, 10) || 50,
      x: parseFloat(newZoneForm.x) || 100,
      y: parseFloat(newZoneForm.y) || 100,
      w: parseFloat(newZoneForm.w) || 200,
      h: parseFloat(newZoneForm.h) || 180,
    });
    setShowZoneModal(false);
    setEditingZoneId(null);
  };

  // --- Phone Camera Session Launcher ---
  const handleOpenPhoneModal = async () => {
    const session = await createPhoneCameraSession(selectedZoneId || monitoringZones[0]?.id || null);
    if (session) {
      setShowPhoneModal(true);
    }
  };

  const handleCopyLink = () => {
    if (activePhoneSession?.mobile_url) {
      navigator.clipboard.writeText(activePhoneSession.mobile_url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  // --- Delete Camera Handler ---
  const handleDeleteCamera = async (cameraId) => {
    if (selectedCameraId === cameraId) {
      setSelectedCameraId(null);
    }
    if (enlargedCamera?.id === cameraId) {
      setEnlargedCamera(null);
    }
    await deleteCamera(cameraId);
  };

  // --- Local Webcam Integration (Delegated to Persistent Global Manager in Context) ---
  const handleStartWebcam = async () => {
    await startDesktopWebcam(selectedZoneId);
  };

  const handleStopWebcam = async () => {
    await stopDesktopWebcam();
  };

  // Video Upload Handler
  const handleUploadVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('camera_name', `Video Demonstration (${file.name})`);
    if (selectedZoneId) {
      formData.append('assigned_zone_id', selectedZoneId);
    }

    try {
      addNotification(`Uploading and analyzing video "${file.name}"...`, 'info');
      const res = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        addNotification(`Video file camera initialized. Looping playback with real YOLO detection.`, 'success');
        setShowVideoModal(false);
        fetchMonitoringData();
      } else {
        throw new Error('Upload failed on server.');
      }
    } catch (err) {
      addNotification(`Video upload error: ${err.message}`, 'error');
    }
  };

  // Simulated Observation Injection
  const handleInjectSimulated = async () => {
    await injectSimulatedObservation(simForm.cameraId, parseInt(simForm.count, 10));
    setShowSimModal(false);
  };

  // KPI Calculations
  const activeStreamingCount = cameras.filter(c => c.status === 'streaming').length;
  const staleCount = cameras.filter(c => c.status === 'stale').length;
  const totalOccupancyCount = occupancy.total_estimated_occupancy || 0;

  // Find highest zone
  const highestZoneEntry = Object.values(occupancy.zones || {}).reduce((max, z) => 
    z.count > (max?.count || 0) ? z : max, null
  );

  return (
    <div className="cf-dashboard-page" style={{ padding: '16px 24px' }}>
      {/* Header Banner */}
      <div className="dashboard-hero" style={{ marginBottom: 16 }}>
        <div className="hero-text">
          <div className="hero-badge">
            <Radio size={14} className="hero-badge-icon" />
            <span>Real-Time Multi-Camera Crowd Observation</span>
          </div>
          <h2 className="hero-title">{venue?.name || 'Venue Layout'} — Live Monitoring Wall</h2>
          <p className="hero-subtitle">
            Capture live video streams from multiple mobile phones, webcams, or CCTV feeds, count people with edge YOLO detection, and project zone occupancy onto the venue blueprint.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="hero-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button
            className="btn-primary-glow"
            onClick={handleOpenPhoneModal}
            title="Generate a unique mobile link and QR code to turn any phone into a camera"
          >
            <Smartphone size={16} />
            <span>Connect Phone Camera</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => setShowWebcamModal(true)}
            title="Use current laptop or desktop webcam"
          >
            <Camera size={16} />
            <span>Desktop Webcam</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => setShowVideoModal(true)}
            title="Upload an MP4/WebM video file as a demo camera"
          >
            <Upload size={16} />
            <span>Upload Video File</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => setShowRtspModal(true)}
            title="Add real RTSP / ONVIF IP camera stream"
          >
            <Video size={16} />
            <span>Add RTSP / IP Camera</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => setShowSimModal(true)}
            title="Inject simulated crowd counts (clearly marked SIMULATED DATA)"
          >
            <span>🧪 Inject Demo Data</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => setShowZoneModal(true)}
            title="Create a new spatial monitoring zone on blueprint"
          >
            <Plus size={16} />
            <span>Add Zone</span>
          </button>
        </div>
      </div>

      {/* Quick Mobile Camera Connector Section (Auto-redirects upon connection) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)',
        border: '1px solid rgba(249, 115, 22, 0.35)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 20px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)'
          }}>
            <Smartphone size={22} />
          </div>
          <div>
            <strong style={{ fontSize: '0.96rem', color: '#ffffff', display: 'block' }}>
              Connect Mobile Phone as Edge Detection Camera
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-body)' }}>
              Generate an instant link and QR code. When your phone connects, this dashboard automatically streams live people counts directly to the blueprint.
            </span>
          </div>
        </div>

        <button
          className="btn-primary-glow"
          onClick={handleOpenPhoneModal}
          style={{ fontSize: '0.88rem', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Smartphone size={16} />
          <span>Connect Mobile Camera</span>
        </button>
      </div>

      {/* KPI Overview Strip */}
      <section className="kpi-grid" style={{ marginBottom: 16 }}>
        <StatCard
          label="Connected Cameras"
          value={activeStreamingCount}
          unit="live"
          subLabel={`${cameras.length} total registered cameras`}
          icon={Camera}
          variant="info"
        />

        <StatCard
          label="Monitored Zones"
          value={monitoringZones.length}
          unit="zones"
          subLabel="Active spatial coverage"
          icon={Layers}
          variant="success"
        />

        <StatCard
          label="Total Estimated Occupancy"
          value={totalOccupancyCount}
          unit="people"
          subLabel="Policy: MAX (anti-double-counting)"
          icon={ShieldCheck}
          variant="warning"
        />

        <StatCard
          label="Busiest Sector"
          value={highestZoneEntry ? highestZoneEntry.name : 'Nominal'}
          unit={highestZoneEntry ? `${highestZoneEntry.count} p` : ''}
          subLabel={highestZoneEntry ? `Tier: ${(highestZoneEntry.tier || 'low').toUpperCase()}` : 'No congestion'}
          icon={AlertTriangle}
          variant={highestZoneEntry?.tier === 'critical' ? 'danger' : 'info'}
        />
      </section>

      {/* Double Counting & Overlap Disclosure Alert */}
      {occupancy.overlap_warnings && occupancy.overlap_warnings.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#fbbf24',
          fontSize: '0.84rem'
        }}>
          <AlertTriangle size={18} className="text-amber" />
          <div style={{ flex: 1 }}>
            <strong>Multi-Camera Overlap Disclosure:</strong>{' '}
            {occupancy.overlap_warnings.map(w => w.message).join(' ')}
          </div>
        </div>
      )}

      {/* Main Monitoring Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(360px, 1fr)', gap: 16 }}>
        
        {/* Left Column: Interactive Canvas Visualizer */}
        <div className="cf-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Blueprint Spatial Density & Camera Overlays
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Drag camera pins to position them. Click a zone to inspect or configure threshold alerts.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.75rem' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isBackendConnected ? '#10b981' : '#ef4444' }}></span>
              <span>{isBackendConnected ? 'Backend Live' : 'Reconnecting...'}</span>
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155', background: '#020617' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              style={{ width: '100%', height: 'auto', display: 'block', cursor: draggingCamId ? 'grabbing' : 'default' }}
            />
          </div>

          {/* Visual Legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span><strong>Density Tiers:</strong></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981' }}></span> Low (&lt;8)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#eab308' }}></span> Moderate (8-20)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f97316' }}></span> High (20-40)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }}></span> Critical (&gt;40)
              </span>
            </div>
            <div>
              <span>Scale: 20px = 1.0m</span>
            </div>
          </div>
        </div>

        {/* Right Column: Camera Feeds & Zone Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Active Cameras Panel */}
          <div className="cf-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                Camera Source Feeds ({cameras.length})
              </h3>
              <button
                className="btn-nav-action"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={fetchMonitoringData}
              >
                <RefreshCw size={12} />
                <span>Refresh</span>
              </button>
            </div>

            {cameras.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Camera size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p>No camera sources added yet.</p>
                <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Click <strong>Connect Phone Camera</strong> above to add your first camera.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                {cameras.map(cam => {
                  const isStreaming = cam.status === 'streaming';
                  const isStale = cam.status === 'stale';
                  const isPhone = cam.type === 'phone';
                  const isSim = cam.type === 'simulated';
                  const isVid = cam.type === 'video_file';

                  return (
                    <div
                      key={cam.id}
                      style={{
                        background: 'var(--bg-subtle)',
                        border: selectedCameraId === cam.id ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        boxShadow: selectedCameraId === cam.id ? '0 0 12px rgba(249, 115, 22, 0.25)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ fontSize: '0.85rem', color: '#ffffff' }}>{cam.name}</strong>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: isSim ? 'var(--amber-subtle)' : isVid ? 'var(--purple-subtle)' : 'var(--blue-subtle)',
                              color: isSim ? 'var(--amber-text)' : isVid ? '#c084fc' : '#38bdf8',
                              border: isSim ? '1px solid rgba(245, 158, 11, 0.3)' : isVid ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)'
                            }}>
                              {isSim ? 'SIMULATED DATA' : isVid ? 'VIDEO FILE' : isPhone ? 'PHONE CAMERA' : (cam.type || 'camera').toUpperCase()}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            ID: {cam.id.slice(0, 16)}
                          </span>
                        </div>

                        {/* Status Pill */}
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 9999,
                          background: isStreaming ? 'var(--green-subtle)' : isStale ? 'var(--amber-subtle)' : 'var(--bg-app)',
                          color: isStreaming ? 'var(--green-text)' : isStale ? 'var(--amber-text)' : 'var(--text-muted)',
                          border: isStreaming ? '1px solid rgba(16, 185, 129, 0.35)' : isStale ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: isStreaming ? 'var(--green)' : isStale ? 'var(--amber)' : '#64748b'
                          }}></span>
                          {(cam.status || 'waiting').toUpperCase()}
                        </span>
                      </div>

                      {/* Count & Details Strip */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Observed: </span>
                          <strong style={{ fontSize: '1.15rem', color: '#fb923c', fontFamily: 'var(--font-mono)' }}>{cam.latest_count ?? 0}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}> people</span>
                        </div>

                        {/* Zone Assignment Dropdown */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Zone:</span>
                          <select
                            value={cam.assigned_zone_id || ''}
                            onChange={(e) => updateCamera({ ...cam, assigned_zone_id: e.target.value || null })}
                            style={{ 
                              fontSize: '0.72rem', 
                              padding: '2px 6px', 
                              borderRadius: 4, 
                              border: '1px solid var(--border-card)',
                              background: 'var(--bg-surface)',
                              color: '#f8fafc'
                            }}
                          >
                            <option value="">-- Unassigned --</option>
                            {monitoringZones.map(z => (
                              <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => setSelectedCameraId(selectedCameraId === cam.id ? null : cam.id)}
                            className="btn-nav-action"
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              background: selectedCameraId === cam.id ? 'var(--primary)' : 'var(--bg-subtle)',
                              color: selectedCameraId === cam.id ? '#ffffff' : 'var(--text-muted)',
                              border: selectedCameraId === cam.id ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                              borderRadius: 4,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            title="Adjust camera FOV angle, depth reach, cone beam spread, and coordinates"
                          >
                            <Sliders size={12} />
                            <span>Optics</span>
                          </button>

                          {isPhone && (
                            <button
                              onClick={() => {
                                setActivePhoneSession({
                                  session_token: cam.session_token,
                                  camera_name: cam.name,
                                  mobile_url: `https://${window.location.hostname}:3000/mobile-camera.html?session=${cam.session_token}`,
                                  qr_code: null
                                });
                                setShowPhoneModal(true);
                              }}
                              className="btn-nav-action"
                              style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                              title="Show QR code for this phone"
                            >
                              QR
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCamera(cam.id)}
                            className="btn-nav-action"
                            style={{ padding: '2px 6px', color: '#ef4444' }}
                            title="Delete camera"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Interactive Camera View & Optics Configuration Panel */}
                      {selectedCameraId === cam.id && (
                        <div style={{
                          marginTop: 8,
                          padding: '10px 12px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--primary)',
                          borderRadius: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Sliders size={13} style={{ color: 'var(--primary)' }} />
                              <strong style={{ fontSize: '0.8rem', color: '#ffffff' }}>Camera View Optics & FOV</strong>
                            </div>
                            <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>Active on Simulation Canvas</span>
                          </div>

                          {/* Camera Name Input */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Camera Name / Label</label>
                            <input
                              type="text"
                              value={cam.name || ''}
                              onChange={(e) => updateCamera({ ...cam, name: e.target.value })}
                              style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-card)', background: 'var(--bg-app)', color: '#ffffff' }}
                            />
                          </div>

                          {/* Pan Heading Direction (0° to 360°) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                FOV Pan Heading Direction ({Math.round(cam.fov_rotation ?? 45)}°)
                              </label>
                              <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 700 }}>
                                {getHeadingLabel(cam.fov_rotation ?? 45)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="5"
                              value={cam.fov_rotation ?? 45}
                              onChange={(e) => updateCamera({ ...cam, fov_rotation: parseFloat(e.target.value) })}
                              className="cf-slider"
                            />
                            {/* Quick Presets */}
                            <div style={{ display: 'flex', gap: 3, marginTop: 1 }}>
                              {[
                                { label: '0° E', val: 0 },
                                { label: '90° S', val: 90 },
                                { label: '180° W', val: 180 },
                                { label: '270° N', val: 270 },
                                { label: '45° SE', val: 45 },
                              ].map(p => (
                                <button
                                  key={p.val}
                                  type="button"
                                  onClick={() => updateCamera({ ...cam, fov_rotation: p.val })}
                                  style={{
                                    flex: 1,
                                    padding: '2px 0',
                                    fontSize: '0.62rem',
                                    borderRadius: 3,
                                    border: (cam.fov_rotation ?? 45) === p.val ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                                    background: (cam.fov_rotation ?? 45) === p.val ? 'var(--primary-subtle)' : 'var(--bg-subtle)',
                                    color: (cam.fov_rotation ?? 45) === p.val ? 'var(--primary)' : 'var(--text-muted)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* FOV Beam Spread (Coverage Angle) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                FOV Cone Spread ({Math.round(cam.fov_angle ?? 45)}°)
                              </label>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                                {(cam.fov_angle ?? 45) > 70 ? 'Wide Angle Lens' : 'Standard Focus'}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="20"
                              max="120"
                              step="5"
                              value={cam.fov_angle ?? 45}
                              onChange={(e) => updateCamera({ ...cam, fov_angle: parseFloat(e.target.value) })}
                              className="cf-slider"
                            />
                          </div>

                          {/* FOV Depth Reach Distance */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Depth Reach Distance ({Math.round(cam.fov_depth ?? 85)} px)
                              </label>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                                ~{Math.round((cam.fov_depth ?? 85) / 20 * 10) / 10} meters
                              </span>
                            </div>
                            <input
                              type="range"
                              min="35"
                              max="250"
                              step="5"
                              value={cam.fov_depth ?? 85}
                              onChange={(e) => updateCamera({ ...cam, fov_depth: parseFloat(e.target.value) })}
                              className="cf-slider"
                            />
                          </div>

                          {/* Marker Coordinates */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Position X (px)</label>
                              <input
                                type="number"
                                min="10"
                                max="990"
                                value={Math.round(cam.marker_x ?? 150)}
                                onChange={(e) => updateCamera({ ...cam, marker_x: parseInt(e.target.value, 10) || 10 })}
                                style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-card)', background: 'var(--bg-app)', color: '#ffffff' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Position Y (px)</label>
                              <input
                                type="number"
                                min="10"
                                max="610"
                                value={Math.round(cam.marker_y ?? 150)}
                                onChange={(e) => updateCamera({ ...cam, marker_y: parseInt(e.target.value, 10) || 10 })}
                                style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-card)', background: 'var(--bg-app)', color: '#ffffff' }}
                              />
                            </div>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            You can also drag camera markers directly on the blueprint canvas.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Monitoring Zones Inspector Panel */}
          <div className="cf-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Active Spatial Zones ({monitoringZones.length})
              </h3>
              <button
                onClick={handleOpenAddZone}
                className="btn-primary"
                style={{
                  fontSize: '0.72rem',
                  padding: '4px 10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title="Create a new spatial monitoring zone"
              >
                <Plus size={12} />
                <span>Add Zone</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {monitoringZones.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  No active spatial zones configured. Click "Add Zone" above to define areas on the blueprint.
                </div>
              ) : (
                monitoringZones.map(zone => {
                  const zMetrics = occupancy.zones?.[zone.id] || { count: 0, tier: 'low', color: '#10b981' };
                  const isSelected = selectedZoneId === zone.id;

                  return (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZoneId(isSelected ? null : zone.id)}
                      style={{
                        background: isSelected ? 'rgba(249, 115, 22, 0.12)' : 'var(--bg-subtle)',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: zone.color || '#3b82f6',
                            flexShrink: 0
                          }} />
                          <strong style={{ fontSize: '0.82rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {zone.name}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          Thresholds: Low {zone.threshold_low} | Med {zone.threshold_med} | High {zone.threshold_high}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right', minWidth: 42 }}>
                          <span style={{
                            fontSize: '0.92rem',
                            fontWeight: 800,
                            color: zMetrics.color,
                            fontFamily: 'var(--font-mono)'
                          }}>
                            {zMetrics.count} p
                          </span>
                          <div style={{ fontSize: '0.66rem', fontWeight: 700, color: zMetrics.color }}>
                            {(zMetrics?.tier || 'low').toUpperCase()}
                          </div>
                        </div>

                        {/* Zone Edit Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditZone(zone);
                          }}
                          className="btn-nav-action"
                          style={{
                            padding: '3px 6px',
                            color: '#38bdf8',
                            background: 'var(--blue-subtle)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: 4
                          }}
                          title={`Edit ${zone.name} thresholds & coordinates`}
                        >
                          <Pencil size={12} />
                        </button>

                        {/* Zone Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(zone);
                          }}
                          className="btn-nav-action"
                          style={{
                            padding: '3px 6px',
                            color: 'var(--red-text)',
                            background: 'var(--red-subtle)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 4
                          }}
                          title={`Delete ${zone.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Real-time System Event Log */}
          <div className="cf-card" style={{ padding: 14 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>
              Observation Event Stream
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', fontSize: '0.75rem' }}>
              {liveEvents.length === 0 ? (
                <span style={{ color: 'var(--text-dim)' }}>No events recorded yet.</span>
              ) : (
                liveEvents.map((ev, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--text-body)' }}>
                    <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {new Date(ev.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span style={{
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: ev.severity === 'warning' ? 'var(--amber-text)' : ev.severity === 'critical' ? 'var(--red-text)' : '#38bdf8'
                    }}>
                      [{ev.event_type}]
                    </span>
                    <span style={{ flex: 1 }}>{ev.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SECTION: Connected Camera Matrix & Feeds Gallery                  */}
      {/* ========================================================================= */}
      <div className="connected-cameras-bottom-section" style={{ marginTop: 28 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          background: 'var(--bg-surface)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#ffffff',
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)'
            }}>
              <Camera size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                Connected Camera Feeds & Multi-Feed Matrix
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Live multi-camera view of all mobile phones, webcams, RTSP IP cameras, and video sources. Click any feed to enlarge.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'var(--bg-subtle)',
              color: 'var(--text-body)',
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '5px 12px',
              borderRadius: 9999,
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: cameras.some(c => c.status === 'streaming') ? 'var(--green)' : '#64748b'
              }} />
              {cameras.length} Camera Feed{cameras.length === 1 ? '' : 's'} Active
            </span>

            <button
              className="btn-secondary"
              onClick={fetchMonitoringData}
              title="Refresh camera status & feeds"
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>

            {cameras.some(c => c.status === 'stale' || c.status === 'offline') && (
              <button
                className="btn-secondary"
                onClick={clearOfflineCameras}
                title="Remove stale/offline camera feeds"
                style={{ fontSize: '0.78rem', padding: '6px 10px', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
              >
                <Trash2 size={13} />
                <span>Clear Offline</span>
              </button>
            )}

            {cameras.length > 0 && (
              <button
                className="btn-secondary"
                onClick={() => {
                  if (window.confirm('Are you sure you want to remove all camera feeds?')) {
                    deleteAllCameras();
                  }
                }}
                title="Remove all camera feeds"
                style={{ fontSize: '0.78rem', padding: '6px 10px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              >
                <Trash2 size={13} />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Gallery Grid */}
        {cameras.length === 0 ? (
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '2px dashed var(--border-card)',
            padding: '36px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}>
            <Camera size={40} style={{ opacity: 0.4, margin: '0 auto 12px', color: 'var(--primary)' }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
              No Camera Sources Connected
            </h4>
            <p style={{ fontSize: '0.82rem', maxWidth: 440, margin: '0 auto 16px', color: 'var(--text-body)' }}>
              Connect a mobile phone, enable your desktop webcam, or add an RTSP IP camera to preview live feeds here.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn-primary-glow"
                onClick={openPhoneCameraConnectFlow}
                style={{ fontSize: '0.82rem', padding: '8px 16px' }}
              >
                <Smartphone size={15} />
                <span>Connect Phone Camera</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowWebcamModal(true)}
                style={{ fontSize: '0.82rem', padding: '8px 16px' }}
              >
                <Video size={15} />
                <span>Start Desktop Webcam</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
            gap: 16
          }}>
            {cameras.map(cam => {
              const isStreaming = cam.status === 'streaming';
              const isStale = cam.status === 'stale';
              const isPhone = cam.type === 'phone';
              const isSim = cam.type === 'simulated';
              const isVid = cam.type === 'video_file';
              const isWebcam = cam.type === 'webcam' || cam.id?.includes('webcam');
              const assignedZone = monitoringZones.find(z => z.id === cam.assigned_zone_id);
              const snapshot = cameraSnapshots[cam.id];

              return (
                <div
                  key={cam.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Card Header */}
                  <div style={{
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-subtle)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cam.name}
                      </strong>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isSim ? 'var(--amber-subtle)' : isVid ? 'var(--purple-subtle)' : isPhone ? 'var(--primary-subtle)' : 'var(--blue-subtle)',
                        color: isSim ? 'var(--amber-text)' : isVid ? '#c084fc' : isPhone ? '#fb923c' : '#38bdf8',
                        border: isSim ? '1px solid rgba(245, 158, 11, 0.3)' : isVid ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)'
                      }}>
                        {isSim ? 'SIMULATED' : isVid ? 'VIDEO' : isPhone ? 'MOBILE' : isWebcam ? 'WEBCAM' : (cam.type || 'CAM').toUpperCase()}
                      </span>
                    </div>

                    {/* Status Pill */}
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: isStreaming ? 'var(--green-subtle)' : isStale ? 'var(--amber-subtle)' : 'var(--bg-app)',
                      color: isStreaming ? 'var(--green-text)' : isStale ? 'var(--amber-text)' : 'var(--text-muted)',
                      border: isStreaming ? '1px solid rgba(16, 185, 129, 0.35)' : isStale ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-subtle)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isStreaming ? 'var(--green)' : isStale ? 'var(--amber)' : '#64748b'
                      }} />
                      {(cam.status || 'waiting').toUpperCase()}
                    </span>
                  </div>

                  {/* Live Viewfinder Preview Box (Clickable to Enlarge) */}
                  <div
                    onClick={() => setEnlargedCamera(cam)}
                    style={{
                      position: 'relative',
                      background: '#090d16',
                      aspectRatio: '16/9',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Click to view this camera feed enlarged"
                  >
                    {/* Viewfinder Preview Content */}
                    {isWebcam && isWebcamActive && webcamStream ? (
                      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <video
                          ref={(el) => {
                            if (el && el.srcObject !== webcamStream) {
                              el.srcObject = webcamStream;
                              el.play().catch(() => {});
                            }
                          }}
                          autoPlay
                          playsInline
                          muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : snapshot?.image_base64 ? (
                      <img
                        src={snapshot.image_base64}
                        alt={cam.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : isSim ? (
                      /* Simulated Radar HUD */
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle, #0f172a 0%, #020617 100%)' }}>
                        <Radio size={36} color="#38bdf8" style={{ opacity: 0.8, marginBottom: 6 }} />
                        <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.05em' }}>
                          SYNTHETIC SPATIAL SENSOR
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          Streaming Synthetic Crowd Data
                        </span>
                      </div>
                    ) : (
                      /* Standby Viewfinder Placeholder */
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                        <Camera size={32} style={{ opacity: 0.4, marginBottom: 4 }} />
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                          {isStreaming ? 'Receiving Frames...' : 'Camera In Standby'}
                        </span>
                      </div>
                    )}

                    {/* HUD Corner Brackets */}
                    <div style={{ position: 'absolute', top: 6, left: 6, width: 10, height: 10, borderTop: '2px solid rgba(56, 189, 248, 0.7)', borderLeft: '2px solid rgba(56, 189, 248, 0.7)' }} />
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderTop: '2px solid rgba(56, 189, 248, 0.7)', borderRight: '2px solid rgba(56, 189, 248, 0.7)' }} />
                    <div style={{ position: 'absolute', bottom: 6, left: 6, width: 10, height: 10, borderBottom: '2px solid rgba(56, 189, 248, 0.7)', borderLeft: '2px solid rgba(56, 189, 248, 0.7)' }} />
                    <div style={{ position: 'absolute', bottom: 6, right: 6, width: 10, height: 10, borderBottom: '2px solid rgba(56, 189, 248, 0.7)', borderRight: '2px solid rgba(56, 189, 248, 0.7)' }} />

                    {/* Live Badge Overlay on Feed */}
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      left: 10,
                      background: 'rgba(15, 23, 42, 0.85)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: isStreaming ? '#4ade80' : '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: isStreaming ? '#22c55e' : '#f59e0b' }} />
                      {isStreaming ? 'LIVE REC' : 'STANDBY'}
                    </div>

                    {/* Live Count Pill Overlay */}
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      right: 10,
                      background: 'rgba(2, 132, 199, 0.9)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Users size={11} />
                      <span>{cam.latest_count ?? 0}</span>
                    </div>

                    {/* Hover "Click to Enlarge" banner */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(15, 23, 42, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                    }}
                    className="hover-enlarge-overlay"
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                    >
                      <span style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '6px 14px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        <Maximize2 size={13} /> Click to Enlarge Feed
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom Meta & Actions */}
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {/* Observed Count */}
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Live Detected: </span>
                        <strong style={{ fontSize: '1rem', color: '#0284c7' }}>
                          {cam.latest_count ?? 0}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}> people</span>
                      </div>

                      {/* Zone Assignment Tag */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}>
                        <span style={{ color: 'var(--text-dim)' }}>Zone:</span>
                        <span style={{
                          fontWeight: 700,
                          color: assignedZone?.color || 'var(--text-body)',
                          background: assignedZone ? `${assignedZone.color}20` : 'var(--bg-subtle)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          maxWidth: 130,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {assignedZone?.name || 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        className="btn-primary-glow"
                        onClick={() => setEnlargedCamera(cam)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <Maximize2 size={12} />
                        <span>Enlarge Feed</span>
                      </button>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setSelectedCameraId(selectedCameraId === cam.id ? null : cam.id)}
                          className="btn-nav-action"
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 8px',
                            background: selectedCameraId === cam.id ? 'var(--primary-subtle)' : 'var(--bg-subtle)',
                            color: selectedCameraId === cam.id ? 'var(--primary)' : 'var(--text-body)',
                            border: selectedCameraId === cam.id ? '1px solid var(--primary)' : '1px solid var(--border-subtle)'
                          }}
                          title="Adjust Optics on Blueprint"
                        >
                          <Sliders size={12} />
                          <span>Optics</span>
                        </button>

                        <button
                          onClick={() => handleDeleteCamera(cam.id)}
                          className="btn-nav-action"
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 6px',
                            color: 'var(--red-text)',
                            background: 'var(--red-subtle)',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}
                          title={`Disconnect / Delete ${cam.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Enlarged Camera Viewer                                            */}
      {/* ========================================================================= */}
      {enlargedCamera && (
        <div className="cf-modal-overlay" onClick={() => setEnlargedCamera(null)}>
          <div
            className="cf-modal-content"
            style={{ maxWidth: 880, width: '95vw', padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Camera size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      {enlargedCamera.name}
                    </h3>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: '#e0f2fe',
                      color: '#0369a1'
                    }}>
                      {(enlargedCamera.type || 'camera').toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    ID: {enlargedCamera.id} &bull; Stream Status: {(enlargedCamera.status || 'connected').toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn-close"
                  onClick={() => setEnlargedCamera(null)}
                  title="Close Enlarged View"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Main Enlarged Video / Feed Canvas */}
            <div style={{
              background: '#020617',
              borderRadius: 8,
              aspectRatio: '16/9',
              maxHeight: '62vh',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              marginBottom: 16
            }}>
              {/* Feed Content */}
              {(enlargedCamera.type === 'webcam' || enlargedCamera.id?.includes('webcam')) && isWebcamActive && webcamStream ? (
                <video
                  ref={(el) => {
                    enlargedWebcamVideoRef.current = el;
                    if (el && el.srcObject !== webcamStream) {
                      el.srcObject = webcamStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : cameraSnapshots[enlargedCamera.id]?.image_base64 ? (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <img
                    src={cameraSnapshots[enlargedCamera.id].image_base64}
                    alt={enlargedCamera.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : enlargedCamera.type === 'simulated' ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle, #0f172a 0%, #020617 100%)' }}>
                  <Radio size={54} color="#38bdf8" style={{ opacity: 0.85, marginBottom: 10 }} />
                  <span style={{ fontSize: '1rem', color: '#38bdf8', fontWeight: 800, letterSpacing: '0.06em' }}>
                    SIMULATED SENSOR HUD &bull; {enlargedCamera.latest_count ?? 0} PEOPLE
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                    Synthesized crowd observations injected into live digital twin
                  </span>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <Camera size={48} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
                    Awaiting next camera frame stream...
                  </p>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    (Check that the mobile phone or webcam is active)
                  </span>
                </div>
              )}

              {/* Viewfinder HUD Overlays */}
              <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: enlargedCamera.status === 'streaming' ? '#4ade80' : '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: enlargedCamera.status === 'streaming' ? '#22c55e' : '#f59e0b' }} />
                  {enlargedCamera.status === 'streaming' ? '● LIVE STREAM' : '● CONNECTED'}
                </span>

                <span style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#94a3b8',
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontFamily: 'monospace'
                }}>
                  {new Date().toLocaleTimeString()}
                </span>
              </div>

              {/* Top-Right Count Badge */}
              <div style={{
                position: 'absolute',
                top: 12,
                right: 14,
                background: 'rgba(2, 132, 199, 0.95)',
                boxShadow: '0 2px 10px rgba(2, 132, 199, 0.5)',
                padding: '5px 14px',
                borderRadius: 6,
                fontSize: '0.92rem',
                fontWeight: 800,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Users size={16} />
                <span>{enlargedCamera.latest_count ?? 0} People Detected</span>
              </div>

              {/* Bottom HUD Bar */}
              <div style={{
                position: 'absolute',
                bottom: 10,
                left: 14,
                right: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.72rem',
                color: '#94a3b8',
                background: 'rgba(15, 23, 42, 0.75)',
                padding: '4px 10px',
                borderRadius: 4
              }}>
                <div>
                  Model: <strong style={{ color: '#38bdf8' }}>YOLOv8n Object Detector</strong> &bull; Class: Person (0)
                </div>
                <div>
                  FOV: {enlargedCamera.fov_angle || 45}&deg; &bull; Range: {enlargedCamera.fov_depth || 80}px &bull; {getHeadingLabel(enlargedCamera.fov_rotation || 45)}
                </div>
              </div>
            </div>

            {/* Bottom Controls & Assignment Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
              background: '#f8fafc',
              padding: 14,
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}>
              {/* Zone Assignment Controls */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Assigned Spatial Monitoring Zone
                </label>
                <select
                  value={enlargedCamera.assigned_zone_id || ''}
                  onChange={async (e) => {
                    const newZId = e.target.value || null;
                    const updated = { ...enlargedCamera, assigned_zone_id: newZId };
                    await updateCamera(updated);
                    setEnlargedCamera(updated);
                    addNotification(`Reassigned camera '${enlargedCamera.name}' to zone.`, 'success');
                  }}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                >
                  <option value="">-- Unassigned (Not Mapped to Zone) --</option>
                  {monitoringZones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>

              {/* Optics Quick Controls */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Camera FOV Beam Angle: {enlargedCamera.fov_angle || 45}&deg;
                </label>
                <input
                  type="range"
                  min="20"
                  max="120"
                  value={enlargedCamera.fov_angle || 45}
                  onChange={async (e) => {
                    const angle = parseInt(e.target.value, 10);
                    const updated = { ...enlargedCamera, fov_angle: angle };
                    setEnlargedCamera(updated);
                    await updateCamera(updated);
                  }}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8 }}>
                {enlargedCamera.type === 'phone' && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setActivePhoneSession({
                        session_token: enlargedCamera.session_token,
                        camera_name: enlargedCamera.name,
                        mobile_url: `https://${window.location.hostname}:3000/mobile-camera.html?session=${enlargedCamera.session_token}&theme=${theme || 'chrome-light'}`,
                        qr_code: null
                      });
                      setShowPhoneModal(true);
                    }}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    <Smartphone size={14} />
                    <span>Show Phone QR</span>
                  </button>
                )}

                <button
                  className="btn-secondary"
                  onClick={async () => {
                    const idToDelete = enlargedCamera.id;
                    await handleDeleteCamera(idToDelete);
                  }}
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 14px',
                    color: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  title={`Delete ${enlargedCamera.name}`}
                >
                  <Trash2 size={14} />
                  <span>Delete Camera</span>
                </button>

                <button
                  className="btn-primary-glow"
                  onClick={() => setEnlargedCamera(null)}
                  style={{ fontSize: '0.8rem', padding: '6px 18px' }}
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 1: Connect Phone Camera --- */}
      {showPhoneModal && activePhoneSession && (
        <div className="cf-modal-overlay">
          <div className="cf-modal-content" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={20} className="text-blue" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Connect Phone as Camera</h3>
              </div>
              <button className="btn-close" onClick={() => setShowPhoneModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Open this link on any mobile phone on the same Wi-Fi network. The phone will stream video frames directly to the local YOLOv8n detector.
            </p>

            {/* Auto-redirect Alert Banner when phone connects */}
            {phoneConnectSuccess && (
              <div style={{
                background: '#ecfdf5',
                border: '1.5px solid #10b981',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: '#065f46',
                marginBottom: 14,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
              }}>
                <CheckCircle2 size={24} style={{ color: '#10b981', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '0.92rem', color: '#047857', display: 'block' }}>
                    Phone Connected & Streaming Live!
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: '#065f46' }}>
                    Detected: <strong style={{ color: '#047857' }}>{cameras.find(c => c.id === activePhoneSession.camera_id || c.session_token === activePhoneSession.session_token)?.latest_count ?? 0} people</strong>. Auto-redirecting to live blueprint view...
                  </span>
                </div>
              </div>
            )}

            {/* QR Code Container */}
            <div style={{ textAlign: 'center', padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
              {activePhoneSession.qr_code ? (
                <img
                  src={activePhoneSession.qr_code}
                  alt="Phone Camera QR Code"
                  style={{ width: 190, height: 190, margin: '0 auto', display: 'block', borderRadius: 6 }}
                />
              ) : (
                <div style={{ padding: 30, color: '#64748b' }}>QR Code Generating...</div>
              )}
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6, display: 'block' }}>
                Scan with your phone's default Camera app
              </span>
            </div>

            {/* URL Display with Copy Button */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="text"
                readOnly
                value={activePhoneSession.mobile_url}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.78rem',
                  fontFamily: 'monospace'
                }}
              />
              <button
                className="btn-secondary"
                onClick={handleCopyLink}
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                {copySuccess ? <CheckCircle2 size={14} className="text-green" /> : <Copy size={14} />}
                <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
              </button>
              <a
                href={activePhoneSession.mobile_url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 10px', display: 'flex', alignItems: 'center' }}
                title="Open mobile URL"
              >
                <ExternalLink size={14} />
              </a>
            </div>

            {/* Test on this device / Open in new tab button */}
            <div style={{ marginBottom: 14 }}>
              <a
                href={`${window.location.origin}/mobile-camera.html?session=${activePhoneSession.session_token}&theme=${theme || 'chrome-light'}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary-glow"
                style={{
                  fontSize: '0.82rem',
                  padding: '9px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  textDecoration: 'none',
                  borderRadius: 6
                }}
              >
                <ExternalLink size={15} />
                <span>Open Camera in New Tab (Test on this Device)</span>
              </a>
            </div>

            {/* Instructions */}
            <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '10px 12px', fontSize: '0.78rem', color: '#475569', marginBottom: 14 }}>
              <strong>Setup Steps on Phone:</strong>
              <ol style={{ paddingLeft: 18, marginTop: 4 }}>
                <li>Ensure phone is connected to the same Wi-Fi network.</li>
                <li>Tap link / scan QR code in Safari or Chrome.</li>
                <li>Tap <strong>Start Camera</strong> and allow browser camera permission.</li>
                <li>Observations will update on this screen instantly!</li>
              </ol>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary-glow" onClick={() => setShowPhoneModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Add / Edit Zone --- */}
      {showZoneModal && (
        <div className="cf-modal-overlay">
          <div className="cf-modal-content" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: newZoneForm.color || '#3b82f6'
                }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  {editingZoneId ? 'Edit Spatial Monitoring Zone' : 'Add Spatial Monitoring Zone'}
                </h3>
              </div>
              <button className="btn-close" onClick={() => { setShowZoneModal(false); setEditingZoneId(null); }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 12 }}>
              Define the spatial boundaries and crowd density classification thresholds on the blueprint.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Zone Name / Area Label</label>
                <input
                  type="text"
                  value={newZoneForm.name}
                  onChange={(e) => setNewZoneForm({ ...newZoneForm, name: e.target.value })}
                  placeholder="e.g. Main Entrance Gate Area, Food Court, Exhibition Concourse"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              {/* Thresholds Matrix */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                  Crowd Density Thresholds (People Count)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, display: 'block', marginBottom: 2 }}>
                      LOW (&le;)
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={newZoneForm.threshold_low}
                      onChange={(e) => setNewZoneForm({ ...newZoneForm, threshold_low: e.target.value })}
                      style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, display: 'block', marginBottom: 2 }}>
                      MED (&le;)
                    </span>
                    <input
                      type="number"
                      min="2"
                      value={newZoneForm.threshold_med}
                      onChange={(e) => setNewZoneForm({ ...newZoneForm, threshold_med: e.target.value })}
                      style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: 700, display: 'block', marginBottom: 2 }}>
                      HIGH (&le;)
                    </span>
                    <input
                      type="number"
                      min="3"
                      value={newZoneForm.threshold_high}
                      onChange={(e) => setNewZoneForm({ ...newZoneForm, threshold_high: e.target.value })}
                      style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, display: 'block', marginBottom: 2 }}>
                      CRITICAL (&gt;)
                    </span>
                    <input
                      type="number"
                      min="4"
                      value={newZoneForm.threshold_crit}
                      onChange={(e) => setNewZoneForm({ ...newZoneForm, threshold_crit: e.target.value })}
                      style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Spatial Coordinates on Blueprint */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                  Blueprint Spatial Bounds (px)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: 2 }}>X (px)</span>
                    <input
                      type="number"
                      value={newZoneForm.x}
                      onChange={(e) => setNewZoneForm({ ...newZoneForm, x: e.target.value })}
                      style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: 2 }}>Y (px)</span>
                    <input
                      type="number"
                      value={newZoneForm.y}
                      onChange={(e) => setNewZoneForm({ ...newZoneForm, y: e.target.value })}
                      style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: 2 }}>Width (px)</span>
                    <input
                      type="number"
                      value={newZoneForm.w}
                      onChange={(e) => setNewZoneForm({ ...newZoneForm, w: e.target.value })}
                      style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: 2 }}>Height (px)</span>
                    <input
                      type="number"
                      value={newZoneForm.h}
                      onChange={(e) => setNewZoneForm({ ...newZoneForm, h: e.target.value })}
                      style={{ width: '100%', padding: '5px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>Multi-Camera Aggregation Policy</label>
                <select
                  value={newZoneForm.aggregation_policy}
                  onChange={(e) => setNewZoneForm({ ...newZoneForm, aggregation_policy: e.target.value })}
                  style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                >
                  <option value="MAX">MAX (Recommended: Take maximum count to prevent double counting)</option>
                  <option value="SUM">SUM (Add counts across cameras if angles are non-overlapping)</option>
                  <option value="AVG">AVG (Average counts across cameras)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => { setShowZoneModal(false); setEditingZoneId(null); }}>
                Cancel
              </button>
              <button
                className="btn-primary-glow"
                onClick={handleSaveZone}
              >
                {editingZoneId ? 'Save Changes' : 'Create Zone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Desktop Webcam --- */}
      {showWebcamModal && (
        <div className="cf-modal-overlay">
          <div className="cf-modal-content" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Desktop Webcam Stream</h3>
              <button className="btn-close" onClick={() => setShowWebcamModal(false)} title="Close modal (keeps streaming)">
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#020617', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', marginBottom: 12, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isWebcamActive && webcamStream ? (
                <>
                  <video
                    ref={(el) => {
                      if (el && webcamStream && el.srcObject !== webcamStream) {
                        el.srcObject = webcamStream;
                        el.play().catch(() => {});
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    autoPlay
                    playsInline
                    muted
                  />
                  <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(15, 23, 42, 0.85)', padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                    Observed: {webcamCount} People
                  </div>
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(22, 163, 74, 0.85)', padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff' }} />
                    LIVE
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <Camera size={40} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>Webcam is ready to connect</p>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Click "Start Webcam" below to begin live edge AI detection</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              {!isWebcamActive ? (
                <button className="btn-primary-glow" onClick={handleStartWebcam}>
                  <Camera size={15} />
                  <span>Start Webcam</span>
                </button>
              ) : (
                <button className="btn-secondary" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={handleStopWebcam}>
                  <span>Stop Webcam</span>
                </button>
              )}
              <button className="btn-secondary" onClick={() => setShowWebcamModal(false)}>
                {isWebcamActive ? 'Minimize (Keep Streaming)' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Video File Upload --- */}
      {showVideoModal && (
        <div className="cf-modal-overlay">
          <div className="cf-modal-content" style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Upload Video Demonstration</h3>
              <button className="btn-close" onClick={() => setShowVideoModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 14 }}>
              Upload an MP4 or WebM video file. The backend will process frames through the YOLO model and label observations clearly as <strong>VIDEO FILE</strong>.
            </p>

            <input
              type="file"
              accept="video/mp4,video/webm"
              onChange={handleUploadVideo}
              style={{ display: 'block', width: '100%', padding: '10px', border: '1px dashed #cbd5e1', borderRadius: 8, marginBottom: 14 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowVideoModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: RTSP Stream Form --- */}
      {showRtspModal && (
        <div className="cf-modal-overlay">
          <div className="cf-modal-content" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Connect RTSP / IP Camera</h3>
              <button className="btn-close" onClick={() => setShowRtspModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>Camera Name</label>
                <input
                  type="text"
                  value={rtspForm.name}
                  onChange={(e) => setRtspForm({ ...rtspForm, name: e.target.value })}
                  style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>RTSP Stream URL</label>
                <input
                  type="text"
                  placeholder="rtsp://admin:password@192.168.1.50:554/stream1"
                  value={rtspForm.rtsp_url}
                  onChange={(e) => setRtspForm({ ...rtspForm, rtsp_url: e.target.value })}
                  style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Credentials are processed securely on the backend server and never exposed in browser logs.</span>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>Assigned Zone</label>
                <select
                  value={rtspForm.assigned_zone_id}
                  onChange={(e) => setRtspForm({ ...rtspForm, assigned_zone_id: e.target.value })}
                  style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Unassigned --</option>
                  {monitoringZones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setShowRtspModal(false)}>Cancel</button>
              <button
                className="btn-primary-glow"
                onClick={async () => {
                  const camId = `cam_rtsp_${Date.now()}`;
                  await updateCamera({
                    id: camId,
                    venue_id: 'default',
                    name: rtspForm.name,
                    type: 'rtsp',
                    assigned_zone_id: rtspForm.assigned_zone_id || null,
                    status: 'connected',
                    rtsp_url: rtspForm.rtsp_url,
                    marker_x: 250,
                    marker_y: 220
                  });
                  // Start stream
                  await fetch(`/api/cameras/${camId}/rtsp-start`, { method: 'POST' });
                  addNotification(`RTSP camera '${rtspForm.name}' configured. Initializing worker...`, 'info');
                  setShowRtspModal(false);
                  fetchMonitoringData();
                }}
              >
                Connect Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 6: Simulated Data Injection --- */}
      {showSimModal && (
        <div className="cf-modal-overlay">
          <div className="cf-modal-content" style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Inject Simulated Observation</h3>
              <button className="btn-close" onClick={() => setShowSimModal(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 12 }}>
              For stress-testing dashboards without physical hardware. Observations will be clearly tagged as <strong>SIMULATED DATA</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>Target Camera ID</label>
                <input
                  type="text"
                  value={simForm.cameraId}
                  onChange={(e) => setSimForm({ ...simForm, cameraId: e.target.value })}
                  style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 2 }}>People Count</label>
                <input
                  type="number"
                  value={simForm.count}
                  onChange={(e) => setSimForm({ ...simForm, count: e.target.value })}
                  style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button className="btn-secondary" onClick={() => setShowSimModal(false)}>Cancel</button>
              <button className="btn-primary-glow" onClick={handleInjectSimulated}>Inject</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
