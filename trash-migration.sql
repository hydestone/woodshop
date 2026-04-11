-- Recycling Bin — Run in Supabase SQL Editor BEFORE deploying
--
-- Creates a trash table for soft-deleted items.
-- Items auto-purge after 30 days (handled in app code on load).

create table if not exists trash (
  id text primary key,
  item_type text not null,
  item_data jsonb not null,
  deleted_at timestamptz not null default now(),
  user_id uuid not null
);

-- RLS: users see only their own trash
alter table trash enable row level security;

create policy "auth_trash_select"
  on trash for select
  to authenticated
  using (user_id = auth.uid());

create policy "auth_trash_insert"
  on trash for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "auth_trash_delete"
  on trash for delete
  to authenticated
  using (user_id = auth.uid());
