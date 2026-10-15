'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

export default function LoginPanel({tab='client',onTabChange=()=>{}}) {
 const router=useRouter();
 const [username,setUser]=useState('');
 const [password,setPass]=useState('');
 const [email,setEmail]=useState('');
 const [code,setCode]=useState('');
 const [sent,setSent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 async function api(p,data){const r=await fetch(`/api/${p}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error||'Unable to sign in');return j;}
 async function admin(e){e.preventDefault();setBusy(true);setMsg('');try{await api('auth/login',{username,password});router.replace('/billing/admin');router.refresh()}catch(e){setMsg(e.message)}finally{setBusy(false)}}
 async function client(e){e.preventDefault();setBusy(true);setMsg('');try{if(!sent){const x=await api('client/request-code',{email});setSent(true);setMsg(x.message)}else{await api('client/verify-code',{email,code});router.replace('/billing');router.refresh()}}catch(e){setMsg(e.message)}finally{setBusy(false)}}
 return (
   <div className="login-surface">
     <div className="login-panel">
       <div className="login-security"><span className="security-dot" /> PROTECTED ACCESS</div>
       <div className="eyebrow">WELCOME TO MDS</div>
       <h2>{tab==='client'?'Welcome back.':'Welcome, Finance.'}</h2>
       <p className="muted">{tab==='client'?'Your account. Your billing. All in one place.':'Sign in to securely manage MDS billing operations.'}</p>
       <div className="login-tabs" role="group" aria-label="Account type">
         <button type="button" className={tab==='client'?'selected':''} aria-pressed={tab==='client'} onClick={()=>{onTabChange('client');setMsg('')}}><span aria-hidden="true">◉</span> Client access</button>
         <button type="button" className={tab==='admin'?'selected':''} aria-pressed={tab==='admin'} onClick={()=>{onTabChange('admin');setMsg('')}}><span aria-hidden="true">▥</span> MDS Finance</button>
       </div>
       {tab==='client' ? (
         <form className="login-form" onSubmit={client}>
           <label>Business email address<input type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
           {sent && <label>Six-digit access code<input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} placeholder="Enter your code" onChange={e=>setCode(e.target.value)} required/></label>}
           <button disabled={busy} className="button primary full">{busy?'Please wait…':sent?'Open my billing center':'Send secure access code'} <span aria-hidden="true">↗</span></button>
           {sent && <button type="button" className="inline-link login-reset" onClick={()=>setSent(false)}>Use a different email</button>}
         </form>
       ) : (
         <form className="login-form" onSubmit={admin}>
           <label>Username<input value={username} placeholder="Your MDS username" onChange={e=>setUser(e.target.value)} autoComplete="username" required/></label>
           <label>Password<input type="password" placeholder="Enter your password" value={password} onChange={e=>setPass(e.target.value)} autoComplete="current-password" required/></label>
           <button className="button primary full" disabled={busy}>{busy?'Signing in…':'Enter Finance workspace'} <span aria-hidden="true">↗</span></button>
         </form>
       )}
       {msg && <div role="status" className="notice">{msg}</div>}
       <div className="login-panel-foot"><div className="login-lock" aria-hidden="true">♢</div><p>Access is restricted to authorized MDS clients and Finance staff. Need a hand? <a href="/payments#support">Contact billing ↗</a></p></div>
     </div>
   </div>
 );
}
