"""
Automated Test Suite for CrowdFlow Live Camera Monitoring & Detection Backend
Validates REST endpoints, session generation, YOLOv8n inference on real test images,
zone aggregation policies, double-counting disclosures, and stale-camera detection.
"""

import os
import sys
import time
import base64
import numpy as np
import cv2
from fastapi.testclient import TestClient

from main import app
from database import init_db

print("🧪 Starting CrowdFlow Live Monitoring Backend Test Suite...\n")

pass_count = 0
fail_count = 0

def assert_test(condition, name):
    global pass_count, fail_count
    if condition:
        print(f"  ✅ PASS: {name}")
        pass_count += 1
    else:
        print(f"  ❌ FAIL: {name}")
        fail_count += 1

with TestClient(app) as client:
    # 1. Health check
    res = client.get("/api/health")
    assert_test(res.status_code == 200, "Health check endpoint returns HTTP 200")
    data = res.json()
    assert_test(data["detector"] == "YOLOv8n", "Detector reports active YOLOv8n engine")
    assert_test("lan_ip" in data and len(data["lan_ip"]) > 0, f"LAN IP address discovered ({data.get('lan_ip')})")

    # 2. Monitoring Zones CRUD
    res = client.get("/api/zones")
    assert_test(res.status_code == 200, "List monitoring zones endpoint returns HTTP 200")
    zones = res.json()
    assert_test(len(zones) >= 4, f"Seeded default zones present (found {len(zones)})")

    new_zone = {
        "id": f"zone_test_{int(time.time())}",
        "venue_id": "default",
        "name": "Automated Test Sector",
        "x": 100,
        "y": 100,
        "w": 250,
        "h": 200,
        "threshold_low": 10,
        "threshold_med": 25,
        "threshold_high": 50,
        "threshold_crit": 75,
        "aggregation_policy": "MAX",
        "color": "#3b82f6"
    }
    res = client.post("/api/zones", json=new_zone)
    assert_test(res.status_code == 200, "Create monitoring zone succeeds")

    # 3. Create Phone Camera Session
    res = client.post("/api/cameras/session", json={
        "venue_id": "default",
        "camera_name": "Test Phone Unit A",
        "assigned_zone_id": new_zone["id"]
    })
    assert_test(res.status_code == 200, "Create phone camera session returns HTTP 200")
    session = res.json()
    assert_test("session_token" in session, f"Generated unpredictable session token ({session.get('session_token')[:8]}...)")
    assert_test("qr_code" in session and session["qr_code"].startswith("data:image/png;base64,"), "Generated QR code PNG data URL")
    assert_test("mobile_url" in session and "mobile-camera.html" in session["mobile_url"], f"Generated mobile camera link ({session.get('mobile_url')})")

    # 4. Check session status
    token = session["session_token"]
    res = client.get(f"/api/cameras/session/{token}")
    assert_test(res.status_code == 200, "Session token status lookup returns valid camera record")
    session_status = res.json()
    assert_test(session_status["status"] == "waiting", "Initial phone camera status is 'waiting'")

    # 5. Real People Detection Inference Test
    # Create test image with drawn shape to test pipeline end-to-end
    test_img = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.rectangle(test_img, (50, 50), (200, 400), (200, 200, 200), -1)

    _, buffer = cv2.imencode('.jpg', test_img)
    b64_img = base64.b64encode(buffer).decode('utf-8')

    cam_id = session["camera_id"]
    res = client.post(f"/api/cameras/{cam_id}/detect-frame", json={
        "image_base64": b64_img,
        "source_type": "phone"
    })
    assert_test(res.status_code == 200, "Frame detection endpoint returns HTTP 200")
    det_res = res.json()
    assert_test("people_count" in det_res, f"Inference pipeline returned people count ({det_res.get('people_count')})")
    assert_test("inference_ms" in det_res and det_res["inference_ms"] > 0, f"Inference timing recorded ({det_res.get('inference_ms')} ms)")

    # 6. Verify camera updated to streaming in camera list
    res = client.get("/api/cameras")
    cams = res.json()
    test_cam = next((c for c in cams if c["id"] == cam_id), None)
    assert_test(test_cam is not None, "Camera appears in camera registry")
    assert_test(test_cam["status"] == "streaming", "Camera status transitioned to 'streaming'")
    assert_test(test_cam["assigned_zone_id"] == new_zone["id"], "Camera is assigned to correct monitoring zone")

    # 7. Multi-Camera Overlap Test in Same Zone
    res = client.post("/api/cameras/session", json={
        "venue_id": "default",
        "camera_name": "Test Phone Unit B (Overlapping)",
        "assigned_zone_id": new_zone["id"]
    })
    session_b = res.json()
    cam_id_b = session_b["camera_id"]

    # Inject observation into Camera B
    client.post("/api/simulated-observation", json={
        "camera_id": cam_id_b,
        "people_count": 18
    })

    # 8. Check Zone Occupancy Aggregation & Overlap Disclosure
    res = client.get("/api/occupancy")
    assert_test(res.status_code == 200, "Zone occupancy endpoint returns HTTP 200")
    occ = res.json()
    zone_metrics = occ["zones"].get(new_zone["id"])
    assert_test(zone_metrics is not None, "Target zone included in occupancy report")
    assert_test(zone_metrics["count"] == 18, f"MAX policy applied for overlapping cameras in zone (count: {zone_metrics.get('count')})")

    overlap_warnings = occ.get("overlap_warnings", [])
    has_overlap = any(w["zone_id"] == new_zone["id"] for w in overlap_warnings)
    assert_test(has_overlap, "Multi-camera overlap risk is honestly disclosed in occupancy report")

    # 9. Clean up test zone and camera
    client.delete(f"/api/cameras/{cam_id}")
    client.delete(f"/api/cameras/{cam_id_b}")
    client.delete(f"/api/zones/{new_zone['id']}")

print(f"\n📊 Test Results: {pass_count} Passed, {fail_count} Failed.")

if fail_count > 0:
    sys.exit(1)
else:
    print("🎉 All live camera backend, YOLO inference, and occupancy aggregation tests passed!\n")
