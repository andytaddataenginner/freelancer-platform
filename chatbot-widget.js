/**
 * QFA Chatbot Widget — drop this + chatbot-widget.css into ANY page:
 *
 *   <link rel="stylesheet" href="chatbot-widget.css">
 *   <script src="chatbot-widget.js"></script>
 *
 * Reads token from localStorage key 'token' and sends to /api/chatbot.
 * The API_BASE is auto-detected from the page's meta[name="api-base"] or
 * falls back to a hardcoded Render URL — update FALLBACK_API below.
 */
(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────────────────
  const FALLBACK_API = 'https://freelancer-platform-9jut.onrender.com'; // ← your Render URL
  const getApiBase = () => {
    const meta = document.querySelector('meta[name="api-base"]');
    return (meta && meta.content) ? meta.content : FALLBACK_API;
  };

  // Quick prompts shown as chips in the welcome state
  const QUICK_PROMPTS = [
    'This month summary',
    'Total unpaid',
    'Who owes the most',
    'Total hours this month',
    'Best earning month',
    'Active clients',
    'Payment summary',
    'Upcoming bookings',
    'Help',
  ];

  // ── INJECT HTML ───────────────────────────────────────────────────────────
  const html = `
<div id="qfa-chat-btn" class="qfa-fab" title="Ask QFA Assistant" aria-label="Open chat">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  <span class="qfa-fab-badge" id="qfaBadge" style="display:none">●</span>
</div>

<div id="qfa-chat-panel" class="qfa-panel" role="dialog" aria-label="QFA Assistant">
  <div class="qfa-panel-head">
    <div class="qfa-head-left">
      <div class="qfa-avatar">Q</div>
      <div>
        <strong>QFA Assistant</strong>
        <span id="qfaStatus">Online</span>
      </div>
    </div>
    <button id="qfaClose" class="qfa-icon-btn" aria-label="Close chat">✕</button>
  </div>

  <div class="qfa-messages" id="qfaMessages">
    <div class="qfa-welcome">
      <div class="qfa-welcome-icon">🤖</div>
      <p>Hi! Ask me anything about your earnings, clients, or work logs. Try one of these:</p>
      <div class="qfa-chips" id="qfaChips"></div>
    </div>
  </div>

  <div class="qfa-input-row">
    <input type="text" id="qfaInput" placeholder="Ask me anything…" autocomplete="off" maxlength="200"/>
    <button id="qfaSend" class="qfa-send-btn" aria-label="Send">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
</div>
`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  // ── REFS ──────────────────────────────────────────────────────────────────
  const btn      = document.getElementById('qfa-chat-btn');
  const panel    = document.getElementById('qfa-chat-panel');
  const closeBtn = document.getElementById('qfaClose');
  const messages = document.getElementById('qfaMessages');
  const input    = document.getElementById('qfaInput');
  const sendBtn  = document.getElementById('qfaSend');
  const statusEl = document.getElementById('qfaStatus');
  const badge    = document.getElementById('qfaBadge');
  const chips    = document.getElementById('qfaChips');

  // ── BUILD QUICK-PROMPT CHIPS ──────────────────────────────────────────────
  QUICK_PROMPTS.forEach(p => {
    const c = document.createElement('button');
    c.className = 'qfa-chip';
    c.textContent = p;
    c.addEventListener('click', () => sendMessage(p));
    chips.appendChild(c);
  });

  // ── OPEN / CLOSE ──────────────────────────────────────────────────────────
  let isOpen = false;

  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    btn.classList.add('active');
    badge.style.display = 'none';
    input.focus();
    // restore history from sessionStorage
    const saved = sessionStorage.getItem('qfa_chat_history');
    if (saved && messages.querySelector('.qfa-welcome')) {
      try {
        const hist = JSON.parse(saved);
        if (hist.length) {
          messages.innerHTML = '';
          hist.forEach(m => appendBubble(m.role, m.text, false));
        }
      } catch (_) {}
    }
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
    btn.classList.remove('active');
  }

  btn.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  // ── APPEND BUBBLE ─────────────────────────────────────────────────────────
  function appendBubble(role, text, save = true) {
    // Remove welcome screen on first real message
    const welcome = messages.querySelector('.qfa-welcome');
    if (welcome) welcome.remove();

    const wrap = document.createElement('div');
    wrap.className = `qfa-bubble-wrap ${role}`;

    const bubble = document.createElement('div');
    bubble.className = `qfa-bubble ${role}`;

    // Render **bold** and newlines
    bubble.innerHTML = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;

    // Persist to sessionStorage
    if (save) {
      try {
        const key = 'qfa_chat_history';
        const hist = JSON.parse(sessionStorage.getItem(key) || '[]');
        hist.push({ role, text });
        if (hist.length > 40) hist.splice(0, hist.length - 40);
        sessionStorage.setItem(key, JSON.stringify(hist));
      } catch (_) {}
    }
  }

  // ── LOADING DOTS ──────────────────────────────────────────────────────────
  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'qfa-bubble-wrap bot';
    wrap.id = 'qfaTyping';
    wrap.innerHTML = `<div class="qfa-bubble bot qfa-typing"><span></span><span></span><span></span></div>`;
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }
  function hideTyping() {
    const el = document.getElementById('qfaTyping');
    if (el) el.remove();
  }

  // ── SEND MESSAGE ──────────────────────────────────────────────────────────
  let sending = false;

  async function sendMessage(text) {
    text = (text || input.value).trim();
    if (!text || sending) return;
    input.value = '';

    const token = localStorage.getItem('token');
    if (!token) {
      appendBubble('bot', '🔒 You need to be logged in to use the assistant.');
      return;
    }

    sending = true;
    sendBtn.disabled = true;
    statusEl.textContent = 'Typing…';

    appendBubble('user', text);
    showTyping();

    try {
      const resp = await fetch(`${getApiBase()}/api/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: text })
      });

      hideTyping();

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        appendBubble('bot', `❌ Error: ${err.error || resp.statusText}`);
      } else {
        const data = await resp.json();
        appendBubble('bot', data.reply || '(no response)');

        // If panel is closed, show badge
        if (!isOpen) badge.style.display = 'block';
      }
    } catch (e) {
      hideTyping();
      appendBubble('bot', '⚠️ Could not reach the server. Please try again.');
    } finally {
      sending = false;
      sendBtn.disabled = false;
      statusEl.textContent = 'Online';
    }
  }

  sendBtn.addEventListener('click', () => sendMessage());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

})();
