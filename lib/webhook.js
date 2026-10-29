import {q,one,transaction} from './db.js';
import {verifyWebhookEither,extractToken,extractAgreementId} from './kashier.js';
import {cryptoEncode,addMonths,money} from './billing.js';
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
    const existing=(await c.query('select * from subscriptions where offer_id=$1 and client_id=$2 order by created_at desc limit 1 for update',[offer.id,client.id])).rows[0];
    if(existing&&existing.initial_request_id!==payment.id){
      const remaining=Math.max(0,existing.cycles_remaining-1);
      const next=remaining>0?addMonths(existing.next_charge_at||new Date(),payment.calculation?.cycleMonths||1):null;
      await c.query('update subscriptions set status=$1,cycles_remaining=$2,next_charge_at=$3,last_payment_at=now() where id=$4',[remaining>0?'ACTIVE':'RENEWAL_REVIEW_REQUIRED',remaining,next,existing.id]);
    }else if(!existing){
      const token=extractToken(d),agreement=extractAgreementId(d);
      const remaining=Math.max(0,(payment.calculation?.cycles||1)-1);
      const next=remaining>0?addMonths(new Date(),payment.calculation?.cycleMonths||1):null;
      await c.query(`insert into subscriptions(offer_id,client_id,initial_request_id,term_code,cadence_code,recurring_amount,currency,cycles_remaining,next_charge_at,term_end,auto_renew,status,token_encrypted,agreement_id,gateway_customer_ref,masked_method,last_payment_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())`,[offer.id,client.id,payment.id,payment.term_code,payment.cadence_code,payment.calculation?.futureCharge||0,payment.currency,remaining,next,payment.calculation?.termEndDate||null,payment.calculation?.autoRenew===true,remaining>0?(token&&agreement?'ACTIVE':'PAYMENT_METHOD_REQUIRED'):'RENEWAL_REVIEW_REQUIRED',token?cryptoEncode(token):null,agreement||null,client.id,String(d.card?.cardInfo?.maskedCard||'').slice(0,36)]);
      if(remaining>0&&(!token||!agreement)) await c.query('insert into reconciliation_exceptions(event_key,request_id,category,detail) values($1,$2,$3,$4)',[eventKey,payment.id,'MISSING_CARD_AGREEMENT','Recurring payment confirmed but agreement token not present in signed event']);
    }
   }
   notification={eventKey:`paid:${payment.id}`,template:'PAYMENT_SUCCESS',to:client.billing_email,company:client.legal_name,detail:`${payment.currency} ${Number(payment.amount).toFixed(2)} · ${invoiceNumber}`,link:`${process.env.APP_URL}/billing`};
  }
  if(['pay','capture'].includes(name)&&status==='FAILURE'&&!prevPaid){
    await c.query('update payment_requests set status=$1 where id=$2',['FAILED',payment.id]);
    await c.query('update subscriptions set status=$1 where offer_id=$2 and client_id=$3 and status=$4',['PAST_DUE',payment.offer_id,payment.client_id,'PENDING_RENEWAL_PAYMENT']);
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
