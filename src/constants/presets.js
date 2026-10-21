/**
 * Venue Layout Presets for CrowdFlow
 * Logical dimension: 1000 x 620 px (corresponds to 50m x 31m @ 20px/meter)
 */

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 620;
export const NAV_CELL_SIZE = 20; // 50 cols x 31 rows
export const HEATMAP_CELL_SIZE = 25; // 40 cols x 25 rows
export const PIXELS_PER_METER = 20;

export const VENUE_PRESETS = {
  exhibition: {
    id: 'exhibition',
    name: 'CrowdFlow Exhibition Hall Demo',
    description: 'Judge-friendly exhibition hall with a central congestion hotspot, side stalls, cross-aisle, and two exits.',
    units: 'meters',
    dimensions: { widthMeters: 80, heightMeters: 60, pixelsPerMeter: 12.5, floorAreaM2: 4800 },
    walls: [
      // North Boundary Wall with openings for Exit A (x: 50 to 150) and Exit B (x: 750 to 850)
      { id: 'w1', name: 'North Boundary Wall (West Wing)', x: 0, y: 0, w: 50, h: 14, isPerimeter: true },
      { id: 'w2', name: 'North Boundary Wall (Central Segment)', x: 150, y: 0, w: 600, h: 14, isPerimeter: true },
      { id: 'w3', name: 'North Boundary Wall (East Wing)', x: 850, y: 0, w: 150, h: 14, isPerimeter: true },

      // South Boundary Wall with opening for Main Entrance (x: 450 to 550)
      { id: 'w4', name: 'South Boundary Wall (West Wing)', x: 0, y: 606, w: 450, h: 14, isPerimeter: true },
      { id: 'w5', name: 'South Boundary Wall (East Wing)', x: 550, y: 606, w: 450, h: 14, isPerimeter: true },

      // Perimeter West and East Walls
      { id: 'w6', name: 'West Boundary Wall', x: 0, y: 0, w: 14, h: 620, isPerimeter: true },
      { id: 'w7', name: 'East Boundary Wall', x: 986, y: 0, w: 14, h: 620, isPerimeter: true },
      { id: 'w8', name: 'Cross-Aisle Wayfinding Divider', x: 450, y: 440, w: 100, h: 12, isPerimeter: false },
    ],
    stalls: [
      { id: 'stall_1', name: 'Exhibition Stall 1', x: 62, y: 130, w: 175, h: 60, color: '#1e293b', accent: '#3b82f6', category: 'Tech' },
      { id: 'stall_2', name: 'Exhibition Stall 2', x: 62, y: 230, w: 175, h: 60, color: '#1e293b', accent: '#10b981', category: 'Energy' },
      { id: 'stall_3', name: 'Exhibition Stall 3', x: 62, y: 330, w: 175, h: 60, color: '#1e293b', accent: '#f59e0b', category: 'Services' },
      { id: 'stall_7', name: 'Exhibition Stall 7', x: 62, y: 470, w: 175, h: 60, color: '#1e293b', accent: '#8b5cf6', category: 'Main Stage' },
      { id: 'stall_4', name: 'Exhibition Stall 4', x: 762, y: 130, w: 175, h: 60, color: '#1e293b', accent: '#ec4899', category: 'Media' },
      { id: 'stall_5', name: 'Exhibition Stall 5', x: 762, y: 230, w: 175, h: 60, color: '#1e293b', accent: '#06b6d4', category: 'Hardware' },
      { id: 'stall_6', name: 'Exhibition Stall 6', x: 762, y: 330, w: 175, h: 60, color: '#1e293b', accent: '#6366f1', category: 'Industry' },
      { id: 'stall_8', name: 'Exhibition Stall 8', x: 762, y: 470, w: 175, h: 60, color: '#1e293b', accent: '#f97316', category: 'Robotics' },
    ],
    obstacles: [
      { id: 'o1', name: 'Central Corridor Bottleneck Totem', x: 488, y: 300, w: 24, h: 36, shape: 'rect' },
      { id: 'o2', name: 'Digital Directory Kiosk', x: 370, y: 300, w: 24, h: 36, shape: 'rect' },
    ],
    entrances: [
      { id: 'entrance_main', name: 'Main Entrance (Gate A)', x: 450, y: 596, w: 48, h: 24, spawnX: 474, spawnY: 550, spawnRate: 1.0, enabled: true },
      { id: 'entrance_main_b', name: 'Main Entrance (Gate B)', x: 502, y: 596, w: 48, h: 24, spawnX: 526, spawnY: 550, spawnRate: 1.0, enabled: true },
    ],
    exits: [
      { id: 'exit_a', name: 'Exit A', x: 50, y: 0, w: 100, h: 24, targetX: 100, targetY: 10, capacity: 100, enabled: true },
      { id: 'exit_b', name: 'Exit B', x: 750, y: 0, w: 100, h: 24, targetX: 800, targetY: 10, capacity: 100, enabled: true },
    ],
    walkableZones: [
      { id: 'north_walkway', name: 'North Walkway', x: 14, y: 14, w: 972, h: 70 },
      { id: 'cross_aisle', name: 'Cross-Aisle', x: 14, y: 370, w: 972, h: 50 },
      { id: 'left_alternative_route', name: 'Left Alternative Route', x: 262, y: 80, w: 88, h: 290 },
      { id: 'right_alternative_route', name: 'Right Alternative Route', x: 650, y: 80, w: 88, h: 290 },
      { id: 'main_corridor', name: 'Main Corridor (Bottleneck Demo)', x: 450, y: 260, w: 100, h: 110 },
    ],
    attractions: [
      { id: 'central_attraction', name: 'Popular Central Exhibit', x: 388, y: 180, w: 225, h: 80, attractionStrength: 0.85, dwellSeconds: 5, color: '#f59e0b', accent: '#fbbf24', enabled: true },
    ],
    dualGates: [],
    scenarios: [
      {
        id: "baseline",
        name: "1. Baseline Congestion",
        description: "Narrow central corridor; use the primary route configuration supported by the engine.",
        overrides: { main_corridor_width: 4, active_exits: ["exit_a"] }
      },
      {
        id: "wider_corridor",
        name: "2. Wider Corridor",
        description: "Widen the central corridor while keeping crowd and start conditions the same.",
        overrides: { main_corridor_width: 8, active_exits: ["exit_a"] }
      },
      {
        id: "optimized",
        name: "3. Optimized Layout",
        description: "Wider corridor and both exits active, if supported by the simulator.",
        overrides: { main_corridor_width: 8, active_exits: ["exit_a", "exit_b"] }
      }
    ],
    rawPlan: {
      name: "CrowdFlow Exhibition Hall Demo",
      description: "Judge-friendly exhibition hall with a central congestion hotspot, side stalls, cross-aisle, and two exits.",
      units: "meters",
      venue: {
        type: "exhibition_hall",
        width: 80,
        height: 60,
        origin: "bottom_left",
        entrances: [
          { id: "entrance_main", name: "Main Entrance", x: 40, y: 0, width: 8 }
        ],
        exits: [
          { id: "exit_a", name: "Exit A", x: 8, y: 60, width: 8 },
          { id: "exit_b", name: "Exit B", x: 64, y: 60, width: 8 }
        ]
      },
      obstacles: [
        { id: "stall_1", type: "stall", name: "Exhibition Stall 1", x: 5, y: 42, width: 14, height: 6 },
        { id: "stall_2", type: "stall", name: "Exhibition Stall 2", x: 5, y: 32, width: 14, height: 6 },
        { id: "stall_3", type: "stall", name: "Exhibition Stall 3", x: 5, y: 22, width: 14, height: 6 },
        { id: "stall_4", type: "stall", name: "Exhibition Stall 4", x: 61, y: 42, width: 14, height: 6 },
        { id: "stall_5", type: "stall", name: "Exhibition Stall 5", x: 61, y: 32, width: 14, height: 6 },
        { id: "stall_6", type: "stall", name: "Exhibition Stall 6", x: 61, y: 22, width: 14, height: 6 },
        { id: "stall_7", type: "stall", name: "Exhibition Stall 7", x: 5, y: 8, width: 14, height: 6 },
        { id: "stall_8", type: "stall", name: "Exhibition Stall 8", x: 61, y: 8, width: 14, height: 6 },
        { id: "central_attraction", type: "attraction", name: "Popular Central Exhibit", x: 31, y: 35, width: 18, height: 8 }
      ],
      walkways: [
        { id: "north_walkway", name: "North Walkway", x: 0, y: 53, width: 80, height: 7 },
        { id: "cross_aisle", name: "Cross-Aisle", x: 0, y: 19, width: 80, height: 5 },
        { id: "left_alternative_route", name: "Left Alternative Route", x: 21, y: 24, width: 7, height: 29 },
        { id: "right_alternative_route", name: "Right Alternative Route", x: 52, y: 24, width: 7, height: 29 },
        { id: "main_corridor", name: "Main Corridor (Bottleneck Demo)", x: 36, y: 24, width: 8, height: 11 }
      ],
      simulation: {
        default_agent_count: 150,
        recommended_test_agent_count: 120,
        spawn_area: { x: 30, y: 2, width: 20, height: 8 },
        movement: { speed_m_per_s: 1.3, avoid_obstacles: true, avoid_other_agents: true },
        heatmap: { enabled_by_default: true, metric: "agent_density", legend: ["low", "medium", "high", "critical"] },
        scenarios: [
          {
            id: "baseline",
            name: "1. Baseline Congestion",
            description: "Narrow central corridor; use the primary route configuration supported by the engine.",
            overrides: { main_corridor_width: 4, active_exits: ["exit_a"] }
          },
          {
            id: "wider_corridor",
            name: "2. Wider Corridor",
            description: "Widen the central corridor while keeping crowd and start conditions the same.",
            overrides: { main_corridor_width: 8, active_exits: ["exit_a"] }
          },
          {
            id: "optimized",
            name: "3. Optimized Layout",
            description: "Wider corridor and both exits active, if supported by the simulator.",
            overrides: { main_corridor_width: 8, active_exits: ["exit_a", "exit_b"] }
          }
        ],
        comparison_metrics: [
          "completed_agents",
          "average_travel_time",
          "maximum_density",
          "congestion_duration"
        ]
      }
    }
  },

  transit: {
    id: 'transit',
    name: 'Transit Station Concourse',
    description: 'High-throughput metropolitan station with automatic fare barriers, ticket machines, and platform escalators.',
    dimensions: { widthMeters: 50, heightMeters: 31, pixelsPerMeter: 20, floorAreaM2: 1550 },
    walls: [
      { id: 'w1', name: 'North Boundary Wall', x: 0, y: 0, w: 1000, h: 14, isPerimeter: true },
      { id: 'w2', name: 'South Boundary Wall', x: 0, y: 606, w: 1000, h: 14, isPerimeter: true },
      { id: 'w3', name: 'West Wall (North)', x: 0, y: 0, w: 14, h: 110, isPerimeter: true },
      { id: 'w4', name: 'West Wall (Central)', x: 0, y: 210, w: 14, h: 200, isPerimeter: true },
      { id: 'w5', name: 'West Wall (South)', x: 0, y: 510, w: 14, h: 110, isPerimeter: true },
      { id: 'w6', name: 'East Wall (North)', x: 986, y: 0, w: 14, h: 110, isPerimeter: true },
      { id: 'w7', name: 'East Wall (Central)', x: 986, y: 210, w: 14, h: 200, isPerimeter: true },
      { id: 'w8', name: 'East Wall (South)', x: 986, y: 510, w: 14, h: 110, isPerimeter: true },
      // Central Turnstile Barrier with narrow gates (bottlenecks)
      { id: 'w9', name: 'Fare Barrier Wall Top', x: 480, y: 14, w: 20, h: 130, isPerimeter: false },
      { id: 'w10', name: 'Fare Barrier Wall Mid-Top', x: 480, y: 210, w: 20, h: 80, isPerimeter: false },
      { id: 'w11', name: 'Fare Barrier Wall Mid-Bottom', x: 480, y: 350, w: 20, h: 80, isPerimeter: false },
      { id: 'w12', name: 'Fare Barrier Wall Bottom', x: 480, y: 490, w: 20, h: 120, isPerimeter: false },
    ],
    stalls: [
      { id: 's1', name: 'Self-Service Ticketing Bank A', x: 140, y: 80, w: 160, h: 120, color: '#1e293b', accent: '#0284c7', category: 'Ticketing' },
      { id: 's2', name: 'Self-Service Ticketing Bank B', x: 140, y: 420, w: 160, h: 120, color: '#1e293b', accent: '#0284c7', category: 'Ticketing' },
      { id: 's3', name: 'Customer Service & Information', x: 220, y: 250, w: 120, h: 120, color: '#1e293b', accent: '#d97706', category: 'Help' },
      { id: 's4', name: 'Main Departure Timetable Plaza', x: 640, y: 100, w: 200, h: 110, color: '#1e293b', accent: '#059669', category: 'Displays' },
      { id: 's5', name: 'Transit Convenience & Kiosk', x: 640, y: 410, w: 200, h: 110, color: '#1e293b', accent: '#ea580c', category: 'Retail' },
    ],
    obstacles: [
      { id: 'o1', name: 'Ticket Barrier Turnstile Group 1', x: 476, y: 144, w: 28, h: 66, shape: 'rect' },
      { id: 'o2', name: 'Ticket Barrier Turnstile Group 2', x: 476, y: 290, w: 28, h: 60, shape: 'rect' },
      { id: 'o3', name: 'Ticket Barrier Turnstile Group 3', x: 476, y: 430, w: 28, h: 60, shape: 'rect' },
    ],
    entrances: [
      { id: 'ent1', name: 'Street Concourse Inflow West A', x: 2, y: 116, w: 26, h: 88, spawnX: 30, spawnY: 160, spawnRate: 1.0, enabled: true },
      { id: 'ent2', name: 'Subway Transfer Inflow West B', x: 2, y: 416, w: 26, h: 88, spawnX: 30, spawnY: 460, spawnRate: 1.0, enabled: true },
    ],
    exits: [
      { id: 'exit1', name: 'Platform 1 & 2 Escalators', x: 972, y: 116, w: 26, h: 88, targetX: 985, targetY: 160, capacity: 100, enabled: true },
      { id: 'exit2', name: 'Platform 3 & 4 Escalators', x: 972, y: 416, w: 26, h: 88, targetX: 985, targetY: 460, capacity: 100, enabled: true },
    ],
    walkableZones: [
      { id: 'wz1', name: 'Pre-Turnstile Waiting Concourse', x: 40, y: 50, w: 430, h: 520 },
      { id: 'wz2', name: 'Post-Turnstile Platform Access', x: 520, y: 50, w: 440, h: 520 }
    ],
    attractions: [
      { id: 'att1', name: 'Main Timetable & Departures Display', x: 230, y: 220, w: 140, h: 90, attractionStrength: 0.70, dwellSeconds: 4, color: '#f59e0b', accent: '#fbbf24', enabled: true }
    ],
    dualGates: []
  },

  plaza: {
    id: 'plaza',
    name: 'Multi-Aisle Shopping Mall',
    description: 'Commercial atrium with four corner anchor stores, central decorative atrium fountain, and surrounding boutique corridors.',
    dimensions: { widthMeters: 50, heightMeters: 31, pixelsPerMeter: 20, floorAreaM2: 1550 },
    walls: [
      { id: 'w1', name: 'North Boundary Wall', x: 0, y: 0, w: 1000, h: 14, isPerimeter: true },
      { id: 'w2', name: 'South Boundary Wall', x: 0, y: 606, w: 1000, h: 14, isPerimeter: true },
      { id: 'w3', name: 'West Wall North', x: 0, y: 0, w: 14, h: 110, isPerimeter: true },
      { id: 'w4', name: 'West Wall Central', x: 0, y: 210, w: 14, h: 200, isPerimeter: true },
      { id: 'w5', name: 'West Wall South', x: 0, y: 510, w: 14, h: 110, isPerimeter: true },
      { id: 'w6', name: 'East Wall North', x: 986, y: 0, w: 14, h: 110, isPerimeter: true },
      { id: 'w7', name: 'East Wall Central', x: 986, y: 210, w: 14, h: 200, isPerimeter: true },
      { id: 'w8', name: 'East Wall South', x: 986, y: 510, w: 14, h: 110, isPerimeter: true },
    ],
    stalls: [
      { id: 's1', name: 'Flagship Fashion Anchor North', x: 140, y: 60, w: 220, h: 140, color: '#1e293b', accent: '#2563eb', category: 'Retail' },
      { id: 's2', name: 'Gourmet Hypermarket South', x: 140, y: 420, w: 220, h: 140, color: '#1e293b', accent: '#16a34a', category: 'Grocery' },
      { id: 's3', name: 'Central Fountain & Planter Atrium', x: 450, y: 240, w: 100, h: 140, color: '#1e293b', accent: '#0284c7', category: 'Amenity' },
      { id: 's4', name: 'Digital Megastore East North', x: 640, y: 60, w: 220, h: 140, color: '#1e293b', accent: '#7c3aed', category: 'Electronics' },
      { id: 's5', name: 'Food Court & Dining Village', x: 640, y: 420, w: 220, h: 140, color: '#1e293b', accent: '#dc2626', category: 'Dining' },
    ],
    obstacles: [
      { id: 'o1', name: 'Center Escalator Bank', x: 430, y: 80, w: 140, h: 50, shape: 'rect' },
      { id: 'o2', name: 'Glass Elevator Shaft', x: 460, y: 490, w: 80, h: 60, shape: 'rect' },
    ],
    entrances: [
      { id: 'ent1', name: 'Mall West Plaza Entrance', x: 2, y: 116, w: 26, h: 88, spawnX: 30, spawnY: 160, spawnRate: 1.0, enabled: true },
      { id: 'ent2', name: 'Metro Link West Entrance', x: 2, y: 416, w: 26, h: 88, spawnX: 30, spawnY: 460, spawnRate: 1.0, enabled: true },
    ],
    exits: [
      { id: 'exit1', name: 'East Avenue Boulevard Exit', x: 972, y: 116, w: 26, h: 88, targetX: 985, targetY: 160, capacity: 100, enabled: true },
      { id: 'exit2', name: 'Parking Structure East Exit', x: 972, y: 416, w: 26, h: 88, targetX: 985, targetY: 460, capacity: 100, enabled: true },
    ],
    walkableZones: [
      { id: 'wz1', name: 'Central Aisle Galleria', x: 100, y: 200, w: 800, h: 220 }
    ],
    attractions: [
      { id: 'att1', name: 'Central Fountain Performance Stage', x: 430, y: 230, w: 140, h: 120, attractionStrength: 0.75, dwellSeconds: 6, color: '#f59e0b', accent: '#fbbf24', enabled: true }
    ],
    dualGates: []
  }
};
