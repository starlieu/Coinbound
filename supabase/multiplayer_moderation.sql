-- Run after schema.sql and multiplayer.sql.
-- Adds team membership, CB listing purchases, listing reports, and server-checked moderation.

begin;

alter table public.game_listings
  add column if not exists status text not null default 'active',
  add column if not exists buyer_id uuid references public.profiles(id) on delete set null,
  add column if not exists sold_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'game_listings_status_check'
      and conrelid = 'public.game_listings'::regclass
  ) then
    alter table public.game_listings
      add constraint game_listings_status_check check (status in ('active', 'sold', 'removed'));
  end if;
end $$;

create table if not exists public.game_team_members (
  team_id bigint not null references public.game_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

insert into public.game_team_members(team_id, user_id)
select id, owner_id from public.game_teams
on conflict (team_id, user_id) do nothing;

create table if not exists public.game_reports (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.game_listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 8 and 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  moderator_id uuid references public.profiles(id) on delete set null,
  moderator_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists game_reports_one_open_per_reporter_listing
  on public.game_reports(reporter_id, listing_id) where status = 'open';
create index if not exists game_reports_open_created_at
  on public.game_reports(created_at) where status = 'open';

create table if not exists public.moderation_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('listing_removed', 'report_dismissed', 'role_changed')),
  target_type text not null check (target_type in ('listing', 'profile')),
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.game_listings enable row level security;
alter table public.game_team_members enable row level security;
alter table public.game_reports enable row level security;
alter table public.moderation_audit enable row level security;

drop policy if exists "listings public read" on public.game_listings;
drop policy if exists "listings visible by status and role" on public.game_listings;
create policy "listings visible by status and role" on public.game_listings
  for select to authenticated
  using (
    status = 'active'
    or seller_id = auth.uid()
    or public.current_role_name() in ('Owner', 'Admin', 'Moderator')
  );

drop policy if exists "team members public read" on public.game_team_members;
create policy "team members public read" on public.game_team_members
  for select to authenticated using (true);

drop policy if exists "reporters and moderators read reports" on public.game_reports;
drop policy if exists "moderators read reports" on public.game_reports;
create policy "moderators read reports" on public.game_reports
  for select to authenticated
  using (public.current_role_name() in ('Owner', 'Admin', 'Moderator'));

drop policy if exists "admins read moderation audit" on public.moderation_audit;
create policy "admins read moderation audit" on public.moderation_audit
  for select to authenticated
  using (public.current_role_name() in ('Owner', 'Admin'));

revoke all on public.game_team_members, public.game_reports, public.moderation_audit
  from anon, authenticated;
grant select on public.game_team_members, public.game_reports, public.moderation_audit
  to authenticated;
revoke insert, update, delete on public.game_listings from anon, authenticated;
grant select on public.game_listings to authenticated;

create or replace function public.create_team(p_name text)
returns public.game_teams
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  team public.game_teams;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 40 then
    raise exception 'Nom d’équipe invalide';
  end if;

  insert into public.game_teams(owner_id, name)
  values (uid, trim(p_name))
  returning * into team;

  insert into public.game_team_members(team_id, user_id)
  values (team.id, uid);
  return team;
end $$;

revoke all on function public.create_team(text) from public, anon;
grant execute on function public.create_team(text) to authenticated;

create or replace function public.join_team(p_team_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  perform 1 from public.game_teams where id = p_team_id for update;
  if not found then raise exception 'Équipe introuvable'; end if;

  insert into public.game_team_members(team_id, user_id)
  values (p_team_id, uid)
  on conflict (team_id, user_id) do nothing;
  if not found then raise exception 'Tu fais déjà partie de cette équipe'; end if;
end $$;

revoke all on function public.join_team(bigint) from public, anon;
grant execute on function public.join_team(bigint) to authenticated;

create or replace function public.leave_team(p_team_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  team_owner uuid;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select owner_id into team_owner
  from public.game_teams where id = p_team_id for update;
  if not found then raise exception 'Équipe introuvable'; end if;
  if team_owner = uid then raise exception 'Le créateur ne peut pas quitter son équipe'; end if;

  delete from public.game_team_members
  where team_id = p_team_id and user_id = uid;
  if not found then raise exception 'Tu ne fais pas partie de cette équipe'; end if;
end $$;

revoke all on function public.leave_team(bigint) from public, anon;
grant execute on function public.leave_team(bigint) to authenticated;

create or replace function public.purchase_listing(p_listing_id bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  listing public.game_listings%rowtype;
  buyer_cash numeric;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into listing
  from public.game_listings where id = p_listing_id for update;
  if not found or listing.status <> 'active' then
    raise exception 'Cette annonce n’est plus disponible';
  end if;
  if listing.seller_id = uid then raise exception 'Tu ne peux pas acheter ta propre annonce'; end if;

  perform 1 from public.profiles
  where id in (uid, listing.seller_id)
  order by id
  for update;
  select cash into buyer_cash from public.profiles where id = uid;
  if buyer_cash is null then raise exception 'Profil introuvable'; end if;
  if buyer_cash < listing.price then raise exception 'Solde CB insuffisant'; end if;

  update public.profiles set cash = cash - listing.price where id = uid;
  update public.profiles set cash = cash + listing.price where id = listing.seller_id;
  update public.game_listings
  set status = 'sold', buyer_id = uid, sold_at = now()
  where id = listing.id;

  return jsonb_build_object('listing_id', listing.id, 'price', listing.price, 'status', 'sold');
end $$;

revoke all on function public.purchase_listing(bigint) from public, anon;
grant execute on function public.purchase_listing(bigint) to authenticated;

create or replace function public.report_listing(p_listing_id bigint, p_reason text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  report_id bigint;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_reason is null or char_length(trim(p_reason)) not between 8 and 500 then
    raise exception 'Le signalement doit contenir entre 8 et 500 caractères';
  end if;
  perform 1 from public.game_listings
  where id = p_listing_id and status = 'active' and seller_id <> uid;
  if not found then raise exception 'Annonce introuvable ou non signalable'; end if;

  begin
    insert into public.game_reports(listing_id, reporter_id, reason)
    values (p_listing_id, uid, trim(p_reason))
    returning id into report_id;
  exception when unique_violation then
    raise exception 'Tu as déjà signalé cette annonce';
  end;
  return report_id;
end $$;

revoke all on function public.report_listing(bigint, text) from public, anon;
grant execute on function public.report_listing(bigint, text) to authenticated;

create or replace function public.moderate_game_report(
  p_report_id bigint,
  p_action text,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  actor_role public.app_role;
  report public.game_reports%rowtype;
begin
  actor_role := public.current_role_name();
  if uid is null or actor_role is null or actor_role not in ('Owner', 'Admin', 'Moderator') then
    raise exception 'Accès refusé';
  end if;
  if p_action is null or p_action not in ('remove_listing', 'dismiss') then
    raise exception 'Action de modération invalide';
  end if;
  if p_note is not null and char_length(trim(p_note)) > 500 then
    raise exception 'La note de modération est limitée à 500 caractères';
  end if;

  select * into report
  from public.game_reports where id = p_report_id for update;
  if not found or report.status <> 'open' then
    raise exception 'Ce signalement n’est plus ouvert';
  end if;

  if p_action = 'remove_listing' then
    update public.game_listings set status = 'removed'
    where id = report.listing_id and status = 'active';
    if not found then raise exception 'Cette annonce n’est plus active'; end if;
    update public.game_reports
    set status = 'resolved', moderator_id = uid,
        moderator_note = nullif(trim(p_note), ''), resolved_at = now()
    where id = report.id;
    insert into public.moderation_audit(actor_id, action, target_type, target_id, details)
    values (uid, 'listing_removed', 'listing', report.listing_id::text,
      jsonb_build_object('report_id', report.id, 'note', nullif(trim(p_note), '')));
  else
    update public.game_reports
    set status = 'dismissed', moderator_id = uid,
        moderator_note = nullif(trim(p_note), ''), resolved_at = now()
    where id = report.id;
    insert into public.moderation_audit(actor_id, action, target_type, target_id, details)
    values (uid, 'report_dismissed', 'listing', report.listing_id::text,
      jsonb_build_object('report_id', report.id, 'note', nullif(trim(p_note), '')));
  end if;
end $$;

revoke all on function public.moderate_game_report(bigint, text, text) from public, anon;
grant execute on function public.moderate_game_report(bigint, text, text) to authenticated;

create or replace function public.set_profile_role(p_user_id uuid, p_role public.app_role)
returns public.app_role
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  actor_role public.app_role;
  old_role public.app_role;
begin
  actor_role := public.current_role_name();
  if uid is null or actor_role is null or actor_role not in ('Owner', 'Admin') then
    raise exception 'Accès refusé';
  end if;
  if p_user_id = uid then raise exception 'Tu ne peux pas modifier ton propre rôle'; end if;
  if p_role is null or p_role = 'Owner' then
    raise exception 'Ce rôle ne peut pas être attribué depuis l’interface';
  end if;

  select role into old_role from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Profil introuvable'; end if;
  if old_role = 'Owner' then raise exception 'Le rôle Owner est protégé'; end if;
  if actor_role = 'Admin'
     and (old_role in ('Owner', 'Admin') or p_role in ('Owner', 'Admin')) then
    raise exception 'Un Admin ne peut gérer que les rôles Developer, Moderator et Player';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  insert into public.moderation_audit(actor_id, action, target_type, target_id, details)
  values (uid, 'role_changed', 'profile', p_user_id::text,
    jsonb_build_object('from', old_role, 'to', p_role));
  return p_role;
end $$;

revoke all on function public.set_profile_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_profile_role(uuid, public.app_role) to authenticated;

commit;
