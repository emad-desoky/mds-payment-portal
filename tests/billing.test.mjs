import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {calculate,addMonths,money,cryptoEncode,cryptoDecode} from '../lib/billing.js';
import {verifyWebhookSignature,gatewayMode,recurringChargesEnabled,startPayment} from '../lib/kashier.js';
const sample={allowed_terms:['COMMIT_3M','COMMIT_12M'],cadence_matrix:{COMMIT_3M:['MONTHLY','QUARTERLY'],COMMIT_12M:['MONTHLY','QUARTERLY','ANNUAL_UPFRONT']},professional_fee:1000,setup_fee:200,pass_through_fee:50,currency:'EGP',benefit_kind:'NO_BENEFIT',benefit_value:0,tax_approved:false,version:1};
test('three month offer with monthly installments',()=>{const b=calculate(sample,'COMMIT_3M','MONTHLY');assert.equal(b.firstCharge,1250);assert.equal(b.futureCharge,1000);assert.equal(b.cycles,3);assert.equal(b.taxStatus,'AWAITING_FINANCE');});
test('annual upfront shows one cycle with setup',()=>{const b=calculate(sample,'COMMIT_12M','ANNUAL_UPFRONT');assert.equal(b.firstCharge,12250);assert.equal(b.cycles,1);});
test('not offered schedule rejects',()=>assert.throws(()=>calculate(sample,'COMMIT_3M','ANNUAL_UPFRONT')));
test('approved reduction changes recurring fee only',()=>{const b=calculate({...sample,benefit_kind:'PERCENT_REDUCTION',benefit_value:10},'COMMIT_3M','MONTHLY');assert.equal(b.firstCharge,1150);assert.equal(b.futureCharge,900);});
test('date clamp on month crossing',()=>assert.equal(addMonths(new Date('2026-01-31T00:00:00.000Z'),1).toISOString().slice(0,10),'2026-02-28'));
test('card agreement token encryption round trip',()=>{process.env.SESSION_SECRET='a'.repeat(65);const x=cryptoEncode('card_token_test');assert.notEqual(x,'card_token_test');assert.equal(cryptoDecode(x),'card_token_test');});
test('valid payment webhook signature verified and tampering rejected',()=>{process.env.KASHIER_TEST_API_KEY='test_api_key_secret';const data={amount:200,currency:'EGP',status:'SUCCESS',signatureKeys:['status','amount','currency']};const signed=crypto.createHmac('sha256',process.env.KASHIER_TEST_API_KEY).update('amount=200&currency=EGP&status=SUCCESS').digest('hex');assert.equal(verifyWebhookSignature(data,signed,'test'),true);assert.equal(verifyWebhookSignature({...data,amount:201},signed,'test'),false);});
test('live payments require explicit release',()=>{process.env.KASHIER_MODE='live';process.env.ENABLE_LIVE_PAYMENTS='false';assert.equal(gatewayMode(),'test');});

test('live checkout never enables recurring charges without separate approval',()=>{
 const names=['KASHIER_MODE','ENABLE_LIVE_PAYMENTS','ENABLE_RECURRING_CHARGES'];
 const original=names.map(x=>process.env[x]);
 try{
  process.env.KASHIER_MODE='live';process.env.ENABLE_LIVE_PAYMENTS='true';
  delete process.env.ENABLE_RECURRING_CHARGES;
  assert.equal(gatewayMode(),'live');
  assert.equal(recurringChargesEnabled(),false);
  process.env.ENABLE_RECURRING_CHARGES='true';
  assert.equal(recurringChargesEnabled(),true);
  process.env.ENABLE_LIVE_PAYMENTS='false';
  assert.equal(recurringChargesEnabled(),false);
 }finally{
  names.forEach((key,i)=>{if(original[i]===undefined)delete process.env[key];else process.env[key]=original[i];});
 }
});

test('Kashier live session rejection surfaces safe HTTP diagnostics instead of a generic 500',async()=>{
 const priorFetch=globalThis.fetch;
 const names=['KASHIER_MERCHANT_ID','KASHIER_LIVE_API_KEY','KASHIER_LIVE_SECRET_KEY'];
 const originals=names.map(k=>process.env[k]);
 const oldError=console.error;const logs=[];
 try{
  process.env.KASHIER_MERCHANT_ID='MID-TEST';
  process.env.KASHIER_LIVE_API_KEY='test-live-payment-key';
  process.env.KASHIER_LIVE_SECRET_KEY='test-live-secret';
  console.error=(...args)=>logs.push(args);
  globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({code:'MERCHANT_INACTIVE',message:'Invalid credentials for sample@example.com'})});
  const payment={mode:'live',amount:1400,currency:'EGP',public_reference:'test-ref',merchant_order_id:'test-order'};
  const client={id:'client-id',billing_email:'test@example.com',locale:'en'};
  const offer={title:'MDS test',transaction_family:'ONE_TIME'};
  await assert.rejects(startPayment(payment,client,offer),e=>e.status===502&&e.code==='KASHIER_HTTP_403'&&/credentials or access/.test(e.message)&&!e.message.includes('sample@example.com'));
  assert.ok(logs.some(x=>String(x[0]).includes('kashier:rejected')&&x[1]?.httpStatus===403&&x[1]?.providerCode==='MERCHANT_INACTIVE'&&!String(x[1]?.providerMessage).includes('sample@example.com')));
 }finally{
  globalThis.fetch=priorFetch;console.error=oldError;
  names.forEach((key,i)=>{if(originals[i]===undefined)delete process.env[key];else process.env[key]=originals[i]});
 }
});

test('rolling Monthly Flex bills monthly but has no multi-month commitment',()=>{
 const offer={...sample,allowed_terms:['MONTHLY_FLEX'],cadence_matrix:{MONTHLY_FLEX:['MONTHLY']},auto_renew:true};
 const quote=calculate(offer,'MONTHLY_FLEX','MONTHLY');
 assert.equal(quote.termMonths,1);
 assert.equal(quote.cycles,12);
 assert.equal(quote.cycleMonths,1);
 assert.equal(quote.rollingMonthly,true);
 assert.ok(quote.nextPaymentDate);
 assert.equal(quote.autoRenew,true);
});
test('Monthly Flex without approved renewal remains a single payment',()=>{
 const offer={...sample,allowed_terms:['MONTHLY_FLEX'],cadence_matrix:{MONTHLY_FLEX:['MONTHLY']},auto_renew:false};
 const quote=calculate(offer,'MONTHLY_FLEX','MONTHLY');
 assert.equal(quote.cycles,1);
 assert.equal(quote.rollingMonthly,false);
 assert.equal(quote.nextPaymentDate,null);
});
