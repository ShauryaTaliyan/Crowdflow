"""
CrowdFlow SQLite Persistence Layer
Stores venues, monitoring zones, camera configurations, live observation history, and event logs.
"""

import sqlite3
import os
import json
import time
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'crowdflow.db')

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Venues table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS venues (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data_json TEXT NOT NULL,
                blueprint_url TEXT,
                updated_at REAL NOT NULL
            )
        ''')
        
        # Monitoring Zones table (kept cleanly distinct from simulation geometry)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS monitoring_zones (
                id TEXT PRIMARY KEY,
                venue_id TEXT NOT NULL,
                name TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                w REAL NOT NULL,
                h REAL NOT NULL,
                threshold_low INTEGER DEFAULT 5,
                threshold_med INTEGER DEFAULT 15,
                threshold_high INTEGER DEFAULT 30,
                threshold_crit INTEGER DEFAULT 50,
                aggregation_policy TEXT DEFAULT 'MAX',
                color TEXT DEFAULT '#3b82f6',
                updated_at REAL NOT NULL
            )
        ''')
        
        # Cameras table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cameras (
                id TEXT PRIMARY KEY,
                venue_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL, -- phone, webcam, video_file, rtsp, simulated
                assigned_zone_id TEXT,
                status TEXT NOT NULL DEFAULT 'waiting', -- waiting, connected, streaming, stale, disconnected, error
                last_seen REAL,
                latest_count INTEGER DEFAULT 0,
                confidence REAL DEFAULT 0.0,
                marker_x REAL DEFAULT 100,
                marker_y REAL DEFAULT 100,
                fov_angle REAL DEFAULT 45,
                fov_depth REAL DEFAULT 80,
                fov_rotation REAL DEFAULT 45,
                rtsp_url TEXT,
                session_token TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        ''')
        
        try:
            cursor.execute("ALTER TABLE cameras ADD COLUMN fov_rotation REAL DEFAULT 45")
        except Exception:
            pass

        # Live Observation Records (Time-series)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                camera_id TEXT NOT NULL,
                zone_id TEXT,
                people_count INTEGER NOT NULL,
                confidence REAL DEFAULT 0.0,
                source_type TEXT NOT NULL
            )
        ''')
        
        # Event Logs
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS event_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                event_type TEXT NOT NULL,
                message TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'info',
                camera_id TEXT,
                zone_id TEXT
            )
        ''')
        
        cursor.execute("UPDATE cameras SET venue_id = 'default' WHERE venue_id IS NULL OR venue_id != 'default'")
        cursor.execute("UPDATE monitoring_zones SET venue_id = 'default' WHERE venue_id IS NULL OR venue_id != 'default'")
        conn.commit()

# Ensure tables exist immediately
init_db()

# --- Repository Helpers ---

def save_venue(venue_id: str, name: str, data: Dict[str, Any], blueprint_url: Optional[str] = None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        now = time.time()
        cursor.execute('''
            INSERT INTO venues (id, name, data_json, blueprint_url, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                data_json=excluded.data_json,
                blueprint_url=excluded.blueprint_url,
                updated_at=excluded.updated_at
        ''', (venue_id, name, json.dumps(data), blueprint_url, now))
        conn.commit()

def get_venue(venue_id: str = "default") -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM venues WHERE id = ?", (venue_id,))
        row = cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            d['data'] = json.loads(d['data_json'])
        except Exception:
            d['data'] = {}
        return d

def get_all_zones(venue_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if venue_id and venue_id not in ("default", "all"):
            cursor.execute("SELECT * FROM monitoring_zones WHERE venue_id = ? OR venue_id = 'default'", (venue_id,))
        else:
            cursor.execute("SELECT * FROM monitoring_zones")
        return [dict(row) for row in cursor.fetchall()]

def upsert_zone(zone: Dict[str, Any]) -> Dict[str, Any]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        now = time.time()
        cursor.execute('''
            INSERT INTO monitoring_zones 
            (id, venue_id, name, x, y, w, h, threshold_low, threshold_med, threshold_high, threshold_crit, aggregation_policy, color, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                x=excluded.x,
                y=excluded.y,
                w=excluded.w,
                h=excluded.h,
                threshold_low=excluded.threshold_low,
                threshold_med=excluded.threshold_med,
                threshold_high=excluded.threshold_high,
                threshold_crit=excluded.threshold_crit,
                aggregation_policy=excluded.aggregation_policy,
                color=excluded.color,
                updated_at=excluded.updated_at
        ''', (
            zone['id'],
            zone.get('venue_id', 'default'),
            zone['name'],
            float(zone.get('x', 0)),
            float(zone.get('y', 0)),
            float(zone.get('w', 100)),
            float(zone.get('h', 100)),
            int(zone.get('threshold_low', 5)),
            int(zone.get('threshold_med', 15)),
            int(zone.get('threshold_high', 30)),
            int(zone.get('threshold_crit', 50)),
            zone.get('aggregation_policy', 'MAX'),
            zone.get('color', '#3b82f6'),
            now
        ))
        conn.commit()
    return zone

def delete_zone(zone_id: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM monitoring_zones WHERE id = ?", (zone_id,))
        # Unassign from cameras
        cursor.execute("UPDATE cameras SET assigned_zone_id = NULL WHERE assigned_zone_id = ?", (zone_id,))
        conn.commit()

def get_all_cameras(venue_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if venue_id and venue_id not in ("default", "all"):
            cursor.execute("SELECT * FROM cameras WHERE venue_id = ? OR venue_id = 'default'", (venue_id,))
        else:
            cursor.execute("SELECT * FROM cameras")
        return [dict(row) for row in cursor.fetchall()]

def get_camera_by_id(camera_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_camera_by_token(token: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cameras WHERE session_token = ?", (token,))
        row = cursor.fetchone()
        return dict(row) if row else None

def upsert_camera(cam: Dict[str, Any]) -> Dict[str, Any]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        now = time.time()
        cursor.execute('''
            INSERT INTO cameras
            (id, venue_id, name, type, assigned_zone_id, status, last_seen, latest_count, confidence, marker_x, marker_y, fov_angle, fov_depth, fov_rotation, rtsp_url, session_token, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                type=excluded.type,
                assigned_zone_id=excluded.assigned_zone_id,
                status=excluded.status,
                last_seen=excluded.last_seen,
                latest_count=excluded.latest_count,
                confidence=excluded.confidence,
                marker_x=excluded.marker_x,
                marker_y=excluded.marker_y,
                fov_angle=excluded.fov_angle,
                fov_depth=excluded.fov_depth,
                fov_rotation=excluded.fov_rotation,
                rtsp_url=excluded.rtsp_url,
                session_token=excluded.session_token,
                updated_at=excluded.updated_at
        ''', (
            cam['id'],
            cam.get('venue_id', 'default'),
            cam['name'],
            cam['type'],
            cam.get('assigned_zone_id'),
            cam.get('status', 'waiting'),
            cam.get('last_seen'),
            cam.get('latest_count', 0),
            cam.get('confidence', 0.0),
            cam.get('marker_x', 100),
            cam.get('marker_y', 100),
            cam.get('fov_angle', 45),
            cam.get('fov_depth', 80),
            cam.get('fov_rotation', 45),
            cam.get('rtsp_url'),
            cam.get('session_token'),
            cam.get('created_at', now),
            now
        ))
        conn.commit()
    return cam

def delete_camera(camera_id: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
        cursor.execute("DELETE FROM observations WHERE camera_id = ?", (camera_id,))
        conn.commit()

def record_observation(obs: Dict[str, Any]):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        now = obs.get('timestamp', time.time())
        cursor.execute('''
            INSERT INTO observations (timestamp, camera_id, zone_id, people_count, confidence, source_type)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            now,
            obs['camera_id'],
            obs.get('zone_id'),
            obs['people_count'],
            obs.get('confidence', 0.0),
            obs.get('source_type', 'real')
        ))
        
        # Also update camera record
        cursor.execute('''
            UPDATE cameras 
            SET last_seen = ?, latest_count = ?, confidence = ?, status = 'streaming', updated_at = ?
            WHERE id = ?
        ''', (
            now,
            obs['people_count'],
            obs.get('confidence', 0.0),
            now,
            obs['camera_id']
        ))
        conn.commit()

def get_recent_observations(limit: int = 100) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM observations ORDER BY id DESC LIMIT ?", (limit,))
        return [dict(row) for row in reversed(cursor.fetchall())]

def add_event_log(event_type: str, message: str, severity: str = 'info', camera_id: Optional[str] = None, zone_id: Optional[str] = None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO event_logs (timestamp, event_type, message, severity, camera_id, zone_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (time.time(), event_type, message, severity, camera_id, zone_id))
        conn.commit()

def get_recent_event_logs(limit: int = 40) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM event_logs ORDER BY id DESC LIMIT ?", (limit,))
        return [dict(row) for row in cursor.fetchall()]
