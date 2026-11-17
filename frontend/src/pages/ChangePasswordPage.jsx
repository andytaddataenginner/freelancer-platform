import {useState} from 'react';
import {KeyRound,ShieldCheck} from 'lucide-react';
import {apiRequest} from '../services/api';

export function ChangePasswordPage(){
 const [form,setForm]=useState({currentPassword:'',newPassword:'',confirmPassword:''});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 async function submit(e){
  e.preventDefault();setError('');setNotice('');
  if(form.newPassword!==form.confirmPassword){setError('New passwords do not match.');return;}
  if(form.newPassword.length<8||!/\\d/.test(form.newPassword)){setError('Use at least 8 characters and include a number.');return;}
  setBusy(true);
  try{
   const result=await apiRequest('/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:form.currentPassword,newPassword:form.newPassword})});
   setNotice(result.message||'Password updated successfully.');
   setForm({currentPassword:'',newPassword:'',confirmPassword:''});
  }catch(e){setError(e.message||'Unable to update password.');}
  finally{setBusy(false);}
 }
 return <div className="module-page change-password-page">
  <div className="page-heading"><div><div className="eyebrow">ACCOUNT SECURITY</div><h1>Change Password</h1><p>Update the password used to access your freelancer workspace.</p></div></div>
  {error&&<div className="notice-error" role="alert">{error}</div>}
  {notice&&<div className="notice-success" role="status">{notice}</div>}
  <section className="panel-card change-password-card">
   <div className="panel-heading"><div><h2><ShieldCheck size={17}/> Password security</h2><p>Confirm your current password before setting a new one.</p></div><KeyRound size={19}/></div>
   <form className="change-password-form" onSubmit={submit}>
    <label className="password-field-full">Current password<input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={e=>setForm(x=>({...x,currentPassword:e.target.value}))}/></label>
    <label>New password<input type="password" autoComplete="new-password" minLength="8" required value={form.newPassword} onChange={e=>setForm(x=>({...x,newPassword:e.target.value}))}/></label>
    <label>Confirm new password<input type="password" autoComplete="new-password" minLength="8" required value={form.confirmPassword} onChange={e=>setForm(x=>({...x,confirmPassword:e.target.value}))}/></label>
    <p className="password-requirement">Use at least 8 characters and include a number.</p>
    <div className="password-actions"><button className="button-primary" disabled={busy}>{busy?'Updating password…':'Update password'}</button></div>
   </form>
  </section>
 </div>;
}
