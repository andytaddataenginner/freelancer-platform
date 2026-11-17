import { auth } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://freelancer-platform-1-b825.onrender.com/api').replace(/\/$/, '');

export async function apiRequest(path, options = {}) {
  const token = auth.token();
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // A 401 from the login endpoint means invalid credentials, not an expired session.
    const isLoginRequest = /\/auth\/login(?:\?|$)/.test(path);
    if (!isLoginRequest) {
      const role = String(auth.user()?.role || '').trim().toLowerCase();
      const loginRole = role === 'client' ? 'client' : 'freelancer';
      auth.clear();
      if (window.location.hash !== '#/login' && !window.location.hash.startsWith('#/login?')) {
        // QFA uses HashRouter: send the browser to the app document first,
        // then let the client router render the login screen without relying
        // on a host-specific deep-link rewrite.
        window.location.assign('/#/login?role=' + loginRole + '&reason=expired');
      }
      throw new Error('Your session has expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error || payload.message || `Request failed (${response.status})`;
    if (response.status === 401 && /\/auth\/login(?:\?|$)/.test(path)) {
      throw new Error('Incorrect email or password. Please check your details and try again.');
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const apiBaseUrl = API_BASE_URL;