import { useEffect, useMemo, useState } from 'react';

type Asset = { ticker: string; name: string; icon: string; color: string; initial: number; move: number };
type Game = { cash: number; holdings: Record<string, number>; trades: number; claimed: boolean };
const assets: Asset[] = [
  { ticker: 'BTC', name: 'Bitcoin', icon: '₿', color: '#f7931a', initial: 67420.8, move: 2.84 },
  { ticker: 'ETH', name: 'Ethereum', icon: '◆', color: '#8b9aff', initial: 3482.16, move: 1.26 },
  { ticker: 'SOL', name: 'Solana', icon: '≋', color: '#a78bfa', initial: 182.64, move: -0.74 },
  { ticker: 'DOGE', name: 'Dogecoin', icon: 'Ð', color: '#c2a633', initial: 0.1642, move: 5.18 },
];
const initialGame: Game = { cash: 12840, holdings: { BTC: 0.05, ETH: 0.7, SOL: 12, DOGE: 4200 }, trades: 0, claimed: false };
const fmt = (value: number, digits = 2) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0);
function readGame(): Game {
  try {
    const raw = localStorage.getItem('coinbound-demo-v2');
    if (!raw) return initialGame;
    const saved = JSON.parse(raw) as Partial<Game>;
    return { ...initialGame, ...saved, holdings: { ...initialGame.holdings, ...(saved.holdings ?? {}) } };
  } catch { return initialGame; }
}
export default function App() {
  const [game, setGame] = useState<Game>(readGame);
  const [prices, setPrices] = useState(() => Object.fromEntries(assets.map(a => [a.ticker, a.initial])) as Record<string, number>);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('100');
  const [notice, setNotice] = useState('');
  const [active, setActive] = useState('Vue générale');
  const [period, setPeriod] = useState('1S');

  useEffect(() => { try { localStorage.setItem('coinbound-demo-v2', JSON.stringify(game)); } catch { /* stockage local facultatif */ } }, [game]);
  useEffect(() => {
    const timer = window.setInterval(() => setPrices(current => Object.fromEntries(assets.map(a => [a.ticker, Math.max(a.ticker === 'DOGE' ? 0.0001 : 0.01, current[a.ticker] * (1 + (Math.random() - 0.49) * 0.002))]))), 5000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const holdingsValue = useMemo(() => assets.reduce((sum, asset) => sum + prices[asset.ticker] * (game.holdings[asset.ticker] || 0), 0), [prices, game.holdings]);
  const total = game.cash + holdingsValue;
  const tell = (text: string) => setNotice(text);
  const openTrade = (asset: Asset, action: 'buy' | 'sell' = 'buy') => { setSelected(asset); setSide(action); setAmount('100'); };
  const trade = () => {
    if (!selected) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return tell('Saisis un montant supérieur à zéro.');
    const units = value / prices[selected.ticker];
    const held = game.holdings[selected.ticker] || 0;
    if (side === 'buy' && value > game.cash) return tell('Solde virtuel insuffisant pour cet achat.');
    if (side === 'sell' && units > held) return tell('Tu ne possèdes pas assez de cet actif.');
    setGame(current => ({ ...current, cash: current.cash + (side === 'buy' ? -value : value), holdings: { ...current.holdings, [selected.ticker]: (current.holdings[selected.ticker] || 0) + (side === 'buy' ? units : -units) }, trades: current.trades + 1 }));
    setSelected(null);
    tell(`${side === 'buy' ? 'Achat' : 'Vente'} virtuel${side === 'buy' ? '' : 'le'} effectué : ${fmt(units, 6)} ${selected.ticker}.`);
  };
  const claim = () => {
    if (game.claimed) return tell('Ta récompense du jour a déjà été récupérée.');
    setGame(current => ({ ...current, cash: current.cash + 200, claimed: true }));
    tell('Récompense récupérée : +200 CB virtuels !');
  };
  const nav = ['Vue générale', 'Marché', 'Portefeuille', 'Convertir', 'Collection', 'Équipes', 'Marketplace', 'Classements'];
  const changePage = (label: string) => {
    setActive(label);
    if (label === 'Marché') document.getElementById('market')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (label === 'Portefeuille') tell(`Valeur actuelle du portefeuille : ${fmt(total)} CB fictifs.`);
    else if (label !== 'Vue générale') tell(`${label} arrive dans une prochaine mise à jour.`);
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brand-mark">↗</span>coinbound<span className="brand-dot">.</span></a>
      <div className="profile"><span className="avatar">N</span><span><b>NovaTrader</b><small>Niveau 12 · Explorateur</small></span><span className="profile-arrow">⌄</span></div>
      <div className="nav-title">MENU</div>
      <nav>{nav.map((label, index) => <button key={label} className={`nav-link ${active === label ? 'active' : ''}`} onClick={() => changePage(label)}><span className="nav-icon">{['▦', '⌁', '◉', '⇄', '⬡', '♧', '▣', '🏆'][index]}</span><span>{label}</span>{label === 'Marché' && <small className="live-tag">DÉMO</small>}</button>)}</nav>
      <div className="sidebar-fill" />
      <div className="daily-card"><span className="daily-label">RÉCOMPENSE DU JOUR</span><b>{game.claimed ? 'Déjà récupérée !' : 'Un petit bonus ?'}</b><p>{game.claimed ? 'Reviens demain pour la suite.' : 'Récupère 200 CB virtuels.'}</p><button disabled={game.claimed} onClick={claim}>{game.claimed ? '✓ Récupérée' : '＋ Récupérer · +200 CB'}</button></div>
      <p className="sidebar-foot">Coinbound · Jeu virtuel uniquement</p>
    </aside>
    <main className="main-area" id="top">
      <header className="topbar"><div className="breadcrumb">Espace de jeu <span>›</span> <b>{active}</b></div><div className="top-right"><span className="demo-chip"><i /> COURS FICTIFS</span><button className="wallet-chip" onClick={() => tell(`Solde disponible : ${fmt(game.cash)} CB virtuels.`)}><span>◉</span> {fmt(game.cash, 0)} <small>CB</small></button><span className="avatar top-avatar">N</span></div></header>
      <div className="content">
        <div className="welcome"><div><p className="eyebrow">✦ SIMULATION · AUCUNE VALEUR RÉELLE</p><h1>Le marché est à toi<span>.</span></h1><p className="subtitle">Salut Nova, prêt à faire bouger ton portefeuille ?</p></div><button className="event-button" onClick={() => tell('Les événements arrivent bientôt.')}>✧ Événements <i>2</i></button></div>
        <section className="overview-grid">
          <article className="portfolio-card"><div className="card-head"><span>VALEUR DU PORTEFEUILLE</span><span className="live"><i /> SIMULATION</span></div><strong className="total">{fmt(total)} <small>CB</small></strong><p className="portfolio-sub"><span>↗ Portefeuille virtuel</span><span>{fmt(game.cash, 0)} CB disponibles</span></p><div className="chart"><div className="chart-lines"/><svg viewBox="0 0 700 150" preserveAspectRatio="none" aria-label="Graphique de démonstration"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#52d99b" stopOpacity=".27"/><stop offset="1" stopColor="#52d99b" stopOpacity="0"/></linearGradient></defs><path d="M0 120 C50 105 55 125 100 94 S160 104 200 80 S260 90 300 66 S360 80 400 54 S460 67 500 38 S560 55 600 28 S660 35 700 9 L700 150 L0 150Z" fill="url(#fill)"/><path d="M0 120 C50 105 55 125 100 94 S160 104 200 80 S260 90 300 66 S360 80 400 54 S460 67 500 38 S560 55 600 28 S660 35 700 9" fill="none" stroke="#52d99b" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg></div><div className="chart-caption"><span>Historique fictif</span><span>Évolution locale toutes les 5 secondes</span></div></article>
          <div className="stats"><article className="stat-card"><span className="stat-symbol green">↗</span><small>ACTIFS DÉTENUS</small><b>{fmt(holdingsValue)} <em>CB</em></b><span className="stat-note">Valorisation au cours fictif</span></article><article className="stat-card"><span className="stat-symbol purple">◇</span><small>ÉCHANGES EFFECTUÉS</small><b>{game.trades} <em>{game.trades === 1 ? 'échange' : 'échanges'}</em></b><span className="stat-note">Progression de démonstration</span></article></div>
        </section>
        <section className="quick-actions"><button onClick={() => changePage('Marché')}><span className="quick-icon green">⇄</span><span><b>Trader</b><small>Acheter & vendre</small></span><span className="arrow">›</span></button><button onClick={() => changePage('Convertir')}><span className="quick-icon blue">⇄</span><span><b>Convertir</b><small>Échanger tes devises</small></span><span className="arrow">›</span></button><button onClick={() => changePage('Collection')}><span className="quick-icon purple">⬡</span><span><b>Collection</b><small>Découvrir tes cartes</small></span><span className="arrow">›</span></button><button onClick={() => changePage('Marketplace')}><span className="quick-icon orange">▣</span><span><b>Marketplace</b><small>Explorer les offres</small></span><span className="arrow">›</span></button></section>
        <section className="lower-grid"><article className="panel market-panel" id="market"><div className="section-heading"><div><div className="heading-line"><h2>Marché crypto</h2><span className="mini-tag"><i /> DÉMO</span></div><p>Cours de simulation, sans argent réel.</p></div><button className="text-button" onClick={() => tell('Tu consultes les cours de démonstration.')}>Marché démo ›</button></div><div className="table-head"><span>ACTIF</span><span>COURS FICTIF</span><span>VAR.</span><span>TENDANCE</span><span /></div>{assets.map((asset, index) => { const price = prices[asset.ticker]; const positive = asset.move >= 0; return <div className="coin-row" key={asset.ticker}><div className="coin-name"><span className="coin-icon" style={{ '--coin': asset.color } as React.CSSProperties}>{asset.icon}</span><span><b>{asset.name}</b><small>{asset.ticker}</small></span></div><b className="coin-price">{fmt(price, price < 1 ? 4 : 2)} <small>CB</small></b><span className={`variation ${positive ? 'up' : 'down'}`}>{positive ? '+' : ''}{fmt(asset.move)}%</span><svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={positive ? (index % 2 ? '0,24 16,18 31,21 48,11 62,16 79,5 100,9' : '0,23 15,18 30,20 48,11 62,15 79,5 100,3') : '0,5 16,10 32,7 48,17 64,12 82,24 100,21'} fill="none" stroke={positive ? '#68dda5' : '#f17e87'} strokeWidth="3" strokeLinecap="round"/></svg><button className="trade-button" onClick={() => openTrade(asset)} aria-label={`Acheter ou vendre ${asset.name}`}>↗</button></div>; })}</article>
          <div className="right-column"><article className="panel movers"><div className="section-heading"><div><h2>Top mouvements</h2><p>Période {period}</p></div><span className="dots">···</span></div><div className="period-tabs">{['1J', '1S', '1M', '1A'].map(item => <button key={item} className={period === item ? 'selected-period' : ''} onClick={() => setPeriod(item)}>{item}</button>)}</div>{[...assets].sort((a, b) => Math.abs(b.move) - Math.abs(a.move)).slice(0, 3).map(asset => <div className="mover" key={asset.ticker}><span className="mover-icon">{asset.move >= 0 ? '↗' : '↘'}</span><span><b>{asset.name}</b><small>{asset.ticker}</small></span><strong className={asset.move >= 0 ? 'up' : 'down'}>{asset.move >= 0 ? '+' : ''}{fmt(asset.move)}%</strong></div>)}</article>
            <article className="challenge"><span className="challenge-kicker">🏆 DÉFI DE DÉMONSTRATION</span><h3>Le premier<br />pas compte.</h3><p>Effectue ton premier échange virtuel.</p><div className="progress-label"><span>Progression</span><b>{Math.min(game.trades, 1)} / 1</b></div><div className="progress"><i style={{ width: game.trades ? '100%' : '0%' }} /></div><button onClick={() => document.getElementById('market')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Découvrir le marché ›</button></article>
          </div>
        </section>
        <footer className="disclaimer">ⓘ <span>Coinbound est une simulation locale. Cours et soldes fictifs ; aucun argent n’est échangé.</span><small>© 2026 Coinbound</small></footer>
      </div>
    </main>
    {notice && <div className="toast" role="status"><span>✦</span>{notice}<button aria-label="Fermer" onClick={() => setNotice('')}>×</button></div>}
    {selected && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-title"><button className="close-modal" onClick={() => setSelected(null)} aria-label="Fermer">×</button><div className="modal-asset"><span className="coin-icon" style={{ '--coin': selected.color } as React.CSSProperties}>{selected.icon}</span><span><h2 id="trade-title">{selected.name}</h2><small>{selected.ticker} · {fmt(prices[selected.ticker], prices[selected.ticker] < 1 ? 4 : 2)} CB fictifs</small></span></div><div className="trade-toggle"><button className={side === 'buy' ? 'buy-selected' : ''} onClick={() => setSide('buy')}>Acheter</button><button className={side === 'sell' ? 'sell-selected' : ''} onClick={() => setSide('sell')}>Vendre</button></div><label htmlFor="trade-amount">Montant en CB virtuels</label><div className="amount-field"><input id="trade-amount" type="number" min="0.01" step="any" value={amount} onChange={event => setAmount(event.target.value)} /><span>CB</span></div><div className="estimate"><span>Quantité estimée</span><b>{fmt(Number(amount || 0) / prices[selected.ticker], 6)} {selected.ticker}</b></div><p className="modal-note">Simulation uniquement. Aucun échange ni cours réel.</p><button className="confirm-trade" onClick={trade}>Confirmer {side === 'buy' ? 'l’achat' : 'la vente'} virtuelle</button></section></div>}
  </div>;
}
