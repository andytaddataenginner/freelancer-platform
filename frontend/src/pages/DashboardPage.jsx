import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, BriefcaseBusiness, CircleDollarSign, Clock3, RefreshCw, Users } from 'lucide-react';
import { apiRequest } from '../services/api';

const money = (value) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0);

export function DashboardPage() {
  const [data,setData] = useState({stats:null,clients:[],logs:[]});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  async function load() {
    setLoading(true);setError('');
    try {
      const month = new Date().toISOString().slice(0,7);
      const results = await Promise.allSettled([
        apiRequest(`/stats/freelancer?month=${month}`),
        apiRequest('/clients'),
        apiRequest('/timelogs?limit=8'),
      ]);
      const [stats,clients,logs] = results;
      const failures = results.filter(x=>x.status==='rejected');
      if (failures.length===3) throw failures[0].reason;
      setData({stats:stats.status==='fulfilled'?stats.value:null,clients:clients.status==='fulfilled'&&Array.isArray(clients.value)?clients.value:[],logs:logs.status==='fulfilled'&&Array.isArray(logs.value)?logs.value:[]});
      if (failures.length) setError('Some dashboard sections could not be loaded. Check the relevant API response.');
    } catch(e) { setError(e.message || 'Unable to load dashboard data.'); }
    finally { setLoading(false); }
  }

  useEffect(()=>{load();},[]);

  const stats = data.stats || {};
  const cards = [
    {label:'Total clients',value:data.clients.length,icon:Users,accent:'blue'},
    {label:'Monthly revenue',value:money(stats.totalEarned ?? 0),icon:CircleDollarSign,accent:'gold'},
    {label:'Tracked hours',value:Number(stats.hoursThisMonth ?? 0).toFixed(1),icon:Clock3,accent:'violet'},
    {label:'Recent time entries',value:data.logs.length,icon:Activity,accent:'green'},
  ];

  return <div className="dashboard-page"><div className="page-heading"><div><div className="eyebrow">YOUR BUSINESS AT A GLANCE</div><h1>Dashboard</h1><p>Welcome back. Here's what's happening across your freelance business.</p></div><button className="button-secondary refresh-button" onClick={load} disabled={loading}><RefreshCw size={16} className={loading?'spin':''}/> Refresh</button></div>
    {error&&<div className="notice-error" role="alert">{error}</div>}
    <div className="metric-grid">{cards.map(({label,value,icon:Icon,accent})=><article className="metric-card" key={label}><div className={`metric-icon ${accent}`}><Icon size={19}/></div><div className="metric-label">{label}</div><div className="metric-value">{loading?'—':value}</div><div className="metric-foot"><span>Current overview</span><ArrowUpRight size={14}/></div></article>)}</div>
    <div className="dashboard-lower"><section className="panel-card"><div className="panel-heading"><div><h2>Recent time logs</h2><p>Latest recorded work activity</p></div><span className="panel-icon"><Clock3 size={18}/></span></div>{loading?<p className="empty-state">Loading recent activity…</p>:data.logs.length===0?<p className="empty-state">No time entries returned by the API.</p>:<div className="activity-list">{data.logs.slice(0,6).map((log,i)=><div className="activity-row" key={log.id||i}><span className="activity-dot"/><div><strong>{log.task_description||log.description||'Time entry'}</strong><small>{log.client_name||log.client||'Client'} · {log.date||'Date unavailable'}</small></div><b>{Number(log.hours||0).toFixed(1)}h</b></div>)}</div>}</section>
      <section className="panel-card"><div className="panel-heading"><div><h2>Client portfolio</h2><p>Current client relationships</p></div><BriefcaseBusiness size={18}/></div>{loading?<p className="empty-state">Loading clients…</p>:data.clients.length===0?<p className="empty-state">No clients returned by the API.</p>:<div className="client-list">{data.clients.slice(0,6).map((client,i)=><div className="client-row" key={client.id||i}><span className="client-avatar">{(client.name||'C').slice(0,1).toUpperCase()}</span><div><strong>{client.name||'Unnamed client'}</strong><small>{client.company||client.rate_type||'Client account'}</small></div><span className="client-status">{client.contract_status|| (client.is_active?'Active':'Inactive')}</span></div>)}</div>}</section></div>
    <div className="migration-banner"><div><strong>React migration workspace</strong><p>Dashboard data is connected to the existing QFA API. The React preview is ready for end-to-end validation against your existing QFA accounts and live API.</p></div><span>PHASE 1</span></div>
  </div>;
}