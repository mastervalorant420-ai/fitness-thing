// src/api/client.js
// Central API client — injects Bearer token, handles 401 → logout + redirect.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

// A simple event emitter so the client can signal the AuthContext to logout
// without creating a circular dependency.
const unauthorizedListeners = [];
export function onUnauthorized(fn) {
  unauthorizedListeners.push(fn);
}
function notifyUnauthorized() {
  unauthorizedListeners.forEach((fn) => fn());
}

function getToken() {
  return localStorage.getItem('token');
}

async function request(method, path, body = undefined) {
  const token = getToken();

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    notifyUnauthorized();
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || 'Unauthorized');
    err.code = data.error;
    err.status = 401;
    throw err;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || `Request failed with status ${res.status}`);
    err.code = data.error;
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  get:   (path)         => request('GET',   path),
  post:  (path, body)   => request('POST',  path, body),
  patch: (path, body)   => request('PATCH', path, body),
};
