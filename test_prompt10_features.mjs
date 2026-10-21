// End-to-end node verification of Prompt 10 enhancements
import { VENUE_PRESETS } from './src/constants/presets.js';
import { SimulationEngine } from './src/engine/simulation.js';
import { buildNavigationGrid } from './src/engine/navigation.js';

console.log('--- 1. Testing Attraction Object in Presets ---');
const exhibition = VENUE_PRESETS.exhibition;
console.log('Exhibition attractions count:', (exhibition.attractions || []).length);
if (!exhibition.attractions || exhibition.attractions.length === 0) {
  throw new Error('Expected exhibition preset to have attractions');
}
const att = exhibition.attractions[0];
console.log('Attraction 0:', att.name, 'x:', att.x, 'y:', att.y, 'dwellSeconds:', att.dwellSeconds);

console.log('\n--- 2. Testing Simulation Physics with Attraction ---');
const nav = buildNavigationGrid(exhibition);
const sim = new SimulationEngine(exhibition, nav, {
  isDemoSimulation: true,
  targetCrowdSize: 50,
  walkingSpeedMultiplier: 1.0,
  simClockRate: 2
});

console.log('Initial pedestrians spawned:', sim.pedestrians.length);
const headingToAttraction = sim.pedestrians.filter(p => p.state === 'heading_to_attraction');
console.log('Pedestrians attracted to keynote stage:', headingToAttraction.length);

if (headingToAttraction.length === 0) {
  throw new Error('Expected pedestrians to be attracted to keynote stage');
}

// Step simulation forward 20 seconds (400 steps of 0.05s)
for (let i = 0; i < 400; i++) {
  sim.update(0.05);
}

const visitingAttraction = sim.pedestrians.filter(p => p.state === 'visiting_attraction');
const headingToExit = sim.pedestrians.filter(p => p.state === 'heading_to_exit');
const exited = sim.totalExited;

console.log(`After 20s: Visiting attraction: ${visitingAttraction.length}, Heading to exit: ${headingToExit.length}, Total exited: ${exited}`);

console.log('\n--- 3. Testing Analytics Calculations ---');
const metrics = sim.getMetrics();
console.log('Active pedestrians:', metrics.activePedestrians);
console.log('Peak density:', metrics.peakDensity, 'p/cell (~' + (metrics.peakDensity * 0.64).toFixed(1) + ' p/m²)');
console.log('Throughput:', metrics.throughputRate, 'people/min');
console.log('Choke points:', metrics.activeHotspotsCount);

console.log('\n--- ALL VERIFICATIONS PASSED SUCCESSFULLY! ---');
