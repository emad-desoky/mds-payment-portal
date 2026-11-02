import test from 'node:test';
import assert from 'node:assert/strict';
import {financePlanQuote,validatePlanInput,validatePackages,packagePrices} from '../lib/finance-plan.js';
import {calculateApprovedOffer} from '../lib/billing.js';
const now=new Date('2026-11-02T10:00:00Z');
const base={transaction_family:'RECURRING',billing_period_months:3,plan_discount_type:'PERCENT',plan_discount_value:10,
 professional_fee:10000,setup_fee:1000,pass_through_fee:500,currency:'EGP',allow_auto_charge:true,
 first_monthly_renewal_date:'2026-11-03',version:1,tax_approved:false};
test('Existing discounted 3-month offer also permits 1-month standard pricing',()=>{
 assert.deepEqual(packagePrices(base).map(p=>[p.months,p.price,p.saving]),[[1,10000,0],[3,27000,3000]]);
 const monthly=financePlanQuote(base,'MANUAL',now,1),prepaid=financePlanQuote(base,'MANUAL',now,3);
 assert.equal(monthly.firstCharge,11500);assert.equal(prepaid.firstCharge,28500);
 assert.equal(monthly.nextPaymentDate,'2026-12-03');assert.equal(prepaid.nextPaymentDate,'2027-02-03');
});
test('Auto renewal cannot start tomorrow for a fully prepaid 3-month service',()=>{
 const q=financePlanQuote(base,'AUTO',now,3);
 assert.equal(q.nextPaymentDate,'2027-02-03');assert.equal(q.termEndDate,'2030-02-03');
});
test('Custom 2/4-month discount is available only when Finance approved',()=>{
 const offer={...base,cadence_matrix:{__packages:[
  {months:1,discountType:'NONE',discountValue:0},
  {months:2,discountType:'PERCENT',discountValue:5},
  {months:4,discountType:'FIXED',discountValue:5000}
 ]}};
 assert.deepEqual(packagePrices(offer).map(p=>p.price),[10000,19000,35000]);
 assert.equal(calculateApprovedOffer(offer,'MANUAL',now,4).futureCharge,35000);
 assert.throws(()=>calculateApprovedOffer(offer,'AUTO',now,6),/not approved/);
});
test('Three prepaid months at 10k per month can have a 5k-EGP discount',()=>{
 const offer={...base,cadence_matrix:{__packages:[
  {months:1,discountType:'NONE',discountValue:0},
  {months:3,discountType:'FIXED',discountValue:5000}
 ]}};
 const q=calculateApprovedOffer(offer,'MANUAL',now,3);
 assert.equal(q.grossCycle,30000);assert.equal(q.discountAmount,5000);assert.equal(q.futureCharge,25000);
});
test('Invalid duplicate durations and 100%-discounted plans fail',()=>{
 assert.throws(()=>validatePackages([{months:3},{months:3}],10000),/only appear once/);
 assert.throws(()=>validatePlanInput({months:2,discountType:'FIXED',discountValue:5000,monthlyFee:100}),/positive service payment/);
 assert.throws(()=>validatePlanInput({months:3,discountType:'PERCENT',discountValue:100,monthlyFee:100}),/positive service payment/);
});
test('Finance can disable Auto renewal for a specific offer',()=>{
 assert.throws(()=>financePlanQuote({...base,allow_auto_charge:false},'AUTO',now,3),/not approved/);
});
test('One-time invoices remain one-time',()=>{
 const offer={transaction_family:'ONE_TIME',allowed_terms:['MONTHLY_FLEX'],cadence_matrix:{MONTHLY_FLEX:['MONTHLY']},
 professional_fee:1000,setup_fee:250,pass_through_fee:100,currency:'EGP',version:1};
 assert.equal(calculateApprovedOffer(offer,'MANUAL',now).firstCharge,1350);
});
test('Legacy unapproved multiple terms do not become new public packages',()=>{
 const offer={...base,billing_period_months:null,allowed_terms:['MONTHLY_FLEX','COMMIT_3M'],cadence_matrix:{MONTHLY_FLEX:['MONTHLY'],COMMIT_3M:['MONTHLY']}};
 assert.throws(()=>calculateApprovedOffer(offer,'MANUAL',now),/Finance must approve/);
});
