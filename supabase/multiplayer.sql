-- Exécuter dans Supabase SQL Editor après schema.sql.
-- Le client public ne peut pas altérer soldes/cours : toutes les mutations passent par RPC.
create table if not exists public.market_coins (
  ticker text primary key check (ticker ~ '^[A-Z0-9]{2,8}$'), name text not null,
  price numeric not null check (price > 0), icon text not null default '◈',
  rarity text not null default 'Commune', change numeric not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.holdings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticker text not null references public.market_coins(ticker), amount numeric not null default 0 check (amount >= 0),
  primary key(user_id,ticker)
);
create table if not exists public.trades (
  id bigint generated always as identity primary key, user_id uuid not null references public.profiles(id),
  ticker text not null references public.market_coins(ticker), side text not null check(side in ('buy','sell')),
  amount_cb numeric not null check(amount_cb > 0), units numeric not null check(units > 0), price numeric not null,
  created_at timestamptz not null default now()
);
create table if not exists public.game_events (
  id bigint generated always as identity primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('daily_reward','card_purchase','team_create','listing_create','badge_create')),
  payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.game_teams (
  id bigint generated always as identity primary key, owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 40), created_at timestamptz not null default now()
);
create table if not exists public.game_listings (
  id bigint generated always as identity primary key, seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, price numeric not null check(price > 0), created_at timestamptz not null default now()
);
create table if not exists public.game_badges (
  id bigint generated always as identity primary key, name text not null, icon text not null default '✦',
  color text not null default '#6ee7ad', role public.app_role not null, created_at timestamptz not null default now()
);
create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id bigint not null references public.game_badges(id) on delete cascade,
  primary key(user_id,badge_id)
);

insert into public.market_coins(ticker,name,price,icon,rarity) values
('BTC','Bitcoin',67420,'₿','Légendaire'),('ETH','Ethereum',3482,'◆','Épique'),
('SOL','Solana',182,'≋','Rare'),('DOGE','Dogecoin',0.164,'Ð','Commune'),
('AVAX','Avalanche',36.8,'▲','Rare'),('ADA','Cardano',0.45,'◉','Commune')
on conflict(ticker) do nothing;

alter table public.market_coins enable row level security;
alter table public.holdings enable row level security;
alter table public.trades enable row level security;
alter table public.game_events enable row level security;
alter table public.game_teams enable row level security;
alter table public.game_listings enable row level security;
alter table public.game_badges enable row level security;
alter table public.user_badges enable row level security;
create policy "market public read" on public.market_coins for select to authenticated using(true);
create policy "holdings public leaderboard read" on public.holdings for select to authenticated using(true);
create policy "trade history public read" on public.trades for select to authenticated using(true);
create policy "teams public read" on public.game_teams for select to authenticated using(true);
create policy "listings public read" on public.game_listings for select to authenticated using(true);
create policy "badges public read" on public.game_badges for select to authenticated using(true);
create policy "user badges public read" on public.user_badges for select to authenticated using(true);
-- Interdit toute écriture directe, incluant les soldes profils. La fonction RPC réalise les transactions.
revoke insert,update,delete on public.market_coins,public.holdings,public.trades,public.game_events,public.game_teams,public.game_listings,public.game_badges,public.user_badges from anon,authenticated;
revoke update(cash,role) on public.profiles from authenticated;

grant select on public.market_coins,public.holdings,public.trades,public.game_teams,public.game_listings,public.game_badges,public.user_badges to authenticated;
grant select,update(username) on public.profiles to authenticated;

create or replace function public.execute_trade(p_ticker text,p_side text,p_amount_cb numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); c public.market_coins%rowtype; cash_now numeric; units_now numeric; holding_now numeric;
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 if p_amount_cb is null or p_amount_cb<=0 or p_side not in ('buy','sell') then raise exception 'Ordre invalide'; end if;
 select * into c from public.market_coins where ticker=p_ticker for update;
 if not found then raise exception 'Coin introuvable'; end if;
 select cash into cash_now from public.profiles where id=uid for update;
 select amount into holding_now from public.holdings where user_id=uid and ticker=p_ticker for update;
 holding_now:=coalesce(holding_now,0); units_now:=p_amount_cb/c.price;
 if p_side='buy' then
   if cash_now<p_amount_cb then raise exception 'Solde CB insuffisant'; end if;
   update public.profiles set cash=cash-p_amount_cb where id=uid;
   insert into public.holdings(user_id,ticker,amount) values(uid,p_ticker,units_now)
   on conflict(user_id,ticker) do update set amount=public.holdings.amount+excluded.amount;
 else
   if holding_now<units_now then raise exception 'Actifs insuffisants'; end if;
   update public.profiles set cash=cash+p_amount_cb where id=uid;
   update public.holdings set amount=amount-units_now where user_id=uid and ticker=p_ticker;
 end if;
 insert into public.trades(user_id,ticker,side,amount_cb,units,price) values(uid,p_ticker,p_side,p_amount_cb,units_now,c.price);
 return jsonb_build_object('cash',(select cash from public.profiles where id=uid),'ticker',p_ticker,'units',units_now);
end $$;
revoke all on function public.execute_trade(text,text,numeric) from public;
grant execute on function public.execute_trade(text,text,numeric) to authenticated;

create or replace function public.create_coin(p_name text,p_ticker text,p_price numeric)
returns public.market_coins language plpgsql security definer set search_path=public as $$
declare c public.market_coins;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if char_length(trim(p_name)) not between 1 and 32 or p_ticker !~ '^[A-Z0-9]{2,8}$' or p_price<=0 then raise exception 'Coin invalide'; end if;
 insert into public.market_coins(ticker,name,price,icon,rarity) values(p_ticker,trim(p_name),p_price,'✨','Commune') returning * into c;
 return c;
end $$;
revoke all on function public.create_coin(text,text,numeric) from public;
grant execute on function public.create_coin(text,text,numeric) to authenticated;

create or replace function public.claim_daily_reward()
returns numeric language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); last_claim date; new_cash numeric;
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 perform 1 from public.profiles where id=uid for update;
 select max((payload->>'day')::date) into last_claim from public.game_events where user_id=uid and kind='daily_reward';
 if last_claim=current_date then raise exception 'Récompense déjà récupérée'; end if;
 update public.profiles set cash=cash+200 where id=uid returning cash into new_cash;
 insert into public.game_events(user_id,kind,payload) values(uid,'daily_reward',jsonb_build_object('day',current_date));
 return new_cash;
end $$;
revoke all on function public.claim_daily_reward() from public;
grant execute on function public.claim_daily_reward() to authenticated;

create or replace function public.create_team(p_name text)
returns public.game_teams language plpgsql security definer set search_path=public as $$
declare t public.game_teams;
begin
 if auth.uid() is null or char_length(trim(p_name)) not between 1 and 40 then raise exception 'Nom invalide'; end if;
 insert into public.game_teams(owner_id,name) values(auth.uid(),trim(p_name)) returning * into t; return t;
end $$;
revoke all on function public.create_team(text) from public;
grant execute on function public.create_team(text) to authenticated;

create or replace function public.create_listing(p_title text,p_price numeric)
returns public.game_listings language plpgsql security definer set search_path=public as $$
declare l public.game_listings;
begin
 if auth.uid() is null or char_length(trim(p_title)) not between 1 and 80 or p_price<=0 then raise exception 'Annonce invalide'; end if;
 insert into public.game_listings(seller_id,title,price) values(auth.uid(),trim(p_title),p_price) returning * into l; return l;
end $$;
revoke all on function public.create_listing(text,numeric) from public;
grant execute on function public.create_listing(text,numeric) to authenticated;

create or replace function public.update_market_prices()
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.current_role_name() not in ('Owner','Developer') then raise exception 'Accès refusé'; end if;
 update public.market_coins set price=greatest(0.0001,price*(1+(random()-0.5)*0.006)),change=change+(random()-0.5)*0.6,updated_at=now();
end $$;
revoke all on function public.update_market_prices() from public;
grant execute on function public.update_market_prices() to authenticated;
