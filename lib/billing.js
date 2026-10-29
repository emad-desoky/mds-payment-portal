import crypto from 'node:crypto';
export const TERM_MONTHS={MONTHLY_FLEX:1,COMMIT_3M:3,COMMIT_6M:6,COMMIT_12M:12};
export const CADENCE_MONTHS={MONTHLY:1,QUARTERLY:3,SEMIANNUAL:6,ANNUAL_UPFRONT:12};
export function money(n){return Math.round((Number(n)||0)*100)/100;}
export function calculate(offer,term,cadence){
 const terms=Array.isArray(offer.allowed_terms)?offer.allowed_terms:[];
 if(!terms.includes(term))throw Error('This commitment is not available');
 const allowed=offer.cadence_matrix?.[term]||[];
 if(!allowed.includes(cadence))throw Error('This billing schedule is not available');
 const termMonths=TERM_MONTHS[term];const cycleMonths=CADENCE_MONTHS[cadence];
 if(!termMonths||!cycleMonths||cycleMonths>termMonths||termMonths%cycleMonths!==0)throw Error('Invalid billing selection');
 const professional=money(offer.professional_fee),setup=money(offer.setup_fee),pass=money(offer.pass_through_fee);
 if(professional<0||setup<0||pass<0)throw Error('Invalid commercial amount');
 const benefitKind=offer.benefit_kind||'NO_BENEFIT';const benefit=Number(offer.benefit_value||0);
 let monthlyReduction=0,setupReduction=0;
 if(benefitKind==='PERCENT_REDUCTION')monthlyReduction=money(professional*benefit/100);
 else if(benefitKind==='FIXED_REDUCTION')monthlyReduction=money(benefit);
 else if(benefitKind==='SETUP_FEE_WAIVER_OR_REDUCTION')setupReduction=Math.min(setup,money(benefit));
 else if(!['NO_BENEFIT','PRICE_LOCK','VALUE_ADD','CUSTOM_APPROVED_BENEFIT'].includes(benefitKind))throw Error('Invalid benefit');
 if(benefit<0||monthlyReduction>professional||setupReduction>setup)throw Error('Invalid approved benefit');
 const rate=money(professional-monthlyReduction),future=money(rate*cycleMonths),initial=money(future+setup-setupReduction+pass);
 let tax=null,first=initial;
 if(offer.tax_approved&&offer.tax_rate!==null){tax=money(initial*Number(offer.tax_rate));first=money(initial+tax)}
 // Monthly Flex has a one-month commitment. Rolling collection is separate,
 // requires explicit Finance approval, and is capped at 12 authorized charges.
 const rollingMonthly=term==='MONTHLY_FLEX'&&cadence==='MONTHLY'&&offer.auto_renew===true;
 const cycles=rollingMonthly?12:termMonths/cycleMonths;
 const agreementMonths=rollingMonthly?12:termMonths;
 return {term,cadence,currency:offer.currency,termMonths,cycleMonths,cycles,rollingMonthly,
  monthlyProfessional:professional,monthlyReduction,setup,setupReduction,passThrough:pass,
  firstCharge:first,futureCharge:future,subtotal:initial,tax,taxStatus:tax===null?'AWAITING_FINANCE':'APPROVED',
  nextPaymentDate:cycles>1?addMonths(new Date(),cycleMonths).toISOString().slice(0,10):null,
  termEndDate:addMonths(new Date(),agreementMonths).toISOString().slice(0,10),
  autoRenew:rollingMonthly,offerVersion:offer.version};
}
export function addMonths(date,num){const dt=new Date(date);const day=dt.getUTCDate();dt.setUTCDate(1);dt.setUTCMonth(dt.getUTCMonth()+num);const end=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0)).getUTCDate();dt.setUTCDate(Math.min(day,end));return dt;}
export function cryptoEncode(plaintext){const key=crypto.createHash('sha256').update(`mds-payment-token-v1|${process.env.SESSION_SECRET}`).digest();const nonce=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',key,nonce);const result=Buffer.concat([c.update(String(plaintext),'utf8'),c.final()]);return `${nonce.toString('hex')}.${c.getAuthTag().toString('hex')}.${result.toString('hex')}`;}
export function cryptoDecode(value){const [n,t,s]=String(value).split('.');const key=crypto.createHash('sha256').update(`mds-payment-token-v1|${process.env.SESSION_SECRET}`).digest();const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(n,'hex'));d.setAuthTag(Buffer.from(t,'hex'));return Buffer.concat([d.update(Buffer.from(s,'hex')),d.final()]).toString();}
