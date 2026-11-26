import { useState, type FormEvent } from 'react';
import { magicLink, oauth, resetPassword, signIn, signInAnonymously, signUp } from './supabase';

type Mode = 'signin' | 'signup' | 'magic' | 'reset';

export default function Login({ onGuest }: { onGuest: () => void }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else if (mode === 'signup') {
        if (username.trim().length < 3) throw new Error('Pseudo : 3 caractères minimum.');
        if (password.length < 8) throw new Error('Mot de passe : 8 caractères minimum.');
        const d = await signUp(email, password, username.trim());
        if (!d?.access_token) setInfo('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse.');
      } else if (mode === 'magic') { await magicLink(email); setInfo('Lien de connexion envoyé par email.'); }
      else { await resetPassword(email); setInfo('Email de réinitialisation envoyé.'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur inconnue.'); }
    finally { setBusy(false); }
  }

  async function guest() {
    setError(''); setBusy(true);
    try { await signInAnonymously(); }
    catch { onGuest(); } // repli : mode invité local si les connexions anonymes sont désactivées
    finally { setBusy(false); }
  }

  const titles: Record<Mode, string> = { signin: 'Connexion', signup: 'Créer un compte', magic: 'Lien magique', reset: 'Mot de passe oublié' };

  return (
    <div className="auth-wrap">
      <section className="auth-card">
        <div className="brand">◈ coinbound<span className="green-period">.</span></div>
        <h1>{titles[mode]}</h1>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>Pseudo<input value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={20} /></label>}
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          {(mode === 'signin' || mode === 'signup') && <label>Mot de passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>}
          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}
          <button className="feature-submit" disabled={busy}>{busy ? '…' : titles[mode]}</button>
        </form>
        <div className="auth-links">
          {mode !== 'signin' && <button type="button" onClick={() => setMode('signin')}>Connexion</button>}
          {mode !== 'signup' && <button type="button" onClick={() => setMode('signup')}>Créer un compte</button>}
          {mode !== 'magic' && <button type="button" onClick={() => setMode('magic')}>Lien magique</button>}
          {mode !== 'reset' && <button type="button" onClick={() => setMode('reset')}>Mot de passe oublié</button>}
        </div>
        <div className="auth-sep"><span>ou</span></div>
        <div className="auth-oauth">
          <button type="button" onClick={() => oauth('google')}>Google</button>
          <button type="button" onClick={() => oauth('github')}>GitHub</button>
          <button type="button" onClick={() => oauth('discord')}>Discord</button>
          <button type="button" onClick={() => oauth('apple')}>Apple</button>
        </div>
        <button type="button" className="auth-guest" onClick={guest} disabled={busy}>Continuer en invité</button>
        <p className="auth-note">Jeu gratuit · aucune valeur réelle.</p>
      </section>
    </div>
  );
}
