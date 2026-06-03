-- My Vocab Lab cloud sync schema
-- Run this in Supabase SQL Editor.

create table if not exists public.user_vocab_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  custom_words jsonb not null default '[]'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.user_vocab_data enable row level security;

drop policy if exists "Users can read own vocab data" on public.user_vocab_data;
drop policy if exists "Users can insert own vocab data" on public.user_vocab_data;
drop policy if exists "Users can update own vocab data" on public.user_vocab_data;
drop policy if exists "Users can delete own vocab data" on public.user_vocab_data;

create policy "Users can read own vocab data"
  on public.user_vocab_data
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own vocab data"
  on public.user_vocab_data
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own vocab data"
  on public.user_vocab_data
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own vocab data"
  on public.user_vocab_data
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_user_vocab_data_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_user_vocab_data_updated_at on public.user_vocab_data;

create trigger set_user_vocab_data_updated_at
  before update on public.user_vocab_data
  for each row
  execute function public.set_user_vocab_data_updated_at();
