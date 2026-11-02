// Pure helpers for recurring services paid via individual one-time Kashier checkouts.
import {addMonthsOnDay,cairoDateISO,dateOnly,nextBillingDate} from './renewal-dates.js';
export const BILLING_METHODS=['MANUAL','AUTO'];
export const REMINDER_MAX_PER_DAY=1;
export function nextDueDate(current,months,anchorDay){return nextBillingDate(current,months,anchorDay||0)}
export function renewalStatus(subscription){
 if(subscription.status==='CANCELLED'||subscription.status==='RENEWAL_REVIEW_REQUIRED')return 'STOPPED';
 if(subscription.collection_method==='AUTO')return 'AUTO';
 return subscription.rolling_manual||Number(subscription.cycles_remaining)>0?'MANUAL':'STOPPED';
}
export function dueForReminder(subscription,today=cairoDateISO()){
 return renewalStatus(subscription)==='MANUAL'&&['ACTIVE','PAST_DUE'].includes(subscription.status)&&
  !!dateOnly(subscription.next_charge_at)&&dateOnly(subscription.next_charge_at)<=today;
}
export function canSendReminder(cycle,today=cairoDateISO()){
 return cycle.status==='OPEN'&&dateOnly(cycle.due_date)<=today&&dateOnly(cycle.last_reminder_date)!==today;
}
export function reminderEventKey(cycleId,date){return `manual-renewal:${cycleId}:${date}`;}
