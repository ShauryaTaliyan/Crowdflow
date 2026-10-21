import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const certPath = path.resolve(__dirname, 'certs/server-cert.pem');
const keyPath = path.resolve(__dirname, 'certs/server-key.pem');
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  server: {
    host: '0.0.0.0', // Expose to local network / phones
    port: 3000,
    open: false,
    https: hasCerts ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    } : true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      }
    }
  }
});

