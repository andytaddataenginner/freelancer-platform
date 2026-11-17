import {useState} from 'react';
import {KeyRound,ShieldCheck,Eye,EyeOff} from 'lucide-react';
import {apiRequest} from '../services/api';

export function ChangePasswordPage(){
 const [form,setForm]=useState({currentPassword:'',newPassword:'',confirmPassword:''});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [visible,setVisible]=useState({current:false,next:false,confirm:false});
 async function submit(e){
  e.preventDefault();setError('');setNotice('');
  if(form.newPassword!==form.confirmPassword){setError('New passwords do not match.');return;}
  if(form.newPassword.length<8||!/[0-9]/.test(form.newPassword)){setError('Use at least 8 characters and include a number.');return;}
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
    <label className="password-field-full">Current password<div className="password-input-wrap"><input type={visible.current?'text':'password'} autoComplete="current-password" required value={form.currentPassword} onChange={e=>setForm(x=>({...x,currentPassword:e.target.value}))}/><button type="button" onClick={()=>setVisible(x=>({...x,current:!x.current}))} aria-label={visible.current?'Hide current password':'Show current password'}>{visible.current?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
    <label>New password<div className="password-input-wrap"><input type={visible.next?'text':'password'} autoComplete="new-password" minLength="8" required value={form.newPassword} onChange={e=>setForm(x=>({...x,newPassword:e.target.value}))}/><button type="button" onClick={()=>setVisible(x=>({...x,next:!x.next}))} aria-label={visible.next?'Hide new password':'Show new password'}>{visible.next?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
    <label>Confirm new password<div className="password-input-wrap"><input type={visible.confirm?'text':'password'} autoComplete="new-password" minLength="8" required value={form.confirmPassword} onChange={e=>setForm(x=>({...x,confirmPassword:e.target.value}))}/><button type="button" onClick={()=>setVisible(x=>({...x,confirm:!x.confirm}))} aria-label={visible.confirm?'Hide confirmation password':'Show confirmation password'}>{visible.confirm?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
    <p className="password-requirement">Use at least 8 characters and include a number.</p>
    <div className="password-actions"><button className="button-primary" disabled={busy}>{busy?'Updating password…':'Update password'}</button></div>
   </form>
  </section>
 </div>;
}
