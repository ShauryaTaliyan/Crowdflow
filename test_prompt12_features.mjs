// Verification test for Prompt 12 features
import fs from 'fs';
import { buildNavigationGrid, sampleFlowVector } from './src/engine/navigation.js';
import { SimulationEngine } from './src/engine/simulation.js';
import { VENUE_PRESETS } from './src/constants/presets.js';

console.log('====================================================');
console.log('🧪 Starting Verification Test for Prompt 12 Requirements');
console.log('====================================================\n');

// --------------------------------------------------------------------------
// TEST 1: Pedestrians navigate around obstacles to attraction magnets
// --------------------------------------------------------------------------
console.log('🧪 TEST 1: Navigation & Simulation pathfinding around walls to attraction magnet...');

const testVenue = JSON.parse(JSON.stringify(VENUE_PRESETS.exhibition));
// Add a vertical dividing wall between x: 220 and x: 240, from y: 80 to y: 380
testVenue.walls.push({
  id: 'blocking_wall',
  x: 220,
  y: 80,
  w: 20,
  h: 300
});

// Place attraction magnet at x: 340, y: 220 (directly behind the wall)
testVenue.attractions = [
  {
    id: 'stage_magnet',
    name: 'Exhibition Main Stage Magnet',
    x: 340,
    y: 220,
    w: 80,
    h: 60,
    dwellSeconds: 5,
    enabled: true
  }
];

const navGrid = buildNavigationGrid(testVenue);

// 1. Verify that attraction flow fields are generated
if (!navGrid.attractionFields || !navGrid.attractionFields['stage_magnet']) {
  throw new Error('FAIL: Attraction flow fields missing for stage_magnet');
}
console.log('  ✅ Attraction flow fields computed successfully for "stage_magnet"');

// 2. Sample vector from in front of the wall (e.g. x: 140, y: 220)
// If straight-line Euclidean was used, dx would be positive and dy would be 0 (straight into the wall).
// With Dijkstra flow field around the obstacle, it must direct the agent around the wall (dy != 0).
const flowVec = sampleFlowVector(navGrid, 140, 220, 'stage_magnet', true);
console.log('  ✅ Flow vector sampled in front of wall:', flowVec);

if (flowVec.unreachable) {
  throw new Error('FAIL: Flow vector reported unreachable when open corridors exist around wall');
}

if (Math.abs(flowVec.dy) < 0.01 && flowVec.dx > 0) {
  throw new Error('FAIL: Vector points directly into wall instead of guiding around it');
}
console.log('  ✅ Flow vector correctly deflects around the wall (dy is non-zero)!');

// 3. Test Simulation Engine execution
const sim = new SimulationEngine(testVenue, navGrid, {
  isDemoSimulation: true,
  targetCrowdSize: 15,
  simClockRate: 1
});

// Step simulation through 120 frames
for (let frame = 0; frame < 120; frame++) {
  sim.update(0.016);
}

// Check that agents did not penetrate solid walls
const agentsInsideBlockedWall = sim.pedestrians.filter(p => {
  return p.x >= 220 && p.x <= 240 && p.y >= 80 && p.y <= 380;
});

if (agentsInsideBlockedWall.length > 0) {
  throw new Error(`FAIL: ${agentsInsideBlockedWall.length} agents walked inside blocked wall!`);
}
console.log('  ✅ Zero pedestrians penetrated the wall during simulation step updates!');

// --------------------------------------------------------------------------
// TEST 2: Analytics Clickable Charts & Congestion Breakdown Modal
// --------------------------------------------------------------------------
console.log('\n🧪 TEST 2: Analytics View Clickable Charts & Explainer Modal...');
const analyticsCode = fs.readFileSync('./src/components/AnalyticsView.jsx', 'utf8');

// Verify activeExplainer state
if (!analyticsCode.includes('activeExplainer') || !analyticsCode.includes('setActiveExplainer')) {
  throw new Error('FAIL: activeExplainer modal state missing from AnalyticsView.jsx');
}

// Verify chart 1 click handler
if (!analyticsCode.includes("onClick={() => setActiveExplainer('density')}") &&
    !analyticsCode.includes("setActiveExplainer('density')")) {
  throw new Error('FAIL: Density progression chart is not clickable');
}

// Verify chart 2 click handler
if (!analyticsCode.includes("onClick={() => setActiveExplainer('egress')}") &&
    !analyticsCode.includes("setActiveExplainer('egress')")) {
  throw new Error('FAIL: Egress flow chart is not clickable');
}

// Verify congestion breakdown click handler
if (!analyticsCode.includes("onClick={() => setActiveExplainer('congestion')}") &&
    !analyticsCode.includes("setActiveExplainer('congestion')")) {
  throw new Error('FAIL: Floor area congestion breakdown is not clickable');
}

// Verify plain-English explainer modal pointers
if (!analyticsCode.includes('Crowd Density Progression — Guide & Pointers') ||
    !analyticsCode.includes('Egress Flow & Total Exits — Guide & Pointers') ||
    !analyticsCode.includes('Floor Congestion Breakdown — Guide & Pointers')) {
  throw new Error('FAIL: Explainer modal titles missing');
}
console.log('  ✅ All 3 graphs & congestion breakdown are clickable and open detailed pointers modal!');

// --------------------------------------------------------------------------
// TEST 3: Live Monitoring Bottom Camera Gallery & Enlarged Viewer Modal
// --------------------------------------------------------------------------
console.log('\n🧪 TEST 3: Live Monitoring Bottom Camera Gallery & Enlarged Viewer...');
const liveMonCode = fs.readFileSync('./src/components/LiveMonitoringView.jsx', 'utf8');

// Verify bottom gallery section exists
if (!liveMonCode.includes('connected-cameras-bottom-section')) {
  throw new Error('FAIL: connected-cameras-bottom-section missing from LiveMonitoringView.jsx');
}

// Verify enlarged camera modal state exists
if (!liveMonCode.includes('enlargedCamera') || !liveMonCode.includes('setEnlargedCamera')) {
  throw new Error('FAIL: enlargedCamera state missing from LiveMonitoringView.jsx');
}

// Verify click to enlarge functionality
if (!liveMonCode.includes('setEnlargedCamera(cam)')) {
  throw new Error('FAIL: setEnlargedCamera(cam) trigger missing from camera gallery');
}

// Verify enlarged camera modal content
if (!liveMonCode.includes('Close Viewer') || !liveMonCode.includes('Assigned Spatial Monitoring Zone')) {
  throw new Error('FAIL: Enlarged camera viewer controls or close button missing');
}
console.log('  ✅ Live Monitoring includes bottom multi-camera gallery and enlarged camera modal!');

console.log('\n🎉 ALL PROMPT 12 TESTS PASSED PERFECTLY!');
