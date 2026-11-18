const SESSION_HOURS = 24 * 30;

export const auth = {
  token: () => localStorage.getItem('token'),
  user: () => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  },
  save: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('login_time', String(Date.now()));
  },
  clear: () => {
    ['token', 'user', 'login_time'].forEach((key) => localStorage.removeItem(key));
    window.dispatchEvent(new Event('qfa:logout'));
  },
  isValid: () => {
    if (!localStorage.getItem('token')) return false;
    const signedInAt = Number(localStorage.getItem('login_time') || 0);
    if (!signedInAt) {
      localStorage.setItem('login_time', String(Date.now()));
      return true;
    }
    if ((Date.now() - signedInAt) / 3600000 > SESSION_HOURS) {
      auth.clear();
      return false;
    }
    return true;
  },
};