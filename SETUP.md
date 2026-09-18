# Setup guide — Supabase backend + billing.carveandcurve.in

## What's in this build
- `index.html`, `style.css`, `script.js` — the app, UI/print/GST layout unchanged
- `supabase-config.js` — put your Project URL + anon key here
- `supabase/001_schema.sql` … `004_seed_business.sql` — run once in Supabase, in order
- `CNAME` — for GitHub Pages, already set to `billing.carveandcurve.in`

## 1. Run the SQL (Supabase Dashboard → SQL Editor)
Run in this exact order:
1. `001_schema.sql` — tables
2. `002_security.sql` — RLS + the recursion-safe membership helper functions
3. `003_functions.sql` — atomic numbering + transactional create/update RPCs
4. `004_seed_business.sql` — **edit this one first**: create your login user
   (Authentication → Users → Add User, check "Auto Confirm User"), copy
   their UUID, paste it in place of `PASTE-YOUR-AUTH-USER-UUID-HERE`, then run.

Nothing here is destructive — it only creates new tables/functions and
inserts one business + one settings row + one membership row.

## 2. Fill in your API keys
Project Settings → API → copy the Project URL and the **anon public** key
into `supabase-config.js`. Never put the `service_role` key anywhere in
this frontend.

## 3. How login/business access works
- The app has one login screen (email + password via Supabase Auth).
- After signing in, it automatically looks up which business you belong to
  via the `business_members` table — no business ID is hardcoded in the
  frontend anywhere.
- To add a staff member later: create their auth user the same way (step 1),
  then run:
  ```sql
  insert into business_members (business_id, user_id, role)
  values ('<your-business-id>', '<their-auth-user-uuid>', 'staff');
  ```
  Find your business id with `select id from businesses;`.

## 4. Deploy to billing.carveandcurve.in
Using GitHub Pages (the `CNAME` file is already set up for this):
1. Push all these files to a GitHub repo.
2. Repo → Settings → Pages → deploy from branch (`main` / root).
3. Under Custom domain, confirm `billing.carveandcurve.in` and save.
4. At your DNS provider, add a CNAME record: host `billing`, value
   `yourgithubusername.github.io`.
5. Once DNS resolves, tick "Enforce HTTPS" in GitHub Pages settings.

If you're hosting somewhere other than GitHub Pages, just delete the
`CNAME` file and point that host's domain settings at
`billing.carveandcurve.in` instead — the app itself doesn't care where it's
served from.

## 5. Testing checklist (do this before treating it as production)
- [ ] Sign in with your login — dashboard loads with your data
- [ ] Create a quotation, invoice, PO, and delivery challan — each gets a
      real sequential number and matches on refresh
- [ ] Open the same login in two browser tabs, create two invoices back to
      back in each — confirm no duplicate invoice numbers
- [ ] Edit an existing invoice's line items and confirm the printed totals
      recalculate correctly (server-side, not just on screen)
- [ ] Record a payment, refresh the page, confirm it's still there
- [ ] Delete a quotation/invoice/PO/DC and confirm it's gone after refresh
- [ ] Sign out and back in — confirm all data reloads from Supabase (not
      just the local cache)
- [ ] In Supabase Table Editor, confirm you can't see this data without
      being signed in as a business member (RLS is doing its job)

## Notes on what's intentionally different from before
- **Numbering** is now generated atomically by the database — the number
  shown while drafting a new document is a preview; the real number is
  assigned when you hit Save.
- **Import Backup** and **Clear All Data** are disabled in this build. They
  only ever touched the local browser copy, which would now be misleading
  against a live shared database — happy to build a proper server-side
  restore/wipe flow if you need one.
- **Export Backup** still works as before (downloads a JSON snapshot of
  what's currently loaded).
