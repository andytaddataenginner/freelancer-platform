import {useEffect,useMemo,useState} from 'react';
import {apiRequest} from '../services/api';
import {BarChart3,RefreshCw,Download,TrendingUp,Wallet,Users,Clock3} from 'lucide-react';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,Legend,CartesianGrid,PieChart,Pie,Cell,LineChart,Line} from 'recharts';

const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const monthKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
const shiftMonth=(key,offset)=>{const [y,m]=key.split('-').map(Number);const d=new Date(y,m-1+offset,1);return monthKey(d);};
const monthTitle=key=>new Date(key+'-02T00:00:00').toLocaleDateString(undefined,{month:'short',year:'2-digit'});
const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';

export function ReportsPage(){
 const [month,setMonth]=useState(monthKey(new Date()));
 const [monthly,setMonthly]=useState([]);
 const [stats,setStats]=useState(null);
 const [logs,setLogs]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const months=useMemo(()=>Array.from({length:12},(_,i)=>shiftMonth(month,-11+i)),[month]);

 async function load(){
  setLoading(true);setError('');
  try{
   const results=await Promise.all([
    Promise.all(months.map(m=>apiRequest('/stats/freelancer?month='+m))),
    apiRequest('/stats/freelancer?month='+month),
    apiRequest('/timelogs?limit=5000')
   ]);
   const [monthStats,current,allLogs]=results;
   setMonthly(monthStats.map((s,i)=>({month:months[i],label:monthTitle(months[i]),paid:Number(s.totalEarned)||0,unpaid:Number(s.totalUnpaid)||0,expected:Number(s.totalExpected)||0,hours:Number(s.hoursThisMonth)||0})));
   setStats(current);
   setLogs(Array.isArray(allLogs)?allLogs:[]);
  }catch(e){setError(e.message||'Unable to load report data.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{load();},[month]);

 const selectedClients=useMemo(()=>Array.isArray(stats?.clientBreakdown)?stats.clientBreakdown.map(c=>({name:c.client_name||'Unknown client',paid:Number(c.paid)||0,unpaid:Number(c.unpaid)||0,total:Number(c.total)||0,hours:Number(c.hours)||0})).sort((a,b)=>b.total-a.total):[],[stats]);
 const paymentMix=useMemo(()=>[{name:'Paid',value:selectedClients.reduce((a,c)=>a+c.paid,0)},{name:'Outstanding',value:selectedClients.reduce((a,c)=>a+c.unpaid,0)}].filter(x=>x.value>0),[selectedClients]);
 const allTimePaid=monthly.reduce((a,m)=>a+m.paid,0);
 const allTimeOutstanding=monthly.reduce((a,m)=>a+m.unpaid,0);
 const totalHours=monthly.reduce((a,m)=>a+m.hours,0);
 const csvRows=useMemo(()=>[
  ['QFA Balance Sheet Summary',''],
  ['Reporting month',month],
  ['Revenue received (12 months)',allTimePaid.toFixed(2)],
  ['Outstanding (12 months)',allTimeOutstanding.toFixed(2)],
  ['Tracked hours (12 months)',totalHours.toFixed(2)],
  [],
  ['Client','Rate type','Hours','Expected','Paid','Outstanding'],
  ...selectedClients.map(c=>[c.name,'',c.hours.toFixed(2),c.total.toFixed(2),c.paid.toFixed(2),c.unpaid.toFixed(2)])
 ],[month,allTimePaid,allTimeOutstanding,totalHours,selectedClients]);
 function exportBalanceSheet(){
  const csv=csvRows.map(row=>row.map(csvCell).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='QFA-Balance-Sheet-'+month+'.csv';a.click();URL.revokeObjectURL(url);
 }
 const tooltipFormatter=value=>money(value);
 return <div className="module-page">
  <div className="page-heading"><div><div className="eyebrow">BUSINESS PERFORMANCE</div><h1>Reports & Analytics</h1><p>Revenue trends, client contribution, payment distribution and an exportable balance sheet.</p></div><div className="heading-actions"><button className="button-secondary" onClick={exportBalanceSheet} disabled={loading}><Download size={15}/> Export balance sheet</button><button className="button-secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div></div>
  {error&&<div className="notice-error" role="alert">{error}</div>}
  <section className="panel-card report-filter"><label>Selected month<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><span className="report-range-note">Trend charts cover the 12 months ending in the selected month.</span></section>
  <div className="metric-grid report-kpis">
   <article className="metric-card"><div className="metric-label"><TrendingUp size={15}/> Revenue received · 12 months</div><div className="metric-value">{loading?'—':money(allTimePaid)}</div></article>
   <article className="metric-card"><div className="metric-label"><Wallet size={15}/> Outstanding · 12 months</div><div className="metric-value">{loading?'—':money(allTimeOutstanding)}</div></article>
   <article className="metric-card"><div className="metric-label"><Clock3 size={15}/> Tracked hours · 12 months</div><div className="metric-value">{loading?'—':totalHours.toFixed(1)+'h'}</div></article>
   <article className="metric-card"><div className="metric-label"><Users size={15}/> Clients · selected month</div><div className="metric-value">{loading?'—':selectedClients.length}</div></article>
  </div>
  <div className="report-chart-grid">
   <section className="panel-card report-chart-card"><div className="panel-heading"><div><h2>Monthly revenue trend</h2><p>Paid revenue and outstanding balances</p></div><BarChart3 size={18}/></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{top:12,right:12,left:4,bottom:4}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis tickFormatter={v=>'$'+Number(v).toLocaleString()} tick={{fontSize:10}}/><Tooltip formatter={tooltipFormatter}/><Legend/><Bar dataKey="paid" name="Paid" fill="#1a5cff" radius={[4,4,0,0]}/><Bar dataKey="unpaid" name="Outstanding" fill="#f5c842" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></section>
   <section className="panel-card report-chart-card"><div className="panel-heading"><div><h2>Payment distribution</h2><p>Paid vs outstanding · selected month</p></div></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="76%" innerRadius="48%" paddingAngle={3} label={({name,percent})=>name+' '+(percent*100).toFixed(0)+'%'}>{paymentMix.map((entry,i)=><Cell key={entry.name} fill={i===0?'#1a5cff':'#f5c842'}/>)}</Pie><Tooltip formatter={tooltipFormatter}/><Legend/></PieChart></ResponsiveContainer></div></section>
   <section className="panel-card report-chart-card"><div className="panel-heading"><div><h2>Hours tracked by month</h2><p>Recorded billable activity</p></div></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{top:12,right:12,left:4,bottom:4}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>Number(v).toFixed(2)+' hours'}/><Line type="monotone" dataKey="hours" name="Hours" stroke="#1a5cff" strokeWidth={3} dot={{r:3}} activeDot={{r:5}}/></LineChart></ResponsiveContainer></div></section>
   <section className="panel-card report-chart-card"><div className="panel-heading"><div><h2>Revenue by client</h2><p>Expected revenue · selected month</p></div></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={selectedClients.slice(0,8)} layout="vertical" margin={{top:5,right:20,left:12,bottom:5}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickFormatter={v=>'$'+Number(v).toLocaleString()} tick={{fontSize:10}}/><YAxis type="category" dataKey="name" width={100} tick={{fontSize:10}}/><Tooltip formatter={tooltipFormatter}/><Bar dataKey="total" name="Expected" fill="#1a5cff" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></section>
  </div>
  <section className="panel-card"><div className="panel-heading"><div><h2>Client revenue breakdown</h2><p>Selected month · paid, outstanding and expected amounts</p></div></div>{selectedClients.length===0?<p className="empty-state">{loading?'Loading client breakdown…':'No client revenue found for this month.'}</p>:<div className="table-scroll"><table><thead><tr><th>Client</th><th>Hours</th><th>Expected</th><th>Paid</th><th>Outstanding</th></tr></thead><tbody>{selectedClients.map((c,i)=><tr key={c.name+'-'+i}><td>{c.name}</td><td>{c.hours.toFixed(2)}h</td><td>{money(c.total)}</td><td>{money(c.paid)}</td><td>{money(c.unpaid)}</td></tr>)}</tbody></table></div>}</section>
 </div>;
}