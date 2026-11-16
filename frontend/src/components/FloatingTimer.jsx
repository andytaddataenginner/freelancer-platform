import {useEffect,useRef,useState} from 'react';
import {apiRequest} from '../services/api';
import {Timer,Play,Pause,Square,Minus,Plus,Grip,RotateCcw} from 'lucide-react';

const fmt=s=>{const n=Math.max(0,Math.floor(Number(s)||0));return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':');};
export function FloatingTimer(){
 const [clients,setClients]=useState([]),[clientId,setClientId]=useState(''),[description,setDescription]=useState('');
 const [elapsed,setElapsed]=useState(0),[state,setState]=useState('idle'),[busy,setBusy]=useState(false);
 const [collapsed,setCollapsed]=useState(()=>localStorage.getItem('qfa_timer_collapsed')==='1');
 const [pos,setPos]=useState(()=>{try{return JSON.parse(localStorage.getItem('qfa_timer_pos_v2')||'null')||{right:18,top:82};}catch{return {right:18,top:82};}});
 const [dragging,setDragging]=useState(false);const drag=useRef(null);const base=useRef(0);const tick=useRef(null);
 useEffect(()=>{apiRequest('/clients').then(v=>{const a=Array.isArray(v)?v:[];setClients(a);if(a[0])setClientId(String(a[0].user_id||a[0].id));}).catch(()=>{});apiRequest('/timer/status').then(v=>{if(Array.isArray(v)&&v[0]){const t=v[0];setClientId(String(t.client_id));setDescription(t.description||'');setElapsed(Number(t.elapsed_sec)||0);setState(t.is_paused?'paused':'running');}}).catch(()=>{});},[]);
 useEffect(()=>{if(state!=='running')return;const start=Date.now();const initial=elapsed;tick.current=setInterval(()=>setElapsed(initial+Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(tick.current);},[state]);
 useEffect(()=>{localStorage.setItem('qfa_timer_collapsed',collapsed?'1':'0');},[collapsed]);
 useEffect(()=>{localStorage.setItem('qfa_timer_pos_v2',JSON.stringify(pos));},[pos]);
 async function action(path,body){setBusy(true);try{const r=await apiRequest('/timer/'+path,{method:'POST',body:JSON.stringify(body)});return r;}finally{setBusy(false);}}
 async function start(){if(!clientId){alert('Select a client first.');return;}try{await action('start',{client_id:clientId,description});setElapsed(0);setState('running');}catch(e){alert(e.message);}}
 async function pause(){try{await action('pause',{client_id:clientId});setState('paused');}catch(e){alert(e.message);}}
 async function resume(){try{await action('resume',{client_id:clientId});setState('running');}catch(e){alert(e.message);}}
 async function stop(){if(!confirm('Stop the timer and save this session as a time log?'))return;try{await action('stop',{client_id:clientId,elapsed_sec:elapsed,description});setState('idle');setElapsed(0);setDescription('');window.dispatchEvent(new Event('qfa:timer-saved'));}catch(e){alert(e.message);}}
 async function reset(){if(!confirm('Reset and discard the current timer without creating a time log?'))return;try{await action('cancel',{client_id:clientId});setState('idle');setElapsed(0);setDescription('');window.dispatchEvent(new Event('qfa:timer-reset'));}catch(e){alert(e.message);}}
 function pointerDown(e){if(e.target.closest('button,select,input'))return;drag.current={x:e.clientX,y:e.clientY,rect:e.currentTarget.parentElement.getBoundingClientRect()};setDragging(true);e.currentTarget.setPointerCapture(e.pointerId);}
 function pointerMove(e){if(!drag.current)return;const d=drag.current;const x=Math.max(8,Math.min(window.innerWidth-d.rect.width-8,d.rect.left+e.clientX-d.x));const y=Math.max(8,Math.min(window.innerHeight-(collapsed?52:240)-8,d.rect.top+e.clientY-d.y));setPos({left:x,top:y});}
 function pointerUp(){drag.current=null;setDragging(false);}
 return <aside className={'qfa-floating-timer '+(collapsed?'is-collapsed':'')+(dragging?' is-dragging':'')} style={pos.left!==undefined?{left:pos.left,top:pos.top,right:'auto',bottom:'auto'}:{right:pos.right,bottom:pos.bottom}}>
  <header className="qfa-timer-head" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}><span><Grip size={14}/> LIVE TIME TRACKER</span><strong>{fmt(elapsed)}</strong><button type="button" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Expand timer':'Minimize timer'}>{collapsed?<Plus size={16}/>:<Minus size={16}/>}</button></header>
  {!collapsed&&<div className="qfa-timer-body"><label>Client<select value={clientId} onChange={e=>setClientId(e.target.value)} disabled={state!=='idle'}><option value="">Select client</option>{clients.map(c=><option key={c.user_id||c.id} value={c.user_id||c.id}>{c.name}</option>)}</select></label><label>Task / activity<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="What are you working on?" disabled={state!=='idle'}/></label><div className={'qfa-timer-clock '+state}>{fmt(elapsed)}</div><div className="qfa-timer-actions">{state==='idle'?<button disabled={busy||!clientId} onClick={start}><Play size={14}/> Start</button>:state==='running'?<button disabled={busy} onClick={pause}><Pause size={14}/> Pause</button>:<button disabled={busy} onClick={resume}><Play size={14}/> Resume</button>}{state!=='idle'&&<><button className="stop" disabled={busy} onClick={stop}><Square size={13}/> Stop & save</button><button className="reset" disabled={busy} onClick={reset}><RotateCcw size={13}/> Reset</button></>}</div></div>}
 </aside>;
}
