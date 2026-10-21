/**
 * Automated Verification Test Suite for CrowdFlow Prototype
 * Validates Navigation Graph, Simulation Step, Heatmap Density Grid,
 * Metric Calculation, Rule-Based Recommendations, and Scenario Comparison.
 */

import { VENUE_PRESETS, CANVAS_WIDTH, CANVAS_HEIGHT } from './src/constants/presets.js';
import { buildNavigationGrid, sampleFlowVector } from './src/engine/navigation.js';
import { SimulationEngine } from './src/engine/simulation.js';
import { analyzeSimulationAndGenerateRecommendations } from './src/engine/rulesEngine.js';

console.log('🧪 Starting CrowdFlow Automated Engine Test Suite...\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failCount++;
  }
}

// 1. Test Presets
const venue = JSON.parse(JSON.stringify(VENUE_PRESETS.exhibition));
assert(venue.walls.length >= 8, 'Venue preset has boundary walls');
assert(venue.entrances.length >= 2, 'Venue preset has entry gates');
assert(venue.exits.length >= 2, 'Venue preset has exit portals');
assert(venue.stalls.length >= 6, 'Venue preset has exhibition pavilions');

// 2. Test Navigation Grid & Flow Fields
const navEngine = buildNavigationGrid(venue);
assert(navEngine.blocked.length === 31, 'Nav grid has 31 rows (620px / 20px)');
assert(navEngine.blocked[0].length === 50, 'Nav grid has 50 columns (1000px / 20px)');
assert(navEngine.globalField.vectors.length === 31, 'Global flow field initialized');

// Test flow vector sample in walkable aisle (e.g. at x=350, y=200)
const sampleVector = sampleFlowVector(navEngine, 350, 200);
assert(!sampleVector.unreachable, 'Corridor coordinate (350, 200) is reachable');
assert(Math.hypot(sampleVector.dx, sampleVector.dy) > 0.5, 'Corridor has non-zero gradient vector towards exit');

// 3. Test Simulation Engine Loop
const sim = new SimulationEngine(venue, navEngine, {
  targetCrowdSize: 80,
  walkingSpeedMultiplier: 1.0,
  simClockRate: 1,
});

assert(sim.pedestrians.length > 0, 'Simulation initialized with initial seed pedestrians');

// Advance simulation for 60 frames (1 second)
for (let frame = 0; frame < 60; frame++) {
  sim.update(0.016);
}

const metrics1 = sim.getMetrics();
assert(metrics1.activePedestrians > 0, 'Active pedestrians are progressing through venue');
assert(sim.elapsedSimSeconds >= 0.9, 'Elapsed simulated time incremented');
assert(sim.densityGrid.length === 24, 'Density grid has 24 rows (620px / 25px = 24.8)');
assert(sim.densityGrid[0].length === 40, 'Density grid has 40 columns');

// Advance simulation for 600 more frames (10 seconds)
for (let frame = 0; frame < 600; frame++) {
  sim.update(0.016);
}

const metrics2 = sim.getMetrics();
assert(metrics2.elapsedTime >= 10, 'Advanced simulation to 10+ seconds');
assert(metrics2.timeSeriesHistory.length >= 9, 'Time-series history recorded data points for charts');

// 4. Test Rule-Based Recommendations
const recs = analyzeSimulationAndGenerateRecommendations(venue, metrics2, sim.activeHotspots);
assert(Array.isArray(recs) && recs.length > 0, 'Generated rule-based recommendations list');
assert(recs[0].title && recs[0].problem && recs[0].action && recs[0].rationale, 'Recommendation has problem, action, and rationale');

// 5. Test Unreachable Handling (Trapped Agent Test)
const trappedVenue = JSON.parse(JSON.stringify(venue));
// Seal perimeter so no exits can be reached (wall covering exit 1 & 2)
trappedVenue.exits = [];
const trappedNav = buildNavigationGrid(trappedVenue);
const trappedSim = new SimulationEngine(trappedVenue, trappedNav, { targetCrowdSize: 20 });

// Advance trapped sim
for (let frame = 0; frame < 120; frame++) {
  trappedSim.update(0.016);
}
assert(trappedSim.unreachableCount >= 0, 'Unreachable agent tracking functions safely without crashing');

// 6. Test Dual Gate Simulation (Single Dual Gate Venue)
const dualGateVenue = {
  walls: [
    { id: 'w1', x: 0, y: 0, w: 1000, h: 14, isPerimeter: true },
    { id: 'w2', x: 0, y: 606, w: 1000, h: 14, isPerimeter: true },
    { id: 'w3', x: 0, y: 0, w: 14, h: 620, isPerimeter: true },
    { id: 'w4', x: 986, y: 0, w: 14, h: 620, isPerimeter: true },
  ],
  stalls: [],
  obstacles: [],
  entrances: [],
  exits: [],
  attractions: [],
  dualGates: [
    { id: 'dg1', name: 'Dual Gate East Portal', x: 760, y: 60, w: 26, h: 88, enabled: true },
  ],
};
const dualGateNav = buildNavigationGrid(dualGateVenue);
const dualGateSim = new SimulationEngine(dualGateVenue, dualGateNav, {
  targetCrowdSize: 50,
  walkingSpeedMultiplier: 1.0,
  simClockRate: 1,
  liveCameraTwinMode: false,
});

assert(dualGateSim.pedestrians.length > 0, 'Dual gate spawns initial demo pedestrians');

// Advance for 5 seconds (300 frames)
for (let frame = 0; frame < 300; frame++) {
  dualGateSim.update(0.016);
}

const dualMetrics = dualGateSim.getMetrics();
assert(dualMetrics.activePedestrians >= 30, 'Dual gate pedestrians enter venue and remain active inside (not instantly exited)');
assert(dualMetrics.totalExited === 0, 'Dual gate pedestrians do not instantly despawn on tick 1');
assert(dualMetrics.unreachableCount === 0, 'Dual gate pedestrians have valid walkable paths into venue');

// 7. Test Recommendation Application Improves Crowd Congestion
const recVenue = JSON.parse(JSON.stringify(VENUE_PRESETS.exhibition));
const recNav = buildNavigationGrid(recVenue);
const recSim = new SimulationEngine(recVenue, recNav, { targetCrowdSize: 80 });
for (let frame = 0; frame < 300; frame++) {
  recSim.update(0.016);
}
const baseMetrics = recSim.getMetrics();
const recList = analyzeSimulationAndGenerateRecommendations(recVenue, baseMetrics, recSim.activeHotspots);

assert(recList.length > 0, 'Recommendation engine generated congestion relief suggestions');
const actionable = recList.filter(r => r.layoutChange);
assert(actionable.length > 0, 'At least one actionable layout optimization recommendation provided');

// Apply first actionable recommendation to modified layout
const modVenue = JSON.parse(JSON.stringify(recVenue));
const change = actionable[0].layoutChange;
if (change.type === 'remove_obstacle') {
  modVenue.obstacles = modVenue.obstacles.filter(o => o.id !== change.obstacleId);
} else if (change.type === 'widen_exit') {
  modVenue.exits = modVenue.exits.map(e => e.id === change.exitId ? { ...e, h: change.newH, w: change.newW, capacity: change.newCapacity } : e);
} else if (change.type === 'setback_stall') {
  modVenue.stalls = modVenue.stalls.map(s => s.id === change.stallId ? { ...s, w: s.w - 25, x: s.x + change.shiftX } : s);
}

const modNav = buildNavigationGrid(modVenue);
const modSim = new SimulationEngine(modVenue, modNav, { targetCrowdSize: 80 });
for (let frame = 0; frame < 300; frame++) {
  modSim.update(0.016);
}
const modMetrics = modSim.getMetrics();

assert(modMetrics.unreachableCount === 0, 'Applied recommendation maintains 100% path connectivity');
assert(modMetrics.activeHotspotsCount <= baseMetrics.activeHotspotsCount || modMetrics.peakDensity <= baseMetrics.peakDensity, 'Applied recommendation decreases choke points or peak density (does not increase congestion)');

console.log(`\n📊 Test Results: ${passCount} Passed, ${failCount} Failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 All automated unit & integration tests passed!\n');
}
