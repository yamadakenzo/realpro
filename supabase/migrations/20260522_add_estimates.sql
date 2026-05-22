-- 見積もり共有テーブル
-- URL: /estimate/{slug} で閲覧する保存済み見積もりを格納する

create table if not exists public.estimates (
  id          uuid          primary key default gen_random_uuid(),
  slug        text          not null unique,
  data        jsonb         not null,
  created_at  timestamptz   not null default now(),
  expires_at  timestamptz
);

create index if not exists estimates_slug_idx       on public.estimates (slug);
create index if not exists estimates_expires_at_idx on public.estimates (expires_at);

-- 公開リンクから閲覧する想定なので RLS を有効化したうえで anon にも select / insert を許可
alter table public.estimates enable row level security;

drop policy if exists "estimates_anon_insert" on public.estimates;
create policy "estimates_anon_insert"
  on public.estimates
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "estimates_anon_select" on public.estimates;
create policy "estimates_anon_select"
  on public.estimates
  for select
  to anon, authenticated
  using (expires_at is null or expires_at > now());
