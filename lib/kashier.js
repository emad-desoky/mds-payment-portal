import crypto from 'node:crypto';
const mode=()=>process.env.KASHIER_MODE==='live'&&process.env.ENABLE_LIVE_PAYMENTS==='true'?'live':'test';
export function gatewayMode(){return mode();}
// Recurring merchant-initiated charges have a separate release switch from live checkout.
export function recurringChargesEnabled(){return mode()==='live'&&process.env.ENABLE_RECURRING_CHARGES==='true';}
const paymentKey=(m=mode())=>process.env[m==='live'?'KASHIER_LIVE_API_KEY':'KASHIER_TEST_API_KEY'];
const secretKey=(m=mode())=>process.env[m==='live'?'KASHIER_LIVE_SECRET_KEY':'KASHIER_TEST_SECRET_KEY'];
const host=(m=mode())=>m==='live'?'https://api.kashier.io':'https://test-api.kashier.io';
const fep=(m=mode())=>m==='live'?'https://fep.kashier.io':'https://test-fep.kashier.io';
async function jsonResponse(url,options){const resp=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(18000)});let body={};try{body=await resp.json()}catch{}if(!resp.ok)throw Object.assign(new Error('Payment processor is unavailable'),{gatewayStatus:resp.status});return body;}
export async function startPayment(request,client,offer){
 const m=request.mode;
 const b={
  expireAt:new Date(Date.now()+25*60*1000).toISOString(),maxFailureAttempts:3,paymentType:'credit',
  amount:Number(request.amount).toFixed(2),currency:request.currency,merchantId:process.env.KASHIER_MERCHANT_ID,
  merchantRedirect:`${process.env.APP_URL}/payment-status?reference=${encodeURIComponent(request.public_reference)}`,
  display:client.locale==='ar'?'ar':'en',type:'one-time',brandColor:'#03AED0',
  defaultMethod:'card',manualCapture:false,description:String(offer.title||'MDS billing').slice(0,115),
  customer:{email:client.billing_email,reference:client.id},
  serverWebhook:`${process.env.APP_URL}/api/webhooks/kashier`,failureRedirect:false
 };
 const recur=offer.transaction_family==='RECURRING'&&request.calculation.cycles>0;
 if(recur){
   b.merchantOrderId=request.merchant_order_id;
   b.allowedMethods='card';b.saveCard='forced';b.retrieveSavedCard=true;b.interactionSource='RECURRING';b.enable3DS=true;
   const cycle=request.calculation.cycleMonths;
   b.agreement={type:'RECURRING',amountVariability:'VARIABLE',paymentFrequency:cycle===1?'MONTHLY':cycle===3?'QUARTERLY':cycle===6?'SEMIANNUAL':'ANNUAL',
    expiryDate:request.calculation.termEndDate,minimumDaysBetweenPayments:Math.max(1,cycle*25),
    maximumAmountPerPayment:Math.ceil(Math.max(Number(request.amount),request.calculation.futureCharge)*1.1),
    numberOfPayments:request.calculation.cycles};
 }else{b.order=request.merchant_order_id;b.interactionSource='ECOMMERCE';b.enable3DS=true;}
 const res=await jsonResponse(`${host(m)}/v3/payment/sessions`,{method:'POST',headers:{Authorization:secretKey(m),'api-key':paymentKey(m),'Content-Type':'application/json'},body:JSON.stringify(b)});
 if(!res.sessionUrl||!res._id)throw new Error('Payment session could not be prepared');
 const url=new URL(res.sessionUrl);if(!['payments.kashier.io','test-payments.kashier.io'].includes(url.hostname))throw Error('Unexpected payment destination');
 return {url:res.sessionUrl,id:res._id};
}
export function verifyWebhookSignature(data,signature,modeName){
 if(!data||!Array.isArray(data.signatureKeys)||typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const keys=data.signatureKeys.map(String).sort();
 if(keys.some(x=>!Object.hasOwn(data,x)||!/^\w+$/.test(x)))return false;
 const payload=keys.map(key=>`${key}=${encodeURIComponent(String(data[key]??''))}`).join('&');
 const key=paymentKey(modeName);if(!key)return false;
 const calculated=crypto.createHmac('sha256',key).update(payload).digest('hex');
 return crypto.timingSafeEqual(Buffer.from(calculated,'hex'),Buffer.from(signature.toLowerCase(),'hex'));
}
export function verifyWebhookEither(data,signature){for(const m of ['test','live'])if(verifyWebhookSignature(data,signature,m))return m;return null;}
export function extractToken(data){return data?.cardDataToken||data?.card?.cardDataToken||data?.card?.cardToken||data?.paymentMethod?.card?.cardToken||data?.cardToken||null;}
export function extractAgreementId(data){return data?.agreementId||data?.agreement?.id||data?.card?.agreementId||data?.paymentMethod?.card?.agreement?.id||null;}
export async function payWithToken(subscription,merchantOrderId){
 const m=mode();const customer=subscription.gateway_customer_ref;const amount=Number(subscription.recurring_amount).toFixed(2);
 const path=`/?payment=${process.env.KASHIER_MERCHANT_ID}.${merchantOrderId}.${amount}.${subscription.currency}.${customer}`;
 const hash=crypto.createHmac('sha256',paymentKey(m)).update(path).digest('hex');
 const body={apiOperation:'PAY',paymentMethod:{type:'CARD',card:{agreement:{id:subscription.agreement_id},enable3DS:false,cardToken:subscription.card_token}},
 order:{reference:merchantOrderId,amount:Number(amount),currency:subscription.currency},interactionSource:'CONTAUTH',
 reconciliation:{webhookUrl:`${process.env.APP_URL}/api/webhooks/kashier`,merchantRedirect:process.env.APP_URL},merchantId:process.env.KASHIER_MERCHANT_ID,
 customer:{reference:customer}};
 return jsonResponse(`${fep(m)}/v3/orders`,{method:'POST',headers:{'Kashier-Hash':hash,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
export async function refundPayment(tx,amount,reason,m=mode()){
 if(!tx.gateway_order_id)throw Error('Original gateway order ID is missing');
 const body={apiOperation:'REFUND',reason,transaction:{amount:Number(amount)}};
 if(tx.gateway_transaction_id)body.transaction.targetTransactionId=tx.gateway_transaction_id;
 return jsonResponse(`${fep(m)}/v3/orders/${encodeURIComponent(tx.gateway_order_id)}`,{method:'PUT',headers:{Authorization:secretKey(m),'Content-Type':'application/json'},body:JSON.stringify(body)});
}
export async function verifySession(sessionId,m=mode()){
 return jsonResponse(`${host(m)}/v3/payment/sessions/${encodeURIComponent(sessionId)}/payment`,{headers:{Authorization:secretKey(m)}});
}
