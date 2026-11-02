import test from 'node:test';
import assert from 'node:assert/strict';
import {startPayment} from '../lib/kashier.js';
const payment={mode:'live',amount:1500,currency:'EGP',public_reference:'ref-test',merchant_order_id:'MDS-unique-service-123',
 calculation:{cycles:3,collectionMethod:'MANUAL',cycleMonths:1,futureCharge:1000,termEndDate:'2027-02-10'}};
const client={id:'client-one',billing_email:'contact@company.example',locale:'en'};
const offer={title:'Example managed service',transaction_family:'RECURRING'};
async function capture(input){
 const previousFetch=globalThis.fetch;
 const vars=['KASHIER_MERCHANT_ID','KASHIER_LIVE_API_KEY','KASHIER_LIVE_SECRET_KEY','APP_URL'];
 const saved=vars.map(k=>process.env[k]);
 let body,headers,url;
 try{
  process.env.KASHIER_MERCHANT_ID='MID-test';
  process.env.KASHIER_LIVE_API_KEY='fake-api';
  process.env.KASHIER_LIVE_SECRET_KEY='fake-secret';
  process.env.APP_URL='https://billing.example';
  globalThis.fetch=async(uri,options)=>{
   url=uri;headers=options.headers;body=JSON.parse(options.body);
   return {ok:true,status:200,json:async()=>({_id:'session-test',sessionUrl:'https://payments.kashier.io/session/test'})};
  };
  const result=await startPayment(input,client,offer);
  return {body,url,headers,result};
 }finally{
  globalThis.fetch=previousFetch;
  vars.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);
 }
}
test('recurring service using MANUAL collection sends the same one-time Kashier payload as a project invoice',async()=>{
 const r=await capture(payment);
 assert.equal(r.body.order,payment.merchant_order_id);
 assert.equal(r.body.interactionSource,'ECOMMERCE');
 assert.equal(r.body.type,'one-time');
 assert.equal(r.body.saveCard,undefined);
 assert.equal(r.body.agreement,undefined);
 assert.equal(r.body.merchantOrderId,undefined);
 assert.equal(r.url,'https://api.kashier.io/v3/payment/sessions');
 assert.equal(r.result.url,'https://payments.kashier.io/session/test');
});
test('monthly payment link never saves card or includes recurring agreement',async()=>{
 const r=await capture({...payment,calculation:{collectionMethod:'MANUAL',billingCycleId:'cycle-abc',cycles:1}});
 assert.equal(r.body.order,payment.merchant_order_id);
 assert.equal(r.body.saveCard,undefined);
 assert.equal(r.body.interactionSource,'ECOMMERCE');
});
test('auto charge only uses the tokenization payload when server records explicit client consent',async()=>{
 const r=await capture({...payment,calculation:{...payment.calculation,collectionMethod:'AUTO',autoChargeConsentAt:'2026-11-02T10:00:00Z'}});
 assert.equal(r.body.merchantOrderId,payment.merchant_order_id);
 assert.equal(r.body.order,undefined);
 assert.equal(r.body.saveCard,'forced');
 assert.equal(r.body.interactionSource,'RECURRING');
 assert.equal(r.body.agreement.paymentFrequency,'MONTHLY');
});
test('recurring payload cannot activate without explicit consent timestamp',async()=>{
 const r=await capture({...payment,calculation:{...payment.calculation,collectionMethod:'AUTO'}});
 assert.equal(r.body.order,payment.merchant_order_id);
 assert.equal(r.body.saveCard,undefined);
});
