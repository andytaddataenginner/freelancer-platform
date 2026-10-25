/**
 * QFA Chatbot Widget — menu-driven floating assistant (Role-Aware)
 */
(function () {
  'use strict';

  const FALLBACK_API = 'https://freelancer-platform-9jut.onrender.com'; // ← your Render URL
  const getApiBase = () => {
    const meta = document.querySelector('meta[name="api-base"]');
    return (meta && meta.content) ? meta.content : FALLBACK_API;
  };

  // ── ROLE DETECTION ────────────────────────────────────────────────────────
  function getUserRole() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return 'freelancer';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || 'freelancer';
    } catch (_) { return 'freelancer'; }
  }

  // ── MENU STRUCTURES ───────────────────────────────────────────────────────
  const MENU_FREELANCER = [
    {
      category: '💰 Earnings',
      items: [
        { label: 'This month summary',  prompt: 'This month summary' },
        { label: 'Last month',          prompt: 'Last month earnings' },
        { label: 'Earnings by month',   prompt: 'Earnings by month' },
        { label: 'Best earning month',  prompt: 'Best earning month' },
        { label: 'All-time paid',       prompt: 'Total paid earnings' },
      ]
    },
    {
      category: '⏳ Outstanding',
      items: [
        { label: 'Total unpaid',        prompt: 'Total unpaid' },
        { label: 'Fixed due',           prompt: 'Fixed due' },
        { label: 'Hourly due',          prompt: 'Hourly due' },
        { label: 'Who owes the most',   prompt: 'Who owes the most' },
        { label: 'Overdue summary',     prompt: 'Overdue summary' },
      ]
    },
    {
      category: '👥 Clients',
      items: [
        { label: 'Client summary',      prompt: 'Client summary' },
        { label: 'Active clients',      prompt: 'Active clients' },
        { label: 'Fixed-rate clients',  prompt: 'Fixed clients' },
        { label: 'Hourly clients',      prompt: 'Hourly clients' },
        { label: 'Top client',          prompt: 'Top client' },
        { label: 'How many clients',    prompt: 'How many clients' },
      ]
    },
    {
      category: '📋 Work & Logs',
      items: [
        { label: 'Hours this month',    prompt: 'Total hours this month' },
        { label: 'Total hours logged',  prompt: 'Total hours logged' },
        { label: 'Recent logs',         prompt: 'Recent logs' },
        { label: 'Upcoming bookings',   prompt: 'Upcoming bookings' },
      ]
    },
    {
      category: '📊 Reports',
      items: [
        { label: 'Payment summary',     prompt: 'Payment summary' },
        { label: 'Paused clients',      prompt: 'Paused clients' },
      ]
    },
  ];

  const MENU_CLIENT = [
    {
      category: '💳 Billing',
      items: [
        { label: 'Total unpaid',          prompt: 'Total unpaid' },
        { label: 'Total paid',            prompt: 'Total paid' },
        { label: 'Billing history',       prompt: 'Billing history' },
        { label: 'Fixed invoices',        prompt: 'Fixed invoices' },
        { label: 'Last invoice',          prompt: 'Last invoice' },
      ]
    },
    {
      category: '⏱️ Time & Hours',
      items: [
        { label: 'Hours this month',      prompt: 'My hours this month' },
        { label: 'Total hours',           prompt: 'Total hours' },
        { label: 'Recent logs',           prompt: 'Recent logs' },
      ]
    },
    {
      category: '📅 Bookings',
      items: [
        { label: 'Upcoming sessions',     prompt: 'Upcoming bookings' },
        { label: 'Session history',       prompt: 'Booking history' },
      ]
    },
    {
      category: '📊 Reports',
      items: [
        { label: 'Month I paid most',     prompt: 'Month I paid most' },
        { label: 'Payments by month',     prompt: 'Payment by month' },
        { label: 'My contract',           prompt: 'My contract' },
      ]
    },
    {
      category: '🗂️ Activity',
      items: [
        { label: 'Recent activity',       prompt: 'Recent activity' },
        { label: 'My tasks',              prompt: 'My tasks' },
      ]
    },
  ];

  const MENU = getUserRole() === 'client' ? MENU_CLIENT : MENU_FREELANCER;

  // ── INJECT HTML ───────────────────────────────────────────────────────────
  const html = `
<div id="qfaFab" class="qfa-fab" title="QFA Assistant" aria-label="Open chat">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  <span class="qfa-fab-badge" id="qfaBadge" style="display:none">●</span>
</div>

<div id="qfaPanel" class="qfa-panel" role="dialog" aria-label="QFA Assistant">
  <!-- Header -->
  <div class="qfa-head">
    <div class="qfa-head-left">
      <div class="qfa-avatar">Q</div>
      <div>
        <strong>QFA Assistant</strong>
        <span id="qfaStatus">Online</span>
      </div>
    </div>
    <div class="qfa-head-right">
      <button id="qfaMenuToggle" class="qfa-icon-btn" title="Show menu">☰</button>
      <button id="qfaClear"      class="qfa-icon-btn" title="Clear chat">🗑</button>
      <button id="qfaClose"      class="qfa-icon-btn" title="Close">✕</button>
    </div>
  </div>

  <!-- Two-pane body: menu sidebar + messages -->
  <div class="qfa-body">
    <!-- LEFT: menu -->
    <div class="qfa-menu" id="qfaMenu">
      <div class="qfa-menu-inner" id="qfaMenuInner"></div>
    </div>

    <!-- RIGHT: conversation -->
    <div class="qfa-right">
      <div class="qfa-messages" id="qfaMessages">
        <div class="qfa-welcome">
          <div class="qfa-welcome-icon">🤖</div>
          <p id="qfaWelcomeMsg">Pick a topic from the menu, or type your question below.</p>
        </div>
      </div>
      <!-- Input -->
      <div class="qfa-input-row">
        <input type="text" id="qfaInput" placeholder="Or type a question…" autocomplete="off" maxlength="200"/>
        <button id="qfaSend" class="qfa-send-btn" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>
`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  // ── REFS ──────────────────────────────────────────────────────────────────
  const fab         = document.getElementById('qfaFab');
  const panel       = document.getElementById('qfaPanel');
  const closeBtn    = document.getElementById('qfaClose');
  const clearBtn    = document.getElementById('qfaClear');
  const menuToggle  = document.getElementById('qfaMenuToggle');
  const menuEl      = document.getElementById('qfaMenu');
  const menuInner   = document.getElementById('qfaMenuInner');
  const messages    = document.getElementById('qfaMessages');
  const input       = document.getElementById('qfaInput');
  const sendBtn     = document.getElementById('qfaSend');
  const statusEl    = document.getElementById('qfaStatus');
  const badge       = document.getElementById('qfaBadge');

  // ── BUILD MENU ────────────────────────────────────────────────────────────
  MENU.forEach(cat => {
    const section = document.createElement('div');
    section.className = 'qfa-menu-section';

    const heading = document.createElement('div');
    heading.className = 'qfa-menu-cat';
    heading.textContent = cat.category;
    section.appendChild(heading);

    cat.items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'qfa-menu-btn';
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.qfa-menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sendMessage(item.prompt);
        if (window.innerWidth < 560) menuEl.classList.remove('open');
      });
      section.appendChild(btn);
    });

    menuInner.appendChild(section);
  });

  // ── OPEN / CLOSE ──────────────────────────────────────────────────────────
  let isOpen = false;

  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    fab.classList.add('active');
    badge.style.display = 'none';
    const wm = document.getElementById('qfaWelcomeMsg');
    if (wm) {
      wm.textContent = getUserRole() === 'client'
        ? 'Pick a topic from the menu to check your billing, hours, bookings and more.'
        : 'Pick a topic from the menu, or type your question below.';
    }
    restoreHistory();
    input.focus();
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
    fab.classList.remove('active');
  }

  fab.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closePanel(); });

  menuToggle.addEventListener('click', () => menuEl.classList.toggle('open'));

  clearBtn.addEventListener('click', () => {
    sessionStorage.removeItem('qfa_chat_history');
    messages.innerHTML = `<div class="qfa-welcome"><div class="qfa-welcome-icon">🤖</div><p>Pick a topic from the menu, or type your question below.</p></div>`;
    document.querySelectorAll('.qfa-menu-btn').forEach(b => b.classList.remove('active'));
  });

  // ── SESSION HISTORY ───────────────────────────────────────────────────────
  function saveHistory(role, text) {
    try {
      const hist = JSON.parse(sessionStorage.getItem('qfa_chat_history') || '[]');
      hist.push({ role, text });
      if (hist.length > 40) hist.splice(0, hist.length - 40);
      sessionStorage.setItem('qfa_chat_history', JSON.stringify(hist));
    } catch (_) {}
  }

  function restoreHistory() {
    try {
      const hist = JSON.parse(sessionStorage.getItem('qfa_chat_history') || '[]');
      if (!hist.length) return;
      messages.innerHTML = '';
      hist.forEach(m => appendBubble(m.role, m.text, false));
    } catch (_) {}
  }

  // ── BUBBLE ────────────────────────────────────────────────────────────────
  function appendBubble(role, text, save = true) {
    const welcome = messages.querySelector('.qfa-welcome');
    if (welcome) welcome.remove();

    const wrap = document.createElement('div');
    wrap.className = `qfa-bwrap ${role}`;

    const bubble = document.createElement('div');
    bubble.className = `qfa-bubble ${role}`;
    bubble.innerHTML = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;

    if (save) saveHistory(role, text);
  }

  // ── TYPING INDICATOR ──────────────────────────────────────────────────────
  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'qfa-bwrap bot';
    wrap.id = 'qfaTyping';
    wrap.innerHTML = `<div class="qfa-bubble bot qfa-typing"><span></span><span></span><span></span></div>`;
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }
  function hideTyping() {
    const el = document.getElementById('qfaTyping');
    if (el) el.remove();
  }

  // ── SEND ──────────────────────────────────────────────────────────────────
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
        appendBubble('bot', `❌ Error ${resp.status}: ${err.error || resp.statusText}`);
      } else {
        const data = await resp.json();
        appendBubble('bot', data.reply || '(empty response)');
        if (!isOpen) badge.style.display = 'block';
      }
    } catch (e) {
      hideTyping();
      appendBubble('bot', '⚠️ Could not reach the server. Check your connection or try again in a moment.');
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
