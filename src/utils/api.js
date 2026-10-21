/**
 * CrowdFlow Unified API & WebSocket URL Helper
 * 
 * In local development, VITE_API_BASE_URL is empty, so requests default to
 * relative paths (e.g. '/api/zones') which are handled by the local dev proxy.
 * 
 * In production (e.g. Netlify frontend connecting to a Render/Railway backend),
 * set VITE_API_BASE_URL in Netlify's environment settings:
 *   VITE_API_BASE_URL=https://crowdflow-backend.onrender.com
 */

export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/**
 * Returns a fully qualified or relative HTTP URL for the given API endpoint.
 * @param {string} path - API endpoint path (e.g. '/api/zones')
 * @returns {string}
 */
export function apiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Returns a fully qualified WebSocket URL for the given path.
 * @param {string} path - WebSocket endpoint path (e.g. '/ws/live')
 * @returns {string}
 */
export function getWsUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL) {
    const wsBase = API_BASE_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${wsBase}${cleanPath}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${cleanPath}`;
}
