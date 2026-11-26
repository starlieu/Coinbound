// Client Supabase. L'URL et la clé publishable sont publiques par conception :
// la sécurité repose sur les règles RLS (voir supabase/schema.sql), pas sur le secret de cette clé.
// Ne mettez JAMAIS la clé service_role ou sb_secret_ dans ce fichier.
const URL_BASE = 'https://efriaruhhhinmvplqcwu.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_kA3enowJ55fo_o1tsv2IXA_u24lj4WK';

export type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };
export type Session = { access_token: string; refresh_token: string; expires_at?: number; user: AuthUser };

const KEY = 'coinbound-session';
const listeners = new Set<(s: Session | null) => void>();

function emit(s: Session | null) { listeners.forEach(f => f(s)); }
function save(s: Session | null) {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  emit(s);
}
export function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function onAuthChange(f: (s: Session | null) => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

async function call(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token || PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) throw new Error(data?.msg || data?.error_description || data?.message || `Erreur ${res.status}`);
  return data;
}

const redirect = () => window.location.origin + window.location.pathname;

export async function signUp(email: string, password: string, username: string) {
  const d = await call(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect())}`, {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { username } }),
  });
  if (d?.access_token) save(d as Session);
  return d;
}
export async function signIn(email: string, password: string) {
  const d = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  save(d as Session);
  return d as Session;
}
export async function magicLink(email: string) {
  await call(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirect())}`, {
    method: 'POST',
    body: JSON.stringify({ email, create_user: true }),
  });
}
export async function resetPassword(email: string) {
  await call(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect())}`, { method: 'POST', body: JSON.stringify({ email }) });
}
export function oauth(provider: 'google' | 'github' | 'discord' | 'apple') {
  window.location.href = `${URL_BASE}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect())}`;
}
export async function signInAnonymously() {
  const d = await call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ data: { guest: true } }) });
  save(d as Session);
  return d as Session;
}
export async function signOut() {
  const s = getSession();
  try { if (s) await call('/auth/v1/logout', { method: 'POST' }, s.access_token); } catch { /* ignore */ }
  save(null);
}

// Récupère la session renvoyée dans l'URL après un lien magique / OAuth (#access_token=...).
export async function consumeRedirectSession() {
  const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  if (!h.includes('access_token')) return;
  const p = new URLSearchParams(h);
  const access_token = p.get('access_token');
  const refresh_token = p.get('refresh_token') || '';
  if (!access_token) return;
  try {
    const user = await call('/auth/v1/user', {}, access_token);
    save({ access_token, refresh_token, user });
  } catch { /* ignore */ }
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

export async function refreshIfNeeded() {
  const s = getSession();
  if (!s?.refresh_token) return;
  if (s.expires_at && s.expires_at * 1000 - Date.now() > 60_000) return;
  try {
    const d = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) });
    save(d as Session);
  } catch { save(null); }
}

export type Profile = { id: string; username: string; role: 'Owner' | 'Developer' | 'Admin' | 'Moderator' | 'Player' };
export async function fetchProfile(s: Session): Promise<Profile | null> {
  try {
    const rows = await call(`/rest/v1/profiles?id=eq.${s.user.id}&select=id,username,role`, {}, s.access_token);
    return rows?.[0] || null;
  } catch { return null; }
}
