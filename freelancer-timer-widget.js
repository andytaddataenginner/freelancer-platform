(function () {
  'use strict';

  const FALLBACK_API = 'https://freelancer-platform-9jut.onrender.com';
  const getApi = () => {
    const m = document.querySelector('meta[name="api-base"]');
    return m && m.content ? m.content : FALLBACK_API;
  };
  const token = () => localStorage.getItem('token');
  const hdr   = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  const style = document.createElement('style');
  style.textContent = `
    #qfaFreelancerTimer {
      position: fixed; bottom: 90px; right: 20px; background: #0f172a; color: #e2e8f0;
      border: 1px solid #334155; border-radius: 16px; width: 280px; box-shadow: 0 8px 32px rgba(0,0,0,.45);
      font-family: system-ui, sans-serif; font-size: .9rem; z-index: 900; overflow: hidden;
    }
    #qfaFreelancerTimer .ft-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: #1e293b; border-bottom: 1px solid #334155; cursor: pointer; }
    #qfaFreelancerTimer .ft-title { font-weight: 700; font-size: .85rem; flex: 1; text-transform: uppercase; color: #94a3b8; }
    #qfaFreelancerTimer .ft-dot { width: 8px; height: 8px; border-radius: 50%; background: #475569; }
    #qfaFreelancerTimer .ft-dot.running { background: #22c55e; }
    #qfaFreelancerTimer .ft-dot.paused { background: #f59e0b; }
    #qfaFreelancerTimer .ft-body { padding: 14px; }
    #qfaFreelancerTimer .ft-elapsed { font-size: 2rem; font-weight: 800; text-align: center; padding: 8px 0 12px; color: #e2e8f0; font-family: monospace; }
    #qfaFreelancerTimer select, #qfaFreelancerTimer input[type=text] { width: 100%; background: #1e293b; border: 1px solid #334155; color: #e2e8f0; border-radius: 8px; padding: 8px; font-size: .85rem; margin-bottom: 8px; }
    #qfaFreelancerTimer .ft-btn { width: 100%; padding: 10px; border-radius: 10px; font-weight: 700; cursor: pointer; border: none; margin-top: 4px; }
    #qfaFreelancerTimer .ft-btn-start { background: #16a34a; color: #fff; }
    #qfaFreelancerTimer .ft-btn-pause { background: #d97706; color: #fff; }
    #qfaFreelancerTimer .ft-btn-resume { background: #2563eb; color: #fff; }
    #qfaFreelancerTimer .ft-btn-stop { background: #dc2626; color: #fff; }
    #qfaFreelancerTimer .ft-status { font-size: .75rem; color: #94a3b8; text-align: center; margin-top: 8px; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'qfaFreelancerTimer';
  panel.innerHTML = `
    <div class="ft-header" id="ftHeader">
      <span class="ft-dot" id="ftDot"></span>
      <span class="ft-title">Live Timer</span>
    </div>
    <div class="ft-body" id="ftBody">
      <div class="ft-elapsed" id="ftElapsed">00:00:00</div>
      <select id="ftClientSelect"><option value="">Loading clients…</option></select>
      <input type="text" id="ftDesc" placeholder="Description" maxlength="120" />
      <button class="ft-btn ft-btn-start" id="ftStartBtn" onclick="qfaTimerStart()">▶ Start Timer</button>
      <button class="ft-btn ft-btn-pause" id="ftPauseBtn" onclick="qfaTimerPause()" style="display:none">⏸ Pause Timer</button>
      <button class="ft-btn ft-btn-resume" id="ftResumeBtn" onclick="qfaTimerResume()" style="display:none">▶ Resume Timer</button>
      <button class="ft-btn ft-btn-stop" id="ftStopBtn" onclick="qfaTimerStop()" style="display:none">■ Stop & Save</button>
      <div class="ft-status" id="ftStatus"></div>
    </div>
  `;
  document.body.appendChild(panel);

  let tickInterval = null;
  let accumulatedSec = 0;
  let runningClient = null;
  let isPausedState = false;

  function fmt2(n) { return String(n).padStart(2, '0'); }
  function fmtElapsed(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${fmt2(h)}:${fmt2(m)}:${fmt2(s)}`;
  }

  function setStatus(msg) { document.getElementById('ftStatus').textContent = msg; }

  async function loadClients() {
    try {
      const r = await fetch(`${getApi()}/api/clients`, { headers: hdr() });
      const clients = await r.json();
      const sel = document.getElementById('ftClientSelect');
      sel.innerHTML = '<option value="">— Select client —</option>';
      clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.user_id || c.id;
        opt.textContent = c.name + (c.company ? ` · ${c.company}` : '');
        sel.appendChild(opt);
      });
    } catch (_) {}
  }

  async function syncStatus() {
    try {
      const r = await fetch(`${getApi()}/api/timer/status`, { headers: hdr() });
      const timers = await r.json();
      if (timers.length) {
        const t = timers[0];
        runningClient = { id: t.client_id, name: t.client_name };
        accumulatedSec = t.elapsed_sec || 0;
        isPausedState = t.is_paused;
        document.getElementById('ftClientSelect').value = t.client_id;
        if (t.description) document.getElementById('ftDesc').value = t.description;
        updateUI(true, isPausedState);
      }
    } catch (_) {}
  }

  function updateUI(running, paused) {
    const dot = document.getElementById('ftDot');
    const startBtn = document.getElementById('ftStartBtn');
    const pauseBtn = document.getElementById('ftPauseBtn');
    const resumeBtn = document.getElementById('ftResumeBtn');
    const stopBtn = document.getElementById('ftStopBtn');
    const sel = document.getElementById('ftClientSelect');

    if (!running) {
      dot.className = 'ft-dot';
      startBtn.style.display = '';
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = 'none';
      stopBtn.style.display = 'none';
      sel.disabled = false;
      if (tickInterval) clearInterval(tickInterval);
      document.getElementById('ftElapsed').textContent = '00:00:00';
      setStatus('Ready');
    } else if (paused) {
      dot.className = 'ft-dot paused';
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = '';
      stopBtn.style.display = '';
      sel.disabled = true;
      if (tickInterval) clearInterval(tickInterval);
      setStatus('Timer paused');
    } else {
      dot.className = 'ft-dot running';
      startBtn.style.display = 'none';
      pauseBtn.style.display = '';
      resumeBtn.style.display = 'none';
      stopBtn.style.display = '';
      sel.disabled = true;
      if (tickInterval) clearInterval(tickInterval);
      tickInterval = setInterval(() => {
        accumulatedSec++;
        document.getElementById('ftElapsed').textContent = fmtElapsed(accumulatedSec);
      }, 1000);
      setStatus('Running live…');
    }
    document.getElementById('ftElapsed').textContent = fmtElapsed(accumulatedSec);
  }

  window.qfaTimerStart = async function () {
    const cid = document.getElementById('ftClientSelect').value;
    if (!cid) return setStatus('Select a client');
    const desc = document.getElementById('ftDesc').value.trim();
    const r = await fetch(`${getApi()}/api/timer/start`, {
      method: 'POST', headers: hdr(), body: JSON.stringify({ client_id: cid, description: desc })
    });
    if (r.ok) {
      runningClient = { id: cid };
      accumulatedSec = 0;
      isPausedState = false;
      updateUI(true, false);
    }
  };

  window.qfaTimerPause = async function () {
    if (!runningClient) return;
    const r = await fetch(`${getApi()}/api/timer/pause`, {
      method: 'POST', headers: hdr(), body: JSON.stringify({ client_id: runningClient.id })
    });
    if (r.ok) {
      const data = await r.json();
      accumulatedSec = data.elapsed_sec;
      isPausedState = true;
      updateUI(true, true);
    }
  };

  window.qfaTimerResume = async function () {
    if (!runningClient) return;
    const r = await fetch(`${getApi()}/api/timer/resume`, {
      method: 'POST', headers: hdr(), body: JSON.stringify({ client_id: runningClient.id })
    });
    if (r.ok) {
      isPausedState = false;
      updateUI(true, false);
    }
  };

  window.qfaTimerStop = async function () {
    if (!runningClient) return;
    const r = await fetch(`${getApi()}/api/timer/stop`, {
      method: 'POST', headers: hdr(), body: JSON.stringify({ client_id: runningClient.id })
    });
    if (r.ok) {
      const data = await r.json();
      alert(`Timer saved! Logged ${data.hours} hours.`);
      runningClient = null;
      accumulatedSec = 0;
      updateUI(false, false);
    }
  };

  if (token()) { loadClients(); syncStatus(); }
})();
