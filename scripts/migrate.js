import pg from 'pg';
import { postgresOptions } from '../lib/pg-connect.js';
import crypto from 'node:crypto';
const conn=process.env.DATABASE_MIGRATE_URL||process.env.DATABASE_URL;
if(!conn){console.error('Missing database configuration');process.exit(1)}
const pool=new pg.Pool({...postgresOptions(conn),max:1});
const schema=`
create table if not exists client_accounts (
 id uuid primary key default gen_random_uuid(), legal_name text not null, billing_email text not null, phone text, billing_address text, tax_id text,
 locale text not null default 'en', status text not null default 'ACTIVE', created_at timestamptz not null default now()
);
create table if not exists portal_users (
 id uuid primary key default gen_random_uuid(), username text not null unique, email text, password_hash text not null,
 role text not null default 'client_owner', client_id uuid references client_accounts(id), password_reset_required boolean not null default false,
 session_version integer not null default 1, active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists portal_settings (
 key text primary key, value jsonb not null default '{}'::jsonb, status text not null default 'NEEDS_APPROVAL',
 updated_by uuid references portal_users(id), updated_at timestamptz not null default now()
);
create table if not exists offers (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references client_accounts(id), title text not null,
 commercial_reference text not null, transaction_family text not null default 'ONE_TIME', currency text not null check(currency in('EGP','USD')),
 professional_fee numeric(14,2) not null default 0 check(professional_fee>=0), setup_fee numeric(14,2) not null default 0 check(setup_fee>=0),
 pass_through_fee numeric(14,2) not null default 0 check(pass_through_fee>=0), benefit_kind text not null default 'NO_BENEFIT',
 benefit_value numeric(14,2) not null default 0, tax_rate numeric(6,4), tax_approved boolean not null default false,
 allowed_terms jsonb not null default '["MONTHLY_FLEX"]'::jsonb, cadence_matrix jsonb not null default '{"MONTHLY_FLEX":["MONTHLY"]}'::jsonb,
 auto_renew boolean not null default false, start_date date, end_date date, approval_reference text not null,
 approved_by text not null, approved_at timestamptz, status text not null default 'DRAFT',
 link_hash text unique, link_expires_at timestamptz, version integer not null default 1, created_at timestamptz not null default now()
);
create table if not exists payment_requests (
 id uuid primary key default gen_random_uuid(), offer_id uuid not null references offers(id), client_id uuid not null references client_accounts(id),
 public_reference text not null unique, merchant_order_id text not null unique, idempotency_key text unique,
 term_code text not null, cadence_code text not null, calculation jsonb not null default '{}'::jsonb,
 amount numeric(14,2) not null check(amount>=0), currency text not null, status text not null default 'PROCESSING',
 mode text not null default 'test', session_id text, gateway_url text, gateway_order_id text, paid_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists subscriptions (
 id uuid primary key default gen_random_uuid(), offer_id uuid not null references offers(id), client_id uuid not null references client_accounts(id),
 initial_request_id uuid unique references payment_requests(id), term_code text not null, cadence_code text not null,
 recurring_amount numeric(14,2) not null, currency text not null, cycles_remaining int not null default 0,
 next_charge_at timestamptz, term_end timestamptz, auto_renew boolean not null default false,
 status text not null default 'ACTIVE', token_encrypted text, agreement_id text, gateway_customer_ref text,
 masked_method text, last_payment_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists gateway_transactions (
 id uuid primary key default gen_random_uuid(), request_id uuid references payment_requests(id), subscription_id uuid references subscriptions(id),
 gateway_transaction_id text, gateway_order_id text, event_type text not null, gateway_status text not null,
 currency text, amount numeric(14,2), gateway_method text, recorded_at timestamptz not null default now()
);
create table if not exists webhook_events (
 id uuid primary key default gen_random_uuid(), event_key text not null unique, mode text not null, event_name text not null, transaction_id text,
 gateway_status text, verified boolean not null, process_status text not null, details jsonb not null default '{}'::jsonb,
 received_at timestamptz not null default now()
);
create table if not exists invoices (
 id uuid primary key default gen_random_uuid(), invoice_number text not null unique, client_id uuid not null references client_accounts(id),
 request_id uuid unique references payment_requests(id), title text not null, currency text not null, amount numeric(14,2) not null,
 tax_amount numeric(14,2), tax_status text not null default 'AWAITING_FINANCE', status text not null default 'PAID',
 issued_at timestamptz not null default now(), paid_at timestamptz, eta_reference text
);
create table if not exists refunds (
 id uuid primary key default gen_random_uuid(), transaction_id uuid not null references gateway_transactions(id),
 amount numeric(14,2) not null check(amount>0), currency text not null, reason text not null,
 status text not null default 'PENDING', idempotency_key text not null unique, gateway_reference text,
 created_by uuid references portal_users(id), created_at timestamptz not null default now()
);
create table if not exists notification_events (
 id uuid primary key default gen_random_uuid(), event_key text not null unique, template_key text not null,
 recipient text not null, locale text not null default 'en', status text not null default 'QUEUED',
 provider_reference text, last_error text, created_at timestamptz not null default now(), sent_at timestamptz
);
create table if not exists audit_events (
 id bigserial primary key, actor_id uuid references portal_users(id), action text not null,
 entity_type text not null, entity_id text, details jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now()
);
create table if not exists reconciliation_exceptions (
 id uuid primary key default gen_random_uuid(), event_key text, request_id uuid references payment_requests(id),
 category text not null, detail text not null, status text not null default 'OPEN', created_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists support_tickets (
 id uuid primary key default gen_random_uuid(), client_id uuid references client_accounts(id), name text,
 email text not null, category text not null, message text not null, status text not null default 'OPEN', created_at timestamptz not null default now()
);
create table if not exists access_codes (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references client_accounts(id),
 email text not null, code_hash text not null, attempts int not null default 0, expires_at timestamptz not null, used_at timestamptz
);
create table if not exists auth_attempts (
 id bigserial primary key, source_hash text not null, occurred_at timestamptz not null default now()
);
create index if not exists idx_auth_attempts_key on auth_attempts(source_hash,occurred_at);
create index if not exists idx_offers_client on offers(client_id,created_at desc);
create index if not exists idx_requests_client on payment_requests(client_id,created_at desc);
create index if not exists idx_renewals_due on subscriptions(next_charge_at,status);
create index if not exists idx_gateway_tx on gateway_transactions(gateway_transaction_id);
create index if not exists idx_webhook_received on webhook_events(received_at desc);
create index if not exists idx_invoices_client on invoices(client_id,issued_at desc);
create index if not exists idx_audit_occurred on audit_events(occurred_at desc);
create index if not exists idx_support_client on support_tickets(client_id,created_at desc);
`;
const tables=['client_accounts','portal_users','portal_settings','offers','payment_requests','subscriptions','gateway_transactions','webhook_events','invoices','refunds','notification_events','audit_events','reconciliation_exceptions','support_tickets','access_codes','auth_attempts'];
const decisions=[
 ['seller_legal_name','Medical Digital Solutions','APPROVED'],['legal_registration','','NEEDS_APPROVAL'],['registered_address','','NEEDS_APPROVAL'],
 ['seller_tax_id','','NEEDS_APPROVAL'],['tax_treatment','','NEEDS_APPROVAL'],['eta_route','','NEEDS_APPROVAL'],
 ['commitment_benefits','','NEEDS_APPROVAL'],['cadence_policy','','NEEDS_APPROVAL'],['contract_policy','','NEEDS_APPROVAL'],
 ['refund_policy','','NEEDS_APPROVAL'],['retry_policy','','NEEDS_APPROVAL'],['renewal_policy','','NEEDS_APPROVAL'],
 ['support_contact','billing@mds-healthcare.com','NEEDS_APPROVAL'],['data_retention','','NEEDS_APPROVAL'],
 ['finance_contact','','NEEDS_APPROVAL'],['client_payment_methods','','NEEDS_APPROVAL'],['admin_contact','','NEEDS_APPROVAL'],
 ['live_billing_approval','','NEEDS_APPROVAL']
];
try{
 const client=await pool.connect();
 try{
  await client.query('begin');
  await client.query(schema);
  for(const table of tables){await client.query(`alter table public.${table} enable row level security`);await client.query(`revoke all on table public.${table} from anon, authenticated`)}
  for(const [key,value,status] of decisions) await client.query('insert into portal_settings(key,value,status) values($1,$2::jsonb,$3) on conflict(key) do nothing',[key,JSON.stringify(value),status]);
  const admin=process.env.ADMIN_INITIAL_PASSWORD;
  const username=process.env.ADMIN_USERNAME||'mds2026';
  if(admin){const salt=crypto.randomBytes(16).toString('hex');const hash=crypto.scryptSync(admin,salt,64).toString('hex');
   await client.query(`insert into portal_users(username,password_hash,role,password_reset_required) values($1,$2,'finance_admin',true) on conflict(username) do nothing`,[username,`scrypt:${salt}:${hash}`]);}
  await client.query('commit');
  console.log('MDS billing schema ready');
 }catch(e){await client.query('rollback');throw e}finally{client.release()}
}catch(e){console.error('MDS schema initialization failed:',e.message);process.exitCode=1}finally{await pool.end()}
