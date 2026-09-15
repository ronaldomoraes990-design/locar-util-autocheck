-- LOCAR ÚTIL AUTOCHECK
-- Configuração do banco e armazenamento para uso compartilhado.
-- Execute este arquivo no SQL Editor do projeto Supabase.

create table if not exists public.app_state (
  id text primary key,
  jobs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, jobs)
values ('main', '[]'::jsonb)
on conflict (id) do nothing;

alter table public.app_state enable row level security;

drop policy if exists "AutoCheck leitura compartilhada" on public.app_state;
create policy "AutoCheck leitura compartilhada"
on public.app_state
for select
to anon, authenticated
using (true);

drop policy if exists "AutoCheck gravação compartilhada" on public.app_state;
create policy "AutoCheck gravação compartilhada"
on public.app_state
for insert
to anon, authenticated
with check (id = 'main');

drop policy if exists "AutoCheck atualização compartilhada" on public.app_state;
create policy "AutoCheck atualização compartilhada"
on public.app_state
for update
to anon, authenticated
using (id = 'main')
with check (id = 'main');

-- Bucket usado pelos checklists e fotos de avarias.
insert into storage.buckets (id, name, public)
values ('checklists', 'checklists', true)
on conflict (id) do update set public = true;

drop policy if exists "AutoCheck upload de arquivos" on storage.objects;
create policy "AutoCheck upload de arquivos"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'checklists');

drop policy if exists "AutoCheck leitura de arquivos" on storage.objects;
create policy "AutoCheck leitura de arquivos"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'checklists');

-- Habilita sincronização em tempo real da tabela.
do $$
begin
  begin
    alter publication supabase_realtime add table public.app_state;
  exception
    when duplicate_object then null;
  end;
end $$;

-- Resultado esperado:
-- 1) app_state criada com o registro id='main';
-- 2) até 30 celulares/computadores podem acessar o mesmo estado do app;
-- 3) novos chamados e alterações aparecem em tempo real;
-- 4) fotos/PDFs ficam no bucket checklists.
--
-- IMPORTANTE: estas políticas permitem acesso anônimo a quem possuir o link.
-- Para operação com dados mais restritos, a próxima etapa é adicionar login
-- individual para os 30 usuários e substituir as políticas anon por authenticated.
