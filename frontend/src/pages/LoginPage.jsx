import {useState} from 'react';
import {Eye,EyeOff,LockKeyhole,Mail,User,Phone,ArrowLeft} from 'lucide-react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {apiRequest} from '../services/api';
import {auth} from '../services/auth';

export function LoginPage(){
 const [params,setParams]=useSearchParams();
 const [mode,setMode]=useState(params.get('mode')==='signup'?'signup':'login');
 const [loginRole,setLoginRole]=useState(params.get('role')==='client'?'client':'freelancer');
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const navigate=useNavigate();
 async function submit(event){
  event.preventDefault();setError('');setBusy(true);
  try{
   if(mode==='signup'){
    if(password.length<8||!/\d/.test(password))throw new Error('Password must be at least 8 characters and include a number.');
    if(password!==confirm)throw new Error('Passwords do not match.');
   }
   const result=await apiRequest(mode==='signup'?'/auth/signup/initiate':'/auth/login',{method:'POST',body:JSON.stringify(mode==='signup'?{name,email,phone,password,role:'freelancer'}:{email,password,requestedRole:loginRole})});
   const token=result.token||result.accessToken,user=result.user||result.data?.user;
   if(!token||!user)throw new Error('The server response did not contain the expected session details.');
   const actualRole=String(user.role||'').trim().toLowerCase();
   if(mode==='login'&&actualRole!==loginRole)throw new Error(loginRole==='client'?'This account is not registered as a client. Select Freelancer login or check the account credentials.':'This account is not registered as a freelancer. Select Client login or check the account credentials.');
   auth.save(token,{...user,role:actualRole});
   navigate(actualRole==='client'?'/client-portal':'/dashboard',{replace:true});
  }catch(e){setError(e.message||'Unable to continue. Please try again.');}
  finally{setBusy(false);}
 }
 return <main className="login-screen"><Link className="login-home-link" to="/"><ArrowLeft size={16}/> Back to home</Link><section className="login-promo"><div className="login-promo-brand"><img src="/QFA_Logo.png" alt="QFA"/><span>QUICK FREELANCING AGENCY</span></div><div className="login-promo-copy"><span>DATA · ANALYTICS · DIGITAL SOLUTIONS</span><h2>Turn your data into <em>business value.</em></h2><p>Practical analytics, dependable data engineering and modern digital solutions — built around the way your business works.</p></div><div className="login-promo-foot">POWERED BY QFA <i/> INSIGHT THAT MOVES BUSINESS FORWARD</div></section><section className="login-card"><div className="login-brand"><img src="/QFA_Logo.png" alt="QFA logo"/><div><strong>QFA</strong><small>QUICK FREELANCING AGENCY</small></div></div><div className="eyebrow">{mode==='signup'?'FREELANCER REGISTRATION':loginRole==='client'?'CLIENT PORTAL ACCESS':'FREELANCER WORKSPACE ACCESS'}</div><h1>{mode==='signup'?'Create your account.':loginRole==='client'?'Client sign in':'Sign in to your workspace'}</h1><p className="login-subtitle">{mode==='signup'?'Set up your freelancer workspace to manage clients, time and billing.':loginRole==='client'?'Access your projects, work updates, invoices and payments.':'Manage your clients, projects, time and billing.'}</p>
 {mode==='login'&&<div className="login-role-switch" role="group" aria-label="Account type"><button type="button" className={loginRole==='freelancer'?'active':''} onClick={()=>{setLoginRole('freelancer');setParams({role:'freelancer'});setError('');}}>Freelancer login</button><button type="button" className={loginRole==='client'?'active':''} onClick={()=>{setLoginRole('client');setParams({role:'client'});setError('');}}>Client login</button></div>}
 <form onSubmit={submit}>
 {mode==='signup'&&<><label>Full name</label><div className="field-wrap"><User size={17}/><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required placeholder="Your full name"/></div><label>Phone (optional)</label><div className="field-wrap"><Phone size={17}/><input value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel" placeholder="Phone number"/></div></>}
 <label>Email address</label><div className="field-wrap"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" required/></div>
 <label>Password</label><div className="field-wrap"><LockKeyhole size={17}/><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete={mode==='signup'?'new-password':'current-password'} required/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
 {mode==='signup'&&<><label>Confirm password</label><div className="field-wrap"><LockKeyhole size={17}/><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" required placeholder="Confirm your password"/></div><p className="login-footnote">Use at least 8 characters and include a number. Registration creates a freelancer account.</p></>}
 {error&&<div className="form-error login-feedback" role="alert" aria-live="assertive">{error}</div>}<button type="submit" className="button-primary login-submit" disabled={busy}>{busy?(mode==='signup'?'Creating account…':'Signing in…'):(mode==='signup'?'Create account':'Sign in')}</button></form>
 <p className="login-footnote">{mode==='signup'?'Already have an account? ':'New to QFA? '}<button type="button" className="text-link" onClick={()=>{setMode(mode==='signup'?'login':'signup');setError('');}}>{mode==='signup'?'Sign in':'Create a freelancer account'}</button></p>
 </section></main>;
}