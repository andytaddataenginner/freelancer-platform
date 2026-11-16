import { auth } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://freelancer-platform-9jut.onrender.com/api').replace(/\/$/, '');

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
    // Preserve the account type before clearing the session. Otherwise client
    // requests incorrectly send the user back to the default freelancer login.
    const role = String(auth.user()?.role || '').trim().toLowerCase();
    const loginRole = role === 'client' ? 'client' : 'freelancer';
    auth.clear();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login?role=' + loginRole + '&reason=expired');
    }
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const apiBaseUrl = API_BASE_URL;