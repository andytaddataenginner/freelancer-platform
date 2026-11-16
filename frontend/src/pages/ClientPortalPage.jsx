import { useEffect, useState } from 'react';
import { auth } from '../services/auth';
import { apiRequest } from '../services/api';
import { LogOut, FolderKanban, Clock3, CalendarDays, BookOpen } from 'lucide-react';

export function ClientPortalPage() {
  const [data,setData]=useState({stats:null,projects:[],logs:[],bookings:[],notes:[]});
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const user=auth.user();
  useEffect(()=>{
    let active=true;
    Promise.allSettled([apiRequest('/client/stats'),apiRequest('/client/projects'),apiRequest('/client/timelogs'),apiRequest('/client/bookings'),apiRequest('/client/notes')]).then(results=>{
      if(!active)return;
      const [stats,projects,logs,bookings,notes]=results;
      setData({stats:stats.status==='fulfilled'?stats.value:null,projects:projects.status==='fulfilled'?projects.value:[],logs:logs.status==='fulfilled'?logs.value:[],bookings:bookings.status==='fulfilled'?bookings.value:[],notes:notes.status==='fulfilled'?notes.value:[]});
      if(results.every(x=>x.status==='rejected'))setError('We could not load your portal information. Please try again later.');
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  function logout(){auth.clear();window.location.assign('/login');}
  const s=data.stats||{};
  const currency=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(n)||0);
  return <main className="client-portal-page"><header className="portal-header"><div className="login-brand"><span>Q</span><div><strong>QFA</strong><small>CLIENT PORTAL</small></div></div><button className="button-secondary" onClick={logout}><LogOut size={16}/> Sign out</button></header><section className="portal-content"><div className="eyebrow">YOUR QFA WORKSPACE</div><h1>Welcome, {user?.name||'Client'}.</h1><p className="login-subtitle">Your projects, work activity and account overview in one place.</p>{error&&<div className="notice-error">{error}</div>}<div className="metric-grid portal-metrics">{[{label:'Contract status',value:s.contractStatus||'—'},{label:'Total paid',value:currency(s.totalPaid)},{label:'Outstanding',value:currency(s.totalUnpaid)},{label:'Credit balance',value:currency(s.creditBalance)}].map(x=><article className="metric-card" key={x.label}><div className="metric-label">{x.label}</div><div className="metric-value portal-metric-value">{loading?'—':x.value}</div></article>)}</div><div className="portal-grid"><section className="panel-card"><div className="panel-heading"><div><h2><FolderKanban size={16}/> Projects</h2><p>Your active and previous projects</p></div></div>{data.projects.length?data.projects.map(p=><div className="activity-row" key={p.id}><div><strong>{p.name}</strong><small>{p.status||'Project'} · {p.deadline||'No deadline'}</small></div></div>):<p className="empty-state">No projects available yet.</p>}</section><section className="panel-card"><div className="panel-heading"><div><h2><Clock3 size={16}/> Recent work logs</h2><p>Recorded work activity</p></div></div>{data.logs.slice(0,8).map((l,i)=><div className="activity-row" key={l.id||i}><div><strong>{l.task_description||'Work entry'}</strong><small>{l.date||''} · {l.hours||0} hours</small></div></div>)}{!data.logs.length&&<p className="empty-state">No work logs available.</p>}</section><section className="panel-card"><div className="panel-heading"><div><h2><CalendarDays size={16}/> Bookings</h2><p>Your scheduled sessions</p></div></div>{data.bookings.slice(0,8).map((b,i)=><div className="activity-row" key={b.id||i}><div><strong>{b.title||b.service||'Session'}</strong><small>{b.date||''} {b.time||''} · {b.status||'Scheduled'}</small></div></div>)}{!data.bookings.length&&<p className="empty-state">No bookings available.</p>}</section><section className="panel-card"><div className="panel-heading"><div><h2><BookOpen size={16}/> Notes & guidelines</h2><p>Updates from your freelancer</p></div></div>{data.notes.map(n=><div className="activity-row" key={n.id}><div><strong>{n.title}</strong><small>{n.content}</small></div></div>)}{!data.notes.length&&<p className="empty-state">No notes available.</p>}</section></div></section></main>;
}