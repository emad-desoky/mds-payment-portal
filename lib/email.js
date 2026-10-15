import {q} from './db.js';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const dict={
  OFFER_LINK_SENT:['Your secure MDS payment link','Your approved payment request is ready.'],
  PAYMENT_SUCCESS:['Payment received','Thank you. Your payment has been confirmed.'],
  SUBSCRIPTION_ACTIVATED:['Your billing agreement is active','Your payment was confirmed and your agreed billing schedule is now active.'],
  RECURRING_PAYMENT_FAILED:['Payment needs attention','A scheduled payment could not be completed. Please contact the MDS billing team.'],
  RENEWAL_REVIEW_DUE:['Upcoming engagement review','Your engagement is approaching its review date. Our team will be in touch.'],
  REFUND_COMPLETED:['Refund confirmation','Your refund has been processed.'],
  PAYMENT_REMINDER:['Payment reminder','An approved payment request is awaiting completion.'],
  LOGIN_CODE:['Your MDS billing access code','Use the code below to sign in to your MDS billing center.']
};
export async function email({eventKey,template,to,company,detail='',link='',code='',locale='en'}){
 const [subject,msg]=dict[template]||['MDS billing update','You have an update from Medical Digital Solutions.'];
 const {rows}=await q('insert into notification_events(event_key,template_key,recipient,locale) values($1,$2,$3,$4) on conflict do nothing returning id',[eventKey,template,to,locale]);
 if(!rows[0])return false;
 const id=rows[0].id;
 const html=`<div style="background:#f3f7fa;padding:32px;font-family:Arial,sans-serif;color:#163147"><div style="max-width:560px;margin:auto;background:white;border-radius:18px;padding:36px;border:1px solid #e0e9ed"><div style="font-size:14px;color:#037e9d;font-weight:700;letter-spacing:.06em">MEDICAL DIGITAL SOLUTIONS</div><h2 style="font-size:24px">${esc(subject)}</h2><p>Hello ${esc(company||'there')},</p><p>${esc(msg)}</p>${detail?`<p>${esc(detail)}</p>`:''}${code?`<p style="font-size:26px;font-weight:700;letter-spacing:6px">${esc(code)}</p>`:''}${link?`<p><a href="${esc(link)}" style="display:inline-block;padding:14px 22px;background:#069cbd;color:white;border-radius:8px;text-decoration:none">Open secure billing</a></p>`:''}<p style="font-size:13px;color:#75889a;margin-top:32px">Medical Digital Solutions · Secure billing notifications</p></div></div>`;
 try{
  if(!process.env.RESEND_API_KEY)throw Error('Email provider unavailable');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:`Medical Digital Solutions <${process.env.RESEND_FROM||'billing@mds-healthcare.com'}>`,to:[to],subject,html})});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(`Delivery request failed (${r.status})`);
  await q('update notification_events set status=$1,provider_reference=$2,sent_at=now() where id=$3',['SENT',data.id||null,id]);return true;
 }catch(e){await q('update notification_events set status=$1,last_error=$2 where id=$3',['FAILED',e.message,id]);return false;}
}
