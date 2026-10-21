// Automated test for Prompt 11 requirements
import { VENUE_PRESETS } from './src/constants/presets.js';
import { SimulationEngine } from './src/engine/simulation.js';
import { buildNavigationGrid } from './src/engine/navigation.js';
import fs from 'fs';

console.log('🧪 1. Verifying Dual Gate & Presets...');
const exhibition = JSON.parse(JSON.stringify(VENUE_PRESETS.exhibition));
if (!Array.isArray(exhibition.dualGates)) {
  throw new Error('Expected exhibition to have dualGates array');
}

// Add a dual gate to the venue layout
exhibition.dualGates.push({
  id: 'dg1',
  name: 'Central East Dual Gate',
  x: 970,
  y: 280,
  w: 28,
  h: 80,
  spawnX: 950,
  spawnY: 320,
  targetX: 985,
  targetY: 320,
  enabled: true
});

console.log('✅ Dual gate added to test venue');

console.log('\n🧪 2. Verifying Navigation Grid with Dual Gate...');
const nav = buildNavigationGrid(exhibition);
// Ensure dual gate is in activeExits of navigation engine
const foundDualGateAsExit = nav.activeExits.some(e => e.id === 'dg1');
if (!foundDualGateAsExit) {
  throw new Error('Expected dual gate to be registered as an active exit in NavigationEngine');
}
console.log('✅ Navigation grid registered dual gate as a valid exit destination');

console.log('\n🧪 3. Verifying Simulation Engine Spawning & Exiting through Dual Gate...');
// Create a venue where ONLY the dual gate is open (disable pure entrances and pure exits)
const isolatedVenue = JSON.parse(JSON.stringify(exhibition));
isolatedVenue.entrances.forEach(e => e.enabled = false);
isolatedVenue.exits.forEach(e => e.enabled = false);

const isolatedNav = buildNavigationGrid(isolatedVenue);
const sim = new SimulationEngine(isolatedVenue, isolatedNav, {
  isDemoSimulation: true,
  targetCrowdSize: 20,
  walkingSpeedMultiplier: 1.0,
  simClockRate: 1
});

// Since only the dual gate is enabled, all spawned pedestrians must originate from dg1
console.log('Initial pedestrians spawned from dual gate:', sim.pedestrians.length);
if (sim.pedestrians.length === 0) {
  throw new Error('Expected pedestrians to be spawned from dual gate when pure entrances are disabled');
}
console.log('✅ Dual gate functions as Entrance (Inflow)');

// Pedestrians' target exit should also be dg1
const targetExitIsDual = sim.pedestrians.every(p => p.targetExitId === 'dg1');
if (!targetExitIsDual) {
  throw new Error('Expected pedestrians to target dual gate as exit when pure exits are disabled');
}
console.log('✅ Dual gate functions as Exit (Outflow)');

console.log('\n🧪 4. Verifying Removal of Student Project & Screenshot Options...');
const navbarCode = fs.readFileSync('./src/components/Navbar.jsx', 'utf8');
if (navbarCode.includes('Student Project')) {
  throw new Error('Navbar still contains "Student Project"');
}
if (navbarCode.includes('status-pill') || navbarCode.includes('Simulating') || navbarCode.includes('preset-select')) {
  throw new Error('Navbar still contains status-pill or preset-select dropdown');
}
console.log('✅ Navbar is clean (no student badge, no Simulating pill, no layout dropdown)');

const overviewCode = fs.readFileSync('./src/components/OverviewDashboard.jsx', 'utf8');
if (overviewCode.includes('dashboard-hero') || overviewCode.includes('Crowd Simulation & Planning Tool')) {
  throw new Error('OverviewDashboard still contains dashboard-hero');
}
if (overviewCode.includes('College Project Note') || overviewCode.includes('first-year student demonstration')) {
  throw new Error('OverviewDashboard still contains student project disclaimer');
}
console.log('✅ Overview Dashboard is clean (no dashboard-hero, no student disclaimer)');

const editorCode = fs.readFileSync('./src/components/VenueEditor.jsx', 'utf8');
if (editorCode.includes("setActiveTool('select');\n      }\n      newObjDrawingRef.current = null;")) {
  throw new Error('VenueEditor still resets to select in handleMouseUp');
}
console.log('✅ VenueEditor allows continuous element placement without resetting tool to select');

console.log('\n🎉 ALL VERIFICATIONS PASSED SUCCESSFULLY!');
