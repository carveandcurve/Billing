-- ============================================================================
-- 001_schema.sql
-- Carve & Curve — Supabase schema (Phase 1: tables only, no data touched)
-- Safe to run on a fresh project. Every statement is CREATE ... IF NOT EXISTS
-- or CREATE OR REPLACE — nothing here drops or deletes anything.
-- ============================================================================

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Business + membership
-- ----------------------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Carve & Curve',
  created_at timestamptz not null default now()
);

-- One row per (user, business). Lets you add staff logins later just by
-- inserting a row here — no schema change needed.
create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Settings (1:1 with a business) — mirrors DEFAULT_SETTINGS in script.js
-- ----------------------------------------------------------------------------
create table if not exists public.settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  business_name text not null default 'Carve & Curve',
  tagline text not null default '',
  address text not null default '',
  state text not null default 'Tamil Nadu',
  phone text not null default '',
  email text not null default '',
  instagram text not null default '',
  gstin text not null default '',

  quotation_prefix text not null default 'CC-QT-',
  next_quotation_number int not null default 1,
  default_validity_days int not null default 15,
  default_terms text not null default '',

  invoice_prefix text not null default 'CC-INV-',
  next_invoice_number int not null default 1,
  default_invoice_due_days int not null default 7,
  default_invoice_terms text not null default '',

  po_prefix text not null default 'CC-PO-',
  next_po_number int not null default 1,
  default_po_terms text not null default '',

  dc_prefix text not null default 'CC-DC-',
  next_dc_number int not null default 1,
  default_dc_terms text not null default '',

  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Master data
-- ----------------------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text not null default '',
  unit text not null default 'unit',
  hsn text not null default '',
  rate numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  pricing_mode text not null default 'flat' check (pricing_mode in ('flat','sqft')),
  common_sizes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists items_business_name_uidx
  on public.items (business_id, lower(name));

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  company text not null default '',
  phone text not null default '',
  email text not null default '',
  state text not null default 'Tamil Nadu',
  address text not null default '',
  ship_address text not null default '',
  gstin text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  company text not null default '',
  phone text not null default '',
  email text not null default '',
  state text not null default 'Tamil Nadu',
  address text not null default '',
  gstin text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Quotations
-- ----------------------------------------------------------------------------
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  number text not null,
  date date not null default current_date,
  valid_until date,
  client_id uuid references public.clients(id) on delete set null,
  reference text not null default '',
  subject text not null default '',
  tax_type text not null default 'intra' check (tax_type in ('intra','inter')),
  notes text not null default '',
  terms text not null default '',
  status text not null default 'Draft'
    check (status in ('Draft','Sent','Accepted','Declined','Expired')),
  adjustment numeric(14,2) not null default 0,
  -- Server-recalculated totals (never trust client-submitted totals)
  sub_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, number)
);

create table if not exists public.quotation_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  name text not null default '',
  description text not null default '',
  hsn text not null default '',
  qty numeric(14,3) not null default 0,
  unit text not null default 'unit',
  rate numeric(14,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  pricing_mode text not null default 'flat' check (pricing_mode in ('flat','sqft')),
  width_ft numeric(10,3) not null default 0,
  height_ft numeric(10,3) not null default 0,
  sort_order int not null default 0
);

-- ----------------------------------------------------------------------------
-- Invoices
-- ----------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  number text not null,
  date date not null default current_date,
  due_date date,
  client_id uuid references public.clients(id) on delete set null,
  reference text not null default '',
  subject text not null default '',
  tax_type text not null default 'intra' check (tax_type in ('intra','inter')),
  notes text not null default '',
  terms text not null default '',
  status text not null default 'Draft' check (status in ('Draft','Sent','Cancelled')),
  adjustment numeric(14,2) not null default 0,
  quotation_id uuid references public.quotations(id) on delete set null,
  sub_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, number)
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  name text not null default '',
  description text not null default '',
  hsn text not null default '',
  qty numeric(14,3) not null default 0,
  unit text not null default 'unit',
  rate numeric(14,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  pricing_mode text not null default 'flat' check (pricing_mode in ('flat','sqft')),
  width_ft numeric(10,3) not null default 0,
  height_ft numeric(10,3) not null default 0,
  sort_order int not null default 0
);

-- Payments — now a real table (was embedded array in the JSON blob design)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  method text not null default 'UPI',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Purchase Orders
-- ----------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  number text not null,
  date date not null default current_date,
  expected_date date,
  vendor_id uuid references public.vendors(id) on delete set null,
  reference text not null default '',
  subject text not null default '',
  tax_type text not null default 'intra' check (tax_type in ('intra','inter')),
  notes text not null default '',
  terms text not null default '',
  status text not null default 'Draft'
    check (status in ('Draft','Sent','Received','Cancelled')),
  adjustment numeric(14,2) not null default 0,
  sub_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, number)
);

create table if not exists public.po_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  name text not null default '',
  description text not null default '',
  hsn text not null default '',
  qty numeric(14,3) not null default 0,
  unit text not null default 'unit',
  rate numeric(14,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  pricing_mode text not null default 'flat' check (pricing_mode in ('flat','sqft')),
  width_ft numeric(10,3) not null default 0,
  height_ft numeric(10,3) not null default 0,
  sort_order int not null default 0
);

-- ----------------------------------------------------------------------------
-- Delivery Challans
-- ----------------------------------------------------------------------------
create table if not exists public.delivery_challans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  number text not null,
  date date not null default current_date,
  vehicle_number text not null default '',
  transport_mode text not null default '',
  invoice_id uuid references public.invoices(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  reference text not null default '',
  subject text not null default '',
  tax_type text not null default 'intra' check (tax_type in ('intra','inter')),
  notes text not null default '',
  terms text not null default '',
  status text not null default 'Draft'
    check (status in ('Draft','Dispatched','Delivered')),
  adjustment numeric(14,2) not null default 0,
  sub_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, number)
);

create table if not exists public.dc_lines (
  id uuid primary key default gen_random_uuid(),
  dc_id uuid not null references public.delivery_challans(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  name text not null default '',
  description text not null default '',
  hsn text not null default '',
  qty numeric(14,3) not null default 0,
  unit text not null default 'unit',
  rate numeric(14,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  pricing_mode text not null default 'flat' check (pricing_mode in ('flat','sqft')),
  width_ft numeric(10,3) not null default 0,
  height_ft numeric(10,3) not null default 0,
  sort_order int not null default 0
);

-- ----------------------------------------------------------------------------
-- Expenses
-- ----------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null default current_date,
  category text not null default 'Other',
  vendor_id uuid references public.vendors(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '',
  payment_method text not null default 'UPI',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Helpful indexes for the lists/reports the app already has
-- ----------------------------------------------------------------------------
create index if not exists idx_quotations_business on public.quotations(business_id, date desc);
create index if not exists idx_invoices_business on public.invoices(business_id, date desc);
create index if not exists idx_po_business on public.purchase_orders(business_id, date desc);
create index if not exists idx_dc_business on public.delivery_challans(business_id, date desc);
create index if not exists idx_expenses_business on public.expenses(business_id, date desc);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_quotation_lines_qid on public.quotation_lines(quotation_id);
create index if not exists idx_invoice_lines_iid on public.invoice_lines(invoice_id);
create index if not exists idx_po_lines_pid on public.po_lines(po_id);
create index if not exists idx_dc_lines_did on public.dc_lines(dc_id);

-- ----------------------------------------------------------------------------
-- updated_at auto-touch trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_items on public.items;
create trigger trg_touch_items before update on public.items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_touch_clients on public.clients;
create trigger trg_touch_clients before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists trg_touch_vendors on public.vendors;
create trigger trg_touch_vendors before update on public.vendors
  for each row execute function public.set_updated_at();

drop trigger if exists trg_touch_quotations on public.quotations;
create trigger trg_touch_quotations before update on public.quotations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_touch_invoices on public.invoices;
create trigger trg_touch_invoices before update on public.invoices
  for each row execute function public.set_updated_at();

drop trigger if exists trg_touch_po on public.purchase_orders;
create trigger trg_touch_po before update on public.purchase_orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_touch_dc on public.delivery_challans;
create trigger trg_touch_dc before update on public.delivery_challans
  for each row execute function public.set_updated_at();

drop trigger if exists trg_touch_settings on public.settings;
create trigger trg_touch_settings before update on public.settings
  for each row execute function public.set_updated_at();
