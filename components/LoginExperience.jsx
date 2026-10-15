'use client';
import { useState } from 'react';
import LoginPanel from './LoginPanel.jsx';

const messages = {
  client: {
    eyebrow: 'YOUR PARTNERSHIP, IN VIEW',
    title: <>Every detail.<br/><span>One secure place.</span></>,
    description: 'Access your billing history, payment records, and approved engagement details with Medical Digital Solutions.',
    image: '/brand/client-access.avif',
    label: 'Client billing experience',
    bullets: ['View approved billing records', 'Track invoices and transactions', 'Stay aligned with upcoming commitments'],
  },
  admin: {
    eyebrow: 'FOR MDS FINANCE',
    title: <>Better oversight.<br/><span>Smarter billing control.</span></>,
    description: 'A dedicated Finance workspace to manage approved offers, monitor collections and oversee billing operations.',
    image: '/brand/finance-access.avif',
    label: 'MDS Finance operations',
    bullets: ['Manage approved commercial records', 'Review transactions and reconciliations', 'Operate from one internal billing console'],
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
            {active.bullets.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="auth-picture-wrap" key={active.image}>
          <img src={active.image} alt={active.label} className="auth-picture" />
          <div className="auth-picture-shade" aria-hidden="true" />
        </div>
        <div className="auth-story-bottom"><span>MEDICAL DIGITAL SOLUTIONS</span><span>SECURE BILLING PORTAL <b aria-hidden="true">✦</b></span></div>
      </div>
      <LoginPanel tab={tab} onTabChange={setTab} />
    </section>
  );
}
