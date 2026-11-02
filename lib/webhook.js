import {q,one,transaction} from './db.js';
import {verifyWebhookEither,extractToken,extractAgreementId} from './kashier.js';
import {cryptoEncode,addMonths,money} from './billing.js';
import {addMonthsOnDay,dateAtBillingTime,dateOnly} from './renewal-dates.js';
import {nextDueDate} from './manual-billing.js';
import {email} from './email.js';
function publicDetails(data){return {reference:String(data.merchantOrderId||data.orderReference||'').slice(0,90),method:String(data.method||'').slice(0,30),responseCode:String(data.transactionResponseCode||'').slice(0,40)};}
export async function receiveWebhook(request){
 const body=await request.text();if(body.length>64000)return new Response(null,{status:413});
 let event;try{event=JSON.parse(body);}catch{return new Response(null,{status:400});}
 const d=event?.data;const name=String(event?.event||'');const mode=verifyWebhookEither(d,request.headers.get('x-kashier-signature'));
 if(!mode)return new Response(null,{status:401});
 if(!['pay','authorize','capture','refund','partial_refund','void','reject','reversal','idempotency'].includes(name))return new Response(null,{status:200});
 const status=String(d.status||'').toUpperCase();
 if(!['SUCCESS','FAILURE','PENDING'].includes(status))return new Response(null,{status:200});
 const ref=String(d.merchantOrderId||d.orderReference||'').slice(0,100);
 const txid=String(d.transactionId||d.kashierOrderId||'').slice(0,100);
 if(!txid||!ref)return new Response(null,{status:422});
 const eventKey=`${mode}:${txid}:${name}:${status}`;
 let notification=null;
 try{
 const result=await transaction(async(c)=>{
  const inserted=await c.query('insert into webhook_events(event_key,mode,event_name,transaction_id,gateway_status,verified,process_status,details) values($1,$2,$3,$4,$5,true,$6,$7) on conflict do nothing returning id',[eventKey,mode,name,txid,status,'PROCESSING',JSON.stringify(publicDetails(d))]);
  if(!inserted.rows[0])return 'duplicate';
  const reqResult=await c.query('select * from payment_requests where merchant_order_id=$1 for update',[ref]);
  const payment=reqResult.rows[0];
  if(!payment){await c.query('insert into reconciliation_exceptions(event_key,category,detail) values($1,$2,$3)',[eventKey,'UNMATCHED_PAYMENT','Gateway transaction does not match a payment request']);await c.query('update webhook_events set process_status=$1 where event_key=$2',['EXCEPTION',eventKey]);return 'exception';}
  const isRefund=['refund','partial_refund'].includes(name);
  const matchesAmount=isRefund?(money(d.amount)>0&&money(d.amount)<=money(payment.amount)):money(d.amount)===money(payment.amount);
  if(payment.mode!==mode||!matchesAmount||String(d.currency)!==payment.currency){
   await c.query('insert into reconciliation_exceptions(event_key,request_id,category,detail) values($1,$2,$3,$4)',[eventKey,payment.id,'AMOUNT_OR_CURRENCY_MISMATCH','Gateway amount, currency or environment mismatch']);
   await c.query('update webhook_events set process_status=$1 where event_key=$2',['EXCEPTION',eventKey]);return 'exception';
  }
  const prevPaid=payment.status==='PAID';
  await c.query('insert into gateway_transactions(request_id,gateway_transaction_id,gateway_order_id,event_type,gateway_status,currency,amount,gateway_method) values($1,$2,$3,$4,$5,$6,$7,$8)',[payment.id,txid,String(d.kashierOrderId||''),name,status,payment.currency,payment.amount,String(d.method||'')]);
  if(['pay','capture'].includes(name)&&status==='SUCCESS'&&!prevPaid){
   await c.query('update payment_requests set status=$1,gateway_order_id=$2,paid_at=now() where id=$3',['PAID',String(d.kashierOrderId||''),payment.id]);
   const offer=(await c.query('select * from offers where id=$1',[payment.offer_id])).rows[0];
   const client=(await c.query('select * from client_accounts where id=$1',[payment.client_id])).rows[0];
   const invoiceNumber=`MDS-${new Date().getUTCFullYear()}-${payment.public_reference}`;
   await c.query(`insert into invoices(invoice_number,client_id,request_id,title,currency,amount,tax_amount,tax_status,status,paid_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,'PAID',now()) on conflict(request_id) do nothing`,[invoiceNumber,payment.client_id,payment.id,offer.title,payment.currency,payment.amount,payment.calculation?.tax,payment.calculation?.taxStatus||'AWAITING_FINANCE']);
   if(offer.transaction_family==='RECURRING'){
    const calc=payment.calculation||{};
    if(calc.billingCycleId){
      // A monthly manual installment is identified by its OWN billing-cycle ID,
      // never by client email, shared card reference, or just an offer ID.
      const cycle=(await c.query(`select mb.*,s.offer_id,s.client_id,s.status as subscription_status,
       s.rolling_manual,s.cycles_remaining,s.renewal_anchor_day,s.cadence_code,s.next_charge_at,s.collection_method
       from manual_billing_cycles mb join subscriptions s on s.id=mb.subscription_id
       where mb.id=$1 for update of mb,s`,[calc.billingCycleId])).rows[0];
      if(!cycle||cycle.offer_id!==payment.offer_id||cycle.client_id!==payment.client_id
        ||cycle.collection_method!=='MANUAL'||money(cycle.amount)!==money(payment.amount)||cycle.currency!==payment.currency){
        await c.query('insert into reconciliation_exceptions(event_key,request_id,category,detail) values($1,$2,$3,$4)',
         [eventKey,payment.id,'UNMATCHED_MANUAL_CYCLE','Paid renewal request was not associated with a matching active billing cycle']);
      }else if(cycle.status==='OPEN'){
        await c.query("update manual_billing_cycles set status='PAID',paid_at=now() where id=$1",[cycle.id]);
        if(['ACTIVE','PAST_DUE'].includes(cycle.subscription_status)){
          const rolling=cycle.rolling_manual===true;
          const remaining=rolling?0:Math.max(0,cycle.cycles_remaining-1);
          const months=({MONTHLY:1,QUARTERLY:3,SEMIANNUAL:6,ANNUAL_UPFRONT:12})[cycle.cadence_code]||1;
          const next=(rolling||remaining>0)?dateAtBillingTime(nextDueDate(cycle.due_date,months,cycle.renewal_anchor_day||0)):null;
          await c.query('update subscriptions set cycles_remaining=$1,next_charge_at=$2,status=$3,last_payment_at=now() where id=$4',
           [remaining,next,next?'ACTIVE':'RENEWAL_REVIEW_REQUIRED',cycle.subscription_id]);
        }else{
          await c.query('insert into reconciliation_exceptions(event_key,request_id,category,detail) values($1,$2,$3,$4)',
           [eventKey,payment.id,'PAID_AFTER_SUBSCRIPTION_STOPPED','Payment was received after recurring service cancellation; keep the payment recorded for Finance review']);
        }
      }
    }else if(calc.automaticRenewal===true&&calc.subscriptionId){
      // Merchant-initiated payments only update their explicitly linked agreement.
      const existing=(await c.query("select * from subscriptions where id=$1 and offer_id=$2 and client_id=$3 for update",
       [calc.subscriptionId,offer.id,client.id])).rows[0];
      if(existing&&existing.status==='PENDING_RENEWAL_PAYMENT'&&existing.collection_method==='AUTO'){
        const remaining=Math.max(0,existing.cycles_remaining-1);
        const next=remaining>0?(existing.renewal_anchor_day
          ?dateAtBillingTime(addMonthsOnDay(existing.next_charge_at||new Date(),calc.cycleMonths||1,existing.renewal_anchor_day))
          :addMonths(existing.next_charge_at||new Date(),calc.cycleMonths||1)):null;
        await c.query('update subscriptions set status=$1,cycles_remaining=$2,next_charge_at=$3,last_payment_at=now() where id=$4',
         [remaining>0?'ACTIVE':'RENEWAL_REVIEW_REQUIRED',remaining,next,existing.id]);
      }else{
        await c.query('insert into reconciliation_exceptions(event_key,request_id,category,detail) values($1,$2,$3,$4)',
         [eventKey,payment.id,'UNEXPECTED_AUTOMATIC_RENEWAL','A paid automatic transaction did not match its pending agreement']);
      }
    }else{
      const existing=(await c.query('select * from subscriptions where offer_id=$1 and client_id=$2 order by created_at desc limit 1 for update',
       [offer.id,client.id])).rows[0];
      if(!existing){
        const selected=calc.collectionMethod==='AUTO'&&!!calc.autoChargeConsentAt?'AUTO':'MANUAL';
        const token=selected==='AUTO'?extractToken(d):null;
        const agreement=selected==='AUTO'?extractAgreementId(d):null;
        const method=selected==='AUTO'&&token&&agreement?'AUTO':'MANUAL';
        const rollingManual=calc.rollingMonthly===true&&method==='MANUAL';
        const remaining=rollingManual?0:Math.max(0,(calc.cycles||1)-1);
        const next=(remaining>0||rollingManual)?(calc.firstRenewalDate
         ?dateAtBillingTime(calc.firstRenewalDate):addMonths(new Date(),calc.cycleMonths||1)):null;
        await c.query(`insert into subscriptions(offer_id,client_id,initial_request_id,term_code,cadence_code,recurring_amount,
         currency,cycles_remaining,next_charge_at,term_end,auto_renew,renewal_anchor_day,status,token_encrypted,
         agreement_id,gateway_customer_ref,masked_method,last_payment_at,collection_method,rolling_manual,auto_charge_consent_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),$18,$19,$20)`,
         [offer.id,client.id,payment.id,payment.term_code,payment.cadence_code,calc.futureCharge||0,
          payment.currency,remaining,next,calc.termEndDate||null,calc.autoRenew===true,calc.renewalAnchorDay||null,
          next?'ACTIVE':'RENEWAL_REVIEW_REQUIRED',method==='AUTO'?cryptoEncode(token):null,method==='AUTO'?agreement:null,
          client.id,String(d.card?.cardInfo?.maskedCard||'').slice(0,36),method,rollingManual,method==='AUTO'?calc.autoChargeConsentAt:null]);
        if(selected==='AUTO'&&method==='MANUAL'){
          await c.query('insert into reconciliation_exceptions(event_key,request_id,category,detail) values($1,$2,$3,$4)',
           [eventKey,payment.id,'AUTO_CHARGE_TOKEN_MISSING','Initial paid session did not return a verified card token and agreement; subscription is switched to manual reminders']);
        }
      }else if(existing.initial_request_id!==payment.id){
        // Multiple services per customer are fine. An unrelated payment must never
        // decrement an existing subscription, even when it shares an offer.
        await c.query('insert into reconciliation_exceptions(event_key,request_id,category,detail) values($1,$2,$3,$4)',
         [eventKey,payment.id,'DUPLICATE_INITIAL_AGREEMENT','Unexpected additional initial payment against an already-activated offer; review without advancing its schedule']);
      }
    }
   }
   notification={eventKey:`paid:${payment.id}`,template:'PAYMENT_SUCCESS',to:client.billing_email,company:client.legal_name,detail:`${payment.currency} ${Number(payment.amount).toFixed(2)} · ${invoiceNumber}`,link:`${process.env.APP_URL}/billing`};
  }
  if(['pay','capture'].includes(name)&&status==='FAILURE'&&!prevPaid){
    await c.query('update payment_requests set status=$1 where id=$2',['FAILED',payment.id]);
    if(payment.calculation?.automaticRenewal===true&&payment.calculation?.subscriptionId)
      await c.query("update subscriptions set status='PAST_DUE' where id=$1 and status='PENDING_RENEWAL_PAYMENT'",[payment.calculation.subscriptionId]);
  }
  if(['refund','partial_refund'].includes(name)&&status==='SUCCESS'){
    await c.query('update refunds set status=$1 where gateway_reference=$2 and amount=$3',['COMPLETED',String(d.kashierOrderId||''),money(d.amount)]);
    await c.query('update invoices set status=$1 where request_id=$2',[money(d.amount)>=money(payment.amount)?'REFUNDED':'PARTIALLY_REFUNDED',payment.id]);
  }
  await c.query('update webhook_events set process_status=$1 where event_key=$2',['PROCESSED',eventKey]);
  return 'ok';
 });
 if(notification){await email(notification).catch(()=>{});}return new Response(null,{status:result==='duplicate'?409:200});
 }catch(e){console.error('Webhook handler failed:',e?.message||'unknown');return new Response(null,{status:500});}
}
