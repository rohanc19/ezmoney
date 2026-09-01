-- =============================================================
-- EzMoney — initial schema
-- Billing & invoicing for a self-employed electrician (India).
-- Single user for now, but every table carries user_id so
-- multi-user works later without a rewrite. RLS on everything.
-- =============================================================

-- ---------- business profile (one row per user) ----------
create table public.business_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default '',
  proprietor_name text not null default '',
  address text not null default '',
  city_pin text not null default '',
  phone text not null default '',
  email text not null default '',
  gstin text,
  gst_enabled boolean not null default false,
  gst_rate numeric not null default 0.18,
  bank_name text not null default '',
  account_no text not null default '',
  ifsc text not null default '',
  upi_id text not null default '',
  payment_terms text not null default 'Payment due within 7 days of invoice date.',
  estimate_validity_note text not null default 'This estimate is valid for 30 days.',
  logo_url text,
  -- 'calendar' (Jan–Dec) or 'fiscal' (Apr–Mar). Controls the year in
  -- serial numbers like EST-2026-001. Fiscal uses the FY start year.
  serial_year_basis text not null default 'calendar'
    check (serial_year_basis in ('calendar', 'fiscal')),
  created_at timestamptz not null default now()
);

-- ---------- clients ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index clients_user_idx on public.clients (user_id);

-- ---------- documents (estimates + invoices) ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('estimate', 'invoice')),
  serial_no text not null,
  doc_date date not null default current_date,
  client_id uuid references public.clients (id) on delete set null,
  site_job text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'rejected', 'paid')),
  linked_estimate_id uuid references public.documents (id) on delete set null,
  subtotal numeric not null default 0,
  gst_amount numeric not null default 0,
  total numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, serial_no)
);
create index documents_user_idx on public.documents (user_id, type, doc_date desc);

-- ---------- line items ----------
create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  position int not null default 0,
  description text not null,
  qty numeric not null default 1,
  unit text not null default 'Nos',
  rate numeric not null default 0,
  amount numeric not null default 0
);
create index line_items_doc_idx on public.line_items (document_id);

-- ---------- expenses ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default current_date,
  category text not null default 'Materials'
    check (category in ('Materials','Tools','Transport','Labour','Fuel','Consumables','Rent','Misc')),
  item text not null,
  vendor text not null default '',
  amount numeric not null default 0,
  client_id uuid references public.clients (id) on delete set null,
  paid_via text not null default 'Cash'
    check (paid_via in ('Cash','UPI','Card','Bank','Credit')),
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index expenses_user_idx on public.expenses (user_id, date desc);

-- ---------- serial-number counters ----------
-- One counter row per (user, doc type, year). The atomic upsert below
-- guarantees two quick creates can never get the same number.
create table public.doc_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  doc_type text not null check (doc_type in ('estimate', 'invoice')),
  year_key text not null,
  last_seq int not null default 0,
  primary key (user_id, doc_type, year_key)
);

-- next_serial('estimate') → 'EST-2026-001', next_serial('invoice') → 'INV-2026-001'
-- Sequence is per type, per year, per user. Year basis comes from the
-- profile: calendar (default) or Indian fiscal year (Apr–Mar, labelled
-- by its start year — so 15-Feb-2027 falls in FY 2026).
create or replace function public.next_serial(p_type text)
returns text
language plpgsql
security invoker
as $$
declare
  v_basis text;
  v_year int;
  v_seq int;
  v_prefix text;
  v_today date := current_date;
begin
  if p_type not in ('estimate', 'invoice') then
    raise exception 'unknown document type %', p_type;
  end if;

  select coalesce(serial_year_basis, 'calendar') into v_basis
  from public.business_profile where user_id = auth.uid();

  if v_basis = 'fiscal' and extract(month from v_today) < 4 then
    v_year := extract(year from v_today)::int - 1;
  else
    v_year := extract(year from v_today)::int;
  end if;

  insert into public.doc_counters (user_id, doc_type, year_key, last_seq)
  values (auth.uid(), p_type, v_year::text, 1)
  on conflict (user_id, doc_type, year_key)
  do update set last_seq = public.doc_counters.last_seq + 1
  returning last_seq into v_seq;

  v_prefix := case when p_type = 'estimate' then 'EST' else 'INV' end;
  return v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- =============================================================
-- Row Level Security: a user sees only their own rows.
-- =============================================================
alter table public.business_profile enable row level security;
alter table public.clients enable row level security;
alter table public.documents enable row level security;
alter table public.line_items enable row level security;
alter table public.expenses enable row level security;
alter table public.doc_counters enable row level security;

create policy "own profile" on public.business_profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own clients" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own documents" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own line items" on public.line_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own expenses" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own counters" on public.doc_counters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================
-- Future GST expansion (v2, behind the same gst_enabled toggle):
--   business_profile: + place_of_supply, state_code
--   documents:        + cgst_amount, sgst_amount, igst_amount, place_of_supply
--   line_items:       + hsn_sac text, per-line gst_rate
-- Nothing above needs reworking — these are additive columns.
-- =============================================================
