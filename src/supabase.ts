// Supabase public client helpers. Never place service_role/secret keys in browser code.
const URL_BASE='https://efriaruhhhinmvplqcwu.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_kA3enowJ55fo_o1tsv2IXA_u24lj4WK';
export type AuthUser={id:string;email?:string;user_metadata?:Record<string,unknown>};
export type Session={access_token:string;refresh_token:string;expires_at?:number;user:AuthUser};
const KEY='coinbound-session';const listeners=new Set<(s:Session|null)=>void>();
function emit(s:Session|null){listeners.forEach(f=>f(s))}function save(s:Session|null){try{s?localStorage.setItem(KEY,JSON.stringify(s)):localStorage.removeItem(KEY)}catch{}emit(s)}
export function getSession():Session|null{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
export function onAuthChange(f:(s:Session|null)=>void){listeners.add(f);return()=>{listeners.delete(f)}}
async function call(path:string,init:RequestInit={},token?:string){const s=getSession();const res=await fetch(`${URL_BASE}${path}`,{...init,headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${token||s?.access_token||PUBLISHABLE_KEY}`,'Content-Type':'application/json',...(init.headers||{})}});const text=await res.text();let data:any=null;try{data=text?JSON.parse(text):null}catch{data={message:text}}if(!res.ok)throw new Error(data?.msg||data?.error_description||data?.message||`Erreur ${res.status}`);return data}
const redirect=()=>window.location.origin+window.location.pathname;
export async function signUp(email:string,password:string,username:string){const d=await call(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect())}`,{method:'POST',body:JSON.stringify({email,password,data:{username}})});if(d?.access_token)save(d as Session);return d}
export async function signIn(email:string,password:string){const d=await call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});save(d as Session);return d as Session}
export async function magicLink(email:string){await call(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirect())}`,{method:'POST',body:JSON.stringify({email,create_user:true})})}
export async function resetPassword(email:string){await call(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect())}`,{method:'POST',body:JSON.stringify({email})})}
export function oauth(provider:'google'|'github'|'discord'|'apple'){window.location.href=`${URL_BASE}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect())}`}
export async function signInAnonymously(){const d=await call('/auth/v1/signup',{method:'POST',body:JSON.stringify({data:{guest:true}})});save(d as Session);return d as Session}
export async function signOut(){const s=getSession();try{if(s)await call('/auth/v1/logout',{method:'POST'},s.access_token)}catch{}save(null)}
export async function consumeRedirectSession(){const h=location.hash.startsWith('#')?location.hash.slice(1):'';if(!h.includes('access_token'))return;const p=new URLSearchParams(h),access_token=p.get('access_token'),refresh_token=p.get('refresh_token')||'';if(!access_token)return;try{const user=await call('/auth/v1/user',{},access_token);save({access_token,refresh_token,user})}catch{}history.replaceState(null,'',location.pathname+location.search)}
export async function refreshIfNeeded(){const s=getSession();if(!s?.refresh_token||s.expires_at&&s.expires_at*1000-Date.now()>60000)return;try{const d=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})});save(d as Session)}catch{save(null)}}
export type Role='Owner'|'Developer'|'Admin'|'Moderator'|'Player';
export type Profile={id:string;username:string;role:Role;cash:number;created_at:string};
export type Coin={ticker:string;name:string;price:number;icon:string;rarity:string;change:number};
export type Holding={user_id:string;ticker:string;amount:number};
export type Team={id:number;owner_id:string;name:string;created_at:string};
export type Listing={id:number;seller_id:string;title:string;price:number;created_at:string};
export type Badge={id:number;name:string;icon:string;color:string;role:Role};
export async function rest<T>(table:string,query:string,init:RequestInit={}){return call(`/rest/v1/${table}?${query}`,init) as Promise<T>}
export async function rpc<T>(name:string,args:Record<string,unknown>={}){return call(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(args)}) as Promise<T>}
export async function fetchProfile():Promise<Profile>{const s=getSession();if(!s)throw Error('Connexion requise');const rows=await rest<Profile[]>('profiles',`id=eq.${s.user.id}&select=id,username,role,cash,created_at`);if(!rows[0])throw Error('Profil introuvable. Vérifie les migrations Supabase.');return rows[0]}
export const subscribeTo=(tables:string[],refresh:()=>void)=>{const s=getSession();if(!s)return()=>{};const ws=new WebSocket(`wss://efriaruhhhinmvplqcwu.supabase.co/realtime/v1/websocket?apikey=${PUBLISHABLE_KEY}&vsn=1.0.0`);let ref=0,heartbeat:ReturnType<typeof setInterval>|undefined;ws.onopen=()=>{ws.send(JSON.stringify({topic:`realtime:coinbound:${s.user.id}`,event:'phx_join',payload:{config:{broadcast:{ack:false,self:false},presence:{key:s.user.id},postgres_changes:tables.map(table=>({event:'*',schema:'public',table}))},access_token:s.access_token},ref:String(++ref)}));heartbeat=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(++ref)}))},25000)};ws.onmessage=e=>{try{const x=JSON.parse(e.data);if(x.event==='postgres_changes'||x.payload?.data?.type)refresh()}catch{}};return()=>{if(heartbeat)clearInterval(heartbeat);if(ws.readyState===WebSocket.OPEN)ws.close()}}
