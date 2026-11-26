import { useEffect, useState, type ReactNode } from 'react';
import Login from './Login';
import { consumeRedirectSession, getSession, onAuthChange, refreshIfNeeded, signOut, type Session } from './supabase';

const GUEST_KEY = 'coinbound-guest';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(getSession());
  const [guest, setGuest] = useState(() => localStorage.getItem(GUEST_KEY) === '1');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const off = onAuthChange(setSession);
    (async () => { await consumeRedirectSession(); await refreshIfNeeded(); setSession(getSession()); setReady(true); })();
    const t = setInterval(refreshIfNeeded, 5 * 60_000);
    return () => { off(); clearInterval(t); };
  }, []);

  if (!ready) return <div className="auth-wrap"><p className="auth-note">Chargement…</p></div>;
  if (!session && !guest) return <Login onGuest={() => { localStorage.setItem(GUEST_KEY, '1'); setGuest(true); }} />;

  const label = session ? (session.user.email || 'Connecté') : 'Invité';
  return (
    <>
      <div className="auth-bar">
        <span>{label}</span>
        <button onClick={async () => { localStorage.removeItem(GUEST_KEY); setGuest(false); await signOut(); }}>Déconnexion</button>
      </div>
      {children}
    </>
  );
}
