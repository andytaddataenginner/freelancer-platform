import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Activity, BarChart3, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, FileText, FolderKanban, LayoutDashboard, LogOut, Menu, Moon, Sun, Users, X } from 'lucide-react';
import { auth } from '../services/auth';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/time-logs', label: 'Time Logs', icon: Activity },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/fixed-invoices', label: 'Fixed Invoices', icon: CircleDollarSign },
  { to: '/contracts', label: 'Contracts', icon: FileText },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/portfolio', label: 'Portfolio', icon: BriefcaseBusiness },
];

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('qfa_theme') === 'dark');
  const navigate = useNavigate();
  const user = auth.user();

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem('qfa_theme', next ? 'dark' : 'light');
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
  }
  function logout() {
    auth.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className={`app-frame ${dark ? 'theme-dark' : ''}`}>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark">Q</div>
          {!collapsed && <div><strong>QFA</strong><span>QUICK FREELANCING AGENCY</span></div>}
          <button className="icon-button sidebar-collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">{collapsed ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}</button>
        </div>
        <div className="nav-caption">{!collapsed && 'WORKSPACE'}</div>
        <nav className="side-nav">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`} onClick={() => setMobileOpen(false)}>
              <Icon size={18}/>{!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-avatar">{(user?.name || 'Q').slice(0,1).toUpperCase()}</div>
          {!collapsed && <div className="profile-copy"><strong>{user?.name || 'QFA User'}</strong><span>Freelancer workspace</span></div>}
          <button className="icon-button" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17}/></button>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button>
          <div className="breadcrumb"><span>Workspace</span><i>/</i><strong>QFA Management</strong></div>
          <div className="topbar-actions">
            <span className="status-pill"><span/> All systems ready</span>
            <button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
          </div>
        </header>
        <section className="page-content"><Outlet /></section>
      </main>
    </div>
  );
}