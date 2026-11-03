/**
 * client-portal-data.js
 * Automatically loads read-only Projects and Client Notes into the client dashboard.
 */
(function () {
  'use strict';

  const FALLBACK_API = 'https://freelancer-platform-9jut.onrender.com';
  const getApi = () => {
    const m = document.querySelector('meta[name="api-base"]');
    return m && m.content ? m.content : FALLBACK_API;
  };
  const token = () => localStorage.getItem('token');

  if (!token()) return;

  // ── Inject Styles for Read-Only Cards ──────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .qfa-portal-section {
      margin-top: 30px;
      font-family: system-ui, sans-serif;
    }
    .qfa-portal-section h3 {
      font-size: 1.1rem;
      color: #0f172a;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .qfa-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .qfa-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      position: relative;
    }
    .qfa-card-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: #1e293b;
      margin-bottom: 6px;
    }
    .qfa-card-desc {
      font-size: 0.84rem;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 12px;
    }
    .qfa-badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-active { background: #dcfce7; color: #15803d; }
    .badge-paused { background: #fef9c3; color: #a16207; }
    .badge-completed { background: #e0f2fe; color: #0369a1; }
    .badge-category { background: #f1f5f9; color: #475569; }
    .qfa-meta {
      font-size: 0.75rem;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
    }
  `;
  document.head.appendChild(style);

  // ── Fetch & Render Projects ────────────────────────────────────────────────
  async function loadClientProjects() {
    try {
      const res = await fetch(`${getApi()}/api/client/projects`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) return;
      const projects = await res.json();

      let container = document.getElementById('qfaProjectsContainer');
      if (!container) return; // If container doesn't exist on page, skip

      if (!projects.length) {
        container.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem;">No active projects found.</p>`;
        return;
      }

      container.innerHTML = `
        <div class="qfa-portal-section">
          <h3>📁 Active Projects</h3>
          <div class="qfa-grid">
            ${projects.map(p => `
              <div class="qfa-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="qfa-card-title">${escapeHtml(p.name)}</div>
                  <span class="qfa-badge badge-${p.status || 'active'}">${p.status || 'active'}</span>
                </div>
                <div class="qfa-card-desc">${escapeHtml(p.description || 'No description provided.')}</div>
                <div class="qfa-meta">
                  <span>Deadline: ${p.deadline ? new Date(p.deadline).toLocaleDateString() : 'None'}</span>
                  <span>Managed by ${escapeHtml(p.freelancer_name)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (_) {}
  }

  // ── Fetch & Render Notes ───────────────────────────────────────────────────
  async function loadClientNotes() {
    try {
      const res = await fetch(`${getApi()}/api/client/notes`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) return;
      const notes = await res.json();

      let container = document.getElementById('qfaNotesContainer');
      if (!container) return;

      if (!notes.length) return;

      container.innerHTML = `
        <div class="qfa-portal-section">
          <h3>📌 Project Guidelines & Notes</h3>
          <div class="qfa-grid">
            ${notes.map(n => `
              <div class="qfa-card" ${n.is_pinned ? 'style="border-color: #cbd5e1; background: #f8fafc;"' : ''}>
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="qfa-card-title">${escapeHtml(n.title)}</div>
                  <span class="qfa-badge badge-category">${escapeHtml(n.category)}</span>
                </div>
                <div class="qfa-card-desc">${escapeHtml(n.content)}</div>
                <div class="qfa-meta">
                  <span>${n.is_pinned ? '★ Pinned Note' : ''}</span>
                  <span>Added by ${escapeHtml(n.freelancer_name)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadClientProjects();
    loadClientNotes();
  });
})();
