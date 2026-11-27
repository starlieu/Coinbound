import { useEffect, useState } from 'react';
import Login from './Login.jsx';
import { consumeRedirectSession, getSession, onAuthChange, refreshIfNeeded, signOut } from './supabase.js';
export default function AuthGate({ children }) {
  const [session, setSession] = useState(getSession), [ready, setReady] = useState(false);
  useEffect(() => {
    const off = onAuthChange(setSession);
    (async () => { await consumeRedirectSession(); await refreshIfNeeded(); setSession(getSession()); setReady(true); })();
    const timer = setInterval(refreshIfNeeded, 5 * 60_000);
    return () => { off(); clearInterval(timer); };
  }, []);
  if (!ready) return <main className="auth-wrap"><p className="auth-note">Chargement de Coinbound…</p></main>;
  if (!session) return <Login />;
  return <><div className="auth-bar"><span>{session.user.email || 'Connecté'}</span><button onClick={signOut}>Déconnexion</button></div>{children}</>;
}
