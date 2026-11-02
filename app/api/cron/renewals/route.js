import crypto from 'node:crypto';
import {one,q,transaction} from '../../../../lib/db.js';
import {cryptoDecode,cryptoEncode} from '../../../../lib/billing.js';
import {dateOnly,cairoDateISO} from '../../../../lib/renewal-dates.js';
import {reminderEventKey} from '../../../../lib/manual-billing.js';
import {randomToken,hexhash} from '../../../../lib/security.js';
import {payWithToken,gatewayMode,recurringChargesEnabled} from '../../../../lib/kashier.js';
import {email} from '../../../../lib/email.js';
export const runtime='nodejs';export const dynamic='force-dynamic';
const timeZone='Africa/Cairo';
export async function GET(request){
 const auth=request.headers.get('authorization');
 if(!process.env.CRON_SECRET||auth!==`Bearer ${process.env.CRON_SECRET}`)
  return Response.json({error:'Unauthorized'},{status:401});
 const today=cairoDateISO();
 let issued=0,reminded=0,notificationFailed=0,autoSubmitted=0,autoFailed=0;
 // Manual reminders operate independently of the ENABLE_RECURRING_CHARGES flag.
 // Each service/offer has its own payment period and unique reminder link.
 const due=(await q(`select s.id from subscriptions s join offers o on o.id=s.offer_id
  where ((s.collection_method='MANUAL' and s.status in ('ACTIVE','PAST_DUE'))
         or (s.collection_method='AUTO' and s.status='PAST_DUE'))
   and (s.rolling_manual=true or s.cycles_remaining>0)
   and s.next_charge_at is not null
   and (s.next_charge_at at time zone 'Africa/Cairo')::date <= (now() at time zone 'Africa/Cairo')::date
   and o.status <> 'ARCHIVED' order by s.next_charge_at asc limit 120`)).rows;
 for(const row of due){
  try{
   const message=await transaction(async(c)=>{
    const s=(await c.query(`select s.*,o.title,o.status as offer_status,c.billing_email,c.legal_name,c.locale
     from subscriptions s join offers o on o.id=s.offer_id join client_accounts c on c.id=s.client_id
     where s.id=$1 for update of s`,[row.id])).rows[0];
    if(!s||!['ACTIVE','PAST_DUE'].includes(s.status)
     ||!(s.collection_method==='MANUAL'||(s.collection_method==='AUTO'&&s.status==='PAST_DUE'))
     ||(!s.rolling_manual&&s.cycles_remaining<=0)||s.offer_status==='ARCHIVED')return null;
    const date=dateOnly(s.next_charge_at);
    if(!date||date>today)return null;
    let cycle=(await c.query('select * from manual_billing_cycles where subscription_id=$1 and due_date=$2 for update',[s.id,date])).rows[0];
    if(!cycle){
     const token=randomToken(32);
     cycle=(await c.query(`insert into manual_billing_cycles(subscription_id,due_date,amount,currency,link_hash,link_token_encrypted)
      values($1,$2,$3,$4,$5,$6) returning *`,[s.id,date,s.recurring_amount,s.currency,hexhash(token),cryptoEncode(token)])).rows[0];
     issued++;
    }
    if(cycle.status!=='OPEN'||dateOnly(cycle.last_reminder_date)===today)return null;
    // Don't ask a client to pay again while a hosted checkout remains in progress.
    const inflight=(await c.query(`select id from payment_requests
     where calculation->>'billingCycleId'=$1 and status='PROCESSING'
      and created_at>now()-interval '45 minutes' limit 1`,[cycle.id])).rows[0];
    if(inflight)return null;
    await c.query('update manual_billing_cycles set last_reminder_date=$1,reminder_count=reminder_count+1 where id=$2',[today,cycle.id]);
    return {...cycle,company:s.legal_name,email:s.billing_email,locale:s.locale,title:s.title};
   });
   if(!message)continue;
   // A cancellation may have happened between claiming and composing the email.
   const eligible=await one(`select mb.id from manual_billing_cycles mb join subscriptions s on s.id=mb.subscription_id
    where mb.id=$1 and mb.status='OPEN' and
    ((s.status in ('ACTIVE','PAST_DUE') and s.collection_method='MANUAL')
     or (s.status='PAST_DUE' and s.collection_method='AUTO'))`,[message.id]);
   if(!eligible)continue;
   const token=cryptoDecode(message.link_token_encrypted);
   const delivered=await email({eventKey:reminderEventKey(message.id,today),template:'MANUAL_RENEWAL_DUE',
    to:message.email,company:message.company,locale:message.locale,
    detail:`${message.title} · ${message.currency} ${Number(message.amount).toFixed(2)} · Due ${dateOnly(message.due_date)}`,
    link:`${process.env.APP_URL}/pay-renewal/${encodeURIComponent(token)}`});
   if(delivered)reminded++;else notificationFailed++;
  }catch(e){notificationFailed++;console.error('[MDS:manual-reminder:error]',{subscription:row.id,reason:String(e?.message||'').slice(0,140)})}
 }
 // Automatic merchant-initiated charges must have both an explicit Finance enablement
 // and client-specific checkout consent. Legacy agreement rows never auto-charge.
 if(recurringChargesEnabled()){
  const rows=await q(`select s.id from subscriptions s
   join payment_requests initial on initial.id=s.initial_request_id
   where s.collection_method='AUTO' and s.status='ACTIVE' and s.cycles_remaining>0
   and s.token_encrypted is not null and s.agreement_id is not null
   and s.auto_charge_consent_at is not null
   and initial.calculation->>'collectionMethod'='AUTO'
   and initial.calculation->>'autoChargeConsentAt' is not null
   and initial.calculation->>'autoRenewVersion'='finance-approved-v2'
   and (s.next_charge_at at time zone 'Africa/Cairo')::date <= (now() at time zone 'Africa/Cairo')::date
   and initial.mode='live'
   order by s.next_charge_at asc limit 20`);
  for(const row of rows.rows){
   try{
    const claimed=await transaction(async(c)=>{
     const s=(await c.query(`select s.*,o.title,c.billing_email,c.legal_name
      from subscriptions s join offers o on o.id=s.offer_id join client_accounts c on c.id=s.client_id
      join payment_requests initial on initial.id=s.initial_request_id
      where s.id=$1 and s.collection_method='AUTO' and s.status='ACTIVE' and s.cycles_remaining>0
      and s.auto_charge_consent_at is not null and initial.mode='live'
      and initial.calculation->>'collectionMethod'='AUTO'
      and initial.calculation->>'autoRenewVersion'='finance-approved-v2'
      and (s.next_charge_at at time zone 'Africa/Cairo')::date <= (now() at time zone 'Africa/Cairo')::date
      for update of s skip locked`,[row.id])).rows[0];
     if(!s||!s.token_encrypted||!s.agreement_id)return null;
     const reference=`RN-${crypto.randomBytes(8).toString('hex')}`;
     const requestRow=(await c.query(`insert into payment_requests(offer_id,client_id,public_reference,merchant_order_id,
      term_code,cadence_code,calculation,amount,currency,mode,status)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PROCESSING') returning id`,
      [s.offer_id,s.client_id,randomToken(12),reference,s.term_code,s.cadence_code,
       JSON.stringify({automaticRenewal:true,subscriptionId:s.id,collectionMethod:'AUTO',futureCharge:Number(s.recurring_amount),
        cycleMonths:s.billing_period_months||({MONTHLY:1,QUARTERLY:3,SEMIANNUAL:6,ANNUAL_UPFRONT:12})[s.cadence_code]||1,taxStatus:'AWAITING_FINANCE'}),
       s.recurring_amount,s.currency,gatewayMode()])).rows[0];
     await c.query("update subscriptions set status='PENDING_RENEWAL_PAYMENT' where id=$1",[s.id]);
     return {...s,paymentId:requestRow.id,orderReference:reference};
    });
    if(!claimed)continue;
    try{
     const result=await payWithToken({...claimed,card_token:cryptoDecode(claimed.token_encrypted)},claimed.orderReference);
     const providerStatus=String(result?.data?.status||result?.status||'PENDING').toUpperCase();
     if(['FAILED','FAILURE','DECLINED','REJECTED','INSUFFICIENT_FUNDS'].includes(providerStatus)){
      // An explicit declined result is safe to invoice manually. Never repeat a token charge.
      autoFailed++;
      await q("update subscriptions set status='PAST_DUE' where id=$1 and status='PENDING_RENEWAL_PAYMENT'",[claimed.id]);
      await q("update payment_requests set status='FAILED' where id=$1 and status='PROCESSING'",[claimed.paymentId]);
      await q('insert into audit_events(action,entity_type,entity_id,details) values($1,$2,$3,$4)',
       ['AUTO_RENEWAL_DECLINED','subscription',claimed.id,JSON.stringify({paymentId:claimed.paymentId,status:providerStatus})]);
     }else{
      autoSubmitted++;
      await q('insert into audit_events(action,entity_type,entity_id,details) values($1,$2,$3,$4)',
       ['RENEWAL_SUBMITTED','subscription',claimed.id,JSON.stringify({paymentId:claimed.paymentId,processorStatus:providerStatus})]);
     }
    }catch(e){
     autoFailed++;
     const confirmedDecline=['INSUFFICIENT_FUNDS','CARD_DECLINED','DECLINED','DO_NOT_HONOR'].includes(String(e?.providerCode||'').toUpperCase());
     // For explicit insufficient funds, pause auto retries and issue a separate one-time checkout.
     // For network errors or uncertain outcomes, require Finance reconciliation before any new charge.
     await q("update subscriptions set status=$1 where id=$2 and status='PENDING_RENEWAL_PAYMENT'",
      [confirmedDecline?'PAST_DUE':'PAYMENT_REVIEW_REQUIRED',claimed.id]);
     await q("update payment_requests set status=$1 where id=$2 and status='PROCESSING'",
      [confirmedDecline?'FAILED':'REVIEW_REQUIRED',claimed.paymentId]);
     if(!confirmedDecline)
      await email({eventKey:`renewal-review:${claimed.paymentId}`,template:'RECURRING_PAYMENT_FAILED',
       to:claimed.billing_email,company:claimed.legal_name,detail:'Please contact Finance; collection status needs verification.'}).catch(()=>{});
    }
   }catch(e){autoFailed++;console.error('[MDS:auto-renewal:error]',{subscription:row.id,reason:String(e?.message||'').slice(0,140)})}
  }
 }
 return Response.json({manualCyclesIssued:issued,manualRemindersSent:reminded,notificationFailed,autoSubmitted,autoFailed,runDate:today});
}
