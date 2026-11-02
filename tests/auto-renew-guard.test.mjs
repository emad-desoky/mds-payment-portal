import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../app/api/[...route]/route.js',import.meta.url),'utf8');
const cron=readFileSync(new URL('../app/api/cron/renewals/route.js',import.meta.url),'utf8');
const checkout=readFileSync(new URL('../components/PayFlow.jsx',import.meta.url),'utf8');
test('only new explicitly-authorized card agreements can trigger live renewals',()=>{
 assert.match(api,/calc\.autoRenewVersion='finance-approved-v2'/);
 assert.equal((cron.match(/autoRenewVersion'='finance-approved-v2'/g)||[]).length,2);
 assert.match(cron,/s\.auto_charge_consent_at is not null/);
 assert.match(cron,/initial\.calculation->>'autoChargeConsentAt' is not null/);
});
test('customer chooses among Finance-approved packages and separately opts into Auto-renew',()=>{
 assert.match(checkout,/plan-choice-grid/);
 assert.match(checkout,/billingMonths:selectedMonths/);
 assert.match(checkout,/role="switch"/);
 assert.doesNotMatch(checkout,/1\. Commitment term|2\. Billing schedule|No repeated automatic charge/);
 assert.match(checkout,/We'll remind you when your next payment is due/);
});
