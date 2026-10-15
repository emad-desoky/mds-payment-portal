import { readFileSync } from 'node:fs';

const SUPABASE_CA = readFileSync(new URL('../certs/supabase-prod-ca-2021.crt', import.meta.url), 'utf8');

/** Keep database transport encrypted AND verify the Supabase TLS certificate and hostname. */
export function postgresOptions(connectionString) {
  if (!connectionString) throw new Error('Database connection is not configured');
  const url = new URL(connectionString);
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('Invalid PostgreSQL connection protocol');
  }
  // pg-connection-string interprets sslmode=require as verify-full and replaces
  // the explicit Node TLS options. Remove URL SSL settings in favor of the CA below.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) {
    url.searchParams.delete(key);
  }
  const ca = process.env.SUPABASE_DB_CA_CERT?.replace(/\\n/g, '\n') || SUPABASE_CA;
  return {
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true, servername: url.hostname },
    connectionTimeoutMillis: 15000,
  };
}
