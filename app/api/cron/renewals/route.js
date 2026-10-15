import crypto from 'node:crypto';
import {q,transaction} from '../../../../lib/db.js';
import {cryptoDecode} from '../../../../lib/billing.js';
import {payWithToken,gatewayMode} from '../../../../lib/kashier.js';
import {email} from '../../../../lib/email.js';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request){
 const auth=request.headers.get('authorization');if(!process.env.CRON_SECRET||auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({error:'Unauthorized'},{status:401});
 if(process.env.ENABLE_LIVE_PAYMENTS!=='true')return Response.json({status:'paused'});
 const rows=await q(`select s.id from subscriptions s where s.status='ACTIVE' and s.cycles_remaining>0 and s.next_charge_at<=now() order by s.next_charge_at asc limit 20`);
 let dispatched=0,failed=0;
 for(const row of rows.rows){
  try{
   const claimed=await transaction(async(c)=>{
    const result=await c.query("select s.*,o.title,c.billing_email,c.legal_name from subscriptions s join offers o on o.id=s.offer_id join client_accounts c on c.id=s.client_id where s.id=$1 and s.status='ACTIVE' for update skip locked",[row.id]);
    const s=result.rows[0];if(!s||!s.token_encrypted||!s.agreement_id)return null;
    const ref=`RN-${crypto.randomBytes(8).toString('hex')}`;
    const p=(await c.query(`insert into payment_requests(offer_id,client_id,public_reference,merchant_order_id,term_code,cadence_code,calculation,amount,currency,mode,status)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PROCESSING') returning id`,[s.offer_id,s.client_id,crypto.randomBytes(12).toString('base64url'),ref,s.term_code,s.cadence_code,JSON.stringify({futureCharge:Number(s.recurring_amount),cycleMonths:({MONTHLY:1,QUARTERLY:3,SEMIANNUAL:6,ANNUAL_UPFRONT:12})[s.cadence_code],taxStatus:'AWAITING_FINANCE'}),s.recurring_amount,s.currency,gatewayMode()])).rows[0];
    await c.query('update subscriptions set status=$1 where id=$2',['PENDING_RENEWAL_PAYMENT',s.id]);
    return {...s,paymentId:p.id,orderReference:ref};
   });
   if(!claimed)continue;
   try{const result=await payWithToken({...claimed,card_token:cryptoDecode(claimed.token_encrypted)},claimed.orderReference);dispatched++;
    await q('insert into audit_events(action,entity_type,entity_id,details) values($1,$2,$3,$4)',['RENEWAL_SUBMITTED','subscription',claimed.id,JSON.stringify({paymentId:claimed.paymentId,processorStatus:String(result?.status||'PENDING')})]);
   }catch(e){failed++;await q('update subscriptions set status=$1 where id=$2',['PAST_DUE',claimed.id]);await q('update payment_requests set status=$1 where id=$2',['FAILED',claimed.paymentId]);await email({eventKey:`renewal-failed:${claimed.paymentId}`,template:'RECURRING_PAYMENT_FAILED',to:claimed.billing_email,company:claimed.legal_name,detail:`${claimed.currency} ${Number(claimed.recurring_amount).toFixed(2)}`}).catch(()=>{});}
  }catch(e){failed++;console.error('Renewal processing error:',e.message)}
 }
 return Response.json({processed:dispatched,failed});
}
