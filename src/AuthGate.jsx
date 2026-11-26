import { useEffect, useState } from 'react';
import Login from './Login.jsx';
import { consumeRedirectSession, getSession, onAuthChange, refreshIfNeeded, signOut } from './supabase.js';
const GUEST_KEY = 'coinbound-guest';
export default function AuthGate({ children }) {
  const [session, setSession] = useState(getSession), [guest, setGuest] = useState(() => localStorage.getItem(GUEST_KEY) === '1'), [ready, setReady] = useState(false);
  useEffect(() => {
    const off = onAuthChange(setSession);
    (async () => { await consumeRedirectSession(); await refreshIfNeeded(); setSession(getSession()); setReady(true); })();
    const timer = setInterval(refreshIfNeeded, 5 * 60_000);
    return () => { off(); clearInterval(timer); };
  }, []);
  if (!ready) return <main className="auth-wrap"><p className="auth-note">Chargement de Coinbound…</p></main>;
  if (!session && !guest) return <Login onGuest={() => { localStorage.setItem(GUEST_KEY, '1'); setGuest(true); }} />;
  return <><div className="auth-bar"><span>{session ? session.user.email || 'Connecté' : 'Invité'}</span><button onClick={async () => { localStorage.removeItem(GUEST_KEY); setGuest(false); await signOut(); }}>Déconnexion</button></div>{children}</>;
}
