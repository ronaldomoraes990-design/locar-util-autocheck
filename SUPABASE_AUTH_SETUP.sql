-- LOCAR UTIL AUTOCHECK - AUTENTICACAO E ACESSOS
-- Execute uma vez no SQL Editor do Supabase.
-- As contas/senhas sao criadas em Authentication > Users.

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  perfil text not null default 'usuario' check (perfil in ('admin','usuario')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.app_users enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.app_users where id = auth.uid() and perfil = 'admin' and ativo = true); $$;

drop policy if exists "usuarios veem proprio perfil" on public.app_users;
drop policy if exists "admin insere usuarios" on public.app_users;
drop policy if exists "admin altera usuarios" on public.app_users;
create policy "usuarios veem proprio perfil" on public.app_users for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "admin insere usuarios" on public.app_users for insert to authenticated with check (public.is_admin());
create policy "admin altera usuarios" on public.app_users for update to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.app_state enable row level security;
drop policy if exists "anon select app_state" on public.app_state;
drop policy if exists "anon insert app_state" on public.app_state;
drop policy if exists "anon update app_state" on public.app_state;
drop policy if exists "usuarios autenticados leem app_state" on public.app_state;
drop policy if exists "usuarios autenticados criam app_state" on public.app_state;
drop policy if exists "usuarios autenticados atualizam app_state" on public.app_state;
create policy "usuarios autenticados leem app_state" on public.app_state for select to authenticated using (true);
create policy "usuarios autenticados criam app_state" on public.app_state for insert to authenticated with check (true);
create policy "usuarios autenticados atualizam app_state" on public.app_state for update to authenticated using (true) with check (true);

-- Permissoes do armazenamento. O app grava arquivos no bucket checklists.
drop policy if exists "autocheck storage insert" on storage.objects;
drop policy if exists "autocheck storage select" on storage.objects;
create policy "autocheck storage insert" on storage.objects for insert to authenticated with check (bucket_id = 'checklists');
create policy "autocheck storage select" on storage.objects for select to authenticated using (bucket_id = 'checklists');

-- Realtime idempotente.
do $$ begin
  alter publication supabase_realtime add table public.app_state;
exception when duplicate_object then null;
end $$;

-- ADMIN:
-- 1) Authentication > Users > Add user.
-- 2) Crie email e senha do administrador no proprio Supabase.
-- 3) Copie o UUID e execute:
-- insert into public.app_users (id, nome, perfil) values ('UUID-DO-ADMIN','Administrador','admin');

-- USUARIOS:
-- Para cada colaborador, crie a conta em Authentication > Users e execute:
-- insert into public.app_users (id, nome, perfil) values ('UUID','Nome do usuario','usuario');
