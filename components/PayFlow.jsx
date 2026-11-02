'use client';
import {useState,useEffect} from 'react';
function format(amount,currency){return new Intl.NumberFormat('en-EG',{style:'currency',currency:currency||'EGP'}).format(Number(amount||0))}
export default function PayFlow({token,offer}){
 const recurring=offer.kind==='RECURRING';
 const [autoRenew,setAutoRenew]=useState(false);
 const [quote,setQuote]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const allowAuto=recurring&&offer.allowAutoCharge===true&&offer.autoChargeOperational===true;
 useEffect(()=>{
  let active=true;
  setLoading(true);setQuote(null);setError('');
  fetch('/api/offer/quote',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({token,autoRenew})})
   .then(async r=>{const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'Unable to calculate your approved invoice');return j.quote})
   .then(q=>{if(active){setQuote(q);setLoading(false)}})
   .catch(e=>{if(active){setError(e.message);setLoading(false)}});
  return()=>{active=false};
 },[token,autoRenew]);
 async function proceed(){
  if(!quote||busy)return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/offer/checkout',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({token,autoRenew,autoChargeConsent:autoRenew,idempotencyKey:crypto.randomUUID()})});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to start secure checkout');
   window.location.assign(d.checkoutUrl);
  }catch(e){setError(e.message);setBusy(false)}
 }
 const months=quote?.planMonths||quote?.termMonths||1;
 const hasFutureCharges=recurring&&(quote?.rollingManual||quote?.cycles>1);
 const savings=Number(quote?.discountAmount||0);
 return <div className="container pay-layout">
  <section className="pay-main">
   <div className="eyebrow">MEDICAL DIGITAL SOLUTIONS</div>
   <h1>Review your approved payment</h1>
   <p className="muted">MDS Finance has already confirmed your service, billing period, pricing and renewal date.</p>
   <div className="stepper"><span className="active">01 Review</span><span>02 Payment preference</span><span>03 Secure checkout</span></div>
   <div className="panel">
    <div className="eyebrow">APPROVED SERVICE</div><h2>{offer.title}</h2>
    <p><strong>{offer.company}</strong><br/><span className="muted">Reference: {offer.ref}</span></p>
    {recurring&&<div className="approved-plan">
     <div><small>Finance-approved package</small><strong>{months} month{months===1?'':'s'} prepaid</strong></div>
     <div><small>Renewal frequency</small><strong>Every {months} month{months===1?'':'s'}</strong></div>
     {quote?.nextPaymentDate&&<div><small>Next renewal date</small><strong>{quote.nextPaymentDate}</strong></div>}
    </div>}
   </div>
   {recurring&&<div className="panel">
    <div className="row" style={{alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
     <h3 style={{margin:0}}>Automatic renewal</h3>{allowAuto&&<span className="billing-chip is-on">Recommended</span>}
    </div>
    <p className="muted">Your plan and renewal dates are already approved. Choose whether you'd like future payments to happen automatically.</p>
    <label className={'auto-renew-control '+(autoRenew?'auto-renew-active':'')}>
     <span><strong>Automatically renew my service</strong>
      <small className="field-help">{allowAuto?'Enjoy uninterrupted service with payments made automatically on your renewal dates.':'Please contact MDS Finance if you would like to enable automatic renewal.'}</small>
      {autoRenew&&<small className="field-help">Automatic renewal is ON.</small>}
     </span>
     <input type="checkbox" role="switch" aria-label="Authorize automatic card renewal" checked={autoRenew} disabled={!allowAuto||busy}
      onChange={e=>setAutoRenew(e.target.checked)}/>
    </label>
    {autoRenew?<p className="info-note">I authorize Medical Digital Solutions to charge my saved card {quote?format(quote.futureCharge,quote.currency):'the approved amount'} on {quote?.nextPaymentDate||'the agreed renewal date'} and every {months} month{months===1?'':'s'} thereafter, for up to 12 scheduled payments. I may stop future renewals by contacting MDS Finance.</p>
     :<p className="muted small">We'll email you when your next payment is due.</p>}
   </div>}
   <div className="panel review-panel">
    <h3>Secure payment</h3>
    {loading?<p className="muted">Calculating the approved amount…</p>:<p>{recurring?(autoRenew?'You are setting up automatic renewal for your approved plan.':'Pay today, and we’ll remind you when it’s time to renew.'):'This project payment is one-time.'}</p>}
    <button className="button primary full" type="button" disabled={!quote||loading||busy} onClick={proceed}>{busy?'Preparing secure checkout…':'Continue to secure payment ↗'}</button>
    <p className="muted small">By continuing, you approve the payment amount and terms displayed on this page. Card details are entered only on Kashier's secure checkout.</p>
   </div>
   {error&&<div className="alert" role="alert">{error}</div>}
  </section>
  <aside className="order-card">
   <div className="eyebrow">FINANCE-APPROVED SUMMARY</div>
   <div className="summary-client">{offer.company}<small>{offer.ref}</small></div>
   {quote?<><div className="amount-overline">PAY TODAY</div><div className="amount-major">{format(quote.firstCharge,quote.currency)}</div>
    <div className="divider"/>
    <div className="summary-row"><span>Currency</span><b>{quote.currency}</b></div>
    <div className="summary-row"><span>Professional fee</span><b>{format(quote.monthlyProfessional,quote.currency)}{recurring?' / month':''}</b></div>
    {recurring&&<div className="summary-row"><span>Service period</span><b>{months} month{months===1?'':'s'}</b></div>}
    {recurring&&quote.grossCycle!=null&&<div className="summary-row"><span>Fee before discount</span><b>{format(quote.grossCycle,quote.currency)}</b></div>}
    {savings>0&&<div className="summary-row"><span>Approved {quote.discountKind==='PERCENT'?quote.discountValue+'% ':''}discount</span><b>− {format(savings,quote.currency)}</b></div>}
    {Number(quote.setup)-Number(quote.setupReduction||0)>0&&<div className="summary-row"><span>One-time implementation</span><b>{format(quote.setup-Number(quote.setupReduction||0),quote.currency)}</b></div>}
    {Number(quote.passThrough)>0&&<div className="summary-row"><span>Third-party costs</span><b>{format(quote.passThrough,quote.currency)}</b></div>}
    {quote.tax!=null&&<div className="summary-row"><span>Approved tax</span><b>{format(quote.tax,quote.currency)}</b></div>}
    {quote.tax==null&&<p className="muted small">Any applicable taxes will be documented according to your approved agreement.</p>}
    {recurring&&<><div className="divider"/>
     <div className="summary-row"><span>Billing</span><b>Every {months} month{months===1?'':'s'}</b></div>
     <div className="summary-row"><span>Renewal option</span><b>{autoRenew?'Automatic card charge':'Secure payment link'}</b></div>
     {quote.nextPaymentDate&&<div className="summary-row"><span>First renewal</span><b>{quote.nextPaymentDate}</b></div>}
     {hasFutureCharges&&<div className="summary-row"><span>Renewal amount</span><b>{format(quote.futureCharge,quote.currency)}</b></div>}
     {autoRenew&&<p className="muted small">Automatic payments stop when your approved authorization ends or you cancel through MDS Finance.</p>}
    </>}
   </>:<p className="selection-prompt">{loading?'Loading your Finance-approved amount…':'The approved price is temporarily unavailable.'}</p>}
   <div className="checkout-assurance">◈ Encrypted checkout by Kashier. Your card details are never entered on this website.</div>
  </aside>
 </div>;
}
