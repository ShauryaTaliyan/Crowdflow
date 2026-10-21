/**
 * CrowdFlow — Pedestrian Crowd Dynamics Simulation Prototype
 * 
 * A reliable, educational, obstacle-aware crowd simulation prototype.
 * Uses HTML5 Canvas, Potential/Flow Fields for pathfinding, and local social separation.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONFIGURATION & CONSTANTS
  // ==========================================================================

  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 620;
  const NAV_CELL_SIZE = 20; // 20px grid for navigation vector field (50 cols x 31 rows)
  const HEATMAP_CELL_SIZE = 25; // 25px grid for density calculation (40 cols x 25 rows)

  const COLS = Math.floor(CANVAS_WIDTH / NAV_CELL_SIZE);
  const ROWS = Math.floor(CANVAS_HEIGHT / NAV_CELL_SIZE);

  const HEATMAP_COLS = Math.floor(CANVAS_WIDTH / HEATMAP_CELL_SIZE);
  const HEATMAP_ROWS = Math.floor(CANVAS_HEIGHT / HEATMAP_CELL_SIZE);

  // Density thresholds (pedestrians per 25x25px cell)
  const DENSITY_THRESH_LOW = 0.5;
  const DENSITY_THRESH_MODERATE = 1.8;
  const DENSITY_THRESH_HIGH = 3.5;
  const DENSITY_THRESH_BOTTLENECK = 5.0;

  // ==========================================================================
  // 2. VENUE PRESETS
  // ==========================================================================

  const VENUE_PRESETS = {
    exhibition: {
      name: "Exhibition Hall A",
      details: "1000m² Floor Plan • 2 Entrances • 2 Exits • 6 Exhibition Booths",
      walls: [
        // Perimeter walls with openings for entrances and exits
        // Top perimeter wall
        { x: 0, y: 0, w: 1000, h: 14 },
        // Bottom perimeter wall
        { x: 0, y: 606, w: 1000, h: 14 },
        // Left perimeter wall segments (leaving gaps at y: 110-210 and y: 410-510)
        { x: 0, y: 0, w: 14, h: 110 },
        { x: 0, y: 210, w: 14, h: 200 },
        { x: 0, y: 510, w: 14, h: 110 },
        // Right perimeter wall segments (leaving gaps at y: 110-210 and y: 410-510)
        { x: 986, y: 0, w: 14, h: 110 },
        { x: 986, y: 210, w: 14, h: 200 },
        { x: 986, y: 510, w: 14, h: 110 }
      ],
      entrances: [
        { id: "ent1", name: "Entrance A (North-West)", x: 2, y: 116, w: 26, h: 88, spawnX: 30, spawnY: 160 },
        { id: "ent2", name: "Entrance B (South-West)", x: 2, y: 416, w: 26, h: 88, spawnX: 30, spawnY: 460 }
      ],
      exits: [
        { id: "exit1", name: "Exit A (North-East)", x: 972, y: 116, w: 26, h: 88, targetX: 985, targetY: 160 },
        { id: "exit2", name: "Exit B (South-East)", x: 972, y: 416, w: 26, h: 88, targetX: 985, targetY: 460 }
      ],
      stalls: [
        // Top Left: Tech Zone
        { name: "Robotics & AI Zone", x: 150, y: 70, w: 180, h: 130, color: "#e2e8f0", accent: "#3b82f6" },
        // Bottom Left: BioTech
        { name: "Green Energy Hub", x: 150, y: 420, w: 180, h: 130, color: "#e2e8f0", accent: "#10b981" },
        // Central Feature: Round Information & Coffee Kiosk (creating central corridor split)
        { name: "Central Info & Café", x: 440, y: 240, w: 120, h: 140, color: "#cbd5e1", accent: "#f59e0b", isRound: false },
        // Top Center: Innovation Stage
        { name: "Keynote Pavilion", x: 410, y: 40, w: 180, h: 90, color: "#e2e8f0", accent: "#8b5cf6" },
        // Bottom Center: Media Lounge
        { name: "Media & Press Lounge", x: 410, y: 490, w: 180, h: 90, color: "#e2e8f0", accent: "#ec4899" },
        // Top Right: VR & Gaming Expo
        { name: "Smart Devices Expo", x: 670, y: 70, w: 180, h: 130, color: "#e2e8f0", accent: "#06b6d4" },
        // Bottom Right: Aerospace
        { name: "Aerospace Showcase", x: 670, y: 420, w: 180, h: 130, color: "#e2e8f0", accent: "#6366f1" }
      ]
    },

    transit: {
      name: "Transit Station Concourse",
      details: "Simulating Train Station Chokepoints • Ticket Turnstiles & Platforms",
      walls: [
        { x: 0, y: 0, w: 1000, h: 14 },
        { x: 0, y: 606, w: 1000, h: 14 },
        { x: 0, y: 0, w: 14, h: 110 },
        { x: 0, y: 210, w: 14, h: 200 },
        { x: 0, y: 510, w: 14, h: 110 },
        { x: 986, y: 0, w: 14, h: 110 },
        { x: 986, y: 210, w: 14, h: 200 },
        { x: 986, y: 510, w: 14, h: 110 },
        // Central Fare Barrier Wall with 3 narrow turnstile gates
        { x: 480, y: 14, w: 20, h: 130 },
        { x: 480, y: 210, w: 20, h: 80 },
        { x: 480, y: 350, w: 20, h: 80 },
        { x: 480, y: 490, w: 20, h: 120 }
      ],
      entrances: [
        { id: "ent1", name: "Ticketing Concourse West A", x: 2, y: 116, w: 26, h: 88, spawnX: 30, spawnY: 160 },
        { id: "ent2", name: "Ticketing Concourse West B", x: 2, y: 416, w: 26, h: 88, spawnX: 30, spawnY: 460 }
      ],
      exits: [
        { id: "exit1", name: "Platform 1 & 2 Escalators", x: 972, y: 116, w: 26, h: 88, targetX: 985, targetY: 160 },
        { id: "exit2", name: "Platform 3 & 4 Escalators", x: 972, y: 416, w: 26, h: 88, targetX: 985, targetY: 460 }
      ],
      stalls: [
        { name: "Ticket Machines A", x: 140, y: 80, w: 160, h: 120, color: "#e2e8f0", accent: "#0284c7" },
        { name: "Ticket Machines B", x: 140, y: 420, w: 160, h: 120, color: "#e2e8f0", accent: "#0284c7" },
        { name: "Customer Service Booth", x: 220, y: 250, w: 120, h: 120, color: "#cbd5e1", accent: "#d97706" },
        { name: "Departure Board & Waiting", x: 640, y: 100, w: 200, h: 110, color: "#e2e8f0", accent: "#059669" },
        { name: "Coffee & Newsstand", x: 640, y: 410, w: 200, h: 110, color: "#e2e8f0", accent: "#ea580c" }
      ]
    },

    plaza: {
      name: "Multi-Aisle Shopping Mall",
      details: "Multi-Anchor Commercial Atrium • Central Plaza & Retail Corridors",
      walls: [
        { x: 0, y: 0, w: 1000, h: 14 },
        { x: 0, y: 606, w: 1000, h: 14 },
        { x: 0, y: 0, w: 14, h: 110 },
        { x: 0, y: 210, w: 14, h: 200 },
        { x: 0, y: 510, w: 14, h: 110 },
        { x: 986, y: 0, w: 14, h: 110 },
        { x: 986, y: 210, w: 14, h: 200 },
        { x: 986, y: 510, w: 14, h: 110 }
      ],
      entrances: [
        { id: "ent1", name: "Mall West Plaza Entrance", x: 2, y: 116, w: 26, h: 88, spawnX: 30, spawnY: 160 },
        { id: "ent2", name: "Metro Link West Entrance", x: 2, y: 416, w: 26, h: 88, spawnX: 30, spawnY: 460 }
      ],
      exits: [
        { id: "exit1", name: "East Avenue Boulevard", x: 972, y: 116, w: 26, h: 88, targetX: 985, targetY: 160 },
        { id: "exit2", name: "Parking Garage Link East", x: 972, y: 416, w: 26, h: 88, targetX: 985, targetY: 460 }
      ],
      stalls: [
        { name: "Department Store North", x: 140, y: 60, w: 220, h: 140, color: "#e2e8f0", accent: "#2563eb" },
        { name: "Supermarket South", x: 140, y: 420, w: 220, h: 140, color: "#e2e8f0", accent: "#16a34a" },
        { name: "Center Fountain & Seating", x: 450, y: 240, w: 100, h: 140, color: "#cbd5e1", accent: "#0284c7" },
        { name: "Electronics Megastore", x: 640, y: 60, w: 220, h: 140, color: "#e2e8f0", accent: "#7c3aed" },
        { name: "Food Court Pavilion", x: 640, y: 420, w: 220, h: 140, color: "#e2e8f0", accent: "#dc2626" }
      ]
    }
  };

  // ==========================================================================
  // 3. STATE & DATA STRUCTURES
  // ==========================================================================

  const state = {
    isRunning: false,
    isPaused: false,
    animationFrameId: null,
    lastTimestamp: 0,
    elapsedSeconds: 0,
    
    // Configurable parameters
    currentPresetKey: "exhibition",
    targetCrowdSize: 80,
    walkingSpeedMultiplier: 1.0,
    simClockRate: 1, // 1x, 2x, 4x

    // Visualization toggles
    showHeatmap: true,
    showBottlenecks: true,
    showFlowVectors: false,
    showLegend: true,

    // Statistics
    totalExited: 0,
    currentActive: 0,
    activeHotspotsCount: 0,
    hotspotLocations: [],
    densityValue: 0.0,
    fps: 60,
    fpsCounter: 0,
    fpsTimer: 0,

    // Collections
    pedestrians: [],
    nextPedestrianId: 1
  };

  // Navigation & Density Grids
  let navGrid = []; // [ROWS][COLS] - true = blocked, false = walkable
  let flowFieldExitA = []; // [ROWS][COLS] - { dx, dy, dist }
  let flowFieldExitB = []; // [ROWS][COLS] - { dx, dy, dist }
  let densityGrid = []; // [HEATMAP_ROWS][HEATMAP_COLS] - smoothed density count

  // ==========================================================================
  // 4. DOM ELEMENTS
  // ==========================================================================

  const dom = {
    canvas: document.getElementById('simulationCanvas'),
    ctx: null,
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    venuePreset: document.getElementById('venuePreset'),
    currentVenueName: document.getElementById('currentVenueName'),
    currentVenueDetails: document.getElementById('currentVenueDetails'),
    
    // Stats
    statActive: document.getElementById('statActive'),
    statActiveSub: document.getElementById('statActiveSub'),
    statExited: document.getElementById('statExited'),
    statDensity: document.getElementById('statDensity'),
    statDensityRating: document.getElementById('statDensityRating'),
    statHotspots: document.getElementById('statHotspots'),
    statHotspotsDesc: document.getElementById('statHotspotsDesc'),
    statTime: document.getElementById('statTime'),
    statFps: document.getElementById('statFps'),

    // Buttons
    btnStart: document.getElementById('btnStart'),
    btnPause: document.getElementById('btnPause'),
    btnReset: document.getElementById('btnReset'),
    btnToggleLegend: document.getElementById('btnToggleLegend'),
    btnCloseLegend: document.getElementById('btnCloseLegend'),
    congestionLegend: document.getElementById('congestionLegend'),

    // Sliders
    sliderCrowdSize: document.getElementById('sliderCrowdSize'),
    valCrowdSize: document.getElementById('valCrowdSize'),
    sliderSpeed: document.getElementById('sliderSpeed'),
    valSpeed: document.getElementById('valSpeed'),

    // Toggles
    toggleHeatmap: document.getElementById('toggleHeatmap'),
    toggleCongestionZones: document.getElementById('toggleCongestionZones'),
    toggleFlowVectors: document.getElementById('toggleFlowVectors'),
    simRateChips: document.querySelectorAll('.sim-rate-options .btn-chip'),
    
    // Log box
    systemLogBox: document.getElementById('systemLogBox')
  };

  // ==========================================================================
  // 5. GRID & FLOW FIELD ENGINE (DIJKSTRA / BFS POTENTIAL FIELD)
  // ==========================================================================

  /**
   * Builds the navigation grid and computes smooth flow fields toward exits.
   */
  function buildNavigationEngine() {
    const venue = VENUE_PRESETS[state.currentPresetKey];

    // 1. Initialize Nav Grid
    navGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    // Mark walls as blocked
    venue.walls.forEach(w => markRectBlocked(w.x, w.y, w.w, w.h, 2));

    // Mark stalls as blocked
    venue.stalls.forEach(s => markRectBlocked(s.x, s.y, s.w, s.h, 2));

    // Ensure entrance and exit portals remain unblocked
    venue.entrances.forEach(e => unmarkPortal(e.x, e.y, e.w, e.h));
    venue.exits.forEach(e => unmarkPortal(e.x, e.y, e.w, e.h));

    // 2. Compute Flow Fields for each exit
    flowFieldExitA = computeExitFlowField(venue.exits[0]);
    flowFieldExitB = computeExitFlowField(venue.exits[1] || venue.exits[0]);

    // 3. Initialize Density Grid
    densityGrid = Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
  }

  function markRectBlocked(rx, ry, rw, rh, padding) {
    const minCol = Math.max(0, Math.floor((rx - padding) / NAV_CELL_SIZE));
    const maxCol = Math.min(COLS - 1, Math.floor((rx + rw + padding) / NAV_CELL_SIZE));
    const minRow = Math.max(0, Math.floor((ry - padding) / NAV_CELL_SIZE));
    const maxRow = Math.min(ROWS - 1, Math.floor((ry + rh + padding) / NAV_CELL_SIZE));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        navGrid[r][c] = true;
      }
    }
  }

  function unmarkPortal(rx, ry, rw, rh) {
    const minCol = Math.max(0, Math.floor(rx / NAV_CELL_SIZE));
    const maxCol = Math.min(COLS - 1, Math.floor((rx + rw) / NAV_CELL_SIZE));
    const minRow = Math.max(0, Math.floor(ry / NAV_CELL_SIZE));
    const maxRow = Math.min(ROWS - 1, Math.floor((ry + rh) / NAV_CELL_SIZE));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        navGrid[r][c] = false;
      }
    }
  }

  /**
   * Breadth-First Search distance transform to calculate optimal vector toward target exit.
   */
  function computeExitFlowField(exit) {
    const distGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(Infinity));
    const field = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

    const queue = [];
    const exitCol = Math.floor(exit.targetX / NAV_CELL_SIZE);
    const exitMinRow = Math.floor(exit.y / NAV_CELL_SIZE);
    const exitMaxRow = Math.floor((exit.y + exit.h) / NAV_CELL_SIZE);

    for (let r = exitMinRow; r <= exitMaxRow; r++) {
      if (r >= 0 && r < ROWS && exitCol >= 0 && exitCol < COLS) {
        distGrid[r][exitCol] = 0;
        queue.push({ r, c: exitCol });
      }
    }

    // Standard 4-way BFS expansion
    const dirs = [
      { dr: -1, dc: 0, cost: 1 },
      { dr: 1, dc: 0, cost: 1 },
      { dr: 0, dc: -1, cost: 1 },
      { dr: 0, dc: 1, cost: 1 }
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      const currentDist = distGrid[current.r][current.c];

      for (const d of dirs) {
        const nr = current.r + d.dr;
        const nc = current.c + d.dc;

        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          if (!navGrid[nr][nc]) { // If cell is walkable
            if (distGrid[nr][nc] > currentDist + d.cost) {
              distGrid[nr][nc] = currentDist + d.cost;
              queue.push({ r: nr, c: nc });
            }
          }
        }
      }
    }

    // Derive unit direction vectors pointing towards minimum neighbor distance
    const searchDirs = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
    ];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (navGrid[r][c] || distGrid[r][c] === Infinity) {
          field[r][c] = { dx: 0, dy: 0, dist: Infinity };
          continue;
        }

        let bestDist = distGrid[r][c];
        let bestDir = { dx: 0, dy: 0 };

        for (const sd of searchDirs) {
          const nr = r + sd.dr;
          const nc = c + sd.dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !navGrid[nr][nc]) {
            if (distGrid[nr][nc] < bestDist) {
              bestDist = distGrid[nr][nc];
              bestDir = { dx: sd.dc, dy: sd.dr };
            }
          }
        }

        const len = Math.hypot(bestDir.dx, bestDir.dy);
        if (len > 0) {
          field[r][c] = { dx: bestDir.dx / len, dy: bestDir.dy / len, dist: distGrid[r][c] };
        } else {
          // If already at exit or local minimum
          field[r][c] = { dx: 1, dy: 0, dist: distGrid[r][c] };
        }
      }
    }

    return field;
  }

  // ==========================================================================
  // 6. PEDESTRIAN AGENT CLASS & BEHAVIOR
  // ==========================================================================

  class Pedestrian {
    constructor(x, y, targetExitIndex) {
      this.id = state.nextPedestrianId++;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.radius = 4.2 + (Math.random() * 1.6); // 4.2px - 5.8px radius
      this.baseSpeed = 1.0 + (Math.random() * 0.4 - 0.2); // Individual walking variation: 0.8 - 1.2
      this.targetExitIndex = targetExitIndex; // 0 for Exit A, 1 for Exit B
      this.color = this.assignColor();
      this.stuckFrames = 0;
      this.lastPosition = { x, y };
      this.wobblePhase = Math.random() * Math.PI * 2;
    }

    assignColor() {
      // Natural human clothes palette
      const palettes = [
        '#2563eb', // Royal Blue
        '#0284c7', // Sky Blue
        '#475569', // Slate
        '#334155', // Dark Slate
        '#059669', // Emerald
        '#4f46e5', // Indigo
        '#0d9488'  // Teal
      ];
      return palettes[Math.floor(Math.random() * palettes.length)];
    }

    update(dt) {
      const venue = VENUE_PRESETS[state.currentPresetKey];
      const exitFlow = this.targetExitIndex === 0 ? flowFieldExitA : flowFieldExitB;

      // 1. Flow Field Steering
      const c = Math.floor(this.x / NAV_CELL_SIZE);
      const r = Math.floor(this.y / NAV_CELL_SIZE);

      let steerX = 1;
      let steerY = 0;

      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && exitFlow[r][c]) {
        steerX = exitFlow[r][c].dx;
        steerY = exitFlow[r][c].dy;
      }

      // Small natural gait wobble
      this.wobblePhase += 0.08;
      const wobbleX = -steerY * Math.sin(this.wobblePhase) * 0.15;
      const wobbleY = steerX * Math.sin(this.wobblePhase) * 0.15;

      const effectiveSpeed = 58 * this.baseSpeed * state.walkingSpeedMultiplier;
      let targetVx = (steerX + wobbleX) * effectiveSpeed;
      let targetVy = (steerY + wobbleY) * effectiveSpeed;

      // 2. Obstacle / Wall Avoidance Force
      const avoidForce = this.calculateWallAvoidance(venue);
      targetVx += avoidForce.x;
      targetVy += avoidForce.y;

      // 3. Smooth Velocity Acceleration
      const smoothFactor = 0.22;
      this.vx = this.vx * (1 - smoothFactor) + targetVx * smoothFactor;
      this.vy = this.vy * (1 - smoothFactor) + targetVy * smoothFactor;

      // Cap maximum velocity
      const currentSpeed = Math.hypot(this.vx, this.vy);
      const maxAllowedSpeed = effectiveSpeed * 1.5;
      if (currentSpeed > maxAllowedSpeed && maxAllowedSpeed > 0) {
        this.vx = (this.vx / currentSpeed) * maxAllowedSpeed;
        this.vy = (this.vy / currentSpeed) * maxAllowedSpeed;
      }

      // 4. Update Position
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // 5. Constrain within venue boundaries
      this.enforceBoundaryConstraints(venue);

      // 6. Anti-stuck watchdog
      const movedDist = Math.hypot(this.x - this.lastPosition.x, this.y - this.lastPosition.y);
      if (movedDist < 0.2) {
        this.stuckFrames++;
        if (this.stuckFrames > 45) { // If stuck for nearly a second
          // Give a nudge perpendicular to current direction
          this.x += (Math.random() - 0.5) * 4;
          this.y += (Math.random() - 0.5) * 4;
          this.stuckFrames = 0;
        }
      } else {
        this.stuckFrames = 0;
      }
      this.lastPosition.x = this.x;
      this.lastPosition.y = this.y;
    }

    calculateWallAvoidance(venue) {
      let fx = 0;
      let fy = 0;
      const senseDist = this.radius + 12;

      // Stall obstacle repulsion
      for (const s of venue.stalls) {
        const closestX = Math.max(s.x, Math.min(this.x, s.x + s.w));
        const closestY = Math.max(s.y, Math.min(this.y, s.y + s.h));
        const dx = this.x - closestX;
        const dy = this.y - closestY;
        const dist = Math.hypot(dx, dy);

        if (dist < senseDist && dist > 0.001) {
          const force = (senseDist - dist) * 75;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }

      // Perimeter walls
      for (const w of venue.walls) {
        const closestX = Math.max(w.x, Math.min(this.x, w.x + w.w));
        const closestY = Math.max(w.y, Math.min(this.y, w.y + w.h));
        const dx = this.x - closestX;
        const dy = this.y - closestY;
        const dist = Math.hypot(dx, dy);

        if (dist < senseDist && dist > 0.001) {
          const force = (senseDist - dist) * 85;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }

      return { x: fx, y: fy };
    }

    enforceBoundaryConstraints(venue) {
      // Hard clamp inside canvas
      if (this.x < this.radius) this.x = this.radius;
      if (this.x > CANVAS_WIDTH - this.radius) this.x = CANVAS_WIDTH - this.radius;
      if (this.y < this.radius + 14) this.y = this.radius + 14;
      if (this.y > CANVAS_HEIGHT - this.radius - 14) this.y = CANVAS_HEIGHT - this.radius - 14;

      // Hard push out of stalls if any overlap occurs
      for (const s of venue.stalls) {
        if (
          this.x + this.radius > s.x &&
          this.x - this.radius < s.x + s.w &&
          this.y + this.radius > s.y &&
          this.y - this.radius < s.y + s.h
        ) {
          // Push out along the shortest penetration vector
          const overlapLeft = (this.x + this.radius) - s.x;
          const overlapRight = (s.x + s.w) - (this.x - this.radius);
          const overlapTop = (this.y + this.radius) - s.y;
          const overlapBottom = (s.y + s.h) - (this.y - this.radius);

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          if (minOverlap === overlapLeft) this.x = s.x - this.radius;
          else if (minOverlap === overlapRight) this.x = s.x + s.w + this.radius;
          else if (minOverlap === overlapTop) this.y = s.y - this.radius;
          else this.y = s.y + s.h + this.radius;
        }
      }
    }

    hasReachedExit(venue) {
      for (const exit of venue.exits) {
        if (
          this.x >= exit.x - 4 &&
          this.x <= exit.x + exit.w + 12 &&
          this.y >= exit.y - 10 &&
          this.y <= exit.y + exit.h + 10
        ) {
          return true;
        }
      }
      return false;
    }

    draw(ctx) {
      // Drop shadow for depth
      ctx.beginPath();
      ctx.arc(this.x + 0.8, this.y + 1.2, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fill();

      // Pedestrian Body
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();

      // Border outline
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Direction indicator (small subtle nose/heading pip)
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > 5) {
        const dirX = this.vx / speed;
        const dirY = this.vy / speed;
        ctx.beginPath();
        ctx.arc(this.x + dirX * (this.radius * 0.7), this.y + dirY * (this.radius * 0.7), 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
  }

  // ==========================================================================
  // 7. PEDESTRIAN-PEDESTRIAN COLLISION & SEPARATION (SOCIAL FORCE)
  // ==========================================================================

  function resolvePedestrianSeparation(pedestrians) {
    const n = pedestrians.length;
    // Spatial grid binning for high efficiency: O(N) rather than O(N^2)
    const BIN_SIZE = 30;
    const gridCols = Math.ceil(CANVAS_WIDTH / BIN_SIZE);
    const gridRows = Math.ceil(CANVAS_HEIGHT / BIN_SIZE);
    const bins = Array.from({ length: gridRows * gridCols }, () => []);

    for (let i = 0; i < n; i++) {
      const p = pedestrians[i];
      const bx = Math.floor(p.x / BIN_SIZE);
      const by = Math.floor(p.y / BIN_SIZE);
      if (bx >= 0 && bx < gridCols && by >= 0 && by < gridRows) {
        bins[by * gridCols + bx].push(p);
      }
    }

    // Check adjacent bins
    for (let by = 0; by < gridRows; by++) {
      for (let bx = 0; bx < gridCols; bx++) {
        const binIndex = by * gridCols + bx;
        const currentBin = bins[binIndex];
        if (currentBin.length === 0) continue;

        // Neighboring bins
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = (dy === 0 ? 0 : -1); dx <= 1; dx++) {
            const nbx = bx + dx;
            const nby = by + dy;
            if (nbx >= 0 && nbx < gridCols && nby >= 0 && nby < gridRows) {
              const otherBin = bins[nby * gridCols + nbx];
              
              const sameBin = (nbx === bx && nby === by);
              const limitA = currentBin.length;
              const limitB = otherBin.length;

              for (let i = 0; i < limitA; i++) {
                const p1 = currentBin[i];
                const startJ = sameBin ? i + 1 : 0;
                for (let j = startJ; j < limitB; j++) {
                  const p2 = otherBin[j];

                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  const dist = Math.hypot(dx, dy);
                  const minDist = p1.radius + p2.radius + 1.5;

                  if (dist < minDist && dist > 0.0001) {
                    // Soft elastic separation
                    const overlap = (minDist - dist);
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const sepFactor = 0.5;
                    p1.x -= nx * overlap * sepFactor;
                    p1.y -= ny * overlap * sepFactor;
                    p2.x += nx * overlap * sepFactor;
                    p2.y += ny * overlap * sepFactor;

                    // Relative velocity damping
                    const rvx = p2.vx - p1.vx;
                    const rvy = p2.vy - p1.vy;
                    const normalVel = rvx * nx + rvy * ny;
                    if (normalVel < 0) {
                      p1.vx += nx * normalVel * 0.3;
                      p1.vy += ny * normalVel * 0.3;
                      p2.vx -= nx * normalVel * 0.3;
                      p2.vy -= ny * normalVel * 0.3;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // ==========================================================================
  // 8. SPAWNER & CROWD POPULATION MANAGEMENT
  // ==========================================================================

  let spawnTimer = 0;

  function manageCrowdPopulation(dt) {
    const venue = VENUE_PRESETS[state.currentPresetKey];
    const currentCount = state.pedestrians.length;
    const targetCount = state.targetCrowdSize;

    // Spawn new pedestrians if below target
    if (currentCount < targetCount) {
      spawnTimer += dt * state.simClockRate;
      // Controlled spawn interval: e.g. 1 pedestrian every 0.12s
      if (spawnTimer >= 0.12) {
        spawnTimer = 0;
        const entranceIndex = Math.floor(Math.random() * venue.entrances.length);
        const entrance = venue.entrances[entranceIndex];

        // Slight spawn point jitter around entrance gate
        const jitterY = (Math.random() - 0.5) * (entrance.h * 0.6);
        const spawnX = entrance.spawnX + (Math.random() * 10);
        const spawnY = entrance.spawnY + jitterY;

        // Alternate or balance exit targets
        const targetExit = Math.random() < 0.5 ? 0 : 1;
        state.pedestrians.push(new Pedestrian(spawnX, spawnY, targetExit));
      }
    }
  }

  // ==========================================================================
  // 9. DENSITY HEATMAP & BOTTLENECK DETECTION
  // ==========================================================================

  function updateDensityAndCongestion() {
    // 1. Reset frame counts
    const counts = Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));

    for (let i = 0; i < state.pedestrians.length; i++) {
      const p = state.pedestrians[i];
      const col = Math.floor(p.x / HEATMAP_CELL_SIZE);
      const row = Math.floor(p.y / HEATMAP_CELL_SIZE);
      if (row >= 0 && row < HEATMAP_ROWS && col >= 0 && col < HEATMAP_COLS) {
        counts[row][col]++;
      }
    }

    // 2. Exponential Moving Average to prevent visual flickering
    const smoothingAlpha = 0.14;
    let totalDensitySum = 0;
    let walkableCellCount = 0;
    let detectedHotspots = 0;
    const hotspotList = [];

    for (let r = 0; r < HEATMAP_ROWS; r++) {
      for (let c = 0; c < HEATMAP_COLS; c++) {
        // Approximate whether this density cell is walkable
        const navR = Math.min(ROWS - 1, Math.floor((r * HEATMAP_CELL_SIZE) / NAV_CELL_SIZE));
        const navC = Math.min(COLS - 1, Math.floor((c * HEATMAP_CELL_SIZE) / NAV_CELL_SIZE));

        if (!navGrid[navR][navC]) {
          walkableCellCount++;
          densityGrid[r][c] = densityGrid[r][c] * (1 - smoothingAlpha) + counts[r][c] * smoothingAlpha;
          totalDensitySum += densityGrid[r][c];

          // Bottleneck threshold check
          if (densityGrid[r][c] >= DENSITY_THRESH_HIGH) {
            detectedHotspots++;
            hotspotList.push({
              x: (c + 0.5) * HEATMAP_CELL_SIZE,
              y: (r + 0.5) * HEATMAP_CELL_SIZE,
              intensity: densityGrid[r][c]
            });
          }
        } else {
          densityGrid[r][c] = 0;
        }
      }
    }

    // 3. Update global density metrics
    state.activeHotspotsCount = detectedHotspots;
    state.hotspotLocations = hotspotList;

    // Density per 100m² metric (assuming 1 cell is ~2m x 2m = 4m²; 25 cells = 100m²)
    if (walkableCellCount > 0) {
      state.densityValue = (state.pedestrians.length / (walkableCellCount * 4)) * 100;
    } else {
      state.densityValue = 0;
    }
  }

  function drawHeatmap(ctx) {
    if (!state.showHeatmap) return;

    for (let r = 0; r < HEATMAP_ROWS; r++) {
      for (let c = 0; c < HEATMAP_COLS; c++) {
        const val = densityGrid[r][c];
        if (val < DENSITY_THRESH_LOW) continue;

        const x = c * HEATMAP_CELL_SIZE;
        const y = r * HEATMAP_CELL_SIZE;

        let fillColor;
        if (val < DENSITY_THRESH_MODERATE) {
          // Low: Green
          const alpha = Math.min(0.38, 0.15 + (val / DENSITY_THRESH_MODERATE) * 0.2);
          fillColor = `rgba(34, 197, 94, ${alpha})`;
        } else if (val < DENSITY_THRESH_HIGH) {
          // Moderate: Yellow
          const alpha = 0.45;
          fillColor = `rgba(234, 179, 8, ${alpha})`;
        } else if (val < DENSITY_THRESH_BOTTLENECK) {
          // High: Orange
          const alpha = 0.62;
          fillColor = `rgba(249, 115, 22, ${alpha})`;
        } else {
          // Bottleneck / Very High: Red
          const alpha = 0.78;
          fillColor = `rgba(239, 68, 68, ${alpha})`;
        }

        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, HEATMAP_CELL_SIZE, HEATMAP_CELL_SIZE);
      }
    }
  }

  function drawBottleneckIndicators(ctx) {
    if (!state.showBottlenecks || state.hotspotLocations.length === 0) return;

    const pulse = (Math.sin(Date.now() / 200) + 1) * 0.5; // 0 to 1 smooth pulse

    ctx.save();
    for (const spot of state.hotspotLocations) {
      const ringRadius = 14 + pulse * 6;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.5})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Center exclamation point or warning dot
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFlowVectors(ctx) {
    if (!state.showFlowVectors) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.22)';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 1;

    for (let r = 0; r < ROWS; r += 2) {
      for (let c = 0; c < COLS; c += 2) {
        if (navGrid[r][c]) continue;
        const vec = flowFieldExitA[r][c];
        if (!vec || (vec.dx === 0 && vec.dy === 0)) continue;

        const x = (c + 0.5) * NAV_CELL_SIZE;
        const y = (r + 0.5) * NAV_CELL_SIZE;
        const len = 9;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + vec.dx * len, y + vec.dy * len);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ==========================================================================
  // 10. VENUE RENDERING (WALLS, STALLS, GATES, LABELS)
  // ==========================================================================

  function drawVenue(ctx) {
    const venue = VENUE_PRESETS[state.currentPresetKey];

    // 1. Venue Floor (Clean architectural grid)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle floor tile grid pattern
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // 2. Exhibition Stalls / Booths
    venue.stalls.forEach(s => {
      // Stall shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(s.x + 2, s.y + 3, s.w, s.h);

      // Stall body
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.w, s.h);

      // Accent border
      ctx.strokeStyle = s.accent;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(s.x, s.y, s.w, s.h);

      // Header strip
      ctx.fillStyle = s.accent;
      ctx.fillRect(s.x, s.y, s.w, 18);

      // Stall label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9.5px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(s.name.toUpperCase(), s.x + 6, s.y + 13);

      // Sub-label / stall footprint icon
      ctx.fillStyle = '#475569';
      ctx.font = '9px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[ BOOTH AREA ]', s.x + s.w / 2, s.y + s.h / 2 + 4);
    });

    // 3. Perimeter Walls
    ctx.fillStyle = '#334155';
    venue.walls.forEach(w => {
      ctx.fillRect(w.x, w.y, w.w, w.h);
    });

    // 4. Entrances (Green themed portals)
    venue.entrances.forEach(e => {
      // Portal floor highlight
      ctx.fillStyle = 'rgba(22, 163, 74, 0.15)';
      ctx.fillRect(e.x, e.y, e.w, e.h);

      // Inflow chevron arrows
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x + 6, e.y + e.h * 0.3);
      ctx.lineTo(e.x + e.w - 6, e.y + e.h * 0.5);
      ctx.lineTo(e.x + 6, e.y + e.h * 0.7);
      ctx.stroke();

      // Entrance Boundary Lines
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x + e.w, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h);
      ctx.stroke();

      // Label Tag
      ctx.fillStyle = '#16a34a';
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(e.name, e.x + e.w + 6, e.y + e.h / 2 + 3);
    });

    // 5. Exits (Red themed portals)
    venue.exits.forEach(e => {
      // Portal floor highlight
      ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
      ctx.fillRect(e.x, e.y, e.w, e.h);

      // Outflow chevron arrows
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x + 6, e.y + e.h * 0.3);
      ctx.lineTo(e.x + e.w - 6, e.y + e.h * 0.5);
      ctx.lineTo(e.x + 6, e.y + e.h * 0.7);
      ctx.stroke();

      // Exit Boundary Lines
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x, e.y + e.h);
      ctx.stroke();

      // Label Tag
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(e.name, e.x - 8, e.y + e.h / 2 + 3);
    });
  }

  // ==========================================================================
  // 11. MAIN ANIMATION & SIMULATION STEP
  // ==========================================================================

  function simulationStep(timestamp) {
    if (!state.isRunning) return;

    if (!state.lastTimestamp) {
      state.lastTimestamp = timestamp;
    }

    // Delta time in seconds, clamped to avoid huge step jumps during tab switches
    const rawDt = (timestamp - state.lastTimestamp) / 1000;
    state.lastTimestamp = timestamp;
    const dt = Math.min(rawDt, 0.05) * state.simClockRate;

    // Track FPS
    state.fpsCounter++;
    state.fpsTimer += rawDt;
    if (state.fpsTimer >= 1.0) {
      state.fps = Math.round(state.fpsCounter / state.fpsTimer);
      state.fpsCounter = 0;
      state.fpsTimer = 0;
      dom.statFps.textContent = `${state.fps} FPS`;
    }

    // 1. Advance simulation clock
    state.elapsedSeconds += dt;

    // 2. Manage crowd spawning
    manageCrowdPopulation(dt);

    // 3. Update pedestrian movement & physics
    const venue = VENUE_PRESETS[state.currentPresetKey];
    const survivingPedestrians = [];

    for (let i = 0; i < state.pedestrians.length; i++) {
      const p = state.pedestrians[i];
      p.update(dt);

      if (p.hasReachedExit(venue)) {
        state.totalExited++;
      } else {
        survivingPedestrians.push(p);
      }
    }

    state.pedestrians = survivingPedestrians;

    // 4. Resolve multi-agent separation
    resolvePedestrianSeparation(state.pedestrians);

    // 5. Calculate density & congestion hotspots
    updateDensityAndCongestion();

    // 6. Render Canvas
    renderScene();

    // 7. Update Live Dashboard Statistics
    updateDashboardUI();

    // 8. Request next frame
    state.animationFrameId = requestAnimationFrame(simulationStep);
  }

  function renderScene() {
    const ctx = dom.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Layer 1: Venue Architecture
    drawVenue(ctx);

    // Layer 2: Flow Field Corridors (optional toggle)
    drawFlowVectors(ctx);

    // Layer 3: Density Heatmap Overlay
    drawHeatmap(ctx);

    // Layer 4: Bottleneck Warning Rings
    drawBottleneckIndicators(ctx);

    // Layer 5: Pedestrians
    for (let i = 0; i < state.pedestrians.length; i++) {
      state.pedestrians[i].draw(ctx);
    }
  }

  // ==========================================================================
  // 12. LIVE DASHBOARD UI UPDATES
  // ==========================================================================

  function updateDashboardUI() {
    // Active Pedestrians
    dom.statActive.textContent = state.pedestrians.length;
    dom.statActiveSub.textContent = `Target: ${state.targetCrowdSize}`;

    // Total Exited
    dom.statExited.textContent = state.totalExited;

    // Average Density
    dom.statDensity.innerHTML = `${state.densityValue.toFixed(2)} <span class="stat-unit">p/100m²</span>`;
    if (state.densityValue < 1.0) {
      dom.statDensityRating.textContent = "Level: Clear Flow";
      dom.statDensityRating.style.color = "var(--text-muted)";
    } else if (state.densityValue < 2.5) {
      dom.statDensityRating.textContent = "Level: Moderate Flow";
      dom.statDensityRating.style.color = "var(--warning)";
    } else {
      dom.statDensityRating.textContent = "Level: High Density";
      dom.statDensityRating.style.color = "var(--danger)";
    }

    // Congestion Hotspots
    dom.statHotspots.textContent = state.activeHotspotsCount;
    if (state.activeHotspotsCount === 0) {
      dom.statHotspotsDesc.textContent = "No bottlenecks detected";
      dom.statHotspots.classList.remove('stat-alert');
    } else {
      dom.statHotspotsDesc.textContent = `${state.activeHotspotsCount} bottleneck zone${state.activeHotspotsCount > 1 ? 's' : ''} active`;
      dom.statHotspots.classList.add('stat-alert');
    }

    // Elapsed Time
    const totalSec = Math.floor(state.elapsedSeconds);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    dom.statTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function addLogEntry(message, level = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.textContent = `[${timeStr}] ${message}`;
    dom.systemLogBox.appendChild(entry);
    dom.systemLogBox.scrollTop = dom.systemLogBox.scrollHeight;
  }

  function setStatus(status, label) {
    dom.statusDot.className = `status-dot ${status}`;
    dom.statusText.textContent = label;
  }

  // ==========================================================================
  // 13. USER CONTROLS & INTERACTION HANDLERS
  // ==========================================================================

  function startSimulation() {
    if (state.isRunning) return;

    state.isRunning = true;
    state.isPaused = false;
    state.lastTimestamp = 0;

    // UI Updates
    dom.btnStart.disabled = true;
    dom.btnPause.disabled = false;
    dom.btnReset.disabled = false;

    setStatus('running', 'Simulating Crowd Flow');
    addLogEntry(`Simulation started. Target crowd: ${state.targetCrowdSize} pedestrians.`, 'info');

    // Cancel any accidental duplicate loop
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
    }
    state.animationFrameId = requestAnimationFrame(simulationStep);
  }

  function pauseSimulation() {
    if (!state.isRunning) return;

    state.isRunning = false;
    state.isPaused = true;

    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }

    // UI Updates
    dom.btnStart.disabled = false;
    dom.btnPause.disabled = true;
    dom.btnReset.disabled = false;

    setStatus('paused', 'Simulation Paused');
    addLogEntry('Simulation paused.', 'warn');
  }

  function resetSimulation() {
    // 1. Stop animation
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }
    state.isRunning = false;
    state.isPaused = false;
    state.lastTimestamp = 0;
    state.elapsedSeconds = 0;
    state.totalExited = 0;
    state.pedestrians = [];
    state.nextPedestrianId = 1;

    // 2. Clear density grid
    densityGrid = Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));

    // 3. Seed initial pedestrians across walkable corridors
    seedInitialPedestrians();

    // 4. Update UI
    dom.btnStart.disabled = false;
    dom.btnPause.disabled = true;
    dom.btnReset.disabled = false;

    setStatus('', 'Ready to Simulate');
    addLogEntry('Simulation reset to initial state.', 'info');

    // 5. Redraw static frame
    updateDensityAndCongestion();
    renderScene();
    updateDashboardUI();
  }

  function seedInitialPedestrians() {
    const venue = VENUE_PRESETS[state.currentPresetKey];
    // Seed initial cluster at entrances and initial walkable positions
    const initialCount = Math.floor(state.targetCrowdSize * 0.4);

    for (let i = 0; i < initialCount; i++) {
      let candidateX = 0;
      let candidateY = 0;
      let isValid = false;

      // Try random positions in the left half of the venue (flowing toward east)
      for (let attempts = 0; attempts < 30; attempts++) {
        candidateX = 40 + Math.random() * 380;
        candidateY = 40 + Math.random() * (CANVAS_HEIGHT - 80);

        const r = Math.floor(candidateY / NAV_CELL_SIZE);
        const c = Math.floor(candidateX / NAV_CELL_SIZE);
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !navGrid[r][c]) {
          isValid = true;
          break;
        }
      }

      if (isValid) {
        const targetExit = Math.random() < 0.5 ? 0 : 1;
        state.pedestrians.push(new Pedestrian(candidateX, candidateY, targetExit));
      }
    }
  }

  function changeVenuePreset(presetKey) {
    if (!VENUE_PRESETS[presetKey]) return;

    state.currentPresetKey = presetKey;
    const venue = VENUE_PRESETS[presetKey];

    // Update Header labels
    dom.currentVenueName.textContent = venue.name;
    dom.currentVenueDetails.textContent = venue.details;

    // Recompute Navigation Grid & Flow Fields
    buildNavigationEngine();

    // Reset simulation
    resetSimulation();
    addLogEntry(`Loaded preset: ${venue.name}. Navigation graph rebuilt.`, 'info');
  }

  // ==========================================================================
  // 14. EVENT LISTENERS & SETUP
  // ==========================================================================

  function bindEvents() {
    // Playback Buttons
    dom.btnStart.addEventListener('click', startSimulation);
    dom.btnPause.addEventListener('click', pauseSimulation);
    dom.btnReset.addEventListener('click', resetSimulation);

    // Preset Selection
    dom.venuePreset.addEventListener('change', (e) => {
      changeVenuePreset(e.target.value);
    });

    // Crowd Size Slider
    dom.sliderCrowdSize.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.targetCrowdSize = val;
      dom.valCrowdSize.textContent = val;
      dom.statActiveSub.textContent = `Target: ${val}`;
    });

    // Walking Speed Slider
    dom.sliderSpeed.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.walkingSpeedMultiplier = val;
      dom.valSpeed.textContent = `${val.toFixed(1)}x`;
    });

    // Simulation Clock Rate (1x, 2x, 4x)
    dom.simRateChips.forEach(chip => {
      chip.addEventListener('click', () => {
        dom.simRateChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.simClockRate = parseInt(chip.getAttribute('data-rate'), 10);
        addLogEntry(`Clock rate set to ${state.simClockRate}x`, 'info');
      });
    });

    // Visual Layer Toggles
    dom.toggleHeatmap.addEventListener('change', (e) => {
      state.showHeatmap = e.target.checked;
      if (!state.isRunning) renderScene();
    });

    dom.toggleCongestionZones.addEventListener('change', (e) => {
      state.showBottlenecks = e.target.checked;
      if (!state.isRunning) renderScene();
    });

    dom.toggleFlowVectors.addEventListener('change', (e) => {
      state.showFlowVectors = e.target.checked;
      if (!state.isRunning) renderScene();
    });

    // Legend Visibility
    dom.btnToggleLegend.addEventListener('click', () => {
      state.showLegend = !state.showLegend;
      dom.congestionLegend.classList.toggle('hidden', !state.showLegend);
    });

    dom.btnCloseLegend.addEventListener('click', () => {
      state.showLegend = false;
      dom.congestionLegend.classList.add('hidden');
    });

    // Safe Canvas Resizing with Window Resize Watcher
    window.addEventListener('resize', handleCanvasResize);
  }

  function handleCanvasResize() {
    // Redraw current scene safely without coordinate distortion
    renderScene();
  }

  // ==========================================================================
  // 15. INITIALIZATION
  // ==========================================================================

  function init() {
    dom.ctx = dom.canvas.getContext('2d');
    if (!dom.ctx) {
      console.error('Failed to get 2D canvas context');
      return;
    }

    // Set canvas dimensions explicitly
    dom.canvas.width = CANVAS_WIDTH;
    dom.canvas.height = CANVAS_HEIGHT;

    // Build Navigation Grid & Flow Fields for default layout
    buildNavigationEngine();

    // Attach DOM events
    bindEvents();

    // Populate initial default crowd in paused state
    seedInitialPedestrians();
    updateDensityAndCongestion();
    renderScene();
    updateDashboardUI();

    setStatus('', 'Ready to Simulate');
    addLogEntry('CrowdFlow engine ready. Click "Start" to begin simulation.', 'info');
  }

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
