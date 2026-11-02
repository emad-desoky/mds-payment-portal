// Finance owns the service term and prices; clients may only approve or decline auto-renew.
import {addMonthsOnDay,validateFirstMonthlyRenewal} from './renewal-dates.js';
const cash=n=>Math.round(Number(n)*100)/100;
export const ALLOWED_PLAN_MONTHS=[1,3,6,12];
export const DISCOUNT_TYPES=['NONE','PERCENT','FIXED'];
export function validatePlanInput({months,discountType,discountValue,monthlyFee}){
 const m=Number(months),d=Number(discountValue||0),rate=Number(monthlyFee);
 if(!Number.isInteger(m)||m<1||m>36)throw Object.assign(Error('Billing period must be a whole number from 1 to 36 months'),{status:400});
 if(!Number.isFinite(rate)||rate<0||!Number.isFinite(d)||d<0)throw Object.assign(Error('Invalid billing or discount amount'),{status:400});
 if(!DISCOUNT_TYPES.includes(discountType))throw Object.assign(Error('Choose a valid discount type'),{status:400});
 const gross=cash(m*rate);
 if(discountType==='PERCENT'&&d>100)throw Object.assign(Error('Percentage discount cannot exceed 100%'),{status:400});
 if(discountType==='FIXED'&&d>gross)throw Object.assign(Error('Fixed discount cannot exceed the service fee for this package'),{status:400});
 return {months:m,discountType,discountValue:discountType==='NONE'?0:cash(d)};
}
export function financePlanQuote(offer,method='MANUAL',now=new Date()){
 if(offer.transaction_family!=='RECURRING')throw Error('Finance package is not recurring');
 const {months,discountType,discountValue}=validatePlanInput({
  months:offer.billing_period_months,discountType:offer.plan_discount_type||'NONE',
  discountValue:offer.plan_discount_value,monthlyFee:offer.professional_fee
 });
 if(!['MANUAL','AUTO'].includes(method))throw Object.assign(Error('Invalid renewal choice'),{status:400});
 if(method==='AUTO'&&offer.allow_auto_charge!==true)throw Object.assign(Error('Automatic renewal is not approved for this offer'),{status:400});
 const gross=cash(Number(offer.professional_fee)*months);
 const discountAmount=discountType==='PERCENT'?cash(gross*discountValue/100):discountType==='FIXED'?discountValue:0;
 const perCycle=cash(gross-discountAmount);
 const setup=cash(Number(offer.setup_fee||0)),passThrough=cash(Number(offer.pass_through_fee||0));
 const firstSubtotal=cash(perCycle+setup+passThrough);
 const rate=offer.tax_approved?Number(offer.tax_rate||0):0;
 const firstTax=offer.tax_approved?cash(firstSubtotal*rate):null;
 const futureTax=offer.tax_approved?cash(perCycle*rate):null;
 const firstCharge=cash(firstSubtotal+(firstTax||0)),futureCharge=cash(perCycle+(futureTax||0));
 if(firstCharge<=0||futureCharge<=0)throw Object.assign(Error('Package price must be greater than zero'),{status:400});
 const date=validateFirstMonthlyRenewal(offer.first_monthly_renewal_date,now,method==='AUTO'?25*months:1);
 const anchorDay=Number(date.slice(8,10));
 // Auto-renew card authorization has a finite cap of 12 payments. Manual invoicing
 // continues while the active service is retained by Finance.
 const cycles=12;
 return {term:`PACKAGE_${months}M`,cadence:`EVERY_${months}M`,planMonths:months,cycleMonths:months,cycles,
  rollingMonthly:true,rollingManual:method==='MANUAL',autoRenew:true,collectionMethod:method,
  currency:offer.currency,monthlyProfessional:Number(offer.professional_fee),monthlyReduction:0,
  discountKind:discountType,discountValue,discountAmount,grossCycle:gross,setup,setupReduction:0,passThrough,
  subtotal:firstSubtotal,firstCharge,futureCharge,tax:firstTax,futureTax,
  taxStatus:firstTax===null?'AWAITING_FINANCE':'APPROVED',firstRenewalDate:date,nextPaymentDate:date,renewalAnchorDay:anchorDay,
  termEndDate:method==='AUTO'?addMonthsOnDay(date,12*months,anchorDay):null,
  autoChargeAllowed:offer.allow_auto_charge===true,offerVersion:offer.version};
}
export function resolveFinanceQuote(offer,method='MANUAL',now=new Date(),legacyCalculate){
 if(offer.transaction_family==='RECURRING'&&offer.billing_period_months!=null)
  return financePlanQuote(offer,method,now);
 // Old approved links are accepted only when Finance had selected a single clear
 // term+frequency. Never let the client override the commercial agreement.
 const allowed=Array.isArray(offer.allowed_terms)?offer.allowed_terms:[];
 if(allowed.length!==1)throw Object.assign(Error('Finance must select one approved package before sending this payment link'),{status:409});
 const cadence=offer.cadence_matrix?.[allowed[0]]||[];
 if(cadence.length!==1)throw Object.assign(Error('Finance must select one billing schedule for this offer'),{status:409});
 return legacyCalculate(offer,allowed[0],cadence[0],now,method);
}
