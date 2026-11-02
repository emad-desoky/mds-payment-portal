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


const termInfo={MONTHLY_FLEX:{name:'Monthly (legacy)'},COMMIT_3M:{name:'3-month (legacy)'},COMMIT_6M:{name:'6-month (legacy)'},COMMIT_12M:{name:'12-month (legacy)'}};
const cadenceInfo={MONTHLY:{name:'Monthly'},QUARTERLY:{name:'Quarterly'},SEMIANNUAL:{name:'Every 6 months'},ANNUAL_UPFRONT:{name:'Yearly upfront'}};
const money2=n=>Math.round(Number(n||0)*100)/100;
const defaultPackages=()=>[{months:1,discountType:'NONE',discountValue:0},{months:3,discountType:'NONE',discountValue:0}];
const cleanOffer=()=>({client_id:'',title:'',commercial_reference:'',transaction_family:'ONE_TIME',currency:'EGP',
 professional_fee:0,setup_fee:0,pass_through_fee:0,approval_reference:'',approved_by:'',
 packages:defaultPackages(),allow_auto_charge:true,first_monthly_renewal_date:''});
const tomorrowCairo=()=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const v=t=>p.find(x=>x.type===t)?.value;const d=new Date(v('year')+'-'+v('month')+'-'+v('day')+'T00:00:00Z');
 d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};
function preparedPackages(offer){
 const saved=offer.cadence_matrix?.__packages;
 if(Array.isArray(saved)&&saved.length)return saved.map(p=>({months:Number(p.months),discountType:p.discountType||'NONE',discountValue:Number(p.discountValue||0)}));
 const m=Number(offer.billing_period_months)||1;
 const legacy={months:m,discountType:offer.plan_discount_type||'NONE',discountValue:Number(offer.plan_discount_value||0)};
 return m===1?[legacy]:[{months:1,discountType:'NONE',discountValue:0},legacy];
}
function packageAmounts(s,packageItem){
 const monthly=Number(s.professional_fee)||0,months=Number(packageItem.months),gross=money2(monthly*months);
 const type=packageItem.discountType||'NONE',value=Number(packageItem.discountValue)||0;
 const saved=type==='PERCENT'?money2(gross*value/100):type==='FIXED'?value:0;
 return {gross,saved,price:money2(gross-saved)};
}
function validFinancePackages(s){
 const packages=s.packages||[],months=new Set();
 if(!packages.length||packages.length>16||Number(s.professional_fee)<=0)return false;
 return packages.every(p=>{
  const m=Number(p.months),d=Number(p.discountValue||0),numbers=packageAmounts(s,p);
  if(!Number.isInteger(m)||m<1||m>36||months.has(m)||!Number.isFinite(d)||d<0||numbers.price<=0)return false;
  months.add(m);return p.discountType==='PERCENT'?d<100:true;
 });
}
function FinancePlanFields({s,set}){
 const [customMonth,setCustomMonth]=useState(2);
 const packages=[...(s.packages||[])].sort((a,b)=>a.months-b.months);
 const savePackages=next=>set({...s,packages:[...next].sort((a,b)=>a.months-b.months)});
 function toggle(m){savePackages(packages.some(p=>p.months===m)?packages.filter(p=>p.months!==m):
  [...packages,{months:m,discountType:'NONE',discountValue:0}])}
 function patch(m,data){savePackages(packages.map(p=>p.months===m?{...p,...data}:p))}
 const present=new Set(packages.map(p=>Number(p.months)));
 const fixed=[1,3,6,12];
 return <div className="term-config">
  <h3>Payment packages the client may choose</h3>
  <p className="muted">MDS Finance sets the monthly fee, which prepaid packages to offer, and each discount. The client chooses between these approved packages at checkout.</p>
  {fixed.map(m=><div className="plan-option" key={m}>
   <label className="checkline option-heading"><input type="checkbox" checked={present.has(m)} onChange={()=>toggle(m)}/>
    <span><strong>{m===1?'Monthly payment':m+' months prepaid'}</strong><small className="field-help">{m===1?'Standard monthly service rate':'Optional prepaid package — add your approved savings below.'}</small></span>
   </label>
   {present.has(m)&&<PackageDiscountControls s={s} item={packages.find(p=>p.months===m)} patch={data=>patch(m,data)}/>}
  </div>)}
  {packages.filter(p=>!fixed.includes(p.months)).map(p=><div className="plan-option" key={p.months}>
   <div className="row" style={{alignItems:'center',justifyContent:'space-between'}}>
    <strong>{p.months} months · custom package</strong><button type="button" className="danger-inline" onClick={()=>toggle(p.months)}>Remove</button>
   </div>
   <PackageDiscountControls s={s} item={p} patch={data=>patch(p.months,data)}/>
  </div>)}
  <div className="row-inline" style={{gap:10,marginTop:14,flexWrap:'wrap'}}>
   <label>Custom duration (months)
    <input type="number" min="1" max="36" step="1" value={customMonth} onChange={e=>setCustomMonth(e.target.value)} style={{maxWidth:145}}/>
   </label>
   <button type="button" className="button secondary" disabled={!Number.isInteger(Number(customMonth))||Number(customMonth)<1||Number(customMonth)>36||present.has(Number(customMonth))}
    onClick={()=>toggle(Number(customMonth))}>Add custom package +</button>
  </div>
  <div className="create-grid" style={{marginTop:22}}>
   <label>Preferred renewal date / day
    <input type="date" required min={tomorrowCairo()} value={s.first_monthly_renewal_date}
     onChange={e=>set({...s,first_monthly_renewal_date:e.target.value})}/>
    <span className="field-help">Sets the preferred billing day. The first renewal is automatically scheduled AFTER the full package selected by the client (1, 3, 6 or more months). This avoids charging again before prepaid coverage ends.</span>
   </label>
  </div>
  <label className="checkline rolling-option"><input type="checkbox" checked={!!s.allow_auto_charge}
    onChange={e=>set({...s,allow_auto_charge:e.target.checked})}/>
   <span><strong>Allow automatic renewal (recommended)</strong>
    <small className="field-help">Clients may opt in to automatic billing on their selected package's renewal dates. They can also keep it off and pay renewal reminders manually.</small>
   </span>
  </label>
  {!validFinancePackages(s)&&<p className="field-help option-warning">Approve at least one valid, positively priced package. Each duration must be unique.</p>}
  <div className="info-note pricing-preview">
   <strong>Approved choices — {s.currency}</strong>
   {packages.map(p=>{const a=packageAmounts(s,p);return <div className="summary-row" key={p.months}>
    <span>{p.months===1?'Monthly':p.months+' months'}{a.saved>0?' · saving '+format(a.saved,s.currency):''}</span>
    <b>{format(a.price,s.currency)}</b>
   </div>})}
   <small className="field-help">These prices exclude the initial setup/third-party charges, which apply only on the first payment. Taxes are applied when approved.</small>
  </div>
 </div>;
}
function PackageDiscountControls({s,item,patch}){
 const a=packageAmounts(s,item);
 return <div className="create-grid" style={{marginTop:10}}>
  <label>Discount type
   <select value={item.discountType||'NONE'} onChange={e=>patch({discountType:e.target.value,discountValue:0})}>
    <option value="NONE">No discount</option>
    <option value="PERCENT">Percentage off (%)</option>
    <option value="FIXED">Fixed amount off ({s.currency})</option>
   </select>
  </label>
  {item.discountType!=='NONE'&&<label>{item.discountType==='PERCENT'?'Discount percentage':'Discount amount ('+s.currency+')'}
    <input type="number" min="0" max={item.discountType==='PERCENT'?99.99:undefined} step="0.01"
     value={item.discountValue} onChange={e=>patch({discountValue:e.target.value})}/>
   </label>}
  <div className="info-note"><strong>{format(a.price,s.currency)}</strong>
   {a.saved>0&&<span className="field-help">Save {format(a.saved,s.currency)} on this package (regular price {format(a.gross,s.currency)}).</span>}
  </div>
 </div>;
}
function OfferForm({clients,onSave}){
 const [s,set]=useState(cleanOffer),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const recurring=s.transaction_family==='RECURRING';
 const ready=!recurring||(validFinancePackages(s)&&!!s.first_monthly_renewal_date);
 async function submit(e){
  e.preventDefault();if(!ready){setMsg('Please approve at least one package, discounts and preferred renewal date.');return}
  setBusy(true);setMsg('');
  try{await api('admin/offers',s);set(cleanOffer());setMsg('Approved offer created. Generate or email the private link below.');onSave()}
  catch(e){setMsg(e.message)}finally{setBusy(false)}
 }
 return <form onSubmit={submit} className="offer-form">
  <div className="create-grid">
   <label>Client<select required value={s.client_id} onChange={e=>set({...s,client_id:e.target.value})}><option value="">Select client</option>{(clients||[]).map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>
   <label>Offer title<input required value={s.title} onChange={e=>set({...s,title:e.target.value})} placeholder="Monthly digital marketing service"/></label>
   <label>Proposal / SOW reference<input required value={s.commercial_reference} onChange={e=>set({...s,commercial_reference:e.target.value})}/></label>
   <label>Payment type<select value={s.transaction_family} onChange={e=>set({...s,transaction_family:e.target.value})}>
    <option value="ONE_TIME">One-time project payment</option><option value="RECURRING">Recurring service with package choices</option></select></label>
   <label>Currency<select value={s.currency} onChange={e=>set({...s,currency:e.target.value})}><option value="EGP">EGP</option><option value="USD">USD</option></select></label>
   <label>Professional fee {recurring?'per month':'one-time'}<input required type="number" min="0" step="0.01" value={s.professional_fee} onChange={e=>set({...s,professional_fee:e.target.value})}/></label>
   <label>Implementation / setup (first payment only)<input type="number" min="0" step="0.01" value={s.setup_fee} onChange={e=>set({...s,setup_fee:e.target.value})}/></label>
   <label>Third-party costs (first payment only)<input type="number" min="0" step="0.01" value={s.pass_through_fee} onChange={e=>set({...s,pass_through_fee:e.target.value})}/></label>
   <label>Approval reference<input required value={s.approval_reference} onChange={e=>set({...s,approval_reference:e.target.value})}/></label>
   <label>Approved by<input required value={s.approved_by} onChange={e=>set({...s,approved_by:e.target.value})}/></label>
  </div>
  {recurring?<FinancePlanFields s={s} set={set}/>:<p className="info-note">One-time payment — no renewal subscription is created.</p>}
  <button type="submit" className="button primary" disabled={busy||!ready}>{busy?'Saving…':'Create approved offer ↗'}</button>
  {msg&&<p className="notice" role="status">{msg}</p>}
 </form>;
}
function EditPlan({offer,onClose,onSave}){
 const [s,set]=useState({packages:preparedPackages(offer),professional_fee:Number(offer.professional_fee),
  setup_fee:Number(offer.setup_fee),pass_through_fee:Number(offer.pass_through_fee),currency:offer.currency,
  first_monthly_renewal_date:String(offer.first_monthly_renewal_date||'').slice(0,10),
  allow_auto_charge:!!offer.allow_auto_charge});
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 async function save(e){e.preventDefault();setBusy(true);setMsg('');
  try{await api('admin/update-offer-plan',{offer_id:offer.id,...s});
   setMsg('New packages approved. Generate a fresh payment link below.');onSave()}
  catch(e){setMsg(e.message)}finally{setBusy(false)}
 }
 return <form className="offer-edit-form" onSubmit={save}>
  <h3>Edit payment options: {offer.title}</h3>
  <p className="muted small">For offers without completed payment. Changes invalidate the old payment link so the client always sees the latest approved pricing.</p>
  <div className="create-grid">
   <label>Monthly fee<input type="number" min="0" step="0.01" required value={s.professional_fee} onChange={e=>set({...s,professional_fee:e.target.value})}/></label>
   <label>Setup fee<input type="number" min="0" step="0.01" value={s.setup_fee} onChange={e=>set({...s,setup_fee:e.target.value})}/></label>
   <label>Third-party costs<input type="number" min="0" step="0.01" value={s.pass_through_fee} onChange={e=>set({...s,pass_through_fee:e.target.value})}/></label>
  </div>
  <FinancePlanFields s={s} set={set}/>
  <div className="row-inline"><button className="button primary" type="submit" disabled={busy||!validFinancePackages(s)||!s.first_monthly_renewal_date}>{busy?'Saving…':'Save approved packages'}</button>
   <button className="button secondary" type="button" onClick={onClose}>Close</button></div>
  {msg&&<p className="notice" role="status">{msg}</p>}
 </form>;
}
function Offers({rows,onSave,clients}){
 const [link,setLink]=useState(''),[msg,setMsg]=useState(''),[working,setWorking]=useState(''),[showRemoved,setShowRemoved]=useState(false);
 const [editing,setEditing]=useState(null);
 async function toggleAuto(o){
  setWorking(o.id);setMsg('');
  try{
   const x=await api('admin/toggle-auto-charge',{offer_id:o.id,enabled:!o.allow_auto_charge});
   setMsg(x.allowAutoCharge?'Client Auto-charge opt-in is now allowed for this offer.':'Auto-charge disabled for this unpaid offer.');
   onSave();
  }catch(e){setMsg(e.message)}finally{setWorking('')}
 }
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
   {editing&&<EditPlan key={editing.id} offer={editing} onClose={()=>setEditing(null)} onSave={()=>{onSave();setEditing(null)}}/>}
   <Table head={['Client','Approved scope','Currency','Fee','Status','Actions']} rows={visible} render={o=><><td>{o.legal_name}</td><td><strong>{o.title}</strong><small className="table-small">{o.commercial_reference}</small><small className="table-small">{o.transaction_family==='RECURRING'?(o.cadence_matrix?.__packages?.length?o.cadence_matrix.__packages.length+' approved package options':o.billing_period_months?'Monthly or '+o.billing_period_months+'-month plan':'Legacy recurring offer')+''+(o.first_monthly_renewal_date?' · Renews '+String(o.first_monthly_renewal_date).slice(0,10):'')+(o.allow_auto_charge?' · Auto-renew available':' · Manual links only'):'One-time / no future charges'}</small></td><td>{o.currency}</td><td>{format(o.professional_fee,o.currency)}</td><td><Status value={o.status}/></td><td>{o.status==='ARCHIVED'?<span className="muted">Removed</span>:<div className="table-actions offer-actions"><button type="button" disabled={!!working} onClick={()=>send(o,false)}>Generate</button><button type="button" disabled={!!working} onClick={()=>send(o,true)}>Email</button>{o.transaction_family==='RECURRING'&&<button type="button" disabled={!!working} onClick={()=>setEditing(o)}>Edit plan</button>}{o.transaction_family==='RECURRING'&&<button type="button" disabled={!!working} title="Only unpaid offers can change automatic collection availability" onClick={()=>toggleAuto(o)}>{o.allow_auto_charge?'Disable Auto-renew':'Enable Auto-renew'}</button>}
   <button type="button" className="danger-inline" disabled={!!working} onClick={()=>remove(o)}>Remove</button></div>}</td></>}/>
  </div>
 </>;
}
function BillingAgreements({rows,operations,onSave}){
 const [working,setWorking]=useState(''),[msg,setMsg]=useState('');
 async function stop(s){
  if(!window.confirm('Remove this subscription from future billing? It will STOP all reminders, payment links and automatic card charges; paid invoices will remain saved.'))return;
  setWorking(s.id);setMsg('');
  try{await api('admin/stop-renewals',{subscription_id:s.id});setMsg('Subscription stopped. Future invoices, reminders and card charges disabled.');onSave()}
  catch(e){setMsg(e.message)}finally{setWorking('')}
 }
 async function manual(s){
  if(!window.confirm('Disable automatic card charges and switch this subscription to manual payment links and reminders?'))return;
  setWorking(s.id);setMsg('');
  try{await api('admin/disable-auto-charge',{subscription_id:s.id});setMsg('Automatic card charges disabled; monthly invoice reminders will be used.');onSave()}
  catch(e){setMsg(e.message)}finally{setWorking('')}
 }
 return <div className="section-card">
  <div className="section-head"><h2>Service subscriptions</h2><span className={'billing-chip '+(operations?.manualReminders?'is-on':'is-off')}>{operations?.manualReminders?'Manual reminders scheduled':'Reminder scheduler not configured'}</span></div>
  <p className="muted small">Each service has its own billing agreement and monthly installment. Manual is the default: clients receive a secure one-time Kashier checkout link and reminders once per overdue day until paid or stopped. No saved card is required. Auto-charge is only offered when Finance enables it and the client consents during checkout.</p>
  {!operations?.cronConfigured&&<p className="info-note">Add a Production CRON_SECRET to Vercel so the daily email reminders can run.</p>}
  {msg&&<p className="notice" role="status">{msg}</p>}
  <Table head={['Client / service','Billing method / plan','Next due','Amount','Pending invoice','Status','Controls']} rows={rows} render={s=><>
   <td><strong>{s.legal_name}</strong><small className="table-small">{s.title}</small></td>
   <td><strong>{s.collection_method==='AUTO'?'Automatic card':'Manual payment links'}</strong><small className="table-small">{s.billing_period_months>0?s.billing_period_months+'-month package':termInfo[s.term_code]?.name||s.term_code?.replaceAll('_',' ')} · {s.billing_period_months>0?'Every '+s.billing_period_months+' month(s)':cadenceInfo[s.cadence_code]?.name||s.cadence_code}</small></td>
   <td>{date(s.next_charge_at)}</td>
   <td>{format(s.recurring_amount,s.currency)}</td>
   <td>{s.pending_payment_link?<><a target="_blank" rel="noreferrer" className="text-link" href={s.pending_payment_link}>Open secure invoice ↗</a><small className="table-small">Due: {date(s.pending_due_date)} · Reminders sent: {s.pending_reminders||0}</small></>:<span className="muted">{s.status==='CANCELLED'?'Stopped':'Created on due date'}</span>}</td>
   <td><Status value={s.status}/>{s.collection_method==='AUTO'&&<small className="table-small">{s.card_saved&&s.agreement_saved?'Card authorized':'Card agreement missing'}</small>}</td>
   <td><div className="table-actions offer-actions">{s.collection_method==='AUTO'&&['ACTIVE','PAST_DUE'].includes(s.status)&&<button type="button" disabled={!!working} onClick={()=>manual(s)}>Disable auto-charge</button>}
    {['ACTIVE','PAST_DUE','PAYMENT_METHOD_REQUIRED','RENEWAL_REVIEW_REQUIRED'].includes(s.status)?<button type="button" className="danger-inline" disabled={!!working} onClick={()=>stop(s)}>Stop subscription & reminders</button>:<span className="muted">{s.status==='CANCELLED'?'Stopped':'Finance review required'}</span>}</div></td>
  </>}/>
  <p className="muted small">Automatic charges: {operations?.renewalsEnabled?'globally enabled':'globally paused'}. Manual reminders are separate and remain active while the subscription is unpaid. Do not re-enable Auto-charge without fresh client authorization.</p>
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
