import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {q,one,transaction} from '../../../lib/db.js';
import {getUser,requireRole,sessionCookie,clearSessionCookie,checkOrigin,hashPassword,verifyPassword,rateLimit,randomToken,hexhash,safeString,audit} from '../../../lib/security.js';
import {calculate,money} from '../../../lib/billing.js';
import {startPayment,gatewayMode,refundPayment,verifySession} from '../../../lib/kashier.js';
import {email} from '../../../lib/email.js';
import {receiveWebhook} from '../../../lib/webhook.js';
export const runtime='nodejs';export const dynamic='force-dynamic';
function ok(data={},status=200){return NextResponse.json({ok:true,...data},{status,headers:{'Cache-Control':'no-store'}});}
function err(e,route='unknown'){
 if(!e?.status||e.status>=500){
  console.error('[MDS:api:failure]',{route,status:e?.status||500,code:e?.code||undefined,reason:String(e?.message||'Unknown server error').slice(0,200)});
 }
 return NextResponse.json({ok:false,error:e?.status?e.message:'Unable to complete this request',code:e?.code||undefined},{status:e?.status||500,headers:{'Cache-Control':'no-store'}});
}
const path=p=>p.route.join('/');
const json=async(req)=>{const body=await req.json();if(!body||typeof body!=='object'||Array.isArray(body))throw Object.assign(Error('Invalid request'),{status:400});return body;};
async function offerFromToken(token){if(!token||token.length<24||token.length>200)return null;return one(`select o.*,c.legal_name,c.billing_email,c.locale from offers o join client_accounts c on c.id=o.client_id where o.link_hash=$1 and o.status='SENT' and o.link_expires_at>now()`,[hexhash(token)]);}
export async function GET(req,{params}){
 const p=path(await params);const url=new URL(req.url);
 try{
  if(p==='health')return ok({service:'MDS Payments',status:'online'});
  if(p==='auth/me'){const user=await getUser();return ok({user:user?{username:user.username,role:user.role,clientId:user.client_id,passwordResetRequired:user.password_reset_required}:null});}
  if(p==='offer'){const offer=await offerFromToken(url.searchParams.get('token'));if(!offer)return ok({valid:false});return ok({valid:true,offer:{title:offer.title,ref:offer.commercial_reference,client:offer.legal_name,currency:offer.currency,kind:offer.transaction_family,terms:offer.allowed_terms,matrix:offer.cadence_matrix,benefit:offer.benefit_kind,expiresAt:offer.link_expires_at}});}
  if(p==='payment/status'){
   const ref=url.searchParams.get('reference');if(!ref||ref.length>80)return ok({status:'UNKNOWN'});
   const payment=await one('select status,currency,amount,public_reference from payment_requests where public_reference=$1',[ref]);return ok({status:payment?.status||'UNKNOWN',currency:payment?.currency,amount:payment?.amount});
  }
  if(p==='client/overview'||p==='client/invoices'||p==='client/subscriptions'){
   const user=await requireRole(['client_owner','finance_admin']);const clientId=user.client_id;
   if(!clientId)return ok({client:null,invoices:[],subscriptions:[],payments:[]});
   const client=await one('select id,legal_name,billing_email,status,locale from client_accounts where id=$1',[clientId]);
   const invoices=(await q('select * from invoices where client_id=$1 order by issued_at desc limit 150',[clientId])).rows;
   const subs=(await q('select id,term_code,cadence_code,recurring_amount,currency,cycles_remaining,next_charge_at,term_end,status,masked_method from subscriptions where client_id=$1 order by created_at desc limit 30',[clientId])).rows;
   const payments=(await q('select public_reference,amount,currency,status,created_at,paid_at from payment_requests where client_id=$1 order by created_at desc limit 80',[clientId])).rows;
   return ok({client,invoices,subscriptions:subs,payments});
  }
  if(p.startsWith('admin/')){
   await requireRole();
   if(p==='admin/dashboard'){
    const [counts,payments,reviews,exceptions,notifications]=await Promise.all([
     one(`select (select count(*) from client_accounts)::int clients,(select count(*) from offers)::int offers,(select count(*) from payment_requests where status='PAID')::int paid,(select count(*) from subscriptions where status='PAST_DUE')::int past_due`),
     q(`select pr.id,pr.public_reference,pr.amount,pr.currency,pr.status,pr.created_at,pr.paid_at,c.legal_name,o.title from payment_requests pr join client_accounts c on c.id=pr.client_id join offers o on o.id=pr.offer_id order by pr.created_at desc limit 60`),
     q(`select s.id,c.legal_name,s.currency,s.recurring_amount,s.next_charge_at,s.status from subscriptions s join client_accounts c on c.id=s.client_id order by s.next_charge_at asc nulls last limit 25`),
     q('select * from reconciliation_exceptions where status=$1 order by created_at desc limit 30',['OPEN']),
     q('select * from notification_events where status=$1 order by created_at desc limit 30',['FAILED'])]);
    return ok({counts,payments:payments.rows,reviews:reviews.rows,exceptions:exceptions.rows,notifications:notifications.rows});
   }
   if(p==='admin/clients')return ok({clients:(await q('select * from client_accounts order by created_at desc limit 250')).rows});
   if(p==='admin/offers')return ok({offers:(await q(`select o.*,c.legal_name from offers o join client_accounts c on c.id=o.client_id order by o.created_at desc limit 250`)).rows});
   if(p==='admin/settings')return ok({settings:(await q('select key,value,status,updated_at from portal_settings order by key')).rows});
   if(p==='admin/invoices')return ok({invoices:(await q(`select i.*,c.legal_name from invoices i join client_accounts c on i.client_id=c.id order by issued_at desc limit 250`)).rows});
   if(p==='admin/transactions')return ok({transactions:(await q(`select t.*,p.public_reference,c.legal_name from gateway_transactions t left join payment_requests p on p.id=t.request_id left join client_accounts c on c.id=p.client_id order by t.recorded_at desc limit 250`)).rows});
   if(p==='admin/requests')return ok({requests:(await q(`select p.*,c.legal_name,o.title from payment_requests p join client_accounts c on c.id=p.client_id join offers o on o.id=p.offer_id order by p.created_at desc limit 250`)).rows});
   if(p==='admin/support')return ok({tickets:(await q('select * from support_tickets order by created_at desc limit 250')).rows});
   if(p==='admin/audit')return ok({events:(await q('select action,entity_type,entity_id,details,occurred_at from audit_events order by occurred_at desc limit 250')).rows});
   if(p==='admin/reconciliation')return ok({exceptions:(await q('select * from reconciliation_exceptions order by created_at desc limit 250')).rows,webhooks:(await q('select * from webhook_events order by received_at desc limit 100')).rows});
   if(p==='admin/subscriptions')return ok({subscriptions:(await q('select s.id,s.term_code,s.cadence_code,s.recurring_amount,s.currency,s.cycles_remaining,s.next_charge_at,s.status,c.legal_name from subscriptions s join client_accounts c on c.id=s.client_id order by s.created_at desc limit 250')).rows});
  }
  if(p.startsWith('invoices/')){
   const id=p.split('/')[1];const user=await requireRole(['finance_admin','client_owner']);
   const inv=await one('select i.*,c.legal_name,c.billing_email from invoices i join client_accounts c on i.client_id=c.id where i.id=$1',[id]);
   if(!inv||user.role==='client_owner'&&inv.client_id!==user.client_id)throw Object.assign(Error('Not found'),{status:404});
   const escape=v=>String(v??'').replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
   const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(inv.invoice_number)}</title><style>body{font:16px Arial;color:#173146;max-width:800px;margin:60px auto;padding:0 24px}h1{color:#0698b6}.line{border-bottom:1px solid #dbe7ed;padding:15px 0;display:flex;justify-content:space-between}.muted{color:#697e8a}.important{margin-top:60px;border-top:2px solid #0698b6;padding-top:20px}</style></head><body><h3>MEDICAL DIGITAL SOLUTIONS</h3><h1>Payment Statement</h1><p class="muted">${escape(inv.invoice_number)} · ${escape(new Date(inv.issued_at).toLocaleDateString('en-GB'))}</p><div class="line"><span>Client</span><b>${escape(inv.legal_name)}</b></div><div class="line"><span>Service</span><b>${escape(inv.title)}</b></div><div class="line"><span>Payment status</span><b>${escape(inv.status)}</b></div><div class="line"><span>Paid</span><b>${escape(inv.currency)} ${Number(inv.amount).toFixed(2)}</b></div><p class="muted important">This is a payment statement, not an Egyptian Tax Authority electronic invoice. The official tax document, if required, will follow MDS Finance processing.</p><script>window.print()</script></body></html>`;
   return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
  }
  return err(Object.assign(Error('Not found'),{status:404}));
 }catch(e){return err(e,p)}
}
export async function POST(req,{params}){
 const p=path(await params);
 try{
  if(p==='webhooks/kashier')return receiveWebhook(req);
  if(!checkOrigin(req))throw Object.assign(Error('Request not allowed'),{status:403});
  const b=await json(req);
  if(p==='auth/login'){
   await rateLimit('admin-login',7,20);const username=safeString(b.username,80).toLowerCase();const user=await one('select * from portal_users where username=$1 and role=$2 and active=true',[username,'finance_admin']);
   if(!user||!verifyPassword(String(b.password||''),user.password_hash))throw Object.assign(Error('Incorrect credentials'),{status:401});
   const result=ok({user:{username:user.username,role:user.role,passwordResetRequired:user.password_reset_required}});const cookie=sessionCookie(user);result.cookies.set(cookie.name,cookie.value,cookie.options);await audit(user,'LOGIN','portal_user',user.id);return result;
  }
  if(p==='auth/change-password'){
    const user=await getUser();if(!user)throw Object.assign(Error('Unauthorized'),{status:401});
    const full=await one('select password_hash from portal_users where id=$1',[user.id]);
    if(!verifyPassword(String(b.currentPassword||''),full.password_hash))throw Object.assign(Error('Current password is incorrect'),{status:400});
    if(String(b.newPassword||'').length<12||b.newPassword===b.currentPassword)throw Object.assign(Error('Choose a new password with at least 12 characters'),{status:400});
    await q('update portal_users set password_hash=$1,password_reset_required=false,session_version=session_version+1 where id=$2',[hashPassword(b.newPassword),user.id]);
    const updated=await one('select id,role,client_id,session_version from portal_users where id=$1',[user.id]);const r=ok();const cookie=sessionCookie(updated);r.cookies.set(cookie.name,cookie.value,cookie.options);await audit(user,'PASSWORD_UPDATED','portal_user',user.id);return r;
  }
  if(p==='auth/logout'){const r=ok();const c=clearSessionCookie();r.cookies.set(c.name,c.value,c.options);return r;}
  if(p==='client/request-code'){
    await rateLimit('client-code',5,20);
    const contact=safeString(b.email,250).toLowerCase();const client=await one('select id,legal_name,billing_email,locale from client_accounts where lower(billing_email)=$1',[contact]);
    if(client){const code=String(crypto.randomInt(100000,999999));const hash=hexhash(`${code}:${process.env.SESSION_SECRET}`);
     await q("insert into access_codes(client_id,email,code_hash,expires_at) values($1,$2,$3,now()+interval '10 minutes')",[client.id,contact,hash]);
     const delivered=await email({eventKey:`login:${client.id}:${Date.now()}`,template:'LOGIN_CODE',to:contact,company:client.legal_name,code,locale:client.locale});
     if(!delivered)throw Object.assign(Error('Email delivery is temporarily unavailable. Please contact MDS billing support.'),{status:503});
    }
    return ok({message:'If this email belongs to an authorized MDS billing client, a sign-in code will arrive shortly. If you receive nothing, contact billing to verify your registered address.'});
  }
  if(p==='client/verify-code'){
    await rateLimit('verify-code',10,15);const contact=safeString(b.email,250).toLowerCase();
    const entry=await one('select * from access_codes where email=$1 and used_at is null and expires_at>now() order by expires_at desc limit 1',[contact]);
    if(!entry||entry.attempts>=5||hexhash(`${String(b.code||'')}:${process.env.SESSION_SECRET}`)!==entry.code_hash) {
     if(entry)await q('update access_codes set attempts=attempts+1 where id=$1',[entry.id]);throw Object.assign(Error('Code is invalid or expired'),{status:401});}
    await q('update access_codes set used_at=now() where id=$1',[entry.id]);
    let user=await one('select * from portal_users where client_id=$1 and role=$2',[entry.client_id,'client_owner']);
    if(!user){user=(await q(`insert into portal_users(username,email,password_hash,role,client_id) values($1,$2,$3,'client_owner',$4) returning *`,[`client_${entry.client_id.slice(0,8)}`,contact,hashPassword(randomToken()),entry.client_id])).rows[0];}
    const r=ok();const c=sessionCookie(user);r.cookies.set(c.name,c.value,c.options);return r;
  }
  if(p==='offer/quote'){
    await rateLimit('quote',35,5);const offer=await offerFromToken(b.token);if(!offer)throw Object.assign(Error('Payment link is unavailable or expired'),{status:404});
    return ok({quote:calculate(offer,b.term,b.cadence)});
  }
  if(p==='offer/checkout'){
    await rateLimit('checkout',14,20);const offer=await offerFromToken(b.token);if(!offer)throw Object.assign(Error('Payment link is unavailable or expired'),{status:404});
    if(!offer.approval_reference||!offer.approved_by)throw Object.assign(Error('Payment request is not available'),{status:403});
    const calc=calculate(offer,b.term,b.cadence);
    if(!Number.isFinite(calc.firstCharge)||calc.firstCharge<=0)throw Object.assign(Error('Payment amount must be greater than zero'),{status:400});
    const payment=await transaction(async(c)=>{
      await c.query('select id from offers where id=$1 for update',[offer.id]);
      const existing=(await c.query("select * from payment_requests where offer_id=$1 and status in('PROCESSING','PAID') order by created_at desc limit 1",[offer.id])).rows[0];
      if(existing){if(existing.status==='PAID')throw Object.assign(Error('This payment has already been completed'),{status:409});
       if(existing.gateway_url)return {existing:true,...existing};throw Object.assign(Error('Payment preparation is in progress'),{status:409});}
      const ref=randomToken(12);const order=`MDS-${Date.now()}-${crypto.randomInt(100000,999999)}`;
      const created=(await c.query(`insert into payment_requests(offer_id,client_id,public_reference,merchant_order_id,idempotency_key,term_code,cadence_code,calculation,amount,currency,mode)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,[offer.id,offer.client_id,ref,order,safeString(b.idempotencyKey,120)||randomToken(10),b.term,b.cadence,JSON.stringify(calc),calc.firstCharge,offer.currency,gatewayMode()])).rows[0];return created;
    });
    if(payment.existing)return ok({checkoutUrl:payment.gateway_url,reference:payment.public_reference});
    try{
     const details=await startPayment(payment,{id:offer.client_id,billing_email:offer.billing_email,locale:offer.locale},offer);
     await q('update payment_requests set session_id=$1,gateway_url=$2 where id=$3',[details.id,details.url,payment.id]);
     return ok({checkoutUrl:details.url,reference:payment.public_reference});
    }catch(e){await q('update payment_requests set status=$1 where id=$2',['FAILED',payment.id]);throw e}
  }
  if(p==='support'){
   await rateLimit('support',5,30);if(!b.email||!b.message)throw Object.assign(Error('Email and message are required'),{status:400});
   const user=await getUser();await q('insert into support_tickets(client_id,name,email,category,message) values($1,$2,$3,$4,$5)',[user?.client_id||null,safeString(b.name,150),safeString(b.email,250),safeString(b.category||'Billing support',90),safeString(b.message,2000)]);return ok({message:'Your request has been received.'});
  }
  if(p.startsWith('admin/')){
   const user=await requireRole();
   if(p==='admin/clients'){
    if(!b.legal_name||!b.billing_email)throw Object.assign(Error('Company name and billing email are required'),{status:400});
    const row=(await q('insert into client_accounts(legal_name,billing_email,locale) values($1,$2,$3) returning id,legal_name,billing_email',[safeString(b.legal_name,255),safeString(b.billing_email,250).toLowerCase(),b.locale==='ar'?'ar':'en'])).rows[0];
    await audit(user,'CLIENT_CREATED','client_account',row.id);return ok({client:row});
   }
   if(p==='admin/offers'){
    const client=await one('select id from client_accounts where id=$1',[b.client_id]);if(!client)throw Object.assign(Error('Client not found'),{status:404});
    if(!b.approval_reference||!b.approved_by||!b.commercial_reference||!b.title)throw Object.assign(Error('Approved commercial reference, approver, offer reference and title are required'),{status:400});
    if(!['EGP','USD'].includes(b.currency))throw Object.assign(Error('Currency is invalid'),{status:400});
    const vals=[b.professional_fee,b.setup_fee,b.pass_through_fee].map(Number);if(vals.some(n=>!Number.isFinite(n)||n<0))throw Object.assign(Error('Invalid fee'),{status:400});
    const allowed=b.transaction_family==='RECURRING'?['MONTHLY_FLEX','COMMIT_3M','COMMIT_6M','COMMIT_12M'].filter(x=>b.allowed_terms?.includes(x)):['MONTHLY_FLEX'];
    if(!allowed.length)throw Object.assign(Error('Choose at least one commitment'),{status:400});
    const matrix=Object.fromEntries(allowed.map(x=>[x,(Array.isArray(b.cadence_matrix?.[x])?b.cadence_matrix[x]:[]).filter(c=>['MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL_UPFRONT'].includes(c))]));
    if(Object.values(matrix).some(a=>!a.length))throw Object.assign(Error('Select permitted billing schedules'),{status:400});
    const mode=b.transaction_family==='RECURRING'?'RECURRING':'ONE_TIME';
    const row=(await q(`insert into offers(client_id,title,commercial_reference,transaction_family,currency,professional_fee,setup_fee,pass_through_fee,allowed_terms,cadence_matrix,approval_reference,approved_by,approved_at,status)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),'APPROVED') returning id`,[client.id,safeString(b.title,250),safeString(b.commercial_reference,150),mode,b.currency,...vals,JSON.stringify(allowed),JSON.stringify(matrix),safeString(b.approval_reference,250),safeString(b.approved_by,150)])).rows[0];
    await audit(user,'OFFER_APPROVED','offer',row.id,{reference:b.approval_reference,currency:b.currency});return ok({offer:row});
   }
   if(p==='admin/send-offer'){
    const item=await one("select o.*,c.legal_name,c.billing_email,c.locale from offers o join client_accounts c on c.id=o.client_id where o.id=$1 and o.status in('APPROVED','SENT')",[b.offer_id]);
    if(!item)throw Object.assign(Error('Approved offer not found'),{status:404});
    const token=randomToken(32);const expiry=Math.max(1,Math.min(30,Number(b.expiry_days)||7));
    await q("update offers set link_hash=$1,link_expires_at=now()+($2::int*interval '1 day'),status='SENT' where id=$3",[hexhash(token),expiry,item.id]);
    const link=`${process.env.APP_URL}/pay/${token}`;await audit(user,'PAYMENT_LINK_CREATED','offer',item.id,{days:expiry});
    if(b.send_email)await email({eventKey:`offer-link:${item.id}:${Date.now()}`,template:'OFFER_LINK_SENT',to:item.billing_email,company:item.legal_name,link,detail:`Reference: ${item.commercial_reference}`,locale:item.locale});
    return ok({link});
   }
   if(p==='admin/settings'){
    const key=safeString(b.key,80);const existing=await one('select * from portal_settings where key=$1',[key]);if(!existing)throw Object.assign(Error('Unknown setting'),{status:404});
    const value=safeString(b.value,1200);const status=b.status==='APPROVED'?'APPROVED':'NEEDS_APPROVAL';
    await q('update portal_settings set value=$1::jsonb,status=$2,updated_by=$3,updated_at=now() where key=$4',[JSON.stringify(value),status,user.id,key]);
    await audit(user,'CONFIG_UPDATED','setting',key,{status});return ok();
   }
   if(p==='admin/support'){
    await q('update support_tickets set status=$1 where id=$2',[b.status==='RESOLVED'?'RESOLVED':'OPEN',b.id]);await audit(user,'SUPPORT_UPDATED','ticket',b.id);return ok();
   }
   if(p==='admin/refund'){
    const policy=await one('select status from portal_settings where key=$1',['refund_policy']);
    if(policy?.status!=='APPROVED')throw Object.assign(Error('Refund policy approval is required'),{status:403});
    const tx=await one("select * from gateway_transactions where id=$1 and gateway_status='SUCCESS' and event_type in ('pay','capture')",[b.transaction_id]);
    if(!tx)throw Object.assign(Error('Paid transaction not found'),{status:404});
    const amount=money(b.amount);if(!amount||amount>Number(tx.amount)||!b.reason)throw Object.assign(Error('Invalid amount or reason'),{status:400});
    const key=safeString(b.idempotencyKey,100)||randomToken(15);
    const refund=await one(`insert into refunds(transaction_id,amount,currency,reason,idempotency_key,created_by) values($1,$2,$3,$4,$5,$6) on conflict(idempotency_key) do nothing returning id`,[tx.id,amount,tx.currency,safeString(b.reason,500),key,user.id]);
    if(!refund)return ok({status:'PENDING'});
    await audit(user,'REFUND_REQUESTED','refund',refund.id,{amount,currency:tx.currency});
    try{const requestInfo=await one('select mode from payment_requests where id=$1',[tx.request_id]);const result=await refundPayment(tx,amount,safeString(b.reason,500),requestInfo?.mode);
       await q('update refunds set gateway_reference=$1,status=$2 where id=$3',[tx.gateway_order_id, 'PENDING',refund.id]);return ok({status:'PENDING',gatewayStatus:result?.status||'SUBMITTED'});
    }catch(e){await q('update refunds set status=$1 where id=$2',['FAILED',refund.id]);throw e;}
   }
  }
  return err(Object.assign(Error('Not found'),{status:404}));
 }catch(e){return err(e,p)}
}
