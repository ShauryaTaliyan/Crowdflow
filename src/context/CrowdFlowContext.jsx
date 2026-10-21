/**
 * CrowdFlow Shared Application Context
 * 
 * Provides unified state for all 6 core sections:
 * - Venue Layout & Blueprint Reference
 * - Navigation Flow Fields
 * - Active Simulation Instance & Real-Time Loop
 * - Live Analytics & Metric Aggregation
 * - Rule-Based Recommendations
 * - Scenario Snapshots & Comparative Analytics
 * - LocalStorage Persistence & JSON Import/Export
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { VENUE_PRESETS, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/presets';
import { buildNavigationGrid } from '../engine/navigation';
import { SimulationEngine } from '../engine/simulation';
import { analyzeSimulationAndGenerateRecommendations } from '../engine/rulesEngine';
import { detectBlueprintCandidates, digitalizeBlueprintToLayout } from '../engine/cvDetector';

const CrowdFlowContext = createContext(null);

const STORAGE_KEY_LAYOUT = 'crowdflow_active_layout_v2';
const STORAGE_KEY_SETTINGS = 'crowdflow_sim_settings_v2';
const STORAGE_KEY_BASELINE = 'crowdflow_baseline_scenario_v2';
const STORAGE_KEY_THEME = 'crowdflow_theme_preference_v1';

export const CHROME_THEMES = [
  {
    id: 'chrome-light',
    name: 'Chrome Minimal Light',
    shortName: 'Chrome Light',
    tagline: 'Clean Google Chrome Minimalist Light Theme (Default)',
    accent: '#1a73e8',
    previewBg: '#f1f3f4',
    previewSurface: '#ffffff',
    previewBorder: '#dadce0',
  },
  {
    id: 'chrome-dark-titanium',
    name: 'Dark Liquid Chrome & Brushed Titanium',
    shortName: 'Dark Titanium',
    tagline: 'Futuristic Gunmetal Titanium & Specular Highlights',
    accent: '#38bdf8',
    previewBg: '#090c12',
    previewSurface: '#101520',
    previewBorder: '#27344c',
  },
  {
    id: 'chrome-silver',
    name: 'Polished Silver & Reflective Chrome',
    shortName: 'Silver Chrome',
    tagline: 'High-Gloss Liquid Metal & Polished Chrome Reflections',
    accent: '#0284c7',
    previewBg: '#cfd5e1',
    previewSurface: '#f8fafc',
    previewBorder: '#94a3b8',
  }
];

export function CrowdFlowProvider({ children }) {
  // Chrome Theme Management (Default: 'chrome-light')
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved && ['chrome-light', 'chrome-dark-titanium', 'chrome-silver'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      console.warn('Failed to load theme preference', e);
    }
    return 'chrome-light';
  });

  const setTheme = useCallback((newTheme) => {
    if (!['chrome-light', 'chrome-dark-titanium', 'chrome-silver'].includes(newTheme)) return;
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, newTheme);
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const cycleTheme = useCallback(() => {
    const themeOrder = ['chrome-light', 'chrome-dark-titanium', 'chrome-silver'];
    const nextIdx = (themeOrder.indexOf(theme) + 1) % themeOrder.length;
    setTheme(themeOrder[nextIdx]);
  }, [theme, setTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Navigation Section
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, layout, simulation, analytics, comparison, recommendations

  // Active Venue Layout (Default to Exhibition Hall A)
  const [currentPresetKey, setCurrentPresetKey] = useState('exhibition');
  const [venue, setVenue] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAYOUT);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved layout from localStorage', e);
    }
    return JSON.parse(JSON.stringify(VENUE_PRESETS.exhibition));
  });

  // Blueprint Reference Layer
  const [blueprint, setBlueprint] = useState({
    imageSrc: null,
    fileName: null,
    opacity: 0.65,
    show: true,
  });

  // CV Detected Candidates
  const [candidateSuggestions, setCandidateSuggestions] = useState([]);
  const [isScanningBlueprint, setIsScanningBlueprint] = useState(false);
  const [selectedEditorObj, setSelectedEditorObj] = useState(null);

  // Simulation Parameters
  const [simSettings, setSimSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved settings from localStorage', e);
    }
    return {
      targetCrowdSize: 150,
      crowdSize: 150,
      walkingSpeedMultiplier: 1.0,
      simClockRate: 1,
      maxDurationSeconds: 0,
      showHeatmap: true,
      showBottlenecks: true,
      showFlowVectors: false,
      showTrails: true,
      showBlueprint: true,
      isLiveTwinMode: true,
      isDemoSimulation: false,
      showCameraViews: true,
    };
  });

  // Simulation Runtime State
  const [simStatus, setSimStatus] = useState('ready'); // ready, running, paused, completed
  const [metrics, setMetrics] = useState({
    elapsedTime: 0,
    activePedestrians: 0,
    totalExited: 0,
    unreachableCount: 0,
    avgJourneyTime: 0,
    throughputRate: 0,
    avgDensity: 0,
    peakDensity: 0,
    activeHotspotsCount: 0,
    timeSeriesHistory: [],
  });

  // Scenario Comparison
  const [baselineScenario, setBaselineScenario] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BASELINE);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved baseline from localStorage', e);
    }
    return null;
  });

  // System Notification Toast / Logs (empty initially, auto-dismisses after 4.5s)
  const [notifications, setNotifications] = useState([]);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((text, type = 'info') => {
    const id = Date.now() + Math.random();
    const item = {
      id,
      text,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setNotifications(prev => [item, ...prev].slice(0, 10));

    // Auto-dismiss toast
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  }, []);

  // --- Live Camera Monitoring State ---
  const [monitoringZones, setMonitoringZones] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [occupancy, setOccupancy] = useState({
    total_estimated_occupancy: 0,
    zones: {},
    overlap_warnings: [],
  });
  const [liveEvents, setLiveEvents] = useState([]);
  const [historyObservations, setHistoryObservations] = useState([]);
  const [activePhoneSession, setActivePhoneSession] = useState(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const [zRes, cRes, oRes, eRes, hRes] = await Promise.all([
        fetch('/api/zones'),
        fetch('/api/cameras'),
        fetch('/api/occupancy'),
        fetch('/api/events'),
        fetch('/api/observations/history')
      ]);
      if (zRes.ok) setMonitoringZones(await zRes.json());
      if (cRes.ok) setCameras(await cRes.json());
      if (oRes.ok) setOccupancy(await oRes.json());
      if (eRes.ok) setLiveEvents(await eRes.json());
      if (hRes.ok) setHistoryObservations(await hRes.json());
      setIsBackendConnected(true);
    } catch (e) {
      console.warn('Live monitoring backend not yet connected or initializing', e);
      setIsBackendConnected(false);
    }
  }, []);

  // High-Performance Live Monitoring Sync: 800ms Fast Polling + Instant WebSocket Push
  useEffect(() => {
    fetchMonitoringData();

    // Fast 800ms polling guarantees desktop PC screen updates immediately
    // even if browser TLS proxy or local network buffers WebSockets!
    const pollInterval = setInterval(fetchMonitoringData, 800);

    let ws = null;
    let reconnectTimer = null;

    const connectLiveWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsBackendConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SNAPSHOT') {
            if (data.cameras) setCameras(data.cameras);
            if (data.occupancy) setOccupancy(data.occupancy);
            if (data.events) setLiveEvents(data.events);
          }
        } catch (err) {
          console.warn('Error parsing live WS message', err);
        }
      };

      ws.onclose = () => {
        setIsBackendConnected(false);
        reconnectTimer = setTimeout(connectLiveWS, 2500);
      };

      ws.onerror = () => {
        setIsBackendConnected(false);
      };
    };

    connectLiveWS();

    return () => {
      clearInterval(pollInterval);
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [fetchMonitoringData]);

  // Phone Camera Session
  const createPhoneCameraSession = useCallback(async (zoneId = null, cameraName = null) => {
    try {
      const res = await fetch('/api/cameras/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: 'default',
          camera_name: cameraName,
          assigned_zone_id: zoneId,
          client_host: window.location.hostname,
          theme: theme
        })
      });
      if (!res.ok) throw new Error('Failed to create session on server');
      const data = await res.json();
      setActivePhoneSession(data);
      addNotification(`Created mobile camera session. Scan QR code or open link on phone.`, 'success');
      fetchMonitoringData();
      return data;
    } catch (err) {
      addNotification(`Failed to create phone camera session: ${err.message}`, 'error');
      return null;
    }
  }, [venue.id, theme, addNotification, fetchMonitoringData]);

  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const openPhoneCameraConnectFlow = useCallback(async (zoneId = null) => {
    setActiveTab('monitoring');
    const targetZone = zoneId || (monitoringZones && monitoringZones[0]?.id) || null;
    const session = await createPhoneCameraSession(targetZone);
    if (session) {
      setActivePhoneSession(session);
      setShowPhoneModal(true);
    }
  }, [setActiveTab, monitoringZones, createPhoneCameraSession]);

  const addMonitoringZone = useCallback(async (zoneData) => {
    try {
      const res = await fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoneData)
      });
      if (res.ok) {
        const saved = await res.json();
        setMonitoringZones(prev => [...prev.filter(z => z.id !== saved.id), saved]);
        addNotification(`Saved monitoring zone "${saved.name}".`, 'success');
        fetchMonitoringData();
      }
    } catch (err) {
      addNotification(`Error saving monitoring zone: ${err.message}`, 'error');
    }
  }, [addNotification, fetchMonitoringData]);

  const deleteMonitoringZone = useCallback(async (zoneId) => {
    try {
      await fetch(`/api/zones/${zoneId}`, { method: 'DELETE' });
      setMonitoringZones(prev => prev.filter(z => z.id !== zoneId));
      addNotification(`Deleted monitoring zone (${zoneId}).`, 'info');
      fetchMonitoringData();
    } catch (err) {
      addNotification(`Error deleting zone: ${err.message}`, 'error');
    }
  }, [addNotification, fetchMonitoringData]);

  const updateCamera = useCallback(async (cameraData) => {
    try {
      const res = await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cameraData)
      });
      if (res.ok) {
        fetchMonitoringData();
      }
    } catch (err) {
      console.warn('Error updating camera', err);
    }
  }, [fetchMonitoringData]);

  // --- Persistent Desktop Webcam Integration ---
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [webcamCount, setWebcamCount] = useState(0);
  const webcamStreamRef = useRef(null);
  const persistentWebcamVideoRef = useRef(null);
  const webcamTimerRef = useRef(null);
  const isWebcamDetectingRef = useRef(false);

  const stopDesktopWebcam = useCallback(async () => {
    if (webcamTimerRef.current) {
      clearInterval(webcamTimerRef.current);
      webcamTimerRef.current = null;
    }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    }
    if (persistentWebcamVideoRef.current) {
      persistentWebcamVideoRef.current.srcObject = null;
    }
    setWebcamStream(null);
    setIsWebcamActive(false);
    isWebcamDetectingRef.current = false;

    try {
      await updateCamera({
        id: 'cam_desktop_webcam',
        venue_id: 'default',
        name: 'Built-in Desktop Webcam',
        type: 'webcam',
        status: 'disconnected'
      });
      fetchMonitoringData();
    } catch (e) {
      // ignore
    }

    addNotification('Desktop webcam stopped.', 'info');
  }, [updateCamera, fetchMonitoringData, addNotification]);

  const startDesktopWebcam = useCallback(async (zoneId = null) => {
    try {
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (webcamTimerRef.current) {
        clearInterval(webcamTimerRef.current);
        webcamTimerRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false
      });

      webcamStreamRef.current = stream;
      setWebcamStream(stream);
      setIsWebcamActive(true);

      if (persistentWebcamVideoRef.current) {
        persistentWebcamVideoRef.current.srcObject = stream;
        try {
          await persistentWebcamVideoRef.current.play();
        } catch (playErr) {
          console.warn('Persistent video play failed', playErr);
        }
      }

      // Handle track ended by browser/user
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          console.warn('Webcam track ended by browser or hardware');
          stopDesktopWebcam();
        };
      });

      // Register or update single stable webcam record in backend
      const assignedZone = zoneId || (monitoringZones && monitoringZones[0]?.id) || null;
      await updateCamera({
        id: 'cam_desktop_webcam',
        venue_id: 'default',
        name: 'Built-in Desktop Webcam',
        type: 'webcam',
        assigned_zone_id: assignedZone,
        status: 'streaming',
        marker_x: 220,
        marker_y: 200,
        fov_angle: 55,
        fov_depth: 90,
        fov_rotation: 45
      });

      // Offscreen canvas for frame capture
      const offCanvas = document.createElement('canvas');
      const offCtx = offCanvas.getContext('2d');
      offCanvas.width = 480;
      offCanvas.height = 360;

      const captureFrame = async () => {
        const vid = persistentWebcamVideoRef.current;
        if (!vid || !vid.videoWidth || !vid.videoHeight || isWebcamDetectingRef.current) return;

        isWebcamDetectingRef.current = true;
        try {
          offCtx.drawImage(vid, 0, 0, 480, 360);
          const dataUrl = offCanvas.toDataURL('image/jpeg', 0.65);

          const res = await fetch('/api/cameras/cam_desktop_webcam/detect-frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_base64: dataUrl, source_type: 'webcam' })
          });

          if (res.ok) {
            const data = await res.json();
            setWebcamCount(data.people_count);
          }
        } catch (err) {
          console.warn('Webcam frame detection warning', err);
        } finally {
          isWebcamDetectingRef.current = false;
        }
      };

      // Run inference loop at a steady, concurrency-safe 380ms cadence (~2.6 FPS)
      webcamTimerRef.current = setInterval(captureFrame, 380);
      addNotification('Desktop webcam connected and streaming observations.', 'success');
      fetchMonitoringData();
      return true;
    } catch (err) {
      console.error('Webcam start failed:', err);
      addNotification(`Webcam permission denied or unavailable: ${err.message}`, 'error');
      setIsWebcamActive(false);
      return false;
    }
  }, [monitoringZones, updateCamera, stopDesktopWebcam, addNotification, fetchMonitoringData]);

  // Clean up webcam stream on provider unmount
  useEffect(() => {
    return () => {
      if (webcamTimerRef.current) clearInterval(webcamTimerRef.current);
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const deleteCamera = useCallback(async (cameraId) => {
    try {
      if (cameraId === 'cam_desktop_webcam' || (isWebcamActive && cameraId.includes('webcam'))) {
        stopDesktopWebcam();
      }
      const res = await fetch(`/api/cameras/${cameraId}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Server returned error ${res.status}`);
      }
      setCameras(prev => prev.filter(c => c.id !== cameraId));
      if (activePhoneSession?.camera_id === cameraId) {
        setActivePhoneSession(null);
      }
      addNotification(`Deleted camera (${cameraId}).`, 'info');
      fetchMonitoringData();
    } catch (err) {
      addNotification(`Error deleting camera: ${err.message}`, 'error');
    }
  }, [isWebcamActive, stopDesktopWebcam, activePhoneSession, addNotification, fetchMonitoringData]);

  const clearOfflineCameras = useCallback(async () => {
    try {
      const offline = cameras.filter(c => c.status === 'disconnected' || c.status === 'stale' || c.status === 'error' || c.status === 'waiting');
      if (offline.length === 0) {
        addNotification('No offline cameras to remove.', 'info');
        return;
      }
      for (const cam of offline) {
        await fetch(`/api/cameras/${cam.id}`, { method: 'DELETE' });
      }
      setCameras(prev => prev.filter(c => c.status === 'streaming'));
      addNotification(`Cleared ${offline.length} offline cameras.`, 'success');
      fetchMonitoringData();
    } catch (err) {
      addNotification(`Error clearing cameras: ${err.message}`, 'error');
    }
  }, [cameras, addNotification, fetchMonitoringData]);

  const deleteAllCameras = useCallback(async () => {
    try {
      if (isWebcamActive) {
        stopDesktopWebcam();
      }
      await fetch('/api/cameras', { method: 'DELETE' });
      setCameras([]);
      setActivePhoneSession(null);
      addNotification(`All cameras successfully deleted.`, 'success');
      fetchMonitoringData();
    } catch (err) {
      addNotification(`Error deleting all cameras: ${err.message}`, 'error');
    }
  }, [isWebcamActive, stopDesktopWebcam, addNotification, fetchMonitoringData]);

  const injectSimulatedObservation = useCallback(async (cameraId, count) => {
    try {
      await fetch('/api/simulated-observation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera_id: cameraId, people_count: count })
      });
      fetchMonitoringData();
      addNotification(`Injected simulated observation for camera (${cameraId}): ${count} people.`, 'info');
    } catch (err) {
      console.warn('Error injecting simulated observation', err);
    }
  }, [addNotification, fetchMonitoringData]);

  // Engine references
  const navEngineRef = useRef(null);
  const simEngineRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const lastMetricsSyncRef = useRef(0);

  // 1. Rebuild Navigation Engine when Venue changes
  const rebuildNavigation = useCallback((venueData) => {
    const nav = buildNavigationGrid(venueData);
    navEngineRef.current = nav;

    if (simEngineRef.current) {
      simEngineRef.current.updateVenueAndNav(venueData, nav);
    } else {
      simEngineRef.current = new SimulationEngine(venueData, nav, simSettings);
    }

    // Update initial metrics snapshot
    if (simEngineRef.current) {
      setMetrics(simEngineRef.current.getMetrics());
    }

    return nav;
  }, [simSettings]);

  // Initial build
  useEffect(() => {
    rebuildNavigation(venue);
  }, [rebuildNavigation, venue]);

  // Save venue to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(venue));
    } catch (e) {
      console.warn('Failed to persist venue to localStorage', e);
    }
  }, [venue]);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(simSettings));
    } catch (e) {
      console.warn('Failed to persist settings to localStorage', e);
    }
  }, [simSettings]);

  // Save baseline to localStorage
  useEffect(() => {
    try {
      if (baselineScenario) {
        localStorage.setItem(STORAGE_KEY_BASELINE, JSON.stringify(baselineScenario));
      } else {
        localStorage.removeItem(STORAGE_KEY_BASELINE);
      }
    } catch (e) {
      console.warn('Failed to persist baseline to localStorage', e);
    }
  }, [baselineScenario]);

  // 2. Main Simulation Animation Loop
  const runSimulationLoop = useCallback((timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaSec = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    if (simEngineRef.current && simStatus === 'running') {
      simEngineRef.current.update(deltaSec);

      // Check auto-stop condition if maxDuration configured
      if (
        simSettings.maxDurationSeconds > 0 &&
        simEngineRef.current.elapsedSimSeconds >= simSettings.maxDurationSeconds
      ) {
        setSimStatus('completed');
        addNotification(`Simulation completed reached duration limit (${simSettings.maxDurationSeconds}s)`, 'success');
        return;
      }

      // Sync metrics to state with 120ms throttling to eliminate high-frequency React re-render thrashing
      if (!lastMetricsSyncRef.current || timestamp - lastMetricsSyncRef.current >= 120) {
        lastMetricsSyncRef.current = timestamp;
        setMetrics(simEngineRef.current.getMetrics());
      }

      animationFrameRef.current = requestAnimationFrame(runSimulationLoop);
    }
  }, [simStatus, simSettings.maxDurationSeconds, addNotification]);

  // Handle Playback State Transitions
  useEffect(() => {
    if (simStatus === 'running') {
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(runSimulationLoop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [simStatus, runSimulationLoop]);

  // Sync sim settings and live camera observations to simEngine
  useEffect(() => {
    if (simEngineRef.current) {
      const liveCount = occupancy?.total_estimated_occupancy || 0;
      const isDemo = simSettings.isDemoSimulation === true;
      simEngineRef.current.setParameters({
        ...simSettings,
        targetCrowdSize: simSettings.crowdSize || 80,
        walkingSpeedMultiplier: simSettings.walkingSpeedMultiplier || 1.0,
        simClockRate: simSettings.simClockRate || 1,
        liveCameraTwinMode: !isDemo,
        liveCameraCount: liveCount,
      });
      setMetrics(simEngineRef.current.getMetrics());
    }
  }, [simSettings, occupancy?.total_estimated_occupancy]);

  // Ensure simulation loop runs continuously in Live Twin mode
  useEffect(() => {
    if (!simSettings.isDemoSimulation && simStatus !== 'running') {
      setSimStatus('running');
    }
  }, [simSettings.isDemoSimulation, simStatus]);

  // Controls
  const startSimulation = useCallback(() => {
    setSimStatus('running');
    addNotification('Crowd simulation started.', 'info');
  }, [addNotification]);

  const pauseSimulation = useCallback(() => {
    setSimStatus('paused');
    addNotification('Crowd simulation paused.', 'info');
  }, [addNotification]);

  const resetSimulation = useCallback(() => {
    setSimStatus('ready');
    if (simEngineRef.current) {
      simEngineRef.current.reset();
      setMetrics(simEngineRef.current.getMetrics());
    }
    addNotification('Simulation reset to initial state.', 'info');
  }, [addNotification]);

  // Change preset
  const changeVenuePreset = useCallback((presetKey) => {
    if (VENUE_PRESETS[presetKey]) {
      const presetCopy = JSON.parse(JSON.stringify(VENUE_PRESETS[presetKey]));
      setCurrentPresetKey(presetKey);
      setVenue(presetCopy);
      rebuildNavigation(presetCopy);
      if (simEngineRef.current) {
        simEngineRef.current.reset();
        setMetrics(simEngineRef.current.getMetrics());
      }
      setSimStatus('ready');
      addNotification(`Switched venue layout to ${presetCopy.name}.`, 'info');
    }
  }, [rebuildNavigation, addNotification]);

  // Venue Layout Editing
  const updateVenue = useCallback((updater) => {
    setVenue(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      rebuildNavigation(updated);
      return updated;
    });
  }, [rebuildNavigation]);

  // Update venue dimensions & floor area calibration
  const updateVenueDimensions = useCallback((newDims) => {
    setVenue(prev => {
      const currentDims = prev?.dimensions || { widthMeters: 50, heightMeters: 31, pixelsPerMeter: 20, floorAreaM2: 1550 };
      const widthMeters = Number(newDims.widthMeters !== undefined ? newDims.widthMeters : currentDims.widthMeters) || 50;
      const heightMeters = Number(newDims.heightMeters !== undefined ? newDims.heightMeters : currentDims.heightMeters) || 31;
      const floorAreaM2 = Number(newDims.floorAreaM2 !== undefined ? newDims.floorAreaM2 : (currentDims.floorAreaM2 || Math.round(widthMeters * heightMeters))) || Math.round(widthMeters * heightMeters);

      const updatedDims = {
        ...currentDims,
        widthMeters,
        heightMeters,
        floorAreaM2
      };

      const copy = {
        ...prev,
        dimensions: updatedDims
      };

      try {
        localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(copy));
      } catch (e) {
        console.warn('Failed to save layout dimensions to localStorage', e);
      }
      return copy;
    });

    const displayArea = newDims.floorAreaM2 || Math.round((newDims.widthMeters || 50) * (newDims.heightMeters || 31));
    addNotification(`Venue dimensions updated: ${displayArea.toLocaleString()} m² (${newDims.widthMeters || 50}m × ${newDims.heightMeters || 31}m)`, 'info');
  }, [addNotification]);

  const addLayoutObject = useCallback((type, partialObj) => {
    setVenue(prev => {
      const copy = { ...prev };
      const id = `${type}_${Date.now()}`;
      const newObj = { id, type, ...partialObj };

      if (type === 'wall') copy.walls = [...(copy.walls || []), newObj];
      else if (type === 'stall') copy.stalls = [...(copy.stalls || []), newObj];
      else if (type === 'obstacle') copy.obstacles = [...(copy.obstacles || []), newObj];
      else if (type === 'entrance') copy.entrances = [...(copy.entrances || []), newObj];
      else if (type === 'exit') copy.exits = [...(copy.exits || []), newObj];
      else if (type === 'dualGate') copy.dualGates = [...(copy.dualGates || []), newObj];
      else if (type === 'attraction') copy.attractions = [...(copy.attractions || []), newObj];
      else if (type === 'walkable') copy.walkableZones = [...(copy.walkableZones || []), newObj];

      rebuildNavigation(copy);
      addNotification(`Added new ${type} "${newObj.name || id}".`, 'info');
      return copy;
    });
  }, [rebuildNavigation, addNotification]);

  const updateLayoutObject = useCallback((type, id, updates) => {
    setVenue(prev => {
      const copy = { ...prev };
      const key = type === 'wall' ? 'walls' :
                  type === 'stall' ? 'stalls' :
                  type === 'obstacle' ? 'obstacles' :
                  type === 'entrance' ? 'entrances' :
                  type === 'exit' ? 'exits' :
                  type === 'dualGate' ? 'dualGates' :
                  type === 'attraction' ? 'attractions' : 'walkableZones';

      if (copy[key]) {
        copy[key] = copy[key].map(item => item.id === id ? { ...item, ...updates } : item);
        rebuildNavigation(copy);
      }
      return copy;
    });
  }, [rebuildNavigation]);

  const deleteLayoutObject = useCallback((type, id) => {
    setVenue(prev => {
      const copy = { ...prev };
      const key = type === 'wall' ? 'walls' :
                  type === 'stall' ? 'stalls' :
                  type === 'obstacle' ? 'obstacles' :
                  type === 'entrance' ? 'entrances' :
                  type === 'exit' ? 'exits' :
                  type === 'dualGate' ? 'dualGates' :
                  type === 'attraction' ? 'attractions' : 'walkableZones';

      if (copy[key]) {
        copy[key] = copy[key].filter(item => item.id !== id);
        rebuildNavigation(copy);
        addNotification(`Deleted object (${id}).`, 'info');
      }
      return copy;
    });
  }, [rebuildNavigation, addNotification]);

  // Clear all layout elements (walls, stalls, obstacles, gates, corridors, attractions, candidates)
  const clearAllLayoutElements = useCallback(() => {
    const emptyVenue = {
      id: venue?.id || `venue_${Date.now()}`,
      name: venue?.name || 'Cleared Venue Layout',
      description: 'Blank venue canvas.',
      dimensions: venue?.dimensions || { widthMeters: 50, heightMeters: 31, pixelsPerMeter: 20 },
      walls: [],
      stalls: [],
      entrances: [],
      exits: [],
      obstacles: [],
      walkableZones: [],
      attractions: [],
      dualGates: [],
      barriers: [],
      doors: [],
      gates: []
    };
    setVenue(emptyVenue);
    rebuildNavigation(emptyVenue);
    setCandidateSuggestions([]);
    setSelectedEditorObj(null);
    if (simEngineRef.current) {
      simEngineRef.current.updateVenueAndNav(emptyVenue, navEngineRef.current);
      simEngineRef.current.reset();
      setMetrics(simEngineRef.current.getMetrics());
    }
    try {
      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(emptyVenue));
    } catch (e) {
      console.warn(e);
    }
    addNotification('All layout objects and elements deleted. Venue canvas is completely cleared.', 'info');
    return emptyVenue;
  }, [venue, rebuildNavigation, addNotification]);

  // Apply non-structural operational recommendation (doors or barriers) to layout
  // Helper to execute any layout modification action from recommendations
  const executeLayoutChange = (copy, layoutChange) => {
    if (!layoutChange) return null;
    let appliedTarget = null;

    if (layoutChange.type === 'toggle_door') {
      const listKey = layoutChange.targetCategory; // 'entrances' or 'exits'
      if (copy[listKey]) {
        copy[listKey] = copy[listKey].map(door => {
          if (door.id === layoutChange.targetId) {
            const updatedDoor = { ...door, enabled: layoutChange.enable };
            appliedTarget = {
              type: listKey === 'entrances' ? 'entrance' : 'exit',
              id: door.id,
              obj: updatedDoor
            };
            return updatedDoor;
          }
          return door;
        });
      }
    } else if (layoutChange.type === 'widen_exit') {
      const exitList = copy.exits || [];
      copy.exits = exitList.map(exit => {
        if (exit.id === layoutChange.exitId) {
          const updatedExit = {
            ...exit,
            w: layoutChange.newW || exit.w,
            h: layoutChange.newH || exit.h,
            capacity: layoutChange.newCapacity || (exit.capacity + 60),
            enabled: true
          };
          appliedTarget = { type: 'exit', id: exit.id, obj: updatedExit };
          return updatedExit;
        }
        return exit;
      });
      if (copy.dualGates) {
        copy.dualGates = copy.dualGates.map(gate => {
          if (gate.id === layoutChange.exitId) {
            const updatedGate = {
              ...gate,
              w: layoutChange.newW || gate.w,
              h: layoutChange.newH || gate.h,
              capacity: layoutChange.newCapacity || (gate.capacity + 60),
              enabled: true
            };
            appliedTarget = { type: 'dualGate', id: gate.id, obj: updatedGate };
            return updatedGate;
          }
          return gate;
        });
      }
    } else if (layoutChange.type === 'remove_obstacle') {
      if (copy.obstacles) {
        copy.obstacles = copy.obstacles.filter(o => o.id !== layoutChange.obstacleId);
      }
    } else if (layoutChange.type === 'setback_stall') {
      if (copy.stalls) {
        copy.stalls = copy.stalls.map(stall => {
          if (stall.id === layoutChange.stallId) {
            const updatedStall = {
              ...stall,
              x: layoutChange.shiftX ? Math.max(20, Math.min(CANVAS_WIDTH - stall.w, stall.x + layoutChange.shiftX)) : stall.x,
              y: layoutChange.shiftY ? Math.max(20, Math.min(CANVAS_HEIGHT - stall.h, stall.y + layoutChange.shiftY)) : stall.y,
              w: layoutChange.trimW ? Math.max(60, stall.w - layoutChange.trimW) : stall.w,
              h: layoutChange.trimH ? Math.max(60, stall.h - layoutChange.trimH) : stall.h,
            };
            appliedTarget = { type: 'stall', id: stall.id, obj: updatedStall };
            return updatedStall;
          }
          return stall;
        });
      }
    } else if (layoutChange.type === 'convert_to_dual') {
      const entIndex = (copy.entrances || []).findIndex(e => e.id === layoutChange.entranceId);
      if (entIndex !== -1) {
        const ent = copy.entrances[entIndex];
        copy.entrances = copy.entrances.filter((_, idx) => idx !== entIndex);
        const newDualGate = {
          id: `dual_${ent.id}`,
          name: `Dual Gate (${ent.name.replace('Entrance Gate', '').replace('Entrance', '').trim()})`,
          x: ent.x,
          y: ent.y,
          w: ent.w,
          h: Math.max(ent.h, 110),
          spawnX: ent.spawnX ?? (ent.x + (ent.x < 500 ? 30 : -30)),
          spawnY: ent.spawnY ?? (ent.y + ent.h / 2),
          targetX: ent.targetX ?? (ent.x + ent.w / 2),
          targetY: ent.targetY ?? (ent.y + ent.h / 2),
          capacity: 140,
          spawnRate: 1.0,
          enabled: true
        };
        copy.dualGates = [...(copy.dualGates || []), newDualGate];
        appliedTarget = { type: 'dualGate', id: newDualGate.id, obj: newDualGate };
      }
    } else if (layoutChange.type === 'add_exit') {
      const newExit = {
        ...layoutChange.exit,
        id: layoutChange.exit.id || `exit_aux_${Date.now()}`,
        enabled: true
      };
      copy.exits = [...(copy.exits || []), newExit];
      appliedTarget = { type: 'exit', id: newExit.id, obj: newExit };
    } else if (layoutChange.type === 'add_barrier') {
      const b = layoutChange.barrier;
      const newBarrier = {
        id: b.id || `barrier_${Date.now()}`,
        name: b.name || 'Crowd Control Barrier',
        type: 'obstacle',
        category: 'barrier',
        isBarrier: true,
        shape: 'rect',
        x: Math.max(10, Math.min(CANVAS_WIDTH - 20, b.x)),
        y: Math.max(10, Math.min(CANVAS_HEIGHT - 20, b.y)),
        w: Math.max(10, b.w || 14),
        h: Math.max(10, b.h || 50),
        color: b.color || '#fef3c7',
        accent: b.accent || '#d97706'
      };
      copy.obstacles = [...(copy.obstacles || []), newBarrier];
      appliedTarget = { type: 'obstacle', id: newBarrier.id, obj: newBarrier };
    }

    return appliedTarget;
  };

  // Apply layout recommendation to layout
  const applyRecommendationLayoutChange = useCallback((layoutChange) => {
    if (!layoutChange) return;

    let appliedTarget = null;

    setVenue(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      appliedTarget = executeLayoutChange(copy, layoutChange);

      const nav = rebuildNavigation(copy);
      if (simEngineRef.current) {
        simEngineRef.current.updateVenueAndNav(copy, nav);
        simEngineRef.current.reset();
        setMetrics(simEngineRef.current.getMetrics());
      }
      return copy;
    });

    if (appliedTarget) {
      setSelectedEditorObj(appliedTarget);
    }

    // Automatically transition to Layout Editor
    setActiveTab('layout');
    addNotification(`Applied recommendation: ${layoutChange.label || 'Layout modified'}. Ready to inspect in Layout Editor.`, 'success');
  }, [rebuildNavigation, setActiveTab, addNotification]);

  // Apply multiple operational recommendations at once
  const applyMultipleRecommendationLayoutChanges = useCallback((layoutChangesList) => {
    if (!layoutChangesList || layoutChangesList.length === 0) return;

    let appliedTargets = [];

    setVenue(prev => {
      let copy = JSON.parse(JSON.stringify(prev));

      layoutChangesList.forEach(layoutChange => {
        if (!layoutChange) return;
        const target = executeLayoutChange(copy, layoutChange);
        if (target) appliedTargets.push(target);
      });

      const nav = rebuildNavigation(copy);
      if (simEngineRef.current) {
        simEngineRef.current.updateVenueAndNav(copy, nav);
        simEngineRef.current.reset();
        setMetrics(simEngineRef.current.getMetrics());
      }
      return copy;
    });

    if (appliedTargets.length > 0) {
      setSelectedEditorObj(appliedTargets[appliedTargets.length - 1]);
    }

    setActiveTab('layout');
    addNotification(`Applied ${layoutChangesList.length} recommendations to the Layout Editor! Ready to review and submit.`, 'success');
  }, [rebuildNavigation, setActiveTab, addNotification]);

  // Blueprint Upload & Auto-Digitalization
  const autoDigitalizeCurrentBlueprint = useCallback(async (customImgSrc = null) => {
    const src = customImgSrc || blueprint.imageSrc;
    if (!src) {
      addNotification('No blueprint loaded to digitalize. Please upload or load a floor plan first.', 'warning');
      return;
    }

    addNotification('Analyzing blueprint lines, walls, and booths for auto-digitalization...', 'info');
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const digitalizedVenue = await digitalizeBlueprintToLayout(img, venue);
      if (digitalizedVenue) {
        setVenue(digitalizedVenue);
        rebuildNavigation(digitalizedVenue);
        if (simEngineRef.current) {
          simEngineRef.current.reset();
          setMetrics(simEngineRef.current.getMetrics());
        }
        addNotification(`Blueprint digitalized into editable walls (${digitalizedVenue.walls.length}), booths (${digitalizedVenue.stalls.length}), gates, and corridors!`, 'success');
        return digitalizedVenue;
      }
    } catch (err) {
      console.warn('Auto-digitalization error:', err);
      addNotification(`Could not automatically digitalize floor plan: ${err.message}`, 'error');
    }
  }, [blueprint.imageSrc, venue, rebuildNavigation, addNotification]);

  const uploadBlueprint = useCallback((file) => {
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpe?g|webp)/i)) {
      addNotification('Unsupported blueprint file format. Please upload a PNG, JPG, or WEBP floor plan.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgSrc = e.target.result;
      setBlueprint(prev => ({
        ...prev,
        imageSrc: imgSrc,
        fileName: file.name,
        show: true,
      }));
      addNotification(`Blueprint "${file.name}" uploaded. Digitalizing floor plan geometry...`, 'info');

      // Automatically digitalize the uploaded blueprint into fully editable layout objects
      try {
        const img = new Image();
        img.onload = async () => {
          const digitalized = await digitalizeBlueprintToLayout(img, venue);
          if (digitalized) {
            setVenue(digitalized);
            rebuildNavigation(digitalized);
            if (simEngineRef.current) {
              simEngineRef.current.reset();
              setMetrics(simEngineRef.current.getMetrics());
            }
            addNotification(`Blueprint "${file.name}" automatically digitalized! Walls, booths, gates, and corridors are ready to edit.`, 'success');
          }
        };
        img.src = imgSrc;
      } catch (err) {
        console.warn('Auto-digitalization on upload error:', err);
      }
    };
    reader.onerror = () => {
      addNotification('Failed to read uploaded blueprint file.', 'error');
    };
    reader.readAsDataURL(file);
  }, [venue, rebuildNavigation, addNotification]);

  // Save & Deploy Layout to Simulation and Live Monitoring
  const saveAndDeployVenueLayout = useCallback(async () => {
    try {
      addNotification('Saving and deploying venue layout...', 'info');

      // 1. Rebuild and synchronize local simulation and navigation
      const nav = rebuildNavigation(venue);
      if (simEngineRef.current) {
        simEngineRef.current.updateVenueAndNav(venue, nav);
        simEngineRef.current.reset();
        setMetrics(simEngineRef.current.getMetrics());
      }

      // 2. Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(venue));
      } catch (err) {
        console.warn('LocalStorage save error:', err);
      }

      // 3. Deploy to Backend Database & Live Monitoring
      const venuePayload = {
        venue_id: venue.id || 'default',
        name: venue.name || 'Deployed Venue Layout',
        venue_data: venue,
        blueprint_image: blueprint.imageSrc || null,
        sync_monitoring_zones: true
      };

      const res = await fetch('/api/venues/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venuePayload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Deployment failed: ${errorText}`);
      }

      // 4. Refresh Monitoring Data from backend (which synchronizes newly deployed zones)
      await fetchMonitoringData();

      addNotification(`Venue layout "${venue.name}" successfully deployed to Simulation and Live Monitoring!`, 'success');
      return { success: true, venue };
    } catch (err) {
      console.error('Error saving and deploying venue:', err);
      addNotification(`Deployment error: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  }, [venue, blueprint.imageSrc, rebuildNavigation, fetchMonitoringData, addNotification]);

  const scanBlueprintWithCV = useCallback(async () => {
    if (!blueprint.imageSrc) {
      addNotification('No blueprint uploaded to scan. Please upload a blueprint first.', 'warning');
      return;
    }

    setIsScanningBlueprint(true);
    addNotification('Scanning blueprint for walls and booth candidates...', 'info');

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = blueprint.imageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const candidates = await detectBlueprintCandidates(img);
      setCandidateSuggestions(candidates);
      setIsScanningBlueprint(false);

      if (candidates.length > 0) {
        addNotification(`Computer vision detected ${candidates.length} candidate walls and booths. You can preview, confirm, or adjust them.`, 'success');
      } else {
        addNotification('No distinct rectangular booths or high-contrast walls detected automatically. Manual tracing is available.', 'info');
      }
    } catch (err) {
      setIsScanningBlueprint(false);
      addNotification('Error scanning blueprint image.', 'error');
    }
  }, [blueprint.imageSrc, addNotification]);

  const approveCandidate = useCallback((candidateId) => {
    const cand = candidateSuggestions.find(c => c.id === candidateId);
    if (!cand) return;

    addLayoutObject(cand.type, {
      name: cand.name,
      x: cand.x,
      y: cand.y,
      w: cand.w,
      h: cand.h,
      color: cand.color,
      accent: cand.accent,
    });

    setCandidateSuggestions(prev => prev.filter(c => c.id !== candidateId));
  }, [candidateSuggestions, addLayoutObject]);

  const approveAllCandidates = useCallback(() => {
    candidateSuggestions.forEach(cand => {
      addLayoutObject(cand.type, {
        name: cand.name,
        x: cand.x,
        y: cand.y,
        w: cand.w,
        h: cand.h,
        color: cand.color,
        accent: cand.accent,
      });
    });
    setCandidateSuggestions([]);
    addNotification('Approved and added all suggested candidate objects to venue.', 'success');
  }, [candidateSuggestions, addLayoutObject, addNotification]);

  const rejectAllCandidates = useCallback(() => {
    setCandidateSuggestions([]);
    addNotification('Dismissed all candidate suggestions.', 'info');
  }, [addNotification]);

  // Scenario Comparison (Baseline Snapshots)
  const saveBaselineScenario = useCallback(() => {
    const snapshot = {
      id: `baseline_${Date.now()}`,
      savedAt: new Date().toISOString(),
      venueName: venue.name,
      venue: JSON.parse(JSON.stringify(venue)),
      settings: { ...simSettings },
      metrics: { ...metrics },
      timeSeriesHistory: [...(metrics.timeSeriesHistory || [])],
    };
    setBaselineScenario(snapshot);
    addNotification(`Saved current simulation run as Baseline Snapshot ("${venue.name}").`, 'success');
  }, [venue, simSettings, metrics, addNotification]);

  const clearBaselineScenario = useCallback(() => {
    setBaselineScenario(null);
    addNotification('Cleared baseline scenario snapshot.', 'info');
  }, [addNotification]);

  // JSON Export & Import
  const exportLayoutJSON = useCallback(() => {
    const payload = {
      project: 'CrowdFlow',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      venue,
      simSettings,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(venue.name || 'venue_layout').toLowerCase().replace(/\s+/g, '_')}.crowdflow.json`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification('Exported venue layout to JSON file.', 'success');
  }, [venue, simSettings, addNotification]);

  const importLayoutJSON = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.venue || !Array.isArray(parsed.venue.walls)) {
          throw new Error('Invalid CrowdFlow JSON schema: missing venue geometry.');
        }

        setVenue(parsed.venue);
        if (parsed.simSettings) {
          setSimSettings(prev => ({ ...prev, ...parsed.simSettings }));
        }
        rebuildNavigation(parsed.venue);
        resetSimulation();
        addNotification(`Imported venue layout "${parsed.venue.name || 'Custom Venue'}" successfully.`, 'success');
      } catch (err) {
        addNotification(`Failed to import JSON: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }, [rebuildNavigation, resetSimulation, addNotification]);

  // Recommendations calculated dynamically with stabilization and cadence control to eliminate jitter
  const [recommendations, setRecommendations] = useState(() => {
    return analyzeSimulationAndGenerateRecommendations(
      venue,
      metrics,
      simEngineRef.current ? simEngineRef.current.activeHotspots : []
    );
  });

  useEffect(() => {
    const areRecsEqual = (a, b) => {
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id) return false;
        if (a[i].severity !== b[i].severity) return false;
        if (a[i].title !== b[i].title) return false;
        if (a[i].problem !== b[i].problem) return false;
        if (a[i].action !== b[i].action) return false;
      }
      return true;
    };

    const updateRecs = () => {
      const activeHotspots = simEngineRef.current ? simEngineRef.current.activeHotspots : [];
      const curMetrics = simEngineRef.current ? simEngineRef.current.getMetrics() : metrics;
      const fresh = analyzeSimulationAndGenerateRecommendations(venue, curMetrics, activeHotspots);
      setRecommendations(prev => areRecsEqual(prev, fresh) ? prev : fresh);
    };

    // Immediate computation on venue or simStatus changes
    updateRecs();

    // Re-evaluate on a smooth 1.5-second interval to eliminate rapid strobing/jitter
    const timer = setInterval(updateRecs, 1500);
    return () => clearInterval(timer);
  }, [venue, simStatus]);

  return (
    <CrowdFlowContext.Provider
      value={{
        activeTab,
        setActiveTab,
        venue,
        setVenue,
        currentPresetKey,
        changeVenuePreset,
        updateVenue,
        updateVenueDimensions,
        addLayoutObject,
        updateLayoutObject,
        deleteLayoutObject,
        clearAllLayoutElements,
        selectedEditorObj,
        setSelectedEditorObj,
        applyRecommendationLayoutChange,
        applyMultipleRecommendationLayoutChanges,
        blueprint,
        setBlueprint,
        uploadBlueprint,
        autoDigitalizeCurrentBlueprint,
        saveAndDeployVenueLayout,
        candidateSuggestions,
        isScanningBlueprint,
        scanBlueprintWithCV,
        approveCandidate,
        approveAllCandidates,
        rejectAllCandidates,
        simSettings,
        setSimSettings,
        simStatus,
        startSimulation,
        pauseSimulation,
        resetSimulation,
        metrics,
        simEngine: simEngineRef.current,
        navEngine: navEngineRef.current,
        baselineScenario,
        saveBaselineScenario,
        clearBaselineScenario,
        exportLayoutJSON,
        importLayoutJSON,
        recommendations,
        notifications,
        addNotification,
        dismissNotification,
        // Live Camera Monitoring Exports
        monitoringZones,
        setMonitoringZones,
        cameras,
        setCameras,
        occupancy,
        liveEvents,
        historyObservations,
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
        showPhoneModal,
        setShowPhoneModal,
        openPhoneCameraConnectFlow,
        // Persistent Desktop Webcam
        isWebcamActive,
        webcamStream,
        webcamCount,
        startDesktopWebcam,
        stopDesktopWebcam,
        // Theme Management
        theme,
        setTheme,
        cycleTheme,
        CHROME_THEMES,
      }}
    >
      {children}
      {/* Persistent Offscreen Video Element: Keeps webcam active and streaming regardless of modal state or tab switches */}
      <video
        ref={persistentWebcamVideoRef}
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 480,
          height: 360,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -999
        }}
        playsInline
        muted
        autoPlay
      />
    </CrowdFlowContext.Provider>
  );
}

export function useCrowdFlow() {
  const context = useContext(CrowdFlowContext);
  if (!context) {
    throw new Error('useCrowdFlow must be used within a CrowdFlowProvider');
  }
  return context;
}
