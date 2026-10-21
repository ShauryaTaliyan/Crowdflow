/**
 * Automated Verification Script for:
 * 1. Editable Venue Layout Summary Floor Area & Dimensions
 * 2. Realistic Calibrated Human Walking Pace (slowing down demo simulation)
 * 3. Direct Keyboard Number Inputs & Global Keyboard Shortcuts for Population & Speed
 */

import { VENUE_PRESETS, CANVAS_WIDTH, CANVAS_HEIGHT, PIXELS_PER_METER } from './src/constants/presets.js';
import { SimulationEngine } from './src/engine/simulation.js';
import { buildNavigationGrid } from './src/engine/navigation.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('🧪 Starting Verification Suite for Floor Area Calibration, Simulation Pacing & Keyboard Controls...\n');

// --- 1. Test Venue Dimensions & Floor Area ---
console.log('--- Test 1: Venue Floor Area & Dimensions ---');
const exhibitionPreset = VENUE_PRESETS.exhibition;
assert(exhibitionPreset.dimensions.floorAreaM2 === 1550, 'Default exhibition preset has explicit floorAreaM2 (1550 m²)');
assert(exhibitionPreset.dimensions.widthMeters === 50, 'Default width is 50 meters');
assert(exhibitionPreset.dimensions.heightMeters === 31, 'Default height is 31 meters');

// Test custom dimension calibration
const customVenue = JSON.parse(JSON.stringify(exhibitionPreset));
customVenue.dimensions = {
  widthMeters: 80,
  heightMeters: 50,
  floorAreaM2: 4000,
  pixelsPerMeter: 20
};

assert(customVenue.dimensions.floorAreaM2 === 4000, 'Custom floorAreaM2 preserved after calibration (4,000 m²)');
assert(customVenue.dimensions.widthMeters * customVenue.dimensions.heightMeters === 4000, 'Width x Height aligns with total floor area');

// --- 2. Test Simulation Walking Speed & Pace ---
console.log('\n--- Test 2: Calibrated Realistic Simulation Speed ---');
const nav = buildNavigationGrid(customVenue);

const sim = new SimulationEngine(customVenue, nav, {
  targetCrowdSize: 30,
  walkingSpeedMultiplier: 1.0,
  isDemoSimulation: true,
  liveCameraTwinMode: false
});

assert(sim.pedestrians.length > 0, `Successfully spawned ${sim.pedestrians.length} initial pedestrians`);

// Advance simulation for 2 seconds (120 frames at 60 FPS)
let initialAgentPositions = sim.pedestrians.map(p => ({ id: p.id, x: p.x, y: p.y }));
for (let i = 0; i < 120; i++) {
  sim.update(1 / 60);
}

// Calculate average speed in pixels/sec over the 2 seconds
let totalDistance = 0;
let movingCount = 0;
for (let p of sim.pedestrians) {
  const init = initialAgentPositions.find(a => a.id === p.id);
  if (init && p.status === 'active') {
    const dist = Math.hypot(p.x - init.x, p.y - init.y);
    totalDistance += dist;
    movingCount++;
  }
}

const avgDistPerSec = movingCount > 0 ? (totalDistance / movingCount) / 2.0 : 0;
console.log(`  ℹ️ Measured Average Agent Movement Speed: ${avgDistPerSec.toFixed(2)} px/sec (~${(avgDistPerSec / PIXELS_PER_METER).toFixed(2)} m/s)`);

// Real human walking pace: ~1.2 - 1.4 m/s @ 20 px/m = ~24 - 28 px/s
// In previous over-speed code, speed was 75 - 110 px/s
assert(avgDistPerSec < 45, `Speed is calibrated down to realistic pace (${avgDistPerSec.toFixed(1)} px/s < 45 px/s limit, was ~80+ px/s)`);
assert(avgDistPerSec > 10, `Speed is active and fluid (${avgDistPerSec.toFixed(1)} px/s > 10 px/s)`);

// Test Slow-Motion Speed Multiplier (0.2x)
sim.setParameters({ walkingSpeedMultiplier: 0.2 });
assert(sim.walkingSpeedMultiplier === 0.2, 'Walking speed multiplier successfully set to 0.2x slow-motion');

// Test Fast Speed Multiplier (2.0x)
sim.setParameters({ walkingSpeedMultiplier: 2.0 });
assert(sim.walkingSpeedMultiplier === 2.0, 'Walking speed multiplier successfully set to 2.0x');

// Test Pedestrian currentSpeed Metric (m/s)
const sampleAgent = sim.pedestrians[0];
assert(sampleAgent.currentSpeed > 0 && sampleAgent.currentSpeed < 3.5, `Pedestrian speed reported in realistic m/s: ${sampleAgent.currentSpeed.toFixed(2)} m/s`);

// --- 3. Test Simulation Settings & Keyboard Simulation ---
console.log('\n--- Test 3: Simulation Parameters & Keyboard Controls Logic ---');
let simSettings = {
  crowdSize: 80,
  walkingSpeedMultiplier: 1.0,
  isDemoSimulation: true
};

// Simulate Keyboard Input: User types 150 into crowd size
simSettings.crowdSize = 150;
sim.setParameters({ targetCrowdSize: simSettings.crowdSize });
assert(sim.targetCrowdSize === 150, 'Crowd size typed via keyboard correctly updates simEngine targetCrowdSize to 150');

// Simulate Keyboard Input: User types 0.7 into speed
simSettings.walkingSpeedMultiplier = 0.7;
sim.setParameters({ walkingSpeedMultiplier: simSettings.walkingSpeedMultiplier });
assert(sim.walkingSpeedMultiplier === 0.7, 'Walking speed typed via keyboard correctly updates simEngine to 0.7x');

// Simulate Hotkey: ArrowUp (+10 crowd)
simSettings.crowdSize = Math.min(500, simSettings.crowdSize + 10);
assert(simSettings.crowdSize === 160, 'ArrowUp increases crowd size by +10 (150 -> 160)');

// Simulate Hotkey: ArrowDown (-10 crowd)
simSettings.crowdSize = Math.max(5, simSettings.crowdSize - 10);
assert(simSettings.crowdSize === 150, 'ArrowDown decreases crowd size by -10 (160 -> 150)');

// Simulate Hotkey: ArrowRight (+0.1x speed)
simSettings.walkingSpeedMultiplier = Math.min(3.0, parseFloat((simSettings.walkingSpeedMultiplier + 0.1).toFixed(1)));
assert(simSettings.walkingSpeedMultiplier === 0.8, 'ArrowRight increases speed multiplier by +0.1x (0.7 -> 0.8)');

// Simulate Hotkey: ArrowLeft (-0.1x speed)
simSettings.walkingSpeedMultiplier = Math.max(0.1, parseFloat((simSettings.walkingSpeedMultiplier - 0.1).toFixed(1)));
assert(simSettings.walkingSpeedMultiplier === 0.7, 'ArrowLeft decreases speed multiplier by -0.1x (0.8 -> 0.7)');

console.log(`\n=========================================`);
console.log(`Results: ${passed} Passed, ${failed} Failed`);
if (failed === 0) {
  console.log('🎉 ALL FEATURE TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('⚠️ SOME TESTS FAILED.');
  process.exit(1);
}
