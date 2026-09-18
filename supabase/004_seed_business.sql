-- ============================================================================
-- 004_seed_business.sql
-- Run ONCE, after you've created your login user in
-- Authentication → Users → Add User (with "Auto Confirm User" checked).
--
-- Before running: replace 'PASTE-YOUR-AUTH-USER-UUID-HERE' below with that
-- user's UUID (Authentication → Users → click the user → copy the UUID).
--
-- This is the only step in the whole migration that inserts data — and it
-- only inserts, it does not touch or overwrite anything else.
-- ============================================================================

do $$
declare
  v_business_id uuid;
  v_owner_user_id uuid := '7a401a6d-a0fe-4770-a67e-aaaee3338dea';
begin
  insert into public.businesses (name) values ('Carve & Curve')
  returning id into v_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (v_business_id, v_owner_user_id, 'owner');

  -- Seeds settings with the same defaults currently hard-coded in script.js
  -- (DEFAULT_SETTINGS). Edit any of these values here before running if you
  -- want different starting numbers/prefixes.
  insert into public.settings (
    business_id, business_name, tagline, address, state, phone, email, instagram, gstin,
    quotation_prefix, next_quotation_number, default_validity_days, default_terms,
    invoice_prefix, next_invoice_number, default_invoice_due_days, default_invoice_terms,
    po_prefix, next_po_number, default_po_terms,
    dc_prefix, next_dc_number, default_dc_terms
  ) values (
    v_business_id, 'Carve & Curve', 'Handcrafted Acoustic Panels', 'Chennai, Tamil Nadu, India',
    'Tamil Nadu', '+91 87784 59236', 'carveandcurve1@gmail.com', '@carve_and_curve', '',
    'CC-QT-', 1, 15,
    E'Installation charges are not included and will be billed separately\nTransportation charges are not included and will be billed separately\nPayment terms: 50% advance, 30% after fabric selection, 20% after delivery\nWork will commence after advance payment confirmation',
    'CC-INV-', 1, 7,
    E'Payment is due within the period specified above\nPlease reference the invoice number when making payment\nLate payments may be subject to a follow-up reminder',
    'CC-PO-', 1,
    E'Please confirm receipt of this purchase order\nDelivery timelines to be confirmed with the vendor\nAny discrepancies should be reported within 3 days of delivery',
    'CC-DC-', 1,
    E'Goods once delivered will be received in good condition\nPlease verify quantity and condition at the time of delivery\nThis challan is issued for delivery purposes'
  );

  raise notice 'Business created with id: %', v_business_id;
end $$;

-- After running, note the business_id printed above (or query
-- `select id from businesses;`) — the frontend will need it, or it can
-- look it up itself via business_members for the logged-in user.

-- To add a second staff login later, once you have their auth user UUID:
--   insert into business_members (business_id, user_id, role)
--   values ('<the-business-id-above>', '<their-auth-user-uuid>', 'staff');
