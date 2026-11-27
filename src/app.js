import {
  consumeRedirectSession, fetchProfile, getSession, magicLink, oauth, onAuthChange,
  refreshIfNeeded, rest, resetPassword, rpc, signIn, signInAnonymously, signOut,
  signUp, subscribeTo
} from './supabase.js';

const navItems = [
  { name: 'Accueil', icon: '⌂' },
  { name: 'Marché', icon: '↗' },
  { name: 'Portefeuille', icon: '◫' },
  { name: 'Équipes', icon: '♧' },
  { name: 'Marketplace', icon: '▤' },
  { name: 'Profil', icon: '◉' }
];
const authTitles = {
  signin: 'Bienvenue',
  signup: 'Créer un compte',
  magic: 'Connexion par lien',
  reset: 'Réinitialiser le mot de passe'
};
const emptyData = () => ({ profile: null, coins: [], holdings: [], teams: [], listings: [], badges: [], trades: [] });
const state = {
  root: null,
  session: getSession(),
  ready: false,
  initializing: true,
  loading: true,
  data: emptyData(),
  tab: 'Accueil',
  message: '',
  loadError: '',
  claiming: false,
  trade: null,
  tradeSide: 'buy',
  tradeAmount: '100',
  authMode: 'signin',
  authBusy: false,
  authError: '',
  authInfo: '',
  drafts: { email: '', password: '', username: '', coinName: '', ticker: '', price: '10', teamName: '', listingTitle: '', listingPrice: '100' }
};

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const fmt = (value, digits = 2) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(Number(value) || 0);
const roleClass = (role) => `role-${String(role || 'player').toLowerCase()}`;
const badge = (text, className = '') =>
  `<span class="role-badge ${escapeHTML(className)}">${escapeHTML(text)}</span>`;

function render() {
  if (!state.root) return;
  if (!state.ready) {
    state.root.innerHTML = '<main class="auth-wrap"><p class="auth-note">Chargement de Coinbound…</p></main>';
  } else if (!state.session) {
    renderLogin();
  } else if (state.loading && !state.data.profile) {
    state.root.innerHTML = '<main class="loading-screen"><span class="loading-mark">◈</span><p>On prépare ton marché…</p></main>';
  } else if (!state.data.profile) {
    renderProfileError();
  } else {
    renderApp();
  }
}

function renderLogin() {
  const mode = state.authMode;
  const needsPassword = mode === 'signin' || mode === 'signup';
  const usernameField = mode === 'signup'
    ? `<label>Pseudo<input name="username" value="${escapeHTML(state.drafts.username)}" required minlength="3" maxlength="20" autocomplete="nickname" data-draft="username"></label>`
    : '';
  const passwordField = needsPassword
    ? `<label>Mot de passe<input name="password" type="password" value="${escapeHTML(state.drafts.password)}" required autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" data-draft="password"></label>`
    : '';
  const modes = [
    ['signin', 'Connexion'],
    ['signup', 'Créer un compte'],
    ['magic', 'Lien magique'],
    ['reset', 'Mot de passe oublié']
  ];

  state.root.innerHTML = `
    <main class="auth-wrap">
      <section class="auth-card" aria-labelledby="auth-title">
        <a class="brand" href="./">◈ coinbound<span class="green-period">.</span></a>
        <div class="auth-intro">
          <span class="eyebrow">UN MARCHÉ. UNE COMMUNAUTÉ.</span>
          <h1 id="auth-title">${escapeHTML(authTitles[mode])}<span class="green-period">.</span></h1>
          <p>Un jeu de trading virtuel, simple et gratuit.</p>
        </div>
        <form class="auth-form" data-form="auth">
          ${usernameField}
          <label>Email<input name="email" type="email" value="${escapeHTML(state.drafts.email)}" required autocomplete="email" data-draft="email"></label>
          ${passwordField}
          ${state.authError ? `<p class="auth-error" role="alert">${escapeHTML(state.authError)}</p>` : ''}
          ${state.authInfo ? `<p class="auth-info" role="status">${escapeHTML(state.authInfo)}</p>` : ''}
          <button class="feature-submit" ${state.authBusy ? 'disabled' : ''}>${state.authBusy ? 'Chargement…' : escapeHTML(authTitles[mode])}</button>
        </form>
        <div class="auth-links">
          ${modes.filter(([name]) => name !== mode).map(([name, label]) => `<button type="button" data-action="auth-mode" data-mode="${name}">${label}</button>`).join('')}
        </div>
        <div class="auth-sep"><span>ou continuer avec</span></div>
        <div class="auth-oauth">
          ${['google', 'github', 'discord', 'apple'].map((provider) => `<button type="button" data-action="oauth" data-provider="${provider}">${provider[0].toUpperCase()}${provider.slice(1)}</button>`).join('')}
        </div>
        <button type="button" class="auth-guest" data-action="guest" ${state.authBusy ? 'disabled' : ''}>Explorer en invité</button>
        <p class="auth-note">Gratuit · CB virtuels sans valeur réelle</p>
      </section>
    </main>`;
}

function renderProfileError() {
  state.root.innerHTML = `
    <main class="auth-wrap">
      <section class="auth-card">
        <span class="loading-mark">◈</span>
        <h1>Impossible de charger ton profil</h1>
        <p role="alert">${escapeHTML(state.loadError || 'Vérifie la configuration Supabase et les scripts SQL indiqués dans le guide.')}</p>
        <button class="feature-submit" data-action="retry">Réessayer</button>
      </section>
    </main>`;
}

function renderCoinRows(coins) {
  if (!coins.length) return '<p class="empty-copy">Le marché est calme pour l’instant. Reviens bientôt.</p>';
  return `<div class="coin-list">${coins.map((coin) => `
    <article class="coin-row">
      <span class="coin-icon">${escapeHTML(coin.icon || '◈')}</span>
      <span class="coin-identity"><span><strong>${escapeHTML(coin.name)}</strong><small>${escapeHTML(coin.ticker)} · ${escapeHTML(coin.rarity || 'Coin')}</small></span></span>
      <span class="coin-price">
        <strong>${fmt(coin.price, coin.price < 1 ? 4 : 2)} CB</strong>
        <small class="${Number(coin.change) >= 0 ? 'up' : 'down'}">${Number(coin.change) >= 0 ? '+' : ''}${fmt(coin.change)}%</small>
      </span>
      <button class="row-trade" data-action="trade" data-ticker="${escapeHTML(coin.ticker)}">Trader</button>
    </article>`).join('')}</div>`;
}

function renderHome(data, values) {
  return `
    <section class="hero-grid">
      <article class="balance-card">
        <span class="card-label">VALEUR TOTALE DU PORTEFEUILLE</span>
        <div class="portfolio-total">${fmt(values.total)} <small>CB</small></div>
        <p>Ton solde et tes coins, réunis au même endroit.</p>
      </article>
      <article class="stat-card">
        <span class="card-label">COINS DÉTENUS</span>
        <strong>${values.owned.length}</strong>
        <span class="stat-caption">Valeur estimée : ${fmt(values.assets)} CB</span>
      </article>
    </section>
    <div class="section-heading"><div><h2>À toi de jouer</h2><p>Tout ce qu’il te faut, sans te perdre dans les menus.</p></div></div>
    <section class="quick-actions">
      ${[
        { name: 'Marché', icon: '↗', text: 'Découvrir les coins', tab: 'Marché' },
        { name: 'Portefeuille', icon: '◫', text: 'Voir mes actifs', tab: 'Portefeuille' },
        { name: 'Équipes', icon: '♧', text: 'Découvrir les équipes', tab: 'Équipes' },
        { name: 'Bonus quotidien', icon: '✦', text: state.claiming ? 'Un instant…' : 'Récupérer +200 CB', action: 'claim', disabled: state.claiming }
      ].map((item) => `<button ${item.disabled ? 'disabled' : ''} data-action="${item.action || 'tab'}" ${item.tab ? `data-tab="${item.tab}"` : ''}>
        <span class="action-icon">${item.icon}</span><span><strong>${item.name}</strong><small>${item.text}</small></span><span class="action-arrow">→</span>
      </button>`).join('')}
    </section>
    <section class="panel">
      <div class="section-heading"><div><h2>Les coins du moment</h2><p>Un marché partagé, actualisé pour tous.</p></div>
        <button class="text-action" data-action="tab" data-tab="Marché">Tout voir <span>→</span></button>
      </div>
      ${renderCoinRows(data.coins.slice(0, 5))}
    </section>`;
}

function renderMarket(data) {
  return `
    <section class="panel">
      <div class="section-heading"><div><h2>Marché partagé</h2><p>Choisis un coin pour voir les options d’échange.</p></div></div>
      ${renderCoinRows(data.coins)}
    </section>
    <section class="panel feature-panel">
      <div class="section-heading"><div><h2>Une idée de coin ?</h2><p>Propose-le au marché commun.</p></div></div>
      <form class="feature-form" data-form="coin">
        <label>Nom du coin<input name="coinName" value="${escapeHTML(state.drafts.coinName)}" required maxlength="40" placeholder="Ex. Lumière" data-draft="coinName"></label>
        <label>Symbole<input name="ticker" value="${escapeHTML(state.drafts.ticker)}" required maxlength="10" placeholder="LUM" data-draft="ticker"></label>
        <label>Prix de départ (CB)<input name="price" type="number" min="0.0001" step="any" value="${escapeHTML(state.drafts.price)}" required data-draft="price"></label>
        <button class="feature-submit">Proposer le coin <span>→</span></button>
      </form>
    </section>`;
}

function renderWallet(data, values) {
  const coins = values.owned.length
    ? `<div class="coin-list">${values.owned.map((coin) => `
      <div class="wallet-row">
        <div class="coin-identity"><span class="coin-icon">${escapeHTML(coin.icon || '◈')}</span>
          <span><strong>${escapeHTML(coin.name)}</strong><small>${fmt(values.holdings[coin.ticker], 6)} ${escapeHTML(coin.ticker)}</small></span>
        </div>
        <strong>${fmt(coin.price * values.holdings[coin.ticker])} CB</strong>
        <button class="row-trade" data-action="trade" data-ticker="${escapeHTML(coin.ticker)}" data-side="sell">Vendre</button>
      </div>`).join('')}</div>`
    : `<div class="empty-state"><span>◫</span><strong>Ton portefeuille est prêt.</strong>
      <p>Choisis un coin sur le marché pour commencer.</p>
      <button class="text-action" data-action="tab" data-tab="Marché">Découvrir le marché →</button></div>`;
  return `<section class="panel feature-panel">
    <div class="section-heading"><div><h2>Une vue claire de tes actifs</h2><p>Solde et coins détenus sur ton compte.</p></div></div>
    <div class="wallet-summary">
      <div><span>VALEUR ESTIMÉE</span><strong>${fmt(values.total)} <small>CB</small></strong></div>
      <div><span>DISPONIBLE</span><strong>${fmt(values.cash)} <small>CB</small></strong></div>
    </div>${coins}
  </section>`;
}

function renderTeams(data, me) {
  const teams = data.teams.map((team) => `<article class="simple-row">
    <span class="list-symbol">♧</span>
    <span><strong>${escapeHTML(team.name)}</strong><small>${team.owner_id === me.id ? 'Créée par toi' : `Joueur ${escapeHTML(String(team.owner_id).slice(0, 8))}`}</small></span>
  </article>`).join('');
  return `<section class="panel feature-panel">
    <div class="section-heading"><div><h2>Les équipes</h2><p>Crée une équipe ou découvre celles des autres joueurs.</p></div></div>
    <form class="feature-form" data-form="team">
      <label>Nom de l’équipe<input name="teamName" value="${escapeHTML(state.drafts.teamName)}" required maxlength="40" placeholder="Ex. Les explorateurs" data-draft="teamName"></label>
      <button class="feature-submit">Créer une équipe <span>→</span></button>
    </form>
    <div class="simple-list">${teams || '<p class="empty-copy">Pas encore d’équipe. Lance la première !</p>'}</div>
  </section>`;
}

function renderMarketplace(data) {
  const listings = data.listings.map((listing) => `<article class="simple-row">
    <span class="list-symbol">▤</span>
    <span><strong>${escapeHTML(listing.title)}</strong><small>Par joueur ${escapeHTML(String(listing.seller_id).slice(0, 8))}</small></span>
    <b>${fmt(listing.price)} CB</b>
  </article>`).join('');
  return `
    <section class="panel feature-panel">
      <div class="section-heading"><div><h2>Partager une annonce</h2><p>Publie une annonce visible par les joueurs.</p></div></div>
      <form class="feature-form" data-form="listing">
        <label>Ce que tu proposes<input name="listingTitle" value="${escapeHTML(state.drafts.listingTitle)}" required maxlength="80" placeholder="Décris ton annonce" data-draft="listingTitle"></label>
        <label>Prix en CB<input name="listingPrice" type="number" min="0.01" step="any" value="${escapeHTML(state.drafts.listingPrice)}" required data-draft="listingPrice"></label>
        <button class="feature-submit">Publier <span>→</span></button>
      </form>
    </section>
    <section class="panel">
      <div class="section-heading"><div><h2>Annonces des joueurs</h2><p>Les dernières publications du monde.</p></div></div>
      <div class="simple-list">${listings || '<p class="empty-copy">Aucune annonce pour le moment.</p>'}</div>
    </section>`;
}

function renderProfile(data, me) {
  const trades = data.trades.slice(0, 8).map((item) => `<div class="history-row">
    <span class="${item.side === 'buy' ? 'up' : 'down'}">${item.side === 'buy' ? 'Achat' : 'Vente'}</span>
    <strong>${escapeHTML(item.ticker)}</strong><span>${fmt(item.amount_cb)} CB</span>
  </div>`).join('');
  return `<section class="panel feature-panel">
    <div class="section-heading"><div><h2>Ton espace</h2><p>Ton identité dans la communauté Coinbound.</p></div></div>
    <div class="profile-detail"><div class="avatar avatar-large">${escapeHTML(me.username?.[0]?.toUpperCase() || '?')}</div>
      <div><strong>${escapeHTML(me.username)}</strong><p>${badge(me.role, roleClass(me.role))}</p></div>
    </div>
    <label>Modifier ton pseudo<input name="profileUsername" value="${escapeHTML(state.drafts.profileUsername ?? me.username)}" maxlength="20" data-profile-username></label>
    <div class="section-heading history-heading"><div><h2>Activité récente</h2><p>Tes derniers échanges.</p></div></div>
    ${trades}
  </section>`;
}

function renderAdmin(data, role) {
  return `<section class="panel">
    <div class="section-heading"><div><h2>Badges partagés</h2><p>Les rôles sont gérés de façon sécurisée côté serveur.</p></div></div>
    ${data.badges.length
      ? data.badges.map((item) => `<p>${escapeHTML(item.icon)} ${escapeHTML(item.name)} ${badge(item.role)}</p>`).join('')
      : '<p class="empty-copy">Aucun badge configuré.</p>'}
    ${['Owner', 'Admin'].includes(role) ? '<p class="empty-copy">La gestion des rôles doit être configurée via des fonctions serveur autorisées.</p>' : ''}
  </section>
  <section class="panel">
    <div class="section-heading"><div><h2>À propos des rôles</h2><p>Owner · Admin · Developer · Moderator · Player</p></div></div>
    <p class="empty-copy">Les droits importants sont toujours vérifiés côté serveur.</p>
  </section>`;
}

function renderTradeModal() {
  if (!state.trade) return '';
  const coin = state.trade;
  const units = Number(state.tradeAmount || 0) / Number(coin.price);
  return `<div class="modal-backdrop" data-action="close-trade">
    <section class="trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-title">
      <button class="modal-close" aria-label="Fermer" data-action="close-trade">×</button>
      <div class="coin-identity"><span class="coin-icon">${escapeHTML(coin.icon || '◈')}</span>
        <span><h2 id="trade-title">${escapeHTML(coin.name)}</h2><small>${escapeHTML(coin.ticker)} · ${fmt(coin.price)} CB par coin</small></span>
      </div>
      <div class="trade-switch">
        <button class="${state.tradeSide === 'buy' ? 'active' : ''}" data-action="trade-side" data-side="buy">Acheter</button>
        <button class="${state.tradeSide === 'sell' ? 'active' : ''}" data-action="trade-side" data-side="sell">Vendre</button>
      </div>
      <label class="amount-label">Montant en CB<input type="number" min="0.01" step="any" value="${escapeHTML(state.tradeAmount)}" data-trade-amount></label>
      <p class="trade-estimate">Environ <strong data-trade-estimate>${fmt(units, 6)} ${escapeHTML(coin.ticker)}</strong></p>
      <button class="trade-confirm" data-action="submit-trade">Confirmer ${state.tradeSide === 'buy' ? 'l’achat' : 'la vente'} <span>→</span></button>
    </section>
  </div>`;
}

function renderApp() {
  const data = state.data;
  const me = data.profile;
  const role = me.role || 'Player';
  const canViewAdmin = ['Owner', 'Admin', 'Developer'].includes(role);
  const holdings = Object.fromEntries(data.holdings.map((item) => [item.ticker, Number(item.amount)]));
  const cash = Number(me.cash || 0);
  const assets = data.coins.reduce((sum, coin) => sum + Number(coin.price) * (holdings[coin.ticker] || 0), 0);
  const owned = data.coins.filter((coin) => (holdings[coin.ticker] || 0) > 0);
  const values = { holdings, cash, assets, total: cash + assets, owned };
  const pageTitle = {
    Accueil: 'Ton marché, en un coup d’œil',
    Marché: 'Le marché',
    Portefeuille: 'Ton portefeuille',
    Équipes: 'Les équipes',
    Marketplace: 'Marketplace',
    Profil: 'Ton profil',
    Admin: 'Administration'
  }[state.tab];
  const pages = {
    Accueil: renderHome(data, values),
    Marché: renderMarket(data),
    Portefeuille: renderWallet(data, values),
    Équipes: renderTeams(data, me),
    Marketplace: renderMarketplace(data),
    Profil: renderProfile(data, me),
    Admin: canViewAdmin ? renderAdmin(data, role) : ''
  };
  const nav = (items, mobile = false) => items.map((item) => `<button ${item.name === state.tab ? 'aria-current="page"' : ''}
    class="${mobile ? (item.name === state.tab ? 'selected' : '') : `nav-link ${item.name === state.tab ? 'selected' : ''}`}"
    data-action="tab" data-tab="${item.name}">
    <span class="${mobile ? '' : 'nav-icon'}">${item.icon}</span>${mobile ? `<small>${item.name}</small>` : item.name}
  </button>`).join('');
  const navigation = [...navItems, ...(canViewAdmin ? [{ name: 'Admin', icon: '⚙' }] : [])];

  state.root.innerHTML = `
    <div class="auth-bar"><span>${escapeHTML(me.username || state.session.user.email || 'Connecté')}</span>
      <button data-action="sign-out">Déconnexion</button>
    </div>
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="#top">◈ coinbound<span class="green-period">.</span></a>
        <div class="profile-mini"><div class="avatar">${escapeHTML(me.username?.[0]?.toUpperCase() || '?')}</div>
          <div class="profile-copy"><strong>${escapeHTML(me.username)}</strong>${badge(role, roleClass(role))}</div>
        </div>
        <nav aria-label="Navigation principale">${nav(navItems)}${canViewAdmin ? nav([{ name: 'Admin', icon: '⚙' }]) : ''}</nav>
        <div class="sidebar-spacer"></div>
        <section class="daily-card"><span class="daily-tag">PETIT BONUS QUOTIDIEN</span><strong>+200 CB</strong>
          <button data-action="claim" ${state.claiming ? 'disabled' : ''}>${state.claiming ? 'Un instant…' : 'Récupérer'}</button>
        </section>
        <p class="sidebar-footer">Jeu gratuit · monnaie virtuelle, sans valeur réelle.</p>
      </aside>
      <main class="main-area" id="top">
        <header class="topbar"><div><span class="crumb">COINBOUND <span> / </span> ${escapeHTML(state.tab.toUpperCase())}</span>
          <p class="topbar-caption">Une expérience de trading virtuelle, entre joueurs.</p></div>
          <div class="balance-pill"><span>TON SOLDE</span><strong>${fmt(cash, 0)} <small>CB</small></strong></div>
        </header>
        <div class="content">
          <div class="welcome-row"><div><span class="eyebrow">SALUT ${escapeHTML(me.username.toUpperCase())}</span>
            <h1>${escapeHTML(pageTitle)}<span class="green-period">.</span></h1>
            <p class="subtitle">Les données se synchronisent avec Supabase.</p></div>
            <span class="live-indicator"><i></i> Actualisation toutes les 30 s</span>
          </div>
          ${pages[state.tab] || ''}
          <footer class="disclaimer">Données de jeu partagées via Supabase · CB virtuels uniquement, sans valeur réelle.</footer>
        </div>
      </main>
      ${state.message ? `<div class="toast" role="status">${escapeHTML(state.message)}</div>` : ''}
      ${renderTradeModal()}
      <nav class="mobile-nav" aria-label="Navigation mobile">${nav(navigation, true)}</nav>
    </div>`;
}

async function refresh() {
  try {
    const profile = await fetchProfile();
    const [coins, holdings, teams, listings, badges, trades] = await Promise.all([
      rest('market_coins', 'select=ticker,name,price,icon,rarity,change&order=name'),
      rest('holdings', `user_id=eq.${encodeURIComponent(profile.id)}&select=user_id,ticker,amount`),
      rest('game_teams', 'select=id,owner_id,name,created_at&order=created_at.desc'),
      rest('game_listings', 'select=id,seller_id,title,price,created_at&order=created_at.desc'),
      rest('game_badges', 'select=id,name,icon,color,role'),
      rest('trades', `user_id=eq.${encodeURIComponent(profile.id)}&select=id,user_id,ticker,side,amount_cb,units,price,created_at&order=created_at.desc&limit=100`)
    ]);
    state.data = { profile, coins, holdings, teams, listings, badges, trades };
    state.drafts.profileUsername ??= profile.username;
    state.loadError = '';
  } catch (error) {
    state.loadError = error instanceof Error ? error.message : 'Impossible de charger les données.';
    state.message = state.loadError;
    clearTimeout(state.messageTimer);
    state.messageTimer = setTimeout(() => { state.message = ''; render(); }, 3500);
  } finally {
    state.loading = false;
    render();
  }
}

function notify(text) {
  state.message = text;
  clearTimeout(state.messageTimer);
  state.messageTimer = setTimeout(() => { state.message = ''; render(); }, 3500);
  render();
}

async function perform(operation, success) {
  try {
    await operation();
    await refresh();
    notify(success);
    return true;
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Opération impossible.');
    return false;
  }
}

async function loadSessionData() {
  state.data = emptyData();
  state.loading = true;
  state.trade = null;
  stopDataUpdates();
  render();
  await refresh();
  state.unsubscribe = subscribeTo(
    ['profiles', 'market_coins', 'holdings', 'trades', 'game_teams', 'game_listings', 'game_badges', 'user_badges'],
    () => { void refresh(); }
  );
  state.refreshTimer = setInterval(() => { void refresh(); }, 30000);
}

function stopDataUpdates() {
  if (state.unsubscribe) state.unsubscribe();
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.unsubscribe = null;
  state.refreshTimer = null;
}

async function handleSessionChange(session) {
  state.session = session;
  if (!session) {
    stopDataUpdates();
    state.data = emptyData();
    state.loading = false;
    render();
    return;
  }
  await loadSessionData();
}

function changeTab(tab) {
  state.tab = tab;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

async function submitAuth(form) {
  const formData = new FormData(form);
  state.drafts.email = String(formData.get('email') || '').trim();
  state.drafts.password = String(formData.get('password') || '');
  state.drafts.username = String(formData.get('username') || '').trim();
  state.authError = '';
  state.authInfo = '';
  state.authBusy = true;
  render();
  try {
    if (state.authMode === 'signin') {
      await signIn(state.drafts.email, state.drafts.password);
    } else if (state.authMode === 'signup') {
      if (state.drafts.username.length < 3) throw new Error('Le pseudo doit contenir au moins 3 caractères.');
      if (state.drafts.password.length < 8) throw new Error('Choisis un mot de passe d’au moins 8 caractères.');
      const result = await signUp(state.drafts.email, state.drafts.password, state.drafts.username);
      if (!result?.access_token) state.authInfo = 'Compte créé. Vérifie ta boîte mail pour confirmer ton adresse.';
    } else if (state.authMode === 'magic') {
      await magicLink(state.drafts.email);
      state.authInfo = 'Lien de connexion envoyé par email.';
    } else {
      await resetPassword(state.drafts.email);
      state.authInfo = 'Email de réinitialisation envoyé.';
    }
  } catch (error) {
    state.authError = error instanceof Error ? error.message : 'Une erreur est survenue.';
  } finally {
    state.authBusy = false;
    render();
  }
}

async function guestLogin() {
  state.authError = '';
  state.authBusy = true;
  render();
  try {
    await signInAnonymously();
  } catch (error) {
    state.authError = error instanceof Error ? error.message : 'La connexion invité a échoué.';
  } finally {
    state.authBusy = false;
    render();
  }
}

async function claimReward() {
  state.claiming = true;
  render();
  try {
    await perform(() => rpc('claim_daily_reward'), 'Récompense récupérée.');
  } finally {
    state.claiming = false;
    render();
  }
}

async function submitTrade() {
  if (!state.trade) return;
  const value = Number(state.tradeAmount);
  if (!Number.isFinite(value) || value <= 0) {
    notify('Saisis un montant valide.');
    return;
  }
  const coin = state.trade;
  const side = state.tradeSide;
  state.trade = null;
  render();
  await perform(
    () => rpc('execute_trade', { p_ticker: coin.ticker, p_side: side, p_amount_cb: value }),
    side === 'buy' ? 'Achat effectué.' : 'Vente effectuée.'
  );
}

async function submitFeatureForm(form) {
  const values = new FormData(form);
  if (form.dataset.form === 'coin') {
    const coinName = String(values.get('coinName') || '').trim();
    const ticker = String(values.get('ticker') || '').trim().toUpperCase();
    const price = Number(values.get('price'));
    if (await perform(() => rpc('create_coin', { p_name: coinName, p_ticker: ticker, p_price: price }), 'Coin proposé au marché partagé.')) {
      Object.assign(state.drafts, { coinName: '', ticker: '', price: '10' });
      render();
    }
  } else if (form.dataset.form === 'team') {
    const teamName = String(values.get('teamName') || '').trim();
    if (await perform(() => rpc('create_team', { p_name: teamName }), 'Équipe créée.')) {
      state.drafts.teamName = '';
      render();
    }
  } else if (form.dataset.form === 'listing') {
    const listingTitle = String(values.get('listingTitle') || '').trim();
    const listingPrice = Number(values.get('listingPrice'));
    if (await perform(() => rpc('create_listing', { p_title: listingTitle, p_price: listingPrice }), 'Annonce publiée.')) {
      state.drafts.listingTitle = '';
      state.drafts.listingPrice = '100';
      render();
    }
  }
}

async function saveUsername(input) {
  const username = input.value.trim();
  const currentUsername = state.data.profile?.username;
  if (!username || username === currentUsername) return;
  const profileId = state.data.profile.id;
  const saved = await perform(
    () => rest('profiles', `id=eq.${encodeURIComponent(profileId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ username })
    }),
    'Pseudo enregistré.'
  );
  if (saved) state.drafts.profileUsername = username;
}

function bindEvents(root) {
  root.addEventListener('input', (event) => {
    const input = event.target;
    if (input.matches('[data-draft]')) state.drafts[input.dataset.draft] = input.value;
    if (input.matches('[data-profile-username]')) state.drafts.profileUsername = input.value;
    if (input.matches('[data-trade-amount]')) {
      state.tradeAmount = input.value;
      const estimate = root.querySelector('[data-trade-estimate]');
      if (estimate && state.trade) estimate.textContent = `${fmt(Number(input.value || 0) / Number(state.trade.price), 6)} ${state.trade.ticker}`;
    }
  });

  root.addEventListener('focusout', (event) => {
    if (event.target.matches('[data-profile-username]')) void saveUsername(event.target);
  });

  root.addEventListener('submit', (event) => {
    const form = event.target;
    if (!form.matches('[data-form]')) return;
    event.preventDefault();
    if (form.dataset.form === 'auth') void submitAuth(form);
    else void submitFeatureForm(form);
  });

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || !root.contains(button)) return;
    const action = button.dataset.action;

    if (action === 'auth-mode') {
      state.authMode = button.dataset.mode;
      state.authError = '';
      state.authInfo = '';
      render();
    } else if (action === 'oauth') {
      oauth(button.dataset.provider);
    } else if (action === 'guest') {
      void guestLogin();
    } else if (action === 'sign-out') {
      void signOut();
    } else if (action === 'tab') {
      changeTab(button.dataset.tab);
    } else if (action === 'claim') {
      void claimReward();
    } else if (action === 'trade') {
      const coin = state.data.coins.find((item) => item.ticker === button.dataset.ticker);
      if (coin) {
        state.trade = coin;
        state.tradeSide = button.dataset.side || 'buy';
        state.tradeAmount = '100';
        render();
        root.querySelector('.modal-close')?.focus();
      }
    } else if (action === 'trade-side') {
      state.tradeSide = button.dataset.side;
      render();
    } else if (action === 'close-trade') {
      if (button === event.target || button.classList.contains('modal-close')) {
        state.trade = null;
        render();
      }
    } else if (action === 'submit-trade') {
      void submitTrade();
    } else if (action === 'retry') {
      state.loading = true;
      render();
      void refresh();
    }
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.trade) {
      state.trade = null;
      render();
    }
  });
}

export async function start(root) {
  state.root = root;
  bindEvents(root);
  render();
  onAuthChange((session) => {
    state.session = session;
    if (!state.initializing) void handleSessionChange(session);
  });
  await consumeRedirectSession();
  await refreshIfNeeded();
  state.session = getSession();
  state.ready = true;
  state.initializing = false;
  if (state.session) await loadSessionData();
  else render();
  setInterval(refreshIfNeeded, 5 * 60_000);
}
