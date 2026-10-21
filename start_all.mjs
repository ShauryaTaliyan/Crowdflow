/**
 * CrowdFlow Unified Server Launcher
 * Launches the Python FastAPI YOLO monitoring backend (port 8000)
 * and the Vite HTTPS frontend dev server (port 3000) concurrently.
 */

import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find LAN IP
function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const lanIP = getLanIP();

console.log('====================================================');
console.log('🚀 Launching CrowdFlow Live Monitoring Platform');
console.log('====================================================');
console.log(`🌐 Local Network (LAN) IP: ${lanIP}`);
console.log(`💻 Desktop Dashboard:     https://localhost:3000`);
console.log(`📱 Mobile Access:          https://${lanIP}:3000`);
console.log(`🧠 FastAPI & YOLO Backend: http://localhost:8000`);
console.log('====================================================\n');

// 1. Start Python Backend
const pythonBin = path.join(__dirname, 'backend', 'venv', 'bin', 'python');
const backendProc = spawn(pythonBin, [
  '-m', 'uvicorn',
  'main:app',
  '--app-dir', path.join(__dirname, 'backend'),
  '--host', '0.0.0.0',
  '--port', '8000',
  '--reload'
], { stdio: 'inherit' });

// 2. Start Vite Frontend
const frontendProc = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\n🛑 Shutting down CrowdFlow servers...');
  backendProc.kill();
  frontendProc.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
