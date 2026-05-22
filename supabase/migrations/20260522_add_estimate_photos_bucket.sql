-- estimate-photos バケット: 共有URLから閲覧する物件写真の公開ホスティング
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'estimate-photos',
  'estimate-photos',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 匿名・認証ユーザーともにアップロードを許可（仲介担当者は未ログインで使うケースもあるため）
drop policy if exists "estimate_photos_anon_insert" on storage.objects;
create policy "estimate_photos_anon_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'estimate-photos');

-- public bucket なので閲覧は暗黙に可能だが、明示しておく
drop policy if exists "estimate_photos_anon_select" on storage.objects;
create policy "estimate_photos_anon_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'estimate-photos');
