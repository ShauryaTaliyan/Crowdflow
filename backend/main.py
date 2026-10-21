"""
CrowdFlow Real-Time Monitoring & Observation Backend
FastAPI server providing REST endpoints, WebSockets for mobile camera streaming,
people detection with YOLOv8n, SQLite persistence, and zone occupancy aggregation.
"""

import os
import time
import asyncio
import json
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import cv2
import numpy as np

from database import (
    init_db, get_all_zones, upsert_zone, delete_zone,
    get_all_cameras, get_camera_by_id, upsert_camera, delete_camera,
    record_observation, get_recent_observations, add_event_log, get_recent_event_logs,
    save_venue, get_venue
)
from detector import YoloPeopleDetector, decode_image_from_bytes, decode_image_from_base64
from camera_manager import CameraManager, get_lan_ip
from rtsp_worker import StreamManager
from blueprint_digitizer import digitalize_image_to_venue
import base64

app = FastAPI(title="CrowdFlow Live Monitoring Engine", version="1.0.0")

# Enable CORS for local network and desktop clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Singletons
detector = YoloPeopleDetector(conf_threshold=0.35, ema_alpha=0.3)
camera_mgr = CameraManager(frontend_port=3000)
stream_mgr = StreamManager(detector)

# Uploads directory
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'data', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Connected WebSocket clients
dashboard_clients: List[WebSocket] = []

# Global cache of latest camera visual snapshots & bounding boxes
latest_camera_snapshots: Dict[str, Dict[str, Any]] = {}

def broadcast_live_update_sync(camera_id: str, detection_result: Dict[str, Any]):
    """Sync wrapper for stream worker callbacks."""
    cam = get_camera_by_id(camera_id)
    if not cam:
        return
    
    zone_id = cam.get('assigned_zone_id')
    camera_mgr.update_camera_heartbeat(
        camera_id,
        detection_result['people_count'],
        detection_result.get('confidence', 0.0),
        status="streaming"
    )

    if detection_result.get('thumbnail_b64'):
        latest_camera_snapshots[camera_id] = {
            "image_base64": detection_result['thumbnail_b64'],
            "boxes": detection_result.get("boxes", []),
            "people_count": detection_result['people_count'],
            "confidence": detection_result.get('confidence', 0.0),
            "timestamp": detection_result['timestamp']
        }

    record_observation({
        "timestamp": detection_result['timestamp'],
        "camera_id": camera_id,
        "zone_id": zone_id,
        "people_count": detection_result['people_count'],
        "confidence": detection_result.get('confidence', 0.0),
        "source_type": cam.get('type', 'real')
    })

stream_mgr.set_broadcast_callback(broadcast_live_update_sync)

# Startup Hook
@app.on_event("startup")
async def startup_event():
    init_db()
    # Seed default monitoring zones if none exist
    zones = get_all_zones()
    if not zones:
        default_zones = [
            {"id": "zone_entrance", "venue_id": "default", "name": "Main Entrance Gate", "x": 60, "y": 70, "w": 200, "h": 220, "threshold_low": 8, "threshold_med": 18, "threshold_high": 35, "threshold_crit": 50, "color": "#10b981", "aggregation_policy": "MAX"},
            {"id": "zone_atrium", "venue_id": "default", "name": "Central Exhibition Hall", "x": 300, "y": 140, "w": 400, "h": 320, "threshold_low": 15, "threshold_med": 35, "threshold_high": 60, "threshold_crit": 90, "color": "#3b82f6", "aggregation_policy": "MAX"},
            {"id": "zone_north_corridor", "venue_id": "default", "name": "North Walkway Corridor", "x": 120, "y": 20, "w": 760, "h": 100, "threshold_low": 6, "threshold_med": 15, "threshold_high": 25, "threshold_crit": 40, "color": "#8b5cf6", "aggregation_policy": "MAX"},
            {"id": "zone_exit", "venue_id": "default", "name": "East Exit Egress", "x": 740, "y": 320, "w": 220, "h": 240, "threshold_low": 8, "threshold_med": 20, "threshold_high": 40, "threshold_crit": 60, "color": "#f59e0b", "aggregation_policy": "MAX"},
        ]
        for z in default_zones:
            upsert_zone(z)
        print(f"✅ Seeded {len(default_zones)} default monitoring zones.")

    # Start background stale-camera checker loop
    asyncio.create_task(background_stale_checker())

async def broadcast_snapshot_to_dashboards():
    """Immediately broadcasts latest camera counts, zone occupancy, and events to connected dashboards."""
    if not dashboard_clients:
        return
    try:
        payload = {
            "type": "SNAPSHOT",
            "cameras": get_all_cameras(),
            "occupancy": camera_mgr.compute_zone_occupancy_aggregation(),
            "events": get_recent_event_logs(15),
            "timestamp": time.time()
        }
        msg = json.dumps(payload)
        disconnected = []
        for ws in list(dashboard_clients):
            try:
                await ws.send_text(msg)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            if ws in dashboard_clients:
                dashboard_clients.remove(ws)
    except Exception as e:
        print(f"Error broadcasting to dashboards: {e}")

async def background_stale_checker():
    """Periodically checks for stale cameras and broadcasts updates to dashboard."""
    while True:
        try:
            camera_mgr.check_and_update_stale_cameras()
            await broadcast_snapshot_to_dashboards()
        except Exception as e:
            print(f"Error in background stale checker: {e}")
        await asyncio.sleep(1.0)

# --- Pydantic Request Models ---
class ZoneModel(BaseModel):
    id: str
    venue_id: Optional[str] = "default"
    name: str
    x: float
    y: float
    w: float
    h: float
    threshold_low: Optional[int] = 5
    threshold_med: Optional[int] = 15
    threshold_high: Optional[int] = 30
    threshold_crit: Optional[int] = 50
    aggregation_policy: Optional[str] = "MAX"
    color: Optional[str] = "#3b82f6"

class CameraModel(BaseModel):
    id: str
    venue_id: Optional[str] = "default"
    name: str
    type: str # phone, webcam, video_file, rtsp, simulated
    assigned_zone_id: Optional[str] = None
    status: Optional[str] = "waiting"
    marker_x: Optional[float] = 100
    marker_y: Optional[float] = 100
    fov_angle: Optional[float] = 45
    fov_depth: Optional[float] = 80
    fov_rotation: Optional[float] = 45
    rtsp_url: Optional[str] = None

class CreateSessionRequest(BaseModel):
    venue_id: Optional[str] = "default"
    camera_name: Optional[str] = None
    assigned_zone_id: Optional[str] = None
    client_host: Optional[str] = None
    theme: Optional[str] = "chrome-light"

class DetectFrameRequest(BaseModel):
    image_base64: str
    source_type: Optional[str] = "real"

class SimulatedObservationRequest(BaseModel):
    camera_id: str
    people_count: int
    confidence: Optional[float] = 0.95

class DeployVenueRequest(BaseModel):
    venue_id: Optional[str] = "default"
    name: str
    venue_data: Dict[str, Any]
    blueprint_image: Optional[str] = None
    sync_monitoring_zones: Optional[bool] = True

class DigitalizeBlueprintRequest(BaseModel):
    image_base64: str
    venue_name: Optional[str] = "Digitalized Venue Layout"

# --- REST Endpoints ---

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "CrowdFlow Live Monitoring Engine",
        "lan_ip": camera_mgr.lan_ip,
        "frontend_port": camera_mgr.frontend_port,
        "detector": "YOLOv8n",
        "timestamp": time.time()
    }

# Blueprint Computer Vision Digitalization Endpoint
@app.post("/api/blueprint/digitalize")
async def digitalize_blueprint_endpoint(req: DigitalizeBlueprintRequest):
    try:
        b64_data = req.image_base64
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        digitalized = digitalize_image_to_venue(img_bytes, req.venue_name)
        return {
            "status": "success",
            "digitalized": digitalized
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Digitalization error: {str(e)}")

@app.post("/api/blueprint/upload-and-digitalize")
async def upload_and_digitalize_endpoint(file: UploadFile = File(...), venue_name: Optional[str] = Form("Digitalized Venue Layout")):
    try:
        content = await file.read()
        digitalized = digitalize_image_to_venue(content, venue_name)
        return {
            "status": "success",
            "digitalized": digitalized
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Digitalization error: {str(e)}")

# Venue Layout Deployment
@app.post("/api/venues/deploy")
async def deploy_venue(req: DeployVenueRequest):
    venue_id = req.venue_id or "default"
    save_venue(venue_id, req.name, req.venue_data, req.blueprint_image)
    
    # Auto-synchronize monitoring zones from venue areas if requested
    if req.sync_monitoring_zones and req.venue_data:
        vdata = req.venue_data
        entrances = vdata.get('entrances', [])
        exits = vdata.get('exits', [])

        if entrances:
            ent = entrances[0]
            upsert_zone({
                "id": "zone_entrance",
                "venue_id": venue_id,
                "name": "Main Entrance Gate Area",
                "x": max(10, ent.get('x', 40) - 20),
                "y": max(10, ent.get('y', 150) - 30),
                "w": min(320, ent.get('w', 30) + 160),
                "h": min(300, ent.get('h', 140) + 60),
                "threshold_low": 8,
                "threshold_med": 18,
                "threshold_high": 35,
                "threshold_crit": 50,
                "color": "#10b981",
                "aggregation_policy": "MAX"
            })

        upsert_zone({
            "id": "zone_atrium",
            "venue_id": venue_id,
            "name": "Central Exhibition Concourse",
            "x": 260,
            "y": 140,
            "w": 460,
            "h": 320,
            "threshold_low": 15,
            "threshold_med": 35,
            "threshold_high": 60,
            "threshold_crit": 90,
            "color": "#3b82f6",
            "aggregation_policy": "MAX"
        })

        if exits:
            ext = exits[0]
            upsert_zone({
                "id": "zone_exit",
                "venue_id": venue_id,
                "name": "Primary East Exit Area",
                "x": max(700, ext.get('x', 900) - 140),
                "y": max(10, ext.get('y', 200) - 30),
                "w": min(280, ext.get('w', 30) + 160),
                "h": min(300, ext.get('h', 140) + 60),
                "threshold_low": 8,
                "threshold_med": 20,
                "threshold_high": 40,
                "threshold_crit": 60,
                "color": "#f59e0b",
                "aggregation_policy": "MAX"
            })

    add_event_log("VENUE_DEPLOYED", f"Deployed final venue layout '{req.name}' to Simulation & Live Monitoring.", severity="info")
    await broadcast_snapshot_to_dashboards()
    return {
        "success": True,
        "venue_id": venue_id,
        "name": req.name,
        "zones": get_all_zones(venue_id),
        "message": "Venue layout successfully deployed to Simulation and Live Monitoring!"
    }

@app.get("/api/venues/{venue_id}")
async def get_venue_endpoint(venue_id: str):
    v = get_venue(venue_id)
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    return v

# Monitoring Zones
@app.get("/api/zones")
async def list_zones(venue_id: Optional[str] = None):
    return get_all_zones(venue_id)

@app.post("/api/zones")
async def save_zone(zone: ZoneModel):
    saved = upsert_zone(zone.dict())
    add_event_log("ZONE_UPDATED", f"Configured monitoring zone '{zone.name}'.", severity="info", zone_id=zone.id)
    await broadcast_snapshot_to_dashboards()
    return saved

@app.delete("/api/zones/{zone_id}")
async def remove_zone(zone_id: str):
    delete_zone(zone_id)
    add_event_log("ZONE_DELETED", f"Deleted monitoring zone {zone_id}.", severity="info", zone_id=zone_id)
    await broadcast_snapshot_to_dashboards()
    return {"success": True, "zone_id": zone_id}

# Cameras
@app.get("/api/cameras")
async def list_cameras(venue_id: Optional[str] = None):
    return get_all_cameras(venue_id)

@app.post("/api/cameras")
async def save_camera(cam: CameraModel):
    existing = get_camera_by_id(cam.id) or {}
    cam_dict = {**existing, **cam.dict()}
    saved = upsert_camera(cam_dict)
    add_event_log("CAMERA_UPDATED", f"Updated configuration for camera '{cam.name}'.", severity="info", camera_id=cam.id)
    await broadcast_snapshot_to_dashboards()
    return saved

@app.delete("/api/cameras/{camera_id}")
async def remove_camera(camera_id: str):
    stream_mgr.stop_camera_stream(camera_id)
    camera_mgr.remove_camera_session(camera_id)
    if camera_id in latest_camera_snapshots:
        del latest_camera_snapshots[camera_id]
    delete_camera(camera_id)
    add_event_log("CAMERA_DELETED", f"Removed camera {camera_id}.", severity="info", camera_id=camera_id)
    await broadcast_snapshot_to_dashboards()
    return {"success": True, "camera_id": camera_id}

@app.delete("/api/cameras")
async def clear_all_cameras():
    cameras = get_all_cameras()
    for cam in cameras:
        cid = cam['id']
        stream_mgr.stop_camera_stream(cid)
        camera_mgr.remove_camera_session(cid)
        if cid in latest_camera_snapshots:
            del latest_camera_snapshots[cid]
        delete_camera(cid)
    add_event_log("ALL_CAMERAS_CLEARED", "Removed all registered cameras.", severity="info")
    await broadcast_snapshot_to_dashboards()
    return {"success": True, "count": len(cameras)}

# Phone Camera Session
@app.post("/api/cameras/session")
async def create_camera_session(req: CreateSessionRequest):
    session = camera_mgr.create_phone_camera_session(
        venue_id=req.venue_id or "default",
        camera_name=req.camera_name,
        zone_id=req.assigned_zone_id,
        client_host=req.client_host,
        theme=req.theme or "chrome-light"
    )
    return session

@app.get("/api/cameras/session/{token}")
async def get_session_status(token: str):
    session = camera_mgr.get_session_by_token(token)
    if not session:
        raise HTTPException(status_code=404, detail="Camera session not found or expired")
    cam = get_camera_by_id(session['camera_id'])
    return {
        **session,
        "camera": cam
    }

# Single-Frame Detection (HTTP fallback for mobile / webcam)
@app.post("/api/cameras/{camera_id}/detect-frame")
async def detect_frame(camera_id: str, req: DetectFrameRequest):
    cam = get_camera_by_id(camera_id)
    if not cam:
        # Check if camera_id is actually a session_token
        cam = get_camera_by_token(camera_id)
        if cam:
            camera_id = cam['id']
        else:
            session = camera_mgr.get_session_by_token(camera_id)
            if session:
                camera_id = session['camera_id']
                cam = get_camera_by_id(camera_id)

    if not cam:
        if camera_id == 'cam_desktop_webcam' or req.source_type == 'webcam':
            all_z = get_all_zones()
            zone_id = all_z[0]['id'] if all_z else None
            cam = {
                "id": camera_id,
                "venue_id": "default",
                "name": "Built-in Desktop Webcam",
                "type": "webcam",
                "assigned_zone_id": zone_id,
                "status": "streaming",
                "marker_x": 220.0,
                "marker_y": 200.0,
                "fov_angle": 55.0,
                "fov_depth": 90.0,
                "fov_rotation": 45.0
            }
            upsert_camera(cam)
        else:
            raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")

    img_bgr = decode_image_from_base64(req.image_base64)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Failed to decode image data")

    try:
        res = detector.detect_and_count(img_bgr, camera_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {e}")

    zone_id = cam.get('assigned_zone_id')
    if not zone_id:
        all_z = get_all_zones()
        if all_z:
            zone_id = all_z[0]['id']
            cam['assigned_zone_id'] = zone_id
            upsert_camera(cam)

    camera_mgr.update_camera_heartbeat(camera_id, res['people_count'], res['confidence'], status="streaming")

    # Store latest frame snapshot for enlarged viewer and live previews
    latest_camera_snapshots[camera_id] = {
        "image_base64": req.image_base64,
        "boxes": res.get("boxes", []),
        "people_count": res.get("people_count", 0),
        "confidence": res.get("confidence", 0.0),
        "inference_ms": res.get("inference_ms", 0.0),
        "timestamp": res.get("timestamp", time.time())
    }

    record_observation({
        "timestamp": res['timestamp'],
        "camera_id": camera_id,
        "zone_id": zone_id,
        "people_count": res['people_count'],
        "confidence": res['confidence'],
        "source_type": req.source_type or cam.get('type', 'real')
    })

    # Broadcast updated counts and zone occupancy to all connected dashboards
    await broadcast_snapshot_to_dashboards()

    return res

@app.get("/api/cameras/{camera_id}/snapshot")
async def get_camera_snapshot(camera_id: str):
    """Returns the latest captured frame and YOLO detection metadata for a specific camera."""
    snap = latest_camera_snapshots.get(camera_id)
    if snap:
        return snap
    return {
        "image_base64": None,
        "boxes": [],
        "people_count": 0,
        "confidence": 0.0,
        "timestamp": None
    }

# Video File Upload for Video Demonstration Camera
@app.post("/api/upload-video")
async def upload_video_file(file: UploadFile = File(...), camera_name: Optional[str] = Form(None), assigned_zone_id: Optional[str] = Form(None)):
    filename = f"video_{int(time.time())}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    cam_id = f"cam_vid_{int(time.time())}"
    cam_name = camera_name or f"Video: {file.filename}"
    cam_data = {
        "id": cam_id,
        "venue_id": "default",
        "name": cam_name,
        "type": "video_file",
        "assigned_zone_id": assigned_zone_id,
        "status": "connected",
        "last_seen": None,
        "latest_count": 0,
        "confidence": 0.0,
        "marker_x": 300,
        "marker_y": 250,
        "fov_angle": 50,
        "fov_depth": 90,
        "rtsp_url": filepath,
        "created_at": time.time(),
    }
    upsert_camera(cam_data)

    # Start video processing loop
    stream_mgr.start_camera_stream(cam_id, filepath, is_video=True, loop=True)

    add_event_log(
        "VIDEO_CAMERA_STARTED",
        f"Started video file camera '{cam_name}' (processing frames in loop).",
        severity="info",
        camera_id=cam_id
    )

    return {"success": True, "camera": cam_data}

# RTSP Stream Controls
@app.post("/api/cameras/{camera_id}/rtsp-start")
async def start_rtsp_camera(camera_id: str):
    cam = get_camera_by_id(camera_id)
    if not cam or not cam.get('rtsp_url'):
        raise HTTPException(status_code=400, detail="Camera missing RTSP URL")

    stream_mgr.start_camera_stream(camera_id, cam['rtsp_url'], is_video=False)
    add_event_log("RTSP_STARTED", f"Connecting to RTSP stream for '{cam['name']}'.", severity="info", camera_id=camera_id)
    return {"success": True, "camera_id": camera_id}

@app.post("/api/cameras/{camera_id}/rtsp-stop")
async def stop_rtsp_camera(camera_id: str):
    stream_mgr.stop_camera_stream(camera_id)
    cam = get_camera_by_id(camera_id)
    if cam:
        cam['status'] = 'disconnected'
        upsert_camera(cam)
    add_event_log("RTSP_STOPPED", f"Stopped stream worker for camera {camera_id}.", severity="info", camera_id=camera_id)
    return {"success": True, "camera_id": camera_id}

# Injected Simulated Observation (Clearly labelled SIMULATED DATA)
@app.post("/api/simulated-observation")
async def post_simulated_observation(req: SimulatedObservationRequest):
    cam = get_camera_by_id(req.camera_id)
    if not cam:
        # Create simulated camera if needed
        cam = {
            "id": req.camera_id,
            "venue_id": "default",
            "name": f"Simulated Camera ({req.camera_id})",
            "type": "simulated",
            "assigned_zone_id": None,
            "status": "streaming",
            "last_seen": time.time(),
            "latest_count": req.people_count,
            "confidence": req.confidence or 0.95,
            "created_at": time.time()
        }
        upsert_camera(cam)

    zone_id = cam.get('assigned_zone_id')
    camera_mgr.update_camera_heartbeat(req.camera_id, req.people_count, req.confidence or 0.95, status="streaming")
    record_observation({
        "timestamp": time.time(),
        "camera_id": req.camera_id,
        "zone_id": zone_id,
        "people_count": req.people_count,
        "confidence": req.confidence or 0.95,
        "source_type": "simulated"
    })
    return {"success": True, "source": "SIMULATED DATA", "people_count": req.people_count}

# Aggregate Occupancy & Double-Counting Disclosures
@app.get("/api/occupancy")
async def get_occupancy_aggregation(venue_id: Optional[str] = None):
    return camera_mgr.compute_zone_occupancy_aggregation(venue_id)

# Observation History (for charts)
@app.get("/api/observations/history")
async def get_history(limit: int = 80):
    return get_recent_observations(limit)

# Event Logs
@app.get("/api/events")
async def get_events(limit: int = 30):
    return get_recent_event_logs(limit)

# --- WebSockets ---

@app.websocket("/ws/live")
async def websocket_live_dashboard(websocket: WebSocket):
    """Real-time push channel for the desktop Live Monitoring dashboard."""
    await websocket.accept()
    dashboard_clients.append(websocket)
    try:
        # Send initial full state immediately
        payload = {
            "type": "SNAPSHOT",
            "cameras": get_all_cameras(),
            "occupancy": camera_mgr.compute_zone_occupancy_aggregation(),
            "events": get_recent_event_logs(15),
            "timestamp": time.time()
        }
        await websocket.send_text(json.dumps(payload))

        while True:
            # Keepalive receiver
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in dashboard_clients:
            dashboard_clients.remove(websocket)

@app.websocket("/ws/camera/{session_token}")
async def websocket_phone_camera(websocket: WebSocket, session_token: str):
    """
    Dedicated bidirectional stream for mobile phone cameras.
    Receives compressed video frames from phone, runs YOLO detection,
    and returns bounding boxes, count, and processing latency.
    """
    session = camera_mgr.get_session_by_token(session_token)
    if not session:
        await websocket.close(code=4004, reason="Invalid or expired session token")
        return

    camera_id = session['camera_id']
    await websocket.accept()
    print(f"📱 Phone connected for camera {camera_id} (token {session_token})")

    # Update camera status to connected
    cam = get_camera_by_id(camera_id)
    if cam:
        cam['status'] = 'connected'
        upsert_camera(cam)
        add_event_log(
            "PHONE_CONNECTED",
            f"Phone connected to camera session '{cam['name']}'. Ready to stream video.",
            severity="info",
            camera_id=camera_id
        )
        await broadcast_snapshot_to_dashboards()

    try:
        while True:
            message_text = await websocket.receive_text()
            msg = json.loads(message_text)

            msg_type = msg.get("type")
            if msg_type == "frame":
                b64_data = msg.get("image")
                if not b64_data:
                    continue

                img_bgr = decode_image_from_base64(b64_data)
                if img_bgr is None:
                    continue

                # Run YOLO people detector
                res = detector.detect_and_count(img_bgr, camera_id)

                # Always fetch latest camera assignment so zone changes on dashboard reflect immediately
                fresh_cam = get_camera_by_id(camera_id)
                zone_id = fresh_cam.get('assigned_zone_id') if fresh_cam else session.get('assigned_zone_id')
                if not zone_id:
                    all_z = get_all_zones()
                    if all_z:
                        zone_id = all_z[0]['id']
                        if fresh_cam:
                            fresh_cam['assigned_zone_id'] = zone_id
                            upsert_camera(fresh_cam)

                camera_mgr.update_camera_heartbeat(
                    camera_id,
                    res['people_count'],
                    res['confidence'],
                    status="streaming"
                )

                record_observation({
                    "timestamp": res['timestamp'],
                    "camera_id": camera_id,
                    "zone_id": zone_id,
                    "people_count": res['people_count'],
                    "confidence": res['confidence'],
                    "source_type": "phone"
                })

                # Broadcast to all connected desktop dashboards immediately
                await broadcast_snapshot_to_dashboards()

                # Respond to phone with detection feedback
                feedback = {
                    "type": "detection",
                    "people_count": res['people_count'],
                    "raw_count": res['raw_count'],
                    "boxes": res['boxes'],
                    "confidence": res['confidence'],
                    "inference_ms": res['inference_ms'],
                    "timestamp": res['timestamp']
                }
                await websocket.send_text(json.dumps(feedback))

            elif msg_type == "stop":
                if cam:
                    cam['status'] = 'connected'
                    upsert_camera(cam)
                    await broadcast_snapshot_to_dashboards()
                print(f"Phone paused streaming on {camera_id}")

            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        print(f"📱 Phone disconnected for camera {camera_id}")
        cam = get_camera_by_id(camera_id)
        if cam:
            cam['status'] = 'disconnected'
            upsert_camera(cam)
            add_event_log(
                "PHONE_DISCONNECTED",
                f"Phone disconnected from camera '{cam['name']}'.",
                severity="warning",
                camera_id=camera_id
            )
            await broadcast_snapshot_to_dashboards()
    except Exception as err:
        print(f"Error on phone websocket {camera_id}: {err}")
