'use client';
import {useEffect,useState,useCallback} from 'react';import Link from 'next/link';import Brand from './Brand.jsx';
const sections=[['Overview','◫'],['Clients','♧'],['Approved offers','▤'],['Payment requests','↗'],['Subscriptions','◷'],['Invoices','▦'],['Transactions','⇄'],['Reconciliation','⊞'],['CEO approvals','◇'],['Support','✉'],['Audit trail','⌁']];
const endpoints={'Overview':'dashboard','Clients':'clients','Approved offers':'offers','Payment requests':'requests','Subscriptions':'subscriptions','Invoices':'invoices','Transactions':'transactions','Reconciliation':'reconciliation','CEO approvals':'settings','Support':'support','Audit trail':'audit'};
const format=(x,c)=>new Intl.NumberFormat('en-EG',{style:'currency',currency:c||'EGP'}).format(Number(x||0));
const date=d=>d?new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
const fields={seller_legal_name:['Legal business name','Name appearing on official billing documents'],legal_registration:['Commercial registration','Registered MDS entity identification'],registered_address:['Registered business address','Street, city, governorate and country'],seller_tax_id:['Tax registration number','Approved seller tax identifier'],tax_treatment:['VAT and tax treatment','Applicable taxes, rates and inclusive/exclusive treatment'],eta_route:['ETA documentation route','eInvoice/eReceipt, accounting integration or manual export'],commitment_benefits:['Commitment benefit matrix','Approved value/discount rules for 3, 6 and 12 months'],cadence_policy:['Permitted billing schedules','Commitment-to-billing cadence eligibility'],contract_policy:['Cancellation and pause terms','Early termination, pauses, notice periods and wording'],refund_policy:['Refund authority','Approvers, limits and refund approval process'],retry_policy:['Failed payment recovery','Approved retries, communication and escalation timing'],renewal_policy:['Renewal and contract review','Review lead time and auto-renew eligibility'],support_contact:['Billing support email','Approved client billing support address'],data_retention:['Data retention period','Financial records, webhooks, audit and personal information'],finance_contact:['Finance owner','Finance contact and settlement owner'],client_payment_methods:['Approved payment methods','EGP/USD, card and other enabled methods'],admin_contact:['Portal owner email','Privileged account recovery and Finance notifications'],live_billing_approval:['Go-live authorization','Production payment activation and commercial sign-off']};
async function api(path,payload){const r=await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw Error(j.error||'Request could not be completed');return j}
const C={};function Status({value}){const s=String(value||'').toUpperCase();return <span className={`state ${['PAID','APPROVED','SENT','ACTIVE','SUCCESS','PROCESSED','RESOLVED'].includes(s)?'green':/FAIL|OVERDUE|EXCEPTION|PAST_DUE/.test(s)?'red':'amber'}`}>{String(value||'—').replaceAll('_',' ')}</span>}
function Table({head,rows,render,empty='No records yet.'}){return rows?.length?<div className="table-wrap"><table><thead><tr>{head.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.id||row.event_key||i}>{render(row)}</tr>)}</tbody></table></div>:<div className="empty">{empty}</div>}
function PasswordChange({done}){const [a,set]=useState({currentPassword:'',newPassword:'',repeat:''}),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);async function submit(e){e.preventDefault();if(a.newPassword!==a.repeat){setMsg('The new passwords do not match.');return;}setBusy(true);try{await api('auth/change-password',a);done()}catch(e){setMsg(e.message)}finally{setBusy(false)}}return <div className="force-change"><Brand/><div className="login-panel"><div className="eyebrow">ACCOUNT SECURITY</div><h1>Set your secure password</h1><p className="muted">To protect billing records, create your personal Finance password before continuing.</p><form onSubmit={submit} className="login-form"><label>Current password<input type="password" autoComplete="current-password" required value={a.currentPassword} onChange={e=>set({...a,currentPassword:e.target.value})}/></label><label>New password<input type="password" minLength="12" autoComplete="new-password" required value={a.newPassword} onChange={e=>set({...a,newPassword:e.target.value})}/></label><label>Confirm new password<input type="password" minLength="12" autoComplete="new-password" required value={a.repeat} onChange={e=>set({...a,repeat:e.target.value})}/></label><button className="button primary full" disabled={busy}>Update password and continue ↗</button></form>{msg&&<p className="alert" role="alert">{msg}</p>}</div></div>}
function ClientForm({onSave}){const [s,set]=useState({legal_name:'',billing_email:'',locale:'en'}),[msg,setMsg]=useState('');async function submit(e){e.preventDefault();try{await api('admin/clients',s);set({legal_name:'',billing_email:'',locale:'en'});setMsg('Client added.');onSave()}catch(e){setMsg(e.message)}}return <form className="create-grid" onSubmit={submit}><label>Company / legal name<input required value={s.legal_name} onChange={e=>set({...s,legal_name:e.target.value})} placeholder="Client company name"/></label><label>Billing email<input type="email" required value={s.billing_email} onChange={e=>set({...s,billing_email:e.target.value})} placeholder="finance@client.com"/></label><label>Preferred language<select value={s.locale} onChange={e=>set({...s,locale:e.target.value})}><option value="en">English</option><option value="ar">Arabic</option></select></label><button className="button primary">Add client</button>{msg&&<span className="form-status">{msg}</span>}</form>}

const terms=['MONTHLY_FLEX','COMMIT_3M','COMMIT_6M','COMMIT_12M'];
const cadences=['MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL_UPFRONT'];
const cadenceMonths={MONTHLY:1,QUARTERLY:3,SEMIANNUAL:6,ANNUAL_UPFRONT:12};
const months={MONTHLY_FLEX:1,COMMIT_3M:3,COMMIT_6M:6,COMMIT_12M:12};
const termInfo={
 MONTHLY_FLEX:{name:'Monthly Flex · 1 month',note:'No fixed multi-month commitment. Monthly payments still have a scheduled due date. Optional rolling billing can continue after month one.'},
 COMMIT_3M:{name:'3-month commitment',note:'Client commits for three months. Charge monthly or quarterly, according to the options you enable.'},
 COMMIT_6M:{name:'6-month commitment',note:'Client commits for six months. Choose the allowed monthly, quarterly, or six-month schedule.'},
 COMMIT_12M:{name:'12-month commitment',note:'Client commits for twelve months. Choose monthly, quarterly, six-monthly, or annual upfront payment.'}
};
const cadenceInfo={
 MONTHLY:{name:'Monthly',note:'Charge once per month, on the scheduled billing date. This controls timing, not commitment.'},
 QUARTERLY:{name:'Quarterly',note:'Charge every three months, covering three months of professional fees.'},
 SEMIANNUAL:{name:'Every 6 months',note:'Charge once every six months, covering six months of fees.'},
 ANNUAL_UPFRONT:{name:'Annual upfront',note:'Collect twelve months of professional fees in a single payment.'}
};
const cleanOffer=()=>({client_id:'',title:'',commercial_reference:'',transaction_family:'ONE_TIME',currency:'EGP',professional_fee:0,setup_fee:0,pass_through_fee:0,approval_reference:'',approved_by:'',allowed_terms:[],cadence_matrix:{},auto_renew:false});
function OfferForm({clients,onSave}){
 const [s,set]=useState(cleanOffer),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const recurring=s.transaction_family==='RECURRING';
 const ready=!recurring||(s.allowed_terms.length>0&&s.allowed_terms.every(t=>(s.cadence_matrix[t]||[]).length>0));
 async function submit(e){
  e.preventDefault();
  if(!ready){setMsg('Choose at least one term and at least one billing schedule per term.');return}
  setBusy(true);setMsg('');
  try{
   await api('admin/offers',s);
   set(cleanOffer());setMsg('Approved offer created. Generate or email its private payment link below.');onSave();
  }catch(e){setMsg(e.message)}finally{setBusy(false)}
 }
 function toggle(t){
  set(previous=>{
   const enabled=previous.allowed_terms.includes(t);
   const next=enabled?previous.allowed_terms.filter(x=>x!==t):[...previous.allowed_terms,t];
   const matrix={...previous.cadence_matrix};
   if(enabled)delete matrix[t];else matrix[t]=[];
   return {...previous,allowed_terms:next,cadence_matrix:matrix,auto_renew:t==='MONTHLY_FLEX'&&enabled?false:previous.auto_renew};
  });
 }
 function setCadence(t,c){
  set(previous=>{
   const current=previous.cadence_matrix[t]||[];
   const updated=current.includes(c)?current.filter(x=>x!==c):[...current,c];
   return {...previous,cadence_matrix:{...previous.cadence_matrix,[t]:updated}};
  });
 }
 return <form onSubmit={submit} className="offer-form">
  <div className="create-grid">
   <label>Client<select required value={s.client_id} onChange={e=>set({...s,client_id:e.target.value})}><option value="">Select client</option>{(clients||[]).map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>
   <label>Offer title<input required value={s.title} onChange={e=>set({...s,title:e.target.value})} placeholder="Approved growth system"/></label>
   <label>Proposal / SOW reference<input required value={s.commercial_reference} onChange={e=>set({...s,commercial_reference:e.target.value})} placeholder="MDS-SOW-..."/></label>
   <label>Payment family<select value={s.transaction_family} onChange={e=>set({...s,transaction_family:e.target.value,allowed_terms:[],cadence_matrix:{},auto_renew:false})}><option value="ONE_TIME">One-time / project payment</option><option value="RECURRING">Recurring engagement</option></select><span className="field-help">One-time collects once. Recurring lets you approve specific terms and future billing frequencies.</span></label>
   <label>Commercial currency<select value={s.currency} onChange={e=>set({...s,currency:e.target.value})}><option value="EGP">EGP</option><option value="USD">USD</option></select></label>
   <label>Approved professional fee {recurring?'(per month)':'(one-time)'}<input required type="number" min="0" step="0.01" value={s.professional_fee} onChange={e=>set({...s,professional_fee:e.target.value})}/><span className="field-help">{recurring?'Enter the rate for one month; larger billing intervals multiply it automatically.':'Enter the single project charge.'}</span></label>
   <label>Implementation / setup fee<input type="number" min="0" step="0.01" value={s.setup_fee} onChange={e=>set({...s,setup_fee:e.target.value})}/><span className="field-help">Added to the first payment only.</span></label>
   <label>Third-party / pass-through cost<input type="number" min="0" step="0.01" value={s.pass_through_fee} onChange={e=>set({...s,pass_through_fee:e.target.value})}/><span className="field-help">Added to the first payment only.</span></label>
   <label>Approval evidence / document<input required value={s.approval_reference} onChange={e=>set({...s,approval_reference:e.target.value})} placeholder="Approved proposal ID"/></label>
   <label>Commercial approver<input required value={s.approved_by} onChange={e=>set({...s,approved_by:e.target.value})} placeholder="Full name / role"/></label>
  </div>
  {recurring?<div className="term-config">
   <h3>1. Select commitment terms</h3>
   <p className="muted">Select only the contracts approved for this client. No term or schedule is preselected. You may check or uncheck every option.</p>
   {terms.map(t=><div className="term-row plan-option" key={t}>
    <label className="checkline option-heading"><input type="checkbox" checked={s.allowed_terms.includes(t)} onChange={()=>toggle(t)}/><span><strong>{termInfo[t].name}</strong><small className="field-help">{termInfo[t].note}</small></span></label>
    {s.allowed_terms.includes(t)&&<div className="cadence-pills">
     <p className="option-subheading">2. Allowed payment schedules for this commitment (choose at least one)</p>
     <div className="cadence-option-grid">
     {cadences.filter(c=>months[t]>=cadenceMonths[c]&&months[t]%cadenceMonths[c]===0).map(c=><label className="checkline cadence-option" key={c}><input type="checkbox" checked={(s.cadence_matrix[t]||[]).includes(c)} onChange={()=>setCadence(t,c)}/><span><strong>{cadenceInfo[c].name}</strong><small className="field-help">{cadenceInfo[c].note}</small></span></label>)}
     </div>
    </div>}
   </div>)}
   {s.allowed_terms.includes('MONTHLY_FLEX')&&<label className="checkline rolling-option"><input type="checkbox" checked={s.auto_renew} onChange={e=>set({...s,auto_renew:e.target.checked})}/><span><strong>Allow rolling monthly billing for Monthly Flex</strong><small className="field-help">Optional. With client authorization, up to 12 scheduled monthly payments can be collected before review. If off, Monthly Flex is one payment for one month and requires a new agreement to continue.</small></span></label>}
   {!ready&&<p className="field-help option-warning">At least one enabled commitment term must have a selected billing frequency.</p>}
  </div>:<p className="info-note">A one-time payment needs no commitment term or recurring schedule. The client pays the approved project amount once; future card charges are not authorized.</p>}
  <button className="button primary" disabled={busy||!ready}>{busy?'Saving approved offer…':'Create approved offer ↗'}</button>
  {msg&&<div className="notice" role="status">{msg}</div>}
 </form>;
}
function Offers({rows,onSave,clients}){
 const [link,setLink]=useState(''),[msg,setMsg]=useState(''),[working,setWorking]=useState(''),[showRemoved,setShowRemoved]=useState(false);
 const visible=showRemoved?rows:(rows||[]).filter(o=>o.status!=='ARCHIVED');
 async function send(o,sendEmail){
  setWorking(o.id);setMsg('');
  try{const x=await api('admin/send-offer',{offer_id:o.id,expiry_days:7,send_email:sendEmail});setLink(x.link);setMsg(sendEmail?'Payment link generated and email sent.':'Secure payment link generated.');onSave()}
  catch(e){setMsg(e.message)}finally{setWorking('')}
 }
 async function remove(o){
  if(!window.confirm('Remove this offer? Unused offers are deleted; offers with payment history are archived. Active subscriptions must be stopped first.'))return;
  setWorking(o.id);setMsg('');
  try{
   const x=await api('admin/remove-offer',{offer_id:o.id});
   setLink('');setMsg(x.result==='deleted'?'Offer deleted.':x.result==='archived'?'Offer archived; linked billing records were preserved.':'Offer already archived.');
   onSave();
  }catch(e){setMsg(e.message)}finally{setWorking('')}
 }
 return <>
  <div className="section-card"><div className="section-head"><h2>Create an approved offer</h2><span className="hint">Private, client-specific pricing</span></div><OfferForm clients={clients} onSave={onSave}/></div>
  <div className="section-card">
   <div className="section-head"><div><h2>Approved offers</h2><p className="muted small">Remove an unused offer permanently, or archive a billed offer without erasing its payment records.</p></div><label className="checkline"><input type="checkbox" checked={showRemoved} onChange={e=>setShowRemoved(e.target.checked)}/>Show archived offers</label></div>
   {link&&<div className="link-result"><label>Latest secure payment link</label><div className="row-inline"><input readOnly value={link} aria-label="Secure payment link"/><button type="button" className="button secondary" onClick={()=>navigator.clipboard.writeText(link)}>Copy link</button></div></div>}
   {msg&&<div className="notice" role="status">{msg}</div>}
   <Table head={['Client','Approved scope','Currency','Fee','Status','Actions']} rows={visible} render={o=><><td>{o.legal_name}</td><td><strong>{o.title}</strong><small className="table-small">{o.commercial_reference}</small><small className="table-small">{o.transaction_family==='RECURRING'?'Recurring · '+(o.allowed_terms||[]).map(t=>termInfo[t]?.name||t).join(' / ')+(o.allowed_terms?.includes('MONTHLY_FLEX')?(o.auto_renew?' · Rolling Monthly Flex enabled':' · Rolling Monthly Flex off'):''):'One-time / no future charges'}</small></td><td>{o.currency}</td><td>{format(o.professional_fee,o.currency)}</td><td><Status value={o.status}/></td><td>{o.status==='ARCHIVED'?<span className="muted">Removed</span>:<div className="table-actions offer-actions"><button type="button" disabled={!!working} onClick={()=>send(o,false)}>Generate</button><button type="button" disabled={!!working} onClick={()=>send(o,true)}>Email</button><button type="button" className="danger-inline" disabled={!!working} onClick={()=>remove(o)}>Remove</button></div>}</td></>}/>
  </div>
 </>;
}
function BillingAgreements({rows,operations,onSave}){
 const [working,setWorking]=useState(''),[msg,setMsg]=useState('');
 async function stop(s){
  if(!window.confirm('Stop all future automatic charges for this agreement? Existing payments remain unchanged.'))return;
  setWorking(s.id);setMsg('');
  try{await api('admin/stop-renewals',{subscription_id:s.id});setMsg('Future automatic charges stopped. Existing billing records were retained.');onSave()}
  catch(e){setMsg(e.message)}finally{setWorking('')}
 }
 const running=operations?.renewalsEnabled===true;
 return <div className="section-card">
  <div className="section-head"><h2>Billing agreements</h2><span className={'billing-chip '+(running?'is-on':'is-off')}>{running?'Automatic collections enabled':'Automatic collections paused'}</span></div>
  <p className="muted small">Kashier saves authorized card agreements at the initial checkout. MDS runs approved renewal charges on their scheduled dates through the daily collection job (08:00 UTC). A subscription without a saved token and agreement cannot be charged automatically.</p>
  {!operations?.cronConfigured&&<p className="info-note">Scheduled collections require a CRON_SECRET in Vercel Production. The billing job is not authorized without it.</p>}
  {!running&&<p className="info-note">New payments can still be received. Future charges are not submitted automatically until Finance enables recurring collections in the production environment.</p>}
  {msg&&<p className="notice" role="status">{msg}</p>}
  <Table head={['Client / service','Commitment / schedule','Recurring amount','Next due','Remaining','Card agreement','Status','Control']} rows={rows} render={s=><>
   <td><strong>{s.legal_name}</strong><small className="table-small">{s.title}</small></td>
   <td><strong>{termInfo[s.term_code]?.name||s.term_code?.replaceAll('_',' ')}</strong><small className="table-small">{cadenceInfo[s.cadence_code]?.name||s.cadence_code}</small></td>
   <td>{format(s.recurring_amount,s.currency)}</td>
   <td>{date(s.next_charge_at)}</td>
   <td>{s.cycles_remaining}</td>
   <td>{s.cycles_remaining>0?(s.card_saved&&s.agreement_saved?<span className="state green">Ready</span>:<span className="state amber">Token missing</span>):<span className="muted">Not required</span>}</td>
   <td><Status value={s.status}/></td>
   <td>{['ACTIVE','PAST_DUE','PAYMENT_METHOD_REQUIRED','RENEWAL_REVIEW_REQUIRED'].includes(s.status)?<button type="button" className="danger-inline" disabled={!!working} onClick={()=>stop(s)}>Stop future charges</button>:<span className="muted">{s.status==='CANCELLED'?'Stopped':'—'}</span>}</td>
  </>}/>
 </div>;
}
function Approvals({rows,onSave}){const [drafts,setDrafts]=useState({}),[state,setState]=useState('');async function save(x,approved){try{await api('admin/settings',{key:x.key,value:drafts[x.key]??String(x.value??''),status:approved?'APPROVED':'NEEDS_APPROVAL'});setState('Saved securely.');onSave()}catch(e){setState(e.message)}}const pending=rows.filter(x=>x.status!=='APPROVED').length;return <><div className="approval-head"><div><div className="eyebrow">CEO & FINANCE / INFORMATION REGISTER</div><h2>Required information & approvals</h2><p>Complete these details with the CEO and Finance team. Nothing unapproved appears on the public payment pages.</p></div><div className="approval-stat"><b>{pending}</b><small>items awaiting approval</small></div></div>{state&&<p className="notice">{state}</p>}<div className="approval-list">{rows.map(x=><div className="approval-item" key={x.key}><div className="approval-meta"><div className="approval-title"><strong>{fields[x.key]?.[0]||x.key}</strong><Status value={x.status}/></div><p>{fields[x.key]?.[1]||'Administrative billing information'}</p><small>Last updated: {date(x.updated_at)}</small></div><div className="approval-editor"><textarea rows="2" value={drafts[x.key]??String(x.value??'')} onChange={e=>setDrafts({...drafts,[x.key]:e.target.value})} placeholder="Enter the confirmed details or policy reference"/><div className="row-inline"><button className="button secondary" onClick={()=>save(x,false)}>Save draft</button><button className="button primary" onClick={()=>save(x,true)}>Mark approved</button></div></div></div>)}</div></>}
function RefundAction({tx,onSave}){const [open,setOpen]=useState(false),[amount,setAmount]=useState(tx.amount),[reason,setReason]=useState(''),[msg,setMsg]=useState('');if(tx.gateway_status!=='SUCCESS'||!['pay','capture'].includes(tx.event_type))return null;async function submit(e){e.preventDefault();try{const data=await api('admin/refund',{transaction_id:tx.id,amount,reason,idempotencyKey:crypto.randomUUID()});setMsg(`Refund request: ${data.status}`);onSave()}catch(e){setMsg(e.message)}}return <div>{!open?<button className="inline-link" onClick={()=>setOpen(true)}>Refund</button>:<form className="mini-refund" onSubmit={submit}><input type="number" min="0.01" max={tx.amount} step="0.01" aria-label="Refund amount" value={amount} onChange={e=>setAmount(e.target.value)}/><input required aria-label="Refund reason" placeholder="Approved reason" value={reason} onChange={e=>setReason(e.target.value)}/><button>Submit</button></form>}{msg&&<small>{msg}</small>}</div>}
export default function AdminCenter({changeRequired}){const [mustChange,setMustChange]=useState(changeRequired),[tab,setTab]=useState('Overview'),[data,setData]=useState({}),[clients,setClients]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');const load=useCallback(async(x)=>{setBusy(true);setError('');try{const r=await fetch(`/api/admin/${endpoints[x]}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load data');setData(d)}catch(e){setError(e.message)}finally{setBusy(false)}},[]);useEffect(()=>{if(!mustChange){load(tab);if(tab==='Approved offers')fetch('/api/admin/clients').then(r=>r.json()).then(x=>setClients(x.clients||[])).catch(()=>{})}},[tab,load,mustChange]);if(mustChange)return <PasswordChange done={()=>setMustChange(false)}/>;
return <main className="workspace"><aside className="sidebar"><Brand light/><div className="side-caption">FINANCE & BILLING</div>{sections.map(([name,icon])=><button key={name} onClick={()=>setTab(name)} className={`side-item ${tab===name?'active':''}`}><span>{icon}</span>{name}{name==='CEO approvals'&&<small className="pill-mini">CEO</small>}</button>)}<div className="side-bottom"><Link href="/payments">View client portal ↗</Link><button onClick={async()=>{await api('auth/logout',{});location.assign('/login')}}>Sign out</button></div></aside><div className="workspace-main"><header className="workspace-top"><div><div className="eyebrow">MEDICAL DIGITAL SOLUTIONS / FINANCE CONSOLE</div></div><div className="workspace-account"><span className="account-avatar">M</span><span>Finance Admin</span></div></header><div className="workspace-content"><div className="page-intro"><div className="eyebrow">FINANCIAL OPERATIONS</div><h1>{tab}</h1><p className="muted">{tab==='CEO approvals'?'Commercial and legal details for leadership sign-off':'Centralized oversight of approved billing and payment activity.'}</p></div>{tab==='Overview'&&<section className="workspace-banner finance-banner" aria-label="Finance operations"><div className="workspace-banner-copy"><span className="workspace-banner-pill">MDS FINANCE CENTER</span><h2>Better oversight.<br/><span>Smarter decisions.</span></h2><p>Keep your clients, collections and approvals in one focused workspace.</p></div><div className="workspace-banner-art" aria-hidden="true"><img src="/brand/finance-access.avif" alt="" /></div></section>}{error&&<div className="alert">{error}</div>}{busy?<div className="loading">Loading secure financial records…</div>:<>{tab==='Overview'&&<><div className="metric-grid"><Metric label="CLIENT ACCOUNTS" value={data.counts?.clients??0} detail="Registered billing accounts"/><Metric label="APPROVED OFFERS" value={data.counts?.offers??0} detail="Private commercial records"/><Metric label="PAID REQUESTS" value={data.counts?.paid??0} detail="Verified collections"/><Metric label="PAST-DUE ACCOUNTS" value={data.counts?.past_due??0} detail="Require Finance attention"/></div><div className="section-card"><div className="section-head"><h2>Recent payment requests</h2><button className="inline-link" onClick={()=>setTab('Payment requests')}>View all ↗</button></div><Table head={['Client','Service','Amount','Status']} rows={data.payments} render={r=><><td>{r.legal_name}</td><td>{r.title}</td><td>{format(r.amount,r.currency)}</td><td><Status value={r.status}/></td></>}/></div><div className="dashboard-pair"><div className="section-card"><h2>Upcoming billing</h2><Table head={['Client','Next date','Status']} rows={data.reviews?.slice(0,7)} render={r=><><td>{r.legal_name}</td><td>{date(r.next_charge_at)}</td><td><Status value={r.status}/></td></>}/></div><div className="section-card"><h2>Finance attention</h2><p><strong>{data.exceptions?.length||0}</strong> reconciliation exceptions</p><p><strong>{data.notifications?.length||0}</strong> failed notifications</p><button className="button secondary" onClick={()=>setTab('Reconciliation')}>Open exceptions ↗</button></div></div></>}
{tab==='Clients'&&<><div className="section-card"><h2>Add client account</h2><ClientForm onSave={()=>load(tab)}/></div><div className="section-card"><h2>Client accounts</h2><Table head={['Client','Billing email','Language','Status']} rows={data.clients} render={x=><><td><strong>{x.legal_name}</strong></td><td>{x.billing_email}</td><td>{x.locale.toUpperCase()}</td><td><Status value={x.status}/></td></>}/></div></>}
{tab==='Approved offers'&&<Offers rows={data.offers||[]} clients={clients} onSave={()=>load(tab)}/>}
{tab==='Payment requests'&&<div className="section-card"><h2>Payment requests</h2><Table head={['Client','Scope','Reference','Amount','Status','Created']} rows={data.requests} render={r=><><td>{r.legal_name}</td><td>{r.title}</td><td className="mono small">{r.public_reference?.slice(0,12)}</td><td>{format(r.amount,r.currency)}</td><td><Status value={r.status}/></td><td>{date(r.created_at)}</td></>}/></div>}
{tab==='Subscriptions'&&<BillingAgreements rows={data.subscriptions||[]} operations={data.billingOperations||{}} onSave={()=>load(tab)}/>}
{tab==='Invoices'&&<div className="section-card"><h2>Payment statements</h2><Table head={['Reference','Client','Amount','Issued','Tax status','Document']} rows={data.invoices} render={r=><><td className="mono">{r.invoice_number}</td><td>{r.legal_name}</td><td>{format(r.amount,r.currency)}</td><td>{date(r.issued_at)}</td><td><Status value={r.tax_status}/></td><td><a className="text-link" target="_blank" rel="noreferrer" href={`/api/invoices/${r.id}`}>View ↗</a></td></>}/></div>}
{tab==='Transactions'&&<div className="section-card"><h2>Gateway transactions</h2><Table head={['Client','Event','Amount','Date','Status','Action']} rows={data.transactions} render={tx=><><td>{tx.legal_name||'—'}</td><td>{tx.event_type}</td><td>{format(tx.amount,tx.currency)}</td><td>{date(tx.recorded_at)}</td><td><Status value={tx.gateway_status}/></td><td><RefundAction tx={tx} onSave={()=>load(tab)}/></td></>}/></div>}
{tab==='Reconciliation'&&<><div className="section-card"><h2>Open finance exceptions</h2><Table head={['Category','Detail','Received','Status']} rows={data.exceptions} render={e=><><td>{e.category}</td><td>{e.detail}</td><td>{date(e.created_at)}</td><td><Status value={e.status}/></td></>}/></div><div className="section-card"><h2>Webhook delivery log</h2><Table head={['Event','Mode','Status','Processing','Received']} rows={data.webhooks} render={w=><><td>{w.event_name}</td><td>{w.mode}</td><td><Status value={w.gateway_status}/></td><td><Status value={w.process_status}/></td><td>{date(w.received_at)}</td></>}/></div></>}
{tab==='CEO approvals'&&<Approvals rows={data.settings||[]} onSave={()=>load(tab)}/>}
{tab==='Support'&&<div className="section-card"><h2>Billing requests</h2><Table head={['Email','Category','Message','Date','Status','Action']} rows={data.tickets} render={t=><><td>{t.email}</td><td>{t.category}</td><td><div className="clip-text">{t.message}</div></td><td>{date(t.created_at)}</td><td><Status value={t.status}/></td><td><button className="inline-link" onClick={async()=>{await api('admin/support',{id:t.id,status:t.status==='RESOLVED'?'OPEN':'RESOLVED'});load(tab)}}>{t.status==='RESOLVED'?'Reopen':'Resolve'}</button></td></>}/></div>}
{tab==='Audit trail'&&<div className="section-card"><h2>Administrative activity</h2><Table head={['Action','Entity','Reference','Date']} rows={data.events} render={x=><><td>{x.action}</td><td>{x.entity_type}</td><td className="mono small">{x.entity_id?.slice(0,28)||'—'}</td><td>{date(x.occurred_at)}</td></>}/></div>}</>}</div></div></main>}
function Metric({label,value,detail}){return <div className="metric"><label>{label}</label><strong>{value}</strong><small>{detail}</small></div>}
