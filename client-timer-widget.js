/**
 * client-timer-widget.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop on the CLIENT dashboard page — READ-ONLY live timer view.
 *
 *   <script src="../client-timer-widget.js"></script>
 *
 * How it works:
 *  • Opens an SSE connection to GET /api/timer/watch?token=<JWT>
 *  • Server pushes "started" when the freelancer starts the timer
 *  • Server pushes "stopped" when the freelancer stops
 *  • Client sees a live ticking clock — ZERO controls (watch only)
 *  • Falls back to polling GET /api/timer/client-status every 5s if SSE fails
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

  // Only inject for logged-in clients
  if (!token()) return;

  // ── Inject styles ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #qfaClientTimer {
      position: fixed;
      bottom: 90px; right: 20px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 16px;
      width: 240px;
      box-shadow: 0 8px 32px rgba(0,0,0,.45);
      font-family: system-ui, sans-serif;
      color: #e2e8f0;
      z-index: 900;
      display: none;           /* hidden when no timer is running */
      overflow: hidden;
      animation: ctSlideIn .3s ease;
    }
    @keyframes ctSlideIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #qfaClientTimer .ct-header {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 10px 14px;
      display: flex; align-items: center; gap: 8px;
    }
    #qfaClientTimer .ct-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #22c55e; flex-shrink: 0;
      animation: ctPulse 1.4s ease-in-out infinite;
    }
    @keyframes ctPulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:.35; transform:scale(1.5); }
    }
    #qfaClientTimer .ct-label {
      font-size: .72rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: .08em;
      color: #94a3b8;
    }
    #qfaClientTimer .ct-badge {
      margin-left: auto;
      font-size: .65rem; padding: 2px 7px;
      background: #1a2e1a; color: #22c55e;
      border-radius: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .06em;
    }
    #qfaClientTimer .ct-body {
      padding: 14px;
      text-align: center;
    }
    #qfaClientTimer .ct-time {
      font-size: 2.2rem; font-weight: 800;
      letter-spacing: .04em;
      font-variant-numeric: tabular-nums;
      color: #22c55e;
      line-height: 1;
      margin-bottom: 8px;
    }
    #qfaClientTimer .ct-desc {
      font-size: .78rem; color: #94a3b8;
      white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px; margin: 0 auto;
    }
    #qfaClientTimer .ct-note {
      font-size: .68rem; color: #475569;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #1e293b;
    }
  `;
  document.head.appendChild(style);

  // ── Inject HTML ────────────────────────────────────────────────────────────
  const card = document.createElement('div');
  card.id = 'qfaClientTimer';
  card.innerHTML = `
    <div class="ct-header">
      <span class="ct-dot"></span>
      <span class="ct-label">Live Session</span>
      <span class="ct-badge">LIVE</span>
    </div>
    <div class="ct-body">
      <div class="ct-time" id="ctTime">00:00:00</div>
      <div class="ct-desc" id="ctDesc">Your freelancer is working…</div>
      <div class="ct-note">View only — your freelancer controls the timer</div>
    </div>
  `;
  document.body.appendChild(card);

  // ── Helpers ────────────────────────────────────────────────────────────────
  let startedAt    = null;
  let tickInterval = null;
  let eventSource  = null;
  let pollInterval = null;

  function fmt2(n) { return String(n).padStart(2, '0'); }
  function fmtElapsed(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${fmt2(h)}:${fmt2(m)}:${fmt2(s)}`;
  }

  function showTimer(desc) {
    card.style.display = '';
    document.getElementById('ctDesc').textContent = desc || 'Your freelancer is working…';
  }

  function hideTimer() {
    card.style.display = 'none';
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    startedAt = null;
  }

  function startTick(startedAtStr) {
    if (tickInterval) clearInterval(tickInterval);
    startedAt = new Date(startedAtStr).getTime();
    // Immediately set the current elapsed so there's no 1-second lag
    const sec0 = Math.floor((Date.now() - startedAt) / 1000);
    document.getElementById('ctTime').textContent = fmtElapsed(sec0);
    tickInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      document.getElementById('ctTime').textContent = fmtElapsed(elapsed);
    }, 1000);
  }

  // ── Handle incoming event (shared between SSE and poll) ────────────────────
  function handleEvent(data) {
    if (data.event === 'started' || (data.event === 'sync' && data.is_running)) {
      showTimer(data.description);
      startTick(data.started_at);
    } else if (data.event === 'stopped' || data.event === 'idle') {
      hideTimer();
    }
  }

  // ── SSE connection ─────────────────────────────────────────────────────────
  function connectSSE() {
    if (eventSource) { eventSource.close(); eventSource = null; }

    const url = `${getApi()}/api/timer/watch?token=${encodeURIComponent(token())}`;
    eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      try { handleEvent(JSON.parse(e.data)); } catch (_) {}
    };

    eventSource.onerror = () => {
      // SSE failed — clean up and fall back to polling
      eventSource.close();
      eventSource = null;
      if (!pollInterval) startPolling();
    };
  }

  // ── Polling fallback (every 5 s) ───────────────────────────────────────────
  async function poll() {
    try {
      const r = await fetch(`${getApi()}/api/timer/client-status`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!r.ok) return;
      const data = await r.json();
      if (data.running) {
        showTimer(data.description);
        // Only reset the tick if we weren't already ticking from this session
        if (!startedAt) startTick(data.started_at);
      } else {
        hideTimer();
      }
    } catch (_) {}
  }

  function startPolling() {
    poll(); // immediate check
    pollInterval = setInterval(poll, 5000);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  if (typeof EventSource !== 'undefined') {
    connectSSE();
  } else {
    startPolling();
  }

  // Reconnect SSE when tab becomes visible again after being in background
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof EventSource !== 'undefined' && !eventSource) {
      // Stop polling if it was running as fallback
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      connectSSE();
    }
  });

})();
