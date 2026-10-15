import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { postgresOptions } from '../lib/pg-connect.js';

test('Supabase TLS uses trusted CA and verifies hostname', () => {
  const options = postgresOptions('postgresql://postgres.project:p%40ss@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require');
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.servername, 'aws-0-eu-west-2.pooler.supabase.com');
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
  const cert = new X509Certificate(options.ssl.ca);
  assert.match(cert.subject, /Supabase Root 2021 CA/);
  assert.equal(cert.validTo.includes('2031'), true);
});

test('database URL is mandatory', () => {
  assert.throws(() => postgresOptions(''), /not configured/);
  assert.throws(() => postgresOptions('https://example.com'), /Invalid PostgreSQL/);
});
