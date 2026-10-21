# CrowdFlow — Pedestrian Crowd Dynamics Simulation Prototype

**CrowdFlow** is an interactive, browser-based 2D pedestrian simulation prototype designed for educational demonstrations of crowd flow and congestion dynamics in venues such as exhibition halls, transit stations, and shopping plazas.

Developed as a college first-year computer science project, it demonstrates how pedestrians navigate through walkable corridors, how bottlenecks form at pinch points, and how crowd size and walking speed influence overall venue throughput.

---

## 1. What CrowdFlow Does

- **Real-Time 2D Simulation**: Simulates hundreds of individual pedestrians entering through designated entry gates, navigating around architectural obstacles (exhibition booths, information kiosks, turnstiles), and exiting smoothly.
- **Dynamic Density Heatmap**: Calculates cell-by-cell pedestrian density in real time using a four-tier color overlay (Low/Green, Moderate/Yellow, High/Orange, Bottleneck/Red).
- **Bottleneck Detection**: Identifies localized choke points where pedestrian density exceeds safety thresholds and visually flags them with warning indicators.
- **Live Metric Dashboard**: Displays active population, cumulative completed journeys (exited count), average density ($p/100\text{ m}^2$), active congestion hotspots, and simulation elapsed time.
- **Multiple Venue Presets**: Switch between three preconfigured floor plans:
  1. **Exhibition Hall A (Default)**: 6 themed exhibition pavilions with central circulation aisles.
  2. **Transit Station Concourse**: High-throughput train station concourse with ticket barrier pinch points.
  3. **Multi-Aisle Shopping Mall**: Commercial atrium with corner department stores and central pedestrian plaza.

---

## 2. What Is Simulated vs. What Is Simplified

| Real-World Phenomenon | Simulation Implementation | Simplification / Educational Scope |
| :--- | :--- | :--- |
| **Pathfinding & Navigation** | Continuous Potential Flow Field (Breadth-First Search / Dijkstra distance transform) computed across a 20px grid. | Pedestrians follow optimal global vector fields without complex multi-waypoint schedules. |
| **Obstacle Avoidance** | Wall distance sensing with repulsive steering vectors and boundary clamping. | Booths and perimeter walls are represented as 2D bounding boxes. |
| **Pedestrian Interaction** | Spatial-hashed local social separation forces with relative velocity damping. | Simplified social force model; no body rotation or limb kinematics. |
| **Congestion / Queuing** | Emergent queuing naturally develops when inflow through narrow corridors exceeds capacity. | Simplified crowd density metrics; not certified for fire safety or code compliance. |

---

## 3. Project File Structure

```text
CrowdFlow/
├── index.html       # Semantic HTML5 dashboard layout and simulation canvas
├── style.css        # Clean, modern CSS design system and responsive layout
├── script.js        # Vanilla JavaScript simulation engine, flow fields, and UI logic
└── README.md        # Documentation, setup instructions, and architecture explanation
```

No build step, external dependencies, or network connections are required. The entire prototype is self-contained.

---

## 4. How to Run Locally

### Method 1: Direct Browser Opening (Simplest)
1. Double-click `index.html` in your file manager (or right-click $\to$ "Open With" $\to$ Google Chrome, Microsoft Edge, Firefox, or Safari).
2. The prototype will load instantly and be ready to run.

### Method 2: Local HTTP Server (Optional)
If running inside an IDE or local terminal:
```bash
# Using Python 3 (preinstalled on macOS/Linux)
cd CrowdFlow
python3 -m http.server 8000

# Open in browser: http://localhost:8000
```
or with Node.js (if installed):
```bash
npx serve CrowdFlow
```

---

## 5. Available Controls & Features

### Playback Controls
- **Start**: Launches or resumes the continuous simulation loop at 60 FPS.
- **Pause**: Temporarily halts movement and freezes the simulation clock.
- **Reset**: Clears all pedestrians, resets counters, and restores the initial clean state.

### Simulation Parameters
- **Target Crowd Size Slider**: Adjusts crowd population from **20 to 300 pedestrians** (default: 80). The spawner dynamically manages inflow to match the target.
- **Walking Speed Slider**: Scales base walking speed from **0.5x (Slow)** to **2.5x (Fast)**.
- **Simulation Clock Rate**: Switch simulation speed between **1x**, **2x**, and **4x** time progression.

### Visualization Layers
- **Density Heatmap Overlay**: Toggles the real-time smoothed density color grid.
- **Bottleneck Warning Rings**: Toggles animated warning rings at detected high-density choke points.
- **Navigation Corridor Lines**: Toggles visual vector lines showing the underlying navigation grid.
- **Venue Preset Selector**: Instantly switches between Exhibition Hall, Transit Concourse, and Shopping Mall.
- **Heatmap Legend**: Collapsible legend detailing the color tiers and prototype disclaimers.

---

## 6. How the Heatmap and Congestion Detection Work

1. **Density Grid Discretization**:
   The walkable area is divided into a $40 \times 25$ grid of $25 \times 25\text{ px}$ cells.
2. **Pedestrian Binning**:
   Each frame, active pedestrian coordinates are mapped to their corresponding grid cell.
3. **Temporal Smoothing (Exponential Moving Average)**:
   To prevent flickering from rapid pedestrian movement, density values are smoothed over time:
   $$D_{t} = (1 - \alpha) \cdot D_{t-1} + \alpha \cdot \text{count}_t \quad (\alpha = 0.14)$$
4. **Color Mapping**:
   - **Green ($0.5 \le D < 1.8$)**: Low density, free flowing.
   - **Yellow ($1.8 \le D < 3.5$)**: Moderate density, minor speed reduction.
   - **Orange ($3.5 \le D < 5.0$)**: High density, localized slowing.
   - **Red ($D \ge 5.0$)**: Bottleneck / Critical congestion, severe queuing.
5. **Hotspot Warning**:
   Cells exceeding the threshold ($D \ge 3.5$) trigger live alert counts on the dashboard and display animated warning markers.

---

## 7. Known Limitations

1. **Prototype Disclaimer**: This project is an educational model intended to illustrate qualitative crowd flow patterns. It is **not** a certified architectural egress calculator, fire safety simulator, or disaster prediction tool.
2. **2D Top-Down Plane**: Movement is strictly planar ($x, y$); multi-floor stairs and vertical elevation changes are not modeled.
3. **Homogeneous Routing**: While pedestrians have randomized speeds and alternate between exits, they do not possess individual shopping agendas or stop to view specific exhibits.
4. **Extreme Crowd Saturation**: At crowd sizes exceeding 300 pedestrians, intense packing in narrow 40px aisles may lead to slower flow rates due to continuous collision resolution.
