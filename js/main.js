// ── Config ──────────────────────────────────────────────────
const API = window.location.hostname === 'localhost'
  ? 'https://freelancer-platform-9jut.onrender.com/'
  : 'https://your-app-name.onrender.com/api'; // ← Update this after deploying to Render

// ── Auth helpers ─────────────────────────────────────────────
const auth = {
  token: () => localStorage.getItem('token'),
  user:  () => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } },
  save:  (token, user) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); },
  clear: () => { localStorage.removeItem('token'); localStorage.removeItem('user'); },
  isLoggedIn: () => !!localStorage.getItem('token'),
  headers: () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') })
};

// ── Redirect if already logged in ────────────────────────────
if (document.querySelector('.nav') && auth.isLoggedIn()) {
  const u = auth.user();
  if (u && u.role === 'freelancer') {
    document.querySelector('.btn-nav').textContent = 'Dashboard';
    document.querySelector('.btn-nav').href = 'pages/dashboard.html';
  } else if (u && u.role === 'client') {
    document.querySelector('.btn-nav').textContent = 'My Portal';
    document.querySelector('.btn-nav').href = 'pages/client-portal.html';
  }
}

// ── Portfolio loader ──────────────────────────────────────────
async function loadPortfolio() {
  const grid = document.getElementById('portfolio-grid');
  if (!grid) return;

  try {
    const res = await fetch(`${API}/portfolio`);
    const items = await res.json();

    if (!items.length) {
      grid.innerHTML = '<p style="color:var(--ink2);grid-column:1/-1">No portfolio items yet.</p>';
      return;
    }

    grid.innerHTML = items.map(item => `
      <div class="portfolio-card" onclick="openProject('${item.id}')">
        <div class="card-image-placeholder">${item.emoji || '💻'}</div>
        <div class="card-body">
          <div class="card-tag">${item.category || 'Project'}</div>
          <div class="card-title">${item.title}</div>
          <div class="card-desc">${item.description}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    // Demo mode — show sample cards if API unavailable
    const demos = [
      { emoji: '🛒', category: 'E-commerce', title: 'Online Store Revamp', desc: 'Full redesign and rebuild of a regional retailer's web shop, increasing conversion by 34%.' },
      { emoji: '📊', category: 'Dashboard', title: 'Analytics Platform', desc: 'Real-time data dashboard built for a logistics company tracking 50k+ daily shipments.' },
      { emoji: '📱', category: 'Mobile Web', title: 'Field Service App', desc: 'Progressive web app for field technicians with offline-first architecture.' },
    ];
    grid.innerHTML = demos.map(d => `
      <div class="portfolio-card">
        <div class="card-image-placeholder">${d.emoji}</div>
        <div class="card-body">
          <div class="card-tag">${d.category}</div>
          <div class="card-title">${d.title}</div>
          <div class="card-desc">${d.desc}</div>
        </div>
      </div>
    `).join('');
  }
}

// ── Stats loader ──────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch(`${API}/stats/public`);
    const data = await res.json();
    if (document.getElementById('stat-clients')) document.getElementById('stat-clients').textContent = data.clients + '+';
    if (document.getElementById('stat-projects')) document.getElementById('stat-projects').textContent = data.projects + '+';
  } catch {
    if (document.getElementById('stat-clients')) document.getElementById('stat-clients').textContent = '20+';
    if (document.getElementById('stat-projects')) document.getElementById('stat-projects').textContent = '40+';
  }
}

// ── Contact form ──────────────────────────────────────────────
async function submitContact(e) {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById('contact-status');
  const btn = form.querySelector('button[type=submit]');
  btn.textContent = 'Sending…';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    if (res.ok) {
      status.className = 'form-status success';
      status.textContent = '✓ Message sent! I\'ll be in touch within 24 hours.';
      form.reset();
    } else throw new Error();
  } catch {
    status.className = 'form-status error';
    status.textContent = 'Something went wrong. Please email me directly.';
  } finally {
    btn.textContent = 'Send message →';
    btn.disabled = false;
  }
}

// ── Mobile menu ───────────────────────────────────────────────
function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('open');
}

// ── API helper (used by dashboard pages) ─────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...auth.headers(), ...(options.headers || {}) }
  });
  if (res.status === 401) {
    auth.clear();
    window.location.href = '/pages/login.html';
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ── Init ──────────────────────────────────────────────────────
loadPortfolio();
loadStats();
