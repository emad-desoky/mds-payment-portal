'use client';
import {useState,useEffect} from 'react';
const labels={MONTHLY_FLEX:'Monthly Flex (1 month)',COMMIT_3M:'3-month commitment',COMMIT_6M:'6-month commitment',COMMIT_12M:'12-month commitment',MONTHLY:'Monthly',QUARTERLY:'Quarterly',SEMIANNUAL:'Every 6 months',ANNUAL_UPFRONT:'Annual upfront'};
const descriptions={
 MONTHLY_FLEX:'No long-term commitment. Monthly collection still follows a scheduled due date.',
 COMMIT_3M:'A three-month service commitment; billing may be monthly or quarterly.',
 COMMIT_6M:'A six-month service commitment; the approved billing interval determines payment dates.',
 COMMIT_12M:'A twelve-month service commitment; payment intervals are approved by Finance.',
 MONTHLY:'Payment is due once every month, on the scheduled date.',
 QUARTERLY:'Payment is due once every three months.',
 SEMIANNUAL:'Payment is due once every six months.',
 ANNUAL_UPFRONT:'Pay the full twelve-month professional fee now.'
};
function format(amount,currency){return new Intl.NumberFormat('en-EG',{style:'currency',currency:currency||'EGP'}).format(Number(amount||0))}
export default function PayFlow({token,offer}){
 const recurring=offer.kind==='RECURRING';
 const [term,setTerm]=useState(recurring?'':'MONTHLY_FLEX');
 const [cadence,setCadence]=useState(recurring?'':'MONTHLY');
 const [quote,setQuote]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[accepted,setAccepted]=useState(false);
 useEffect(()=>{
  if(!term||!cadence||!(offer.matrix[term]||[]).includes(cadence)){setQuote(null);return}
  let on=true;
  setQuote(null);setError('');
  fetch('/api/offer/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,term,cadence})})
   .then(x=>x.json()).then(x=>{if(on){if(x.ok)setQuote(x.quote);else setError(x.error||'Unable to calculate payment details')}})
   .catch(()=>{if(on)setError('Unable to calculate the payment summary.')});
  return()=>{on=false};
 },[term,cadence,token,offer.matrix]);
 function chooseTerm(t){setTerm(previous=>previous===t?'':t);setCadence('');setQuote(null);setAccepted(false);setError('')}
 function chooseCadence(c){setCadence(previous=>previous===c?'':c);setQuote(null);setAccepted(false);setError('')}
 async function proceed(){
  if(!quote||!accepted)return;
  setError('');setBusy(true);
  try{
   const r=await fetch('/api/offer/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,term,cadence,idempotencyKey:crypto.randomUUID()})});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to start payment');
   window.location.assign(d.checkoutUrl);
  }catch(e){setError(e.message);setBusy(false)}
 }
 const summaryReady=!!quote;
 const hasFutureCharges=recurring&&quote?.cycles>1;
 return <div className="container pay-layout">
  <section className="pay-main">
   <div className="eyebrow">YOUR APPROVED ENGAGEMENT</div>
   <h1>Secure payment</h1>
   <p className="muted">Review your agreement and payment details before continuing to Kashier.</p>
   <div className="stepper"><span className="active">01 Agreement</span><span>02 Review</span><span>03 Secure payment</span></div>
   <div className="panel"><div className="eyebrow">PAYMENT FOR</div><h2>{offer.title}</h2><p><strong>{offer.company}</strong><br/><span className="muted">Reference: {offer.ref}</span></p></div>
   {recurring?<><div className="panel">
    <h3>1. Commitment term</h3>
    <p className="muted">How long is your service agreement? Select one approved option. A commitment term is not the same as a payment frequency.</p>
    <div className="choice-grid">{(offer.terms||[]).map(t=><button type="button" aria-pressed={term===t} className={'choice choice-explained '+(term===t?'selected':'')} key={t} onClick={()=>chooseTerm(t)}>
     <span className="choice-indicator">{term===t?'●':'○'}</span><span><strong>{labels[t]||t}</strong><small className="field-help">{descriptions[t]}</small></span>
    </button>)}</div>
   </div>
   <div className="panel">
    <h3>2. Billing schedule</h3>
    <p className="muted">How often will payments be due? Dates follow the selected schedule. Monthly Flex does not allow arbitrary payment dates.</p>
    {term?<div className="choice-grid">{(offer.matrix[term]||[]).map(c=><button type="button" aria-pressed={cadence===c} className={'choice choice-explained '+(cadence===c?'selected':'')} key={c} onClick={()=>chooseCadence(c)}>
     <span className="choice-indicator">{cadence===c?'●':'○'}</span><span><strong>{labels[c]||c}</strong><small className="field-help">{descriptions[c]}</small></span>
    </button>)}</div>:<p className="selection-prompt">Choose a commitment term above to see its available payment schedules.</p>}
   </div></>:<p className="info-note">One-time project payment. There are no recurring charges or subscription terms for this payment.</p>}
   {summaryReady&&<div className="panel review-panel">
    <h3>Before you continue</h3>
    <p>{hasFutureCharges?'The first charge is due today. Future payments follow the schedule and authorization displayed in the summary.':'You will be taken to Kashier\'s secure checkout to complete this payment.'}</p>
    <label className="checkline">
     <input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>
     <span>{hasFutureCharges?'I approve the recurring card authorization shown here, including the amount, collection interval, number of charges, and review date. I understand that scheduled collections may be stopped through MDS Finance.':'I have reviewed the amount, currency, and billing arrangement shown here.'}</span>
    </label>
    <button className="button primary full" onClick={proceed} disabled={!accepted||busy}>{busy?'Preparing secure checkout…':'Continue to secure payment ↗'}</button>
   </div>}
   {error&&<p role="alert" className="alert">{error}</p>}
  </section>
  <aside className="order-card">
   <div className="eyebrow">PAYMENT SUMMARY</div><div className="summary-client">{offer.company}<small>{offer.ref}</small></div>
   {summaryReady?<><div className="amount-overline">PAY TODAY</div><div className="amount-major">{format(quote.firstCharge,quote.currency)}</div><div className="divider"/>
    <div className="summary-row"><span>Currency</span><b>{quote.currency}</b></div>
    <div className="summary-row"><span>Professional fee</span><b>{format(quote.monthlyProfessional,quote.currency)}{recurring?' / month':''}</b></div>
    {quote.setup>0&&<div className="summary-row"><span>Implementation</span><b>{format(quote.setup-quote.setupReduction,quote.currency)}</b></div>}
    {quote.passThrough>0&&<div className="summary-row"><span>Third-party costs</span><b>{format(quote.passThrough,quote.currency)}</b></div>}
    {quote.monthlyReduction>0&&<div className="summary-row"><span>Approved benefit</span><b>− {format(quote.monthlyReduction,quote.currency)}{recurring?' / month':''}</b></div>}
    {quote.tax===null?<p className="muted small">Any applicable taxes will be documented according to your approved agreement.</p>:<div className="summary-row"><span>Tax</span><b>{format(quote.tax,quote.currency)}</b></div>}
    {recurring&&<><div className="divider"/>
     <div className="summary-row"><span>Commitment term</span><b>{labels[quote.term]}</b></div>
     <div className="summary-row"><span>Payment frequency</span><b>{labels[quote.cadence]}</b></div>
     <div className="summary-row"><span>Total authorized charges</span><b>{quote.cycles}</b></div>
     {hasFutureCharges&&<div className="summary-row"><span>Each later charge</span><b>{format(quote.futureCharge,quote.currency)}</b></div>}
     {quote.nextPaymentDate&&<div className="summary-row"><span>Next due date</span><b>{quote.nextPaymentDate}</b></div>}
     <div className="summary-row"><span>{quote.rollingMonthly?'Authorization review date':'Term review/end'}</span><b>{quote.termEndDate}</b></div>
     <p className="muted small">{quote.rollingMonthly?'Month-to-month commitment, with up to 12 monthly payments authorized before review.':'The selected schedule sets the dates of payments. A one-payment arrangement requires a new agreement to continue.'}</p>
    </>}
   </>:<div className="selection-prompt">{recurring?'Select a commitment term and billing schedule to view the amount payable and any future charges.':'Calculating your approved payment…'}</div>}
   <div className="checkout-assurance">◈ Encrypted checkout provided by Kashier. Card details are never entered on this website.</div>
  </aside>
 </div>;
}
