import Link from 'next/link';
import Brand from '../../components/Brand.jsx';
import LoginExperience from '../../components/LoginExperience.jsx';

export default function LoginPage() {
  return (
    <main className="auth-page">
      <header className="topbar auth-top site-topbar">
        <Brand />
        <Link className="auth-return" href="/payments">← Back to payments</Link>
      </header>
      <LoginExperience />
    </main>
  );
}
