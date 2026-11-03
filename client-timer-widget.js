(function () {
  'use strict';
  const FALLBACK_API = 'https://freelancer-platform-9jut.onrender.com';
  const getApi = () => {
    const m = document.querySelector('meta[name="api-base"]');
    return m && m.content ? m.content : FALLBACK_API;
  };
  const token = () => localStorage.getItem('token');
  if (!token()) return;

  const style = document.createElement('style');
  style.textContent = `
    #qfaClientTimer {
      position: fixed; bottom: 20px; right: 20px; background: #0f172a; border: 1px solid #334155;
      border-radius: 16px; width: 220px; box-shadow: 0 8px 32px rgba(0,0,0,.45); color: #e2e8f0;
      font-family: system-ui, sans-serif; z-index: 900; display: none; overflow: hidden;
    }
    #qfaClientTimer .ct-header { background: #1e293b; padding: 8px 12px; font-size: .75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; display: flex; align-items: center; gap: 6px; }
    #qfaClientTimer .ct-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
    #qfaClientTimer .ct-dot.paused { background: #f59e0b; }
    #qfaClientTimer .ct-body { padding: 12px; text-align: center; }
    #qfaClientTimer .ct-time { font-size: 1.8rem; font-weight: 800; color: #22c55e; font-family: monospace; }
    #qfaClientTimer .ct-time.paused { color: #f59e0b; }
    #qfaClientTimer .ct-desc { font-size: .75rem; color: #94a3b8; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `;
  document.head.appendChild(style);

  const card = document.createElement('div');
  card.id = 'qfaClientTimer';
  card.innerHTML = `
    <div class="ct-header"><span class="ct-dot" id="ctDot"></span><span id="ctTitle">Live Session</span></div>
    <div class="ct-body">
      <div class="ct-time" id="ctTime">00:00:00</div>
      <div class="ct-desc" id="ctDesc">Freelancer working…</div>
    </div>
  `;
  document.body.appendChild(card);

  let pollInterval = null;
  let localSec = 0;
  let isRunning = false;
  let isPaused = false;
  let timerTicker = null;

  function fmt2(n) { return String(n).padStart(2, '0'); }
  function fmtElapsed(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${fmt2(h)}:${fmt2(m)}:${fmt2(s)}`;
  }

  async function pollStatus() {
    try {
      const r = await fetch(`${getApi()}/api/timer/client-status`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!r.ok) return;
      const data = await r.json();

      if (data.running) {
        card.style.display = 'block';
        isRunning = true;
        isPaused = data.is_paused;
        localSec = data.elapsed_sec || 0;
        document.getElementById('ctDesc').textContent = data.description || 'Freelancer working…';

        const dot = document.getElementById('ctDot');
        const timeEl = document.getElementById('ctTime');
        const titleEl = document.getElementById('ctTitle');

        if (isPaused) {
          dot.className = 'ct-dot paused';
          timeEl.className = 'ct-time paused';
          titleEl.textContent = 'Session Paused';
          if (timerTicker) { clearInterval(timerTicker); timerTicker = null; }
        } else {
          dot.className = 'ct-dot';
          timeEl.className = 'ct-time';
          titleEl.textContent = 'Live Session';
          if (!timerTicker) {
            timerTicker = setInterval(() => {
              localSec++;
              timeEl.textContent = fmtElapsed(localSec);
            }, 1000);
          }
        }
        timeEl.textContent = fmtElapsed(localSec);
      } else {
        card.style.display = 'none';
        isRunning = false;
        if (timerTicker) { clearInterval(timerTicker); timerTicker = null; }
      }
    } catch (_) {}
  }

  pollStatus();
  pollInterval = setInterval(pollStatus, 4000);
})();
