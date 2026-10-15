import Link from 'next/link';
import Brand from '../../components/Brand.jsx';
import SupportForm from '../../components/SupportForm.jsx';

const features = [
  {
    number: '01',
    icon: '▣',
    label: 'INVOICE PAYMENTS',
    title: 'Pay approved invoices securely.',
    description: 'Complete deposits, milestones and approved invoices using a private MDS payment link with secure Kashier checkout.',
    href: '/payments#support',
    cta: 'Request a payment link',
  },
  {
    number: '02',
    icon: '◷',
    label: 'CLIENT BILLING CENTER',
    title: 'Track your billing with clarity.',
    description: 'Review billing arrangements, payment history and upcoming charges in one secure client experience.',
    href: '/login',
    cta: 'Open billing center',
  },
  {
    number: '03',
    icon: '✦',
    label: 'MDS FINANCE SUPPORT',
    title: 'Get help from the MDS team.',
    description: 'Reach the billing team for receipts, invoicing questions, payment confirmations and billing support.',
    href: '/payments#support',
    cta: 'Contact billing',
  },
];

const highlights = [
  { value: 'Private', label: 'client billing access' },
  { value: 'Secure', label: 'Kashier payment processing' },
  { value: 'Clear', label: 'records and approved terms' },
];

export default function Payments() {
  return (
    <main className="public-shell">
      <header className="topbar site-topbar">
        <Brand />
        <nav aria-label="Primary navigation">
          <a className="nav-help" href="#support">Billing support</a>
          <Link className="nav-button" href="/login">Client sign in <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <section className="hero hero-split" aria-labelledby="hero-title">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-eyebrow"><span className="hero-status-dot" /> MEDICAL DIGITAL SOLUTIONS <span className="hero-dot-divider">/</span> PAYMENTS &amp; BILLING</div>
            <h1 id="hero-title">Clear payments.<br/><span>Confident partnerships.</span></h1>
            <p className="hero-lead">A secure MDS billing portal for approved invoices, client payment history, and reliable financial coordination between your team and ours.</p>
            <div className="hero-actions">
              <Link className="button primary" href="/login">Open billing center <span aria-hidden="true">↗</span></Link>
              <a className="button quiet" href="#support">Request payment assistance <span aria-hidden="true">↗</span></a>
            </div>
            <div className="hero-trust" aria-label="Billing benefits">
              <span><b aria-hidden="true">✓</b> Private client billing</span>
              <span><b aria-hidden="true">✓</b> Secure Kashier checkout</span>
              <span><b aria-hidden="true">✓</b> Transparent payment records</span>
            </div>
          </div>

          <div className="hero-art-panel" aria-hidden="true">
            <img src="/brand/hero-payments.avif" alt="" className="hero-art-image" />
            <div className="hero-floating-card card-a">
              <strong>Secure billing</strong>
              <span>Encrypted payment experience</span>
            </div>
            <div className="hero-floating-card card-b">
              <strong>Client visibility</strong>
              <span>Invoices, status, and payment history</span>
            </div>
          </div>
        </div>
        <div className="container hero-stats">
          {highlights.map((item) => (
            <div className="hero-stat" key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="container features-section" aria-labelledby="features-heading">
        <div className="section-header">
          <div>
            <p className="eyebrow">YOUR BILLING EXPERIENCE</p>
            <h2 id="features-heading">Everything in one professional flow.</h2>
          </div>
          <p>Built to make MDS billing simpler for both clients and internal finance operations.</p>
        </div>
        <div className="tiles">
          {features.map((feature) => (
            <article className="service-tile" key={feature.number}>
              <div className="feature-top"><span className="feature-icon" aria-hidden="true">{feature.icon}</span><span className="tile-no">{feature.number} / 03</span></div>
              <div className="feature-label">{feature.label}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <Link className="text-link" href={feature.href}>{feature.cta}<span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="journey-section" aria-labelledby="journey-heading">
        <div className="container journey-inner">
          <div className="journey-intro">
            <span className="eyebrow">HOW IT WORKS</span>
            <h2 id="journey-heading">From approval to payment.<br/><em>Organized and secure.</em></h2>
          </div>
          <div className="journey-steps">
            <div className="journey-step"><span>01</span><div><h3>Receive your private billing link</h3><p>Your approved engagement and billing details are shared directly by the MDS team.</p></div></div>
            <div className="journey-step"><span>02</span><div><h3>Review the payment summary</h3><p>Confirm the amount, billing cadence and approved commercial arrangement before paying.</p></div></div>
            <div className="journey-step"><span>03</span><div><h3>Pay and stay informed</h3><p>Complete payment securely and access your billing history anytime from the client portal.</p></div></div>
          </div>
        </div>
      </section>

      <section id="support" className="support-section" aria-labelledby="support-heading">
        <div className="container support-grid">
          <div className="support-copy">
            <div className="eyebrow">PERSONAL BILLING SUPPORT</div>
            <h2 id="support-heading">Need help with a payment,<br/><span>invoice or billing detail?</span></h2>
            <p>Send your request directly to the MDS billing team and we’ll follow up regarding invoices, payment confirmations, tax documents, subscriptions or secure payment links.</p>
            <div className="support-assurance">
              <span aria-hidden="true">✦</span>
              <div>
                <strong>Dedicated billing assistance</strong>
                <small>A focused support channel for approved client financial requests.</small>
              </div>
            </div>
          </div>
          <SupportForm />
        </div>
      </section>

      <footer className="footer container">
        <Brand />
        <span>© {new Date().getFullYear()} Medical Digital Solutions. All rights reserved.</span>
        <span>Secure checkout powered by Kashier.</span>
      </footer>
    </main>
  );
}
