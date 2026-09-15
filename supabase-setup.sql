-- Execute uma única vez no SQL Editor do Supabase.
create table if not exists public.app_state (
  id text primary key,
  jobs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, jobs)
values ('main', '[]'::jsonb)
on conflict (id) do nothing;

alter table public.app_state enable row level security;
create policy "autocheck read" on public.app_state for select using (true);
create policy "autocheck insert" on public.app_state for insert with check (id = 'main');
create policy "autocheck update" on public.app_state for update using (id = 'main') with check (id = 'main');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checklists', 'checklists', true, 20971520, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public=true, file_size_limit=20971520;

create policy "autocheck upload" on storage.objects for insert with check (bucket_id = 'checklists');
create policy "autocheck read files" on storage.objects for select using (bucket_id = 'checklists');

alter publication supabase_realtime add table public.app_state;
