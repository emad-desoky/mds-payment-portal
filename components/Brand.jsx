import Link from 'next/link';

/** The supplied Medical Digital Solutions identity, not a recreated mark. */
export default function Brand({ light = false }) {
  return (
    <Link className={`brand brand-official ${light ? 'brand-light' : ''}`} href="/payments" aria-label="Medical Digital Solutions — Payments and Billing">
      <img src="/brand/mds-logo.avif" width="204" height="85" alt="Medical Digital Solutions" decoding="async" />
    </Link>
  );
}
