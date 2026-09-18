-- ============================================================================
-- 002_security.sql
-- Row Level Security. Nothing destructive — only enables RLS and adds
-- policies. Run after 001_schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Recursion-safe membership check.
-- SECURITY DEFINER + owned by a privileged role means this function bypasses
-- RLS *internally* when it queries business_members, so policies that call
-- it (including business_members' own policies) don't recursively re-trigger
-- RLS on business_members. This is the standard Supabase pattern for
-- self-referencing membership checks.
-- ----------------------------------------------------------------------------
create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated;

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

revoke all on function public.is_business_owner(uuid) from public;
grant execute on function public.is_business_owner(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Enable RLS everywhere
-- ----------------------------------------------------------------------------
alter table public.businesses         enable row level security;
alter table public.business_members   enable row level security;
alter table public.settings           enable row level security;
alter table public.items              enable row level security;
alter table public.clients            enable row level security;
alter table public.vendors            enable row level security;
alter table public.quotations         enable row level security;
alter table public.quotation_lines    enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_lines      enable row level security;
alter table public.payments           enable row level security;
alter table public.purchase_orders    enable row level security;
alter table public.po_lines           enable row level security;
alter table public.delivery_challans  enable row level security;
alter table public.dc_lines           enable row level security;
alter table public.expenses           enable row level security;

-- ----------------------------------------------------------------------------
-- businesses — a member can see (not edit) their own business row
-- ----------------------------------------------------------------------------
drop policy if exists "member can view own business" on public.businesses;
create policy "member can view own business" on public.businesses
  for select using (public.is_business_member(id));

-- ----------------------------------------------------------------------------
-- business_members — see fellow members of your business; only an owner
-- can add/remove members. (No self-service "invite" flow in the app yet —
-- adding staff is a manual/admin action for now, by design.)
-- ----------------------------------------------------------------------------
drop policy if exists "member can view fellow members" on public.business_members;
create policy "member can view fellow members" on public.business_members
  for select using (public.is_business_member(business_id));

drop policy if exists "owner manages members" on public.business_members;
create policy "owner manages members" on public.business_members
  for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ----------------------------------------------------------------------------
-- Every business-data table: members can select/insert/update/delete rows
-- that belong to their business, and only their business.
-- ----------------------------------------------------------------------------
drop policy if exists "members access settings" on public.settings;
create policy "members access settings" on public.settings
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access items" on public.items;
create policy "members access items" on public.items
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access clients" on public.clients;
create policy "members access clients" on public.clients
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access vendors" on public.vendors;
create policy "members access vendors" on public.vendors
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access quotations" on public.quotations;
create policy "members access quotations" on public.quotations
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access quotation_lines" on public.quotation_lines;
create policy "members access quotation_lines" on public.quotation_lines
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access invoices" on public.invoices;
create policy "members access invoices" on public.invoices
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access invoice_lines" on public.invoice_lines;
create policy "members access invoice_lines" on public.invoice_lines
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access payments" on public.payments;
create policy "members access payments" on public.payments
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access purchase_orders" on public.purchase_orders;
create policy "members access purchase_orders" on public.purchase_orders
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access po_lines" on public.po_lines;
create policy "members access po_lines" on public.po_lines
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access delivery_challans" on public.delivery_challans;
create policy "members access delivery_challans" on public.delivery_challans
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access dc_lines" on public.dc_lines;
create policy "members access dc_lines" on public.dc_lines
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

drop policy if exists "members access expenses" on public.expenses;
create policy "members access expenses" on public.expenses
  for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
