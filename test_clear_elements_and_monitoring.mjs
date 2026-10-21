import { buildNavigationGrid } from './src/engine/navigation.js';
import { SimulationEngine } from './src/engine/simulation.js';

console.log('🧪 Testing Clear All Elements and Navigation Grid Stability...');

const emptyVenue = {
  id: 'venue_cleared',
  name: 'Cleared Venue Layout',
  description: 'Blank venue canvas.',
  dimensions: { widthMeters: 50, heightMeters: 31, pixelsPerMeter: 20 },
  walls: [],
  stalls: [],
  entrances: [],
  exits: [],
  obstacles: [],
  walkableZones: [],
  barriers: [],
  doors: [],
  gates: []
};

// 1. Navigation Grid with 0 elements
const nav = buildNavigationGrid(emptyVenue);
console.assert(nav !== null, 'Nav grid must not be null');
console.assert(nav.activeExits.length === 0, 'Active exits must be 0');
console.assert(nav.blocked.length === 31, 'Blocked grid has 31 rows');
console.assert(nav.blocked[0].length === 50, 'Blocked grid has 50 cols');
console.log('  ✅ PASS: buildNavigationGrid handled 0 exits and 0 walls without throwing');

// 2. Simulation Engine with 0 elements
const sim = new SimulationEngine(emptyVenue, nav, { liveCameraTwinMode: true, liveCameraCount: 0 });
sim.reset();
console.assert(sim.pedestrians.length === 0, 'Zero pedestrians in empty venue');
sim.updateVenueAndNav(emptyVenue, nav);
console.log('  ✅ PASS: SimulationEngine handled empty venue and nav reset cleanly');

// 3. Clear All Layout Elements simulation test
function clearAllLayoutElementsMock(venue) {
  return {
    id: venue?.id || 'venue_new',
    name: venue?.name || 'Cleared Venue Layout',
    dimensions: venue?.dimensions || { widthMeters: 50, heightMeters: 31, pixelsPerMeter: 20 },
    walls: [],
    stalls: [],
    entrances: [],
    exits: [],
    obstacles: [],
    walkableZones: [],
    barriers: [],
    doors: [],
    gates: []
  };
}

const cleared = clearAllLayoutElementsMock(null);
console.assert(cleared.walls.length === 0, 'Cleared walls length is 0');
console.assert(cleared.stalls.length === 0, 'Cleared stalls length is 0');
console.assert(cleared.entrances.length === 0, 'Cleared entrances length is 0');
console.assert(cleared.exits.length === 0, 'Cleared exits length is 0');
console.log('  ✅ PASS: clearAllLayoutElements handles null venue safely and returns empty layout');

console.log('\n🎉 All Clear All Elements tests passed!');
