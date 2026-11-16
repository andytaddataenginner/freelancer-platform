import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, BriefcaseBusiness, CalendarDays, CircleDollarSign, Clock3, RefreshCw, Users } from 'lucide-react';
import { apiRequest } from '../services/api';
import { FloatingTimer } from '../components/FloatingTimer';

const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value)||0);
const monthNow = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
const monthRange = month => { const [y,m]=month.split('-').map(Number); return {from:month+'-01',to:y+'-'+String(m).padStart(2,'0')+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0')}; };

export function DashboardPage() {
  const [month,setMonth]=useState(monthNow());
  const [data,setData]=useState({stats:null,clients:[],logs:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  async function load(){
    setLoading(true);setError('');
    try{
      const range=monthRange(month);
      const results=await Promise.allSettled([
        apiRequest('/stats/freelancer?month='+month),
        apiRequest('/clients'),
        apiRequest('/timelogs?from='+range.from+'&to='+range.to+'&limit=8')
      ]);
      const [s,c,l]=results;
      if(results.every(x=>x.status==='rejected')) throw s.reason;
      setData({stats:s.status==='fulfilled'?s.value:null,clients:c.status==='fulfilled'&&Array.isArray(c.value)?c.value:[],logs:l.status==='fulfilled'&&Array.isArray(l.value)?l.value:[]});
      const failed=results.filter(x=>x.status==='rejected');
      if(failed.length)setError('Some dashboard data could not be loaded. '+failed.map(x=>x.reason?.message).filter(Boolean).join(' · '));
    }catch(e){setError(e.message||'Unable to load dashboard data.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[month]);
  useEffect(()=>{const refresh=()=>load();window.addEventListener('qfa:timer-saved',refresh);return()=>window.removeEventListener('qfa:timer-saved',refresh);},[month]);
  const stats=data.stats||{};
  const breakdown=Array.isArray(stats.clientBreakdown)?stats.clientBreakdown:[];
  const activeClients=data.clients.filter(c=>!['paused','terminated','inactive'].includes(String(c.contract_status||'active').toLowerCase()) && c.is_active!==false);
  const cards=[
    {label:'Paid this month',value:money(stats.totalEarned),sub:'Payments received',icon:CircleDollarSign,accent:'green'},
    {label:'Unpaid this month',value:money(stats.totalUnpaid),sub:'Outstanding balance',icon:Activity,accent:'amber'},
    {label:'Total expected',value:money(stats.totalExpected),sub:'Paid + outstanding',icon:ArrowUpRight,accent:'blue'},
    {label:'Active clients',value:activeClients.length,sub:'Current relationships',icon:Users,accent:'violet'},
    {label:'Hours this month',value:Number(stats.hoursThisMonth||0).toFixed(2)+'h',sub:(stats.tasksThisMonth||0)+' time entries',icon:Clock3,accent:'gold'},
    {label:'Upcoming bookings',value:Number(stats.upcomingBookings||0),sub:'Scheduled sessions',icon:CalendarDays,accent:'blue'}
  ];
  const monthTitle=new Date(month+'-02T00:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
  return <div className="dashboard-page">
    <div className="page-heading"><div><div className="eyebrow">YOUR BUSINESS AT A GLANCE</div><h1>Dashboard</h1><p>Payment position, active clients and recent work for {monthTitle}.</p></div><div className="heading-actions"><label className="month-filter">Selected month<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><button className="button-secondary refresh-button" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button></div></div>
    {error&&<div className="notice-error" role="alert">{error}</div>}
    <div className="metric-grid dashboard-kpis">{cards.map(({label,value,sub,icon:Icon,accent})=><article className="metric-card" key={label}><div className={'metric-icon '+accent}><Icon size={19}/></div><div className="metric-label">{label}</div><div className="metric-value">{loading?'—':value}</div><div className="metric-foot"><span>{sub}</span><ArrowUpRight size={14}/></div></article>)}</div>
    <section className="panel-card dashboard-breakdown"><div className="panel-heading"><div><h2>Payment breakdown</h2><p>{monthTitle} · hourly and fixed contracts</p></div><span className="panel-icon"><CircleDollarSign size={18}/></span></div>
      {loading?<p className="empty-state">Loading payment breakdown…</p>:!breakdown.length?<p className="empty-state">No payment activity found for this month.</p>:<div className="table-scroll"><table><thead><tr><th>Client</th><th>Type</th><th>Hours</th><th>Expected</th><th>Paid</th><th>Unpaid</th><th>Status</th></tr></thead><tbody>{breakdown.map((r,i)=><tr key={r.client_name+'-'+i}><td><strong>{r.client_name}</strong><small className="table-sub">{r.company||''}</small></td><td>{r.rate_type||'hourly'}</td><td>{Number(r.hours||0).toFixed(2)}h</td><td>{money(r.total)}</td><td>{money(r.paid)}</td><td>{money(r.unpaid)}</td><td><span className={'status-tag '+(Number(r.unpaid)>0?'status-unpaid':'status-paid')}>{Number(r.unpaid)>0?'Outstanding':'Paid'}</span></td></tr>)}</tbody></table></div>}
    </section>
    <div className="dashboard-lower">
      <section className="panel-card"><div className="panel-heading"><div><h2>Recent time logs</h2><p>Latest recorded work in {monthTitle}</p></div><span className="panel-icon"><Clock3 size={18}/></span></div>{loading?<p className="empty-state">Loading recent activity…</p>:!data.logs.length?<p className="empty-state">No time entries recorded for this month.</p>:<div className="activity-list">{data.logs.slice(0,8).map((log,i)=><div className="activity-row" key={log.id||i}><span className="activity-dot"/><div><strong>{log.task_description||log.description||'Time entry'}</strong><small>{log.client_name||log.client||'Client'} · {String(log.date||'').slice(0,10)}</small></div><b>{Number(log.hours||0).toFixed(2)}h</b></div>)}</div>}</section>
      <section className="panel-card"><div className="panel-heading"><div><h2>Active clients</h2><p>Current hours and available credits</p></div><BriefcaseBusiness size={18}/></div>{loading?<p className="empty-state">Loading clients…</p>:!activeClients.length?<p className="empty-state">No active clients found.</p>:<div className="client-list">{activeClients.map((client,i)=>{const row=breakdown.find(x=>x.client_name===client.name);return <div className="client-row" key={client.id||i}><span className="client-avatar">{(client.name||'C').slice(0,1).toUpperCase()}</span><div><strong>{client.name||'Unnamed client'}</strong><small>{Number(row?.hours||0).toFixed(2)}h this month · {client.rate_type||'hourly'}</small></div><span className="client-credit">{money(client.credit_balance||0)} credit</span></div>})}</div>}</section>
    </div>
    <FloatingTimer />
  </div>;
}