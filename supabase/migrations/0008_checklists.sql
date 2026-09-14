-- =============================================================
-- EzMoney — shop checklists
--
-- Before a job he writes out the materials for each section of the work
-- and hands that list to a shop, who tick their way down it and give him
-- an invoice. Each section has a fixed set of items; the only thing that
-- changes job to job is the quantity. Some items he tells the client to
-- buy themselves.
--
-- A template and a list are the same shape, so they are one table with a
-- flag. Making a list from a template copies its rows.
-- Safe to run once.
-- =============================================================

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- true  = a reusable section template, quantities left blank
  -- false = a list he actually handed to a shop
  is_template boolean not null default false,
  client_id uuid references public.clients (id) on delete set null,
  site_job text not null default '',
  list_date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists checklists_user_idx
  on public.checklists (user_id, is_template, created_at desc);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  description text not null,
  unit text not null default 'Nos',
  qty numeric not null default 0,
  -- the client buys this one, so the shop should not supply it
  by_client boolean not null default false,
  position int not null default 0
);
create index if not exists checklist_items_list_idx
  on public.checklist_items (checklist_id, position);

alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'checklists' and policyname = 'own checklists'
  ) then
    create policy "own checklists" on public.checklists
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'checklist_items' and policyname = 'own checklist items'
  ) then
    create policy "own checklist items" on public.checklist_items
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
