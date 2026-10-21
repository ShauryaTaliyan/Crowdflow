/**
 * CrowdFlow Simulation Engine
 * 
 * Manages pedestrian agents, social separation forces, emergent bottleneck queuing,
 * dynamic density heatmaps, and metric collection.
 */

import { CANVAS_WIDTH, CANVAS_HEIGHT, HEATMAP_CELL_SIZE, NAV_CELL_SIZE, PIXELS_PER_METER } from '../constants/presets.js';
import { sampleFlowVector, COLS, ROWS } from './navigation.js';

export const HEATMAP_COLS = Math.floor(CANVAS_WIDTH / HEATMAP_CELL_SIZE); // 40
export const HEATMAP_ROWS = Math.floor(CANVAS_HEIGHT / HEATMAP_CELL_SIZE); // 25

export class SimulationEngine {
  constructor(venue, navEngine, options = {}) {
    this.venue = venue;
    this.navEngine = navEngine;
    
    // Configurable parameters
    this.liveCameraTwinMode = options.liveCameraTwinMode !== undefined ? options.liveCameraTwinMode : false;
    this.liveCameraCount = options.liveCameraCount !== undefined ? options.liveCameraCount : 0;
    this.targetCrowdSize = this.liveCameraTwinMode ? this.liveCameraCount : (options.targetCrowdSize || 80);
    this.walkingSpeedMultiplier = options.walkingSpeedMultiplier || 1.0;
    this.simClockRate = options.simClockRate || 1; // 1x, 2x, 4x, 8x
    this.maxDurationSeconds = options.maxDurationSeconds || 0; // 0 = unlimited

    // State
    this.pedestrians = [];
    this.nextAgentId = 1;
    this.elapsedSimSeconds = 0;
    this.totalExited = 0;
    this.unreachableCount = 0;
    this.completedJourneyTimes = [];
    this.peakObservedDensity = 0;
    this.recentExitsQueue = []; // timestamped for throughput calculation

    // Density grid (smoothed)
    this.densityGrid = Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
    this.rawCountGrid = Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
    this.activeHotspots = [];

    // Time-series history for charts (records once every simulated second)
    this.timeSeriesHistory = [];
    this.lastHistoryRecordedSimTime = -1;

    // Spatial hash for social separation
    this.spatialHash = new Map();
    this.spatialCellSize = 25;

    // Seed initial population
    this.seedInitialPedestrians();
  }

  updateVenueAndNav(venue, navEngine) {
    this.venue = venue;
    this.navEngine = navEngine;
  }

  setParameters({ targetCrowdSize, walkingSpeedMultiplier, simClockRate, maxDurationSeconds, liveCameraTwinMode, liveCameraCount }) {
    if (targetCrowdSize !== undefined) this.targetCrowdSize = targetCrowdSize;
    if (walkingSpeedMultiplier !== undefined) this.walkingSpeedMultiplier = walkingSpeedMultiplier;
    if (simClockRate !== undefined) this.simClockRate = simClockRate;
    if (maxDurationSeconds !== undefined) this.maxDurationSeconds = maxDurationSeconds;
    if (liveCameraTwinMode !== undefined) this.liveCameraTwinMode = liveCameraTwinMode;
    if (liveCameraCount !== undefined) {
      this.liveCameraCount = Math.max(0, liveCameraCount);
    }
    if (this.liveCameraTwinMode) {
      this.targetCrowdSize = this.liveCameraCount;
      this.syncLiveTwinPopulation();
    }
  }

  getActiveEntrances() {
    const pure = (this.venue.entrances || []).filter(e => e.enabled !== false);
    const dual = (this.venue.dualGates || []).filter(g => g.enabled !== false);
    return [...pure, ...dual];
  }

  getActiveExits() {
    const pure = (this.venue.exits || []).filter(e => e.enabled !== false);
    const dual = (this.venue.dualGates || []).filter(g => g.enabled !== false);
    return [...pure, ...dual];
  }

  syncLiveTwinPopulation() {
    if (!this.liveCameraTwinMode) return;
    const entrances = this.getActiveEntrances();
    if (entrances.length === 0) return;

    const activeAgents = this.pedestrians.filter(p => p.status === 'active');
    const deficit = this.liveCameraCount - activeAgents.length;

    if (deficit > 0) {
      // Spawn exact number of new live twin agents
      for (let i = 0; i < deficit; i++) {
        const ent = entrances[i % entrances.length];
        this.spawnAgent(ent, true, true);
      }
    } else if (deficit < 0) {
      // Gracefully exit excess agents so population matches real camera count exactly
      let toRemove = Math.abs(deficit);
      for (let i = 0; i < this.pedestrians.length && toRemove > 0; i++) {
        if (this.pedestrians[i].status === 'active') {
          this.pedestrians[i].status = 'exited';
          toRemove--;
        }
      }
    }
  }

  seedInitialPedestrians() {
    this.pedestrians = [];
    const entrances = this.getActiveEntrances();
    if (entrances.length === 0) return;

    if (this.liveCameraTwinMode) {
      // Only simulate live individuals in the camera - no fake demo crowd!
      const count = this.liveCameraCount || 0;
      for (let i = 0; i < count; i++) {
        const ent = entrances[i % entrances.length];
        this.spawnAgent(ent, true, true);
      }
    } else {
      const initialCount = Math.min(this.targetCrowdSize, 40);
      for (let i = 0; i < initialCount; i++) {
        const ent = entrances[i % entrances.length];
        this.spawnAgent(ent, true, false);
        const p = this.pedestrians[this.pedestrians.length - 1];
        if (p && p.inwardDirX !== undefined) {
          const step = Math.floor(i / entrances.length) * 22;
          const nx = p.x + p.inwardDirX * step;
          const ny = p.y + p.inwardDirY * step;
          const c = Math.floor(nx / NAV_CELL_SIZE);
          const r = Math.floor(ny / NAV_CELL_SIZE);
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !this.navEngine?.blocked?.[r]?.[c]) {
            p.x = nx;
            p.y = ny;
          }
        }
      }
    }
  }

  spawnAgent(entrance, scatter = false, isLiveTwin = false) {
    const exits = this.getActiveExits();
    // For dual gates, prefer targeting a different exit across the venue so agents cross the hall
    const otherExits = exits.filter(e => e.id !== entrance.id);
    let targetExitId = null;
    if (otherExits.length > 0) {
      targetExitId = otherExits[Math.floor(Math.random() * otherExits.length)].id;
    } else if (exits.length > 0) {
      targetExitId = exits[0].id;
    }

    // Inward direction vector pointing into venue interior (away from exterior wall towards center)
    const centerX = 500;
    const centerY = 310;
    const gx = entrance.x + entrance.w / 2;
    const gy = entrance.y + entrance.h / 2;
    const toCenterX = centerX - gx;
    const toCenterY = centerY - gy;
    const toCenterDist = Math.hypot(toCenterX, toCenterY) || 1;
    const inwardDirX = toCenterX / toCenterDist;
    const inwardDirY = toCenterY / toCenterDist;

    // Attract a portion (~70%) of simulated crowd towards an attraction before exiting
    const attractions = (this.venue.attractions || []).filter(a => a.enabled !== false);
    let targetAttractionId = null;
    let state = 'heading_to_exit';

    if (!isLiveTwin && !this.liveCameraTwinMode) {
      if (attractions.length > 0 && (Math.random() < 0.72 || otherExits.length === 0)) {
        targetAttractionId = attractions[Math.floor(Math.random() * attractions.length)].id;
        state = 'heading_to_attraction';
      } else if (otherExits.length === 0) {
        // Entrance is the only gate in the venue: explore venue before leaving
        state = 'exploring_venue';
      }
    }

    // Project spawn coordinates inward into the walkable venue hall past the doorway
    const inwardOffset = Math.max(entrance.w, entrance.h) / 2 + 16;
    let sx = entrance.spawnX ?? (gx + inwardDirX * inwardOffset);
    let sy = entrance.spawnY ?? (gy + inwardDirY * inwardOffset);

    // Ensure spawn position is strictly on a walkable interior cell inside the venue
    let sc = Math.max(0, Math.min(COLS - 1, Math.floor(sx / NAV_CELL_SIZE)));
    let sr = Math.max(0, Math.min(ROWS - 1, Math.floor(sy / NAV_CELL_SIZE)));
    if (this.navEngine?.blocked?.[sr]?.[sc]) {
      let found = false;
      // Step inward along ray
      for (let step = 1; step <= 8 && !found; step++) {
        const tx = gx + inwardDirX * (inwardOffset + step * NAV_CELL_SIZE);
        const ty = gy + inwardDirY * (inwardOffset + step * NAV_CELL_SIZE);
        const tc = Math.floor(tx / NAV_CELL_SIZE);
        const tr = Math.floor(ty / NAV_CELL_SIZE);
        if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS && !this.navEngine.blocked[tr][tc]) {
          sx = (tc + 0.5) * NAV_CELL_SIZE;
          sy = (tr + 0.5) * NAV_CELL_SIZE;
          found = true;
        }
      }
      for (let radius = 1; radius <= 6 && !found; radius++) {
        for (let dr = -radius; dr <= radius && !found; dr++) {
          for (let dc = -radius; dc <= radius && !found; dc++) {
            const nr = sr + dr;
            const nc = sc + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !this.navEngine.blocked[nr][nc]) {
              sx = (nc + 0.5) * NAV_CELL_SIZE;
              sy = (nr + 0.5) * NAV_CELL_SIZE;
              found = true;
            }
          }
        }
      }
    }

    if (scatter) {
      const candX = sx + (Math.random() - 0.5) * Math.min(20, entrance.w);
      const candY = sy + (Math.random() - 0.5) * Math.min(20, entrance.h);
      const cc = Math.floor(candX / NAV_CELL_SIZE);
      const cr = Math.floor(candY / NAV_CELL_SIZE);
      if (cc >= 0 && cc < COLS && cr >= 0 && cr < ROWS && !this.navEngine?.blocked?.[cr]?.[cc]) {
        sx = candX;
        sy = candY;
      }
    }

    const agent = {
      id: this.nextAgentId++,
      x: sx,
      y: sy,
      vx: inwardDirX * 1.4,
      vy: inwardDirY * 1.4,
      radius: 4.8,
      baseSpeed: (1.2 + (Math.random() * 0.4 - 0.2)) * (PIXELS_PER_METER / 20), // ~1.2-1.6 m/s
      currentSpeed: 1.3,
      targetExitId,
      targetAttractionId,
      state, // 'heading_to_attraction', 'visiting_attraction', 'exploring_venue', 'heading_to_exit'
      dwellTime: state === 'exploring_venue' ? (15 + Math.random() * 20) : 0,
      entryGateId: entrance.id,
      hasLeftEntryZone: false,
      inwardDirX,
      inwardDirY,
      entryBoostTime: 4.0, // strong inward push for first 4 seconds
      spawnSimTime: this.elapsedSimSeconds,
      status: 'active', // active, unreachable, exited
      unreachableFrames: 0,
      stuckFrames: 0,
      history: [], // breadcrumbs for visual trails
      isLiveTwin: isLiveTwin || this.liveCameraTwinMode,
      lateralBias: (Math.random() - 0.5) * 0.5,
      wanderPhase: Math.random() * Math.PI * 2,
    };

    this.pedestrians.push(agent);
  }

  buildSpatialHash() {
    this.spatialHash.clear();
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      if (p.status === 'exited') continue;
      const key = `${Math.floor(p.x / this.spatialCellSize)}_${Math.floor(p.y / this.spatialCellSize)}`;
      if (!this.spatialHash.has(key)) {
        this.spatialHash.set(key, []);
      }
      this.spatialHash.get(key).push(p);
    }
  }

  getNeighbors(agent, radius) {
    const neighbors = [];
    const minCx = Math.floor((agent.x - radius) / this.spatialCellSize);
    const maxCx = Math.floor((agent.x + radius) / this.spatialCellSize);
    const minCy = Math.floor((agent.y - radius) / this.spatialCellSize);
    const maxCy = Math.floor((agent.y + radius) / this.spatialCellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.spatialHash.get(`${cx}_${cy}`);
        if (cell) {
          for (let j = 0; j < cell.length; j++) {
            const other = cell[j];
            if (other.id !== agent.id) {
              const dx = other.x - agent.x;
              const dy = other.y - agent.y;
              if (dx * dx + dy * dy < radius * radius) {
                neighbors.push(other);
              }
            }
          }
        }
      }
    }
    return neighbors;
  }

  /**
   * Main simulation step update
   * @param {number} deltaSeconds Real wall-clock frame delta (seconds)
   */
  update(deltaSeconds) {
    if (deltaSeconds <= 0 || deltaSeconds > 0.2) deltaSeconds = 0.016;

    // Apply simulation clock rate
    const simDt = deltaSeconds * this.simClockRate;
    this.elapsedSimSeconds += simDt;

    // 1. Spawning
    const entrances = this.getActiveEntrances();
    if (this.liveCameraTwinMode) {
      // Strictly simulate live individuals in the camera - no fake demo crowd
      const activeAgents = this.pedestrians.filter(p => p.status === 'active');
      if (activeAgents.length < this.liveCameraCount && entrances.length > 0) {
        const ent = entrances[Math.floor(Math.random() * entrances.length)];
        this.spawnAgent(ent, false, true);
      }
    } else {
      if (entrances.length > 0 && this.pedestrians.length < this.targetCrowdSize) {
        // Dynamic spawn pacing for hypothetical scenario testing
        const deficit = this.targetCrowdSize - this.pedestrians.length;
        const spawnChance = Math.min(0.9, (deficit / 20) * (simDt * 3.5));
        if (Math.random() < spawnChance) {
          const ent = entrances[Math.floor(Math.random() * entrances.length)];
          this.spawnAgent(ent, false, false);
        }
      }
    }

    // 2. Build spatial partition
    this.buildSpatialHash();

    // 3. Update pedestrian motion
    const activeExits = this.getActiveExits();
    let currentUnreachableCount = 0;

    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      if (p.status === 'exited') continue;

      // Sample Flow Field
      const flow = sampleFlowVector(this.navEngine, p.x, p.y, p.targetExitId);

      if (flow.unreachable || (flow.dx === 0 && flow.dy === 0 && flow.dist === Infinity)) {
        p.unreachableFrames++;
        if (p.unreachableFrames > 45) {
          p.status = 'unreachable';
          currentUnreachableCount++;
        }
      } else {
        p.unreachableFrames = Math.max(0, p.unreachableFrames - 2);
        if (p.status === 'unreachable') p.status = 'active';
      }

      // 1. Entry zone departure tracking
      if (!p.hasLeftEntryZone && p.entryGateId) {
        const entObj = entrances.find(e => e.id === p.entryGateId) || activeExits.find(e => e.id === p.entryGateId);
        if (entObj) {
          const distGate = Math.hypot(p.x - (entObj.x + entObj.w / 2), p.y - (entObj.y + entObj.h / 2));
          if (distGate > Math.max(entObj.w, entObj.h) / 2 + 24) {
            p.hasLeftEntryZone = true;
          }
        } else {
          p.hasLeftEntryZone = true;
        }
      }
      if (p.entryBoostTime > 0) {
        p.entryBoostTime -= simDt;
      }

      // 2. Check exit arrival
      let reachedExit = false;
      for (const exit of activeExits) {
        // Immunity: Cannot exit through own entry gate unless left entry zone & spent time exploring
        if (exit.id === p.entryGateId) {
          if (!p.hasLeftEntryZone || (this.elapsedSimSeconds - p.spawnSimTime) < 12) {
            continue;
          }
        }

        // Active attraction visitors and venue explorers cannot exit prematurely
        if (p.state === 'heading_to_attraction' || p.state === 'visiting_attraction' || p.state === 'exploring_venue') {
          continue;
        }

        // If multiple exits exist and agent has a target exit, prefer designated target exit
        if (p.targetExitId && p.targetExitId !== exit.id && activeExits.length > 1) {
          if ((this.elapsedSimSeconds - p.spawnSimTime) < 25) {
            continue;
          }
        }

        if (
          p.x >= exit.x - 4 &&
          p.x <= exit.x + exit.w + 4 &&
          p.y >= exit.y - 4 &&
          p.y <= exit.y + exit.h + 4
        ) {
          reachedExit = true;
          break;
        }
      }

      if (reachedExit) {
        p.status = 'exited';
        this.totalExited++;
        const journeyTime = Math.max(1, this.elapsedSimSeconds - p.spawnSimTime);
        this.completedJourneyTimes.push(journeyTime);
        this.recentExitsQueue.push(this.elapsedSimSeconds);
        continue;
      }

      // Social force: separation from neighbors
      const neighbors = this.getNeighbors(p, 16);
      let sepX = 0;
      let sepY = 0;

      for (let n = 0; n < neighbors.length; n++) {
        const other = neighbors[n];
        const dx = p.x - other.x;
        const dy = p.y - other.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p.radius + other.radius + 3;

        if (dist < minDist && dist > 0.001) {
          const force = (minDist - dist) / minDist;
          sepX += (dx / dist) * force * 2.2;
          sepY += (dy / dist) * force * 2.2;
        }
      }

      // Local density speed reduction (Emergent Bottleneck Queuing)
      const localNeighborCount = neighbors.length;
      let densityFactor = 1.0;
      if (localNeighborCount >= 2) {
        // Slow down when squeezed together in crowds
        densityFactor = Math.max(0.2, 1.0 - (localNeighborCount - 1) * 0.16);
      }

      // Predictive Wall / Obstacle Repulsion (Social Force Model)
      // Gently pushes pedestrians away from solid obstacles and prevents hugging walls
      const pCol = Math.floor(p.x / NAV_CELL_SIZE);
      const pRow = Math.floor(p.y / NAV_CELL_SIZE);
      let wallRepelX = 0;
      let wallRepelY = 0;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = pRow + dr;
          const nc = pCol + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && this.navEngine?.blocked?.[nr]?.[nc]) {
            const cellCx = (nc + 0.5) * NAV_CELL_SIZE;
            const cellCy = (nr + 0.5) * NAV_CELL_SIZE;
            const bdx = p.x - cellCx;
            const bdy = p.y - cellCy;
            const bdist = Math.hypot(bdx, bdy);
            const repelThreshold = p.radius + NAV_CELL_SIZE * 0.75; // ~16px buffer
            if (bdist < repelThreshold && bdist > 0.01) {
              const rFactor = (repelThreshold - bdist) / repelThreshold;
              wallRepelX += (bdx / bdist) * rFactor * 2.5;
              wallRepelY += (bdy / bdist) * rFactor * 2.5;
            }
          }
        }
      }

      // Attraction Point Guidance & Dwell Behavior
      const attractions = (this.venue.attractions || []).filter(a => a.enabled !== false);
      const targetAttraction = p.targetAttractionId 
        ? attractions.find(a => a.id === p.targetAttractionId)
        : null;

      let guideDirX = flow.dx;
      let guideDirY = flow.dy;

      if (p.state === 'heading_to_attraction' && targetAttraction) {
        const ax = targetAttraction.x + targetAttraction.w / 2;
        const ay = targetAttraction.y + targetAttraction.h / 2;
        const distToAttraction = Math.hypot(ax - p.x, ay - p.y);
        const reachRadius = Math.max(36, Math.min(targetAttraction.w, targetAttraction.h) / 2);

        if (distToAttraction < reachRadius + 20) {
          // Arrived at attraction!
          p.state = 'visiting_attraction';
          p.dwellTime = (targetAttraction.dwellSeconds || 5) + (Math.random() * 3 - 1.5);
        } else {
          // Sample the navigation flow field directed to this attraction!
          // This uses Dijkstra/BFS pathfinding around walls and through corridors.
          const attractFlow = sampleFlowVector(this.navEngine, p.x, p.y, targetAttraction.id, true);

          if (!attractFlow.unreachable && (attractFlow.dx !== 0 || attractFlow.dy !== 0)) {
            // Perpendicular lateral variation so pedestrians take relatively varied/random paths
            // rather than marching in a single line or getting stuck on corners
            const perpX = -attractFlow.dy;
            const perpY = attractFlow.dx;
            const lateralNoise = Math.sin((p.id * 11.3) + (this.elapsedSimSeconds * 1.4) + (p.wanderPhase || 0)) * 0.35 + (p.lateralBias || 0);

            guideDirX = attractFlow.dx + perpX * lateralNoise;
            guideDirY = attractFlow.dy + perpY * lateralNoise;

            const gLen = Math.hypot(guideDirX, guideDirY);
            if (gLen > 0.001) {
              guideDirX /= gLen;
              guideDirY /= gLen;
            }
          } else {
            // Fallback if no valid path exists
            guideDirX = (ax - p.x) / (distToAttraction || 1);
            guideDirY = (ay - p.y) / (distToAttraction || 1);
          }
        }
      } else if (p.state === 'visiting_attraction') {
        p.dwellTime -= simDt;
        if (p.dwellTime <= 0) {
          // Dwell finished! Seamlessly switch to exiting
          p.state = 'heading_to_exit';
          p.targetAttractionId = null;
        } else {
          // Gentle browsing / milling motion around attraction
          const wanderAngle = (p.id * 1.5) + (this.elapsedSimSeconds * 1.8);
          guideDirX = Math.cos(wanderAngle) * 0.3;
          guideDirY = Math.sin(wanderAngle) * 0.3;
        }
      } else if (p.state === 'exploring_venue') {
        p.dwellTime -= simDt;
        if (p.dwellTime <= 0) {
          p.state = 'heading_to_exit';
        } else {
          const toCenterX = 500 - p.x;
          const toCenterY = 310 - p.y;
          const dLen = Math.hypot(toCenterX, toCenterY) || 1;
          const wanderAngle = (p.id * 1.7) + (this.elapsedSimSeconds * 1.3) + (p.wanderPhase || 0);
          guideDirX = (toCenterX / dLen) * 0.5 + Math.cos(wanderAngle) * 0.5;
          guideDirY = (toCenterY / dLen) * 0.5 + Math.sin(wanderAngle) * 0.5;
          const gLen = Math.hypot(guideDirX, guideDirY);
          if (gLen > 0.001) {
            guideDirX /= gLen;
            guideDirY /= gLen;
          }
        }
      }

      // Strong entry boost for recently entered agents to guarantee they walk forward through the gate
      if (p.entryBoostTime > 0 && p.inwardDirX !== undefined) {
        const boostWeight = Math.min(1.0, p.entryBoostTime / 2.0);
        guideDirX = guideDirX * (1 - boostWeight) + p.inwardDirX * boostWeight;
        guideDirY = guideDirY * (1 - boostWeight) + p.inwardDirY * boostWeight;
        const bLen = Math.hypot(guideDirX, guideDirY);
        if (bLen > 0.001) {
          guideDirX /= bLen;
          guideDirY /= bLen;
        }
      } else if (guideDirX === 0 && guideDirY === 0 && p.inwardDirX !== undefined) {
        // Fallback when flow field is 0: step inward into the venue!
        guideDirX = p.inwardDirX;
        guideDirY = p.inwardDirY;
      }

      // Compute desired velocity with guidance, separation, and obstacle wall repulsion
      // Natural human walking pace calibration (~1.2 - 1.4 m/s at 20 px/meter = ~24 - 28 px/s)
      const targetSpeed = p.baseSpeed * 22 * this.walkingSpeedMultiplier * densityFactor; // px/sec
      let desiredVx = guideDirX * targetSpeed + sepX * 16 + wallRepelX * 20;
      let desiredVy = guideDirY * targetSpeed + sepY * 16 + wallRepelY * 20;

      // Small natural micro-wander
      const jitter = 0.05;
      desiredVx += (Math.random() - 0.5) * jitter * targetSpeed;
      desiredVy += (Math.random() - 0.5) * jitter * targetSpeed;

      // Inertia & velocity damping
      p.vx = p.vx * 0.7 + desiredVx * 0.3;
      p.vy = p.vy * 0.7 + desiredVy * 0.3;

      p.currentSpeed = Math.hypot(p.vx, p.vy) / 20; // in m/s (20 px = 1 meter)

      // New position
      let nx = p.x + p.vx * simDt;
      let ny = p.y + p.vy * simDt;

      // Wall / Obstacle collision clamping
      const col = Math.floor(nx / NAV_CELL_SIZE);
      const row = Math.floor(ny / NAV_CELL_SIZE);

      if (
        col >= 0 &&
        col < COLS &&
        row >= 0 &&
        row < ROWS &&
        this.navEngine?.blocked?.[row]?.[col]
      ) {
        // Try slide along X or Y
        const colOnly = Math.floor(nx / NAV_CELL_SIZE);
        const curRow = Math.floor(p.y / NAV_CELL_SIZE);
        const curCol = Math.floor(p.x / NAV_CELL_SIZE);
        const rowOnly = Math.floor(ny / NAV_CELL_SIZE);

        if (!this.navEngine.blocked[curRow]?.[colOnly]) {
          p.x = nx;
        } else if (!this.navEngine.blocked[rowOnly]?.[curCol]) {
          p.y = ny;
        } else {
          // Both blocked, halt and reflect slightly
          p.vx *= -0.3;
          p.vy *= -0.3;
        }
      } else {
        p.x = Math.max(8, Math.min(CANVAS_WIDTH - 8, nx));
        p.y = Math.max(8, Math.min(CANVAS_HEIGHT - 8, ny));
      }

      // Safety guarantee: Ensure pedestrian never resides on a blocked or exterior cell
      const finalCol = Math.floor(p.x / NAV_CELL_SIZE);
      const finalRow = Math.floor(p.y / NAV_CELL_SIZE);
      if (this.navEngine?.blocked?.[finalRow]?.[finalCol]) {
        for (let r = 1; r <= 4; r++) {
          let resolved = false;
          for (let dr = -r; dr <= r && !resolved; dr++) {
            for (let dc = -r; dc <= r && !resolved; dc++) {
              const tr = finalRow + dr;
              const tc = finalCol + dc;
              if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS && !this.navEngine.blocked[tr][tc]) {
                p.x = (tc + 0.5) * NAV_CELL_SIZE;
                p.y = (tr + 0.5) * NAV_CELL_SIZE;
                p.vx = 0;
                p.vy = 0;
                resolved = true;
              }
            }
          }
          if (resolved) break;
        }
      }

      // Breadcrumb history for subtle animation trail
      if (Math.random() < 0.25) {
        p.history.push({ x: p.x, y: p.y });
        if (p.history.length > 5) p.history.shift();
      }
    }

    // Clean up exited pedestrians from active pool
    this.pedestrians = this.pedestrians.filter(p => p.status !== 'exited');
    this.unreachableCount = currentUnreachableCount;

    // 4. Update Density Grid & Congestion Heatmap
    this.updateDensityGrid();

    // 5. Update Time-Series History
    this.updateTimeSeriesHistory();
  }

  updateDensityGrid() {
    // Reset raw count grid
    for (let r = 0; r < HEATMAP_ROWS; r++) {
      for (let c = 0; c < HEATMAP_COLS; c++) {
        this.rawCountGrid[r][c] = 0;
      }
    }

    // Bin active pedestrians
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      const c = Math.max(0, Math.min(HEATMAP_COLS - 1, Math.floor(p.x / HEATMAP_CELL_SIZE)));
      const r = Math.max(0, Math.min(HEATMAP_ROWS - 1, Math.floor(p.y / HEATMAP_CELL_SIZE)));
      this.rawCountGrid[r][c]++;
    }

    // Temporal smoothing (Exponential Moving Average)
    const alpha = 0.16;
    let maxDensityThisFrame = 0;
    const rawHotspotCells = [];

    for (let r = 0; r < HEATMAP_ROWS; r++) {
      for (let c = 0; c < HEATMAP_COLS; c++) {
        const raw = this.rawCountGrid[r][c];
        const prev = this.densityGrid[r][c];
        const smoothed = (1 - alpha) * prev + alpha * raw;
        this.densityGrid[r][c] = smoothed;

        if (smoothed > maxDensityThisFrame) {
          maxDensityThisFrame = smoothed;
        }

        // Bottleneck threshold: smoothed >= 3.2 pedestrians in 25x25px cell
        if (smoothed >= 3.2) {
          rawHotspotCells.push({
            row: r,
            col: c,
            x: c * HEATMAP_CELL_SIZE + HEATMAP_CELL_SIZE / 2,
            y: r * HEATMAP_CELL_SIZE + HEATMAP_CELL_SIZE / 2,
            density: smoothed,
            pedCount: raw,
          });
        }
      }
    }

    // Cluster contiguous hotspot cells (within 1-cell distance) to represent distinct physical choke points
    const clusteredHotspots = [];
    const visited = new Set();
    for (let i = 0; i < rawHotspotCells.length; i++) {
      if (visited.has(i)) continue;
      visited.add(i);
      const cluster = [rawHotspotCells[i]];
      const queue = [rawHotspotCells[i]];
      while (queue.length > 0) {
        const curr = queue.shift();
        for (let j = 0; j < rawHotspotCells.length; j++) {
          if (visited.has(j)) continue;
          const other = rawHotspotCells[j];
          if (Math.abs(curr.row - other.row) <= 1 && Math.abs(curr.col - other.col) <= 1) {
            visited.add(j);
            cluster.push(other);
            queue.push(other);
          }
        }
      }
      const avgX = cluster.reduce((sum, h) => sum + h.x, 0) / cluster.length;
      const avgY = cluster.reduce((sum, h) => sum + h.y, 0) / cluster.length;
      const maxDensity = Math.max(...cluster.map(h => h.density));
      const totalPedCount = cluster.reduce((sum, h) => sum + h.pedCount, 0);
      clusteredHotspots.push({
        row: cluster[0].row,
        col: cluster[0].col,
        x: avgX,
        y: avgY,
        density: maxDensity,
        pedCount: totalPedCount,
        cellCount: cluster.length,
      });
    }

    // Warmup filter: only track peakObservedDensity after initial startup (elapsedSimSeconds >= 2.0)
    // to prevent artificial frame-0 entrance stack spikes from corrupting the steady-state metric
    if (this.elapsedSimSeconds >= 2.0) {
      if (maxDensityThisFrame > this.peakObservedDensity) {
        this.peakObservedDensity = maxDensityThisFrame;
      }
    } else {
      this.peakObservedDensity = maxDensityThisFrame;
    }

    this.activeHotspots = clusteredHotspots;
  }

  updateTimeSeriesHistory() {
    const currentSimSec = Math.floor(this.elapsedSimSeconds);
    if (currentSimSec > this.lastHistoryRecordedSimTime) {
      this.lastHistoryRecordedSimTime = currentSimSec;

      // Clean old exits from throughput window (> 20 sec ago)
      const windowStart = this.elapsedSimSeconds - 20;
      this.recentExitsQueue = this.recentExitsQueue.filter(t => t >= windowStart);

      const throughputPerMin = (this.recentExitsQueue.length / 20) * 60;
      const avgDensity = this.getAverageDensity();
      const avgJourney = this.getAverageJourneyTime();

      this.timeSeriesHistory.push({
        time: currentSimSec,
        active: this.pedestrians.length,
        exitedTotal: this.totalExited,
        throughput: Math.round(throughputPerMin * 10) / 10,
        avgDensity: Math.round(avgDensity * 100) / 100,
        peakDensity: Math.round(this.peakObservedDensity * 100) / 100,
        hotspotsCount: this.activeHotspots.length,
        unreachable: this.unreachableCount,
      });

      // Keep up to 300 history snapshots
      if (this.timeSeriesHistory.length > 300) {
        this.timeSeriesHistory.shift();
      }
    }
  }

  getAverageDensity() {
    let sum = 0;
    let count = 0;
    for (let r = 0; r < HEATMAP_ROWS; r++) {
      for (let c = 0; c < HEATMAP_COLS; c++) {
        sum += this.densityGrid[r][c];
        count++;
      }
    }
    return count > 0 ? (sum / count) : 0;
  }

  getAverageJourneyTime() {
    if (this.completedJourneyTimes.length === 0) return 0;
    const sum = this.completedJourneyTimes.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.completedJourneyTimes.length) * 10) / 10;
  }

  getThroughputRate() {
    const windowStart = this.elapsedSimSeconds - 20;
    const recent = this.recentExitsQueue.filter(t => t >= windowStart);
    const windowDuration = Math.min(20, Math.max(1, this.elapsedSimSeconds));
    return Math.round((recent.length / windowDuration) * 60);
  }

  getMetrics() {
    const activeCount = this.pedestrians.filter(p => p.status === 'active').length;
    return {
      elapsedTime: Math.floor(this.elapsedSimSeconds),
      activePedestrians: activeCount,
      totalExited: this.totalExited,
      unreachableCount: this.unreachableCount,
      avgJourneyTime: this.getAverageJourneyTime(),
      throughputRate: this.getThroughputRate(),
      avgDensity: Math.round(this.getAverageDensity() * 100) / 100,
      peakDensity: Math.round(this.peakObservedDensity * 100) / 100,
      activeHotspotsCount: this.activeHotspots.length,
      timeSeriesHistory: this.timeSeriesHistory,
      isLiveTwinMode: this.liveCameraTwinMode,
      liveCameraCount: this.liveCameraCount,
    };
  }

  reset() {
    this.pedestrians = [];
    this.nextAgentId = 1;
    this.elapsedSimSeconds = 0;
    this.totalExited = 0;
    this.unreachableCount = 0;
    this.completedJourneyTimes = [];
    this.peakObservedDensity = 0;
    this.recentExitsQueue = [];
    this.timeSeriesHistory = [];
    this.lastHistoryRecordedSimTime = -1;
    this.densityGrid = Array.from({ length: HEATMAP_ROWS }, () => Array(HEATMAP_COLS).fill(0));
    this.activeHotspots = [];
    this.seedInitialPedestrians();
  }
}
