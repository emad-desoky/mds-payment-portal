'use client';
import {useState,useEffect} from 'react';
export default function MonthlyCheckout({token}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[accepted,setAccepted]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let alive=true;fetch('/api/manual-cycle?token='+encodeURIComponent(token),{cache:'no-store'})
  .then(r=>r.json()).then(x=>{if(alive){setData(x);setLoading(false)}})
  .catch(()=>{if(alive){setError('The billing link could not be opened. Please contact MDS Finance.');setLoading(false)}});
  return()=>{alive=false}},[token]);
 const cycle=data?.cycle;
 const format=(n,c)=>new Intl.NumberFormat('en-EG',{style:'currency',currency:c||'EGP'}).format(Number(n||0));
 async function pay(){
  if(!accepted||busy)return;setBusy(true);setError('');
  try{
   const r=await fetch('/api/manual-cycle/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to open secure checkout.');
   window.location.assign(d.checkoutUrl);
  }catch(e){setError(e.message);setBusy(false)}
 }
 return <section className="container invalid" style={{paddingBlock:55}}>
  {loading?<p className="muted">Checking your monthly payment…</p>:!data?.valid?<><span className="eyebrow">MONTHLY INVOICE</span><h1>Payment link unavailable</h1><p>This payment may already be paid, or the service was stopped. Contact MDS Finance if you need help.</p><a className="button secondary" href="/payments#support">Contact billing ↗</a></>:<>
   <span className="eyebrow">YOUR MONTHLY SERVICE PAYMENT</span><h1>Pay monthly invoice</h1>
   <div className="panel" style={{maxWidth:650,textAlign:'left',marginTop:25}}>
    <div className="eyebrow">MEDICAL DIGITAL SOLUTIONS</div>
    <h2>{cycle.title}</h2><p><strong>{cycle.company}</strong></p>
    <p className="muted">Service reference: {cycle.reference} · Due: {cycle.dueDate}</p>
    <div className="divider"/>
    <div className="amount-overline">AMOUNT TO PAY</div><div className="amount-major">{format(cycle.amount,cycle.currency)}</div>
    <p className="muted">This installment uses the standard one-time Kashier checkout. No card will be saved or charged automatically. Once payment is verified, monthly reminders for this invoice stop.</p>
    <label className="checkline"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I have reviewed this service, amount and due date and approve this one-time payment.</span></label>
    <button className="button primary full" disabled={!accepted||busy} onClick={pay}>{busy?'Opening secure checkout…':'Continue to secure payment ↗'}</button>
    {error&&<p className="alert" role="alert">{error}</p>}
   </div>
  </>}
 </section>;
}
