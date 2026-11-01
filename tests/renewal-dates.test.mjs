import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../lib/billing.js';
import {cairoDateISO,dateOnly,addMonthsOnDay,addCalendarDays,validateFirstMonthlyRenewal,dateAtBillingTime} from '../lib/renewal-dates.js';
const offer={allowed_terms:['COMMIT_3M'],cadence_matrix:{COMMIT_3M:['MONTHLY']},professional_fee:1000,setup_fee:200,pass_through_fee:0,currency:'EGP',benefit_kind:'NO_BENEFIT',benefit_value:0,tax_approved:false,version:1};
const now=new Date('2026-11-01T10:00:00.000Z');
test('Finance first renewal date is independent of initial checkout day',()=>{
 const q=calculate({...offer,first_monthly_renewal_date:'2026-12-10'},'COMMIT_3M','MONTHLY',now);
 assert.equal(q.firstCharge,1200);
 assert.equal(q.nextPaymentDate,'2026-12-10');
 assert.equal(q.firstRenewalDate,'2026-12-10');
 assert.equal(q.renewalAnchorDay,10);
 assert.equal(q.cycles,3);
 assert.equal(q.termEndDate,'2027-02-10');
 assert.equal(q.futureCharge,1000);
});
test('Month-end billing remains anchored to the 31st even after February',()=>{
 assert.equal(addMonthsOnDay('2027-01-31',1,31),'2027-02-28');
 assert.equal(addMonthsOnDay('2027-02-28',1,31),'2027-03-31');
 assert.equal(addMonthsOnDay('2027-01-31',1,30),'2027-02-28');
});
test('Configured monthly date less than 25 days ahead is rejected before checkout',()=>{
 assert.throws(()=>calculate({...offer,first_monthly_renewal_date:'2026-11-15'},'COMMIT_3M','MONTHLY',now),e=>e.code==='RENEWAL_DATE_TOO_SOON');
 assert.equal(validateFirstMonthlyRenewal('2026-11-26',now),'2026-11-26');
});
test('Cairo date boundary and calendar-day arithmetic are timezone-safe',()=>{
 assert.equal(cairoDateISO(new Date('2026-11-01T22:30:00Z')),'2026-11-02');
 assert.equal(addCalendarDays('2026-11-01',25),'2026-11-26');
 assert.equal(dateOnly('2026-02-30'),null);
 assert.equal(dateAtBillingTime('2027-02-28').toISOString(),'2027-02-28T08:00:00.000Z');
});
test('Legacy offers and one-time monthly flex keep existing schedule behavior',()=>{
 const old=calculate(offer,'COMMIT_3M','MONTHLY',now);
 assert.equal(old.firstRenewalDate,null);
 assert.equal(old.cycles,3);
 const flex={...offer,allowed_terms:['MONTHLY_FLEX'],cadence_matrix:{MONTHLY_FLEX:['MONTHLY']},auto_renew:false};
 const one=calculate(flex,'MONTHLY_FLEX','MONTHLY',now);
 assert.equal(one.cycles,1);
 assert.equal(one.nextPaymentDate,null);
});
test('Rolling Monthly Flex can have an explicit first renewal date',()=>{
 const flex={...offer,allowed_terms:['MONTHLY_FLEX'],cadence_matrix:{MONTHLY_FLEX:['MONTHLY']},auto_renew:true,first_monthly_renewal_date:'2026-12-31'};
 const q=calculate(flex,'MONTHLY_FLEX','MONTHLY',now);
 assert.equal(q.cycles,12);
 assert.equal(q.nextPaymentDate,'2026-12-31');
 assert.equal(q.renewalAnchorDay,31);
 assert.equal(q.termEndDate,'2027-11-30');
});
