import test from 'node:test';
import assert from 'node:assert/strict';
import {financePlanQuote,validatePlanInput} from '../lib/finance-plan.js';
import {calculateApprovedOffer} from '../lib/billing.js';
const now=new Date('2026-11-02T10:00:00Z');
const base={transaction_family:'RECURRING',billing_period_months:3,plan_discount_type:'PERCENT',plan_discount_value:10,
 professional_fee:10000,setup_fee:1000,pass_through_fee:500,currency:'EGP',allow_auto_charge:true,
 first_monthly_renewal_date:'2027-03-01',version:1,tax_approved:false};
test('Finance-locked 3-month package applies 10% to whole period and setup only once',()=>{
 const a=financePlanQuote(base,'MANUAL',now);
 assert.equal(a.grossCycle,30000);assert.equal(a.discountAmount,3000);
 assert.equal(a.firstCharge,28500);assert.equal(a.futureCharge,27000);
 assert.equal(a.planMonths,3);assert.equal(a.cycleMonths,3);
 assert.equal(a.nextPaymentDate,'2027-03-01');assert.equal(a.rollingManual,true);
});
test('Custom 2 or 4 months with flat EGP discount is supported without client term selection',()=>{
 for(const months of [2,4]){
  const a=calculateApprovedOffer({...base,billing_period_months:months,plan_discount_type:'FIXED',plan_discount_value:5000},'MANUAL',now);
  assert.equal(a.planMonths,months);assert.equal(a.discountAmount,5000);
  assert.equal(a.futureCharge,months*10000-5000);
 }
});
test('Finance must approve and client must opt in for AUTO',()=>{
 const a=financePlanQuote(base,'AUTO',now);assert.equal(a.collectionMethod,'AUTO');assert.equal(a.cycles,12);
 assert.equal(a.termEndDate,'2029-12-01');
 assert.throws(()=>financePlanQuote({...base,allow_auto_charge:false},'AUTO',now),/not approved/);
});
test('Discount cannot exceed base and requires a real price',()=>{
 assert.throws(()=>validatePlanInput({months:3,discountType:'PERCENT',discountValue:101,monthlyFee:100}),/100%/);
 assert.throws(()=>validatePlanInput({months:2,discountType:'FIXED',discountValue:5000,monthlyFee:100}),/cannot exceed/);
 assert.throws(()=>validatePlanInput({months:0,discountType:'NONE',discountValue:0,monthlyFee:100}),/whole number/);
});
test('Legacy with more than one term is blocked from client selection',()=>{
 const offer={...base,billing_period_months:null,allowed_terms:['MONTHLY_FLEX','COMMIT_3M'],cadence_matrix:{MONTHLY_FLEX:['MONTHLY'],COMMIT_3M:['MONTHLY']}};
 assert.throws(()=>calculateApprovedOffer(offer,'MANUAL',now),/Finance must select/);
});
test('One-time still uses approved fixed one-time checkout',()=>{
 const offer={transaction_family:'ONE_TIME',allowed_terms:['MONTHLY_FLEX'],cadence_matrix:{MONTHLY_FLEX:['MONTHLY']},
 professional_fee:1000,setup_fee:250,pass_through_fee:100,currency:'EGP',version:1};
 assert.equal(calculateApprovedOffer(offer,'MANUAL',now).firstCharge,1350);
});
