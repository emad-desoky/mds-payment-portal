// Calendar-date helpers for Finance-selected monthly billing dates.
// The portal's billing calendar uses Africa/Cairo; keep date-only values in UTC to avoid timezone drift.
export const MONTHLY_MIN_GAP_DAYS=25;
export function cairoDateISO(instant=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);
 const get=type=>parts.find(p=>p.type===type)?.value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function dateOnly(value){
 const candidate=value instanceof Date?value.toISOString().slice(0,10):typeof value==='string'?value.slice(0,10):'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(candidate))return null;
 const parsed=new Date(`${candidate}T00:00:00.000Z`);
 return Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==candidate?null:candidate;
}
export function addCalendarDays(iso,days){
 const d=new Date(`${iso}T00:00:00.000Z`);
 d.setUTCDate(d.getUTCDate()+days);
 return d.toISOString().slice(0,10);
}
export function addMonthsOnDay(value,months,day){
 const iso=dateOnly(value);
 if(!iso||!Number.isInteger(months)||months<0||!Number.isInteger(day)||day<1||day>31)
  throw new Error('Invalid renewal schedule');
 const initial=new Date(`${iso}T00:00:00.000Z`);
 const y=initial.getUTCFullYear(),m=initial.getUTCMonth()+months;
 const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
 return new Date(Date.UTC(y,m,Math.min(day,last))).toISOString().slice(0,10);
}
export function validateFirstMonthlyRenewal(value,instant=new Date(),minimumDays=25){
 const candidate=dateOnly(value);
 if(!candidate)throw Object.assign(new Error('Choose a valid first monthly renewal date.'),{status:400});
 const today=cairoDateISO(instant);
 const gap=Math.round((Date.parse(candidate+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 if(gap<minimumDays)
  throw Object.assign(new Error(`The first renewal must be at least ${minimumDays} day(s) after checkout for this collection method. Select a later date or use manual monthly payments.`),{status:409,code:'RENEWAL_DATE_TOO_SOON'});
 return candidate;
}
export function nextBillingDate(value,cycleMonths,anchorDay=0){
 const start=dateOnly(value);
 if(!start)throw new Error('Invalid current renewal date');
 if(anchorDay>0)return addMonthsOnDay(start,cycleMonths,anchorDay);
 const d=new Date(`${start}T00:00:00.000Z`);
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+cycleMonths);
 const originalDay=Number(start.slice(8,10));
 const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(originalDay,end));
 return d.toISOString().slice(0,10);
}
export function dateAtBillingTime(value){
 const iso=dateOnly(value);
 if(!iso)throw new Error('Invalid renewal date');
 return new Date(`${iso}T08:00:00.000Z`);
}
