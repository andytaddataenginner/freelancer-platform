import {useEffect,useMemo,useState} from 'react';
import {apiRequest} from '../services/api';
import {FolderKanban,Plus,LayoutGrid,List,Search,RefreshCw,CalendarDays,UserRound,CheckCircle2,AlertTriangle,Clock3,Trash2,Edit3,ArrowLeft} from 'lucide-react';

const statuses=['todo','in_progress','done','blocked'];
const statusNames={todo:'To Do',in_progress:'In Progress',done:'Completed',blocked:'Blocked'};
const priorities=['low','medium','high','urgent'];
const emptyTask={title:'',description:'',status:'todo',priority:'medium',due_date:''};
const emptyProject={client_id:'',name:'',description:'',status:'active',deadline:''};
const dateOnly=v=>v?String(v).slice(0,10):'';
const safePct=(done,total)=>total?Math.round(done/total*100):0;

export function ProjectsPage(){
 const [rows,setRows]=useState([]),[clients,setClients]=useState([]),[tasks,setTasks]=useState([]);
 const [selected,setSelected]=useState(null),[view,setView]=useState('board'),[filter,setFilter]=useState('all'),[search,setSearch]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [projectForm,setProjectForm]=useState(emptyProject),[taskForm,setTaskForm]=useState(emptyTask);
 const [projectModal,setProjectModal]=useState(false),[taskModal,setTaskModal]=useState(false),[editingTask,setEditingTask]=useState(null),[editingProject,setEditingProject]=useState(false);
 async function load(){
  setBusy(true);setError('');
  try{const [p,c]=await Promise.all([apiRequest('/projects'),apiRequest('/clients')]);setRows(Array.isArray(p)?p:[]);setClients(Array.isArray(c)?c:[]);}
  catch(e){setError(e.message||'Unable to load projects.');}
  finally{setBusy(false);}
 }
 async function loadTasks(project){
  if(!project)return;
  setError('');
  try{const t=await apiRequest('/projects/'+project.id+'/tasks');setTasks(Array.isArray(t)?t:[]);setSelected(project);}
  catch(e){setError(e.message||'Unable to load project tasks.');}
 }
 useEffect(()=>{load();},[]);
 const visible=useMemo(()=>rows.filter(p=>(filter==='all'||p.status===filter)&&(!search||[p.name,p.description,p.client_name,p.client_company].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase())))),[rows,filter,search]);
 const counts=useMemo(()=>statuses.reduce((a,s)=>(a[s]=tasks.filter(t=>t.status===s).length,a),{}),[tasks]);
 const done=counts.done||0,total=tasks.length,pct=safePct(done,total);
 async function saveProject(e){
  e.preventDefault();setBusy(true);setError('');
  try{
   const payload={...projectForm,client_id:projectForm.client_id};
   if(editingProject&&selected)await apiRequest('/projects/'+selected.id,{method:'PUT',body:JSON.stringify(payload)});
   else await apiRequest('/projects',{method:'POST',body:JSON.stringify(payload)});
   setProjectModal(false);setEditingProject(false);setNotice(editingProject?'Project updated':'Project created');await load();
   if(selected){const refreshed=(await apiRequest('/projects')).find(p=>String(p.id)===String(selected.id));if(refreshed)await loadTasks(refreshed);}
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 function newProject(){setSelected(null);setEditingProject(false);setProjectForm({...emptyProject,client_id:clients[0]?.id||''});setProjectModal(true);}
 function editProject(p){setSelected(p);setEditingProject(true);setProjectForm({client_id:p.client_id||'',name:p.name||'',description:p.description||'',status:p.status||'active',deadline:dateOnly(p.deadline)});setProjectModal(true);}
 async function removeProject(p){
  if(!confirm('Delete this project and all its tasks?'))return;
  try{await apiRequest('/projects/'+p.id,{method:'DELETE'});if(String(selected?.id)===String(p.id)){setSelected(null);setTasks([]);}await load();setNotice('Project deleted.');}catch(e){setError(e.message);}
 }
 function newTask(){setEditingTask(null);setTaskForm(emptyTask);setTaskModal(true);}
 function editTask(t){setEditingTask(t);setTaskForm({title:t.title||'',description:t.description||'',status:t.status||'todo',priority:t.priority||'medium',due_date:dateOnly(t.due_date)});setTaskModal(true);}
 async function saveTask(e){
  e.preventDefault();if(!selected)return;setBusy(true);setError('');
  try{
   const payload={...taskForm,due_date:taskForm.due_date||null};
   if(editingTask)await apiRequest('/projects/'+selected.id+'/tasks/'+editingTask.id,{method:'PUT',body:JSON.stringify(payload)});
   else await apiRequest('/projects/'+selected.id+'/tasks',{method:'POST',body:JSON.stringify(payload)});
   setTaskModal(false);await loadTasks(selected);await load();setNotice(editingTask?'Task updated':'Task added');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function moveTask(task,status){
  if(!selected||task.status===status)return;
  const previous=tasks;setTasks(list=>list.map(t=>t.id===task.id?{...t,status}:t));
  try{await apiRequest('/projects/'+selected.id+'/tasks/'+task.id+'/status',{method:'PATCH',body:JSON.stringify({status})});await load();setNotice('Task moved to '+statusNames[status]);}
  catch(e){setTasks(previous);setError(e.message);}
 }
 async function removeTask(t){
  if(!confirm('Delete this task?'))return;
  try{await apiRequest('/projects/'+selected.id+'/tasks/'+t.id,{method:'DELETE'});await loadTasks(selected);await load();}catch(e){setError(e.message);}
 }
 return <div className="module-page projects-module">
  <div className="page-heading"><div><div className="eyebrow">DELIVERY & TASK MANAGEMENT</div><h1>Projects</h1><p>Plan client work, track task progress and manage delivery through a visual Kanban board.</p></div><div className="heading-actions"><button className="button-secondary" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button><button className="button-primary" onClick={newProject}><Plus size={16}/> New project</button></div></div>
  {error&&<div className="notice-error" role="alert">{error}</div>}{notice&&<div className="notice-success" role="status">{notice}</div>}
  {!selected?<><div className="project-toolbar panel-card"><div className="project-search"><Search size={16}/><input placeholder="Search projects or clients…" value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All project statuses</option>{['active','paused','completed','cancelled'].map(s=><option key={s}>{s}</option>)}</select><div className="project-view-toggle"><button className={view==='board'?'active':''} onClick={()=>setView('board')}><LayoutGrid size={15}/> Cards</button><button className={view==='list'?'active':''} onClick={()=>setView('list')}><List size={15}/> List</button></div></div>
   {view==='board'?<div className="project-overview-grid">{visible.map(p=>{const d=Number(p.done_tasks)||0,n=Number(p.total_tasks)||0,percent=safePct(d,n);return <article className="project-overview-card" key={p.id}><div className="project-card-top"><span className={'project-state state-'+p.status}>{p.status}</span><button className="project-icon-action" title="Edit project" onClick={()=>editProject(p)}><Edit3 size={15}/></button></div><button className="project-card-title" onClick={()=>loadTasks(p)}>{p.name}</button><p className="project-card-description">{p.description||'No description provided.'}</p><div className="project-card-client"><UserRound size={14}/>{p.client_name||'Client'}{p.client_company?' · '+p.client_company:''}</div><div className="project-progress-label"><span>Completion</span><strong>{percent}%</strong></div><div className="project-progress-track"><i style={{width:percent+'%'}}/></div><div className="project-card-foot"><span><CheckCircle2 size={13}/>{d}/{n} tasks completed</span><span><CalendarDays size={13}/>{p.deadline?'Due '+dateOnly(p.deadline):'No deadline'}</span></div><div className="project-card-actions"><button className="button-primary" onClick={()=>loadTasks(p)}>Open task board</button><button className="button-secondary danger" onClick={()=>removeProject(p)}><Trash2 size={14}/></button></div></article>})}{!visible.length&&<div className="empty-state">No projects match your filters. Create a project to get started.</div>}</div>:<section className="panel-card table-scroll"><table><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Deadline</th><th>Actions</th></tr></thead><tbody>{visible.map(p=>{const d=Number(p.done_tasks)||0,n=Number(p.total_tasks)||0,percent=safePct(d,n);return <tr key={p.id}><td><button className="text-action" onClick={()=>loadTasks(p)}>{p.name}</button></td><td>{p.client_name}</td><td>{p.status}</td><td>{percent}% · {d}/{n}</td><td>{dateOnly(p.deadline)||'—'}</td><td><button className="button-secondary" onClick={()=>editProject(p)}>Edit</button> <button className="button-secondary" onClick={()=>removeProject(p)}>Delete</button></td></tr>})}</tbody></table></section>}</>:
  <><div className="project-board-heading"><button className="button-secondary" onClick={()=>{setSelected(null);setTasks([]);}}><ArrowLeft size={15}/> All projects</button><div><div className="eyebrow">PROJECT BOARD</div><h2>{selected.name}</h2><p>{selected.client_name||'Client'} · {selected.deadline?'Due '+dateOnly(selected.deadline):'No deadline'}</p></div><div className="project-board-actions"><button className="button-secondary" onClick={()=>editProject(selected)}><Edit3 size={15}/> Edit project</button><button className="button-primary" onClick={newTask}><Plus size={15}/> Add task</button></div></div>
   <section className="project-progress-panel panel-card"><div><span>Overall completion</span><strong>{pct}%</strong><div className="project-progress-track"><i style={{width:pct+'%'}}/></div></div><div className="project-progress-stats"><span><CheckCircle2 size={15}/>{done} completed</span><span><Clock3 size={15}/>{counts.in_progress||0} in progress</span><span><AlertTriangle size={15}/>{counts.blocked||0} blocked</span><span>{total} total tasks</span></div></section>
   <div className="kanban-board">{statuses.map(status=><section className={'kanban-column kanban-'+status} key={status} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/task-id');const task=tasks.find(t=>String(t.id)===id);if(task)moveTask(task,status);}}><div className="kanban-column-heading"><div><span className="kanban-dot"/><strong>{statusNames[status]}</strong></div><span>{counts[status]||0}</span></div><div className="kanban-column-body">{tasks.filter(t=>t.status===status).map(t=><article className="kanban-task-card" key={t.id} draggable onDragStart={e=>e.dataTransfer.setData('text/task-id',String(t.id))}><div className="kanban-task-top"><span className={'priority priority-'+(t.priority||'medium')}>{t.priority||'medium'}</span><button className="project-icon-action" onClick={()=>editTask(t)} title="Edit task"><Edit3 size={14}/></button></div><strong>{t.title}</strong>{t.description&&<p>{t.description}</p>}<div className="kanban-task-bottom">{t.due_date&&<span><CalendarDays size={12}/>{dateOnly(t.due_date)}</span>}<button className="project-icon-action danger" onClick={()=>removeTask(t)} title="Delete task"><Trash2 size={13}/></button></div><select aria-label="Change task status" value={t.status} onChange={e=>moveTask(t,e.target.value)}>{statuses.map(s=><option key={s} value={s}>{statusNames[s]}</option>)}</select></article>)}{!tasks.some(t=>t.status===status)&&<div className="kanban-empty">Drop tasks here or add a new task</div>}</div></section>)}</div>
  </>}
  {projectModal&&<div className="qfa-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setProjectModal(false);}}><form className="qfa-modal" onSubmit={saveProject}><div className="panel-heading"><div><h2>{editingProject?'Edit project':'Create project'}</h2><p>Project details and delivery status</p></div><button type="button" className="project-icon-action" onClick={()=>setProjectModal(false)}>×</button></div><label>Client<select required value={projectForm.client_id} onChange={e=>setProjectForm(x=>({...x,client_id:e.target.value}))}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Project name<input required value={projectForm.name} onChange={e=>setProjectForm(x=>({...x,name:e.target.value}))}/></label><label>Description<textarea rows="3" value={projectForm.description} onChange={e=>setProjectForm(x=>({...x,description:e.target.value}))}/></label><label>Status<select value={projectForm.status} onChange={e=>setProjectForm(x=>({...x,status:e.target.value}))}>{['active','paused','completed','cancelled'].map(s=><option key={s}>{s}</option>)}</select></label><label>Deadline<input type="date" value={projectForm.deadline} onChange={e=>setProjectForm(x=>({...x,deadline:e.target.value}))}/></label><div className="qfa-modal-actions"><button type="button" className="button-secondary" onClick={()=>setProjectModal(false)}>Cancel</button><button className="button-primary" disabled={busy}>{busy?'Saving…':'Save project'}</button></div></form></div>}
  {taskModal&&<div className="qfa-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setTaskModal(false);}}><form className="qfa-modal" onSubmit={saveTask}><div className="panel-heading"><div><h2>{editingTask?'Edit task':'Add task'}</h2><p>{selected?.name}</p></div><button type="button" className="project-icon-action" onClick={()=>setTaskModal(false)}>×</button></div><label>Task title<input required value={taskForm.title} onChange={e=>setTaskForm(x=>({...x,title:e.target.value}))}/></label><label>Description<textarea rows="3" value={taskForm.description} onChange={e=>setTaskForm(x=>({...x,description:e.target.value}))}/></label><div className="qfa-modal-two"><label>Status<select value={taskForm.status} onChange={e=>setTaskForm(x=>({...x,status:e.target.value}))}>{statuses.map(s=><option key={s} value={s}>{statusNames[s]}</option>)}</select></label><label>Priority<select value={taskForm.priority} onChange={e=>setTaskForm(x=>({...x,priority:e.target.value}))}>{priorities.map(s=><option key={s}>{s}</option>)}</select></label></div><label>Due date<input type="date" value={taskForm.due_date} onChange={e=>setTaskForm(x=>({...x,due_date:e.target.value}))}/></label><div className="qfa-modal-actions"><button type="button" className="button-secondary" onClick={()=>setTaskModal(false)}>Cancel</button><button className="button-primary" disabled={busy}>{busy?'Saving…':'Save task'}</button></div></form></div>}
 </div>;
}
