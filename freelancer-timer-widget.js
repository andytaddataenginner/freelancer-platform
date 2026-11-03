/**
 * freelancer-timer-widget.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop on the FREELANCER dashboard:
 *   <script src="../freelancer-timer-widget.js"></script>
 *
 * What it does:
 *  • Shows a floating panel with client selector + description + Start/Stop
 *  • Runs a local clock that shows elapsed HH:MM:SS once running
 *  • On Start  → POST /api/timer/start  (pushes SSE event to client)
 *  • On Stop   → POST /api/timer/stop   (pushes SSE stop to client)
 *  • On load   → GET  /api/timer/status to resume any already-running timer
 *  • The client's browser receives the live push via SSE automatically
 *    (no action needed on the freelancer side — it just works)
 * ─────────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────────────
  const FALLBACK_API = 'https://freelancer-platform-9jut.onrender.com';
  const getApi = () => {
    const m = document.querySelector('meta[name="api-base"]');
    return m && m.content ? m.content : FALLBACK_API;
  };
  const token = () => localStorage.getItem('token');
  const hdr   = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token()}`
  });

  // ── Inject styles ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #qfaFreelancerTimer {
      position: fixed;
      bottom: 90px; right: 20px;
      background: #0f172a;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 16px;
      width: 280px;
      box-shadow: 0 8px 32px rgba(0,0,0,.45);
      font-family: system-ui, sans-serif;
      font-size: .9rem;
      z-index: 900;
      overflow: hidden;
      transition: height .25s ease;
    }
    #qfaFreelancerTimer .ft-header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      cursor: pointer;
      user-select: none;
    }
    #qfaFreelancerTimer .ft-title {
      font-weight: 700; font-size: .85rem; flex: 1;
      text-transform: uppercase; letter-spacing: .07em; color: #94a3b8;
    }
    #qfaFreelancerTimer .ft-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #475569;
      flex-shrink: 0; transition: background .3s;
    }
    #qfaFreelancerTimer .ft-dot.running { background: #22c55e;
      animation: ftPulse 1.4s ease-in-out infinite; }
    @keyframes ftPulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:.4; transform:scale(1.5); }
    }
    #qfaFreelancerTimer .ft-chevron {
      color: #94a3b8; font-size: .8rem; transition: transform .25s;
    }
    #qfaFreelancerTimer.collapsed .ft-chevron { transform: rotate(180deg); }
    #qfaFreelancerTimer .ft-body { padding: 14px; }
    #qfaFreelancerTimer .ft-elapsed {
      font-size: 2rem; font-weight: 800; letter-spacing: .04em;
      font-variant-numeric: tabular-nums; text-align: center;
      padding: 8px 0 12px; color: #e2e8f0;
    }
    #qfaFreelancerTimer .ft-elapsed.running { color: #22c55e; }
    #qfaFreelancerTimer .ft-field {
      margin-bottom: 9px;
    }
    #qfaFreelancerTimer .ft-field label {
      display: block; font-size: .72rem; color: #94a3b8;
      margin-bottom: 3px; text-transform: uppercase; letter-spacing: .06em;
    }
    #qfaFreelancerTimer select,
    #qfaFreelancerTimer input[type=text] {
      width: 100%; background: #1e293b; border: 1px solid #334155;
      color: #e2e8f0; border-radius: 8px; padding: 8px 10px;
      font-size: .85rem; outline: none; font-family: inherit;
    }
    #qfaFreelancerTimer select:focus,
    #qfaFreelancerTimer input:focus { border-color: #6366f1; }
    #qfaFreelancerTimer .ft-btn {
      width: 100%; padding: 10px; border-radius: 10px;
      font-size: .92rem; font-weight: 700; cursor: pointer;
      border: none; margin-top: 4px; transition: all .15s;
    }
    #qfaFreelancerTimer .ft-btn-start {
      background: #16a34a; color: #fff;
    }
    #qfaFreelancerTimer .ft-btn-start:hover { background: #22c55e; }
    #qfaFreelancerTimer .ft-btn-start:disabled { background: #1e293b; color: #475569; cursor: not-allowed; }
    #qfaFreelancerTimer .ft-btn-stop {
      background: #dc2626; color: #fff;
    }
    #qfaFreelancerTimer .ft-btn-stop:hover { background: #ef4444; }
    #qfaFreelancerTimer .ft-status {
      font-size: .75rem; color: #94a3b8; text-align: center;
      margin-top: 8px; min-height: 18px;
    }
    #qfaFreelancerTimer .ft-status.ok  { color: #22c55e; }
    #qfaFreelancerTimer .ft-status.err { color: #ef4444; }
  `;
  document.head.appendChild(style);

  // ── Inject HTML ────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'qfaFreelancerTimer';
  panel.innerHTML = `
    <div class="ft-header" id="ftHeader">
      <span class="ft-dot" id="ftDot"></span>
      <span class="ft-title">Live Timer</span>
      <span class="ft-chevron" id="ftChevron">▲</span>
    </div>
    <div class="ft-body" id="ftBody">
      <div class="ft-elapsed" id="ftElapsed">00:00:00</div>
      <div class="ft-field">
        <label>Client</label>
        <select id="ftClientSelect">
          <option value="">Loading clients…</option>
        </select>
      </div>
      <div class="ft-field">
        <label>Description (optional)</label>
        <input type="text" id="ftDesc" placeholder="e.g. Data pipeline work" maxlength="120" />
      </div>
      <button class="ft-btn ft-btn-start" id="ftStartBtn" onclick="qfaTimerStart()">▶ Start Timer</button>
      <button class="ft-btn ft-btn-stop"  id="ftStopBtn"  onclick="qfaTimerStop()" style="display:none">■ Stop Timer</button>
      <div class="ft-status" id="ftStatus"></div>
    </div>
  `;
  document.body.appendChild(panel);

  // ── Collapse / expand ──────────────────────────────────────────────────────
  document.getElementById('ftHeader').addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    document.getElementById('ftBody').style.display =
      panel.classList.contains('collapsed') ? 'none' : '';
  });

  // ── State ──────────────────────────────────────────────────────────────────
  let startedAt    = null;
  let runningClient = null;   // { id, name }
  let tickInterval = null;

  function fmt2(n) { return String(n).padStart(2, '0'); }
  function fmtElapsed(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${fmt2(h)}:${fmt2(m)}:${fmt2(s)}`;
  }

  function setRunning(running, clientName, startedAtStr) {
    const dot     = document.getElementById('ftDot');
    const elapsed = document.getElementById('ftElapsed');
    const startBtn = document.getElementById('ftStartBtn');
    const stopBtn  = document.getElementById('ftStopBtn');
    const sel      = document.getElementById('ftClientSelect');
    const descInput = document.getElementById('ftDesc');

    dot.className     = running ? 'ft-dot running' : 'ft-dot';
    elapsed.className = running ? 'ft-elapsed running' : 'ft-elapsed';
    startBtn.style.display = running ? 'none' : '';
    stopBtn.style.display  = running ? '' : 'none';
    sel.disabled       = running;
    descInput.disabled = running;

    if (running && startedAtStr) {
      startedAt = new Date(startedAtStr).getTime();
      if (tickInterval) clearInterval(tickInterval);
      tickInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt) / 1000);
        document.getElementById('ftElapsed').textContent = fmtElapsed(sec);
      }, 1000);
      setStatus(`Running for ${clientName || 'client'}  — client sees this live`, 'ok');
    } else {
      startedAt = null;
      if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
      document.getElementById('ftElapsed').textContent = '00:00:00';
    }
  }

  function setStatus(msg, cls) {
    const el = document.getElementById('ftStatus');
    el.textContent = msg;
    el.className   = `ft-status${cls ? ' ' + cls : ''}`;
  }

  // ── Load clients ───────────────────────────────────────────────────────────
  async function loadClients() {
    try {
      const r = await fetch(`${getApi()}/api/clients`, { headers: hdr() });
      if (!r.ok) throw new Error();
      const clients = await r.json();
      const sel = document.getElementById('ftClientSelect');
      sel.innerHTML = '<option value="">— Select client —</option>';
      clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.user_id || c.id;
        opt.textContent = c.name + (c.company ? ` · ${c.company}` : '');
        sel.appendChild(opt);
      });
    } catch (_) {
      setStatus('Could not load clients', 'err');
    }
  }

  // ── Check if a timer is already running (page reload) ─────────────────────
  async function syncStatus() {
    try {
      const r = await fetch(`${getApi()}/api/timer/status`, { headers: hdr() });
      if (!r.ok) return;
      const timers = await r.json();
      if (timers.length) {
        const t = timers[0];   // most recent
        runningClient = { id: t.client_id, name: t.client_name };
        const sel = document.getElementById('ftClientSelect');
        // pre-select the running client once options are loaded
        const pick = () => {
          if (sel.querySelector(`option[value="${t.client_id}"]`)) {
            sel.value = t.client_id;
          } else { setTimeout(pick, 200); }
        };
        pick();
        if (t.description) document.getElementById('ftDesc').value = t.description;
        setRunning(true, t.client_name, t.started_at);
        setStatus(`Running for ${t.client_name} — client sees this live`, 'ok');
      }
    } catch (_) {}
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  window.qfaTimerStart = async function () {
    const sel    = document.getElementById('ftClientSelect');
    const clientId = sel.value;
    if (!clientId) { setStatus('Please select a client first', 'err'); return; }
    const clientName = sel.options[sel.selectedIndex].textContent;
    const desc   = document.getElementById('ftDesc').value.trim();

    document.getElementById('ftStartBtn').disabled = true;
    setStatus('Starting…');
    try {
      const r = await fetch(`${getApi()}/api/timer/start`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ client_id: clientId, description: desc || null })
      });
      if (!r.ok) {
        const d = await r.json();
        setStatus(d.error || 'Failed to start', 'err');
        document.getElementById('ftStartBtn').disabled = false;
        return;
      }
      const data = await r.json();
      runningClient = { id: clientId, name: clientName };
      setRunning(true, clientName, data.timer.started_at);
    } catch (_) {
      setStatus('Network error', 'err');
      document.getElementById('ftStartBtn').disabled = false;
    }
  };

  // ── Stop ───────────────────────────────────────────────────────────────────
  window.qfaTimerStop = async function () {
    if (!runningClient) return;
    document.getElementById('ftStopBtn').disabled = true;
    setStatus('Stopping…');
    try {
      const r = await fetch(`${getApi()}/api/timer/stop`, {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ client_id: runningClient.id })
      });
      if (!r.ok) {
        const d = await r.json();
        setStatus(d.error || 'Failed to stop', 'err');
        document.getElementById('ftStopBtn').disabled = false;
        return;
      }
      const data = await r.json();
      const h = (data.elapsed_sec / 3600).toFixed(2);
      setRunning(false);
      setStatus(`Stopped · ${fmtElapsed(data.elapsed_sec)} (${h} h) logged`, 'ok');
      runningClient = null;
      document.getElementById('ftStopBtn').disabled = false;
    } catch (_) {
      setStatus('Network error', 'err');
      document.getElementById('ftStopBtn').disabled = false;
    }
  };

  // ── Init ───────────────────────────────────────────────────────────────────
  if (token()) {
    loadClients();
    syncStatus();
  }

})();
