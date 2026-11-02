import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../lib/billing.js';
import {renewalStatus,dueForReminder,canSendReminder,nextDueDate,reminderEventKey} from '../lib/manual-billing.js';
const base={allowed_terms:['COMMIT_3M','MONTHLY_FLEX'],cadence_matrix:{COMMIT_3M:['MONTHLY'],MONTHLY_FLEX:['MONTHLY']},professional_fee:1000,setup_fee:400,pass_through_fee:100,currency:'EGP',benefit_kind:'NO_BENEFIT',benefit_value:0,version:1,auto_renew:true,first_monthly_renewal_date:'2026-12-10',allow_auto_charge:true};
const now=new Date('2026-11-02T10:00:00.000Z');
test('manual monthly quote is the default: first installment includes setup once',()=>{
 const q=calculate(base,'COMMIT_3M','MONTHLY',now);
 assert.equal(q.collectionMethod,'MANUAL');assert.equal(q.firstCharge,1500);assert.equal(q.futureCharge,1000);assert.equal(q.nextPaymentDate,'2026-12-10');assert.equal(q.cycles,3);
});
test('auto-charge is opt-in and available only when Finance enabled it',()=>{
 const q=calculate(base,'COMMIT_3M','MONTHLY',now,'AUTO');assert.equal(q.collectionMethod,'AUTO');assert.equal(q.autoChargeAllowed,true);
 assert.throws(()=>calculate({...base,allow_auto_charge:false},'COMMIT_3M','MONTHLY',now,'AUTO'),/not available/);
});
test('rolling manual Monthly Flex can continue until stopped',()=>{
 const q=calculate(base,'MONTHLY_FLEX','MONTHLY',now,'MANUAL');
 assert.equal(q.rollingManual,true);
 assert.equal(renewalStatus({status:'ACTIVE',collection_method:'MANUAL',rolling_manual:true,cycles_remaining:0}),'MANUAL');
 assert.equal(renewalStatus({status:'CANCELLED',collection_method:'MANUAL',rolling_manual:true,cycles_remaining:0}),'STOPPED');
});
test('reminders are once per due calendar day and stop after payment/cancellation',()=>{
 const s={status:'ACTIVE',collection_method:'MANUAL',rolling_manual:false,cycles_remaining:2,next_charge_at:'2026-12-10T08:00:00Z'};
 const c={status:'OPEN',due_date:'2026-12-10',last_reminder_date:null};
 assert.equal(dueForReminder(s,'2026-12-09'),false);assert.equal(dueForReminder(s,'2026-12-10'),true);
 assert.equal(canSendReminder(c,'2026-12-10'),true);
 assert.equal(canSendReminder({...c,last_reminder_date:'2026-12-10'},'2026-12-10'),false);
 assert.equal(canSendReminder({...c,status:'PAID'},'2026-12-11'),false);
 assert.equal(dueForReminder({...s,status:'CANCELLED'},'2026-12-11'),false);
});
test('billing dates preserve the intended day even across short months',()=>{
 assert.equal(nextDueDate('2027-01-31',1,31),'2027-02-28');
 assert.equal(nextDueDate('2027-02-28',1,31),'2027-03-31');
 assert.equal(reminderEventKey('some-id','2026-12-10'),'manual-renewal:some-id:2026-12-10');
});
