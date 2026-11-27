-- Exécuter dans Supabase : SQL Editor > New query > Run.
-- Schéma d'authentification. Puis exécuter multiplayer.sql et multiplayer_moderation.sql.
create type public.app_role as enum ('Owner','Developer','Admin','Moderator','Player');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 20),
  role public.app_role not null default 'Player',
  cash numeric not null default 10000 check(cash>=0),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create or replace function public.current_role_name() returns public.app_role
language sql stable security definer set search_path = public as $$ select role from public.profiles where id=auth.uid() $$;
create policy "profiles lisibles" on public.profiles for select to authenticated using (true);
-- Le joueur peut seulement changer son pseudo. Le solde et le rôle sont uniquement modifiés via RPCs maîtrisées.
create policy "maj de son profil" on public.profiles for update to authenticated
  using (id=auth.uid()) with check (id=auth.uid() and role=public.current_role_name() and cash=(select p.cash from public.profiles p where p.id=auth.uid()));
create policy "admin gere roles" on public.profiles for update to authenticated
  using (public.current_role_name() in ('Owner','Admin'))
  with check (public.current_role_name()='Owner' or (public.current_role_name()='Admin' and role in ('Developer','Moderator','Player')));
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
 insert into public.profiles(id,username,role,cash) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'username'),20),''),'Joueur'||substr(new.id::text,1,6)),'Player',10000);
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Après ta première connexion, remplacer l'email puis exécuter une seule fois pour devenir Owner :
-- update public.profiles set role='Owner' where id=(select id from auth.users where email='ton@email.com');
