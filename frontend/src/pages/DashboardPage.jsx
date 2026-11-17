import {useEffect,useMemo,useState} from 'react';
import {Activity,ArrowUpRight,BriefcaseBusiness,CalendarDays,CircleDollarSign,Clock3,RefreshCw,Users,ChevronDown,TrendingUp} from 'lucide-react';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid,LineChart,Line,PieChart,Pie,Cell,Legend} from 'recharts';
import {apiRequest} from '../services/api';
import {FloatingTimer} from '../components/FloatingTimer';
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v)||0);
const monthNow=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
const validMonth=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m||''));
const rangeFor=m=>{const safe=validMonth(m)?m:monthNow();const [y,mo]=safe.split('-').map(Number);const end=new Date(y,mo,0).getDate();return {month:safe,from:safe+'-01',to:safe+'-'+String(end).padStart(2,'0')};};
export function DashboardPage(){
 const [month,setMonth]=useState(''),[availableMonths,setAvailableMonths]=useState([]),[data,setData]=useState({stats:null,clients:[],logs:[]}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');const r=rangeFor(month);if(r.month!==month)setMonth(r.month);const results=await Promise.allSettled([apiRequest('/stats/freelancer?month='+r.month),apiRequest('/clients'),apiRequest('/timelogs?from='+r.from+'&to='+r.to+'&limit=200')]);const val=i=>results[i].status==='fulfilled'?results[i].value:null;setData({stats:val(0),clients:Array.isArray(val(1))?val(1):[],logs:Array.isArray(val(2))?val(2):[]});const failed=results.filter(x=>x.status==='rejected');if(failed.length)setError(failed.map(x=>x.reason?.message).filter(Boolean).join(' · ')||'Some dashboard data could not be loaded.');setLoading(false);}
 useEffect(()=>{if(month)load();},[month]);useEffect(()=>{const f=()=>{if(month)load();};window.addEventListener('qfa:timer-saved',f);return()=>window.removeEventListener('qfa:timer-saved',f);},[month]);useEffect(()=>{let live=true;(async()=>{const results=await Promise.allSettled([apiRequest('/timelogs/months'),apiRequest('/timelogs/latest-month'),apiRequest('/timelogs?limit=5000')]);if(!live)return;const returned=results[0].status==='fulfilled'?results[0].value?.months:[];const logs=results[2].status==='fulfilled'&&Array.isArray(results[2].value)?results[2].value:[];const logMonths=logs.map(x=>String(x.date||'').slice(0,7));const months=[...new Set([...(Array.isArray(returned)?returned:[]),...logMonths].map(x=>String(x||'').slice(0,7)).filter(validMonth))].sort().reverse();const direct=results[1].status==='fulfilled'?results[1].value?.latest_month:null;const initialMonth=validMonth(direct)?direct:(months[0]||monthNow());const options=[...new Set([...months,initialMonth])].sort().reverse();setAvailableMonths(options);setMonth(initialMonth);})();return()=>{live=false;};},[]);
 const stats=data.stats||{},breakdown=Array.isArray(stats.clientBreakdown)?stats.clientBreakdown:[];
 // A client is active for the selected month only when that month has recorded work or a fixed-fee record.
 const activeClients=useMemo(()=>breakdown.map(row=>{const client=data.clients.find(c=>c.name===row.client_name);return {...row,id:client?.id,credit_balance:client?.credit_balance||0};}),[breakdown,data.clients]);
 const groupedLogs=useMemo(()=>{
  const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9+#.]+/g,' ').trim().replace(/\s+/g,' ');
  const distance=(a,b)=>{const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];};
  const similarity=(a,b)=>{if(a===b)return 1;if(!a||!b)return 0;const aa=a.split(' '),bb=b.split(' ');const token=2*aa.filter(x=>bb.some(y=>distance(x,y)<=1&&Math.min(x.length,y.length)>=4)).length/(aa.length+bb.length);const lev=1-distance(a,b)/Math.max(a.length,b.length);return Math.max(token,lev);};
  // Technology is the primary grouping key. Project names no longer split SQL,
  // Power BI or Snowflake work into separate "general" buckets.
  const stacks=[
   ['Power BI & Reporting',['power bi','powerbi','dax','power query','pbix','paginated report','semantic model','business intelligence','bi report','report builder','power view','power pivot']],
   ['Snowflake',['snowflake','snowpark','snowpipe','virtual warehouse','snowflake sql','streams','tasks','copy into']],
   ['Databricks & Spark',['databricks','pyspark','spark','delta lake','autoloader','unity catalog','dlt','mlflow']],
   ['Microsoft Fabric',['microsoft fabric','fabric','lakehouse','warehouse','dataflow gen2','onelake','direct lake','medallion']],
   ['Azure & Data Factory',['azure','adf','data factory','synapse','azure sql','key vault','logic app','azure devops']],
   ['SQL & Database',['sql server','t sql','tsql','postgresql','postgres','mysql','sql','database','stored procedure','query tuning','indexing','merge statement','ssms']],
   ['Python & dbt',['python','pandas','numpy','dbt','airflow','elt','jupyter']],
   ['Cloud & DevOps',['terraform','docker','kubernetes','ci cd','github actions','cloud migration','aws','gcp','infrastructure as code']],
   ['Automation & Power Platform',['power automate','power apps','power platform','copilot studio','workflow automation','sharepoint']],
   ['Web & Applications',['react','javascript','typescript','frontend','backend','api','website','web app','supabase','node js','nodejs']]
  ];
  const getStack=log=>{
   const source=normalize([log.project_name,log.project,log.task_description,log.description,log.stack,log.task,log.notes,log.title].join(' '));
   let best={name:'Other / General',score:0};
   for(const [name,terms] of stacks){let score=0;for(const term of terms){const t=normalize(term);if(source.split(' ').includes(t))score+=3;else if(t.includes(' ')&&source.includes(t))score+=4;}if(score>best.score)best={name,score};}
   return best.name;
  };
  const groups=[];
  data.logs.forEach(log=>{
   const stack=getStack(log);
   const project=String(log.project_name||log.project||'Unspecified project').trim();
   const task=String(log.task_description||log.description||log.task||log.title||'Unspecified task').trim();
   let group=groups.find(x=>x.stack===stack);
   if(!group){group={key:stack,stack,project:stack,total:0,tasks:[],projects:new Set()};groups.push(group);}
   if(project!=='Unspecified project')group.projects.add(project);
   group.total+=Number(log.hours||0);
   let taskGroup=group.tasks.find(x=>similarity(x.key,normalize(task))>=.68);
   if(!taskGroup){taskGroup={key:normalize(task),title:task,logs:[],projects:new Set()};group.tasks.push(taskGroup);}
   taskGroup.logs.push(log);
   if(project!=='Unspecified project')taskGroup.projects.add(project);
  });
  return groups.map(group=>({...group,projects:[...group.projects],tasks:group.tasks.map(task=>({...task,projects:[...task.projects]}))})).sort((a,b)=>b.total-a.total);
 },[data.logs]);
 const paid=Number(stats.totalEarned)||0,unpaid=Number(stats.totalUnpaid)||0;
 const cards=[{label:'Paid this month',value:money(paid),sub:'Payments received',icon:CircleDollarSign,accent:'green'},{label:'Unpaid this month',value:money(unpaid),sub:'Outstanding balance',icon:Activity,accent:'amber'},{label:'Total expected',value:money(stats.totalExpected),sub:'Paid + outstanding',icon:ArrowUpRight,accent:'blue'},{label:'Active this month',value:activeClients.length,sub:'Clients with monthly activity',icon:Users,accent:'violet'},{label:'Hours this month',value:Number(stats.hoursThisMonth||0).toFixed(1)+'h',sub:(stats.tasksThisMonth||0)+' time entries',icon:Clock3,accent:'gold'},{label:'Upcoming bookings',value:Number(stats.upcomingBookings||0),sub:'Scheduled sessions',icon:CalendarDays,accent:'blue'}];
 const payData=[{name:'Paid',value:paid},{name:'Outstanding',value:unpaid}].filter(x=>x.value>0);
 const monthTitle=new Date(month+'-02T00:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const chartRows=activeClients.slice().sort((a,b)=>Number(b.total||0)-Number(a.total||0)).slice(0,8).map(x=>({client:x.client_name,paid:Number(x.paid)||0,unpaid:Number(x.unpaid)||0,hours:Number(x.hours)||0}));
 return <div className="dashboard-page">
  <div className="page-heading dashboard-heading"><div><div className="eyebrow">YOUR BUSINESS AT A GLANCE</div><h1>Dashboard</h1><p>{monthTitle} · Payments, client activity and delivery progress</p></div><div className="heading-actions"><label className="month-filter"><span>Selected month</span><select value={month} onChange={e=>setMonth(e.target.value)}>{availableMonths.map(m=><option key={m} value={m}>{new Date(m+'-02T00:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'})}</option>)}</select></label><button className="button-secondary refresh-button" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div></div>
  <div className="metric-grid dashboard-kpis">{cards.map(({label,value,sub,icon:Icon,accent})=><article className="metric-card dashboard-kpi" key={label}><div className={'metric-icon '+accent}><Icon size={17}/></div><div className="metric-label">{label}</div><div className="metric-value">{loading?'—':value}</div><div className="metric-foot"><span>{sub}</span></div></article>)}</div>

  {error&&<div className="notice-error" role="alert">{error}</div>}
  <div className="dashboard-chart-grid">
   <section className="panel-card dashboard-chart-card"><div className="panel-heading"><div><h2>Revenue by client</h2><p>Paid and outstanding · {monthTitle}</p></div><TrendingUp size={17}/></div>{chartRows.length?<ResponsiveContainer width="100%" height={220}><BarChart data={chartRows} margin={{top:8,right:8,left:0,bottom:4}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="client" tick={{fontSize:10}} interval={0} angle={-12} textAnchor="end" height={48}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>money(v)}/><Legend/><Bar dataKey="paid" name="Paid" fill="#1a5cff" radius={[4,4,0,0]}/><Bar dataKey="unpaid" name="Outstanding" fill="#c9952a" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>:<p className="empty-state">No client revenue for this month.</p>}</section>
   <section className="panel-card dashboard-chart-card"><div className="panel-heading"><div><h2>Payment position</h2><p>Paid versus outstanding</p></div><CircleDollarSign size={17}/></div>{payData.length?<><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={payData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={4}>{payData.map((v,i)=><Cell key={v.name} fill={i===0?'#16a36a':'#c9952a'}/>)}</Pie><Tooltip formatter={v=>money(v)}/></PieChart></ResponsiveContainer><div className="dashboard-pay-legend"><span><i className="paid-dot"/> Paid <b>{money(paid)}</b></span><span><i className="unpaid-dot"/> Outstanding <b>{money(unpaid)}</b></span></div></>:<p className="empty-state">No payment data for this month.</p>}</section>
   <section className="panel-card dashboard-chart-card"><div className="panel-heading"><div><h2>Hours by client</h2><p>Time recorded in {monthTitle}</p></div><Clock3 size={17}/></div>{chartRows.some(x=>x.hours>0)?<ResponsiveContainer width="100%" height={205}><BarChart data={chartRows} margin={{top:8,right:8,left:0,bottom:4}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="client" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>Number(v).toFixed(2)+' hours'}/><Bar dataKey="hours" name="Hours" fill="#8b5cf6" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>:<p className="empty-state">No hours recorded for this month.</p>}</section>
   <section className="panel-card dashboard-chart-card"><div className="panel-heading"><div><h2>Monthly activity</h2><p>Recorded work by day</p></div><Activity size={17}/></div>{data.logs.length?<ResponsiveContainer width="100%" height={205}><LineChart data={Object.values(data.logs.reduce((a,l)=>{const d=String(l.date||'').slice(0,10);(a[d]??={day:d,hours:0}).hours+=Number(l.hours)||0;return a;},{})).sort((a,b)=>a.day.localeCompare(b.day))}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day" tick={{fontSize:9}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={v=>Number(v).toFixed(2)+' hours'}/><Line type="monotone" dataKey="hours" stroke="#0ea5a4" strokeWidth={2.5} dot={{r:3}}/></LineChart></ResponsiveContainer>:<p className="empty-state">No time entries for this month.</p>}</section>
  </div>
  <div className="dashboard-lower">
   <section className="panel-card dashboard-recent"><div className="panel-heading"><div><h2>Recent work logs</h2><p>{data.logs.length} entries · grouped by project and task</p></div><Clock3 size={17}/></div>{loading?<p className="empty-state">Loading activity…</p>:!groupedLogs.length?<p className="empty-state">No time entries recorded for this month.</p>:<div className="dashboard-log-groups">{groupedLogs.map(group=><details className="dashboard-log-project" key={group.key}><summary><span><BriefcaseBusiness size={14}/><strong>{group.project}</strong><em className="stack-chip">{group.stack}</em></span><small>{group.tasks.reduce((n,t)=>n+t.logs.length,0)} entries · {group.total.toFixed(2)}h</small><ChevronDown size={15}/></summary>{group.tasks.map((task,i)=><details className="dashboard-log-task" key={task.key+i}><summary><span>{task.title}</span><small>{task.logs.length} logs · {task.logs.reduce((n,l)=>n+Number(l.hours||0),0).toFixed(2)}h</small></summary>{task.logs.map((log,j)=><div className="activity-row" key={log.id||j}><div><strong>{log.client_name||log.client||'Client'}</strong><small>{log.project_name||log.project||'Project not specified'} · {String(log.date||'').slice(0,10)} · {log.payment_status||'unpaid'}</small></div><b>{Number(log.hours||0).toFixed(2)}h</b></div>)}</details>)}</details>)}</div>}</section>
   <section className="panel-card"><div className="panel-heading"><div><h2>Clients active in {monthTitle}</h2><p>Only clients with work or fixed billing in this month</p></div><Users size={17}/></div>{!activeClients.length?<p className="empty-state">No clients active during this month.</p>:<div className="client-list">{activeClients.map((client,i)=>{const c=data.clients.find(x=>x.name===client.client_name);return <div className="client-row" key={client.client_name+i}><span className="client-avatar">{(client.client_name||'C').slice(0,1).toUpperCase()}</span><div><strong>{client.client_name}</strong><small>{Number(client.hours||0).toFixed(2)}h · {client.rate_type||'hourly'}</small></div><span className="client-credit">{money(c?.credit_balance||0)} credit</span></div>})}</div>}</section>
  </div>
  <FloatingTimer/>
 </div>;
}