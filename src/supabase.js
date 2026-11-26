// Browser-side Supabase client helpers. Never expose a service_role key here.
const URL_BASE = 'https://efriaruhhhinmvplqcwu.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_kA3enowJ55fo_o1tsv2IXA_u24lj4WK';
const KEY = 'coinbound-session';
const listeners = new Set();
const emit = (session) => listeners.forEach((listener) => listener(session));
const save = (session) => {
  try { session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY); } catch {}
  emit(session);
};
export const getSession = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
export const onAuthChange = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
async function call(path, init = {}, token) {
  const session = getSession();
  const response = await fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token || session?.access_token || PUBLISHABLE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(data?.msg || data?.error_description || data?.message || `Erreur ${response.status}`);
  return data;
}
const redirect = () => window.location.origin + window.location.pathname;
export async function signUp(email, password, username) {
  const data = await call(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect())}`, { method: 'POST', body: JSON.stringify({ email, password, data: { username } }) });
  if (data?.access_token) save(data);
  return data;
}
export async function signIn(email, password) {
  const data = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }); save(data); return data;
}
export async function magicLink(email) { await call(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirect())}`, { method: 'POST', body: JSON.stringify({ email, create_user: true }) }); }
export async function resetPassword(email) { await call(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect())}`, { method: 'POST', body: JSON.stringify({ email }) }); }
export function oauth(provider) { window.location.href = `${URL_BASE}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect())}`; }
export async function signInAnonymously() { const data = await call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ data: { guest: true } }) }); save(data); return data; }
export async function signOut() { const session = getSession(); try { if (session) await call('/auth/v1/logout', { method: 'POST' }, session.access_token); } catch {} save(null); }
export async function consumeRedirectSession() {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!hash.includes('access_token')) return;
  const params = new URLSearchParams(hash), access_token = params.get('access_token'), refresh_token = params.get('refresh_token') || '';
  if (access_token) { try { const user = await call('/auth/v1/user', {}, access_token); save({ access_token, refresh_token, user }); } catch {} }
  history.replaceState(null, '', location.pathname + location.search);
}
export async function refreshIfNeeded() {
  const session = getSession();
  if (!session?.refresh_token || (session.expires_at && session.expires_at * 1000 - Date.now() > 60000)) return;
  try { save(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) })); } catch { save(null); }
}
export async function rest(table, query, init = {}) { return call(`/rest/v1/${table}?${query}`, init); }
export async function rpc(name, args = {}) { return call(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) }); }
export async function fetchProfile() {
  const session = getSession(); if (!session) throw new Error('Connexion requise');
  const rows = await rest('profiles', `id=eq.${session.user.id}&select=id,username,role,cash,created_at`);
  if (!rows[0]) throw new Error('Profil introuvable. Vérifie les migrations Supabase.'); return rows[0];
}
export const subscribeTo = (tables, refresh) => {
  const session = getSession(); if (!session) return () => {};
  const socket = new WebSocket(`wss://efriaruhhhinmvplqcwu.supabase.co/realtime/v1/websocket?apikey=${PUBLISHABLE_KEY}&vsn=1.0.0`);
  let ref = 0, heartbeat;
  socket.onopen = () => {
    socket.send(JSON.stringify({ topic: `realtime:coinbound:${session.user.id}`, event: 'phx_join', payload: { config: { broadcast: { ack: false, self: false }, presence: { key: session.user.id }, postgres_changes: tables.map((table) => ({ event: '*', schema: 'public', table })) }, access_token: session.access_token }, ref: String(++ref) }));
    heartbeat = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) })); }, 25000);
  };
  socket.onmessage = (event) => { try { const data = JSON.parse(event.data); if (data.event === 'postgres_changes' || data.payload?.data?.type) refresh(); } catch {} };
  return () => { if (heartbeat) clearInterval(heartbeat); if (socket.readyState === WebSocket.OPEN) socket.close(); };
};
