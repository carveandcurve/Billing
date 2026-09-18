-- ============================================================================
-- 003_functions.sql  (REVISED — security hardening pass)
-- Atomic numbering + transactional document creation/editing.
-- Run after 001_schema.sql and 002_security.sql. Safe to run on top of the
-- previous version of this file too: every object here is CREATE OR REPLACE
-- (or a DROP FUNCTION immediately followed by its replacement, for the one
-- signature change below) — no table, row, or column is touched.
--
-- What changed from the first version, and why:
--   1. compute_doc_totals() now takes p_business_id and:
--        - rejects negative qty / rate / width / height per line
--        - rejects a line whose item_id belongs to a different business
--        - rejects a result whose grand_total would be negative
--      (discount_pct and tax_rate were already clamped to 0-100; that's
--      unchanged.)
--   2. Four new tiny guard functions (assert_client_in_business, etc.)
--      confirm client_id / vendor_id / quotation_id / invoice_id belong to
--      the SAME business as the document being saved. Every create_*/
--      update_* function now calls the ones that apply to it, before doing
--      any writes. Without this, a signed-in user of Business A could pass
--      a client_id (or vendor/quotation/invoice id) belonging to Business B
--      -- the foreign key only checks the row exists, not who owns it, and
--      SECURITY DEFINER bypasses RLS internally, so nothing else was
--      stopping that.
--   3. Validation now runs before reserve_next_number() in every create_*
--      function, so a request that's going to fail never burns a document
--      number for nothing.
--   4. Every function in this file has `set search_path = public` and an
--      explicit `revoke ... from public`; the ones meant to be called
--      directly from the frontend also get `grant execute ... to
--      authenticated`. The new internal guard/calculator functions are
--      deliberately NOT granted to authenticated -- they're only ever
--      invoked from inside the already-authorized functions below, so
--      there's no need to expose them as their own RPC entry points.
--   5. Atomic numbering itself (reserve_next_number) is unchanged: it's
--      still a single UPDATE ... RETURNING statement, which row-locks and
--      makes duplicate numbers impossible under concurrency.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared totals type
-- ----------------------------------------------------------------------------
drop type if exists public.doc_totals cascade;
create type public.doc_totals as (
  sub_total numeric, tax_total numeric, cgst numeric, sgst numeric, igst numeric, grand_total numeric
);

-- ----------------------------------------------------------------------------
-- Cross-business reference guards.
-- Plain (non-SECURITY DEFINER) functions -- they only ever run from inside
-- an already-authorized SECURITY DEFINER function above them in the call
-- stack, so they don't need elevated privilege of their own, and are not
-- granted to `authenticated` since they're not meant to be called directly.
-- ----------------------------------------------------------------------------
create or replace function public.assert_client_in_business(p_client_id uuid, p_business_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_client_id is null then return; end if;
  if not exists (select 1 from public.clients where id = p_client_id and business_id = p_business_id) then
    raise exception 'Client does not belong to this business';
  end if;
end;
$$;
revoke all on function public.assert_client_in_business(uuid, uuid) from public;

create or replace function public.assert_vendor_in_business(p_vendor_id uuid, p_business_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_vendor_id is null then return; end if;
  if not exists (select 1 from public.vendors where id = p_vendor_id and business_id = p_business_id) then
    raise exception 'Vendor does not belong to this business';
  end if;
end;
$$;
revoke all on function public.assert_vendor_in_business(uuid, uuid) from public;

create or replace function public.assert_quotation_in_business(p_quotation_id uuid, p_business_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_quotation_id is null then return; end if;
  if not exists (select 1 from public.quotations where id = p_quotation_id and business_id = p_business_id) then
    raise exception 'Quotation does not belong to this business';
  end if;
end;
$$;
revoke all on function public.assert_quotation_in_business(uuid, uuid) from public;

create or replace function public.assert_invoice_in_business(p_invoice_id uuid, p_business_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_invoice_id is null then return; end if;
  if not exists (select 1 from public.invoices where id = p_invoice_id and business_id = p_business_id) then
    raise exception 'Invoice does not belong to this business';
  end if;
end;
$$;
revoke all on function public.assert_invoice_in_business(uuid, uuid) from public;

-- ----------------------------------------------------------------------------
-- Totals calculator (server recomputes GST from line items -- client-
-- submitted totals are never trusted or stored as-is). Signature gained
-- p_business_id, so the old 3-arg version is dropped first to avoid leaving
-- a stale duplicate overload behind.
-- ----------------------------------------------------------------------------
drop function if exists public.compute_doc_totals(jsonb, text, numeric);

create or replace function public.compute_doc_totals(p_lines jsonb, p_tax_type text, p_adjustment numeric, p_business_id uuid)
returns public.doc_totals
language plpgsql
set search_path = public
as $$
declare
  v_line jsonb;
  v_item_id uuid;
  v_qty numeric; v_rate numeric; v_disc numeric; v_tax numeric;
  v_width numeric; v_height numeric; v_mode text;
  v_effective_qty numeric; v_gross numeric; v_line_amount numeric;
  v_result public.doc_totals;
begin
  v_result.sub_total := 0;
  v_result.tax_total := 0;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one line item is required';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_id := nullif(v_line->>'item_id','')::uuid;
    v_qty    := coalesce((v_line->>'qty')::numeric, 0);
    v_rate   := coalesce((v_line->>'rate')::numeric, 0);
    v_disc   := least(100, greatest(0, coalesce((v_line->>'discount_pct')::numeric, 0)));
    v_tax    := least(100, greatest(0, coalesce((v_line->>'tax_rate')::numeric, 0)));
    v_width  := coalesce((v_line->>'width_ft')::numeric, 0);
    v_height := coalesce((v_line->>'height_ft')::numeric, 0);
    v_mode   := coalesce(v_line->>'pricing_mode', 'flat');

    if v_qty < 0 then
      raise exception 'Line quantity cannot be negative';
    end if;
    if v_rate < 0 then
      raise exception 'Line rate cannot be negative';
    end if;
    if v_width < 0 or v_height < 0 then
      raise exception 'Line width/height cannot be negative';
    end if;
    if v_item_id is not null and not exists (
      select 1 from public.items where id = v_item_id and business_id = p_business_id
    ) then
      raise exception 'Referenced item does not belong to this business';
    end if;

    v_effective_qty := case when v_mode = 'sqft' then (v_width * v_height) * v_qty else v_qty end;
    v_gross := v_effective_qty * v_rate;
    v_line_amount := v_gross - (v_gross * v_disc / 100);

    v_result.sub_total := v_result.sub_total + v_line_amount;
    v_result.tax_total := v_result.tax_total + (v_line_amount * v_tax / 100);
  end loop;

  if p_tax_type = 'inter' then
    v_result.igst := v_result.tax_total;
    v_result.cgst := 0;
    v_result.sgst := 0;
  else
    v_result.igst := 0;
    v_result.cgst := v_result.tax_total / 2;
    v_result.sgst := v_result.tax_total / 2;
  end if;

  v_result.grand_total := v_result.sub_total + v_result.tax_total + coalesce(p_adjustment, 0);

  if v_result.grand_total < 0 then
    raise exception 'Grand total cannot be negative -- check the adjustment amount';
  end if;

  return v_result;
end;
$$;
revoke all on function public.compute_doc_totals(jsonb, text, numeric, uuid) from public;

-- ----------------------------------------------------------------------------
-- Atomic numbering. UPDATE ... RETURNING on a single row takes a row lock,
-- so two simultaneous calls for the same business can never receive the
-- same number -- the second call waits for the first transaction to commit.
-- Unchanged from the first version.
-- ----------------------------------------------------------------------------
create or replace function public.reserve_next_number(p_business_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next int;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Not authorized for business %', p_business_id;
  end if;

  if p_doc_type = 'quotation' then
    update public.settings set next_quotation_number = next_quotation_number + 1
      where business_id = p_business_id
      returning quotation_prefix, next_quotation_number - 1 into v_prefix, v_next;
  elsif p_doc_type = 'invoice' then
    update public.settings set next_invoice_number = next_invoice_number + 1
      where business_id = p_business_id
      returning invoice_prefix, next_invoice_number - 1 into v_prefix, v_next;
  elsif p_doc_type = 'po' then
    update public.settings set next_po_number = next_po_number + 1
      where business_id = p_business_id
      returning po_prefix, next_po_number - 1 into v_prefix, v_next;
  elsif p_doc_type = 'dc' then
    update public.settings set next_dc_number = next_dc_number + 1
      where business_id = p_business_id
      returning dc_prefix, next_dc_number - 1 into v_prefix, v_next;
  else
    raise exception 'Unknown document type: %', p_doc_type;
  end if;

  if v_prefix is null then
    raise exception 'No settings row found for business %', p_business_id;
  end if;

  return v_prefix || lpad(v_next::text, 4, '0');
end;
$$;
revoke all on function public.reserve_next_number(uuid, text) from public;
grant execute on function public.reserve_next_number(uuid, text) to authenticated;

-- ============================================================================
-- QUOTATIONS
-- ============================================================================
create or replace function public.create_quotation(
  p_business_id uuid, p_client_id uuid, p_date date, p_valid_until date,
  p_reference text, p_subject text, p_tax_type text, p_notes text, p_terms text,
  p_status text, p_adjustment numeric, p_lines jsonb
)
returns public.quotations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_totals public.doc_totals;
  v_row public.quotations;
  v_line jsonb;
  v_sort int := 0;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Not authorized for business %', p_business_id;
  end if;
  perform public.assert_client_in_business(p_client_id, p_business_id);

  v_totals := public.compute_doc_totals(p_lines, p_tax_type, p_adjustment, p_business_id);
  v_number := public.reserve_next_number(p_business_id, 'quotation');

  insert into public.quotations(
    business_id, number, date, valid_until, client_id, reference, subject, tax_type,
    notes, terms, status, adjustment, sub_total, tax_total, cgst, sgst, igst, grand_total
  ) values (
    p_business_id, v_number, p_date, p_valid_until, p_client_id, p_reference, p_subject, p_tax_type,
    p_notes, p_terms, p_status, coalesce(p_adjustment,0),
    v_totals.sub_total, v_totals.tax_total, v_totals.cgst, v_totals.sgst, v_totals.igst, v_totals.grand_total
  ) returning * into v_row;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sort := v_sort + 1;
    insert into public.quotation_lines(
      quotation_id, business_id, item_id, name, description, hsn, qty, unit, rate,
      discount_pct, tax_rate, pricing_mode, width_ft, height_ft, sort_order
    ) values (
      v_row.id, p_business_id, nullif(v_line->>'item_id','')::uuid,
      coalesce(v_line->>'name',''), coalesce(v_line->>'description',''), coalesce(v_line->>'hsn',''),
      coalesce((v_line->>'qty')::numeric,0), coalesce(v_line->>'unit','unit'), coalesce((v_line->>'rate')::numeric,0),
      coalesce((v_line->>'discount_pct')::numeric,0), coalesce((v_line->>'tax_rate')::numeric,0),
      coalesce(v_line->>'pricing_mode','flat'),
      coalesce((v_line->>'width_ft')::numeric,0), coalesce((v_line->>'height_ft')::numeric,0), v_sort
    );
  end loop;

  return v_row;
end;
$$;
revoke all on function public.create_quotation(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.create_quotation(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) to authenticated;

create or replace function public.update_quotation(
  p_quotation_id uuid, p_client_id uuid, p_date date, p_valid_until date,
  p_reference text, p_subject text, p_tax_type text, p_notes text, p_terms text,
  p_status text, p_adjustment numeric, p_lines jsonb
)
returns public.quotations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_totals public.doc_totals;
  v_row public.quotations;
  v_line jsonb;
  v_sort int := 0;
begin
  select business_id into v_business_id from public.quotations where id = p_quotation_id;
  if v_business_id is null then
    raise exception 'Quotation % not found', p_quotation_id;
  end if;
  if not public.is_business_member(v_business_id) then
    raise exception 'Not authorized for this quotation';
  end if;
  perform public.assert_client_in_business(p_client_id, v_business_id);

  v_totals := public.compute_doc_totals(p_lines, p_tax_type, p_adjustment, v_business_id);

  update public.quotations set
    client_id = p_client_id, date = p_date, valid_until = p_valid_until,
    reference = p_reference, subject = p_subject, tax_type = p_tax_type,
    notes = p_notes, terms = p_terms, status = p_status, adjustment = coalesce(p_adjustment,0),
    sub_total = v_totals.sub_total, tax_total = v_totals.tax_total,
    cgst = v_totals.cgst, sgst = v_totals.sgst, igst = v_totals.igst, grand_total = v_totals.grand_total
  where id = p_quotation_id
  returning * into v_row;

  delete from public.quotation_lines where quotation_id = p_quotation_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sort := v_sort + 1;
    insert into public.quotation_lines(
      quotation_id, business_id, item_id, name, description, hsn, qty, unit, rate,
      discount_pct, tax_rate, pricing_mode, width_ft, height_ft, sort_order
    ) values (
      p_quotation_id, v_business_id, nullif(v_line->>'item_id','')::uuid,
      coalesce(v_line->>'name',''), coalesce(v_line->>'description',''), coalesce(v_line->>'hsn',''),
      coalesce((v_line->>'qty')::numeric,0), coalesce(v_line->>'unit','unit'), coalesce((v_line->>'rate')::numeric,0),
      coalesce((v_line->>'discount_pct')::numeric,0), coalesce((v_line->>'tax_rate')::numeric,0),
      coalesce(v_line->>'pricing_mode','flat'),
      coalesce((v_line->>'width_ft')::numeric,0), coalesce((v_line->>'height_ft')::numeric,0), v_sort
    );
  end loop;

  return v_row;
end;
$$;
revoke all on function public.update_quotation(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.update_quotation(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) to authenticated;

-- ============================================================================
-- INVOICES
-- ============================================================================
create or replace function public.create_invoice(
  p_business_id uuid, p_client_id uuid, p_date date, p_due_date date,
  p_reference text, p_subject text, p_tax_type text, p_notes text, p_terms text,
  p_status text, p_adjustment numeric, p_quotation_id uuid, p_lines jsonb
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_totals public.doc_totals;
  v_row public.invoices;
  v_line jsonb;
  v_sort int := 0;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Not authorized for business %', p_business_id;
  end if;
  perform public.assert_client_in_business(p_client_id, p_business_id);
  perform public.assert_quotation_in_business(p_quotation_id, p_business_id);

  v_totals := public.compute_doc_totals(p_lines, p_tax_type, p_adjustment, p_business_id);
  v_number := public.reserve_next_number(p_business_id, 'invoice');

  insert into public.invoices(
    business_id, number, date, due_date, client_id, reference, subject, tax_type,
    notes, terms, status, adjustment, quotation_id,
    sub_total, tax_total, cgst, sgst, igst, grand_total
  ) values (
    p_business_id, v_number, p_date, p_due_date, p_client_id, p_reference, p_subject, p_tax_type,
    p_notes, p_terms, p_status, coalesce(p_adjustment,0), p_quotation_id,
    v_totals.sub_total, v_totals.tax_total, v_totals.cgst, v_totals.sgst, v_totals.igst, v_totals.grand_total
  ) returning * into v_row;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sort := v_sort + 1;
    insert into public.invoice_lines(
      invoice_id, business_id, item_id, name, description, hsn, qty, unit, rate,
      discount_pct, tax_rate, pricing_mode, width_ft, height_ft, sort_order
    ) values (
      v_row.id, p_business_id, nullif(v_line->>'item_id','')::uuid,
      coalesce(v_line->>'name',''), coalesce(v_line->>'description',''), coalesce(v_line->>'hsn',''),
      coalesce((v_line->>'qty')::numeric,0), coalesce(v_line->>'unit','unit'), coalesce((v_line->>'rate')::numeric,0),
      coalesce((v_line->>'discount_pct')::numeric,0), coalesce((v_line->>'tax_rate')::numeric,0),
      coalesce(v_line->>'pricing_mode','flat'),
      coalesce((v_line->>'width_ft')::numeric,0), coalesce((v_line->>'height_ft')::numeric,0), v_sort
    );
  end loop;

  return v_row;
end;
$$;
revoke all on function public.create_invoice(uuid,uuid,date,date,text,text,text,text,text,text,numeric,uuid,jsonb) from public;
grant execute on function public.create_invoice(uuid,uuid,date,date,text,text,text,text,text,text,numeric,uuid,jsonb) to authenticated;

create or replace function public.update_invoice(
  p_invoice_id uuid, p_client_id uuid, p_date date, p_due_date date,
  p_reference text, p_subject text, p_tax_type text, p_notes text, p_terms text,
  p_status text, p_adjustment numeric, p_lines jsonb
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_totals public.doc_totals;
  v_row public.invoices;
  v_line jsonb;
  v_sort int := 0;
begin
  select business_id into v_business_id from public.invoices where id = p_invoice_id;
  if v_business_id is null then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;
  if not public.is_business_member(v_business_id) then
    raise exception 'Not authorized for this invoice';
  end if;
  perform public.assert_client_in_business(p_client_id, v_business_id);

  v_totals := public.compute_doc_totals(p_lines, p_tax_type, p_adjustment, v_business_id);

  update public.invoices set
    client_id = p_client_id, date = p_date, due_date = p_due_date,
    reference = p_reference, subject = p_subject, tax_type = p_tax_type,
    notes = p_notes, terms = p_terms, status = p_status, adjustment = coalesce(p_adjustment,0),
    sub_total = v_totals.sub_total, tax_total = v_totals.tax_total,
    cgst = v_totals.cgst, sgst = v_totals.sgst, igst = v_totals.igst, grand_total = v_totals.grand_total
  where id = p_invoice_id
  returning * into v_row;

  delete from public.invoice_lines where invoice_id = p_invoice_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sort := v_sort + 1;
    insert into public.invoice_lines(
      invoice_id, business_id, item_id, name, description, hsn, qty, unit, rate,
      discount_pct, tax_rate, pricing_mode, width_ft, height_ft, sort_order
    ) values (
      p_invoice_id, v_business_id, nullif(v_line->>'item_id','')::uuid,
      coalesce(v_line->>'name',''), coalesce(v_line->>'description',''), coalesce(v_line->>'hsn',''),
      coalesce((v_line->>'qty')::numeric,0), coalesce(v_line->>'unit','unit'), coalesce((v_line->>'rate')::numeric,0),
      coalesce((v_line->>'discount_pct')::numeric,0), coalesce((v_line->>'tax_rate')::numeric,0),
      coalesce(v_line->>'pricing_mode','flat'),
      coalesce((v_line->>'width_ft')::numeric,0), coalesce((v_line->>'height_ft')::numeric,0), v_sort
    );
  end loop;

  return v_row;
end;
$$;
revoke all on function public.update_invoice(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.update_invoice(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) to authenticated;

-- ============================================================================
-- PURCHASE ORDERS
-- ============================================================================
create or replace function public.create_purchase_order(
  p_business_id uuid, p_vendor_id uuid, p_date date, p_expected_date date,
  p_reference text, p_subject text, p_tax_type text, p_notes text, p_terms text,
  p_status text, p_adjustment numeric, p_lines jsonb
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_totals public.doc_totals;
  v_row public.purchase_orders;
  v_line jsonb;
  v_sort int := 0;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Not authorized for business %', p_business_id;
  end if;
  perform public.assert_vendor_in_business(p_vendor_id, p_business_id);

  v_totals := public.compute_doc_totals(p_lines, p_tax_type, p_adjustment, p_business_id);
  v_number := public.reserve_next_number(p_business_id, 'po');

  insert into public.purchase_orders(
    business_id, number, date, expected_date, vendor_id, reference, subject, tax_type,
    notes, terms, status, adjustment, sub_total, tax_total, cgst, sgst, igst, grand_total
  ) values (
    p_business_id, v_number, p_date, p_expected_date, p_vendor_id, p_reference, p_subject, p_tax_type,
    p_notes, p_terms, p_status, coalesce(p_adjustment,0),
    v_totals.sub_total, v_totals.tax_total, v_totals.cgst, v_totals.sgst, v_totals.igst, v_totals.grand_total
  ) returning * into v_row;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sort := v_sort + 1;
    insert into public.po_lines(
      po_id, business_id, item_id, name, description, hsn, qty, unit, rate,
      discount_pct, tax_rate, pricing_mode, width_ft, height_ft, sort_order
    ) values (
      v_row.id, p_business_id, nullif(v_line->>'item_id','')::uuid,
      coalesce(v_line->>'name',''), coalesce(v_line->>'description',''), coalesce(v_line->>'hsn',''),
      coalesce((v_line->>'qty')::numeric,0), coalesce(v_line->>'unit','unit'), coalesce((v_line->>'rate')::numeric,0),
      coalesce((v_line->>'discount_pct')::numeric,0), coalesce((v_line->>'tax_rate')::numeric,0),
      coalesce(v_line->>'pricing_mode','flat'),
      coalesce((v_line->>'width_ft')::numeric,0), coalesce((v_line->>'height_ft')::numeric,0), v_sort
    );
  end loop;

  return v_row;
end;
$$;
revoke all on function public.create_purchase_order(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.create_purchase_order(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) to authenticated;

create or replace function public.update_purchase_order(
  p_po_id uuid, p_vendor_id uuid, p_date date, p_expected_date date,
  p_reference text, p_subject text, p_tax_type text, p_notes text, p_terms text,
  p_status text, p_adjustment numeric, p_lines jsonb
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_totals public.doc_totals;
  v_row public.purchase_orders;
  v_line jsonb;
  v_sort int := 0;
begin
  select business_id into v_business_id from public.purchase_orders where id = p_po_id;
  if v_business_id is null then
    raise exception 'Purchase order % not found', p_po_id;
  end if;
  if not public.is_business_member(v_business_id) then
    raise exception 'Not authorized for this purchase order';
  end if;
  perform public.assert_vendor_in_business(p_vendor_id, v_business_id);

  v_totals := public.compute_doc_totals(p_lines, p_tax_type, p_adjustment, v_business_id);

  update public.purchase_orders set
    vendor_id = p_vendor_id, date = p_date, expected_date = p_expected_date,
    reference = p_reference, subject = p_subject, tax_type = p_tax_type,
    notes = p_notes, terms = p_terms, status = p_status, adjustment = coalesce(p_adjustment,0),
    sub_total = v_totals.sub_total, tax_total = v_totals.tax_total,
    cgst = v_totals.cgst, sgst = v_totals.sgst, igst = v_totals.igst, grand_total = v_totals.grand_total
  where id = p_po_id
  returning * into v_row;

  delete from public.po_lines where po_id = p_po_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sort := v_sort + 1;
    insert into public.po_lines(
      po_id, business_id, item_id, name, description, hsn, qty, unit, rate,
      discount_pct, tax_rate, pricing_mode, width_ft, height_ft, sort_order
    ) values (
      p_po_id, v_business_id, nullif(v_line->>'item_id','')::uuid,
      coalesce(v_line->>'name',''), coalesce(v_line->>'description',''), coalesce(v_line->>'hsn',''),
      coalesce((v_line->>'qty')::numeric,0), coalesce(v_line->>'unit','unit'), coalesce((v_line->>'rate')::numeric,0),
      coalesce((v_line->>'discount_pct')::numeric,0), coalesce((v_line->>'tax_rate')::numeric,0),
      coalesce(v_line->>'pricing_mode','flat'),
      coalesce((v_line->>'width_ft')::numeric,0), coalesce((v_line->>'height_ft')::numeric,0), v_sort
    );
  end loop;

  return v_row;
end;
$$;
revoke all on function public.update_purchase_order(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.update_purchase_order(uuid,uuid,date,date,text,text,text,text,text,text,numeric,jsonb) to authenticated;

-- ============================================================================
-- DELIVERY CHALLANS
-- ============================================================================
create or replace function public.create_delivery_challan(
  p_business_id uuid, p_client_id uuid, p_date date, p_vehicle_number text,
  p_transport_mode text, p_invoice_id uuid, p_reference text, p_subject text,
  p_tax_type text, p_notes text, p_terms text, p_status text, p_adjustment numeric,
  p_lines jsonb
)
returns public.delivery_challans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  v_totals public.doc_totals;
  v_row public.delivery_challans;
  v_line jsonb;
  v_sort int := 0;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'Not authorized for business %', p_business_id;
  end if;
  perform public.assert_client_in_business(p_client_id, p_business_id);
  perform public.assert_invoice_in_business(p_invoice_id, p_business_id);

  v_totals := public.compute_doc_totals(p_lines, p_tax_type, p_adjustment, p_business_id);
  v_number := public.reserve_next_number(p_business_id, 'dc');

  insert into public.delivery_challans(
    business_id, number, date, vehicle_number, transport_mode, invoice_id, client_id,
    reference, subject, tax_type, notes, terms, status, adjustment,
    sub_total, tax_total, cgst, sgst, igst, grand_total
  ) values (
    p_business_id, v_number, p_date, p_vehicle_number, p_transport_mode, p_invoice_id, p_client_id,
    p_reference, p_subject, p_tax_type, p_notes, p_terms, p_status, coalesce(p_adjustment,0),
    v_totals.sub_total, v_totals.tax_total, v_totals.cgst, v_totals.sgst, v_totals.igst, v_totals.grand_total
  ) returning * into v_row;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sort := v_sort + 1;
    insert into public.dc_lines(
      dc_id, business_id, item_id, name, description, hsn, qty, unit, rate,
      discount_pct, tax_rate, pricing_mode, width_ft, height_ft, sort_order
    ) values (
      v_row.id, p_business_id, nullif(v_line->>'item_id','')::uuid,
      coalesce(v_line->>'name',''), coalesce(v_line->>'description',''), coalesce(v_line->>'hsn',''),
      coalesce((v_line->>'qty')::numeric,0), coalesce(v_line->>'unit','unit'), coalesce((v_line->>'rate')::numeric,0),
      coalesce((v_line->>'discount_pct')::numeric,0), coalesce((v_line->>'tax_rate')::numeric,0),
      coalesce(v_line->>'pricing_mode','flat'),
      coalesce((v_line->>'width_ft')::numeric,0), coalesce((v_line->>'height_ft')::numeric,0), v_sort
    );
  end loop;

  return v_row;
end;
$$;
revoke all on function public.create_delivery_challan(uuid,uuid,date,text,text,uuid,text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.create_delivery_challan(uuid,uuid,date,text,text,uuid,text,text,text,text,text,text,numeric,jsonb) to authenticated;

create or replace function public.update_delivery_challan(
  p_dc_id uuid, p_client_id uuid, p_date date, p_vehicle_number text,
  p_transport_mode text, p_invoice_id uuid, p_reference text, p_subject text,
  p_tax_type text, p_notes text, p_terms text, p_status text, p_adjustment numeric,
  p_lines jsonb
)
returns public.delivery_challans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_totals public.doc_totals;
  v_row public.delivery_challans;
  v_line jsonb;
  v_sort int := 0;
begin
  select business_id into v_business_id from public.delivery_challans where id = p_dc_id;
  if v_business_id is null then
    raise exception 'Delivery challan % not found', p_dc_id;
  end if;
  if not public.is_business_member(v_business_id) then
    raise exception 'Not authorized for this delivery challan';
  end if;
  perform public.assert_client_in_business(p_client_id, v_business_id);
  perform public.assert_invoice_in_business(p_invoice_id, v_business_id);

  v_totals := public.compute_doc_totals(p_lines, p_tax_type, p_adjustment, v_business_id);

  update public.delivery_challans set
    client_id = p_client_id, date = p_date, vehicle_number = p_vehicle_number,
    transport_mode = p_transport_mode, invoice_id = p_invoice_id,
    reference = p_reference, subject = p_subject, tax_type = p_tax_type,
    notes = p_notes, terms = p_terms, status = p_status, adjustment = coalesce(p_adjustment,0),
    sub_total = v_totals.sub_total, tax_total = v_totals.tax_total,
    cgst = v_totals.cgst, sgst = v_totals.sgst, igst = v_totals.igst, grand_total = v_totals.grand_total
  where id = p_dc_id
  returning * into v_row;

  delete from public.dc_lines where dc_id = p_dc_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sort := v_sort + 1;
    insert into public.dc_lines(
      dc_id, business_id, item_id, name, description, hsn, qty, unit, rate,
      discount_pct, tax_rate, pricing_mode, width_ft, height_ft, sort_order
    ) values (
      p_dc_id, v_business_id, nullif(v_line->>'item_id','')::uuid,
      coalesce(v_line->>'name',''), coalesce(v_line->>'description',''), coalesce(v_line->>'hsn',''),
      coalesce((v_line->>'qty')::numeric,0), coalesce(v_line->>'unit','unit'), coalesce((v_line->>'rate')::numeric,0),
      coalesce((v_line->>'discount_pct')::numeric,0), coalesce((v_line->>'tax_rate')::numeric,0),
      coalesce(v_line->>'pricing_mode','flat'),
      coalesce((v_line->>'width_ft')::numeric,0), coalesce((v_line->>'height_ft')::numeric,0), v_sort
    );
  end loop;

  return v_row;
end;
$$;
revoke all on function public.update_delivery_challan(uuid,uuid,date,text,text,uuid,text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.update_delivery_challan(uuid,uuid,date,text,text,uuid,text,text,text,text,text,text,numeric,jsonb) to authenticated;
