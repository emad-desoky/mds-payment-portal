'use client';
import {useState,useEffect} from 'react';
function format(n,c){return new Intl.NumberFormat('en-EG',{style:'currency',currency:c||'EGP'}).format(Number(n||0))}
export default function PayFlow({token,offer}){
 const recurring=offer.kind==='RECURRING';
 const approved=offer.packages||[];
 const [selectedMonths,setSelectedMonths]=useState(approved.some(p=>p.months===1)?1:(approved[0]?.months||1));
 const [autoRenew,setAutoRenew]=useState(false);
 const [quote,setQuote]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const allowAuto=recurring&&offer.allowAutoCharge===true&&offer.autoChargeOperational===true;
 useEffect(()=>{
  let active=true;
  setLoading(true);setQuote(null);setError('');
  fetch('/api/offer/quote',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({token,billingMonths:selectedMonths,autoRenew})})
   .then(async r=>{const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'Your approved price is temporarily unavailable.');return j.quote})
   .then(q=>{if(active){setQuote(q);setLoading(false)}})
   .catch(e=>{if(active){setError(e.message);setLoading(false)}});
  return()=>{active=false};
 },[token,selectedMonths,autoRenew]);
 async function proceed(){
  if(!quote||busy)return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/offer/checkout',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({token,billingMonths:selectedMonths,autoRenew,autoChargeConsent:autoRenew,idempotencyKey:crypto.randomUUID()})});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Unable to open your secure payment page.');
   window.location.assign(j.checkoutUrl);
  }catch(e){setError(e.message);setBusy(false)}
 }
 const months=quote?.planMonths||selectedMonths;
 const saving=Number(quote?.discountAmount||0);
 return <div className="container pay-layout">
  <section className="pay-main">
   <div className="eyebrow">MEDICAL DIGITAL SOLUTIONS</div>
   <h1>Review your approved payment</h1>
   <p className="muted">Choose the payment plan that works best for you. All prices and savings are approved by MDS Finance.</p>
   <div className="stepper"><span className="active">01 Choose plan</span><span>02 Auto-renew</span><span>03 Secure payment</span></div>
   <div className="panel">
    <div className="eyebrow">PAYMENT FOR</div><h2>{offer.title}</h2>
    <p><strong>{offer.company}</strong><br/><span className="muted">Reference: {offer.ref}</span></p>
   </div>
   {recurring&&<div className="panel">
    <h3>Choose how you'd like to pay</h3>
    <p className="muted">Pay monthly at the regular rate, or choose a prepaid package and save.</p>
    <div className="plan-choice-grid">{approved.map(p=><button type="button" key={p.months}
     className={'plan-choice '+(selectedMonths===p.months?'plan-choice-selected':'')}
     aria-pressed={selectedMonths===p.months}
     onClick={()=>{if(busy)return;setSelectedMonths(p.months);setAutoRenew(false);setQuote(null)}}>
     <span className="plan-choice-heading">
      <strong>{p.months===1?'Pay monthly':'Pay '+p.months+' months upfront'}</strong>
      {p.saving>0&&<span className="plan-saving">Save {format(p.saving,offer.currency)}</span>}
     </span>
     <span className="plan-choice-total">{format(p.price,offer.currency)}</span>
     {p.saving>0?<span className="plan-choice-original">Instead of {format(p.gross,offer.currency)}</span>
      :<span className="plan-choice-original">{p.months===1?'Regular monthly price':'Approved prepaid price'}</span>}
     <span className="field-help">{p.months===1?'Billed once a month':'One payment covers '+p.months+' months of service'}</span>
    </button>)}</div>
    <p className="muted small">One-time setup costs, if applicable, are shown separately in your payment summary.</p>
   </div>}
   {recurring&&<div className="panel">
    <div className="row" style={{alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
     <h3 style={{margin:0}}>Automatic renewal</h3>{allowAuto&&<span className="billing-chip is-on">Recommended</span>}
    </div>
    <p className="muted">Keep your selected plan going automatically, or pay each renewal when it's due.</p>
    <label className={'auto-renew-control '+(autoRenew?'auto-renew-active':'')}>
     <span><strong>Automatically renew my service</strong>
      <small className="field-help">{allowAuto?'Renew at the approved price on each scheduled renewal date.':'Please contact MDS Finance to enable automatic renewal for this offer.'}</small>
     </span>
     <input type="checkbox" role="switch" aria-label="Authorize automatic renewal" checked={autoRenew}
      disabled={!allowAuto||busy} onChange={e=>setAutoRenew(e.target.checked)}/>
    </label>
    {autoRenew?<p className="info-note">I authorize MDS to charge {quote?format(quote.futureCharge,quote.currency):'the approved renewal price'} on {quote?.nextPaymentDate||'the agreed renewal date'} and every {months} month{months===1?'':'s'} afterward, for up to 12 payments. I can request cancellation through MDS Finance.</p>
     :<p className="muted small">We'll remind you when your next payment is due.</p>}
   </div>}
   <div className="panel review-panel">
    <h3>Secure payment</h3>
    <p>{recurring?'Your selected plan is shown in the payment summary.':'Your approved project payment is shown in the payment summary.'}</p>
    <button type="button" className="button primary full" disabled={!quote||loading||busy}
     onClick={proceed}>{busy?'Opening secure payment…':'Continue to secure payment ↗'}</button>
    <p className="muted small">By continuing, you approve your selected payment plan and the amount shown. Card details are entered securely with Kashier.</p>
   </div>
   {error&&<div className="alert" role="alert">{error}</div>}
  </section>
  <aside className="order-card">
   <div className="eyebrow">YOUR PAYMENT SUMMARY</div>
   <div className="summary-client">{offer.company}<small>{offer.ref}</small></div>
   {quote?<><div className="amount-overline">PAY TODAY</div>
    <div className="amount-major">{format(quote.firstCharge,quote.currency)}</div>
    <div className="divider"/>
    {recurring&&<div className="summary-row"><span>Your selected plan</span><b>{months===1?'Monthly':months+' months upfront'}</b></div>}
    <div className="summary-row"><span>Currency</span><b>{quote.currency}</b></div>
    <div className="summary-row"><span>Monthly service fee</span><b>{format(quote.monthlyProfessional,quote.currency)}{recurring?' / month':''}</b></div>
    {recurring&&<div className="summary-row"><span>Service fee before savings</span><b>{format(quote.grossCycle,quote.currency)}</b></div>}
    {saving>0&&<div className="summary-row"><span>Approved savings</span><b>− {format(saving,quote.currency)}</b></div>}
    {Number(quote.setup)-Number(quote.setupReduction||0)>0&&<div className="summary-row"><span>One-time setup</span><b>{format(quote.setup-Number(quote.setupReduction||0),quote.currency)}</b></div>}
    {Number(quote.passThrough)>0&&<div className="summary-row"><span>Third-party costs</span><b>{format(quote.passThrough,quote.currency)}</b></div>}
    {quote.tax==null?<p className="muted small">Any applicable taxes will follow your approved agreement.</p>
      :<div className="summary-row"><span>Tax</span><b>{format(quote.tax,quote.currency)}</b></div>}
    {recurring&&<><div className="divider"/>
     <div className="summary-row"><span>Renewal frequency</span><b>Every {months} month{months===1?'':'s'}</b></div>
     <div className="summary-row"><span>Renewal payment</span><b>{format(quote.futureCharge,quote.currency)}</b></div>
     {quote.nextPaymentDate&&<div className="summary-row"><span>First renewal</span><b>{quote.nextPaymentDate}</b></div>}
     <div className="summary-row"><span>Automatic renewal</span><b>{autoRenew?'On':'Off'}</b></div>
    </>}
   </>:<p className="selection-prompt">{loading?'Calculating your plan…':'Please contact MDS Finance if you need help with your payment.'}</p>}
   <div className="checkout-assurance">◈ Your payment is processed securely by Kashier.</div>
  </aside>
 </div>;
}
