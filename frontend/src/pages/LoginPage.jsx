import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { auth } from '../services/auth';

export function LoginPage() {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await apiRequest('/auth/login', { method:'POST', body:JSON.stringify({ email, password }) });
      const token = result.token || result.accessToken;
      const user = result.user || result.data?.user;
      if (!token || !user) throw new Error('The login response did not contain the expected session details. Existing login response needs verification.');
      auth.save(token,user);
      navigate(user.role === 'client' ? '/client-portal' : '/dashboard',{replace:true});
    } catch (e) { setError(e.message || 'Unable to sign in. Please try again.'); }
    finally { setBusy(false); }
  }

  return <main className="login-screen"><Link to="/" className="back-home"><ArrowLeft size={16}/> Back to QFA</Link><section className="login-card"><div className="login-brand"><span>Q</span><div><strong>QFA</strong><small>QUICK FREELANCING AGENCY</small></div></div><div className="eyebrow">WORKSPACE ACCESS</div><h1>Welcome back.</h1><p className="login-subtitle">Sign in to manage your freelance operations.</p><form onSubmit={submit}><label>Email address</label><div className="field-wrap"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" required/></div><label>Password</label><div className="field-wrap"><LockKeyhole size={17}/><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{error&&<div className="form-error" role="alert">{error}</div>}<button className="button-primary login-submit" disabled={busy}>{busy?'Signing in…':'Sign in'} <ArrowLeft className="login-arrow" size={17}/></button></form><p className="login-footnote">Your existing QFA account is used. No new account or database migration is required.</p></section></main>;
}