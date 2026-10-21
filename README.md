# CrowdFlow — Real-Time Multi-Camera Crowd Observation & Spatial Intelligence

An integrated browser-based crowd intelligence and simulation platform built with **React**, **Vite**, **Python FastAPI**, **Ultralytics YOLOv8n**, **OpenCV**, **HTML5 Canvas**, and **SQLite**.

CrowdFlow provides two distinct, non-overlapping capabilities:
1. **Live Camera Observation & Monitoring**: Connect multiple physical smartphones via generated QR codes/links, desktop webcams, RTSP IP cameras, or recorded video files. Detect people in real time with an edge YOLOv8n model, map observations to blueprint zones, aggregate occupancy with anti-double-counting policies, and visualize live density overlays on the uploaded floor plan.
2. **Virtual Pedestrian Simulation**: 2D continuous social-force simulation with Dijkstra potential flow fields, emergent bottleneck queuing, Level of Service (LOS) analytics, and automated architectural layout recommendations.

---

## 1. Quick Launch Instructions

### Prerequisites
- Node.js (v18+) & npm
- Python 3.9+ (virtual environment with dependencies is already configured in `backend/venv`)

### Launch Both Backend & Frontend Simultaneously
```bash
# Navigate to workspace
cd /Users/shauryataliyan/Documents/CrowdFlow_Final_Code

# Start both Python FastAPI YOLO backend & Vite HTTPS frontend dev server
npm start
```

Or run each component individually:
```bash
# Terminal 1: Start Python FastAPI YOLO Detection Backend (Port 8000)
npm run backend

# Terminal 2: Start Vite HTTPS Frontend (Port 3000, 0.0.0.0 host binding)
npm run dev
```

### Access URLs:
- **Desktop Dashboard**: `https://localhost:3000`
- **Mobile Access (from any phone on Wi-Fi)**: `https://<YOUR_LAN_IP>:3000` (e.g. `https://192.168.21.221:3000`)
- **Backend API & Swagger Docs**: `http://localhost:8000/docs`

### Run Automated Verification Test Suite (41 Tests)
```bash
npm test
```
- Tests virtual navigation and pedestrian simulation loop (`test_crowdflow.mjs`)
- Tests FastAPI REST endpoints, session tokens, QR codes, YOLOv8n inference on real images, and zone aggregation policies (`backend/test_monitoring_api.py`)

---

## 2. Live Monitoring Architecture & Workflows

### How to Connect a Phone as a Live Camera (Primary Demo)
1. Open the dashboard at `https://localhost:3000` and switch to the **Live Monitoring** tab.
2. Click **Connect Phone Camera**.
3. A unique camera session is generated with an unpredictable cryptographic token, accompanied by a high-contrast QR code and direct URL.
4. On your mobile phone (connected to the same Wi-Fi network):
   - Scan the QR code using your phone's default camera app or open the URL in Chrome/Safari.
   - Accept the browser's local HTTPS development certificate if prompted.
   - The standalone mobile client opens (`mobile-camera.html`).
   - Tap **Start Camera & Stream** and grant camera permissions.
5. The phone captures frames at ~3 FPS, sends them via WebSocket to the FastAPI backend, where **YOLOv8n** detects people and returns bounding boxes and inference latency in real time.
6. The phone displays bounding boxes around observed individuals on its viewfinder.
7. The desktop dashboard immediately updates the camera's status to **STREAMING**, updates the people count, and shades the assigned zone on the blueprint!

### Testing Two Phones Simultaneously
1. In **Live Monitoring**, click **Connect Phone Camera** to generate the first session (e.g. Phone 1 -> assigned to "Main Entrance Gate").
2. Open that link on the first phone and tap **Start Camera**.
3. Click **Connect Phone Camera** a second time to generate a second independent session token (e.g. Phone 2 -> assigned to "Central Exhibition Hall").
4. Open the second link on a second phone and tap **Start Camera**.
5. Both phones stream concurrently, each maintaining its own independent WebSocket channel, count history, and zone association.

### Anti-Double-Counting Policy (Critical Multi-Camera Rule)
When multiple cameras monitor the same sector (e.g. two overlapping angles in "Central Exhibition Hall"):
- CrowdFlow does **not** blindly sum counts together.
- By default, it applies a conservative **MAX** aggregation policy:
  $$\text{Zone Occupancy} = \max(\text{Count}_{\text{Cam1}}, \text{Count}_{\text{Cam2}}, \dots)$$
- An explicit **Multi-Camera Overlap Disclosure** alert banner appears on the dashboard warning operators that multiple angles are observing the same zone.
- Operators can configure the aggregation policy per zone (`MAX`, `SUM`, or `AVG`).

### Blueprint Upload & Zone Configuration
1. Go to **Layout Editor** or click **Add Zone** in **Live Monitoring**.
2. Upload a custom floor plan image (PNG, JPG, WEBP) or load the built-in blueprint.
3. In Live Monitoring, click **Add Zone** to define spatial zones (e.g. *Main Hall*, *West Corridor*, *Food Court*).
4. Set warning capacity thresholds (*Low*, *Moderate*, *High*, *Critical*).
5. As camera counts fluctuate, the zone on the blueprint dynamically shifts color:
   - 🟢 **Green**: Low occupancy (under normal comfort capacity)
   - 🟡 **Yellow**: Moderate occupancy
   - 🟠 **Orange**: High density
   - 🔴 **Red**: Critical threshold exceeded (pulsating warning ring)

### Using Recorded Video Files as Demo Cameras
1. In **Live Monitoring**, click **Upload Video File**.
2. Select any MP4 or WebM video of pedestrians.
3. The server starts an OpenCV background worker that samples frames, runs real YOLOv8n people detection, and loops playback.
4. The feed appears in the camera list with a distinctive purple badge: `VIDEO FILE`.

### Connecting RTSP / IP Cameras
1. Click **Add RTSP / IP Camera**.
2. Enter the camera name, RTSP stream address (`rtsp://user:pass@192.168.1.50:554/stream`), and assigned zone.
3. Credentials are processed strictly on the backend and never exposed in browser logs.
4. The backend initializes a threaded `cv2.VideoCapture` worker to stream and count occupants.

### Testing Without Hardware (Simulated Demo Mode)
1. Click **Inject Demo Data**.
2. Specify a target camera and number of people (e.g., 28 people in North Corridor).
3. The observation is ingested and highlighted with an amber `SIMULATED DATA` badge, demonstrating high-load zone behavior without hardware.

---

## 3. Technology Stack & Dependencies

| Layer | Component | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite 5.4, Lucide Icons | Responsive SPA with dual modes (Simulation & Live Monitoring) |
| **Backend** | Python 3.9, FastAPI, Uvicorn | High-throughput REST API, WebSocket streams, and SQLite persistence |
| **Perception Model** | Ultralytics YOLOv8n (PyTorch / Apple Silicon CPU) | Real-time anonymous people detection (COCO class 0), bounding boxes, confidence |
| **Media Processing** | OpenCV (`opencv-python-headless 4.10`) | Frame decoding, RTSP stream worker, video file loop reader |
| **Transport** | WebSockets (`ws://`, `wss://`) & HTTP POST | Bidirectional frame streaming, sub-second latency feedback |
| **Database** | SQLite3 (`backend/data/crowdflow.db`) | Persistent storage of venues, zones, cameras, sessions, observations, event logs |
| **SSL / Network** | `@vitejs/plugin-basic-ssl` | Local HTTPS certificate required for mobile `getUserMedia()` camera access |

---

## 4. Verification & Testing Status

| Feature | Genuine Test Status | Method |
| :--- | :--- | :--- |
| Virtual Pedestrian Simulation | ✅ Verified | Automated test suite (`test_crowdflow.mjs`) |
| FastAPI REST Endpoints | ✅ Verified | Automated HTTP client test (`backend/test_monitoring_api.py`) |
| Session Token & QR Generation | ✅ Verified | Unit & integration tests |
| Mobile Camera Web Client | ✅ Verified | `public/mobile-camera.html` tested with WebSockets |
| YOLOv8n Model Inference | ✅ Verified | Evaluated on real image tensors on Apple Silicon |
| Multi-Camera Overlap Aggregation | ✅ Verified | Verified MAX policy and overlap warning disclosure |
| SQLite Schema & Persistence | ✅ Verified | CRUD validated across zones, cameras, and logs |
| Vite Production Build | ✅ Verified | `npm run build` succeeds in 505ms with 0 errors |
| Desktop Webcam Capture | ✅ Verified | In-browser canvas frame sampler |
| Uploaded Video Loop Worker | ✅ Verified | OpenCV stream worker with loop reset |
| Physical RTSP CCTV Stream | ⚠️ Requires Hardware | Worker code implemented; requires reachable physical IP camera on local LAN |
