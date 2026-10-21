"""
CrowdFlow Camera & Session Manager
Handles session token generation, QR codes, LAN address discovery, stale camera detection,
and zone-level occupancy aggregation with explicit double-counting prevention policies.
"""

import time
import secrets
import socket
import qrcode
import io
import base64
from typing import Dict, List, Any, Optional
from database import (
    upsert_camera, get_camera_by_id, get_camera_by_token,
    get_all_cameras, get_all_zones, add_event_log
)

def get_lan_ip() -> str:
    """Discovers primary local network IPv4 address for mobile access."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't need to be reachable, just triggers OS routing table lookup
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def generate_qr_data_url(data_text: str) -> str:
    """Generates a high-contrast QR code as a base64 PNG data URL."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(data_text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{b64}"

class CameraManager:
    def __init__(self, frontend_port: int = 3000):
        self.frontend_port = frontend_port
        self.lan_ip = get_lan_ip()
        self.active_sessions: Dict[str, Dict[str, Any]] = {} # token -> session dict

    def create_phone_camera_session(self, venue_id: str = "default", camera_name: Optional[str] = None, zone_id: Optional[str] = None, client_host: Optional[str] = None, theme: Optional[str] = "chrome-light") -> Dict[str, Any]:
        """Creates a secure, short-lived session for a mobile phone camera with dynamic LAN IP."""
        # Always dynamically refresh the active LAN IP so changes in Wi-Fi are immediately reflected
        self.lan_ip = get_lan_ip()
        
        # Use client_host if provided and is an actual LAN/WAN IP or domain (not loopback)
        host_to_use = self.lan_ip
        if client_host and client_host not in ('localhost', '127.0.0.1', '::1', '0.0.0.0'):
            host_to_use = client_host

        session_token = secrets.token_urlsafe(16)
        camera_id = f"cam_phone_{int(time.time())}_{secrets.token_hex(3)}"
        display_name = camera_name or f"Mobile Camera {camera_id[-4:].upper()}"
        
        # Default to first available zone if none specified so observations map to blueprint immediately
        all_zones = get_all_zones()
        if not zone_id and all_zones:
            zone_id = all_zones[0]['id']

        # Connect URL - defaults to HTTPS over LAN so mobile browser allows getUserMedia
        theme_param = f"&theme={theme}" if theme else ""
        mobile_url = f"https://{host_to_use}:{self.frontend_port}/mobile-camera.html?session={session_token}{theme_param}"
        qr_code_data_url = generate_qr_data_url(mobile_url)

        cam_data = {
            "id": camera_id,
            "venue_id": "default",
            "name": display_name,
            "type": "phone",
            "assigned_zone_id": zone_id,
            "status": "waiting",
            "last_seen": None,
            "latest_count": 0,
            "confidence": 0.0,
            "marker_x": 180 + (len(self.active_sessions) * 40) % 500,
            "marker_y": 140 + (len(self.active_sessions) * 30) % 350,
            "fov_angle": 45,
            "fov_depth": 90,
            "fov_rotation": 45,
            "session_token": session_token,
            "created_at": time.time(),
        }

        upsert_camera(cam_data)

        session_info = {
            "session_token": session_token,
            "camera_id": camera_id,
            "camera_name": display_name,
            "venue_id": venue_id,
            "assigned_zone_id": zone_id,
            "mobile_url": mobile_url,
            "qr_code": qr_code_data_url,
            "status": "waiting",
            "created_at": time.time(),
            "expires_at": time.time() + 7200, # 2 hours
        }
        self.active_sessions[session_token] = session_info

        add_event_log(
            "CAMERA_SESSION_CREATED",
            f"Created phone camera session '{display_name}'. Waiting for mobile connection on {host_to_use}.",
            severity="info",
            camera_id=camera_id
        )

        return session_info

    def remove_camera_session(self, camera_id: str):
        """Cleans up in-memory sessions when a camera is deleted."""
        tokens_to_remove = [t for t, s in self.active_sessions.items() if s.get('camera_id') == camera_id]
        for t in tokens_to_remove:
            del self.active_sessions[t]

    def get_session_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        self.lan_ip = get_lan_ip()
        session = self.active_sessions.get(token)
        if not session:
            # Check DB
            cam = get_camera_by_token(token)
            if cam:
                mobile_url = f"https://{self.lan_ip}:{self.frontend_port}/mobile-camera.html?session={token}"
                session = {
                    "session_token": token,
                    "camera_id": cam['id'],
                    "camera_name": cam['name'],
                    "venue_id": cam.get('venue_id', 'default'),
                    "assigned_zone_id": cam.get('assigned_zone_id'),
                    "mobile_url": mobile_url,
                    "qr_code": generate_qr_data_url(mobile_url),
                    "status": cam.get('status', 'waiting'),
                    "created_at": cam.get('created_at', time.time()),
                    "expires_at": cam.get('created_at', time.time()) + 7200,
                }
                self.active_sessions[token] = session
        return session

    def update_camera_heartbeat(self, camera_id: str, count: int, confidence: float, status: str = "streaming"):
        now = time.time()
        cam = get_camera_by_id(camera_id)
        if not cam:
            return
        
        old_status = cam.get('status')
        cam['status'] = status
        cam['last_seen'] = now
        cam['latest_count'] = count
        cam['confidence'] = confidence
        upsert_camera(cam)

        if old_status in ('waiting', 'disconnected', 'stale') and status == 'streaming':
            add_event_log(
                "CAMERA_CONNECT",
                f"Camera '{cam['name']}' is now actively streaming video observations.",
                severity="info",
                camera_id=camera_id
            )

    def check_and_update_stale_cameras(self) -> List[Dict[str, Any]]:
        """Scans cameras and marks stale or disconnected if no recent observations."""
        now = time.time()
        cameras = get_all_cameras()
        updated = []

        for cam in cameras:
            # Simulated and disconnected cameras don't get marked stale
            if cam['type'] == 'simulated' or cam['status'] in ('waiting', 'disconnected', 'error'):
                continue

            last_seen = cam.get('last_seen')
            if not last_seen:
                continue

            time_diff = now - last_seen
            if time_diff > 18.0 and cam['status'] != 'disconnected':
                cam['status'] = 'disconnected'
                upsert_camera(cam)
                add_event_log(
                    "CAMERA_DISCONNECT",
                    f"Camera '{cam['name']}' disconnected (no signal for {int(time_diff)}s).",
                    severity="warning",
                    camera_id=cam['id']
                )
                updated.append(cam)
            elif time_diff > 6.0 and cam['status'] == 'streaming':
                cam['status'] = 'stale'
                upsert_camera(cam)
                add_event_log(
                    "CAMERA_STALE",
                    f"Camera '{cam['name']}' signal is stale ({int(time_diff)}s since last frame).",
                    severity="warning",
                    camera_id=cam['id']
                )
                updated.append(cam)

        return updated

    def compute_zone_occupancy_aggregation(self, venue_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Calculates occupancy for each monitoring zone.
        Honors aggregation policies ('MAX', 'SUM', 'AVG') and discloses multi-camera overlap risks.
        """
        zones = get_all_zones(venue_id)
        cameras = get_all_cameras(venue_id)

        zone_cams: Dict[str, List[Dict[str, Any]]] = {z['id']: [] for z in zones}
        unassigned_cams: List[Dict[str, Any]] = []

        for c in cameras:
            zid = c.get('assigned_zone_id')
            if zid and zid in zone_cams:
                zone_cams[zid].append(c)
            else:
                # If active but unassigned, map to first zone so count is never lost on blueprint
                if zones and (c.get('status') in ('streaming', 'stale') or c.get('type') == 'simulated'):
                    first_zid = zones[0]['id']
                    zone_cams[first_zid].append(c)
                else:
                    unassigned_cams.append(c)

        zone_metrics = {}
        total_venue_occupancy = 0
        overlap_warnings = []

        for z in zones:
            zid = z['id']
            cams = zone_cams.get(zid, [])
            policy = z.get('aggregation_policy', 'MAX').upper()
            
            # Active counts from streaming or recently active cameras
            active_counts = [
                c.get('latest_count', 0) for c in cams 
                if c.get('status') in ('streaming', 'stale') or c.get('type') == 'simulated'
            ]

            if not active_counts:
                zone_count = 0
            elif policy == 'MAX':
                zone_count = max(active_counts)
            elif policy == 'SUM':
                zone_count = sum(active_counts)
            elif policy == 'AVG':
                zone_count = int(round(sum(active_counts) / len(active_counts)))
            else:
                zone_count = max(active_counts)

            total_venue_occupancy += zone_count

            # Overlap Warning disclosure
            if len(cams) > 1:
                overlap_warnings.append({
                    "zone_id": zid,
                    "zone_name": z['name'],
                    "camera_count": len(cams),
                    "policy": policy,
                    "message": f"Multiple cameras ({len(cams)}) monitor zone '{z['name']}'. Policy '{policy}' applied to prevent double-counting."
                })

            # Determine density Level of Service / Alert Tier
            t_low = z.get('threshold_low', 5)
            t_med = z.get('threshold_med', 15)
            t_high = z.get('threshold_high', 30)
            t_crit = z.get('threshold_crit', 50)

            if zone_count >= t_crit:
                tier = "critical"
                color = "#ef4444" # red
            elif zone_count >= t_high:
                tier = "high"
                color = "#f97316" # orange
            elif zone_count >= t_med:
                tier = "moderate"
                color = "#eab308" # yellow
            else:
                tier = "low"
                color = "#10b981" # green

            zone_metrics[zid] = {
                "zone_id": zid,
                "name": z['name'],
                "count": zone_count,
                "tier": tier,
                "color": color,
                "policy": policy,
                "camera_ids": [c['id'] for c in cams],
                "active_camera_count": len(active_counts),
                "thresholds": {"low": t_low, "med": t_med, "high": t_high, "crit": t_crit}
            }

        return {
            "total_estimated_occupancy": total_venue_occupancy,
            "zones": zone_metrics,
            "overlap_warnings": overlap_warnings,
            "timestamp": time.time()
        }
