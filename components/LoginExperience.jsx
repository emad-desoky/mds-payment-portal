'use client';

import { useState } from 'react';
import LoginPanel from './LoginPanel.jsx';

const messages = {
  client: {
    eyebrow: 'YOUR PARTNERSHIP, IN VIEW',
    title: <>Every detail.<br /><span>One secure place.</span></>,
    description: 'Access your billing history, payment records and approved engagement details with Medical Digital Solutions.',
    image: '/brand/client-access.avif',
    label: 'Secure client billing workspace',
    bullets: ['Review approved invoices', 'See your payment history', 'Stay informed about commitments'],
    cardLabel: 'MDS CLIENT BILLING',
    cardTitle: 'Billing that feels effortless.',
    cardDescription: 'Your financial relationship, clearly organized and always within reach.'
  },
  admin: {
    eyebrow: 'THE MDS FINANCE WORKSPACE',
    title: <>Greater visibility.<br /><span>Confident control.</span></>,
    description: 'Manage approved offers, payment records and financial operations with a dedicated MDS Finance experience.',
    image: '/brand/finance-access.avif',
    label: 'MDS Finance operations team reviewing billing',
    bullets: ['Manage approved offers', 'Track payment activity', 'Review finance approvals'],
    cardLabel: 'MDS FINANCE',
    cardTitle: 'Clarity for every decision.',
    cardDescription: 'Bring collections, reconciliation and client records together.'
  }
};

export default function LoginExperience() {
  const [tab, setTab] = useState('client');
  const active = messages[tab];

  return (
    <section className={`auth-layout auth-layout-polished mode-${tab}`}>
      <div className="auth-story">
        <div className="auth-story-top">
          <div className="eyebrow"><span className="story-mark" /> {active.eyebrow}</div>
          <h1>{active.title}</h1>
          <p>{active.description}</p>
          <ul className="auth-story-list">
            {active.bullets.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div className="auth-picture-wrap" key={active.image}>
          <div className="auth-picture-content">
            <span className="auth-visual-symbol" aria-hidden="true">✦</span>
            <small>{active.cardLabel}</small>
            <strong>{active.cardTitle}</strong>
            <p>{active.cardDescription}</p>
          </div>
          <div className="auth-picture-visual">
            <img src={active.image} alt={active.label} className="auth-picture" loading="eager" />
          </div>
        </div>

        <div className="auth-story-bottom">
          <span>MEDICAL DIGITAL SOLUTIONS</span>
          <span>PRIVATE BILLING ACCESS <b aria-hidden="true">✦</b></span>
        </div>
      </div>
      <LoginPanel tab={tab} onTabChange={setTab} />
    </section>
  );
}
