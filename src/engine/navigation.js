/**
 * CrowdFlow Navigation Engine
 * 
 * Computes grid-based obstacle maps, Dijkstra potential distance transforms,
 * continuous vector flow fields, and unreachable node detection.
 */

import { CANVAS_WIDTH, CANVAS_HEIGHT, NAV_CELL_SIZE } from '../constants/presets.js';

export const COLS = Math.floor(CANVAS_WIDTH / NAV_CELL_SIZE); // 50
export const ROWS = Math.floor(CANVAS_HEIGHT / NAV_CELL_SIZE); // 31

/**
 * Builds the walkable navigation grid and computes flow fields toward active exits.
 * 
 * @param {Object} venue - The venue layout object containing walls, stalls, obstacles, exits.
 * @returns {Object} Navigation graph containing blocked grid, flow fields, and unreachable cells.
 */
export function buildNavigationGrid(venue) {
  // 1. Initialize blocked grid (true = blocked, false = walkable)
  const blocked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  const walls = venue.walls || [];
  const stalls = venue.stalls || [];
  const obstacles = venue.obstacles || [];
  const pureExits = (venue.exits || []).filter(e => e.enabled !== false);
  const dualGates = (venue.dualGates || []).filter(g => g.enabled !== false);
  const exits = [...pureExits, ...dualGates];

  // Helper: check if a grid cell overlaps a rectangle
  function markRectBlocked(rx, ry, rw, rh) {
    const minCol = Math.max(0, Math.floor(rx / NAV_CELL_SIZE));
    const maxCol = Math.min(COLS - 1, Math.floor((rx + rw - 1) / NAV_CELL_SIZE));
    const minRow = Math.max(0, Math.floor(ry / NAV_CELL_SIZE));
    const maxRow = Math.min(ROWS - 1, Math.floor((ry + rh - 1) / NAV_CELL_SIZE));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        blocked[r][c] = true;
      }
    }
  }

  // Mark all walls as blocked
  walls.forEach(w => markRectBlocked(w.x, w.y, w.w, w.h));

  // Mark all exhibition stalls as blocked
  stalls.forEach(s => markRectBlocked(s.x, s.y, s.w, s.h));

  // Mark all physical obstacles as blocked
  obstacles.forEach(o => markRectBlocked(o.x, o.y, o.w, o.h));

  // Mask and block all cells outside the venue perimeter
  // Ensures simulated individuals can NEVER travel or navigate outside the venue walls
  if (walls.length >= 2) {
    let minWallX = Infinity, minWallY = Infinity;
    let maxWallX = -Infinity, maxWallY = -Infinity;
    walls.forEach(w => {
      minWallX = Math.min(minWallX, w.x);
      minWallY = Math.min(minWallY, w.y);
      maxWallX = Math.max(maxWallX, w.x + w.w);
      maxWallY = Math.max(maxWallY, w.y + w.h);
    });

    const envelopeMinCol = Math.max(0, Math.floor((minWallX - 8) / NAV_CELL_SIZE));
    const envelopeMaxCol = Math.min(COLS - 1, Math.floor((maxWallX + 8) / NAV_CELL_SIZE));
    const envelopeMinRow = Math.max(0, Math.floor((minWallY - 8) / NAV_CELL_SIZE));
    const envelopeMaxRow = Math.min(ROWS - 1, Math.floor((maxWallY + 8) / NAV_CELL_SIZE));

    // Permanently block any cells outside the outer wall boundary envelope
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r < envelopeMinRow || r > envelopeMaxRow || c < envelopeMinCol || c > envelopeMaxCol) {
          blocked[r][c] = true;
        }
      }
    }

    // Flood fill from canvas borders to identify concave exterior margins
    const solidEnclosure = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    walls.forEach(w => {
      const minC = Math.max(0, Math.floor(w.x / NAV_CELL_SIZE));
      const maxC = Math.min(COLS - 1, Math.floor((w.x + w.w - 1) / NAV_CELL_SIZE));
      const minR = Math.max(0, Math.floor(w.y / NAV_CELL_SIZE));
      const maxR = Math.min(ROWS - 1, Math.floor((w.y + w.h - 1) / NAV_CELL_SIZE));
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          solidEnclosure[r][c] = true;
        }
      }
    });

    // Temporarily seal door apertures during flood-fill
    const allPortals = [...(venue.entrances || []), ...exits];
    allPortals.forEach(p => {
      const minC = Math.max(0, Math.floor(p.x / NAV_CELL_SIZE));
      const maxC = Math.min(COLS - 1, Math.floor((p.x + p.w - 1) / NAV_CELL_SIZE));
      const minR = Math.max(0, Math.floor(p.y / NAV_CELL_SIZE));
      const maxR = Math.min(ROWS - 1, Math.floor((p.y + p.h - 1) / NAV_CELL_SIZE));
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          solidEnclosure[r][c] = true;
        }
      }
    });

    const extVisited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const queue = [];
    for (let r = 0; r < ROWS; r++) {
      if (!solidEnclosure[r][0]) { extVisited[r][0] = true; queue.push({ r, c: 0 }); }
      if (!solidEnclosure[r][COLS - 1]) { extVisited[r][COLS - 1] = true; queue.push({ r, c: COLS - 1 }); }
    }
    for (let c = 0; c < COLS; c++) {
      if (!solidEnclosure[0][c] && !extVisited[0][c]) { extVisited[0][c] = true; queue.push({ r: 0, c }); }
      if (!solidEnclosure[ROWS - 1][c] && !extVisited[ROWS - 1][c]) { extVisited[ROWS - 1][c] = true; queue.push({ r: ROWS - 1, c }); }
    }

    let head = 0;
    while (head < queue.length) {
      const { r, c } = queue[head++];
      const dDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dDirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !extVisited[nr][nc] && !solidEnclosure[nr][nc]) {
          extVisited[nr][nc] = true;
          queue.push({ r: nr, c: nc });
        }
      }
    }

    if (queue.length < ROWS * COLS * 0.92) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (extVisited[r][c]) {
            blocked[r][c] = true;
          }
        }
      }
    }
  }

  // Clear all door portals (entrances, dual gates, and exits) so pedestrians can pass through freely!
  const allDoorPortals = [
    ...(venue.entrances || []).filter(e => e.enabled !== false),
    ...(venue.dualGates || []).filter(g => g.enabled !== false),
    ...exits
  ];

  allDoorPortals.forEach(portal => {
    const minCol = Math.max(0, Math.floor(portal.x / NAV_CELL_SIZE));
    const maxCol = Math.min(COLS - 1, Math.floor((portal.x + portal.w - 1) / NAV_CELL_SIZE));
    const minRow = Math.max(0, Math.floor(portal.y / NAV_CELL_SIZE));
    const maxRow = Math.min(ROWS - 1, Math.floor((portal.y + portal.h - 1) / NAV_CELL_SIZE));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        blocked[r][c] = false;
      }
    }

    // Also unblock 1-2 cells inward towards venue interior so portal is fully connected to floor
    const toCenterX = 500 - (portal.x + portal.w / 2);
    const toCenterY = 310 - (portal.y + portal.h / 2);
    const pDist = Math.hypot(toCenterX, toCenterY) || 1;
    for (let offset = 8; offset <= 24; offset += 8) {
      const inCol = Math.max(0, Math.min(COLS - 1, Math.floor(((portal.x + portal.w / 2) + (toCenterX / pDist) * offset) / NAV_CELL_SIZE)));
      const inRow = Math.max(0, Math.min(ROWS - 1, Math.floor(((portal.y + portal.h / 2) + (toCenterY / pDist) * offset) / NAV_CELL_SIZE)));
      blocked[inRow][inCol] = false;
    }
  });

  // Ensure attraction magnet zones are walkable so crowd can reach them
  const attractions = (venue.attractions || []).filter(a => a.enabled !== false);
  attractions.forEach(att => {
    const minCol = Math.max(0, Math.floor(att.x / NAV_CELL_SIZE));
    const maxCol = Math.min(COLS - 1, Math.floor((att.x + att.w - 1) / NAV_CELL_SIZE));
    const minRow = Math.max(0, Math.floor(att.y / NAV_CELL_SIZE));
    const maxRow = Math.min(ROWS - 1, Math.floor((att.y + att.h - 1) / NAV_CELL_SIZE));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        blocked[r][c] = false;
      }
    }
  });

  // 2. Compute Flow Fields
  // We compute a global flow field directed to the nearest active exit, plus individual fields
  const globalField = computeFlowField(blocked, exits);

  // Individual exit fields (for pedestrians assigned to a specific exit)
  const exitFields = {};
  exits.forEach(exit => {
    exitFields[exit.id] = computeFlowField(blocked, [exit]);
  });

  // Flow fields toward crowd attraction magnets (Dijkstra paths navigating around walls and doors)
  const attractionFields = {};
  attractions.forEach(att => {
    attractionFields[att.id] = computeFlowField(blocked, [att]);
  });

  return {
    blocked,
    globalField,
    exitFields,
    attractionFields,
    activeExits: exits,
    unreachableCount: globalField.unreachableCount,
  };
}

/**
 * Computes a Dijkstra/BFS distance field and gradient vector field toward target exits.
 */
function computeFlowField(blocked, targetExits) {
  // Distance matrix initialized to Infinity
  const dist = Array.from({ length: ROWS }, () => Array(COLS).fill(Infinity));
  // Flow vector matrix: { dx, dy, dist, unreachable }
  const vectors = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ dx: 0, dy: 0, dist: Infinity, unreachable: false }))
  );

  if (!targetExits || targetExits.length === 0) {
    return { dist, vectors, unreachableCount: ROWS * COLS };
  }

  // Priority Queue / BFS Queue
  const queue = [];

  // Seed queue with all cells overlapping target exits
  targetExits.forEach(exit => {
    const minCol = Math.max(0, Math.floor(exit.x / NAV_CELL_SIZE));
    const maxCol = Math.min(COLS - 1, Math.floor((exit.x + exit.w - 1) / NAV_CELL_SIZE));
    const minRow = Math.max(0, Math.floor(exit.y / NAV_CELL_SIZE));
    const maxRow = Math.min(ROWS - 1, Math.floor((exit.y + exit.h - 1) / NAV_CELL_SIZE));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        dist[r][c] = 0;
        queue.push({ r, c, d: 0 });
      }
    }
  });

  // 8-neighborhood offsets
  const neighbors = [
    { dr: -1, dc: 0, cost: 1.0 },
    { dr: 1, dc: 0, cost: 1.0 },
    { dr: 0, dc: -1, cost: 1.0 },
    { dr: 0, dc: 1, cost: 1.0 },
    { dr: -1, dc: -1, cost: 1.414 },
    { dr: -1, dc: 1, cost: 1.414 },
    { dr: 1, dc: -1, cost: 1.414 },
    { dr: 1, dc: 1, cost: 1.414 },
  ];

  // BFS propagation
  let head = 0;
  while (head < queue.length) {
    const { r, c, d } = queue[head++];

    if (d > dist[r][c]) continue;

    for (const nb of neighbors) {
      const nr = r + nb.dr;
      const nc = c + nb.dc;

      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (blocked[nr][nc]) continue;

      // Prevent corner cutting across two diagonal blocked cells
      if (nb.dr !== 0 && nb.dc !== 0) {
        if (blocked[r][nc] && blocked[nr][c]) continue;
      }

      const newDist = d + nb.cost;
      if (newDist < dist[nr][nc]) {
        dist[nr][nc] = newDist;
        queue.push({ r: nr, c: nc, d: newDist });
      }
    }
  }

  // Compute gradient direction vectors for each cell
  let unreachableCount = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (blocked[r][c]) {
        vectors[r][c] = { dx: 0, dy: 0, dist: Infinity, unreachable: true, blocked: true };
        continue;
      }

      const currentDist = dist[r][c];
      if (currentDist === Infinity) {
        // Cell is walkable but cannot reach any exit (isolated / trapped!)
        vectors[r][c] = { dx: 0, dy: 0, dist: Infinity, unreachable: true, blocked: false };
        unreachableCount++;
        continue;
      }

      // Find neighbor with lowest distance
      let bestDist = currentDist;
      let bestDirX = 0;
      let bestDirY = 0;

      for (const nb of neighbors) {
        const nr = r + nb.dr;
        const nc = c + nb.dc;

        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (blocked[nr][nc]) continue;

        if (nb.dr !== 0 && nb.dc !== 0) {
          if (blocked[r][nc] && blocked[nr][c]) continue;
        }

        const nd = dist[nr][nc];
        if (nd < bestDist) {
          bestDist = nd;
          bestDirX = nb.dc;
          bestDirY = nb.dr;
        }
      }

      const len = Math.hypot(bestDirX, bestDirY);
      if (len > 0.0001) {
        vectors[r][c] = {
          dx: bestDirX / len,
          dy: bestDirY / len,
          dist: currentDist,
          unreachable: false,
          blocked: false,
        };
      } else {
        vectors[r][c] = { dx: 0, dy: 0, dist: currentDist, unreachable: false, blocked: false };
      }
    }
  }

  return { dist, vectors, unreachableCount };
}

/**
 * Samples the flow field at arbitrary continuous world coordinates (x, y).
 * Uses bilinear interpolation for smooth steering direction.
 */
export function sampleFlowVector(navEngine, x, y, targetExitId = null, isAttraction = false) {
  if (!navEngine) return { dx: 0, dy: 0, dist: 0, unreachable: false };

  let field = null;
  if (isAttraction && targetExitId && navEngine.attractionFields?.[targetExitId]) {
    field = navEngine.attractionFields[targetExitId];
  } else if (targetExitId && navEngine.exitFields?.[targetExitId]) {
    field = navEngine.exitFields[targetExitId];
  } else {
    field = navEngine.globalField;
  }

  if (!field || !field.vectors) return { dx: 0, dy: 0, dist: 0, unreachable: false };

  const colF = x / NAV_CELL_SIZE;
  const rowF = y / NAV_CELL_SIZE;

  const c0 = Math.max(0, Math.min(COLS - 1, Math.floor(colF)));
  const r0 = Math.max(0, Math.min(ROWS - 1, Math.floor(rowF)));

  const cell = field.vectors[r0]?.[c0];
  if (!cell) return { dx: 0, dy: 0, dist: 0, unreachable: false };

  if (cell.unreachable || cell.blocked) {
    return { dx: 0, dy: 0, dist: Infinity, unreachable: true, blocked: true };
  }

  return {
    dx: cell.dx,
    dy: cell.dy,
    dist: cell.dist,
    unreachable: false,
  };
}
