-- Xpense: the synced copy of every account's data.
--
-- Paste this whole file into Supabase → SQL Editor → New query, and press Run. It is safe to run again.
--
-- One table holds everything an account syncs (entries, receipts and their lines, repeating bills and
-- paychecks, settings) as JSON, one row per record. Row-level security means a signed-in person can only
-- ever read or change their own rows. Deleting an account (Settings → Delete account in the app) deletes
-- the sign-in, and with it every row here (on delete cascade).

create table if not exists public.records (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('setting', 'recurring', 'receipt', 'receipt_item', 'transaction')),
  id text not null check (char_length(id) between 1 and 200),
  data jsonb check (data is null or pg_column_size(data) < 32000),
  deleted boolean not null default false,
  -- When the person made the change, on their device. The newest change wins.
  updated_at timestamptz not null,
  -- When the server got it. Devices ask for "everything since" this.
  synced_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

create index if not exists records_user_synced on public.records (user_id, synced_at);

alter table public.records enable row level security;

drop policy if exists "Read own records" on public.records;
create policy "Read own records" on public.records
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own records" on public.records;
create policy "Add own records" on public.records
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Change own records" on public.records;
create policy "Change own records" on public.records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- No delete policy on purpose: devices delete by marking a record deleted, so other devices hear about it.

-- Stamps the server time on every write, ignores an older change that arrives after a newer one,
-- and drops the data of deleted records.
create or replace function public.records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.synced_at := clock_timestamp();
  if new.deleted then
    new.data := null;
  end if;
  return new;
end;
$$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write
  before insert or update on public.records
  for each row execute function public.records_before_write();
