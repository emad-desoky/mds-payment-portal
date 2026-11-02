// Finance approves the available packages. Clients choose only from those packages.
import {addMonthsOnDay,cairoDateISO,dateOnly} from './renewal-dates.js';
const cash=n=>Math.round(Number(n)*100)/100;
export const ALLOWED_PLAN_MONTHS=[1,3,6,12];
export const DISCOUNT_TYPES=['NONE','PERCENT','FIXED'];
export function validatePlanInput({months,discountType,discountValue,monthlyFee}){
 const m=Number(months),d=Number(discountValue||0),rate=Number(monthlyFee);
 if(!Number.isInteger(m)||m<1||m>36)throw Object.assign(Error('Billing period must be 1–36 whole months'),{status:400});
 if(!Number.isFinite(rate)||rate<=0||!Number.isFinite(d)||d<0)throw Object.assign(Error('Invalid service price or discount'),{status:400});
 if(!DISCOUNT_TYPES.includes(discountType))throw Object.assign(Error('Choose a valid discount type'),{status:400});
 const gross=cash(rate*m);
 if(discountType==='PERCENT'&&d>=100)throw Object.assign(Error('Discount must leave a positive service payment'),{status:400});
 if(discountType==='FIXED'&&d>=gross)throw Object.assign(Error('Fixed discount must leave a positive service payment'),{status:400});
 return {months:m,discountType,discountValue:discountType==='NONE'?0:cash(d)};
}
export function validatePackages(packages,monthlyFee){
 if(!Array.isArray(packages)||packages.length<1||packages.length>16)
  throw Object.assign(Error('Finance must approve 1–16 payment packages'),{status:400});
 const seen=new Set();
 return packages.map(p=>{
  const plan=validatePlanInput({months:p?.months,discountType:p?.discountType||'NONE',
   discountValue:p?.discountValue||0,monthlyFee});
  if(seen.has(plan.months))throw Object.assign(Error('A package duration can only appear once'),{status:400});
  seen.add(plan.months);return plan;
 }).sort((a,b)=>a.months-b.months);
}
export function getApprovedPackages(offer){
 if(offer.transaction_family!=='RECURRING')return [];
 const saved=offer.cadence_matrix?.__packages;
 if(Array.isArray(saved)&&saved.length)return validatePackages(saved,offer.professional_fee);
 if(offer.billing_period_months!=null){
  const old={months:Number(offer.billing_period_months),discountType:offer.plan_discount_type||'NONE',
   discountValue:Number(offer.plan_discount_value||0)};
  return validatePackages(old.months===1?[old]:[{months:1,discountType:'NONE',discountValue:0},old],offer.professional_fee);
 }
 return [];
}
export function nextApprovedRenewalDate(offer,months,now=new Date()){
 const specified=dateOnly(offer.first_monthly_renewal_date);
 if(!specified)throw Object.assign(Error('Finance must approve a valid renewal day'),{status:400});
 const today=cairoDateISO(now),day=Number(today.slice(8,10)),anchor=Number(specified.slice(8,10));
 const earliest=addMonthsOnDay(today,months,day);
 let candidate=specified;
 for(let attempts=0;candidate<earliest&&attempts<450;attempts++)
  candidate=addMonthsOnDay(candidate,1,anchor);
 if(candidate<earliest)throw Object.assign(Error('Unable to calculate a safe renewal date'),{status:400});
 return candidate;
}
export function packagePrices(offer){
 return getApprovedPackages(offer).map(plan=>{
  const gross=cash(Number(offer.professional_fee)*plan.months);
  const saving=plan.discountType==='PERCENT'?cash(gross*plan.discountValue/100):
   plan.discountType==='FIXED'?plan.discountValue:0;
  return {...plan,gross,saving,price:cash(gross-saving)};
 });
}
export function financePlanQuote(offer,method='MANUAL',now=new Date(),selectedMonths){
 if(offer.transaction_family!=='RECURRING')throw Error('Finance package is not recurring');
 const packages=packagePrices(offer);
 const requested=selectedMonths==null?Number(offer.billing_period_months||packages[0]?.months):Number(selectedMonths);
 const chosen=packages.find(p=>p.months===requested);
 if(!chosen)throw Object.assign(Error('This payment plan was not approved by MDS Finance'),{status:400});
 if(!['MANUAL','AUTO'].includes(method))throw Object.assign(Error('Invalid renewal preference'),{status:400});
 if(method==='AUTO'&&offer.allow_auto_charge!==true)throw Object.assign(Error('Automatic renewal is not approved for this offer'),{status:400});
 const {months,discountType,discountValue,gross,saving,price}=chosen;
 const setup=cash(Number(offer.setup_fee||0)),passThrough=cash(Number(offer.pass_through_fee||0));
 const firstSubtotal=cash(price+setup+passThrough);
 const rate=offer.tax_approved?Number(offer.tax_rate||0):0;
 const firstTax=offer.tax_approved?cash(firstSubtotal*rate):null;
 const futureTax=offer.tax_approved?cash(price*rate):null;
 const firstCharge=cash(firstSubtotal+(firstTax||0)),futureCharge=cash(price+(futureTax||0));
 if(firstCharge<=0||futureCharge<=0)throw Object.assign(Error('Approved payment must be positive'),{status:400});
 const nextDate=nextApprovedRenewalDate(offer,months,now);
 const anchorDay=Number(nextDate.slice(8,10)),cycles=12;
 return {term:'PACKAGE_'+months+'M',cadence:'EVERY_'+months+'M',
  planMonths:months,termMonths:months,cycleMonths:months,cycles,rollingMonthly:true,
  rollingManual:method==='MANUAL',autoRenew:true,collectionMethod:method,
  currency:offer.currency,monthlyProfessional:Number(offer.professional_fee),monthlyReduction:0,
  discountKind:discountType,discountValue,discountAmount:saving,grossCycle:gross,setup,
  setupReduction:0,passThrough,subtotal:firstSubtotal,firstCharge,futureCharge,
  tax:firstTax,futureTax,taxStatus:firstTax===null?'AWAITING_FINANCE':'APPROVED',
  firstRenewalDate:nextDate,nextPaymentDate:nextDate,renewalAnchorDay:anchorDay,
  termEndDate:method==='AUTO'?addMonthsOnDay(nextDate,12*months,anchorDay):null,
  autoChargeAllowed:offer.allow_auto_charge===true,offerVersion:offer.version};
}
export function resolveFinanceQuote(offer,method='MANUAL',now=new Date(),legacyCalculate,selectedMonths){
 if(offer.transaction_family==='RECURRING'&&offer.billing_period_months!=null)
  return financePlanQuote(offer,method,now,selectedMonths);
 const allowed=Array.isArray(offer.allowed_terms)?offer.allowed_terms:[];
 if(allowed.length!==1)throw Object.assign(Error('Finance must approve a payment package before sending this link'),{status:409});
 const cadence=offer.cadence_matrix?.[allowed[0]]||[];
 if(cadence.length!==1)throw Object.assign(Error('Finance must approve one billing schedule for this offer'),{status:409});
 return legacyCalculate(offer,allowed[0],cadence[0],now,method);
}
