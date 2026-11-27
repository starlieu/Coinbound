import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchProfile, rest, rpc, subscribeTo } from './supabase.js';

const navItems = [
  { name: 'Accueil', icon: '⌂' },
  { name: 'Marché', icon: '↗' },
  { name: 'Portefeuille', icon: '◫' },
  { name: 'Équipes', icon: '♧' },
  { name: 'Marketplace', icon: '▤' },
  { name: 'Profil', icon: '◉' }
];
const roles = ['Player', 'Moderator', 'Developer', 'Admin'];
const fmt = (number, digits = 2) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(Number(number) || 0);

function Badge({ children, className = '' }) {
  return <span className={`role-badge ${className}`}>{children}</span>;
}

export default function App() {
  const [data, setData] = useState({
    profile: null,
    coins: [],
    holdings: [],
    teams: [],
    teamMembers: [],
    listings: [],
    badges: [],
    trades: [],
    reports: [],
    audit: [],
    players: []
  });
  const [tab, setTab] = useState('Accueil');
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [trade, setTrade] = useState(null);
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('100');
  const [coinName, setCoinName] = useState('');
  const [ticker, setTicker] = useState('');
  const [price, setPrice] = useState('10');
  const [teamName, setTeamName] = useState('');
  const [listingTitle, setListingTitle] = useState('');
  const [listingPrice, setListingPrice] = useState('100');
  const [listingToBuy, setListingToBuy] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportNotes, setReportNotes] = useState({});
  const [roleEdits, setRoleEdits] = useState({});

  const notify = (text) => {
    setMessage(text);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setMessage(''), 3500);
  };

  const refresh = useCallback(async () => {
    try {
      const profile = await fetchProfile();
      const canModerate = ['Owner', 'Admin', 'Moderator'].includes(profile.role);
      const canManageRoles = ['Owner', 'Admin'].includes(profile.role);
      const [coins, holdings, teams, teamMembers, listings, badges, trades, reports, audit, players] = await Promise.all([
        rest('market_coins', 'select=ticker,name,price,icon,rarity,change&order=name'),
        rest('holdings', `user_id=eq.${profile.id}&select=user_id,ticker,amount`),
        rest('game_teams', 'select=id,owner_id,name,created_at&order=created_at.desc'),
        rest('game_team_members', 'select=team_id,user_id'),
        rest('game_listings', 'select=id,seller_id,title,price,status,created_at&status=eq.active&order=created_at.desc'),
        rest('game_badges', 'select=id,name,icon,color,role'),
        rest('trades', `user_id=eq.${profile.id}&select=id,user_id,ticker,side,amount_cb,units,price,created_at&order=created_at.desc&limit=100`),
        canModerate
          ? rest('game_reports', 'select=id,listing_id,reporter_id,reason,status,created_at,listing:game_listings(id,title,seller_id,status)&status=eq.open&order=created_at.asc')
          : Promise.resolve([]),
        canManageRoles
          ? rest('moderation_audit', 'select=id,actor_id,action,target_type,target_id,details,created_at&order=created_at.desc&limit=50')
          : Promise.resolve([]),
        canManageRoles
          ? rest('profiles', 'select=id,username,role&order=username')
          : Promise.resolve([])
      ]);
      setData({ profile, coins, holdings, teams, teamMembers, listings, badges, trades, reports, audit, players });
      setLoadError('');
      return true;
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Impossible de charger les données.';
      setLoadError(text);
      notify(text);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeTo([
      'profiles', 'market_coins', 'holdings', 'trades', 'game_teams', 'game_team_members',
      'game_listings', 'game_badges', 'user_badges', 'game_reports', 'moderation_audit'
    ], refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [refresh]);

  const me = data.profile;
  const role = me?.role || 'Player';
  const canViewAdmin = ['Owner', 'Admin', 'Developer', 'Moderator'].includes(role);
  const canModerate = ['Owner', 'Admin', 'Moderator'].includes(role);
  const canManageRoles = ['Owner', 'Admin'].includes(role);
  const holdings = Object.fromEntries(data.holdings.map((holding) => [holding.ticker, Number(holding.amount)]));
  const cash = Number(me?.cash || 0);
  const assetValue = data.coins.reduce((sum, coin) => sum + coin.price * (holdings[coin.ticker] || 0), 0);
  const totalValue = cash + assetValue;
  const ownedCoins = useMemo(
    () => data.coins.filter((coin) => (holdings[coin.ticker] || 0) > 0),
    [data.coins, data.holdings]
  );

  const perform = async (operation, success) => {
    try {
      await operation();
      const updated = await refresh();
      notify(updated ? success : 'Action effectuée, mais les données n’ont pas pu être actualisées.');
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Opération impossible.');
      return false;
    }
  };

  const beginTrade = (coin, direction = 'buy') => {
    setTrade(coin);
    setSide(direction);
    setAmount('100');
  };

  const submitTrade = () => {
    if (!trade) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return notify('Saisis un montant valide.');
    void perform(
      () => rpc('execute_trade', { p_ticker: trade.ticker, p_side: side, p_amount_cb: value }),
      side === 'buy' ? 'Achat effectué.' : 'Vente effectuée.'
    );
    setTrade(null);
  };

  const createCoin = (event) => {
    event.preventDefault();
    void perform(
      () => rpc('create_coin', { p_name: coinName.trim(), p_ticker: ticker.trim().toUpperCase(), p_price: Number(price) }),
      'Coin proposé au marché partagé.'
    ).then((ok) => {
      if (ok) {
        setCoinName('');
        setTicker('');
      }
    });
  };

  const createTeam = (event) => {
    event.preventDefault();
    void perform(() => rpc('create_team', { p_name: teamName.trim() }), 'Équipe créée.')
      .then((ok) => { if (ok) setTeamName(''); });
  };

  const joinTeam = (teamId) =>
    perform(() => rpc('join_team', { p_team_id: teamId }), 'Tu as rejoint l’équipe.');

  const leaveTeam = (teamId) =>
    perform(() => rpc('leave_team', { p_team_id: teamId }), 'Tu as quitté l’équipe.');

  const createListing = (event) => {
    event.preventDefault();
    void perform(
      () => rpc('create_listing', { p_title: listingTitle.trim(), p_price: Number(listingPrice) }),
      'Annonce publiée.'
    ).then((ok) => { if (ok) setListingTitle(''); });
  };

  const buyListing = async () => {
    if (!listingToBuy) return;
    const ok = await perform(
      () => rpc('purchase_listing', { p_listing_id: listingToBuy.id }),
      'Achat effectué. Le vendeur a reçu les CB.'
    );
    if (ok) setListingToBuy(null);
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!reportTarget) return;
    const ok = await perform(
      () => rpc('report_listing', { p_listing_id: reportTarget.id, p_reason: reportReason.trim() }),
      'Signalement envoyé à la modération.'
    );
    if (ok) {
      setReportTarget(null);
      setReportReason('');
    }
  };

  const moderateReport = async (report, action) => {
    const ok = await perform(
      () => rpc('moderate_game_report', {
        p_report_id: report.id,
        p_action: action,
        p_note: reportNotes[report.id]?.trim() || null
      }),
      action === 'remove_listing' ? 'Annonce retirée.' : 'Signalement classé sans suite.'
    );
    if (ok) {
      setReportNotes((current) => {
        const next = { ...current };
        delete next[report.id];
        return next;
      });
    }
  };

  const saveRole = async (player) => {
    const nextRole = roleEdits[player.id] || player.role;
    if (nextRole === player.role) return;
    const ok = await perform(
      () => rpc('set_profile_role', { p_user_id: player.id, p_role: nextRole }),
      `Rôle de ${player.username} mis à jour.`
    );
    if (ok) setRoleEdits((current) => ({ ...current, [player.id]: nextRole }));
  };

  const claimReward = () => {
    setClaiming(true);
    void perform(() => rpc('claim_daily_reward'), 'Récompense récupérée.')
      .finally(() => setClaiming(false));
  };

  const changeTab = (value) => {
    setTab(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageTitle = {
    Accueil: 'Ton marché, en un coup d’œil',
    Marché: 'Le marché',
    Portefeuille: 'Ton portefeuille',
    Équipes: 'Les équipes',
    Marketplace: 'Marketplace',
    Profil: 'Ton profil',
    Admin: 'Modération et administration'
  }[tab];

  if (loading) {
    return <main className="loading-screen"><span className="loading-mark">◈</span><p>On prépare ton marché…</p></main>;
  }
  if (!me) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <span className="loading-mark">◈</span>
          <h1>Impossible de charger ton profil</h1>
          <p role="alert">{loadError || 'Vérifie la configuration Supabase et les scripts SQL indiqués dans le guide.'}</p>
          <button className="feature-submit" onClick={() => { setLoading(true); void refresh(); }}>Réessayer</button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top">◈ coinbound<span className="green-period">.</span></a>
        <div className="profile-mini">
          <div className="avatar">{me.username?.[0]?.toUpperCase() || '?'}</div>
          <div className="profile-copy">
            <strong>{me.username}</strong>
            <Badge className={`role-${role.toLowerCase()}`}>{role}</Badge>
          </div>
        </div>
        <nav aria-label="Navigation principale">
          {navItems.map((item) => (
            <button key={item.name} aria-current={tab === item.name ? 'page' : undefined}
              className={`nav-link ${tab === item.name ? 'selected' : ''}`} onClick={() => changeTab(item.name)}>
              <span className="nav-icon">{item.icon}</span>{item.name}
            </button>
          ))}
          {canViewAdmin && (
            <button aria-current={tab === 'Admin' ? 'page' : undefined}
              className={`nav-link ${tab === 'Admin' ? 'selected' : ''}`} onClick={() => changeTab('Admin')}>
              <span className="nav-icon">⚙</span>Modération
            </button>
          )}
        </nav>
        <div className="sidebar-spacer" />
        <section className="daily-card">
          <span className="daily-tag">PETIT BONUS QUOTIDIEN</span>
          <strong>+200 CB</strong>
          <button disabled={claiming} onClick={claimReward}>{claiming ? 'Un instant…' : 'Récupérer'}</button>
        </section>
        <p className="sidebar-footer">Jeu gratuit · monnaie virtuelle, sans valeur réelle.</p>
      </aside>

      <main className="main-area" id="top">
        <header className="topbar">
          <div>
            <span className="crumb">COINBOUND <span> / </span> {tab.toUpperCase()}</span>
            <p className="topbar-caption">Une expérience de trading virtuelle, entre joueurs.</p>
          </div>
          <div className="balance-pill"><span>TON SOLDE</span><strong>{fmt(cash, 0)} <small>CB</small></strong></div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <span className="eyebrow">SALUT {me.username.toUpperCase()}</span>
              <h1>{pageTitle}<span className="green-period">.</span></h1>
              <p className="subtitle">Données partagées via Supabase, actualisées toutes les 30 s.</p>
            </div>
          </div>

          {tab === 'Accueil' && (
            <>
              <section className="hero-grid">
                <article className="balance-card">
                  <span className="card-label">VALEUR TOTALE DU PORTEFEUILLE</span>
                  <div className="portfolio-total">{fmt(totalValue)} <small>CB</small></div>
                  <p>Ton solde et tes coins, réunis au même endroit.</p>
                </article>
                <article className="stat-card">
                  <span className="card-label">COINS DÉTENUS</span>
                  <strong>{ownedCoins.length}</strong>
                  <span className="stat-caption">Valeur estimée : {fmt(assetValue)} CB</span>
                </article>
              </section>
              <div className="section-heading">
                <div><h2>À toi de jouer</h2><p>Tout ce qu’il te faut, sans te perdre dans les menus.</p></div>
              </div>
              <section className="quick-actions">
                {[
                  { name: 'Marché', icon: '↗', text: 'Découvrir les coins' },
                  { name: 'Portefeuille', icon: '◫', text: 'Voir mes actifs' },
                  { name: 'Équipes', icon: '♧', text: 'Jouer ensemble' },
                  { name: 'Bonus quotidien', icon: '✦', text: claiming ? 'Un instant…' : 'Récupérer +200 CB', action: claimReward, disabled: claiming }
                ].map((item) => (
                  <button key={item.name} disabled={item.disabled}
                    onClick={() => item.action ? item.action() : changeTab(item.name)}>
                    <span className="action-icon">{item.icon}</span>
                    <span><strong>{item.name}</strong><small>{item.text}</small></span>
                    <span className="action-arrow">→</span>
                  </button>
                ))}
              </section>
              <section className="panel">
                <div className="section-heading">
                  <div><h2>Les coins du moment</h2><p>Un marché partagé, actualisé pour tous.</p></div>
                  <button className="text-action" onClick={() => changeTab('Marché')}>Tout voir <span>→</span></button>
                </div>
                <CoinRows coins={data.coins.slice(0, 5)} onTrade={beginTrade} />
              </section>
            </>
          )}

          {tab === 'Marché' && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <div><h2>Marché partagé</h2><p>Choisis un coin pour voir les options d’échange.</p></div>
                </div>
                <CoinRows coins={data.coins} onTrade={beginTrade} />
              </section>
              <section className="panel feature-panel">
                <div className="section-heading">
                  <div><h2>Une idée de coin ?</h2><p>Propose-le au marché commun.</p></div>
                </div>
                <form className="feature-form" onSubmit={createCoin}>
                  <label>Nom du coin<input value={coinName} onChange={(event) => setCoinName(event.target.value)} required maxLength={40} placeholder="Ex. Lumière" /></label>
                  <label>Symbole<input value={ticker} onChange={(event) => setTicker(event.target.value)} required maxLength={8} placeholder="LUM" /></label>
                  <label>Prix de départ (CB)<input type="number" min="0.0001" step="any" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
                  <button className="feature-submit">Proposer le coin <span>→</span></button>
                </form>
              </section>
            </>
          )}

          {tab === 'Portefeuille' && (
            <section className="panel feature-panel">
              <div className="section-heading">
                <div><h2>Une vue claire de tes actifs</h2><p>Solde et coins détenus sur ton compte.</p></div>
              </div>
              <div className="wallet-summary">
                <div><span>VALEUR ESTIMÉE</span><strong>{fmt(totalValue)} <small>CB</small></strong></div>
                <div><span>DISPONIBLE</span><strong>{fmt(cash)} <small>CB</small></strong></div>
              </div>
              {ownedCoins.length ? (
                <div className="coin-list">
                  {ownedCoins.map((coin) => (
                    <div className="wallet-row" key={coin.ticker}>
                      <div className="coin-identity">
                        <span className="coin-icon">{coin.icon || '◈'}</span>
                        <span><strong>{coin.name}</strong><small>{fmt(holdings[coin.ticker], 6)} {coin.ticker}</small></span>
                      </div>
                      <strong>{fmt(coin.price * holdings[coin.ticker])} CB</strong>
                      <button className="row-trade" onClick={() => beginTrade(coin, 'sell')}>Vendre</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span>◫</span><strong>Ton portefeuille est prêt.</strong>
                  <p>Choisis un coin sur le marché pour commencer.</p>
                  <button className="text-action" onClick={() => changeTab('Marché')}>Découvrir le marché →</button>
                </div>
              )}
            </section>
          )}

          {tab === 'Équipes' && (
            <section className="panel feature-panel">
              <div className="section-heading">
                <div><h2>Joue avec les autres</h2><p>Rejoins une équipe ou crée la tienne.</p></div>
              </div>
              <form className="feature-form" onSubmit={createTeam}>
                <label>Nom de l’équipe<input value={teamName} onChange={(event) => setTeamName(event.target.value)} required maxLength={40} placeholder="Ex. Les explorateurs" /></label>
                <button className="feature-submit">Créer une équipe <span>→</span></button>
              </form>
              <div className="simple-list">
                {data.teams.map((team) => {
                  const isMember = data.teamMembers.some((member) =>
                    String(member.team_id) === String(team.id) && member.user_id === me.id
                  );
                  const memberCount = data.teamMembers.filter((member) =>
                    String(member.team_id) === String(team.id)
                  ).length;
                  return (
                    <article className="simple-row team-row" key={team.id}>
                      <span className="list-symbol">♧</span>
                      <span><strong>{team.name}</strong><small>{memberCount} membre{memberCount === 1 ? '' : 's'} · {team.owner_id === me.id ? 'créée par toi' : `joueur ${team.owner_id.slice(0, 8)}`}</small></span>
                      {team.owner_id === me.id
                        ? <Badge>Créateur</Badge>
                        : <button className="row-trade" onClick={() => void (isMember ? leaveTeam(team.id) : joinTeam(team.id))}>{isMember ? 'Quitter' : 'Rejoindre'}</button>}
                    </article>
                  );
                })}
                {!data.teams.length && <p className="empty-copy">Pas encore d’équipe. Lance la première !</p>}
              </div>
            </section>
          )}

          {tab === 'Marketplace' && (
            <>
              <section className="panel feature-panel">
                <div className="section-heading">
                  <div><h2>Partager une annonce</h2><p>Les ventes utilisent uniquement des CB fictifs.</p></div>
                </div>
                <form className="feature-form" onSubmit={createListing}>
                  <label>Ce que tu proposes<input value={listingTitle} onChange={(event) => setListingTitle(event.target.value)} required maxLength={80} placeholder="Décris ton annonce" /></label>
                  <label>Prix en CB<input type="number" min="0.01" step="any" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)} required /></label>
                  <button className="feature-submit">Publier <span>→</span></button>
                </form>
              </section>
              <section className="panel">
                <div className="section-heading">
                  <div><h2>Annonces disponibles</h2><p>Le paiement est transféré au vendeur par le serveur.</p></div>
                </div>
                <div className="simple-list">
                  {data.listings.map((listing) => (
                    <article className="simple-row listing-row" key={listing.id}>
                      <span className="list-symbol">▤</span>
                      <span><strong>{listing.title}</strong><small>Par joueur {listing.seller_id.slice(0, 8)}</small></span>
                      <b>{fmt(listing.price)} CB</b>
                      {listing.seller_id === me.id
                        ? <Badge>À toi</Badge>
                        : <div className="listing-actions">
                          <button className="row-trade" onClick={() => setListingToBuy(listing)}>Acheter</button>
                          <button className="text-action" onClick={() => { setReportTarget(listing); setReportReason(''); }}>Signaler</button>
                        </div>}
                    </article>
                  ))}
                  {!data.listings.length && <p className="empty-copy">Aucune annonce disponible pour le moment.</p>}
                </div>
              </section>
            </>
          )}

          {tab === 'Profil' && (
            <section className="panel feature-panel">
              <div className="section-heading">
                <div><h2>Ton espace</h2><p>Ton identité dans la communauté Coinbound.</p></div>
              </div>
              <div className="profile-detail">
                <div className="avatar avatar-large">{me.username?.[0]?.toUpperCase() || '?'}</div>
                <div><strong>{me.username}</strong><p><Badge className={`role-${role.toLowerCase()}`}>{role}</Badge></p></div>
              </div>
              <label>Modifier ton pseudo
                <input defaultValue={me.username} maxLength={20} onBlur={(event) => {
                  const username = event.target.value.trim();
                  if (username && username !== me.username) {
                    void perform(
                      () => rest('profiles', `id=eq.${me.id}`, { method: 'PATCH', body: JSON.stringify({ username }) }),
                      'Pseudo enregistré.'
                    );
                  }
                }} />
              </label>
              <div className="section-heading history-heading">
                <div><h2>Activité récente</h2><p>Tes derniers échanges.</p></div>
              </div>
              {data.trades.slice(0, 8).map((item) => (
                <div className="history-row" key={item.id}>
                  <span className={item.side === 'buy' ? 'up' : 'down'}>{item.side === 'buy' ? 'Achat' : 'Vente'}</span>
                  <strong>{item.ticker}</strong><span>{fmt(item.amount_cb)} CB</span>
                </div>
              ))}
            </section>
          )}

          {tab === 'Admin' && canViewAdmin && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <div><h2>Signalements ouverts</h2><p>Les actions de modération sont vérifiées par Supabase.</p></div>
                  <Badge>{data.reports.length} en attente</Badge>
                </div>
                {!canModerate && <p className="empty-copy">Ton rôle donne accès aux badges, mais pas à la file de modération.</p>}
                {canModerate && (
                  <div className="report-list">
                    {data.reports.map((report) => (
                      <article className="report-card" key={report.id}>
                        <div className="report-heading">
                          <strong>{report.listing?.title || `Annonce #${report.listing_id}`}</strong>
                          <small>Signalée par {report.reporter_id.slice(0, 8)} · {new Date(report.created_at).toLocaleDateString('fr-FR')}</small>
                        </div>
                        <p>{report.reason}</p>
                        <label>Note interne
                          <input value={reportNotes[report.id] || ''} maxLength={500}
                            onChange={(event) => setReportNotes((current) => ({ ...current, [report.id]: event.target.value }))} />
                        </label>
                        <div className="report-actions">
                          <button className="row-trade" onClick={() => void moderateReport(report, 'dismiss')}>Classer sans suite</button>
                          <button className="feature-submit" disabled={report.listing?.status !== 'active'}
                            onClick={() => void moderateReport(report, 'remove_listing')}>Retirer l’annonce</button>
                        </div>
                      </article>
                    ))}
                    {!data.reports.length && <p className="empty-copy">Aucun signalement en attente.</p>}
                  </div>
                )}
              </section>
              <section className="panel">
                <div className="section-heading">
                  <div><h2>Badges partagés</h2><p>Les badges affichés ne donnent pas de droits supplémentaires.</p></div>
                </div>
                {data.badges.length
                  ? data.badges.map((badge) => <p key={badge.id}>{badge.icon} {badge.name} <Badge>{badge.role}</Badge></p>)
                  : <p className="empty-copy">Aucun badge configuré.</p>}
              </section>
              {canManageRoles && (
                <section className="panel">
                  <div className="section-heading">
                    <div><h2>Rôles des joueurs</h2><p>Les limites de rôle sont aussi appliquées côté serveur.</p></div>
                  </div>
                  <div className="role-list">
                    {data.players.map((player) => {
                      const editable = player.id !== me.id && player.role !== 'Owner'
                        && (role === 'Owner' || !['Owner', 'Admin'].includes(player.role));
                      const selectedRole = roleEdits[player.id] || player.role;
                      const protectedRole = ['Owner', 'Admin'].includes(player.role) ? [player.role] : [];
                      const options = role === 'Owner'
                        ? ['Owner', ...roles]
                        : [...protectedRole, 'Player', 'Moderator', 'Developer'];
                      return (
                        <div className="role-row" key={player.id}>
                          <span><strong>{player.username}</strong><small>{player.id.slice(0, 8)}</small></span>
                          <select aria-label={`Rôle de ${player.username}`} disabled={!editable} value={selectedRole}
                            onChange={(event) => setRoleEdits((current) => ({ ...current, [player.id]: event.target.value }))}>
                            {options.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                          <button className="row-trade" disabled={!editable || selectedRole === player.role}
                            onClick={() => void saveRole(player)}>Enregistrer</button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              {canManageRoles && (
                <section className="panel">
                  <div className="section-heading">
                    <div><h2>Historique d’administration</h2><p>Les 50 dernières décisions sont conservées côté serveur.</p></div>
                  </div>
                  <div className="simple-list">
                    {data.audit.map((entry) => (
                      <article className="simple-row" key={entry.id}>
                        <span className="list-symbol">◷</span>
                        <span>
                          <strong>{{
                            listing_removed: 'Annonce retirée',
                            report_dismissed: 'Signalement classé sans suite',
                            role_changed: 'Rôle modifié'
                          }[entry.action] || entry.action}</strong>
                          <small>{entry.target_type} {entry.target_id} · par {entry.actor_id?.slice(0, 8) || 'compte supprimé'}</small>
                        </span>
                        <small>{new Date(entry.created_at).toLocaleString('fr-FR')}</small>
                      </article>
                    ))}
                    {!data.audit.length && <p className="empty-copy">Aucune action enregistrée.</p>}
                  </div>
                </section>
              )}
              <section className="panel">
                <div className="section-heading">
                  <div><h2>Limites actuelles</h2><p>Les CB sont fictifs et aucune valeur réelle n’est échangée.</p></div>
                </div>
                <p className="empty-copy">La modération couvre les annonces signalées. Les sanctions de compte et la modération de chat ne sont pas implémentées.</p>
              </section>
            </>
          )}

          <footer className="disclaimer">
            Données de jeu partagées via Supabase · CB virtuels uniquement, sans valeur réelle.
          </footer>
        </div>
      </main>

      {message && <div className="toast" role="status">{message}</div>}

      {trade && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTrade(null); }}>
          <section className="trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-title">
            <button className="modal-close" aria-label="Fermer" onClick={() => setTrade(null)}>×</button>
            <div className="coin-identity">
              <span className="coin-icon">{trade.icon || '◈'}</span>
              <span><h2 id="trade-title">{trade.name}</h2><small>{trade.ticker} · {fmt(trade.price)} CB par coin</small></span>
            </div>
            <div className="trade-switch">
              <button className={side === 'buy' ? 'active' : ''} onClick={() => setSide('buy')}>Acheter</button>
              <button className={side === 'sell' ? 'active' : ''} onClick={() => setSide('sell')}>Vendre</button>
            </div>
            <label className="amount-label">Montant en CB
              <input type="number" min="0.01" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <p className="trade-estimate">Environ <strong>{fmt(Number(amount || 0) / trade.price, 6)} {trade.ticker}</strong></p>
            <button className="trade-confirm" onClick={submitTrade}>Confirmer {side === 'buy' ? 'l’achat' : 'la vente'} <span>→</span></button>
          </section>
        </div>
      )}

      {listingToBuy && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setListingToBuy(null); }}>
          <section className="trade-modal" role="dialog" aria-modal="true" aria-labelledby="listing-purchase-title">
            <button className="modal-close" aria-label="Fermer" onClick={() => setListingToBuy(null)}>×</button>
            <h2 id="listing-purchase-title">Confirmer l’achat</h2>
            <p>{listingToBuy.title}</p>
            <p className="trade-estimate">Prix <strong>{fmt(listingToBuy.price)} CB</strong>. Le transfert est atomique côté Supabase.</p>
            <button className="trade-confirm" onClick={() => void buyListing()}>Acheter pour {fmt(listingToBuy.price)} CB</button>
          </section>
        </div>
      )}

      {reportTarget && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportTarget(null); }}>
          <section className="trade-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <button className="modal-close" aria-label="Fermer" onClick={() => setReportTarget(null)}>×</button>
            <h2 id="report-title">Signaler une annonce</h2>
            <p>{reportTarget.title}</p>
            <form className="report-form" onSubmit={submitReport}>
              <label>Motif (8 à 500 caractères)
                <textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)}
                  minLength={8} maxLength={500} required rows={4} />
              </label>
              <button className="trade-confirm">Envoyer à la modération</button>
            </form>
          </section>
        </div>
      )}

      <nav className="mobile-nav" aria-label="Navigation mobile">
        {[...navItems, ...(canViewAdmin ? [{ name: 'Admin', icon: '⚙' }] : [])].map((item) => (
          <button key={item.name} aria-current={tab === item.name ? 'page' : undefined}
            className={tab === item.name ? 'selected' : ''} onClick={() => changeTab(item.name)}>
            <span>{item.icon}</span><small>{item.name}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}

function CoinRows({ coins, onTrade }) {
  if (!coins.length) return <p className="empty-copy">Le marché est calme pour l’instant. Reviens bientôt.</p>;
  return (
    <div className="coin-list">
      {coins.map((coin) => (
        <article className="coin-row" key={coin.ticker}>
          <span className="coin-icon">{coin.icon || '◈'}</span>
          <span className="coin-identity">
            <span><strong>{coin.name}</strong><small>{coin.ticker} · {coin.rarity || 'Coin'}</small></span>
          </span>
          <span className="coin-price">
            <strong>{fmt(coin.price, coin.price < 1 ? 4 : 2)} CB</strong>
            <small className={coin.change >= 0 ? 'up' : 'down'}>{coin.change >= 0 ? '+' : ''}{fmt(coin.change)}%</small>
          </span>
          <button className="row-trade" onClick={() => onTrade(coin)}>Trader</button>
        </article>
      ))}
    </div>
  );
}
