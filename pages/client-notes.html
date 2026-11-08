<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Guidelines & Notes — QFA</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Outfit:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="../css/style.css"/>
  <link rel="stylesheet" href="../css/chatbot-widget.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root{
      --navy-950:#081431; --navy-900:#0d2353; --navy-700:#1a3a7a; --accent:#2f6fed;
      --gold-600:#a8781f; --gold-500:#c9952a; --gold-300:#f0c34a;
      --ink:#0d2353; --ink-2:#48557a; --ink-3:#8592b3;
      --bg:#eef1f7; --bg2:#e4e9f4; --panel:#ffffff;
      --green:#146c43; --gbg:#dcf3e6; --amber:#92400e; --abg:#fdecc8; --red:#b91c1c; --rbg:#fde3e3;
      --line: rgba(13,35,83,.10);
      --serif:'Playfair Display',serif; --sans:'Outfit',sans-serif; --mono:'IBM Plex Mono',monospace;
      --radius:12px; --radius-lg:16px;
      --shadow:0 3px 18px rgba(13,35,83,.07);
    }
    [data-theme="dark"]{
      --navy-950:#05070d; --navy-900:#101c38; --navy-700:#1c2f57; --accent:#5b8dff;
      --gold-600:#c9952a; --gold-500:#e0ac35; --gold-300:#f5c842;
      --ink:#eef1f8; --ink-2:#aab6d6; --ink-3:#6d7ba3;
      --bg:#080c17; --bg2:#111a2e; --panel:#0e1526;
      --green:#4fd394; --gbg:rgba(20,108,67,.32); --amber:#f2b84a; --abg:rgba(146,64,14,.32); --red:#ff8080; --rbg:rgba(185,28,28,.30);
      --line: rgba(255,255,255,.09);
      --shadow:0 3px 22px rgba(0,0,0,.45);
    }

    html{scroll-behavior:smooth}
    body{font-family:var(--sans);background:var(--bg);color:var(--ink);transition:background .3s ease,color .3s ease;}
    .mono{font-family:var(--mono);font-variant-numeric:tabular-nums;}
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }

    .dashboard { display: flex; min-height: 100vh; }

    .sidebar {
      width: 232px !important; background: var(--navy-950) !important;
      position: fixed !important; top: 0 !important; left: 0 !important; height: 100vh !important;
      display: flex !important; flex-direction: column !important;
      z-index: 150 !important; transform: translateX(0);
      transition: transform 0.3s ease-in-out, background .3s ease !important;
      border-right: 1px solid rgba(255,255,255,.05);
    }
    .sidebar-brand {
      padding: 1.2rem 1.4rem !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important;
      display: flex !important; align-items: center !important; gap: 0.7rem !important;
    }
    .sidebar-nav { flex: 1 !important; padding: 0.8rem 0 !important; overflow-y: auto !important; display: flex !important; flex-direction: column !important; gap: 0.15rem !important; }
    .sidebar-nav a {
      display: flex !important; align-items: center !important; gap: 0.7rem !important;
      padding: 0.75rem 1.4rem !important; font-size: 0.85rem !important; font-weight: 500 !important;
      color: rgba(255,255,255,0.6) !important; text-decoration: none !important;
      transition: all 0.2s; border-right: 3px solid transparent !important;
    }
    .sidebar-nav a:hover { color: white !important; background: rgba(255,255,255,0.05) !important; }
    .sidebar-nav a.active { color: white !important; background: rgba(201,149,42,0.12) !important; border-right-color: var(--gold-500) !important; }
    .sidebar-user { padding: 1.1rem 1.4rem !important; border-top: 1px solid rgba(255,255,255,0.08) !important; font-size: 0.8rem !important; display: flex !important; flex-direction: column !important; }

    .mobile-header { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: var(--navy-950); padding: 0.75rem 1rem; align-items: center; justify-content: space-between; box-shadow: 0 2px 12px rgba(13,35,83,0.2); }
    .mobile-logo { display: flex; align-items: center; gap: 0.5rem; }
    .mobile-logo img { height: 30px; background: white; border-radius: 6px; padding: 2px; }
    .mobile-logo span { color: white; font-size: 0.83rem; font-weight: 700; }
    .hamburger-btn { background: rgba(255,255,255,0.1); border: none; color: white; width: 34px; height: 34px; border-radius: 8px; font-size: 1.05rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 120; backdrop-filter: blur(2px); }

    .main-content { margin-left: 232px; flex: 1; padding: 1.2rem 1.8rem 2rem; position: relative; max-width: 1180px; }

    .theme-toggle{ background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); color:#fff; width:34px; height:34px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:.95rem; transition:all .2s; flex-shrink:0; }
    .theme-toggle:hover{ background:rgba(255,255,255,.22); }
    
    .hero { 
      background: linear-gradient(150deg, var(--navy-950), var(--navy-700)); 
      border-radius: var(--radius); 
      padding: 0.85rem 1.2rem;     
      color: white; 
      margin-bottom: 0.9rem;      
      box-shadow: 0 4px 16px rgba(13,35,83,0.14); 
      display: flex; 
      justify-content: space-between; 
      align-items: center;        
      flex-wrap: wrap; 
      gap: 0.6rem; 
    }
    .hero h1 { 
      margin: 0.1rem 0 0; 
      font-family: var(--serif); 
      font-style: italic; 
      font-size: 1.25rem;         
      font-weight: 700; 
      line-height: 1.15; 
    }
    .eyebrow{ font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold-300); font-weight: 700; }
    .hero-actions{ display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
    .engagement-pill{ background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 0.35rem 0.8rem; border-radius: 50px; font-size: 0.75rem; font-weight: 600; color: white; display: inline-flex; align-items: center; gap: 0.4rem; }

    .ledger-panel-wrap{ background:var(--panel); border:1px solid var(--line); border-radius:var(--radius-lg); box-shadow:var(--shadow); padding:1.1rem 1.2rem 1.3rem; }
    
    .cat-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 1.2rem; }
    .cat-tab {
      padding: 6px 14px; border-radius: 20px; font-size: .8rem; cursor: pointer;
      border: 1.5px solid var(--line); background: var(--bg2); color: var(--ink-2);
      font-weight: 600; transition: all .15s;
    }
    .cat-tab.active, .cat-tab:hover { background: var(--navy-900); color: #fff; border-color: var(--navy-900); }

    .notes-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .note-card {
      background: var(--bg); border: 1.5px solid var(--line);
      border-radius: 12px; padding: 1.1rem 1.3rem; position: relative;
      transition: border-color .2s;
    }
    .note-card.pinned { border-color: var(--gold-500); background: var(--panel); }
    .nc-top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: .6rem; }
    .nc-badge {
      font-size: .65rem; padding: 3px 8px; border-radius: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; flex-shrink: 0;
    }
    .badge-basic        { background: #dbeafe; color: #1e40af; }
    .badge-mandatory    { background: var(--rbg); color: var(--red); }
    .badge-business_rule{ background: var(--gbg); color: var(--green); }
    .badge-tip          { background: var(--abg); color: var(--amber); }
    .badge-general      { background: var(--bg2); color: var(--ink-3); }

    .nc-title { font-weight: 700; font-size: .95rem; color: var(--ink); flex: 1; }
    .nc-content { color: var(--ink-2); font-size: .85rem; line-height: 1.55; white-space: pre-wrap; margin-bottom: 1rem; }
    .nc-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; border-top: 1px solid var(--line); padding-top: 0.8rem; }
    
    .btn-icon { background: var(--panel); border: 1.5px solid var(--line); color: var(--ink-2);
                border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: .78rem; font-weight: 600;
                transition: all .15s; }
    .btn-icon:hover { background: var(--bg2); color: var(--ink); }
    .btn-icon.danger:hover { border-color: var(--red); color: var(--red); background: var(--rbg); }
    .btn-icon.pin-on { border-color: var(--gold-500); color: var(--gold-500); background: rgba(201,149,42,0.1); }

    .fg { display: flex; flex-direction: column; gap: .3rem; margin-bottom: .9rem; }
    .fg label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); }
    input, textarea, select {
      width: 100%; padding: .7rem .9rem; border: 1.5px solid var(--line); border-radius: 9px;
      background: var(--panel); font-family: var(--sans); font-size: .88rem; color: var(--ink);
      transition: border-color .2s, box-shadow .2s;
    }
    input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(47,111,237,.12); }
    textarea { resize: vertical; min-height: 90px; }

    .btn { padding: .55rem 1.2rem; border-radius: 8px; font-family: var(--sans); font-size: .82rem; font-weight: 600; border: none; cursor: pointer; transition: all .2s; display: inline-flex; align-items: center; gap: .4rem; white-space: nowrap; }
    .btn-primary { background: var(--navy-900); color: #fff; }
    .btn-primary:hover { background: var(--navy-700); }
    .btn-ghost { background: transparent; border: 1.5px solid var(--line); color: var(--ink-2); }
    .btn-ghost:hover { border-color: var(--navy-900); color: var(--ink); }

    .form-row { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; margin-bottom: 1rem; }
    .form-row.single { grid-template-columns: 1fr; }
    .row-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 1rem; }

    .empty { text-align: center; padding: 2.5rem; color: var(--ink-3); font-size: .9rem; grid-column: 1/-1; }
    
    .toast {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: var(--navy-950); color: #fff; border-radius: 8px;
      padding: 10px 20px; font-size: .9rem; z-index: 9999;
      box-shadow: var(--shadow); opacity: 0; transition: opacity .3s;
      pointer-events: none;
    }
    .toast.show { opacity: 1; }

    .modal-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(6,12,28,.6); z-index: 500; align-items: center; justify-content: center;
      backdrop-filter: blur(4px); padding: 1rem;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: var(--panel); border: 1px solid var(--line); border-radius: 20px;
      padding: 1.8rem; width: 100%; max-width: 520px; box-shadow: var(--shadow);
    }
    .modal h2 { font-family: var(--serif); font-size: 1.2rem; color: var(--ink); margin-bottom: 1.2rem; }

    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%) !important; }
      .sidebar.is-open { transform: translateX(0) !important; }
      .sidebar-overlay.visible { display: block !important; }
      .main-content { margin-left: 0 !important; padding: 0.8rem !important; padding-top: 68px !important; }
      .mobile-header { display: flex !important; }
      .hero h1 { font-size: 1.15rem; }
      .form-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<div class="mobile-header" id="mobile-header">
  <div class="mobile-logo">
    <img src="../QFA_Logo.png" alt="QFA"/>
    <span>QFA Portal</span>
  </div>
  <div style="display:flex;align-items:center;gap:.6rem">
    <button class="theme-toggle" onclick="toggleTheme()" title="Toggle Dark/Light Mode">🌙</button>
    <button class="hamburger-btn" onclick="openSidebar()" aria-label="Open menu">☰</button>
  </div>
</div>

<div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>

<div class="dashboard">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <div style="width:36px;height:36px;background:white;border-radius:8px;overflow:hidden;padding:3px;flex-shrink:0">
        <img src="../QFA_Logo.png" style="width:100%;height:100%;object-fit:contain"/>
      </div>
      <div style="line-height:1.2">
        <div style="color:white;font-size:0.78rem;font-weight:700">Quick Freelancing</div>
        <div style="color:var(--gold-300);font-size:0.63rem;text-transform:uppercase;letter-spacing:0.08em">Agency</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <a href="client-portal.html">📊 My Overview</a>
      <a href="client-logs.html">⏱ My Time Logs</a>
      <a href="client-projects.html">📁 My Projects</a>
      <a href="client-notes.html" class="active">📌 Guidelines & Notes</a>
      <a href="client-schedule.html">📅 Book a Session</a>
      <a href="../index.html" target="_blank">🌐 Portfolio</a>
    </nav>
    <div class="sidebar-user">
      <strong id="user-name" style="color:white; display:block;">Loading…</strong>
      <span id="user-company" style="display:block;margin-top:0.1rem;font-size:0.78rem;color:rgba(255,255,255,0.4)"></span>
      <a href="#" onclick="logout()" style="color:var(--gold-300);font-size:0.8rem;margin-top:0.4rem;display:inline-block;text-decoration:none">Sign out →</a>
    </div>
  </aside>

  <main class="main-content">

    <div class="hero">
      <div>
        <span class="eyebrow">Client Workspace</span>
        <h1 id="page-main-title">Project Notes & Guidelines</h1>
      </div>
      <div class="hero-actions">
        <span class="engagement-pill" id="freelancer-status-pill">
          <span id="pill-dot" style="width:7px;height:7px;background:#22c55e;border-radius:50%;display:inline-block"></span> 
          <span id="pill-text">Checking availability...</span>
        </span>
        <button class="theme-toggle" onclick="toggleTheme()" title="Toggle Dark/Light Mode">🌙</button>
      </div>
    </div>

    <div class="ledger-panel-wrap">
      <div style="font-size:.68rem;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:1.1rem">Reference Notes & Guidelines</div>
      
      <div class="cat-tabs" id="catTabs">
        <div class="cat-tab active" data-cat="all">All</div>
        <div class="cat-tab" data-cat="mandatory">Mandatory</div>
        <div class="cat-tab" data-cat="basic">Basic</div>
        <div class="cat-tab" data-cat="business_rule">Business Rules</div>
        <div class="cat-tab" data-cat="tip">Tips</div>
        <div class="cat-tab" data-cat="general">General</div>
      </div>

      <div id="notesList" class="notes-grid">
        <p style="color:var(--ink-3);font-size:0.88rem;">Loading notes…</p>
      </div>

      <div id="addCard" class="card" style="margin-top:1.5rem; display:none; background:var(--bg); border:1px solid var(--line); padding:1.2rem; border-radius:12px;">
        <div style="font-weight:700;font-size:.95rem;margin-bottom:1rem;color:var(--ink)">New Note / Guideline</div>
        <div class="form-row">
          <div class="fg" style="margin:0"><label>Title</label><input type="text" id="noteTitle" placeholder="e.g., Project Requirements" /></div>
          <div class="fg" style="margin:0"><label>Category</label>
            <select id="noteCat">
              <option value="general">General</option>
              <option value="basic">Basic</option>
              <option value="mandatory">Mandatory</option>
              <option value="business_rule">Business Rule</option>
              <option value="tip">Tip</option>
            </select>
          </div>
        </div>
        <div class="form-row single" style="margin-top:1rem;">
          <div class="fg" style="margin:0"><label>Content</label><textarea id="noteContent" placeholder="Note content…"></textarea></div>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost" onclick="toggleAdd()">Cancel</button>
          <button class="btn btn-primary" onclick="saveNote()">Save Note</button>
        </div>
      </div>

      <button class="btn btn-primary" id="addBtn" style="margin-top:1.2rem;" onclick="toggleAdd()">+ Add Note</button>
    </div>
  </main>
</div>

<div class="modal-overlay" id="editModal">
  <div class="modal">
    <h2>Edit Note</h2>
    <div class="form-row">
      <div class="fg" style="margin:0"><label>Title</label><input type="text" id="editTitle" placeholder="Title" /></div>
      <div class="fg" style="margin:0"><label>Category</label>
        <select id="editCat">
          <option value="general">General</option>
          <option value="basic">Basic</option>
          <option value="mandatory">Mandatory</option>
          <option value="business_rule">Business Rule</option>
          <option value="tip">Tip</option>
        </select>
      </div>
    </div>
    <div class="form-row single" style="margin-top:1rem; margin-bottom:0">
      <div class="fg" style="margin:0"><label>Content</label><textarea id="editContent" placeholder="Note content…"></textarea></div>
    </div>
    <div class="row-actions">
      <button class="btn btn-ghost" onclick="closeEdit()">Cancel</button>
      <button class="btn btn-primary" onclick="submitEdit()">Save Changes</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const API = 'https://freelancer-platform-9jut.onrender.com/api';
const auth = {
  token: () => localStorage.getItem('token'),
  user:  () => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } },
  clear: () => { localStorage.removeItem('token'); localStorage.removeItem('user'); },
  isLoggedIn: () => !!localStorage.getItem('token'),
  headers: () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') })
};

function initTheme(){
  const saved = localStorage.getItem('qfa_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeButtons(saved);
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur==='dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('qfa_theme', next);
  updateThemeButtons(next);
}
function updateThemeButtons(theme){
  const icon = theme==='dark' ? '☀️' : '🌙';
  document.querySelectorAll('.theme-toggle').forEach(b=>b.textContent=icon);
}
initTheme();

let clientName = '';
if (!auth.isLoggedIn()) { window.location.href = 'login.html'; }
const u = auth.user();
if (u) {
  if (u.role !== 'client') { window.location.href = 'dashboard.html'; }
  clientName = u.name || ''; 
  document.getElementById('user-name').textContent = u.name;
  if (u.company) document.getElementById('user-company').textContent = u.company;
}

const titlePrefix = clientName ? `Welcome, ${clientName} — ` : '';
document.getElementById('page-main-title').textContent = titlePrefix + 'Project Notes & Guidelines';

function logout() { auth.clear(); window.location.href = '../index.html'; }

let allNotes = [];
let activeCat = 'all';
let editingNoteId = null;

function toast(msg, dur=2500) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), dur);
}

async function checkFreelancerLiveStatus() {
  const dot = document.getElementById('pill-dot');
  const text = document.getElementById('pill-text');
  if (!dot || !text) return;

  try {
    const res = await fetch(API + '/timer/agency/status', { headers: auth.headers() });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'busy') {
        dot.style.background = '#f59e0b';
        text.textContent = data.is_paused ? 'On a brief break' : 'Currently in a session';
      } else if (data.status === 'available') {
        dot.style.background = '#22c55e';
        text.textContent = 'Available';
      } else {
        dot.style.background = '#9ca3af';
        text.textContent = 'Offline';
      }
    }
  } catch (e) {
    dot.style.background = '#9ca3af';
    text.textContent = 'Offline';
  }
}
checkFreelancerLiveStatus();
setInterval(checkFreelancerLiveStatus, 30000);

async function fetchNotes() {
  try {
    const res = await fetch(`${API}/client-notes`, { headers: auth.headers() });
    if (!res.ok) throw new Error('Failed to load notes');
    allNotes = await res.json();
    renderNotes();
  } catch (err) {
    document.getElementById('notesList').innerHTML = `<p style="color:var(--red);font-size:0.88rem;">Error loading notes.</p>`;
  }
}

function renderNotes() {
  const filtered = activeCat === 'all' ? allNotes : allNotes.filter(n => n.category === activeCat);
  const container = document.getElementById('notesList');
  
  if (!filtered.length) {
    container.innerHTML = `<div class="empty">No ${activeCat === 'all' ? '' : activeCat.replace('_',' ') + ' '}notes available.</div>`;
    return;
  }

  container.innerHTML = filtered.map(n => `
    <div class="note-card ${n.is_pinned ? 'pinned' : ''}">
      <div class="nc-top">
        <span class="nc-badge badge-${n.category}">${escapeHtml(n.category.replace('_',' '))}</span>
        <span class="nc-title">${escapeHtml(n.title)}</span>
      </div>
      <div class="nc-content">${escapeHtml(n.content)}</div>
      <div style="font-size:0.75rem; color:var(--ink-3); margin-bottom:0.5rem;">Added by: ${escapeHtml(n.author_name || n.freelancer_name || 'User')}</div>
      <div class="nc-actions">
        <button class="btn-icon ${n.is_pinned ? 'pin-on' : ''}" onclick="togglePin(${n.id})">
          ${n.is_pinned ? '📌 Pinned' : '📌 Pin'}
        </button>
        <button class="btn-icon" onclick="openEdit(${n.id})">Edit</button>
        <button class="btn-icon danger" onclick="deleteNote(${n.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('catTabs').addEventListener('click', e => {
  const tab = e.target.closest('.cat-tab');
  if (!tab) return;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeCat = tab.dataset.cat;
  renderNotes();
});

function toggleAdd() {
  const card = document.getElementById('addCard');
  card.style.display = card.style.display === 'none' ? '' : 'none';
  if (card.style.display === '') {
    document.getElementById('noteTitle').focus();
  }
}

async function saveNote() {
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  const category = document.getElementById('noteCat').value;
  if (!title || !content) { toast('Title and content are required'); return; }

  try {
    const res = await fetch(`${API}/client-notes`, {
      method: 'POST',
      headers: auth.headers(),
      body: JSON.stringify({ title, content, category })
    });
    if (!res.ok) { const d = await res.json(); toast(d.error || 'Failed to save note'); return; }
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('addCard').style.display = 'none';
    toast('Note saved successfully ✓');
    fetchNotes();
  } catch (e) { toast('Network error'); }
}

async function togglePin(noteId) {
  try {
    await fetch(`${API}/client-notes/${noteId}/pin`, {
      method: 'PATCH',
      headers: auth.headers()
    });
    fetchNotes();
  } catch (e) { toast('Error updating pin status'); }
}

async function deleteNote(noteId) {
  if (!confirm('Are you sure you want to delete this note?')) return;
  try {
    const res = await fetch(`${API}/client-notes/${noteId}`, {
      method: 'DELETE',
      headers: auth.headers()
    });
    if (!res.ok) { toast('Failed to delete note'); return; }
    toast('Note deleted');
    fetchNotes();
  } catch (e) { toast('Network error'); }
}

function openEdit(noteId) {
  const note = allNotes.find(n => n.id === noteId);
  if (!note) return;
  editingNoteId = noteId;
  document.getElementById('editTitle').value = note.title;
  document.getElementById('editContent').value = note.content;
  document.getElementById('editCat').value = note.category;
  document.getElementById('editModal').classList.add('open');
}

function closeEdit() {
  editingNoteId = null;
  document.getElementById('editModal').classList.remove('open');
}

async function submitEdit() {
  if (!editingNoteId) return;
  const title = document.getElementById('editTitle').value.trim();
  const content = document.getElementById('editContent').value.trim();
  const category = document.getElementById('editCat').value;
  if (!title || !content) { toast('Title and content are required'); return; }

  try {
    const res = await fetch(`${API}/client-notes/${editingNoteId}`, {
      method: 'PUT',
      headers: auth.headers(),
      body: JSON.stringify({ title, content, category })
    });
    if (!res.ok) { const d = await res.json(); toast(d.error || 'Failed to update note'); return; }
    closeEdit();
    toast('Note updated ✓');
    fetchNotes();
  } catch (e) { toast('Network error'); }
}

document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) closeEdit();
});

function escapeHtml(str) {
  return String(str||'')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('is-open');
  document.getElementById('sidebar-overlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('is-open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
  document.body.style.overflow = '';
}

fetchNotes();
</script>
<script src="../chatbot-widget.js"></script>
<script src="../client-timer-widget.js"></script>
</body>
</html>
