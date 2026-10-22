import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {calculate,addMonths,money,cryptoEncode,cryptoDecode} from '../lib/billing.js';
import {verifyWebhookSignature,gatewayMode,recurringChargesEnabled} from '../lib/kashier.js';
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
