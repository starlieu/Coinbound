import { useState } from 'react';
import { magicLink, oauth, resetPassword, signIn, signInAnonymously, signUp } from './supabase.js';
const titles = { signin: 'Bienvenue', signup: 'Créer un compte', magic: 'Connexion par lien', reset: 'Réinitialiser le mot de passe' };
export default function Login() {
  const [mode, setMode] = useState('signin'), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [username, setUsername] = useState(''), [info, setInfo] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else if (mode === 'signup') { if (username.trim().length < 3) throw new Error('Le pseudo doit contenir au moins 3 caractères.'); if (password.length < 8) throw new Error('Choisis un mot de passe d’au moins 8 caractères.'); const data = await signUp(email, password, username.trim()); if (!data?.access_token) setInfo('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse.'); }
      else if (mode === 'magic') { await magicLink(email); setInfo('Lien de connexion envoyé par email.'); }
      else { await resetPassword(email); setInfo('Email de réinitialisation envoyé.'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Une erreur est survenue.'); } finally { setBusy(false); }
  }
  async function guest() { setError(''); setBusy(true); try { await signInAnonymously(); } catch (err) { setError(err instanceof Error ? err.message : 'La connexion invité a échoué.'); } finally { setBusy(false); } }
  return <main className="auth-wrap"><section className="auth-card"><a className="brand" href="#">◈ coinbound<span className="green-period">.</span></a><div className="auth-intro"><span className="eyebrow">UN MARCHÉ. UNE COMMUNAUTÉ.</span><h1>{titles[mode]}<span className="green-period">.</span></h1><p>Un jeu de trading virtuel, simple et gratuit.</p></div><form onSubmit={submit} className="auth-form">
    {mode === 'signup' && <label>Pseudo<input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} autoComplete="nickname" /></label>}
    <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
    {(mode === 'signin' || mode === 'signup') && <label>Mot de passe<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>}
    {error && <p className="auth-error" role="alert">{error}</p>}{info && <p className="auth-info" role="status">{info}</p>}
    <button className="feature-submit" disabled={busy}>{busy ? 'Chargement…' : titles[mode]}</button>
  </form><div className="auth-links">{mode !== 'signin' && <button onClick={() => setMode('signin')}>Connexion</button>}{mode !== 'signup' && <button onClick={() => setMode('signup')}>Créer un compte</button>}{mode !== 'magic' && <button onClick={() => setMode('magic')}>Lien magique</button>}{mode !== 'reset' && <button onClick={() => setMode('reset')}>Mot de passe oublié</button>}</div><div className="auth-sep"><span>ou continuer avec</span></div><div className="auth-oauth"><button type="button" onClick={() => oauth('google')}>Google</button><button type="button" onClick={() => oauth('github')}>GitHub</button><button type="button" onClick={() => oauth('discord')}>Discord</button><button type="button" onClick={() => oauth('apple')}>Apple</button></div><button type="button" className="auth-guest" onClick={guest} disabled={busy}>Explorer en invité</button><p className="auth-note">Gratuit · CB virtuels sans valeur réelle</p></section></main>;
}
