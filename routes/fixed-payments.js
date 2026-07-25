<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reports & Analytics — QFA</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #0d2353; --navy2: #1a3a7a; --navy-deep: #071633; --accent: #1a5cff; --gold2: #c9a44c;
      --white: #fff; --bg: #f4f6fb; --bg2: #eef1f8;
      --ink: #0d2353; --ink2: #3a4a6a; --ink3: #7a8aaa;
      --green: #10b981; --amber: #f59e0b;
      --hairline: rgba(201,164,76,0.25);
      --sans: 'Outfit', system-ui, sans-serif;
      --serif: 'Playfair Display', serif;
      --mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      --radius: 16px; --shadow: 0 4px 30px rgba(13,35,83,0.06);
    }
    html, body { font-family: var(--sans); background: var(--bg); color: var(--ink); }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
    }

    a:focus-visible, button:focus-visible, input:focus-visible {
      outline: 2px solid var(--gold2);
      outline-offset: 2px;
    }

    /* ── LAYOUT ── */
    .layout { display: flex; min-height: 100vh; }

    /* ── SIDEBAR ── */
    .sidebar {
      width: 220px; background: var(--navy); position: fixed;
      top: 0; left: 0; height: 100vh; display: flex;
      flex-direction: column; z-index: 50;
      transition: transform 0.3s ease;
    }
    .sidebar-brand {
      padding: 1.1rem 1.2rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex; align-items: center; gap: 0.6rem;
    }
    .brand-logo { width: 36px; height: 36px; background: white; border-radius: 8px; overflow: hidden; padding: 3px; flex-shrink: 0; }
    .brand-logo img { width: 100%; height: 100%; object-fit: contain; }
    .brand-text strong { display: block; color: white; font-size: 0.78rem; font-weight: 700; }
    .brand-text span { font-size: 0.62rem; color: var(--gold2); text-transform: uppercase; letter-spacing: 0.08em; }

    .sidebar-nav { flex: 1; padding: 0.8rem 0; overflow-y: auto; }
    .sidebar-nav a {
      display: flex; align-items: center; gap: 0.7rem;
      padding: 0.7rem 1.2rem; font-size: 0.85rem; font-weight: 500;
      color: rgba(255,255,255,0.55); text-decoration: none;
      transition: all 0.2s; border-right: 3px solid transparent;
    }
    .sidebar-nav a:hover { color: white; background: rgba(255,255,255,0.06); }
    .sidebar-nav a.active { color: white; background: rgba(26,92,255,0.2); border-right-color: var(--gold2); }

    .sidebar-user {
      padding: 1rem 1.2rem;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 0.8rem;
    }
    .sidebar-user strong { display: block; color: white; margin-bottom: 0.1rem; }
    .sidebar-user span { color: rgba(255,255,255,0.4); font-size: 0.72rem; }
    .sidebar-user a { display: block; margin-top: 0.4rem; font-size: 0.75rem; color: var(--gold2); text-decoration: none; }

    /* ── MOBILE NAV ── */
    .mobile-header {
      display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 60;
      background: var(--navy); padding: 0.8rem 1rem;
      align-items: center; justify-content: space-between;
      box-shadow: 0 2px 12px rgba(13,35,83,0.2);
    }
    .mobile-logo { display: flex; align-items: center; gap: 0.5rem; }
    .mobile-logo img { height: 32px; background: white; border-radius: 6px; padding: 2px; }
    .mobile-logo span { color: white; font-size: 0.85rem; font-weight: 700; }
    .hamburger-btn {
      background: rgba(255,255,255,0.1); border: none; color: white;
      width: 36px; height: 36px; border-radius: 8px; font-size: 1.1rem;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .sidebar-overlay {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 45;
    }
    .sidebar-overlay.open { display: block; }
    .sidebar.mobile-open { transform: translateX(0) !important; }

    /* ── MAIN ── */
    .main { margin-left: 220px; flex: 1; min-height: 100vh; display: flex; flex-direction: column; }

    .topbar {
      background: white; border-bottom: 1px solid rgba(13,35,83,0.08);
      padding: 1rem 1.5rem; position: sticky; top: 0; z-index: 40;
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 0.75rem;
    }
    .topbar h2 { font-family: var(--serif); font-size: 1.4rem; }
    .topbar-control { display: flex; align-items: center; gap: 0.7rem; }
    .topbar-control-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink3); font-weight: 600; }
    .content { padding: 1.5rem; flex: 1; }

    .global-summary {
      position: relative;
      overflow: hidden;
      background: linear-gradient(155deg, var(--navy) 0%, var(--navy-deep) 100%);
      border-radius: var(--radius);
      padding: 1.75rem 2rem;
      margin-bottom: 1.75rem;
      box-shadow: 0 20px 50px -16px rgba(7,22,51,0.5);
      border: 1px solid var(--hairline);
      color: #eef1fb;
      animation: statement-in 0.7s cubic-bezier(.16,1,.3,1) both;
    }
    @media (prefers-reduced-motion: reduce) { .global-summary { animation: none; } }
    @keyframes statement-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .ledger-texture {
      position: absolute; inset: 0; pointer-events: none;
      background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 13px);
    }
    .ledger-glow {
      position: absolute; top: -60px; right: -60px; width: 260px; height: 260px;
      background: radial-gradient(circle, rgba(201,164,76,0.22), transparent 70%);
      pointer-events: none;
    }

    .statement-head {
      position: relative; z-index: 1;
      display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;
      margin-bottom: 1.5rem; padding-bottom: 1rem;
      border-bottom: 1px solid var(--hairline);
    }
    .ledger-eyebrow {
      font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase;
      color: var(--gold2); font-weight: 600; display: flex; align-items: center;
    }
    .ledger-eyebrow::before {
      content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%;
      background: var(--gold2); margin-right: 0.55rem;
    }
    .ledger-asof { font-family: var(--mono); font-size: 0.72rem; color: rgba(238,241,251,0.5); }

    .statement-body {
      position: relative; z-index: 1;
      display: flex; gap: 2.5rem; align-items: stretch; flex-wrap: wrap;
    }

    .statement-hero {
      flex: 1 1 220px;
      display: flex; flex-direction: column; justify-content: center;
      padding-right: 2.5rem;
      border-right: 1px solid var(--hairline);
      min-width: 220px;
    }
    .statement-hero-label {
      font-size: 0.78rem; color: rgba(238,241,251,0.55);
      text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500; margin-bottom: 0.35rem;
    }
    .statement-hero-value {
      font-family: var(--mono); font-weight: 600; letter-spacing: -0.01em; line-height: 1;
      font-size: clamp(2rem, 4vw, 2.65rem);
      color: var(--gold2);
      background: linear-gradient(120deg, #f4dea0, var(--gold2) 70%);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    }
    .statement-hero-split { display: flex; gap: 1.1rem; margin-top: 0.9rem; font-size: 0.8rem; flex-wrap: wrap; }
    .statement-hero-split .split-item { display: flex; align-items: center; gap: 0.4rem; color: rgba(238,241,251,0.75); }
    .statement-hero-split .split-item b { font-family: var(--mono); font-weight: 600; }
    .split-item i { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .split-paid i { background: var(--green); }
    .split-paid b { color: var(--green); }
    .split-unpaid i { background: var(--amber); }
    .split-unpaid b { color: var(--amber); }

    .statement-stats {
      flex: 1 1 320px;
      display: grid; grid-template-columns: repeat(2, 1fr);
      border-top: 1px solid var(--hairline); border-left: 1px solid var(--hairline);
      align-content: center;
    }
    .stat-cell {
      padding: 0.95rem 1.4rem;
      border-right: 1px solid var(--hairline); border-bottom: 1px solid var(--hairline);
      display: flex; flex-direction: column; justify-content: center; gap: 0.3rem;
    }
    .stat-cell span {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em;
      color: rgba(238,241,251,0.5); font-weight: 500;
    }
    .stat-cell strong { font-family: var(--mono); font-size: 1.2rem; font-weight: 600; color: #f5f7fd; }

    @media (max-width: 700px) {
      .statement-hero { border-right: none; border-bottom: 1px solid var(--hairline); padding-right: 0; padding-bottom: 1.25rem; }
    }

    /* ── CARDS & METRICS ── */
    .card {
      background: white; border-radius: 18px; padding: 1.5rem;
      box-shadow: 0 10px 30px -14px rgba(13,35,83,0.14), 0 2px 8px -3px rgba(13,35,83,0.06);
      border: 1px solid rgba(13,35,83,0.05); margin-bottom: 1.5rem; position: relative;
      transition: box-shadow 0.25s ease, transform 0.25s ease;
    }
    .card:hover { box-shadow: 0 18px 40px -16px rgba(13,35,83,0.2); transform: translateY(-2px); }

    .card-header {
      padding-bottom: 1rem; border-bottom: 1px solid var(--bg2); margin-bottom: 1.1rem;
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; position: relative;
    }
    .card-header::after {
      content: ''; position: absolute; left: 0; bottom: -1px; width: 44px; height: 2px; background: var(--gold2);
    }
    .card-header-text { display: flex; flex-direction: column; gap: 0.3rem; }
    .card-header h3 { font-size: 1rem; font-weight: 700; font-family: var(--serif); color: var(--navy); display: flex; align-items: center; gap: 0.65rem; }
    .card-header p { font-size: 0.76rem; color: var(--ink3); margin-left: calc(32px + 0.65rem); }
    .card-icon {
      width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
      background: rgba(201,164,76,0.14); color: var(--navy);
      display: flex; align-items: center; justify-content: center;
    }
    .card-icon svg { width: 17px; height: 17px; }

     .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
      }


      /* REPORT DASHBOARD */
      .grid-3 {
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:1.5rem;
    width:100%;
    margin-bottom:1.5rem;
    align-items:start;
}


      .grid-3 .card {

    margin-bottom:0;
    min-width:0;

    height:430px;

    display:flex;
    flex-direction:column;

}


      /* Client Chart card */
      .grid-3 .card:nth-child(3) {
          min-width: 0;
      }


      /* Tablet */
      @media(max-width:1200px){

          .grid-3 {
              grid-template-columns: 1fr 1fr;
          }

          .grid-3 .card:nth-child(3){
              grid-column:1 / -1;
          }

      }


      /* Mobile */
      @media(max-width:768px){

          .grid-3 {
              grid-template-columns:1fr;
          }

          .grid-3 .card:nth-child(3){
              min-width:auto;
          }

      }
    .chart-container {
    display:flex;
    flex-direction:column;
    gap:0.8rem;
    margin-top:1rem;
    width:100%;
     }


    .chart-row {

display:grid;

grid-template-columns:
90px
minmax(80px,1fr)
75px;

align-items:center;

gap:8px;

width:100%;

}
    #revenue-chart {
    overflow:hidden;
    padding-bottom:5px;
    min-height:150px;
    width:100%;
 }
    .chart-label {
    font-weight:600;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    color:var(--ink2);
    font-size:0.85rem;
}

#revenue-chart,
#client-chart {

overflow-y:auto;
flex:1;

}

.chart-bar-wrapper {

height:22px;

background:#e8edf7;

border-radius:8px;

overflow:hidden;

width:100%;

}


    .chart-bar {

    height:100%;

    min-width:8px;

    transform-origin: left center;

    background:linear-gradient(
    90deg,
    #0d2353,
    var(--gold2)
    );

    border-radius:8px;

    }

.chart-val {
    text-align:right;
    font-weight:700;
    font-size:0.85rem;
    font-family: var(--mono);
}

    /* Financial Progress Bars Layout */
    .health-container { background: #f8fafc; border-radius: 12px; padding: 1.15rem; border: 1px dashed rgba(13,35,83,0.1); }
    .health-metric-title { display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .health-metric-title span:last-child { font-family: var(--mono); text-transform: none; letter-spacing: 0; }
    .health-bar-bg { background: #e2e8f0; height: 12px; border-radius: 100px; overflow: hidden; margin-bottom: 1.2rem; }
    .health-bar-fill { height: 100%; width: 0%; transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }

    .distribution-item { margin-bottom: 12px; }
    .distribution-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.85rem; font-weight: 600; }
    .distribution-header span:last-child { font-family: var(--mono); font-weight: 600; }
    .distribution-track { height: 14px; background: #eef1f8; border-radius: 10px; overflow: hidden; }
    .distribution-fill { height: 100%; transform-origin: left center; background: linear-gradient(90deg, var(--gold2), var(--accent)); }

    @media (prefers-reduced-motion: no-preference) {
      .chart-bar, .distribution-fill { animation: bar-grow 0.85s cubic-bezier(.16,1,.3,1) both; }
      #leaderboard-body tr { animation: row-in 0.45s cubic-bezier(.16,1,.3,1) both; animation-delay: calc(var(--i, 0) * 45ms); }
    }
    @keyframes bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes row-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    /* Stats Box Layout */
    .macro-total-box { border-left: 4px solid var(--accent); padding-left: 1rem; margin: 0.5rem 0; }
    .macro-total-box.paid { border-left-color: var(--green); }
    .macro-total-box.unpaid { border-left-color: var(--amber); }
    .macro-total-box span { font-size: 0.78rem; text-transform: uppercase; color: var(--ink3); letter-spacing: 0.05em; font-weight: 500; }
    .macro-total-box h4 { font-size: 1.6rem; font-weight: 700; color: var(--navy); margin-top: 0.15rem; }

    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th { text-align: left; padding: 0.8rem 1rem; color: var(--ink3); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 2px solid var(--bg2); font-weight: 600; }
    td { padding: 0.9rem 1rem; border-bottom: 1px solid var(--bg2); }
    tr:last-child td { border-bottom: none; }
    #leaderboard-body tr:nth-child(even) td { background: rgba(13,35,83,0.02); }
    #leaderboard-body tr:hover td { background: rgba(201,164,76,0.09); }
    #leaderboard-body td:nth-child(3), #leaderboard-body td:nth-child(4), #leaderboard-body td:nth-child(5),
    .ledger-total-row td:nth-child(3), .ledger-total-row td:nth-child(4), .ledger-total-row td:nth-child(5) {
      font-family: var(--mono);
    }
    .ledger-total-row td {
      border-top: 3px double var(--navy);
      border-bottom: none;
      font-weight: 700;
      color: var(--navy);
      background: rgba(201,164,76,0.06);
    }

    .btn {
      background: linear-gradient(135deg, var(--navy), var(--navy-deep));
      color: white; padding: 0.65rem 1.4rem; font-size: 0.85rem; font-weight: 600;
      border-radius: 9px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;
      box-shadow: 0 6px 16px -7px rgba(13,35,83,0.4);
      transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease;
    }
    .btn:hover { background: linear-gradient(135deg, var(--accent), var(--navy)); transform: translateY(-1px); box-shadow: 0 10px 22px -9px rgba(13,35,83,0.5); }
    .btn:active { transform: translateY(0); }

    input[type="month"] {
      padding: 0.55rem 1rem; border: 1.5px solid rgba(13,35,83,0.14); border-radius: 8px;
      font-family: var(--sans); font-size: 0.86rem; color: var(--navy); background: white;
      outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    }
    input[type="month"]:focus { border-color: var(--gold2); box-shadow: 0 0 0 3px rgba(201,164,76,0.18); }

    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); width: 240px; }
      .main { margin-left: 0; padding-top: 56px; }
      .mobile-header { display: flex; }
      .topbar { position: relative !important; top: 0 !important; }
      .content { padding: 1rem; }
    }

    /* NEW — small badge for the fixed-fee row/marker in tables */
    .fixed-fee-tag {
      display:inline-block; margin-left:6px; font-size:0.62rem; font-weight:700;
      text-transform:uppercase; letter-spacing:0.05em; color: var(--navy);
      background: rgba(201,164,76,0.22); padding: 1px 6px; border-radius: 4px; vertical-align: middle;
    }
  </style>
</head>
<body>

<div class="mobile-header" id="mobile-header">
  <div class="mobile-logo">
    <img src="../QFA_Logo.png" alt="QFA"/>
    <span>QFA</span>
  </div>
  <button class="hamburger-btn" onclick="toggleSidebar()">☰</button>
</div>
<div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>

<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <div class="brand-logo"><img src="../QFA_Logo.png" alt="QFA"/></div>
      <div class="brand-text"><strong>Quick Freelancing</strong><span>Agency</span></div>
    </div>
    <nav class="sidebar-nav">
      <a href="dashboard.html">📊 Overview</a>
      <a href="time-logs.html">⏱ Time Logs</a>
      <a href="clients.html">👥 Clients</a>
      <a href="schedule.html">📅 Schedule</a>
      <a href="reports.html" class="active">📈 Reports</a>
      <a href="fixed-invoices.html">📄 Invoices</a>
      <a href="portfolio-admin.html">🖼 Portfolio</a>
      <a href="../index.html" target="_blank">🌐 Public Site</a>
    </nav>
    <div class="sidebar-user">
      <strong id="user-name">Loading…</strong>
      <span>Freelancer · QFA</span>
      <a href="#" onclick="logout()">Sign out →</a>
    </div>
  </aside>

  <div class="main">
    <div class="topbar">
      <h2>Reports & Analytics</h2>
      <div class="topbar-control">
        <label for="report-month" class="topbar-control-label">Statement Period</label>
        <input type="month" id="report-month" onchange="loadReportData()"/>
      </div>
    </div>

    <div class="content">
      <!-- LEDGER STATEMENT HEADER -->
      <div class="global-summary">
        <div class="ledger-texture" aria-hidden="true"></div>
        <div class="ledger-glow" aria-hidden="true"></div>

        <div class="statement-head">
          <span class="ledger-eyebrow">Statement of Account · All Time</span>
          <span class="ledger-asof" id="ledger-asof"></span>
        </div>

        <div class="statement-body">
          <div class="statement-hero">
            <span class="statement-hero-label">Total Volume</span>
            <h3 class="statement-hero-value" id="global-total-all">$0.00</h3>
            <div class="statement-hero-split">
              <span class="split-item split-paid"><i></i>Paid <b id="global-paid-all">$0</b></span>
              <span class="split-item split-unpaid"><i></i>Due <b id="global-unpaid-all">$0</b></span>
            </div>
          </div>

          <div class="statement-stats">
            <div class="stat-cell">
              <span>Total Hours</span>
              <strong id="global-hours-total">0 hrs</strong>
            </div>
            <div class="stat-cell">
              <span>Active Months</span>
              <strong id="global-month-count">0</strong>
            </div>
            <div class="stat-cell">
              <span>Coverage Period</span>
              <strong id="global-period">-</strong>
            </div>
            <div class="stat-cell">
              <span>Unique Clients</span>
              <strong id="global-client-count">0</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-3">

    <div class="card">
      <div class="card-header">
        <div class="card-header-text">
          <h3><span class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M8.5 21h7"/><path d="M5 7 2.5 12a2.75 2.75 0 0 0 5 0L5 7Z"/><path d="M19 7l-2.5 5a2.75 2.75 0 0 0 5 0L19 7Z"/></svg></span>Balance Sheet — Selected Month</h3>
        </div>
      </div>

      <div class="health-container" style="margin-top:0.5rem;">

        <div class="health-metric-title" style="color:var(--green);">
          <span>Month Paid</span>
          <span id="health-paid-val">$0.00</span>
        </div>

        <div class="health-bar-bg">
          <div id="health-paid-bar"
               class="health-bar-fill"
               style="background:var(--green);">
          </div>
        </div>


        <div class="health-metric-title"
             style="color:var(--amber);margin-top:.5rem;">
          <span>Month Unpaid</span>
          <span id="health-unpaid-val">$0.00</span>
        </div>


        <div class="health-bar-bg">
          <div id="health-unpaid-bar"
               class="health-bar-fill"
               style="background:var(--amber);">
          </div>
        </div>

      </div>


      <div style="
          margin-top:1.25rem;
          padding-top:.8rem;
          border-top:1px solid var(--bg2);
          display:flex;
          justify-content:space-between;
          align-items:center;">

          <span style="font-size:.8rem;color:var(--ink3);">
            Download Matrix:
          </span>

          <button class="btn"
                  style="padding:.5rem 1rem;font-size:.78rem;"
                  onclick="exportFilteredCSV()">
              📥 Export CSV
          </button>

      </div>

    </div>



    <div class="card">

        <div class="card-header">
          <div class="card-header-text">
            <h3><span class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12V3a9 9 0 1 1-9 9h9Z"/></svg></span>Revenue by Client — Selected Month</h3>
          </div>
        </div>

        <div class="chart-container" id="revenue-chart"></div>

    </div>



    <div class="card">

        <div class="card-header">
          <div class="card-header-text">
            <h3><span class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V10"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M2 19h20"/></svg></span>Client Revenue Distribution</h3>
            <p>Selected month's client revenue, as a share of all-time total</p>
          </div>
        </div>

        <div id="client-chart" class="chart-container">

     </div>

    </div>


</div>

      <div class="card">
        <div class="card-header">
          <div class="card-header-text">
            <h3><span class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h11"/><path d="M4 18h14"/></svg></span>Performance Leaderboard — Selected Month</h3>
          </div>
        </div>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Billing Type</th>
                <th>Hours Tracked</th>
                <th>Total Value Owed</th>
                <th>Total Processed</th>
              </tr>
            </thead>
            <tbody id="leaderboard-body"></tbody>
            <tfoot id="leaderboard-tfoot" class="ledger-total-row" style="display:none;">
              <tr>
                <td>Total</td>
                <td></td>
                <td id="leaderboard-total-hours">0 hrs</td>
                <td id="leaderboard-total-owed">$0.00</td>
                <td id="leaderboard-total-processed">$0.00</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
const API = 'https://freelancer-platform-9jut.onrender.com/api';
const auth = {
  token: () => localStorage.getItem('token'),
  user:  () => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } },
  clear: () => { localStorage.removeItem('token'); localStorage.removeItem('user'); },
  isLoggedIn: () => !!localStorage.getItem('token'),
  headers: () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') })
};

(function() {
  if (!auth.isLoggedIn()) { window.location.href = 'login.html'; return; }
  document.getElementById('user-name').textContent = auth.user()?.name || '';
})();

function logout() { auth.clear(); window.location.href = 'login.html'; }

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateCount(el, endValue, { prefix = '', suffix = '', decimals = 0 } = {}) {
  if (!el || !isFinite(endValue)) return;
  if (prefersReducedMotion) {
    el.textContent = `${prefix}${endValue.toFixed(decimals)}${suffix}`;
    return;
  }
  const duration = 850;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = `${prefix}${(endValue * eased).toFixed(decimals)}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('report-month').value = new Date().toISOString().slice(0, 7);
  const asOfEl = document.getElementById('ledger-asof');
  if (asOfEl) {
    asOfEl.textContent = 'As of ' + new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  loadReportData();
});

// ────────────────────────────────────────────────────────────────
// Helper: resolve a fixed_monthly_payments row into paid/unpaid split.
// Schema only has 'paid' | 'unpaid' (no partial), and a single `amount`
// field — so the split is just "all of it, on one side or the other".
// ────────────────────────────────────────────────────────────────
function splitFixedPayment(row) {
  const amt = parseFloat(row.amount || 0);
  return row.status === 'paid'
    ? { due: amt, paid: amt, unpaid: 0 }
    : { due: amt, paid: 0, unpaid: amt };
}

async function loadReportData() {
  const month = document.getElementById('report-month').value; // "YYYY-MM"

  try {
    // fixedAllRes: every fixed-fee record for this freelancer, all clients,
    // all months — powers the "All Time" statement. Requires the GET /
    // (root) route on the fixed-payments router.
    // fixedMonthRes: bulk-generate also ensures a row exists for every
    // fixed client for the selected month (creating 'unpaid' ones that
    // don't exist yet) and returns them already joined to client_name —
    // so this doubles as both "ensure" and "fetch" for the month view.
    const [statsRes, allLogsRes, fixedAllRes, fixedMonthRes] = await Promise.all([
      fetch(`${API}/stats/freelancer?month=${month}`, { headers: auth.headers() }),
      fetch(`${API}/timelogs`, { headers: auth.headers() }),
      fetch(`${API}/fixed-payments`, { headers: auth.headers() }),
      fetch(`${API}/fixed-payments/bulk-generate`, {
        method: 'POST',
        headers: auth.headers(),
        body: JSON.stringify({ month })
      })
    ]);

    const data = await statsRes.json();
    const allLogs = await allLogsRes.json();
    // NEW: the freelancer's whole fixed-fee ledger, all time — this is what
    // powers the "Statement of Account · All Time" figures for fixed clients.
    let fixedAllRows = [];
    let fixedMonthRows = [];
    try { fixedAllRows = await fixedAllRes.json(); } catch { fixedAllRows = []; }
    try { fixedMonthRows = await fixedMonthRes.json(); } catch { fixedMonthRows = []; }
    if (!Array.isArray(fixedAllRows)) fixedAllRows = [];
    if (!Array.isArray(fixedMonthRows)) fixedMonthRows = [];

    // Which clients are billed on a flat monthly fee. We key off client_id
    // so a client with a matching name doesn't accidentally get excluded.
    const fixedClientIds = new Set(fixedAllRows.map(f => f.client_id));

    let monthPaid = 0;
    let monthUnpaid = 0;
    let macroPaid = 0;
    let macroUnpaid = 0;

    let totalHours = 0;
    let uniqueClients = new Set();
    let activeMonths = new Set();

    let minDate = null;
    let maxDate = null;

    allLogs.forEach(log => {
      const amt = parseFloat(log.amount || 0);
      const isPaid = log.payment_status === 'paid';
      const isFixedClient = fixedClientIds.has(log.client_id);

      // Dollar figures from timelogs only apply to HOURLY clients now.
      // A fixed client's dollars are tallied separately from
      // fixed_monthly_payments below, so we skip them here to avoid
      // double-counting.
      if (!isFixedClient) {
        if (isPaid) {
          macroPaid += amt;
        } else {
          macroUnpaid += amt;
        }

        if (log.date && log.date.startsWith(month)) {
          if (isPaid) {
            monthPaid += amt;
          } else {
            monthUnpaid += amt;
          }
        }
      }

      // Hours, client roster, and coverage period still include fixed
      // clients — they still log hours, it's just not what they're billed on.
      if (log.client_name) {
        uniqueClients.add(log.client_name);
      }

      totalHours += parseFloat(log.hours || 0);

      if (log.date) {
        const logMonth = log.date.substring(0, 7);
        activeMonths.add(logMonth);
        if (!minDate || log.date < minDate) minDate = log.date;
        if (!maxDate || log.date > maxDate) maxDate = log.date;
      }
    });

    // Fold the fixed-fee ledger into the same totals.
    fixedAllRows.forEach(f => {
      const { paid, unpaid } = splitFixedPayment(f);
      macroPaid += paid;
      macroUnpaid += unpaid;
      if (f.client_name) uniqueClients.add(f.client_name);
    });

    fixedMonthRows.forEach(f => {
      const { paid, unpaid } = splitFixedPayment(f);
      monthPaid += paid;
      monthUnpaid += unpaid;
    });

    animateCount(document.getElementById('global-total-all'), macroPaid + macroUnpaid, { prefix: '$', decimals: 2 });
    animateCount(document.getElementById('global-paid-all'), macroPaid, { prefix: '$', decimals: 2 });
    animateCount(document.getElementById('global-unpaid-all'), macroUnpaid, { prefix: '$', decimals: 2 });

    document.getElementById('health-paid-val').textContent = `$${monthPaid.toFixed(2)}`;
    document.getElementById('health-unpaid-val').textContent = `$${monthUnpaid.toFixed(2)}`;

    animateCount(document.getElementById('global-client-count'), uniqueClients.size, { decimals: 0 });
    animateCount(document.getElementById('global-hours-total'), totalHours, { suffix: ' hrs', decimals: 2 });
    animateCount(document.getElementById('global-month-count'), activeMonths.size, { suffix: activeMonths.size === 1 ? ' Month' : ' Months', decimals: 0 });

    if (minDate && maxDate) {
      const startYear = new Date(minDate).getFullYear();
      const endYear = new Date(maxDate).getFullYear();
      document.getElementById('global-period').textContent =
        startYear === endYear ? startYear : `${startYear} - ${endYear}`;
    }

    const combinedMonthTotal = monthPaid + monthUnpaid;
    if (combinedMonthTotal > 0) {
      document.getElementById('health-paid-bar').style.width = `${(monthPaid / combinedMonthTotal) * 100}%`;
      document.getElementById('health-unpaid-bar').style.width = `${(monthUnpaid / combinedMonthTotal) * 100}%`;
    } else {
      document.getElementById('health-paid-bar').style.width = '0%';
      document.getElementById('health-unpaid-bar').style.width = '0%';
    }

    const chartContainer = document.getElementById('revenue-chart');
    const distributionChart = document.getElementById('client-chart');
    const leaderboard = document.getElementById('leaderboard-body');
    const tfoot = document.getElementById('leaderboard-tfoot');

    // ── Merge fixed-fee clients into this month's breakdown ──────────
    // data.clientBreakdown comes from /stats/freelancer and is presumed
    // to be built off timelogs, so a fixed client's `total`/`paid` there
    // reflect stale/irrelevant hourly math. We override those two fields
    // with the real fixed_monthly_payments figures for the selected
    // month, and add an entry for any fixed client that owes a fee this
    // month but logged zero hours (the fee is still owed either way).
    let breakdown = (data.clientBreakdown || []).map(c => ({ ...c }));

    fixedMonthRows.forEach(f => {
      const { due, paid } = splitFixedPayment(f);
      let row = breakdown.find(c => c.client_id === f.client_id);
      if (row) {
        row.total = due;
        row.paid = paid;
        row.rate_type = 'fixed';
      } else {
        breakdown.push({
          client_id: f.client_id,
          client_name: f.client_name,
          rate_type: 'fixed',
          hours: 0,
          total: due,
          paid: paid
        });
      }
    });

    if (!breakdown.length) {
      chartContainer.innerHTML = '<p style="color:var(--ink3); font-size:0.85rem; padding: 1rem 0;">No logs found for this timeframe.</p>';
      leaderboard.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--ink3)">No records found for this month timeline.</td></tr>';
      tfoot.style.display = 'none';
      return;
    }

    const amounts = breakdown.map(c => parseFloat(c.total || 0));
    const maxVal = Math.max(...amounts, 1);
    chartContainer.innerHTML = '';
    distributionChart.innerHTML = '';
    leaderboard.innerHTML = '';

    let leaderHoursSum = 0, leaderOwedSum = 0, leaderProcessedSum = 0;
    const allTimeGrandTotal = macroPaid + macroUnpaid;

    breakdown.forEach((c, idx) => {
      const totalAmt = parseFloat(c.total || 0);
      const isFixed = c.rate_type === 'fixed';
      const fixedTag = isFixed ? '<span class="fixed-fee-tag">Fixed</span>' : '';

      const pct = Math.max((totalAmt / maxVal) * 100, 8);
      chartContainer.innerHTML += `
        <div class="chart-row">
          <div class="chart-label" title="${c.client_name}">${c.client_name}${fixedTag}</div>
          <div class="chart-bar-wrapper"><div class="chart-bar" style="width: ${pct}%"></div></div>
          <div class="chart-val">$${totalAmt.toFixed(2)}</div>
        </div>`;

      const distributionPct = allTimeGrandTotal > 0 ? (totalAmt / allTimeGrandTotal) * 100 : 0;

      distributionChart.innerHTML += `
        <div class="distribution-item">
          <div class="distribution-header">
            <span>${c.client_name}${fixedTag}</span>
            <span>${distributionPct.toFixed(1)}%</span>
          </div>
          <div class="distribution-track">
            <div class="distribution-fill" style="width:${distributionPct}%"></div>
          </div>
        </div>`;

      leaderHoursSum += parseFloat(c.hours || 0);
      leaderOwedSum += totalAmt;
      leaderProcessedSum += parseFloat(c.paid || 0);

      leaderboard.innerHTML += `
        <tr style="--i:${idx}">
          <td><strong>${c.client_name}</strong></td>
          <td><span style="text-transform:capitalize; font-size: 0.8rem; background: var(--bg2); padding: 3px 8px; border-radius: 4px;">${c.rate_type}</span></td>
          <td>${parseFloat(c.hours || 0).toFixed(2)} hrs</td>
          <td style="color:#ef4444; font-weight:700;">$${totalAmt.toFixed(2)}</td>
          <td style="color:#10b981; font-weight:700;">$${parseFloat(c.paid || 0).toFixed(2)}</td>
        </tr>`;
    });

    document.getElementById('leaderboard-total-hours').textContent = `${leaderHoursSum.toFixed(2)} hrs`;
    document.getElementById('leaderboard-total-owed').textContent = `$${leaderOwedSum.toFixed(2)}`;
    document.getElementById('leaderboard-total-processed').textContent = `$${leaderProcessedSum.toFixed(2)}`;
    tfoot.style.display = '';
  } catch(e) { console.error("Dashboard Render Error:", e); }
}

async function exportFilteredCSV() {
  const monthFilter = document.getElementById('report-month').value;
  try {
    const [logsRes, fixedRes] = await Promise.all([
      fetch(`${API}/timelogs`, { headers: auth.headers() }),
      fetch(`${API}/fixed-payments/bulk-generate`, {
        method: 'POST',
        headers: auth.headers(),
        body: JSON.stringify({ month: monthFilter })
      })
    ]);
    const logs = await logsRes.json();
    let fixedRows = [];
    try { fixedRows = await fixedRes.json(); } catch { fixedRows = []; }
    if (!Array.isArray(fixedRows)) fixedRows = [];

    const filteredLogs = (logs || []).filter(l => l.date && l.date.startsWith(monthFilter));

    if (!filteredLogs.length && !fixedRows.length) {
      alert(`No records found matching selection: ${monthFilter}`);
      return;
    }

    const headersArray = ['Log_ID', 'Client', 'Billing_Type', 'Date', 'Hours', 'Calculated_Amount', 'Payment_Status', 'Task_Description'];
    const csvRows = [headersArray.join(',')];

    filteredLogs.forEach(l => {
      csvRows.push([
        l.id,
        `"${(l.client_name || '').replace(/"/g, '""')}"`,
        'hourly',
        l.date.slice(0, 10),
        l.hours,
        l.amount || 0,
        l.payment_status,
        `"${(l.task_description || '').replace(/"/g, '""')}"`
      ].join(','));
    });

    // Fixed-fee clients don't live in timelogs money-wise, so their
    // monthly fee gets its own row(s) in the same export.
    fixedRows.forEach(f => {
      csvRows.push([
        f.id,
        `"${(f.client_name || '').replace(/"/g, '""')}"`,
        'fixed',
        f.month,
        '',
        f.amount || 0,
        f.status,
        ''
      ].join(','));
    });

    const csvBlob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(csvBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = blobUrl;
    downloadAnchor.setAttribute('download', `QFA_FilteredLogs_${monthFilter}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  } catch(e) { alert("Export processing error: " + e.message); }
}
</script>
</body>
</html>
