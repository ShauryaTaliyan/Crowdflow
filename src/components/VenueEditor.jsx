import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import { CANVAS_WIDTH, CANVAS_HEIGHT, VENUE_PRESETS } from '../constants/presets';
import { 
  Upload, 
  Trash2, 
  Plus, 
  Sparkles, 
  Move, 
  Square, 
  DoorOpen, 
  Maximize2, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Grid, 
  Layers, 
  Sliders, 
  Check, 
  X, 
  HelpCircle,
  FileCode,
  Download,
  CheckCircle2
} from 'lucide-react';

export default function VenueEditor() {
  const {
    venue,
    updateVenue,
    updateVenueDimensions,
    addLayoutObject,
    updateLayoutObject,
    deleteLayoutObject,
    clearAllLayoutElements,
    selectedEditorObj,
    setSelectedEditorObj,
    blueprint,
    setBlueprint,
    uploadBlueprint,
    autoDigitalizeCurrentBlueprint,
    saveAndDeployVenueLayout,
    setActiveTab,
    candidateSuggestions,
    isScanningBlueprint,
    scanBlueprintWithCV,
    approveCandidate,
    approveAllCandidates,
    rejectAllCandidates,
    changeVenuePreset,
    currentPresetKey,
    exportLayoutJSON,
    importLayoutJSON,
    addNotification,
  } = useCrowdFlow();

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  // Editor modes
  const [activeTool, setActiveTool] = useState('select'); // select, wall, stall, entrance, exit, obstacle, walkable
  const [selectedObj, setSelectedObj] = useState(null); // { type, id }
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const [venueDims, setVenueDims] = useState(() => {
    const d = venue?.dimensions || { widthMeters: 50, heightMeters: 31 };
    return {
      widthMeters: d.widthMeters || 50,
      heightMeters: d.heightMeters || 31,
      floorAreaM2: d.floorAreaM2 || Math.round((d.widthMeters || 50) * (d.heightMeters || 31))
    };
  });

  useEffect(() => {
    if (venue?.dimensions) {
      setVenueDims({
        widthMeters: venue.dimensions.widthMeters || 50,
        heightMeters: venue.dimensions.heightMeters || 31,
        floorAreaM2: venue.dimensions.floorAreaM2 || Math.round((venue.dimensions.widthMeters || 50) * (venue.dimensions.heightMeters || 31))
      });
    }
  }, [venue?.dimensions]);

  const handleScaleWidthChange = (val) => {
    const w = parseFloat(val) || 0;
    setVenueDims(prev => ({
      ...prev,
      widthMeters: val,
      floorAreaM2: w > 0 && prev.heightMeters > 0 ? Math.round(w * (parseFloat(prev.heightMeters) || 0)) : prev.floorAreaM2
    }));
  };

  const handleScaleHeightChange = (val) => {
    const h = parseFloat(val) || 0;
    setVenueDims(prev => ({
      ...prev,
      heightMeters: val,
      floorAreaM2: h > 0 && prev.widthMeters > 0 ? Math.round((parseFloat(prev.widthMeters) || 0) * h) : prev.floorAreaM2
    }));
  };

  const handleScaleAreaChange = (val) => {
    setVenueDims(prev => ({
      ...prev,
      floorAreaM2: val
    }));
  };

  const handleSaveVenueScale = () => {
    const w = Number(venueDims.widthMeters) || 50;
    const h = Number(venueDims.heightMeters) || 31;
    const a = Number(venueDims.floorAreaM2) || Math.round(w * h);
    if (updateVenueDimensions) {
      updateVenueDimensions({ widthMeters: w, heightMeters: h, floorAreaM2: a });
    }
  };

  const [isDeploying, setIsDeploying] = useState(false);
  const [showDeploySuccessModal, setShowDeploySuccessModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const handleSaveAndDeploy = async () => {
    setIsDeploying(true);
    const result = await saveAndDeployVenueLayout();
    setIsDeploying(false);
    if (result?.success) {
      setShowDeploySuccessModal(true);
    }
  };

  // Sync selectedEditorObj from recommendations
  useEffect(() => {
    if (selectedEditorObj) {
      setSelectedObj(selectedEditorObj);
      setActiveTool('select');
    }
  }, [selectedEditorObj]);

  const handleClearAllElements = () => {
    clearAllLayoutElements();
    setSelectedObj(null);
    if (setSelectedEditorObj) setSelectedEditorObj(null);
    setShowClearConfirmModal(false);
    requestAnimationFrame(() => {
      drawEditor();
    });
  };

  // Mouse interaction state
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(null); // 'nw', 'ne', 'se', 'sw' or null
  const dragStartRef = useRef({ x: 0, y: 0 });
  const objStartRef = useRef(null);
  const newObjDrawingRef = useRef(null);

  // Cached Blueprint Image Object
  const blueprintImgRef = useRef(null);

  useEffect(() => {
    if (blueprint.imageSrc) {
      const img = new Image();
      img.src = blueprint.imageSrc;
      img.onload = () => {
        blueprintImgRef.current = img;
        drawEditor();
      };
    } else {
      blueprintImgRef.current = null;
      drawEditor();
    }
  }, [blueprint.imageSrc]);

  // Convert client mouse event to canvas coordinate (1000x620)
  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;

    if (snapToGrid) {
      x = Math.round(x / 10) * 10;
      y = Math.round(y / 10) * 10;
    }
    return { x: Math.max(0, Math.min(CANVAS_WIDTH, x)), y: Math.max(0, Math.min(CANVAS_HEIGHT, y)) };
  }, [snapToGrid]);

  // Find object at position
  const hitTest = useCallback((x, y) => {
    // 1. Check active exits
    for (const exit of (venue.exits || [])) {
      if (x >= exit.x && x <= exit.x + exit.w && y >= exit.y && y <= exit.y + exit.h) {
        return { type: 'exit', id: exit.id, obj: exit };
      }
    }
    // 2. Check active entrances
    for (const ent of (venue.entrances || [])) {
      if (x >= ent.x && x <= ent.x + ent.w && y >= ent.y && y <= ent.y + ent.h) {
        return { type: 'entrance', id: ent.id, obj: ent };
      }
    }
    // 2b. Check dual gates (both entrance and exit)
    for (const gate of (venue.dualGates || [])) {
      if (x >= gate.x && x <= gate.x + gate.w && y >= gate.y && y <= gate.y + gate.h) {
        return { type: 'dualGate', id: gate.id, obj: gate };
      }
    }
    // 3. Check obstacles
    for (const obs of (venue.obstacles || [])) {
      if (x >= obs.x && x <= obs.x + obs.w && y >= obs.y && y <= obs.y + obs.h) {
        return { type: 'obstacle', id: obs.id, obj: obs };
      }
    }
    // 3b. Check attractions (crowd magnets)
    for (const att of (venue.attractions || [])) {
      if (x >= att.x && x <= att.x + att.w && y >= att.y && y <= att.y + att.h) {
        return { type: 'attraction', id: att.id, obj: att };
      }
    }
    // 4. Check stalls
    for (const stall of (venue.stalls || [])) {
      if (x >= stall.x && x <= stall.x + stall.w && y >= stall.y && y <= stall.y + stall.h) {
        return { type: 'stall', id: stall.id, obj: stall };
      }
    }
    // 5. Check walls
    for (const wall of (venue.walls || [])) {
      if (x >= wall.x - 3 && x <= wall.x + wall.w + 3 && y >= wall.y - 3 && y <= wall.y + wall.h + 3) {
        return { type: 'wall', id: wall.id, obj: wall };
      }
    }
    return null;
  }, [venue]);

  // Main Editor Canvas Render
  const drawEditor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Blueprint Background Layer
    if (blueprint.show && blueprintImgRef.current) {
      ctx.save();
      ctx.globalAlpha = blueprint.opacity;
      ctx.drawImage(blueprintImgRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
    }

    // 2. Grid Overlay
    if (showGridOverlay) {
      ctx.save();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      for (let x = 0; x <= CANVAS_WIDTH; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Walkable Zones (Corridors)
    (venue.walkableZones || []).forEach(zone => {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 132, 199, 0.04)';
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)';
      ctx.setLineDash([6, 4]);
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
      ctx.fillStyle = '#0284c7';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(zone.name || 'Walkable Corridor', zone.x + 8, zone.y + 16);
      ctx.restore();
    });

    // 3b. Attractions & Points of Interest (Crowd Magnets)
    (venue.attractions || []).forEach(att => {
      ctx.save();
      ctx.fillStyle = 'rgba(254, 243, 199, 0.7)';
      ctx.fillRect(att.x, att.y, att.w, att.h);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(att.x, att.y, att.w, att.h);

      // Star icon + title
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`★ ${att.name || 'Attraction Stage'}`, att.x + att.w / 2, att.y + att.h / 2);
      ctx.restore();
    });

    // 4. Stalls & Booths
    (venue.stalls || []).forEach(stall => {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(stall.x, stall.y, stall.w, stall.h);

      // Accent border
      ctx.strokeStyle = stall.accent || '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(stall.x, stall.y, stall.w, stall.h);

      // Top color banner
      ctx.fillStyle = stall.accent || '#3b82f6';
      ctx.fillRect(stall.x, stall.y, stall.w, Math.min(18, stall.h / 3));

      // Label
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stall.name || 'Booth', stall.x + stall.w / 2, stall.y + stall.h / 2 + 6);

      ctx.restore();
    });

    // 5. Walls
    (venue.walls || []).forEach(wall => {
      ctx.save();
      ctx.fillStyle = '#334155';
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
      ctx.restore();
    });

    // 6. Obstacles
    (venue.obstacles || []).forEach(obs => {
      ctx.save();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillStyle = '#92400e';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(obs.name || 'Obstacle', obs.x + obs.w / 2, obs.y + obs.h / 2 + 3);
      ctx.restore();
    });

    // 7. Entrances
    (venue.entrances || []).forEach(ent => {
      ctx.save();
      ctx.fillStyle = 'rgba(22, 163, 74, 0.14)';
      ctx.fillRect(ent.x, ent.y, ent.w, ent.h);
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      ctx.strokeRect(ent.x, ent.y, ent.w, ent.h);

      // Direction arrow pointing inward
      ctx.fillStyle = '#15803d';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ENTRY ➔', ent.x + ent.w / 2, ent.y + ent.h / 2 + 3);
      ctx.restore();
    });

    // 8. Exits
    (venue.exits || []).forEach(exit => {
      ctx.save();
      ctx.fillStyle = 'rgba(220, 38, 38, 0.14)';
      ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);

      // Exit arrow
      ctx.fillStyle = '#b91c1c';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT ➔', exit.x + exit.w / 2, exit.y + exit.h / 2 + 3);
      ctx.restore();
    });

    // 8b. Dual Gates (Both Entrance and Exit)
    (venue.dualGates || []).forEach(gate => {
      ctx.save();
      const isEnabled = gate.enabled !== false;
      ctx.fillStyle = isEnabled ? 'rgba(13, 148, 136, 0.16)' : '#f1f5f9';
      ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
      ctx.strokeStyle = isEnabled ? '#0d9488' : '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);

      ctx.fillStyle = isEnabled ? '#0f766e' : '#64748b';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ENTRY ⇄ EXIT', gate.x + gate.w / 2, gate.y + gate.h / 2 + 3);
      ctx.restore();
    });

    // 9. Candidate Suggestions (from CV Detection)
    candidateSuggestions.forEach(cand => {
      ctx.save();
      ctx.strokeStyle = '#d97706';
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 2;
      ctx.strokeRect(cand.x, cand.y, cand.w, cand.h);

      ctx.fillStyle = 'rgba(217, 119, 6, 0.12)';
      ctx.fillRect(cand.x, cand.y, cand.w, cand.h);

      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(`Suggested: ${cand.name}`, cand.x + 6, cand.y + 14);
      ctx.restore();
    });

    // 10. Selected Object Bounding Box & Resize Handles
    if (selectedObj) {
      const activeList = selectedObj.type === 'wall' ? venue.walls :
                         selectedObj.type === 'stall' ? venue.stalls :
                         selectedObj.type === 'obstacle' ? venue.obstacles :
                         selectedObj.type === 'entrance' ? venue.entrances :
                         selectedObj.type === 'exit' ? venue.exits :
                         selectedObj.type === 'dualGate' ? venue.dualGates :
                         selectedObj.type === 'attraction' ? venue.attractions : venue.walkableZones;

      const obj = activeList?.find(i => i.id === selectedObj.id);
      if (obj) {
        ctx.save();
        ctx.strokeStyle = '#1a73e8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(obj.x - 2, obj.y - 2, obj.w + 4, obj.h + 4);

        // Corner handles
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1a73e8';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        const handles = [
          { x: obj.x - 4, y: obj.y - 4 },
          { x: obj.x + obj.w - 4, y: obj.y - 4 },
          { x: obj.x + obj.w - 4, y: obj.y + obj.h - 4 },
          { x: obj.x - 4, y: obj.y + obj.h - 4 },
        ];
        handles.forEach(h => {
          ctx.fillRect(h.x, h.y, 8, 8);
          ctx.strokeRect(h.x, h.y, 8, 8);
        });

        // Object Dimensions HUD badge
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(obj.x, obj.y - 22, 110, 18);
        ctx.strokeStyle = '#1a73e8';
        ctx.strokeRect(obj.x, obj.y - 22, 110, 18);
        ctx.fillStyle = '#1a73e8';
        ctx.font = '10px Inter, monospace';
        ctx.fillText(`${Math.round(obj.w / 20)}m × ${Math.round(obj.h / 20)}m (${obj.w}x${obj.h}px)`, obj.x + 4, obj.y - 9);

        ctx.restore();
      }
    }

    // 11. In-progress new object drag drawing
    if (newObjDrawingRef.current) {
      const d = newObjDrawingRef.current;
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.restore();
    }
  }, [venue, blueprint, showGridOverlay, candidateSuggestions, selectedObj]);

  useEffect(() => {
    drawEditor();
  }, [drawEditor]);

  // Mouse Handlers for Dragging, Resizing, and Adding Objects
  const handleMouseDown = (e) => {
    const coords = getCanvasCoords(e);
    dragStartRef.current = coords;

    if (activeTool === 'select') {
      // Check if clicked on a corner handle of the selected object
      if (selectedObj) {
        const activeList = selectedObj.type === 'wall' ? venue.walls :
                           selectedObj.type === 'stall' ? venue.stalls :
                           selectedObj.type === 'obstacle' ? venue.obstacles :
                           selectedObj.type === 'entrance' ? venue.entrances :
                           selectedObj.type === 'exit' ? venue.exits :
                           selectedObj.type === 'dualGate' ? venue.dualGates :
                           selectedObj.type === 'attraction' ? venue.attractions : venue.walkableZones;
        const obj = activeList?.find(i => i.id === selectedObj.id);

        if (obj) {
          const cornerDist = 12;
          if (Math.hypot(coords.x - obj.x, coords.y - obj.y) < cornerDist) {
            isResizingRef.current = 'nw';
            objStartRef.current = { ...obj };
            return;
          }
          if (Math.hypot(coords.x - (obj.x + obj.w), coords.y - obj.y) < cornerDist) {
            isResizingRef.current = 'ne';
            objStartRef.current = { ...obj };
            return;
          }
          if (Math.hypot(coords.x - (obj.x + obj.w), coords.y - (obj.y + obj.h)) < cornerDist) {
            isResizingRef.current = 'se';
            objStartRef.current = { ...obj };
            return;
          }
          if (Math.hypot(coords.x - obj.x, coords.y - (obj.y + obj.h)) < cornerDist) {
            isResizingRef.current = 'sw';
            objStartRef.current = { ...obj };
            return;
          }
        }
      }

      // Check hit test for selecting an object
      const hit = hitTest(coords.x, coords.y);
      if (hit) {
        setSelectedObj({ type: hit.type, id: hit.id });
        objStartRef.current = { ...hit.obj };
        isDraggingRef.current = true;
      } else {
        setSelectedObj(null);
      }
    } else {
      // Create new object on drag
      newObjDrawingRef.current = { x: coords.x, y: coords.y, w: 10, h: 10 };
      isDraggingRef.current = true;
    }
    drawEditor();
  };

  const handleMouseMove = (e) => {
    const coords = getCanvasCoords(e);

    if (isResizingRef.current && objStartRef.current && selectedObj) {
      const mode = isResizingRef.current;
      const startObj = objStartRef.current;
      const dx = coords.x - dragStartRef.current.x;
      const dy = coords.y - dragStartRef.current.y;

      let newX = startObj.x;
      let newY = startObj.y;
      let newW = startObj.w;
      let newH = startObj.h;

      if (mode === 'se') {
        newW = Math.max(16, startObj.w + dx);
        newH = Math.max(16, startObj.h + dy);
      } else if (mode === 'sw') {
        newX = Math.min(startObj.x + startObj.w - 16, startObj.x + dx);
        newW = startObj.w - (newX - startObj.x);
        newH = Math.max(16, startObj.h + dy);
      } else if (mode === 'ne') {
        newY = Math.min(startObj.y + startObj.h - 16, startObj.y + dy);
        newW = Math.max(16, startObj.w + dx);
        newH = startObj.h - (newY - startObj.y);
      } else if (mode === 'nw') {
        newX = Math.min(startObj.x + startObj.w - 16, startObj.x + dx);
        newY = Math.min(startObj.y + startObj.h - 16, startObj.y + dy);
        newW = startObj.w - (newX - startObj.x);
        newH = startObj.h - (newY - startObj.y);
      }

      updateLayoutObject(selectedObj.type, selectedObj.id, { x: newX, y: newY, w: newW, h: newH });
      return;
    }

    if (isDraggingRef.current) {
      if (activeTool === 'select' && selectedObj && objStartRef.current) {
        const dx = coords.x - dragStartRef.current.x;
        const dy = coords.y - dragStartRef.current.y;
        const newX = Math.max(0, Math.min(CANVAS_WIDTH - objStartRef.current.w, objStartRef.current.x + dx));
        const newY = Math.max(0, Math.min(CANVAS_HEIGHT - objStartRef.current.h, objStartRef.current.y + dy));

        updateLayoutObject(selectedObj.type, selectedObj.id, { x: newX, y: newY });
      } else if (newObjDrawingRef.current) {
        const sx = dragStartRef.current.x;
        const sy = dragStartRef.current.y;
        const x = Math.min(sx, coords.x);
        const y = Math.min(sy, coords.y);
        const w = Math.max(14, Math.abs(coords.x - sx));
        const h = Math.max(14, Math.abs(coords.y - sy));

        newObjDrawingRef.current = { x, y, w, h };
        drawEditor();
      }
    }
  };

  const handleMouseUp = () => {
    if (newObjDrawingRef.current && activeTool !== 'select') {
      const d = newObjDrawingRef.current;
      const defaultNames = {
        wall: 'Wall Segment',
        stall: 'Exhibition Booth',
        entrance: 'Entrance Gate',
        exit: 'Exit Portal',
        dualGate: 'Entry & Exit Gate',
        obstacle: 'Barrier Obstacle',
        walkable: 'Walkable Aisle',
        attraction: 'Crowd Attraction Stage',
      };

      let finalW = d.w;
      let finalH = d.h;
      let finalX = d.x;
      let finalY = d.y;

      // If user simply clicked on canvas without dragging far, assign default dimension
      if (finalW < 14 || finalH < 14) {
        const defaultSizes = {
          wall: { w: 80, h: 14 },
          stall: { w: 140, h: 100 },
          entrance: { w: 26, h: 80 },
          exit: { w: 26, h: 80 },
          dualGate: { w: 30, h: 84 },
          obstacle: { w: 30, h: 30 },
          walkable: { w: 140, h: 120 },
          attraction: { w: 140, h: 90 },
        };
        const def = defaultSizes[activeTool] || { w: 50, h: 50 };
        finalW = def.w;
        finalH = def.h;
        finalX = Math.max(0, Math.min(CANVAS_WIDTH - finalW, Math.round(d.x - finalW / 2)));
        finalY = Math.max(0, Math.min(CANVAS_HEIGHT - finalH, Math.round(d.y - finalH / 2)));
      }

      const centerX = 500;
      const centerY = 310;
      const gx = finalX + finalW / 2;
      const gy = finalY + finalH / 2;
      const toCenterX = centerX - gx;
      const toCenterY = centerY - gy;
      const toCenterDist = Math.hypot(toCenterX, toCenterY) || 1;
      const inwardOffset = Math.max(finalW, finalH) / 2 + 16;
      const defaultSpawnX = Math.round(gx + (toCenterX / toCenterDist) * inwardOffset);
      const defaultSpawnY = Math.round(gy + (toCenterY / toCenterDist) * inwardOffset);

      addLayoutObject(activeTool, {
        name: `${defaultNames[activeTool] || 'Object'} ${Date.now() % 1000}`,
        x: finalX,
        y: finalY,
        w: finalW,
        h: finalH,
        color: activeTool === 'stall' ? '#1e293b' : activeTool === 'attraction' ? '#f59e0b' : activeTool === 'dualGate' ? '#0d9488' : undefined,
        accent: activeTool === 'stall' ? '#3b82f6' : activeTool === 'attraction' ? '#fbbf24' : activeTool === 'dualGate' ? '#14b8a6' : undefined,
        dwellSeconds: activeTool === 'attraction' ? 5 : undefined,
        attractionStrength: activeTool === 'attraction' ? 0.75 : undefined,
        enabled: true,
        spawnRate: (activeTool === 'entrance' || activeTool === 'dualGate') ? 1.0 : undefined,
        capacity: (activeTool === 'exit' || activeTool === 'dualGate') ? 100 : undefined,
        spawnX: (activeTool === 'entrance' || activeTool === 'dualGate') ? defaultSpawnX : undefined,
        spawnY: (activeTool === 'entrance' || activeTool === 'dualGate') ? defaultSpawnY : undefined,
        targetX: (activeTool === 'exit' || activeTool === 'dualGate') ? Math.round(gx) : undefined,
        targetY: (activeTool === 'exit' || activeTool === 'dualGate') ? Math.round(gy) : undefined,
      });

      // Maintain activeTool so user can place again and again continuously!
      newObjDrawingRef.current = null;
    }

    isDraggingRef.current = false;
    isResizingRef.current = null;
    objStartRef.current = null;
    drawEditor();
  };

  // Keyboard shortcut: Delete key and Escape key to return to select tool
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent if user is typing inside an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === 'Escape') {
        setActiveTool('select');
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObj) {
        deleteLayoutObject(selectedObj.type, selectedObj.id);
        setSelectedObj(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObj, deleteLayoutObject]);

  // Find currently selected object data for inspector
  const currentSelectedData = (() => {
    if (!selectedObj) return null;
    const list = selectedObj.type === 'wall' ? venue.walls :
                 selectedObj.type === 'stall' ? venue.stalls :
                 selectedObj.type === 'obstacle' ? venue.obstacles :
                 selectedObj.type === 'entrance' ? venue.entrances :
                 selectedObj.type === 'exit' ? venue.exits :
                 selectedObj.type === 'dualGate' ? venue.dualGates :
                 selectedObj.type === 'attraction' ? venue.attractions : venue.walkableZones;
    return list?.find(item => item.id === selectedObj.id) || null;
  })();

  return (
    <div className="cf-layout-editor-page">
      {/* Editor Top Bar */}
      <div className="editor-top-toolbar">
        {/* Blueprint Upload Controls */}
        <div className="blueprint-controls-group">
          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Floor Plan Image (PNG, JPG)"
          >
            <Upload size={16} />
            <span>Upload Floor Plan</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files?.[0]) uploadBlueprint(e.target.files[0]);
              e.target.value = '';
            }}
            accept="image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
          />

          <button
            className="btn-secondary"
            onClick={() => {
              changeVenuePreset('exhibition');
              setBlueprint({
                imageSrc: '/sample_blueprint.jpg',
                fileName: 'sample_blueprint.jpg',
                opacity: 0.65,
                show: true,
              });
              addNotification('Loaded CrowdFlow Exhibition Hall Demo sample plan.', 'success');
            }}
            title="Load Sample Floor Plan"
          >
            <Layers size={15} />
            <span>Load Sample Plan</span>
          </button>

          {blueprint.imageSrc && (
            <>
              <button
                className="btn-secondary"
                onClick={() => autoDigitalizeCurrentBlueprint()}
                title="Automatically digitalize floor plan into editable walls, stalls, gates, and corridors"
                style={{
                  background: 'var(--green-subtle)',
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                  color: 'var(--green-text)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Sparkles size={15} style={{ color: 'var(--green)' }} />
                <span>Auto-Digitalize Blueprint</span>
              </button>

              <button
                className={`btn-secondary ${isScanningBlueprint ? 'loading' : ''}`}
                onClick={scanBlueprintWithCV}
                disabled={isScanningBlueprint}
                title="Detect candidate walls and booths automatically from the image"
              >
                <Sparkles size={16} className="text-amber" />
                <span>{isScanningBlueprint ? 'Detecting...' : 'Detect Walls & Doors'}</span>
              </button>

              <div className="opacity-slider-wrap">
                <span className="slider-label">Blueprint Opacity:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={blueprint.opacity}
                  onChange={(e) => setBlueprint(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                  className="cf-slider"
                />
                <span className="slider-val">{Math.round(blueprint.opacity * 100)}%</span>
              </div>

              <button
                className="btn-icon"
                onClick={() => setBlueprint(prev => ({ ...prev, show: !prev.show }))}
                title={blueprint.show ? 'Hide Blueprint' : 'Show Blueprint'}
              >
                {blueprint.show ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>

              <button
                className="btn-icon text-red"
                onClick={() => setBlueprint({ imageSrc: null, fileName: null, opacity: 0.65, show: true })}
                title="Remove Blueprint Reference"
              >
                <X size={16} />
              </button>
            </>
          )}

          {!blueprint.imageSrc && (
            <span className="blueprint-hint">
              Supports PNG/JPG floor plans. Manual tracing & auto-detection supported.
            </span>
          )}
        </div>

        {/* View Options & Save & Deploy Layout */}
        <div className="editor-view-actions">
          <button
            className="btn-deploy-layout"
            onClick={handleSaveAndDeploy}
            disabled={isDeploying}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '7px 16px',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              cursor: isDeploying ? 'wait' : 'pointer',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
              letterSpacing: '0.02em',
              transition: 'all 0.2s ease',
            }}
            title="Save layout and deploy to Simulation and Live Monitoring"
          >
            <CheckCircle2 size={16} />
            <span>{isDeploying ? 'Deploying...' : 'Save & Deploy Layout'}</span>
          </button>

          <button
            className={`btn-chip ${showGridOverlay ? 'active' : ''}`}
            onClick={() => setShowGridOverlay(!showGridOverlay)}
            title="Toggle 20px Grid Overlay"
          >
            <Grid size={14} />
            <span>Grid (1m)</span>
          </button>

          <button
            className={`btn-chip ${snapToGrid ? 'active' : ''}`}
            onClick={() => setSnapToGrid(!snapToGrid)}
            title="Toggle Snap to Grid (10px)"
          >
            <span>Snap to Grid</span>
          </button>

          <button
            className="btn-secondary"
            onClick={() => changeVenuePreset('exhibition')}
            title="Reset Layout to Default Exhibition Sample"
          >
            <RotateCcw size={14} />
            <span>Reset to Sample Venue</span>
          </button>

          <button
            className="btn-secondary"
            onClick={handleClearAllElements}
            title="Delete all walls, booths, gates, and objects from layout"
            style={{ color: 'var(--red-text)', borderColor: 'rgba(239, 68, 68, 0.35)', background: 'var(--red-subtle)' }}
          >
            <Trash2 size={14} />
            <span>Clear All Elements</span>
          </button>
        </div>
      </div>

      {/* Main Layout Area: Toolbar + Canvas + Inspector */}
      <div className="editor-main-container">
        {/* Left Toolbar */}
        <div className="editor-tool-palette">
          <div className="tool-group-title">TOOLS</div>

          <button
            className={`palette-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
            title="Select, Move, and Resize Objects (V)"
          >
            <Move size={18} />
            <span>Select / Move</span>
          </button>

          <div className="tool-divider" />
          <div className="tool-group-title">ADD OBJECTS</div>

          <button
            className={`palette-btn ${activeTool === 'wall' ? 'active' : ''}`}
            onClick={() => setActiveTool('wall')}
            title="Draw Wall Segment"
          >
            <div className="tool-color-dot" style={{ backgroundColor: '#64748b' }} />
            <span>Add Wall</span>
          </button>

          <button
            className={`palette-btn ${activeTool === 'stall' ? 'active' : ''}`}
            onClick={() => setActiveTool('stall')}
            title="Draw Exhibition Booth or Stall"
          >
            <div className="tool-color-dot" style={{ backgroundColor: '#3b82f6' }} />
            <span>Add Booth / Stall</span>
          </button>

          <button
            className={`palette-btn ${activeTool === 'entrance' ? 'active' : ''}`}
            onClick={() => setActiveTool('entrance')}
            title="Place Entrance Gate"
          >
            <div className="tool-color-dot" style={{ backgroundColor: '#10b981' }} />
            <span>Add Entrance Gate</span>
          </button>

          <button
            className={`palette-btn ${activeTool === 'exit' ? 'active' : ''}`}
            onClick={() => setActiveTool('exit')}
            title="Place Exit Gate"
          >
            <div className="tool-color-dot" style={{ backgroundColor: '#ef4444' }} />
            <span>Add Exit Gate</span>
          </button>

          <button
            className={`palette-btn ${activeTool === 'dualGate' ? 'active' : ''}`}
            onClick={() => setActiveTool('dualGate')}
            title="Place Bidirectional Gate (Both Entry & Exit)"
          >
            <div className="tool-color-dot" style={{ backgroundColor: '#0d9488' }} />
            <span>Add Dual Gate (In & Out)</span>
          </button>

          <button
            className={`palette-btn ${activeTool === 'obstacle' ? 'active' : ''}`}
            onClick={() => setActiveTool('obstacle')}
            title="Place Physical Obstacle"
          >
            <div className="tool-color-dot" style={{ backgroundColor: '#f59e0b' }} />
            <span>Add Obstacle</span>
          </button>

          <button
            className={`palette-btn ${activeTool === 'walkable' ? 'active' : ''}`}
            onClick={() => setActiveTool('walkable')}
            title="Mark Walkable Corridor Zone"
          >
            <div className="tool-color-dot" style={{ backgroundColor: '#38bdf8' }} />
            <span>Add Corridor Zone</span>
          </button>

          <button
            className={`palette-btn ${activeTool === 'attraction' ? 'active' : ''}`}
            onClick={() => setActiveTool('attraction')}
            title="Place Crowd Attraction / Keynote Demo Stage (Crowd Magnet)"
          >
            <div className="tool-color-dot" style={{ backgroundColor: '#f59e0b' }} />
            <span>Add Attraction (Magnet)</span>
          </button>

          {/* Quick Stats of layout */}
          <div className="palette-stats-summary">
            <div className="summary-title">OBJECT COUNTS</div>
            <div className="summary-item">Walls: <strong>{(venue.walls || []).length}</strong></div>
            <div className="summary-item">Booths: <strong>{(venue.stalls || []).length}</strong></div>
            <div className="summary-item">Entrances: <strong>{(venue.entrances || []).length}</strong></div>
            <div className="summary-item">Exits: <strong>{(venue.exits || []).length}</strong></div>
            <div className="summary-item">Dual Gates: <strong>{(venue.dualGates || []).length}</strong></div>
            <div className="summary-item">Attractions: <strong>{(venue.attractions || []).length}</strong></div>
          </div>
        </div>

        {/* Center Canvas Workspace */}
        <div className="editor-canvas-stage">
          {activeTool !== 'select' && (
            <div style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 14px',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: '#38bdf8'
            }}>
              <span>
                ✏️ Placing: <strong>{activeTool === 'dualGate' ? 'Dual Gate (Entry & Exit)' : activeTool.toUpperCase()}</strong> &bull; Click or drag anywhere on canvas to place repeatedly
              </span>
              <button
                className="btn-chip"
                onClick={() => setActiveTool('select')}
                style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', fontWeight: 600, padding: '2px 10px' }}
                title="Return to Select / Move tool (or press Esc)"
              >
                Switch to Select / Move (Esc)
              </button>
            </div>
          )}

          <div className="canvas-frame">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className={`interactive-venue-canvas tool-${activeTool}`}
            />
          </div>

          <div className="canvas-footer-hints">
            <span>💡 <strong>Tip:</strong> Drag objects to move. Drag corner handles to resize. Press <strong>Delete</strong> to remove.</span>
            <span>Scale: 20px = 1.0m (50m × 31m Total Floor Space)</span>
          </div>
        </div>

        {/* Right Sidebar: Inspector & Candidate Detection */}
        <div className="editor-inspector-sidebar">
          {/* Candidate Detection Approval Panel */}
          {candidateSuggestions.length > 0 && (
            <div className="inspector-box candidates-panel">
              <div className="box-header">
                <Sparkles size={16} className="text-amber" />
                <span className="box-title">Detected Candidates ({candidateSuggestions.length})</span>
              </div>
              <p className="box-desc">
                Computer vision proposed these candidate booths and walls. Confirm to add them:
              </p>

              <div className="candidate-list">
                {candidateSuggestions.map(cand => (
                  <div key={cand.id} className="candidate-item">
                    <div className="cand-info">
                      <span className="cand-name">{cand.name}</span>
                      <span className="cand-type">{cand.type.toUpperCase()} &bull; {Math.round(cand.confidence * 100)}% Match</span>
                    </div>
                    <button
                      className="btn-xs btn-approve"
                      onClick={() => approveCandidate(cand.id)}
                      title="Approve and add to layout"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="candidate-actions">
                <button className="btn-primary w-full" onClick={approveAllCandidates}>
                  <Check size={14} /> Approve All ({candidateSuggestions.length})
                </button>
                <button className="btn-secondary w-full" onClick={rejectAllCandidates}>
                  <X size={14} /> Dismiss All
                </button>
              </div>
            </div>
          )}

          {/* Selected Object Property Inspector */}
          <div className="inspector-box">
            <div className="box-header">
              <Sliders size={16} />
              <span className="box-title">Object Inspector</span>
            </div>

            {currentSelectedData ? (
              <div className="inspector-form">
                <div className="form-row">
                  <label>Name / Label</label>
                  <input
                    type="text"
                    value={currentSelectedData.name || ''}
                    onChange={(e) => updateLayoutObject(selectedObj.type, selectedObj.id, { name: e.target.value })}
                    className="cf-input"
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-row">
                    <label>Position X (px)</label>
                    <input
                      type="number"
                      value={Math.round(currentSelectedData.x)}
                      onChange={(e) => updateLayoutObject(selectedObj.type, selectedObj.id, { x: parseInt(e.target.value, 10) || 0 })}
                      className="cf-input"
                    />
                  </div>
                  <div className="form-row">
                    <label>Position Y (px)</label>
                    <input
                      type="number"
                      value={Math.round(currentSelectedData.y)}
                      onChange={(e) => updateLayoutObject(selectedObj.type, selectedObj.id, { y: parseInt(e.target.value, 10) || 0 })}
                      className="cf-input"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-row">
                    <label>Width ({Math.round(currentSelectedData.w / 20)}m)</label>
                    <input
                      type="number"
                      value={Math.round(currentSelectedData.w)}
                      onChange={(e) => updateLayoutObject(selectedObj.type, selectedObj.id, { w: Math.max(10, parseInt(e.target.value, 10) || 10) })}
                      className="cf-input"
                    />
                  </div>
                  <div className="form-row">
                    <label>Height ({Math.round(currentSelectedData.h / 20)}m)</label>
                    <input
                      type="number"
                      value={Math.round(currentSelectedData.h)}
                      onChange={(e) => updateLayoutObject(selectedObj.type, selectedObj.id, { h: Math.max(10, parseInt(e.target.value, 10) || 10) })}
                      className="cf-input"
                    />
                  </div>
                </div>

                {selectedObj.type === 'stall' && (
                  <div className="form-row">
                    <label>Accent Color</label>
                    <input
                      type="color"
                      value={currentSelectedData.accent || '#3b82f6'}
                      onChange={(e) => updateLayoutObject(selectedObj.type, selectedObj.id, { accent: e.target.value })}
                      className="cf-color-picker"
                    />
                  </div>
                )}

                {(selectedObj.type === 'entrance' || selectedObj.type === 'exit' || selectedObj.type === 'dualGate') && (
                  <div className="form-row">
                    <label>Door Operational State</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className={`btn-chip ${currentSelectedData.enabled !== false ? 'active' : ''}`}
                        onClick={() => updateLayoutObject(selectedObj.type, selectedObj.id, { enabled: true })}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: '0.78rem',
                          background: currentSelectedData.enabled !== false ? '#10b981' : '#f1f5f9',
                          color: currentSelectedData.enabled !== false ? '#ffffff' : '#64748b',
                          fontWeight: 700
                        }}
                      >
                        OPEN (Active)
                      </button>
                      <button
                        type="button"
                        className={`btn-chip ${currentSelectedData.enabled === false ? 'active' : ''}`}
                        onClick={() => updateLayoutObject(selectedObj.type, selectedObj.id, { enabled: false })}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: '0.78rem',
                          background: currentSelectedData.enabled === false ? '#ef4444' : '#f1f5f9',
                          color: currentSelectedData.enabled === false ? '#ffffff' : '#64748b',
                          fontWeight: 700
                        }}
                      >
                        CLOSED (Locked)
                      </button>
                    </div>
                  </div>
                )}

                {selectedObj.type === 'dualGate' && (
                  <div style={{
                    background: 'var(--green-subtle)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                    color: 'var(--green-text)',
                    fontWeight: 600,
                    marginBottom: 8
                  }}>
                    🚪 Dual-Way Gate: Serves as both entrance inflow and exit outflow portal.
                  </div>
                )}

                {selectedObj.type === 'obstacle' && (currentSelectedData.isBarrier || currentSelectedData.category === 'barrier') && (
                  <div style={{
                    background: 'var(--amber-subtle)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    color: 'var(--amber-text)',
                    fontWeight: 600,
                    marginBottom: 8
                  }}>
                    🚧 Temporary Mobile Crowd Control Barrier
                  </div>
                )}
                {selectedObj.type === 'attraction' && (
                  <div style={{
                    background: 'rgba(249, 115, 22, 0.1)',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px',
                    marginBottom: 10
                  }}>
                    <div style={{ fontSize: '0.78rem', color: '#fb923c', fontWeight: 700, marginBottom: 8 }}>
                      ★ Crowd Attraction / Showcase Magnet
                    </div>
                    <div className="form-row">
                      <label style={{ color: '#78350f' }}>Dwell Time (seconds crowd lingers)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={currentSelectedData.dwellSeconds || 5}
                        onChange={(e) => updateLayoutObject(selectedObj.type, selectedObj.id, { dwellSeconds: Math.max(1, parseInt(e.target.value, 10) || 5) })}
                        className="cf-input"
                      />
                    </div>
                    <div className="form-row" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#78350f' }}>Attraction Pull (0.1 - 1.0)</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="1.0"
                        value={currentSelectedData.attractionStrength || 0.75}
                        onChange={(e) => updateLayoutObject(selectedObj.type, selectedObj.id, { attractionStrength: parseFloat(e.target.value) || 0.75 })}
                        className="cf-input"
                      />
                    </div>
                  </div>
                )}

                <div className="inspector-actions">
                  <button
                    className="btn-danger w-full"
                    onClick={() => {
                      deleteLayoutObject(selectedObj.type, selectedObj.id);
                      setSelectedObj(null);
                    }}
                  >
                    <Trash2 size={15} />
                    <span>Delete Object</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-inspector">
                <HelpCircle size={32} className="text-muted" />
                <p>Select any object on the canvas or pick a tool from the left palette to add walls, booths, or gates.</p>
              </div>
            )}
          </div>

          {/* Scale & Geometry Configuration */}
          <div className="inspector-box">
            <div className="box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Maximize2 size={16} style={{ color: '#2563eb' }} />
                <span className="box-title">Scale & Venue Calibration</span>
              </div>
            </div>
            <div className="scale-meta" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 0' }}>
              <div className="scale-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#475569' }}>Total Width (m):</span>
                <input
                  type="number"
                  min="5"
                  max="2000"
                  value={venueDims.widthMeters}
                  onChange={(e) => handleScaleWidthChange(e.target.value)}
                  style={{ width: 84, padding: '3px 6px', fontSize: '0.82rem', borderRadius: 4, border: '1px solid #cbd5e1', textAlign: 'right' }}
                />
              </div>
              <div className="scale-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#475569' }}>Total Length (m):</span>
                <input
                  type="number"
                  min="5"
                  max="2000"
                  value={venueDims.heightMeters}
                  onChange={(e) => handleScaleHeightChange(e.target.value)}
                  style={{ width: 84, padding: '3px 6px', fontSize: '0.82rem', borderRadius: 4, border: '1px solid #cbd5e1', textAlign: 'right' }}
                />
              </div>
              <div className="scale-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-body)' }}>Floor Area (m²):</span>
                <input
                  type="number"
                  min="20"
                  max="500000"
                  value={venueDims.floorAreaM2}
                  onChange={(e) => handleScaleAreaChange(e.target.value)}
                  style={{ width: 96, padding: '3px 6px', fontSize: '0.84rem', fontWeight: 700, borderRadius: 4, border: '1px solid var(--border-card)', background: 'var(--bg-subtle)', color: '#fb923c', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div className="scale-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                <span>Pixel Ratio:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>20 px / meter</strong>
              </div>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={handleSaveVenueScale}
                style={{ marginTop: 4, padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <Check size={13} /> Update Floor Dimensions
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment Success Modal */}
      {showDeploySuccessModal && (
        <div className="cf-modal-overlay">
          <div className="cf-modal-content" style={{ maxWidth: 480, textAlign: 'center', padding: '24px 28px' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--green-subtle)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: 'var(--green-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.25)'
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: 8 }}>
              Layout Saved & Deployed!
            </h3>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-body)', lineHeight: 1.5, marginBottom: 20 }}>
              The venue floor plan has been saved to the database and deployed to both the <strong>Simulation</strong> page and the <strong>Live Monitoring</strong> page. All walls, stalls, portals, and monitoring zones have been synchronized.
            </p>

            <div style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: '0.82rem',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-around',
              fontFamily: 'var(--font-mono)'
            }}>
              <div><strong>{venue.walls?.length || 0}</strong> Walls</div>
              <div><strong>{venue.stalls?.length || 0}</strong> Booths</div>
              <div><strong>{venue.entrances?.length || 0}</strong> Gates</div>
              <div><strong>{venue.exits?.length || 0}</strong> Exits</div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowDeploySuccessModal(false);
                  setActiveTab('simulation');
                }}
                style={{ flex: 1, padding: '10px 14px' }}
              >
                <span>View Simulation →</span>
              </button>
              <button
                className="btn-primary-glow"
                onClick={() => {
                  setShowDeploySuccessModal(false);
                  setActiveTab('monitoring');
                }}
                style={{ flex: 1, padding: '10px 14px' }}
              >
                <span>View Live Monitoring →</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowDeploySuccessModal(false)}
                style={{ padding: '10px 14px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Elements Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="cf-modal-overlay">
          <div className="cf-modal-content" style={{ maxWidth: 430, textAlign: 'center', padding: '24px 28px' }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'var(--red-subtle)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: 'var(--red-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.25)'
            }}>
              <Trash2 size={26} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: 8 }}>
              Clear All Layout Elements?
            </h3>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-body)', lineHeight: 1.5, marginBottom: 20 }}>
              This will instantly remove all <strong>{venue.walls?.length || 0} walls</strong>, <strong>{venue.stalls?.length || 0} booths/stalls</strong>, <strong>{venue.entrances?.length || 0} entrance gates</strong>, and <strong>{venue.exits?.length || 0} exits</strong> from your current floor plan.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="btn-danger"
                onClick={handleClearAllElements}
                style={{ flex: 1, padding: '10px 14px', background: 'var(--red)', color: '#fff', fontWeight: 700 }}
              >
                Yes, Delete All
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowClearConfirmModal(false)}
                style={{ flex: 1, padding: '10px 14px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
