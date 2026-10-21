import { CANVAS_WIDTH, CANVAS_HEIGHT, VENUE_PRESETS } from './src/constants/presets.js';
import { buildNavigationGrid } from './src/engine/navigation.js';
import { SimulationEngine } from './src/engine/simulation.js';
import { digitalizeBlueprintToLayout } from './src/engine/cvDetector.js';

console.log('🧪 Testing Layout Digitalization, Deployment, Camera Optics, and Live-Only Simulation...\n');

let passes = 0;
let fails = 0;
function test(name, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passes++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    fails++;
  }
}

// 1. Test auto-digitalization fallback and structure
const baseVenue = JSON.parse(JSON.stringify(VENUE_PRESETS.exhibition));
const digitalized = await digitalizeBlueprintToLayout(null, baseVenue);

test('Digitalized layout has walls', Array.isArray(digitalized.walls) && digitalized.walls.length > 0);
test('Digitalized layout has stalls/booths', Array.isArray(digitalized.stalls) && digitalized.stalls.length > 0);
test('Digitalized layout has entrance gates', Array.isArray(digitalized.entrances) && digitalized.entrances.length > 0);
test('Digitalized layout has exit portals', Array.isArray(digitalized.exits) && digitalized.exits.length > 0);
test('Digitalized layout has walkable transit zones', Array.isArray(digitalized.walkableZones) && digitalized.walkableZones.length > 0);

// Verify all digitalized objects have editable coordinates
const allObjects = [...digitalized.walls, ...digitalized.stalls, ...digitalized.entrances, ...digitalized.exits];
const allValidCoords = allObjects.every(o => typeof o.x === 'number' && typeof o.y === 'number' && typeof o.w === 'number' && typeof o.h === 'number');
test('All digitalized layout objects have editable (x, y, w, h) geometry', allValidCoords);

// 2. Test Navigation Grid builds from digitalized layout
const nav = buildNavigationGrid(digitalized);
test('Navigation flow field successfully generated from digitalized layout', nav && nav.globalField);

// 3. Test SimulationEngine in strict Live Camera Twin Mode (No Fake Demo Crowd)
const simLiveZero = new SimulationEngine(digitalized, nav, {
  liveCameraTwinMode: true,
  liveCameraCount: 0,
});
test('When live camera count is 0, initial active pedestrians strictly equals 0', simLiveZero.pedestrians.length === 0);

for (let i = 0; i < 100; i++) {
  simLiveZero.update(0.016);
}
test('After 100 simulation frames with 0 live cameras, active pedestrians remains strictly 0 (no fake demo)', simLiveZero.pedestrians.filter(p => p.status === 'active').length === 0);

// Now update with 14 live camera individuals
simLiveZero.setParameters({
  liveCameraTwinMode: true,
  liveCameraCount: 14,
});

test('After updating liveCameraCount to 14, active pedestrians strictly equals 14', simLiveZero.pedestrians.filter(p => p.status === 'active').length === 14);

// Advance 120 frames - population should maintain exactly 14
for (let i = 0; i < 120; i++) {
  simLiveZero.update(0.016);
}
test('During ongoing live simulation, population is strictly maintained at live camera count (14)', simLiveZero.pedestrians.filter(p => p.status === 'active').length === 14);

console.log(`\n📊 Verification Results: ${passes} Passed, ${fails} Failed.`);
if (fails > 0) process.exit(1);
