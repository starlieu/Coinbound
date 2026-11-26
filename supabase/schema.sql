-- À exécuter dans Supabase : SQL Editor > New query > Run.
-- Crée les profils, les rôles vérifiés côté serveur et les règles RLS.

create type public.app_role as enum ('Owner','Developer','Admin','Moderator','Player');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 20),
  role public.app_role not null default 'Player',
  cash numeric not null default 10000,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Fonction utilitaire : rôle de l'utilisateur courant (security definer évite la récursion RLS).
create or replace function public.current_role_name() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Tout le monde (connecté) peut lire les profils (classement).
create policy "profiles lisibles" on public.profiles for select to authenticated using (true);

-- Un utilisateur modifie son propre profil, mais PAS son rôle.
create policy "maj de son profil" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role_name());

-- Owner et Admin peuvent changer les rôles (seul Owner peut toucher Owner/Admin).
create policy "admin gere roles" on public.profiles for update to authenticated
  using (public.current_role_name() in ('Owner','Admin'))
  with check (
    public.current_role_name() = 'Owner'
    or (public.current_role_name() = 'Admin' and role in ('Developer','Moderator','Player'))
  );

-- Création automatique du profil à l'inscription (invités compris).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), 'Joueur' || substr(new.id::text,1,6)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pour te nommer Owner (remplace l'email par le tien, après ta première connexion) :
-- update public.profiles set role = 'Owner'
--   where id = (select id from auth.users where email = 'ton@email.com');
