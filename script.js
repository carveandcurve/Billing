/* ==========================================================================
   Carve & Curve — Business Suite
   Data lives in Supabase (shared by every authorized team member of this
   business) and is mirrored into localStorage as a fast/offline read cache.
   See supabase-config.js for connection settings and SETUP.md for the
   one-time Supabase project setup.
   ========================================================================== */

/* ---------- Constants ---------- */
const LS = {
  items: 'cc_items_v1',
  clients: 'cc_clients_v1',
  vendors: 'cc_vendors_v1',
  quotations: 'cc_quotations_v1',
  invoices: 'cc_invoices_v1',
  expenses: 'cc_expenses_v1',
  purchaseOrders: 'cc_purchase_orders_v1',
  deliveryChallans: 'cc_delivery_challans_v1',
  settings: 'cc_settings_v1',
};

const QUOTATION_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired'];
const INVOICE_MANUAL_STATUSES = ['Draft', 'Sent', 'Cancelled'];
const PO_STATUSES = ['Draft', 'Sent', 'Received', 'Cancelled'];
const DC_STATUSES = ['Draft', 'Dispatched', 'Delivered'];
const EXPENSE_CATEGORIES = ['Raw Materials', 'Tools & Equipment', 'Packaging & Shipping', 'Rent & Utilities', 'Marketing', 'Labour / Contractors', 'Software & Subscriptions', 'Travel', 'Other'];
const PAYMENT_METHODS = ['UPI', 'Bank Transfer', 'Cash', 'Card', 'Cheque', 'Other'];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
];

const STATE_GST_CODES = {
  'Jammu and Kashmir':'01','Himachal Pradesh':'02','Punjab':'03','Chandigarh':'04','Uttarakhand':'05',
  'Haryana':'06','Delhi':'07','Rajasthan':'08','Uttar Pradesh':'09','Bihar':'10','Sikkim':'11',
  'Arunachal Pradesh':'12','Nagaland':'13','Manipur':'14','Mizoram':'15','Tripura':'16','Meghalaya':'17',
  'Assam':'18','West Bengal':'19','Jharkhand':'20','Odisha':'21','Chhattisgarh':'22','Madhya Pradesh':'23',
  'Gujarat':'24','Dadra and Nagar Haveli and Daman and Diu':'26','Maharashtra':'27','Andhra Pradesh':'37',
  'Karnataka':'29','Goa':'30','Lakshadweep':'31','Kerala':'32','Tamil Nadu':'33','Puducherry':'34',
  'Andaman and Nicobar Islands':'35','Telangana':'36','Ladakh':'38'
};

const DEFAULT_ITEMS = [
  { id: 'itm-core', name: 'Core Acoustic Panel', description: 'Single-tone fabric finish', unit: 'panel', rate: 0, taxRate: 18, pricingMode: 'sqft', commonSizes: [], hsn: '441890' },
  { id: 'itm-artisan', name: 'Artisan Acoustic Panel', description: 'Pinewood frame, single-tone fabric', unit: 'panel', rate: 0, taxRate: 18, pricingMode: 'sqft', commonSizes: [], hsn: '441890' },
  { id: 'itm-signature', name: 'Signature Acoustic Panel', description: 'Pinewood frame, dual-tone fabric', unit: 'panel', rate: 0, taxRate: 18, pricingMode: 'sqft', commonSizes: [], hsn: '441890' },
  { id: 'itm-fullsystem', name: 'Full Acoustic System', description: 'Complete room acoustic treatment package', unit: 'set', rate: 0, taxRate: 18, pricingMode: 'flat', commonSizes: [], hsn: '441890' },
];

const DEFAULT_SETTINGS = {
  businessName: 'Carve & Curve',
  tagline: 'Handcrafted Acoustic Panels',
  address: 'Chennai, Tamil Nadu, India',
  state: 'Tamil Nadu',
  phone: '+91 87784 59236',
  email: 'carveandcurve1@gmail.com',
  instagram: '@carve_and_curve',
  gstin: '',
  quotationPrefix: 'CC-QT-',
  nextQuotationNumber: 1,
  defaultValidityDays: 15,
  defaultTerms: 'Installation charges are not included and will be billed separately\nTransportation charges are not included and will be billed separately\nPayment terms: 50% advance, 30% after fabric selection, 20% after delivery\nWork will commence after advance payment confirmation',
  invoicePrefix: 'CC-INV-',
  nextInvoiceNumber: 1,
  defaultInvoiceDueDays: 7,
  defaultInvoiceTerms: 'Payment is due within the period specified above\nPlease reference the invoice number when making payment\nLate payments may be subject to a follow-up reminder',
  poPrefix: 'CC-PO-',
  nextPoNumber: 1,
  defaultPoTerms: 'Please confirm receipt of this purchase order\nDelivery timelines to be confirmed with the vendor\nAny discrepancies should be reported within 3 days of delivery',
  dcPrefix: 'CC-DC-',
  nextDcNumber: 1,
  defaultDcTerms: 'Goods once delivered will be received in good condition\nPlease verify quantity and condition at the time of delivery\nThis challan is issued for delivery purposes',
};

/* ---------- DOM helpers ---------- */
function $(sel, root){ return (root || document).querySelector(sel); }
function $all(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

function escapeHtml(str){
  return String(str == null ? '' : str).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function uid(prefix){
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Date / currency helpers ---------- */
function todayISO(){ return new Date().toISOString().slice(0, 10); }

function addDaysISO(iso, days){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(iso){
  if(!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const currencyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
function formatCurrency(n){ return currencyFmt.format(Number(n) || 0); }
const numberFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function formatNumber(n){ return numberFmt.format(Number(n) || 0); }
function uniformTaxRate(lines){
  if(!lines || !lines.length) return null;
  const first = clampPct(lines[0].taxRate);
  return lines.every(function(l){ return clampPct(l.taxRate) === first; }) ? first : null;
}

function numberToWordsIndian(num){
  num = Math.round(Math.abs(Number(num) || 0));
  const onesArr = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tensArr = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function twoDigits(n){
    if(n < 20) return onesArr[n];
    return tensArr[Math.floor(n / 10)] + (n % 10 ? '-' + onesArr[n % 10] : '');
  }
  function threeDigits(n){
    let s = '';
    if(n >= 100){ s += onesArr[Math.floor(n / 100)] + ' Hundred'; n = n % 100; if(n) s += ' '; }
    if(n > 0) s += twoDigits(n);
    return s;
  }
  if(num === 0) return 'Zero';
  let n = num;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  const parts = [];
  if(crore) parts.push(threeDigits(crore) + ' Crore');
  if(lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if(thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if(hundred) parts.push(threeDigits(hundred));
  return parts.join(' ');
}
function amountInWords(num){
  return 'Indian Rupee ' + numberToWordsIndian(num) + ' Only';
}

/* ---------- Toast ---------- */
let toastTimer;
function showToast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2600);
}

/* ---------- Data layer (localStorage) ---------- */
function loadLS(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(raw === null) return fallback;
    return JSON.parse(raw);
  }catch(e){
    console.error('Failed to load', key, e);
    return fallback;
  }
}
function saveLS(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  }catch(e){
    console.error('Failed to save', key, e);
    showToast('Could not save — your browser storage may be full.');
    return false;
  }
}

let state = {
  items: loadLS(LS.items, null) || DEFAULT_ITEMS.map(function(i){ return Object.assign({}, i); }),
  clients: loadLS(LS.clients, []),
  vendors: loadLS(LS.vendors, []),
  quotations: loadLS(LS.quotations, []),
  invoices: loadLS(LS.invoices, []),
  expenses: loadLS(LS.expenses, []),
  purchaseOrders: loadLS(LS.purchaseOrders, []),
  deliveryChallans: loadLS(LS.deliveryChallans, []),
  settings: Object.assign({}, DEFAULT_SETTINGS, loadLS(LS.settings, {})),
};

function persist(){
  saveLS(LS.items, state.items);
  saveLS(LS.clients, state.clients);
  saveLS(LS.vendors, state.vendors);
  saveLS(LS.quotations, state.quotations);
  saveLS(LS.invoices, state.invoices);
  saveLS(LS.expenses, state.expenses);
  saveLS(LS.purchaseOrders, state.purchaseOrders);
  saveLS(LS.deliveryChallans, state.deliveryChallans);
  saveLS(LS.settings, state.settings);
}

function clientById(id){ return state.clients.find(function(c){ return c.id === id; }); }
function vendorById(id){ return state.vendors.find(function(v){ return v.id === id; }); }
function taxTypeForState(partyState){
  if(!partyState) return null;
  return partyState === (state.settings.state || 'Tamil Nadu') ? 'intra' : 'inter';
}
function itemById(id){ return state.items.find(function(i){ return i.id === id; }); }

/* ==========================================================================
   Supabase client + auth
   ========================================================================== */
const supabaseClient = (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY
    && window.SUPABASE_URL.indexOf('YOUR-PROJECT-REF') === -1)
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;

let currentSession = null;
let currentBusinessId = null;

function requireBackend(){
  if(!supabaseClient){
    showToast('Supabase is not configured — see supabase-config.js');
    return false;
  }
  if(!currentBusinessId){
    showToast('Still connecting to your business account — try again in a moment.');
    return false;
  }
  return true;
}

/* ---------- Row <-> app-state mappers (DB is snake_case, app is camelCase) ---------- */
function mapItemRow(r){
  return { id: r.id, name: r.name, description: r.description || '', unit: r.unit || 'unit',
    hsn: r.hsn || '', rate: Number(r.rate) || 0, taxRate: Number(r.tax_rate) || 0,
    pricingMode: r.pricing_mode || 'flat', commonSizes: r.common_sizes || [] };
}
function mapClientRow(r){
  return { id: r.id, name: r.name, company: r.company || '', phone: r.phone || '', email: r.email || '',
    state: r.state || '', address: r.address || '', shipAddress: r.ship_address || '', gstin: r.gstin || '' };
}
function mapVendorRow(r){
  return { id: r.id, name: r.name, company: r.company || '', phone: r.phone || '', email: r.email || '',
    state: r.state || '', address: r.address || '', gstin: r.gstin || '' };
}
function mapLineRow(l){
  return { id: l.id, itemId: l.item_id || '', name: l.name || '', description: l.description || '',
    hsn: l.hsn || '', qty: Number(l.qty) || 0, unit: l.unit || 'unit', rate: Number(l.rate) || 0,
    discountPct: Number(l.discount_pct) || 0, taxRate: Number(l.tax_rate) || 0,
    pricingMode: l.pricing_mode || 'flat', widthFt: Number(l.width_ft) || 0, heightFt: Number(l.height_ft) || 0 };
}
function sortedLines(rows){
  return (rows || []).slice().sort(function(a,b){ return (a.sort_order||0) - (b.sort_order||0); }).map(mapLineRow);
}
function mapQuotationRow(r){
  return { id: r.id, number: r.number, date: r.date, validUntil: r.valid_until, clientId: r.client_id,
    reference: r.reference || '', subject: r.subject || '', taxType: r.tax_type, notes: r.notes || '',
    terms: r.terms || '', status: r.status, adjustment: Number(r.adjustment) || 0,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    lines: sortedLines(r.quotation_lines) };
}
function mapPaymentRow(p){
  return { id: p.id, date: p.date, amount: Number(p.amount) || 0, method: p.method || '', notes: p.notes || '' };
}
function mapInvoiceRow(r){
  return { id: r.id, number: r.number, date: r.date, dueDate: r.due_date, clientId: r.client_id,
    reference: r.reference || '', subject: r.subject || '', taxType: r.tax_type, notes: r.notes || '',
    terms: r.terms || '', status: r.status, adjustment: Number(r.adjustment) || 0,
    quotationId: r.quotation_id || null,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    lines: sortedLines(r.invoice_lines),
    payments: (r.payments || []).slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); }).map(mapPaymentRow) };
}
function mapPoRow(r){
  return { id: r.id, number: r.number, date: r.date, expectedDate: r.expected_date, vendorId: r.vendor_id,
    reference: r.reference || '', subject: r.subject || '', taxType: r.tax_type, notes: r.notes || '',
    terms: r.terms || '', status: r.status, adjustment: Number(r.adjustment) || 0,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    lines: sortedLines(r.po_lines) };
}
function mapDcRow(r){
  return { id: r.id, number: r.number, date: r.date, vehicleNumber: r.vehicle_number || '',
    transportMode: r.transport_mode || '', invoiceId: r.invoice_id || null, clientId: r.client_id,
    reference: r.reference || '', subject: r.subject || '', taxType: r.tax_type, notes: r.notes || '',
    terms: r.terms || '', status: r.status, adjustment: Number(r.adjustment) || 0,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    lines: sortedLines(r.dc_lines) };
}
function mapExpenseRow(r){
  return { id: r.id, date: r.date, category: r.category || 'Other', vendorId: r.vendor_id || '',
    amount: Number(r.amount) || 0, description: r.description || '', paymentMethod: r.payment_method || 'UPI',
    notes: r.notes || '' };
}
function mapSettingsRow(r){
  return { businessName: r.business_name, tagline: r.tagline || '', address: r.address || '', state: r.state || 'Tamil Nadu',
    phone: r.phone || '', email: r.email || '', instagram: r.instagram || '', gstin: r.gstin || '',
    quotationPrefix: r.quotation_prefix, nextQuotationNumber: r.next_quotation_number,
    defaultValidityDays: r.default_validity_days, defaultTerms: r.default_terms || '',
    invoicePrefix: r.invoice_prefix, nextInvoiceNumber: r.next_invoice_number,
    defaultInvoiceDueDays: r.default_invoice_due_days, defaultInvoiceTerms: r.default_invoice_terms || '',
    poPrefix: r.po_prefix, nextPoNumber: r.next_po_number, defaultPoTerms: r.default_po_terms || '',
    dcPrefix: r.dc_prefix, nextDcNumber: r.next_dc_number, defaultDcTerms: r.default_dc_terms || '' };
}

/* ---------- Line payload builder for the create/update RPCs ---------- */
function linesPayload(lines){
  return (lines || []).map(function(l){
    return { item_id: l.itemId || null, name: l.name || '', description: l.description || '',
      hsn: l.hsn || '', qty: Number(l.qty) || 0, unit: l.unit || 'unit', rate: Number(l.rate) || 0,
      discount_pct: Number(l.discountPct) || 0, tax_rate: Number(l.taxRate) || 0,
      pricing_mode: l.pricingMode || 'flat', width_ft: Number(l.widthFt) || 0, height_ft: Number(l.heightFt) || 0 };
  });
}

/* ---------- Single-document refetches (used right after a create/update RPC
   so the in-memory state exactly matches what the database now holds) ---------- */
async function fetchQuotationById(id){
  const res = await supabaseClient.from('quotations').select('*, quotation_lines(*)').eq('id', id).single();
  if(res.error) throw res.error;
  return mapQuotationRow(res.data);
}
async function fetchInvoiceById(id){
  const res = await supabaseClient.from('invoices').select('*, invoice_lines(*), payments(*)').eq('id', id).single();
  if(res.error) throw res.error;
  return mapInvoiceRow(res.data);
}
async function fetchPoById(id){
  const res = await supabaseClient.from('purchase_orders').select('*, po_lines(*)').eq('id', id).single();
  if(res.error) throw res.error;
  return mapPoRow(res.data);
}
async function fetchDcById(id){
  const res = await supabaseClient.from('delivery_challans').select('*, dc_lines(*)').eq('id', id).single();
  if(res.error) throw res.error;
  return mapDcRow(res.data);
}
async function reloadSettings(){
  const res = await supabaseClient.from('settings').select('*').eq('business_id', currentBusinessId).single();
  if(!res.error && res.data) state.settings = mapSettingsRow(res.data);
}

/* ---------- Generic status-select wiring used by the 4 document view pages ---------- */
function bindStatusSelect(selectEl, tableName, doc, onDone){
  if(!selectEl) return;
  selectEl.addEventListener('change', async function(e){
    const newStatus = e.target.value;
    const prevStatus = doc.status;
    if(!requireBackend()){ e.target.value = prevStatus; return; }
    const res = await supabaseClient.from(tableName).update({ status: newStatus }).eq('id', doc.id);
    if(res.error){ showToast('Could not update status: ' + res.error.message); e.target.value = prevStatus; return; }
    doc.status = newStatus;
    persist();
    onDone();
  });
}

/* ---------- Bulk initial load: reassembles every table into the exact
   nested shape the rest of the app already expects ---------- */
async function loadAllFromSupabase(){
  const [items, clients, vendors, quotations, invoices, pos, dcs, expenses, settings] = await Promise.all([
    supabaseClient.from('items').select('*').order('name'),
    supabaseClient.from('clients').select('*').order('name'),
    supabaseClient.from('vendors').select('*').order('name'),
    supabaseClient.from('quotations').select('*, quotation_lines(*)').order('date', { ascending: false }),
    supabaseClient.from('invoices').select('*, invoice_lines(*), payments(*)').order('date', { ascending: false }),
    supabaseClient.from('purchase_orders').select('*, po_lines(*)').order('date', { ascending: false }),
    supabaseClient.from('delivery_challans').select('*, dc_lines(*)').order('date', { ascending: false }),
    supabaseClient.from('expenses').select('*').order('date', { ascending: false }),
    supabaseClient.from('settings').select('*').eq('business_id', currentBusinessId).single(),
  ]);

  const firstError = [items, clients, vendors, quotations, invoices, pos, dcs, expenses, settings]
    .find(function(r){ return r.error; });
  if(firstError){
    console.error('Supabase load failed', firstError.error);
    showToast('Could not reach the server — showing your last saved data.');
    return;
  }

  state.items = (items.data || []).map(mapItemRow);
  state.clients = (clients.data || []).map(mapClientRow);
  state.vendors = (vendors.data || []).map(mapVendorRow);
  state.quotations = (quotations.data || []).map(mapQuotationRow);
  state.invoices = (invoices.data || []).map(mapInvoiceRow);
  state.purchaseOrders = (pos.data || []).map(mapPoRow);
  state.deliveryChallans = (dcs.data || []).map(mapDcRow);
  state.expenses = (expenses.data || []).map(mapExpenseRow);
  if(settings.data) state.settings = mapSettingsRow(settings.data);
  persist();
}

/* ---------- Auth screens ---------- */
function showAuthScreen(){
  $('#auth-screen').style.display = 'flex';
  $('#app-shell').style.display = 'none';
}
function showAppShell(){
  $('#auth-screen').style.display = 'none';
  $('#app-shell').style.display = '';
}

async function resolveBusinessId(){
  const res = await supabaseClient.from('business_members').select('business_id').eq('user_id', currentSession.user.id).limit(1).maybeSingle();
  if(res.error || !res.data){
    console.error('No business membership found', res.error);
    showToast('Your login is not linked to a business yet — contact the business owner.');
    return null;
  }
  return res.data.business_id;
}

async function startApp(){
  showAppShell();
  currentBusinessId = await resolveBusinessId();
  if(currentBusinessId){
    await loadAllFromSupabase();
  }
  handleRoute();
}

function bootstrapAuth(){
  if(!supabaseClient){
    console.warn('Supabase not configured — running in local-cache-only mode.');
    showAppShell();
    handleRoute();
    return;
  }
  supabaseClient.auth.getSession().then(function(res){
    currentSession = res.data.session;
    if(currentSession) startApp();
    else showAuthScreen();
  });
  supabaseClient.auth.onAuthStateChange(function(event, session){
    currentSession = session;
    if(event === 'SIGNED_IN') startApp();
    if(event === 'SIGNED_OUT'){ currentBusinessId = null; showAuthScreen(); }
  });
}

function bindAuthForm(){
  $('#auth-form').addEventListener('submit', async function(e){
    e.preventDefault();
    if(!supabaseClient){ showToast('Supabase is not configured yet — see supabase-config.js'); return; }
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    $('#auth-error').hidden = true;
    $('#auth-submit').disabled = true;
    $('#auth-submit').textContent = 'Signing in…';
    const res = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
    $('#auth-submit').disabled = false;
    $('#auth-submit').textContent = 'Sign In';
    if(res.error){ $('#auth-error').textContent = res.error.message; $('#auth-error').hidden = false; }
  });
  $('#btn-logout').addEventListener('click', function(){
    if(!supabaseClient){ showToast('Supabase is not configured yet.'); return; }
    supabaseClient.auth.signOut();
  });
}

/* ---------- Calculations (shared by quotations, invoices, purchase orders) ---------- */
function clampPct(n){ return Math.min(100, Math.max(0, Number(n) || 0)); }
function clampNonNeg(n){ return Math.max(0, Number(n) || 0); }

function lineSqft(line){
  return clampNonNeg(line.widthFt) * clampNonNeg(line.heightFt);
}
function lineEffectiveQty(line){
  return line.pricingMode === 'sqft' ? lineSqft(line) * clampNonNeg(line.qty) : clampNonNeg(line.qty);
}
function lineAmount(line){
  const gross = lineEffectiveQty(line) * clampNonNeg(line.rate);
  return gross - (gross * clampPct(line.discountPct) / 100);
}
function lineDisplayRate(line){
  return line.pricingMode === 'sqft' ? lineSqft(line) * clampNonNeg(line.rate) : clampNonNeg(line.rate);
}

function calcTotals(doc){
  const lines = doc.lines || [];
  const subTotal = lines.reduce(function(sum, l){ return sum + lineAmount(l); }, 0);
  const taxTotal = lines.reduce(function(sum, l){ return sum + (lineAmount(l) * clampPct(l.taxRate) / 100); }, 0);
  let cgst = 0, sgst = 0, igst = 0;
  if(doc.taxType === 'inter'){ igst = taxTotal; }
  else { cgst = taxTotal / 2; sgst = taxTotal / 2; }
  return { subTotal: subTotal, taxTotal: taxTotal, cgst: cgst, sgst: sgst, igst: igst, grandTotal: subTotal + taxTotal };
}

function quotationTotal(doc){ return calcTotals(doc).grandTotal + (Number(doc.adjustment) || 0); }

function computeEffectiveStatus(q){
  if(q.status === 'Sent' && q.validUntil && q.validUntil < todayISO()) return 'Expired';
  return q.status;
}

function invoicePaid(inv){
  return (inv.payments || []).reduce(function(s, p){ return s + (Number(p.amount) || 0); }, 0);
}
function invoiceBalance(inv){
  return Math.max(0, quotationTotal(inv) - invoicePaid(inv));
}
function computeInvoiceStatus(inv){
  if(inv.status === 'Draft' || inv.status === 'Cancelled') return inv.status;
  const balance = invoiceBalance(inv);
  const paid = invoicePaid(inv);
  const overdue = inv.dueDate && inv.dueDate < todayISO() && balance > 0.005;
  if(balance <= 0.005) return 'Paid';
  if(overdue) return 'Overdue';
  if(paid > 0.005) return 'Partially Paid';
  return 'Sent';
}

function statusBadge(status){
  const cls = String(status).replace(/\s+/g, '');
  return '<span class="badge badge-' + cls + '">' + status + '</span>';
}

function toggleTableEmpty(panel, emptyEl, isEmpty){
  const wrap = panel ? panel.querySelector('.table-wrap') : null;
  if(wrap) wrap.style.display = isEmpty ? 'none' : '';
  if(emptyEl) emptyEl.hidden = !isEmpty;
}
function toggleEmptyByRow(tbodyEl, emptyEl, isEmpty){
  const wrap = tbodyEl ? tbodyEl.closest('.table-wrap') : null;
  if(wrap) wrap.style.display = isEmpty ? 'none' : '';
  if(emptyEl) emptyEl.hidden = !isEmpty;
}

/* ---------- Shared search + sort helpers (used across every list view) ---------- */
function filterBySearch(list, search, getters){
  const s = (search || '').trim().toLowerCase();
  if(!s) return list;
  return list.filter(function(item){
    return getters.some(function(g){
      const v = g(item);
      return v != null && String(v).toLowerCase().indexOf(s) !== -1;
    });
  });
}

function sortByField(list, getter, dir){
  const mult = dir === 'desc' ? -1 : 1;
  return list.slice().sort(function(a, b){
    const va = getter(a), vb = getter(b);
    if(va == null && vb == null) return 0;
    if(va == null) return 1;
    if(vb == null) return -1;
    if(typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * mult;
    return (va - vb) * mult;
  });
}

function sortDirOf(btnId){
  const btn = $('#' + btnId);
  return btn ? (btn.dataset.dir || 'asc') : 'asc';
}

function bindSortDirToggle(btnId, ascLabel, descLabel, onToggle){
  const btn = $('#' + btnId);
  if(!btn) return;
  btn.textContent = btn.dataset.dir === 'desc' ? descLabel : ascLabel;
  btn.addEventListener('click', function(){
    const newDir = btn.dataset.dir === 'desc' ? 'asc' : 'desc';
    btn.dataset.dir = newDir;
    btn.textContent = newDir === 'desc' ? descLabel : ascLabel;
    onToggle();
  });
}

function stateOptionsHtml(selected){
  return INDIAN_STATES.map(function(s){
    return '<option value="' + s + '"' + (s === selected ? ' selected' : '') + '>' + s + '</option>';
  }).join('');
}

/* ---------- Modal ---------- */
function openModal(html){
  $('#modal-content').innerHTML = html;
  $('#modal-backdrop').classList.add('active');
}
function closeModal(){
  $('#modal-backdrop').classList.remove('active');
  $('#modal-content').innerHTML = '';
}

/* ---------- Row "more options" menu ---------- */
let openMenuEl = null;
let openMenuCloseHandler = null;

function closeRowMenu(){
  if(openMenuEl){ openMenuEl.remove(); openMenuEl = null; }
  if(openMenuCloseHandler){ document.removeEventListener('click', openMenuCloseHandler); openMenuCloseHandler = null; }
}

function openRowMenu(btnEl, items){
  const wasOpenForThisBtn = openMenuEl && openMenuEl.dataset.forBtn === btnEl.dataset.menuId;
  closeRowMenu();
  if(wasOpenForThisBtn) return;

  const menu = document.createElement('div');
  menu.className = 'row-menu';
  if(!btnEl.dataset.menuId) btnEl.dataset.menuId = uid('mnu');
  menu.dataset.forBtn = btnEl.dataset.menuId;
  menu.innerHTML = items.map(function(it, idx){
    if(it.sep) return '<div class="row-menu-sep"></div>';
    return '<button type="button" class="row-menu-item' + (it.danger ? ' danger' : '') + '" data-idx="' + idx + '">' + escapeHtml(it.label) + '</button>';
  }).join('');
  document.body.appendChild(menu);

  const rect = btnEl.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let top = rect.bottom + 4;
  let left = rect.right - menuRect.width;
  if(left < 8) left = 8;
  if(top + menuRect.height > window.innerHeight - 8) top = rect.top - menuRect.height - 4;
  menu.style.position = 'fixed';
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
  openMenuEl = menu;

  $all('.row-menu-item', menu).forEach(function(el){
    el.addEventListener('click', function(e){
      e.stopPropagation();
      const idx = parseInt(el.dataset.idx, 10);
      closeRowMenu();
      if(items[idx] && items[idx].onClick) items[idx].onClick();
    });
  });

  openMenuCloseHandler = function(e){
    if(!menu.contains(e.target) && e.target !== btnEl){ closeRowMenu(); }
  };
  setTimeout(function(){ document.addEventListener('click', openMenuCloseHandler); }, 0);
}

function openItemRowMenu(btnEl, id){
  openRowMenu(btnEl, [
    { label: 'Clone', onClick: function(){ cloneItem(id); } },
    { label: 'Delete', onClick: function(){ deleteItem(id); }, danger: true },
  ]);
}
function openClientRowMenu(btnEl, id){
  openRowMenu(btnEl, [
    { label: 'Delete', onClick: function(){ deleteClient(id); }, danger: true },
  ]);
}
function openVendorRowMenu(btnEl, id){
  openRowMenu(btnEl, [
    { label: 'Delete', onClick: function(){ deleteVendor(id); }, danger: true },
  ]);
}
function openQuotationRowMenu(btnEl, id){
  openRowMenu(btnEl, [
    { label: 'Duplicate', onClick: function(){ duplicateQuotation(id); } },
    { label: 'Delete', onClick: function(){ deleteQuotation(id); }, danger: true },
  ]);
}
function openInvoiceRowMenu(btnEl, id){
  openRowMenu(btnEl, [
    { label: 'Duplicate', onClick: function(){ duplicateInvoice(id); } },
    { label: 'Delete', onClick: function(){ deleteInvoice(id); }, danger: true },
  ]);
}
function openPoRowMenu(btnEl, id){
  openRowMenu(btnEl, [
    { label: 'Duplicate', onClick: function(){ duplicatePo(id); } },
    { label: 'Delete', onClick: function(){ deletePo(id); }, danger: true },
  ]);
}
function openDcRowMenu(btnEl, id){
  openRowMenu(btnEl, [
    { label: 'Duplicate', onClick: function(){ duplicateDc(id); } },
    { label: 'Delete', onClick: function(){ deleteDc(id); }, danger: true },
  ]);
}

/* ---------- Router ---------- */
const ROUTES = [
  'dashboard', 'items', 'clients', 'vendors',
  'quotation-form', 'quotations', 'quotation-view',
  'invoice-form', 'invoices', 'invoice-view',
  'payments',
  'dc-form', 'delivery-challans', 'dc-view',
  'po-form', 'purchase-orders', 'po-view',
  'expenses', 'reports', 'settings'
];

const NAV_PARENT = {
  'quotation-form': 'quotations', 'quotation-view': 'quotations',
  'invoice-form': 'invoices', 'invoice-view': 'invoices',
  'po-form': 'purchase-orders', 'po-view': 'purchase-orders',
  'dc-form': 'delivery-challans', 'dc-view': 'delivery-challans',
};

function handleRoute(){
  const hash = (location.hash || '#dashboard').slice(1);
  const parts = hash.split('/');
  const route = ROUTES.indexOf(parts[0]) !== -1 ? parts[0] : 'dashboard';
  const param = parts[1];

  $all('.view').forEach(function(v){ v.classList.remove('active'); });
  const viewEl = $('#view-' + route);
  if(viewEl) viewEl.classList.add('active');

  const activeNav = NAV_PARENT[route] || route;
  $all('#main-nav a').forEach(function(a){ a.classList.toggle('active', a.dataset.route === activeNav); });
  closeSidebar();
  window.scrollTo(0, 0);

  if(route === 'dashboard') renderDashboard();
  else if(route === 'items') renderItems();
  else if(route === 'clients') renderClients();
  else if(route === 'vendors') renderVendors();
  else if(route === 'quotation-form') renderQuotationForm(param);
  else if(route === 'quotations') renderQuotationsList();
  else if(route === 'quotation-view') renderQuotationView(param);
  else if(route === 'invoice-form') renderInvoiceForm(param);
  else if(route === 'invoices') renderInvoicesList();
  else if(route === 'invoice-view') renderInvoiceView(param);
  else if(route === 'payments') renderPaymentsList();
  else if(route === 'dc-form') renderDcForm(param);
  else if(route === 'delivery-challans') renderDcList();
  else if(route === 'dc-view') renderDcView(param);
  else if(route === 'po-form') renderPoForm(param);
  else if(route === 'purchase-orders') renderPosList();
  else if(route === 'po-view') renderPoView(param);
  else if(route === 'expenses') renderExpenses();
  else if(route === 'reports') renderReports();
  else if(route === 'settings') renderSettings();
}

function openSidebar(){
  $('#sidebar').classList.add('open');
  $('#sidebar-backdrop').classList.add('open');
  $('#nav-toggle').setAttribute('aria-expanded', 'true');
}
function closeSidebar(){
  $('#sidebar').classList.remove('open');
  $('#sidebar-backdrop').classList.remove('open');
  $('#nav-toggle').setAttribute('aria-expanded', 'false');
}

/* ---------- Dashboard ---------- */
function getOutstandingReceivables(){
  return state.invoices.filter(function(inv){
    const st = computeInvoiceStatus(inv);
    return st === 'Sent' || st === 'Partially Paid' || st === 'Overdue';
  }).sort(function(a, b){ return (a.dueDate || '').localeCompare(b.dueDate || ''); });
}

function invoiceRowHtml(inv, showActions){
  const c = clientById(inv.clientId);
  const status = computeInvoiceStatus(inv);
  let html = '<tr onclick="location.hash=\'#invoice-view/' + inv.id + '\'" style="cursor:pointer">';
  html += '<td class="mono">' + escapeHtml(inv.number) + '</td>';
  html += '<td>' + escapeHtml(c ? c.name : '—') + '</td>';
  html += '<td>' + formatDateDisplay(inv.date) + '</td>';
  if(showActions) html += '<td>' + formatDateDisplay(inv.dueDate) + '</td>';
  html += '<td class="num">' + formatCurrency(quotationTotal(inv)) + '</td>';
  if(showActions) html += '<td class="num">' + formatCurrency(invoiceBalance(inv)) + '</td>';
  html += '<td>' + statusBadge(status) + '</td>';
  if(showActions){
    html += '<td class="row-actions">'
      + '<button class="btn-icon" title="View" onclick="event.stopPropagation();location.hash=\'#invoice-view/' + inv.id + '\'">\uD83D\uDC41</button>'
      + '<button class="btn-icon" title="Edit" onclick="event.stopPropagation();location.hash=\'#invoice-form/' + inv.id + '\'">\u270E</button>'
      + '<button class="btn-icon" title="More" onclick="event.stopPropagation();openInvoiceRowMenu(this,\'' + inv.id + '\')">\u22EE</button>'
      + '</td>';
  }
  html += '</tr>';
  return html;
}

function receivableRowHtml(inv, showActions){
  const c = clientById(inv.clientId);
  const balance = invoiceBalance(inv);
  let html = '<tr' + (showActions ? '' : (' onclick="location.hash=\'#invoice-view/' + inv.id + '\'" style="cursor:pointer"')) + '>';
  html += '<td class="mono">' + escapeHtml(inv.number) + '</td>';
  html += '<td>' + escapeHtml(c ? c.name : '—') + '</td>';
  html += '<td>' + formatDateDisplay(inv.dueDate) + '</td>';
  html += '<td class="num">' + formatCurrency(balance) + '</td>';
  if(showActions) html += '<td class="row-actions"><button class="btn-icon" title="View" onclick="location.hash=\'#invoice-view/' + inv.id + '\'">\uD83D\uDC41</button></td>';
  html += '</tr>';
  return html;
}

function renderDashboard(){
  const receivables = getOutstandingReceivables();
  const receivablesTotal = receivables.reduce(function(s, inv){ return s + invoiceBalance(inv); }, 0);

  const ym = todayISO().slice(0, 7);
  const paidThisMonth = state.invoices.reduce(function(sum, inv){
    return sum + (inv.payments || []).filter(function(p){ return (p.date || '').slice(0, 7) === ym; })
      .reduce(function(s, p){ return s + (Number(p.amount) || 0); }, 0);
  }, 0);
  const expensesThisMonth = state.expenses.filter(function(e){ return (e.date || '').slice(0, 7) === ym; })
    .reduce(function(s, e){ return s + (Number(e.amount) || 0); }, 0);
  const openQuotes = state.quotations.filter(function(q){ return computeEffectiveStatus(q) === 'Sent'; }).length;

  $('#dashboard-stats').innerHTML =
    '<div class="stat-card"><div class="stat-label">Outstanding</div><div class="stat-value" style="font-size:22px">' + formatCurrency(receivablesTotal) + '</div><div class="stat-sub">' + receivables.length + ' invoice' + (receivables.length === 1 ? '' : 's') + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Received This Month</div><div class="stat-value" style="font-size:22px">' + formatCurrency(paidThisMonth) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Expenses This Month</div><div class="stat-value" style="font-size:22px">' + formatCurrency(expensesThisMonth) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Open Quotations</div><div class="stat-value">' + openQuotes + '</div><div class="stat-sub">awaiting reply</div></div>';

  const recentInv = state.invoices.slice().sort(function(a, b){ return b.createdAt - a.createdAt; }).slice(0, 5);
  $('#dashboard-invoices-tbody').innerHTML = recentInv.map(function(inv){ return invoiceRowHtml(inv, false); }).join('');
  toggleEmptyByRow($('#dashboard-invoices-tbody'), $('#dashboard-invoices-empty'), state.invoices.length === 0);

  const topReceivables = receivables.slice(0, 5);
  $('#dashboard-receivables-tbody').innerHTML = topReceivables.map(function(inv){ return receivableRowHtml(inv, false); }).join('');
  toggleEmptyByRow($('#dashboard-receivables-tbody'), $('#dashboard-receivables-empty'), receivables.length === 0);
}

/* ---------- Items ---------- */
function renderItems(){
  const panel = $('#view-items .panel');
  const search = $('#items-search').value;
  let list = filterBySearch(state.items, search, [
    function(it){ return it.name; }, function(it){ return it.description; }, function(it){ return it.hsn; }
  ]);
  const sortField = $('#items-sort-field').value;
  const getters = {
    name: function(it){ return (it.name || '').toLowerCase(); },
    cost: function(it){ return Number(it.rate) || 0; },
  };
  list = sortByField(list, getters[sortField] || getters.name, sortDirOf('items-sort-dir'));

  $('#items-tbody').innerHTML = list.map(function(it){
    const isSqft = it.pricingMode === 'sqft';
    const sizesLine = (isSqft && it.commonSizes && it.commonSizes.length)
      ? '<div class="cell-muted" style="font-size:12px;margin-top:4px">' + it.commonSizes.map(function(sz){
          const sqft = (Number(sz.widthFt) || 0) * (Number(sz.heightFt) || 0);
          return sz.widthFt + 'ft\u00D7' + sz.heightFt + 'ft = ' + formatCurrency(sqft * it.rate);
        }).join(' &nbsp;\u00B7&nbsp; ') + '</div>'
      : '';
    const hsnLine = it.hsn ? '<div class="cell-muted" style="font-size:11px;margin-top:3px">HSN/SAC: ' + escapeHtml(it.hsn) + '</div>' : '';
    return '<tr>'
      + '<td>' + escapeHtml(it.name) + hsnLine + sizesLine + '</td>'
      + '<td class="cell-muted">' + escapeHtml(it.description || '—') + '</td>'
      + '<td>' + escapeHtml(it.unit || '—') + '</td>'
      + '<td class="num">' + formatCurrency(it.rate) + (isSqft ? '<div style="font-size:11px;color:var(--ink-muted);font-family:var(--font-sans)">per sqft</div>' : '') + '</td>'
      + '<td class="num">' + (it.taxRate || 0) + '%</td>'
      + '<td class="row-actions">'
      + '<button class="btn-icon" title="Edit" onclick="openItemModal(\'' + it.id + '\')">\u270E</button>'
      + '<button class="btn-icon" title="More" onclick="openItemRowMenu(this,\'' + it.id + '\')">\u22EE</button>'
      + '</td></tr>';
  }).join('');
  toggleTableEmpty(panel, $('#items-empty'), list.length === 0);
}

let editingItemSizes = [];

function openItemModal(id, cloneFromId){
  const editingItem = id ? itemById(id) : null;
  const source = editingItem || (cloneFromId ? itemById(cloneFromId) : null);
  const isClone = !editingItem && !!source;
  editingItemSizes = (source && source.commonSizes) ? JSON.parse(JSON.stringify(source.commonSizes)) : [];
  const mode = source ? (source.pricingMode || 'flat') : 'flat';
  const nameValue = isClone ? (source.name + ' (Copy)') : (source ? source.name : '');
  const taxOptions = [0, 5, 12, 18, 28].map(function(r){
    return '<option value="' + r + '"' + (source && source.taxRate === r ? ' selected' : '') + '>' + r + '%</option>';
  }).join('');
  openModal(
    '<h2>' + (editingItem ? 'Edit Item' : (isClone ? 'Clone Item' : 'Add Item')) + '</h2>' +
    '<div class="form-grid">' +
      '<div class="field field-wide"><label>Name</label><input id="im-name" value="' + escapeHtml(nameValue) + '"></div>' +
      '<div class="field field-wide"><label>Description <span class="optional">(optional)</span></label><input id="im-desc" value="' + (source ? escapeHtml(source.description || '') : '') + '"></div>' +
      '<div class="field"><label>Pricing</label><select id="im-mode" onchange="onItemModeChange()"><option value="flat"' + (mode === 'flat' ? ' selected' : '') + '>Flat rate</option><option value="sqft"' + (mode === 'sqft' ? ' selected' : '') + '>Price per sqft</option></select></div>' +
      '<div class="field"><label>Unit</label><input id="im-unit" value="' + (source ? escapeHtml(source.unit || 'panel') : 'panel') + '"></div>' +
      '<div class="field"><label>HSN/SAC <span class="optional">(optional)</span></label><input id="im-hsn" value="' + (source ? escapeHtml(source.hsn || '') : '') + '"></div>' +
      '<div class="field"><label id="im-rate-label">' + (mode === 'sqft' ? 'Price per sqft (₹)' : 'Rate (₹)') + '</label><input type="number" id="im-rate" min="0" step="0.01" value="' + (source ? source.rate : 0) + '" oninput="renderEditingItemSizes()"></div>' +
      '<div class="field"><label>GST %</label><select id="im-tax">' + taxOptions + '</select></div>' +
    '</div>' +
    '<div id="im-sizes-section" style="' + (mode === 'sqft' ? '' : 'display:none') + '">' +
      '<label style="font-size:12.5px;font-weight:600;color:var(--deep);display:block;margin:2px 0 8px">Common Sizes <span class="optional">(optional reference list, shown on the Items page)</span></label>' +
      '<div id="im-sizes-list"></div>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="addEditingItemSize()" style="margin-top:2px">+ Add Size</button>' +
    '</div>' +
    '<div class="form-actions" style="margin-top:20px">' +
      '<button type="button" class="btn btn-text" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-gold" onclick="saveItem(' + (editingItem ? "'" + editingItem.id + "'" : 'null') + ')">Save Item</button>' +
    '</div>'
  );
  renderEditingItemSizes();
  setTimeout(function(){ const el = $('#im-name'); if(el){ el.focus(); if(isClone) el.select(); } }, 30);
}
function cloneItem(id){ openItemModal(null, id); }

function onItemModeChange(){
  const mode = $('#im-mode').value;
  $('#im-rate-label').textContent = mode === 'sqft' ? 'Price per sqft (₹)' : 'Rate (₹)';
  $('#im-sizes-section').style.display = mode === 'sqft' ? '' : 'none';
}

function renderEditingItemSizes(){
  const rateEl = $('#im-rate');
  const rate = rateEl ? (parseFloat(rateEl.value) || 0) : 0;
  const listEl = $('#im-sizes-list');
  if(!listEl) return;
  listEl.innerHTML = editingItemSizes.length ? editingItemSizes.map(function(sz, idx){
    const sqft = (Number(sz.widthFt) || 0) * (Number(sz.heightFt) || 0);
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
      + '<input type="number" min="0" step="0.01" placeholder="Width ft" value="' + (sz.widthFt || '') + '" oninput="updateEditingItemSize(' + idx + ',\'widthFt\',this.value)" style="width:80px">'
      + '<span style="color:var(--ink-muted)">\u00D7</span>'
      + '<input type="number" min="0" step="0.01" placeholder="Height ft" value="' + (sz.heightFt || '') + '" oninput="updateEditingItemSize(' + idx + ',\'heightFt\',this.value)" style="width:80px">'
      + '<span class="mono" style="font-size:12px;color:var(--ink-muted);min-width:110px">= ' + sqft.toFixed(2) + ' sqft \u2192 ' + formatCurrency(sqft * rate) + '</span>'
      + '<button type="button" class="btn-icon danger" onclick="removeEditingItemSize(' + idx + ')">\u2715</button>'
      + '</div>';
  }).join('') : '<p class="panel-note" style="margin:0 0 8px">No sizes added yet.</p>';
}
function addEditingItemSize(){ editingItemSizes.push({ widthFt: 0, heightFt: 0 }); renderEditingItemSizes(); }
function updateEditingItemSize(idx, field, value){ editingItemSizes[idx][field] = parseFloat(value) || 0; renderEditingItemSizes(); }
function removeEditingItemSize(idx){ editingItemSizes.splice(idx, 1); renderEditingItemSizes(); }

async function saveItem(id){
  const name = $('#im-name').value.trim();
  if(!name){ showToast('Item name is required'); return; }
  const dup = state.items.find(function(it){ return it.id !== id && it.name.trim().toLowerCase() === name.toLowerCase(); });
  if(dup){ showToast('An item named "' + name + '" already exists — use a different name.'); return; }
  if(!requireBackend()) return;
  const row = {
    business_id: currentBusinessId,
    name: name,
    description: $('#im-desc').value.trim(),
    unit: $('#im-unit').value.trim() || 'unit',
    hsn: $('#im-hsn').value.trim(),
    rate: parseFloat($('#im-rate').value) || 0,
    tax_rate: parseFloat($('#im-tax').value) || 0,
    pricing_mode: $('#im-mode').value,
    common_sizes: editingItemSizes.filter(function(s){ return (Number(s.widthFt) || 0) > 0 && (Number(s.heightFt) || 0) > 0; }),
  };
  const res = id
    ? await supabaseClient.from('items').update(row).eq('id', id).select().single()
    : await supabaseClient.from('items').insert(row).select().single();
  if(res.error){
    showToast(res.error.code === '23505' ? 'An item with that name already exists.' : 'Could not save item: ' + res.error.message);
    return;
  }
  const saved = mapItemRow(res.data);
  if(id){ Object.assign(itemById(id), saved); } else { state.items.push(saved); }
  persist();
  closeModal();
  renderItems();
  showToast('Item saved');
}

async function deleteItem(id){
  if(!confirm('Delete this item? This will not affect quotations/invoices that already use it.')) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.from('items').delete().eq('id', id);
  if(res.error){ showToast('Could not delete item: ' + res.error.message); return; }
  state.items = state.items.filter(function(i){ return i.id !== id; });
  persist();
  renderItems();
  showToast('Item deleted');
}

/* ---------- Clients ---------- */
function renderClients(){
  const panel = $('#view-clients .panel');
  const search = $('#clients-search').value;
  let list = filterBySearch(state.clients, search, [
    function(c){ return c.name; }, function(c){ return c.company; }, function(c){ return c.phone; }, function(c){ return c.gstin; }
  ]);
  list = sortByField(list, function(c){ return (c.name || '').toLowerCase(); }, sortDirOf('clients-sort-dir'));

  $('#clients-tbody').innerHTML = list.map(function(c){
    return '<tr>'
      + '<td>' + escapeHtml(c.name) + '</td>'
      + '<td class="cell-muted">' + escapeHtml(c.company || '—') + '</td>'
      + '<td>' + escapeHtml(c.phone || '—') + '</td>'
      + '<td>' + escapeHtml(c.state || '—') + '</td>'
      + '<td class="row-actions">'
      + '<button class="btn-icon" title="Edit" onclick="openClientModal(\'' + c.id + '\')">\u270E</button>'
      + '<button class="btn-icon" title="More" onclick="openClientRowMenu(this,\'' + c.id + '\')">\u22EE</button>'
      + '</td></tr>';
  }).join('');
  toggleTableEmpty(panel, $('#clients-empty'), list.length === 0);
}

let pendingClientSaveCallback = null;

function openClientModal(id, onSaveCallback){
  const c = id ? clientById(id) : null;
  openModal(
    '<h2>' + (c ? 'Edit Client' : 'Add Client') + '</h2>' +
    '<div class="form-grid">' +
      '<div class="field field-wide"><label>Name</label><input id="cm-name" value="' + (c ? escapeHtml(c.name) : '') + '"></div>' +
      '<div class="field"><label>Company <span class="optional">(optional)</span></label><input id="cm-company" value="' + (c ? escapeHtml(c.company || '') : '') + '"></div>' +
      '<div class="field"><label>Phone</label><input id="cm-phone" value="' + (c ? escapeHtml(c.phone || '') : '') + '"></div>' +
      '<div class="field"><label>Email <span class="optional">(optional)</span></label><input id="cm-email" value="' + (c ? escapeHtml(c.email || '') : '') + '"></div>' +
      '<div class="field"><label>State</label><select id="cm-state">' + stateOptionsHtml(c ? c.state : 'Tamil Nadu') + '</select></div>' +
      '<div class="field field-wide"><label>Address <span class="optional">(optional)</span></label><input id="cm-address" value="' + (c ? escapeHtml(c.address || '') : '') + '"></div>' +
      '<div class="field field-wide"><label>Ship-To Address <span class="optional">(optional — leave blank to use the address above)</span></label><input id="cm-shipaddress" value="' + (c ? escapeHtml(c.shipAddress || '') : '') + '"></div>' +
      '<div class="field field-wide"><label>GSTIN <span class="optional">(optional)</span></label><input id="cm-gstin" value="' + (c ? escapeHtml(c.gstin || '') : '') + '"></div>' +
    '</div>' +
    '<div class="form-actions">' +
      '<button type="button" class="btn btn-text" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-gold" onclick="saveClientFromModal(' + (c ? "'" + c.id + "'" : 'null') + ')">Save Client</button>' +
    '</div>'
  );
  pendingClientSaveCallback = onSaveCallback || null;
  setTimeout(function(){ const el = $('#cm-name'); if(el) el.focus(); }, 30);
}

async function saveClientFromModal(id){
  const name = $('#cm-name').value.trim();
  if(!name){ showToast('Client name is required'); return; }
  if(!requireBackend()) return;
  const row = {
    business_id: currentBusinessId,
    name: name,
    company: $('#cm-company').value.trim(),
    phone: $('#cm-phone').value.trim(),
    email: $('#cm-email').value.trim(),
    state: $('#cm-state').value,
    address: $('#cm-address').value.trim(),
    ship_address: $('#cm-shipaddress').value.trim(),
    gstin: $('#cm-gstin').value.trim(),
  };
  const res = id
    ? await supabaseClient.from('clients').update(row).eq('id', id).select().single()
    : await supabaseClient.from('clients').insert(row).select().single();
  if(res.error){ showToast('Could not save client: ' + res.error.message); return; }
  const saved = mapClientRow(res.data);
  const savedId = saved.id;
  if(id){ Object.assign(clientById(id), saved); } else { state.clients.push(saved); }
  persist();
  closeModal();
  if(location.hash.indexOf('#clients') === 0) renderClients();
  showToast('Client saved');
  if(pendingClientSaveCallback){
    const cb = pendingClientSaveCallback;
    pendingClientSaveCallback = null;
    cb(savedId);
  }
}

async function deleteClient(id){
  if(!confirm('Delete this client? Existing quotations/invoices will keep their saved client details.')) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.from('clients').delete().eq('id', id);
  if(res.error){ showToast('Could not delete client: ' + res.error.message); return; }
  state.clients = state.clients.filter(function(c){ return c.id !== id; });
  persist();
  renderClients();
  showToast('Client deleted');
}

/* ---------- Vendors ---------- */
function renderVendors(){
  const panel = $('#view-vendors .panel');
  const search = $('#vendors-search').value;
  let list = filterBySearch(state.vendors, search, [
    function(v){ return v.name; }, function(v){ return v.company; }, function(v){ return v.phone; }, function(v){ return v.gstin; }
  ]);
  list = sortByField(list, function(v){ return (v.name || '').toLowerCase(); }, sortDirOf('vendors-sort-dir'));

  $('#vendors-tbody').innerHTML = list.map(function(v){
    return '<tr>'
      + '<td>' + escapeHtml(v.name) + '</td>'
      + '<td class="cell-muted">' + escapeHtml(v.company || '—') + '</td>'
      + '<td>' + escapeHtml(v.phone || '—') + '</td>'
      + '<td>' + escapeHtml(v.state || '—') + '</td>'
      + '<td class="row-actions">'
      + '<button class="btn-icon" title="Edit" onclick="openVendorModal(\'' + v.id + '\')">\u270E</button>'
      + '<button class="btn-icon" title="More" onclick="openVendorRowMenu(this,\'' + v.id + '\')">\u22EE</button>'
      + '</td></tr>';
  }).join('');
  toggleTableEmpty(panel, $('#vendors-empty'), list.length === 0);
}

let pendingVendorSaveCallback = null;

function openVendorModal(id, onSaveCallback){
  const v = id ? vendorById(id) : null;
  openModal(
    '<h2>' + (v ? 'Edit Vendor' : 'Add Vendor') + '</h2>' +
    '<div class="form-grid">' +
      '<div class="field field-wide"><label>Name</label><input id="vm-name" value="' + (v ? escapeHtml(v.name) : '') + '"></div>' +
      '<div class="field"><label>Company <span class="optional">(optional)</span></label><input id="vm-company" value="' + (v ? escapeHtml(v.company || '') : '') + '"></div>' +
      '<div class="field"><label>Phone</label><input id="vm-phone" value="' + (v ? escapeHtml(v.phone || '') : '') + '"></div>' +
      '<div class="field"><label>Email <span class="optional">(optional)</span></label><input id="vm-email" value="' + (v ? escapeHtml(v.email || '') : '') + '"></div>' +
      '<div class="field"><label>State</label><select id="vm-state">' + stateOptionsHtml(v ? v.state : 'Tamil Nadu') + '</select></div>' +
      '<div class="field field-wide"><label>Address <span class="optional">(optional)</span></label><input id="vm-address" value="' + (v ? escapeHtml(v.address || '') : '') + '"></div>' +
      '<div class="field field-wide"><label>GSTIN <span class="optional">(optional)</span></label><input id="vm-gstin" value="' + (v ? escapeHtml(v.gstin || '') : '') + '"></div>' +
    '</div>' +
    '<div class="form-actions">' +
      '<button type="button" class="btn btn-text" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-gold" onclick="saveVendorFromModal(' + (v ? "'" + v.id + "'" : 'null') + ')">Save Vendor</button>' +
    '</div>'
  );
  pendingVendorSaveCallback = onSaveCallback || null;
  setTimeout(function(){ const el = $('#vm-name'); if(el) el.focus(); }, 30);
}

async function saveVendorFromModal(id){
  const name = $('#vm-name').value.trim();
  if(!name){ showToast('Vendor name is required'); return; }
  if(!requireBackend()) return;
  const row = {
    business_id: currentBusinessId,
    name: name,
    company: $('#vm-company').value.trim(),
    phone: $('#vm-phone').value.trim(),
    email: $('#vm-email').value.trim(),
    state: $('#vm-state').value,
    address: $('#vm-address').value.trim(),
    gstin: $('#vm-gstin').value.trim(),
  };
  const res = id
    ? await supabaseClient.from('vendors').update(row).eq('id', id).select().single()
    : await supabaseClient.from('vendors').insert(row).select().single();
  if(res.error){ showToast('Could not save vendor: ' + res.error.message); return; }
  const saved = mapVendorRow(res.data);
  const savedId = saved.id;
  if(id){ Object.assign(vendorById(id), saved); } else { state.vendors.push(saved); }
  persist();
  closeModal();
  if(location.hash.indexOf('#vendors') === 0) renderVendors();
  showToast('Vendor saved');
  if(pendingVendorSaveCallback){
    const cb = pendingVendorSaveCallback;
    pendingVendorSaveCallback = null;
    cb(savedId);
  }
}

async function deleteVendor(id){
  if(!confirm('Delete this vendor? Existing purchase orders/expenses will keep their saved vendor details.')) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.from('vendors').delete().eq('id', id);
  if(res.error){ showToast('Could not delete vendor: ' + res.error.message); return; }
  state.vendors = state.vendors.filter(function(v){ return v.id !== id; });
  persist();
  renderVendors();
  showToast('Vendor deleted');
}

/* ---------- Quotations ---------- */
let qfState = null;

function nextQuotationNumberPreview(){
  const n = state.settings.nextQuotationNumber || 1;
  return (state.settings.quotationPrefix || 'CC-QT-') + String(n).padStart(4, '0');
}

function blankLine(){
  return { id: uid('ln'), itemId: '', name: '', description: '', hsn: '', qty: 1, unit: 'panel', rate: 0, discountPct: 0, taxRate: 18, pricingMode: 'flat', widthFt: 0, heightFt: 0 };
}

function refreshClientDropdown(selectEl, currentId){
  const sel = selectEl || $('#qf-client');
  let html = '<option value="">Select a client…</option>' + state.clients.map(function(c){
    return '<option value="' + c.id + '">' + escapeHtml(c.name) + (c.company ? ' — ' + escapeHtml(c.company) : '') + '</option>';
  }).join('');
  if(currentId && !clientById(currentId)){
    html += '<option value="' + currentId + '">(deleted client — pick a replacement)</option>';
  }
  sel.innerHTML = html;
}

function refreshVendorDropdown(selectEl, currentId){
  const sel = selectEl || $('#pf-vendor');
  let html = '<option value="">Select a vendor…</option>' + state.vendors.map(function(v){
    return '<option value="' + v.id + '">' + escapeHtml(v.name) + (v.company ? ' — ' + escapeHtml(v.company) : '') + '</option>';
  }).join('');
  if(currentId && !vendorById(currentId)){
    html += '<option value="' + currentId + '">(deleted vendor — pick a replacement)</option>';
  }
  sel.innerHTML = html;
}

function renderQuotationForm(param){
  const editing = param && param !== 'new';
  const existing = editing ? state.quotations.find(function(q){ return q.id === param; }) : null;

  if(existing){
    qfState = JSON.parse(JSON.stringify(existing));
    $('#qf-eyebrow').textContent = 'Edit';
    $('#qf-title').textContent = existing.number;
  } else {
    qfState = {
      id: null, number: nextQuotationNumberPreview(), date: todayISO(),
      validUntil: addDaysISO(todayISO(), state.settings.defaultValidityDays || 15),
      reference: '', clientId: '', subject: '', taxType: 'intra',
      lines: [blankLine()], notes: '', terms: state.settings.defaultTerms, status: 'Draft', adjustment: 0,
    };
    $('#qf-eyebrow').textContent = 'New';
    $('#qf-title').textContent = 'Quotation';
  }

  $('#qf-number').value = qfState.number;
  $('#qf-date').value = qfState.date;
  $('#qf-validuntil').value = qfState.validUntil;
  $('#qf-reference').value = qfState.reference || '';
  $('#qf-subject').value = qfState.subject || '';
  $('#qf-taxtype').value = qfState.taxType;
  $('#qf-notes').value = qfState.notes || '';
  $('#qf-terms').value = qfState.terms || '';

  refreshClientDropdown($('#qf-client'), qfState.clientId);
  $('#qf-client').value = qfState.clientId || '';

  renderQfLines();
  renderQfTotals();
}

function genericLineRowHtml(line, idPrefix, updateFnName, removeFnName, pickFnName){
  const pickedItem = line.itemId ? itemById(line.itemId) : null;
  const isCustom = !pickedItem;
  const isSqft = line.pricingMode === 'sqft';
  let html = '<tr data-line-id="' + line.id + '"><td>';
  if(pickFnName){
    const itemOptions = '<option value="">Custom line…</option>' + state.items.map(function(it){
      return '<option value="' + it.id + '"' + (line.itemId === it.id ? ' selected' : '') + '>' + escapeHtml(it.name) + (it.pricingMode === 'sqft' ? ' (per sqft)' : '') + '</option>';
    }).join('');
    html += '<select class="line-item-select" onchange="' + pickFnName + '(\'' + line.id + '\', this.value)">' + itemOptions + '</select>';
    if(line.itemId && !pickedItem){
      html += '<div style="font-size:11px;color:var(--danger);margin-top:4px">Original catalog item was deleted — edit the name below</div>';
    }
  }
  if(isCustom || !pickFnName){
    html += '<input type="text" placeholder="Line name" value="' + escapeHtml(line.name || '') + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'name\',this.value)" style="margin-top:6px">';
  }
  html += '<input type="text" placeholder="Description (optional)" value="' + escapeHtml(line.description || '') + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'description\',this.value)" style="margin-top:6px">';
  html += '<input type="text" placeholder="HSN/SAC (optional)" value="' + escapeHtml(line.hsn || '') + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'hsn\',this.value)" style="margin-top:6px;max-width:140px">';
  if(isCustom || !pickFnName){
    html += '<label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:var(--ink-muted);font-weight:500">'
      + '<input type="checkbox" ' + (isSqft ? 'checked' : '') + ' onchange="' + updateFnName + '(\'' + line.id + '\',\'pricingMode\',this.checked?\'sqft\':\'flat\')" style="width:auto">'
      + 'Price by sqft</label>';
  }
  if(isSqft){
    html += '<div style="display:flex;align-items:center;gap:4px;margin-top:6px;flex-wrap:wrap">'
      + '<input type="number" min="0" step="0.01" placeholder="Width ft" value="' + (line.widthFt || '') + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'widthFt\',this.value)" style="width:70px">'
      + '<span style="color:var(--ink-muted)">\u00D7</span>'
      + '<input type="number" min="0" step="0.01" placeholder="Height ft" value="' + (line.heightFt || '') + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'heightFt\',this.value)" style="width:70px">'
      + '<span class="line-sqft-hint" style="font-size:12px;color:var(--ink-muted)">= ' + lineSqft(line).toFixed(2) + ' sqft/panel</span>'
      + '</div>';
  }
  html += '</td>';
  html += '<td><input type="number" min="0" step="1" value="' + line.qty + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'qty\',this.value)" title="' + (isSqft ? 'Number of panels' : 'Quantity') + '">'
    + (isSqft ? '<div class="line-sqft-total" style="font-size:11px;color:var(--deep);font-weight:600;margin-top:3px;white-space:nowrap">' + lineEffectiveQty(line).toFixed(2) + ' sqft</div>' : '')
    + '</td>';
  html += '<td><input type="text" value="' + escapeHtml(line.unit) + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'unit\',this.value)"></td>';
  html += '<td><input type="number" min="0" step="0.01" value="' + line.rate + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'rate\',this.value)" title="' + (isSqft ? 'Rate per sqft' : 'Rate') + '"></td>';
  html += '<td><input type="number" min="0" max="100" step="0.01" value="' + line.discountPct + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'discountPct\',this.value)"></td>';
  html += '<td><input type="number" min="0" max="100" step="0.01" value="' + line.taxRate + '" oninput="' + updateFnName + '(\'' + line.id + '\',\'taxRate\',this.value)"></td>';
  html += '<td class="num col-amount">' + formatCurrency(lineAmount(line)) + '</td>';
  html += '<td><button type="button" class="btn-icon danger" title="Remove line" onclick="' + removeFnName + '(\'' + line.id + '\')">\u2715</button></td>';
  html += '</tr>';
  return html;
}

function renderQfLines(){
  $('#qf-lines-tbody').innerHTML = qfState.lines.map(function(l){ return genericLineRowHtml(l, 'qf', 'updateLine', 'removeLine', 'onLineItemPick'); }).join('');
  $('#qf-lines-empty').hidden = qfState.lines.length > 0;
}
function renderTotalsCard(targetSel, doc, adjustFnName){
  const t = calcTotals(doc);
  const isInter = doc.taxType === 'inter';
  let html = '<div class="t-row"><span>Subtotal</span><span class="val">' + formatCurrency(t.subTotal) + '</span></div>';
  if(isInter){
    html += '<div class="t-row"><span>IGST</span><span class="val">' + formatCurrency(t.igst) + '</span></div>';
  } else {
    html += '<div class="t-row"><span>CGST</span><span class="val">' + formatCurrency(t.cgst) + '</span></div>';
    html += '<div class="t-row"><span>SGST</span><span class="val">' + formatCurrency(t.sgst) + '</span></div>';
  }
  if(adjustFnName){
    html += '<div class="t-row"><span>Adjustment <span class="optional">(rounding)</span></span><span class="val">'
      + '<input type="number" step="0.01" value="' + (doc.adjustment || 0) + '" oninput="' + adjustFnName + '(this.value)" style="width:100px;text-align:right;border:1px solid var(--border-strong);border-radius:3px;padding:4px 6px;font-family:var(--font-mono)"></span></div>';
  } else if(doc.adjustment){
    html += '<div class="t-row"><span>Adjustment</span><span class="val">' + formatCurrency(doc.adjustment) + '</span></div>';
  }
  html += '<div class="t-row grand"><span>Total</span><span class="val">' + formatCurrency(t.grandTotal + (Number(doc.adjustment) || 0)) + '</span></div>';
  $(targetSel).innerHTML = html;
}
function renderQfTotals(){ renderTotalsCard('#qf-totals', qfState, 'onAdjustQf'); }
function updateGrandTotalDisplay(targetSel, doc){
  const el = document.querySelector(targetSel + ' .t-row.grand .val');
  if(el) el.textContent = formatCurrency(calcTotals(doc).grandTotal + (Number(doc.adjustment) || 0));
}
function onAdjustQf(value){ qfState.adjustment = parseFloat(value) || 0; updateGrandTotalDisplay('#qf-totals', qfState); }

function onLineItemPick(lineId, itemId){
  const line = qfState.lines.find(function(l){ return l.id === lineId; });
  if(!line) return;
  if(itemId){
    const it = itemById(itemId);
    line.itemId = itemId; line.name = it.name; line.description = it.description || '';
    line.rate = it.rate; line.taxRate = it.taxRate; line.unit = it.unit;
    line.pricingMode = it.pricingMode || 'flat'; line.hsn = it.hsn || '';
  } else { line.itemId = ''; }
  renderQfLines();
  renderQfTotals();
}

function updateLineField(line, field, value){
  const numericFields = ['qty', 'rate', 'discountPct', 'taxRate', 'widthFt', 'heightFt'];
  if(numericFields.indexOf(field) !== -1){ line[field] = parseFloat(value) || 0; }
  else { line[field] = value; }
}

function refreshLineRowDisplay(lineId, line){
  const row = document.querySelector('tr[data-line-id="' + lineId + '"]');
  if(!row) return;
  const amtCell = row.querySelector('.col-amount');
  if(amtCell) amtCell.textContent = formatCurrency(lineAmount(line));
  const hintEl = row.querySelector('.line-sqft-hint');
  if(hintEl) hintEl.textContent = '= ' + lineSqft(line).toFixed(2) + ' sqft/panel';
  const totalEl = row.querySelector('.line-sqft-total');
  if(totalEl) totalEl.textContent = lineEffectiveQty(line).toFixed(2) + ' sqft';
}

function updateLine(lineId, field, value){
  const line = qfState.lines.find(function(l){ return l.id === lineId; });
  if(!line) return;
  updateLineField(line, field, value);
  if(field === 'pricingMode'){ renderQfLines(); }
  else { refreshLineRowDisplay(lineId, line); }
  renderQfTotals();
}
function addLine(){ qfState.lines.push(blankLine()); renderQfLines(); renderQfTotals(); }
function removeLine(lineId){
  qfState.lines = qfState.lines.filter(function(l){ return l.id !== lineId; });
  if(qfState.lines.length === 0) qfState.lines.push(blankLine());
  renderQfLines(); renderQfTotals();
}

function bindQuotationFormFieldEvents(){
  $('#qf-number').addEventListener('input', function(e){ qfState.number = e.target.value; });
  $('#qf-date').addEventListener('input', function(e){ qfState.date = e.target.value; });
  $('#qf-validuntil').addEventListener('input', function(e){ qfState.validUntil = e.target.value; });
  $('#qf-reference').addEventListener('input', function(e){ qfState.reference = e.target.value; });
  $('#qf-subject').addEventListener('input', function(e){ qfState.subject = e.target.value; });
  $('#qf-notes').addEventListener('input', function(e){ qfState.notes = e.target.value; });
  $('#qf-terms').addEventListener('input', function(e){ qfState.terms = e.target.value; });
  $('#qf-client').addEventListener('change', function(e){
    qfState.clientId = e.target.value;
    const tt = taxTypeForState(clientById(e.target.value) ? clientById(e.target.value).state : null);
    if(tt){ qfState.taxType = tt; $('#qf-taxtype').value = tt; renderQfTotals(); }
  });
  $('#qf-taxtype').addEventListener('change', function(e){ qfState.taxType = e.target.value; renderQfTotals(); });
}

async function saveQuotation(status){
  if(!qfState.clientId){ showToast('Please select a client'); return; }
  const hasContent = qfState.lines.some(function(l){ return l.itemId || (l.name && l.name.trim()); });
  if(!hasContent){ showToast('Add at least one line item'); return; }
  if(!requireBackend()) return;
  let effectiveStatus = status;
  if(status === 'Sent' && (qfState.status === 'Accepted' || qfState.status === 'Declined')){
    /* editing an already-decided quotation: keep its outcome, just save the edited content */
    effectiveStatus = qfState.status;
  }
  const isNew = !qfState.id;
  const payload = linesPayload(qfState.lines);
  const btn = $('#btn-save-draft');
  if(btn) btn.disabled = true;
  let res;
  if(isNew){
    res = await supabaseClient.rpc('create_quotation', {
      p_business_id: currentBusinessId, p_client_id: qfState.clientId, p_date: qfState.date,
      p_valid_until: qfState.validUntil || null, p_reference: qfState.reference || '',
      p_subject: qfState.subject || '', p_tax_type: qfState.taxType, p_notes: qfState.notes || '',
      p_terms: qfState.terms || '', p_status: effectiveStatus, p_adjustment: Number(qfState.adjustment) || 0,
      p_lines: payload,
    });
  } else {
    res = await supabaseClient.rpc('update_quotation', {
      p_quotation_id: qfState.id, p_client_id: qfState.clientId, p_date: qfState.date,
      p_valid_until: qfState.validUntil || null, p_reference: qfState.reference || '',
      p_subject: qfState.subject || '', p_tax_type: qfState.taxType, p_notes: qfState.notes || '',
      p_terms: qfState.terms || '', p_status: effectiveStatus, p_adjustment: Number(qfState.adjustment) || 0,
      p_lines: payload,
    });
  }
  if(btn) btn.disabled = false;
  if(res.error){ showToast('Could not save quotation: ' + res.error.message); return; }
  const saved = await fetchQuotationById(res.data.id);
  const idx = state.quotations.findIndex(function(q){ return q.id === saved.id; });
  if(idx >= 0) state.quotations[idx] = saved; else state.quotations.push(saved);
  if(isNew) await reloadSettings();
  persist();
  showToast(status === 'Draft' ? 'Saved as draft' : 'Quotation saved');
  location.hash = '#quotation-view/' + saved.id;
}

function quotationRowHtml(q, showActions){
  const c = clientById(q.clientId);
  const status = computeEffectiveStatus(q);
  let html = '<tr onclick="location.hash=\'#quotation-view/' + q.id + '\'" style="cursor:pointer">';
  html += '<td class="mono">' + escapeHtml(q.number) + '</td>';
  html += '<td>' + escapeHtml(c ? c.name : '—') + '</td>';
  html += '<td>' + formatDateDisplay(q.date) + '</td>';
  if(showActions) html += '<td>' + formatDateDisplay(q.validUntil) + '</td>';
  html += '<td class="num">' + formatCurrency(quotationTotal(q)) + '</td>';
  html += '<td>' + statusBadge(status) + '</td>';
  if(showActions){
    html += '<td class="row-actions">'
      + '<button class="btn-icon" title="View" onclick="event.stopPropagation();location.hash=\'#quotation-view/' + q.id + '\'">\uD83D\uDC41</button>'
      + '<button class="btn-icon" title="Edit" onclick="event.stopPropagation();location.hash=\'#quotation-form/' + q.id + '\'">\u270E</button>'
      + '<button class="btn-icon" title="More" onclick="event.stopPropagation();openQuotationRowMenu(this,\'' + q.id + '\')">\u22EE</button>'
      + '</td>';
  }
  html += '</tr>';
  return html;
}

function renderQuotationsList(){
  const panel = $('#view-quotations .panel');
  const statusFilter = $('#qlist-status-filter').value;
  const search = $('#qlist-search').value;
  let list = state.quotations.slice();
  if(statusFilter) list = list.filter(function(q){ return computeEffectiveStatus(q) === statusFilter; });
  list = filterBySearch(list, search, [
    function(q){ return q.number; },
    function(q){ const c = clientById(q.clientId); return c ? c.name : ''; }
  ]);
  const sortField = $('#qlist-sort-field').value;
  const getters = {
    date: function(q){ return q.date || ''; },
    number: function(q){ return (q.number || '').toLowerCase(); },
    client: function(q){ const c = clientById(q.clientId); return c ? c.name.toLowerCase() : ''; },
    cost: function(q){ return quotationTotal(q); },
  };
  list = sortByField(list, getters[sortField] || getters.date, sortDirOf('qlist-sort-dir'));
  $('#quotations-tbody').innerHTML = list.map(function(q){ return quotationRowHtml(q, true); }).join('');
  toggleTableEmpty(panel, $('#quotations-empty'), list.length === 0);
}

async function duplicateQuotation(id){
  const q = state.quotations.find(function(x){ return x.id === id; });
  if(!q) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.rpc('create_quotation', {
    p_business_id: currentBusinessId, p_client_id: q.clientId, p_date: todayISO(),
    p_valid_until: addDaysISO(todayISO(), state.settings.defaultValidityDays || 15),
    p_reference: q.reference || '', p_subject: q.subject || '', p_tax_type: q.taxType,
    p_notes: q.notes || '', p_terms: q.terms || '', p_status: 'Draft', p_adjustment: Number(q.adjustment) || 0,
    p_lines: linesPayload(q.lines),
  });
  if(res.error){ showToast('Could not duplicate quotation: ' + res.error.message); return; }
  const saved = await fetchQuotationById(res.data.id);
  state.quotations.push(saved);
  await reloadSettings();
  persist();
  showToast('Quotation duplicated');
  location.hash = '#quotation-form/' + saved.id;
}

async function deleteQuotation(id){
  if(!confirm('Delete this quotation? This cannot be undone.')) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.from('quotations').delete().eq('id', id);
  if(res.error){ showToast('Could not delete quotation: ' + res.error.message); return; }
  state.quotations = state.quotations.filter(function(q){ return q.id !== id; });
  persist();
  renderQuotationsList();
  showToast('Quotation deleted');
}

let currentViewingQuotationId = null;

function documentPrintHtml(opts){
  const s = state.settings;
  const doc = opts.doc;
  const t = calcTotals(doc);
  const isInter = doc.taxType === 'inter';
  const adjustment = Number(doc.adjustment) || 0;
  const finalTotal = t.grandTotal + adjustment;

  const taxHeadCells = isInter ? '<th class="num" colspan="2">IGST</th>' : '<th class="num" colspan="2">CGST</th><th class="num" colspan="2">SGST</th>';
  const taxSubCells = isInter
    ? '<th class="num">%</th><th class="num">Amt</th>'
    : '<th class="num">%</th><th class="num">Amt</th><th class="num">%</th><th class="num">Amt</th>';

  const linesHtml = doc.lines.map(function(l, idx){
    const nm = l.name || (l.itemId && itemById(l.itemId) ? itemById(l.itemId).name : 'Item');
    const isSqft = l.pricingMode === 'sqft';
    const sizeInfo = isSqft ? ('<div class="item-size">(' + (l.widthFt || 0) + "' \u00D7 " + (l.heightFt || 0) + "')</div>") : '';
    const qtyDisplay = l.qty + ' ' + escapeHtml(l.unit || '');
    const lineTax = lineAmount(l) * clampPct(l.taxRate) / 100;
    const taxCells = isInter
      ? '<td class="num">' + clampPct(l.taxRate) + '%</td><td class="num">' + formatNumber(lineTax) + '</td>'
      : '<td class="num">' + (clampPct(l.taxRate) / 2) + '%</td><td class="num">' + formatNumber(lineTax / 2) + '</td>'
        + '<td class="num">' + (clampPct(l.taxRate) / 2) + '%</td><td class="num">' + formatNumber(lineTax / 2) + '</td>';
    return '<tr><td class="num">' + (idx + 1) + '</td>'
      + '<td>' + escapeHtml(nm) + sizeInfo + (l.description ? '<div class="item-desc">' + escapeHtml(l.description) + '</div>' : '') + '</td>'
      + '<td>' + escapeHtml(l.hsn || '') + '</td>'
      + '<td class="num">' + qtyDisplay + '</td>'
      + '<td class="num">' + formatNumber(lineDisplayRate(l)) + '</td>'
      + taxCells
      + '<td class="num">' + formatNumber(lineAmount(l)) + '</td></tr>';
  }).join('');

  let html = '<div class="pd-box">';

  html += '<div class="pd-header"><div>';
  html += '<div class="pd-brand-name">' + escapeHtml((s.businessName || '').toUpperCase()) + '</div>';
  html += '<div class="pd-brand-meta">' + escapeHtml(s.address) + (endsWithIndia(s.address) ? '' : '<br>India');
  if(s.gstin) html += '<br>GSTIN ' + escapeHtml(s.gstin);
  html += '<br>' + escapeHtml(s.phone) + '<br>' + escapeHtml(s.email) + '</div></div>';
  html += '<div class="pd-doctype">' + escapeHtml(opts.docTypeLabel) + '</div>';
  html += '</div>';

  const endDateVal = doc.validUntil || doc.dueDate || doc.expectedDate;
  html += '<div class="pd-meta-row"><div class="pd-meta-col">'
    + '<div class="pd-kv"><span class="k">#:</span><span class="v">' + escapeHtml(doc.number) + '</span></div>'
    + '<div class="pd-kv"><span class="k">' + escapeHtml(opts.dateLabel) + ':</span><span class="v">' + formatDateDisplay(doc.date) + '</span></div>';
  if(endDateVal) html += '<div class="pd-kv"><span class="k">' + escapeHtml(opts.endDateLabel) + ':</span><span class="v">' + formatDateDisplay(endDateVal) + '</span></div>';
  if(doc.reference) html += '<div class="pd-kv"><span class="k">Reference:</span><span class="v">' + escapeHtml(doc.reference) + '</span></div>';
  html += '</div><div class="pd-meta-col">';
  if(opts.placeOfSupply){
    const code = STATE_GST_CODES[opts.placeOfSupply];
    html += '<div class="pd-kv"><span class="k">Place Of Supply:</span><span class="v">' + escapeHtml(opts.placeOfSupply) + (code ? ' (' + code + ')' : '') + '</span></div>';
  }
  html += '</div></div>';

  html += '<div class="pd-parties"><div class="pd-party"><div class="pd-label">' + escapeHtml(opts.leftLabel) + '</div>' + opts.leftLinesHtml + '</div>';
  html += '<div class="pd-party"><div class="pd-label">' + escapeHtml(opts.rightLabel) + '</div>' + opts.rightLinesHtml + '</div></div>';

  html += '</div>'; /* end pd-box */

  if(doc.subject) html += '<div class="pd-subject">' + escapeHtml(doc.subject) + '</div>';

  const colgroup = isInter
    ? '<colgroup><col style="width:3%"><col style="width:40%"><col style="width:9%"><col style="width:8%"><col style="width:10%"><col style="width:6%"><col style="width:10%"><col style="width:14%"></colgroup>'
    : '<colgroup><col style="width:3%"><col style="width:34%"><col style="width:8%"><col style="width:7%"><col style="width:9%"><col style="width:5%"><col style="width:8%"><col style="width:5%"><col style="width:8%"><col style="width:13%"></colgroup>';

  html += '<table class="pd-table">' + colgroup + '<thead>'
    + '<tr><th class="pd-col-num">#</th><th>Item &amp; Description</th><th class="pd-col-hsn">HSN/SAC</th><th class="pd-col-qty num">Qty</th><th class="pd-col-rate num">Rate</th>' + taxHeadCells + '<th class="pd-col-amount num">Amount</th></tr>'
    + '<tr class="pd-subhead"><th></th><th></th><th></th><th></th><th></th>' + taxSubCells + '<th></th></tr>'
    + '</thead><tbody>' + linesHtml + '</tbody></table>';

  html += '<div class="pd-bottom"><div class="pd-bottom-left">';
  html += '<div class="pd-words">Total In Words<br>' + escapeHtml(amountInWords(finalTotal)) + '</div>';
  if(doc.notes) html += '<div class="pd-notes"><strong>Notes</strong><br>' + escapeHtml(doc.notes) + '</div>';
  const termLines = (doc.terms || '').split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  if(termLines.length){
    html += '<div class="pd-terms-title">Terms &amp; Conditions</div><ul class="pd-terms-list">' + termLines.map(function(l){ return '<li>' + escapeHtml(l) + '</li>'; }).join('') + '</ul>';
  }
  html += '<div class="pd-thankyou">Thank you!</div>';
  html += '</div>';

  html += '<div class="pd-totals-box">';
  html += '<div class="pt-row"><span>Sub Total</span><span class="val">' + formatNumber(t.subTotal) + '</span></div>';
  const uniformRate = uniformTaxRate(doc.lines);
  if(isInter){
    html += '<div class="pt-row"><span>IGST' + (uniformRate != null ? ' (' + uniformRate + '%)' : '') + '</span><span class="val">' + formatNumber(t.igst) + '</span></div>';
  } else {
    const halfRate = uniformRate != null ? ' (' + (uniformRate / 2) + '%)' : '';
    html += '<div class="pt-row"><span>CGST' + halfRate + '</span><span class="val">' + formatNumber(t.cgst) + '</span></div>';
    html += '<div class="pt-row"><span>SGST' + halfRate + '</span><span class="val">' + formatNumber(t.sgst) + '</span></div>';
  }
  if(adjustment) html += '<div class="pt-row"><span>Adjustment</span><span class="val">' + (adjustment < 0 ? '(-) ' : '') + formatNumber(Math.abs(adjustment)) + '</span></div>';
  html += '<div class="pt-row grand"><span>Total</span><span class="val">' + formatCurrency(finalTotal) + '</span></div>';
  if(opts.paymentSummaryHtml) html += opts.paymentSummaryHtml;
  html += '</div>'; /* end pd-totals-box */
  html += '</div>'; /* end pd-bottom */

  html += '<div class="pd-signoff"><div class="sign-line">Authorized Signatory</div></div>';
  return html;
}

function endsWithIndia(s){
  return /india\s*$/i.test((s || '').trim());
}
function partyLinesHtml(party, opts){
  opts = opts || {};
  if(!party) return '<div class="pd-line">\u2014</div>';
  let html = '';
  if(opts.includeName !== false) html += '<div class="pd-name">' + escapeHtml(party.name || '') + '</div>';
  if(party.company) html += '<div class="pd-line">' + escapeHtml(party.company) + '</div>';
  const addr = opts.addressOverride != null ? opts.addressOverride : party.address;
  if(addr) html += '<div class="pd-line">' + escapeHtml(addr) + '</div>';
  if(party.state) html += '<div class="pd-line">' + escapeHtml(party.state) + '</div>';
  if(!endsWithIndia(addr) && !endsWithIndia(party.state)) html += '<div class="pd-line">India</div>';
  if(!opts.skipGstin && party.gstin) html += '<div class="pd-line">GSTIN ' + escapeHtml(party.gstin) + '</div>';
  if(!opts.skipPhone && party.phone) html += '<div class="pd-line">' + escapeHtml(party.phone) + '</div>';
  return html;
}
function shipToLinesHtml(client){
  if(!client) return '<div class="pd-line">\u2014</div>';
  if(client.shipAddress){
    return partyLinesHtml({ address: client.shipAddress, state: client.state }, { includeName: false, skipGstin: true, skipPhone: true });
  }
  return partyLinesHtml(client, { includeName: false, skipGstin: true, skipPhone: true });
}

function renderQuotationView(id){
  const q = state.quotations.find(function(x){ return x.id === id; });
  if(!q){ location.hash = '#quotations'; return; }
  currentViewingQuotationId = id;
  const status = computeEffectiveStatus(q);
  $('#qv-heading').textContent = q.number;

  const statusOptions = QUOTATION_STATUSES.filter(function(st){ return st !== 'Expired'; }).map(function(st){
    return '<option value="' + st + '"' + (q.status === st ? ' selected' : '') + '>' + st + '</option>';
  }).join('');
  $('#qv-status-bar').innerHTML = '<span>Status:</span> ' + statusBadge(status) + ' <select id="qv-status-select">' + statusOptions + '</select>';
  bindStatusSelect($('#qv-status-select'), 'quotations', q, function(){ renderQuotationView(id); });

  $('#print-doc').innerHTML = documentPrintHtml({
    doc: q, docTypeLabel: 'QUOTE', dateLabel: 'Quote Date', endDateLabel: 'Expiry Date',
    placeOfSupply: (clientById(q.clientId) || {}).state || null,
    leftLabel: 'Bill To', leftLinesHtml: partyLinesHtml(clientById(q.clientId)),
    rightLabel: 'Ship To', rightLinesHtml: shipToLinesHtml(clientById(q.clientId)),
  });
}

/* ---------- Invoices ---------- */
let ifState = null;

function nextInvoiceNumberPreview(){
  const n = state.settings.nextInvoiceNumber || 1;
  return (state.settings.invoicePrefix || 'CC-INV-') + String(n).padStart(4, '0');
}

function renderInvoiceForm(param){
  const editing = param && param !== 'new';
  const existing = editing ? state.invoices.find(function(i){ return i.id === param; }) : null;

  if(existing){
    ifState = JSON.parse(JSON.stringify(existing));
    $('#if-eyebrow').textContent = 'Edit';
    $('#if-title').textContent = existing.number;
  } else {
    ifState = {
      id: null, number: nextInvoiceNumberPreview(), date: todayISO(),
      dueDate: addDaysISO(todayISO(), state.settings.defaultInvoiceDueDays || 7),
      reference: '', clientId: '', subject: '', taxType: 'intra',
      lines: [blankLine()], notes: '', terms: state.settings.defaultInvoiceTerms,
      status: 'Draft', payments: [], quotationId: null, adjustment: 0,
    };
    $('#if-eyebrow').textContent = 'New';
    $('#if-title').textContent = 'Invoice';
  }

  $('#if-number').value = ifState.number;
  $('#if-date').value = ifState.date;
  $('#if-duedate').value = ifState.dueDate;
  $('#if-reference').value = ifState.reference || '';
  $('#if-subject').value = ifState.subject || '';
  $('#if-taxtype').value = ifState.taxType;
  $('#if-notes').value = ifState.notes || '';
  $('#if-terms').value = ifState.terms || '';

  refreshClientDropdown($('#if-client'), ifState.clientId);
  $('#if-client').value = ifState.clientId || '';

  if(ifState.quotationId){
    const q = state.quotations.find(function(x){ return x.id === ifState.quotationId; });
    $('#if-source-note').hidden = false;
    $('#if-source-note').textContent = 'Converted from quotation ' + (q ? q.number : ifState.quotationId) + '.';
  } else {
    $('#if-source-note').hidden = true;
  }

  renderIfLines();
  renderIfTotals();
}

function renderIfLines(){
  $('#if-lines-tbody').innerHTML = ifState.lines.map(function(l){ return genericLineRowHtml(l, 'if', 'updateIfLine', 'removeIfLine', 'onIfLineItemPick'); }).join('');
  $('#if-lines-empty').hidden = ifState.lines.length > 0;
}
function renderIfTotals(){ renderTotalsCard('#if-totals', ifState, 'onAdjustIf'); }
function onAdjustIf(value){ ifState.adjustment = parseFloat(value) || 0; updateGrandTotalDisplay('#if-totals', ifState); }

function onIfLineItemPick(lineId, itemId){
  const line = ifState.lines.find(function(l){ return l.id === lineId; });
  if(!line) return;
  if(itemId){
    const it = itemById(itemId);
    line.itemId = itemId; line.name = it.name; line.description = it.description || '';
    line.rate = it.rate; line.taxRate = it.taxRate; line.unit = it.unit;
    line.pricingMode = it.pricingMode || 'flat'; line.hsn = it.hsn || '';
  } else { line.itemId = ''; }
  renderIfLines(); renderIfTotals();
}
function updateIfLine(lineId, field, value){
  const line = ifState.lines.find(function(l){ return l.id === lineId; });
  if(!line) return;
  updateLineField(line, field, value);
  if(field === 'pricingMode'){ renderIfLines(); }
  else { refreshLineRowDisplay(lineId, line); }
  renderIfTotals();
}
function addIfLine(){ ifState.lines.push(blankLine()); renderIfLines(); renderIfTotals(); }
function removeIfLine(lineId){
  ifState.lines = ifState.lines.filter(function(l){ return l.id !== lineId; });
  if(ifState.lines.length === 0) ifState.lines.push(blankLine());
  renderIfLines(); renderIfTotals();
}

function bindInvoiceFormFieldEvents(){
  $('#if-number').addEventListener('input', function(e){ ifState.number = e.target.value; });
  $('#if-date').addEventListener('input', function(e){ ifState.date = e.target.value; });
  $('#if-duedate').addEventListener('input', function(e){ ifState.dueDate = e.target.value; });
  $('#if-reference').addEventListener('input', function(e){ ifState.reference = e.target.value; });
  $('#if-subject').addEventListener('input', function(e){ ifState.subject = e.target.value; });
  $('#if-notes').addEventListener('input', function(e){ ifState.notes = e.target.value; });
  $('#if-terms').addEventListener('input', function(e){ ifState.terms = e.target.value; });
  $('#if-client').addEventListener('change', function(e){
    ifState.clientId = e.target.value;
    const tt = taxTypeForState(clientById(e.target.value) ? clientById(e.target.value).state : null);
    if(tt){ ifState.taxType = tt; $('#if-taxtype').value = tt; renderIfTotals(); }
  });
  $('#if-taxtype').addEventListener('change', function(e){ ifState.taxType = e.target.value; renderIfTotals(); });
}

async function saveInvoice(status){
  if(!ifState.clientId){ showToast('Please select a client'); return; }
  const hasContent = ifState.lines.some(function(l){ return l.itemId || (l.name && l.name.trim()); });
  if(!hasContent){ showToast('Add at least one line item'); return; }
  if(!requireBackend()) return;
  let effectiveStatus = status;
  if(status === 'Sent' && ifState.status === 'Cancelled'){
    /* editing a cancelled invoice: keep it cancelled, just save the edited content */
    effectiveStatus = ifState.status;
  }
  const isNew = !ifState.id;
  const payload = linesPayload(ifState.lines);
  const btn = $('#btn-save-draft-inv');
  if(btn) btn.disabled = true;
  let res;
  if(isNew){
    res = await supabaseClient.rpc('create_invoice', {
      p_business_id: currentBusinessId, p_client_id: ifState.clientId, p_date: ifState.date,
      p_due_date: ifState.dueDate || null, p_reference: ifState.reference || '', p_subject: ifState.subject || '',
      p_tax_type: ifState.taxType, p_notes: ifState.notes || '', p_terms: ifState.terms || '',
      p_status: effectiveStatus, p_adjustment: Number(ifState.adjustment) || 0,
      p_quotation_id: ifState.quotationId || null, p_lines: payload,
    });
  } else {
    res = await supabaseClient.rpc('update_invoice', {
      p_invoice_id: ifState.id, p_client_id: ifState.clientId, p_date: ifState.date,
      p_due_date: ifState.dueDate || null, p_reference: ifState.reference || '', p_subject: ifState.subject || '',
      p_tax_type: ifState.taxType, p_notes: ifState.notes || '', p_terms: ifState.terms || '',
      p_status: effectiveStatus, p_adjustment: Number(ifState.adjustment) || 0, p_lines: payload,
    });
  }
  if(btn) btn.disabled = false;
  if(res.error){ showToast('Could not save invoice: ' + res.error.message); return; }
  const saved = await fetchInvoiceById(res.data.id);
  const idx = state.invoices.findIndex(function(i){ return i.id === saved.id; });
  if(idx >= 0) state.invoices[idx] = saved; else state.invoices.push(saved);
  if(isNew) await reloadSettings();
  persist();
  showToast(status === 'Draft' ? 'Saved as draft' : 'Invoice saved');
  location.hash = '#invoice-view/' + saved.id;
}

function renderInvoicesList(){
  const panel = $('#view-invoices .panel');
  const statusFilter = $('#ilist-status-filter').value;
  const search = $('#ilist-search').value;
  let list = state.invoices.slice();
  if(statusFilter) list = list.filter(function(inv){ return computeInvoiceStatus(inv) === statusFilter; });
  list = filterBySearch(list, search, [
    function(inv){ return inv.number; },
    function(inv){ const c = clientById(inv.clientId); return c ? c.name : ''; }
  ]);
  const sortField = $('#ilist-sort-field').value;
  const getters = {
    date: function(inv){ return inv.date || ''; },
    number: function(inv){ return (inv.number || '').toLowerCase(); },
    client: function(inv){ const c = clientById(inv.clientId); return c ? c.name.toLowerCase() : ''; },
    cost: function(inv){ return quotationTotal(inv); },
  };
  list = sortByField(list, getters[sortField] || getters.date, sortDirOf('ilist-sort-dir'));
  $('#invoices-tbody').innerHTML = list.map(function(inv){ return invoiceRowHtml(inv, true); }).join('');
  toggleTableEmpty(panel, $('#invoices-empty'), list.length === 0);
}

async function deleteInvoice(id){
  if(!confirm('Delete this invoice? Any recorded payments on it will also be removed. This cannot be undone.')) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.from('invoices').delete().eq('id', id);
  if(res.error){ showToast('Could not delete invoice: ' + res.error.message); return; }
  state.invoices = state.invoices.filter(function(i){ return i.id !== id; });
  persist();
  renderInvoicesList();
  showToast('Invoice deleted');
}

async function duplicateInvoice(id){
  const inv = state.invoices.find(function(x){ return x.id === id; });
  if(!inv) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.rpc('create_invoice', {
    p_business_id: currentBusinessId, p_client_id: inv.clientId, p_date: todayISO(),
    p_due_date: addDaysISO(todayISO(), state.settings.defaultInvoiceDueDays || 7),
    p_reference: inv.reference || '', p_subject: inv.subject || '', p_tax_type: inv.taxType,
    p_notes: inv.notes || '', p_terms: inv.terms || '', p_status: 'Draft',
    p_adjustment: Number(inv.adjustment) || 0, p_quotation_id: null, p_lines: linesPayload(inv.lines),
  });
  if(res.error){ showToast('Could not duplicate invoice: ' + res.error.message); return; }
  const saved = await fetchInvoiceById(res.data.id);
  state.invoices.push(saved);
  await reloadSettings();
  persist();
  showToast('Invoice duplicated');
  location.hash = '#invoice-form/' + saved.id;
}

let currentViewingInvoiceId = null;

function renderInvoiceView(id){
  const inv = state.invoices.find(function(x){ return x.id === id; });
  if(!inv){ location.hash = '#invoices'; return; }
  currentViewingInvoiceId = id;
  const status = computeInvoiceStatus(inv);
  $('#iv-heading').textContent = inv.number;

  const statusOptions = INVOICE_MANUAL_STATUSES.map(function(st){
    return '<option value="' + st + '"' + (inv.status === st ? ' selected' : '') + '>' + st + '</option>';
  }).join('');
  $('#iv-status-bar').innerHTML = '<span>Status:</span> ' + statusBadge(status)
    + ' <select id="iv-status-select">' + statusOptions + '</select>'
    + ' <span class="panel-note" style="margin:0 0 0 4px">(Paid / Partially Paid / Overdue are automatic, based on payments and due date)</span>';
  bindStatusSelect($('#iv-status-select'), 'invoices', inv, function(){ renderInvoiceView(id); });

  const paid = invoicePaid(inv);
  const balance = invoiceBalance(inv);
  const payRows = (inv.payments || []).slice().sort(function(a, b){ return (b.date || '').localeCompare(a.date || ''); }).map(function(p){
    return '<tr><td>' + formatDateDisplay(p.date) + '</td><td class="num">' + formatCurrency(p.amount) + '</td><td>' + escapeHtml(p.method || '') + '</td><td class="cell-muted">' + escapeHtml(p.notes || '') + '</td>'
      + '<td class="row-actions"><button class="btn-icon danger" title="Remove" onclick="deletePaymentFromInvoice(\'' + inv.id + '\',\'' + p.id + '\')">\u2715</button></td></tr>';
  }).join('');
  $('#iv-payments-panel').innerHTML = '<div class="panel-header"><h2>Payments</h2></div>'
    + (payRows ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th class="num">Amount</th><th>Method</th><th>Notes</th><th></th></tr></thead><tbody>' + payRows + '</tbody></table></div>'
       : '<p class="panel-note">No payments recorded yet.</p>')
    + '<div class="form-actions form-actions-left" style="margin-top:14px"><span class="panel-note" style="margin:0">Paid: <strong class="mono">' + formatCurrency(paid) + '</strong> &nbsp; Balance: <strong class="mono">' + formatCurrency(balance) + '</strong></span></div>';

  let paymentSummaryHtml = '';
  if(paid > 0){
    paymentSummaryHtml = '<div class="pt-row paid"><span>Paid</span><span class="val">' + formatNumber(paid) + '</span></div>'
      + '<div class="pt-row balance"><span>Balance Due</span><span class="val">' + formatNumber(balance) + '</span></div>';
  }

  $('#invoice-print-doc').innerHTML = documentPrintHtml({
    doc: inv, docTypeLabel: 'TAX INVOICE', dateLabel: 'Invoice Date', endDateLabel: 'Due Date',
    placeOfSupply: (clientById(inv.clientId) || {}).state || null,
    leftLabel: 'Bill To', leftLinesHtml: partyLinesHtml(clientById(inv.clientId)),
    rightLabel: 'Ship To', rightLinesHtml: shipToLinesHtml(clientById(inv.clientId)),
    paymentSummaryHtml: paymentSummaryHtml,
  });
}

async function deletePaymentFromInvoice(invId, paymentId){
  if(!confirm('Remove this payment record?')) return;
  const inv = state.invoices.find(function(i){ return i.id === invId; });
  if(!inv) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.from('payments').delete().eq('id', paymentId);
  if(res.error){ showToast('Could not remove payment: ' + res.error.message); return; }
  inv.payments = (inv.payments || []).filter(function(p){ return p.id !== paymentId; });
  persist();
  renderInvoiceView(invId);
  showToast('Payment removed');
}

async function convertQuotationToInvoice(quotationId){
  const q = state.quotations.find(function(x){ return x.id === quotationId; });
  if(!q) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.rpc('create_invoice', {
    p_business_id: currentBusinessId, p_client_id: q.clientId, p_date: todayISO(),
    p_due_date: addDaysISO(todayISO(), state.settings.defaultInvoiceDueDays || 7),
    p_reference: q.reference || '', p_subject: q.subject || '', p_tax_type: q.taxType,
    p_notes: q.notes || '', p_terms: state.settings.defaultInvoiceTerms || state.settings.defaultTerms || '',
    p_status: 'Draft', p_adjustment: 0, p_quotation_id: q.id, p_lines: linesPayload(q.lines),
  });
  if(res.error){ showToast('Could not create invoice: ' + res.error.message); return; }
  const saved = await fetchInvoiceById(res.data.id);
  state.invoices.push(saved);
  await reloadSettings();
  const statusRes = await supabaseClient.from('quotations').update({ status: 'Accepted' }).eq('id', quotationId);
  if(!statusRes.error) q.status = 'Accepted';
  persist();
  showToast('Invoice created from quotation');
  location.hash = '#invoice-form/' + saved.id;
}

/* ---------- Payments (aggregated) ---------- */
function getAllPayments(){
  const rows = [];
  state.invoices.forEach(function(inv){
    (inv.payments || []).forEach(function(p){
      rows.push(Object.assign({}, p, { invoiceId: inv.id, invoiceNumber: inv.number, clientId: inv.clientId }));
    });
  });
  return rows.sort(function(a, b){ return (b.date || '').localeCompare(a.date || ''); });
}

function renderPaymentsList(){
  const panel = $('#view-payments .panel');
  const search = $('#payments-search').value;
  let rows = filterBySearch(getAllPayments(), search, [
    function(p){ return p.invoiceNumber; },
    function(p){ const c = clientById(p.clientId); return c ? c.name : ''; }
  ]);
  const sortField = $('#payments-sort-field').value;
  const getters = {
    date: function(p){ return p.date || ''; },
    client: function(p){ const c = clientById(p.clientId); return c ? c.name.toLowerCase() : ''; },
    cost: function(p){ return Number(p.amount) || 0; },
  };
  rows = sortByField(rows, getters[sortField] || getters.date, sortDirOf('payments-sort-dir'));

  $('#payments-tbody').innerHTML = rows.map(function(p){
    const c = clientById(p.clientId);
    return '<tr>'
      + '<td>' + formatDateDisplay(p.date) + '</td>'
      + '<td class="mono">' + escapeHtml(p.invoiceNumber) + '</td>'
      + '<td>' + escapeHtml(c ? c.name : '—') + '</td>'
      + '<td class="num">' + formatCurrency(p.amount) + '</td>'
      + '<td>' + escapeHtml(p.method || '') + '</td>'
      + '<td class="cell-muted">' + escapeHtml(p.notes || '') + '</td>'
      + '<td class="row-actions"><button class="btn-icon" title="View Invoice" onclick="location.hash=\'#invoice-view/' + p.invoiceId + '\'">\uD83D\uDC41</button></td>'
      + '</tr>';
  }).join('');
  toggleTableEmpty(panel, $('#payments-empty'), rows.length === 0);
}

function invoiceOptionsForPayment(){
  return state.invoices.filter(function(inv){
    const st = computeInvoiceStatus(inv);
    return st !== 'Paid' && st !== 'Draft' && st !== 'Cancelled';
  });
}

function openRecordPaymentModal(prefillInvoiceId){
  const openInvoices = invoiceOptionsForPayment();
  if(openInvoices.length === 0){ showToast('No open invoices to record a payment against'); return; }
  const options = openInvoices.map(function(inv){
    const c = clientById(inv.clientId);
    return '<option value="' + inv.id + '"' + (inv.id === prefillInvoiceId ? ' selected' : '') + '>' + escapeHtml(inv.number) + ' — ' + escapeHtml(c ? c.name : '') + ' (Balance ' + formatCurrency(invoiceBalance(inv)) + ')</option>';
  }).join('');
  const methodOptions = PAYMENT_METHODS.map(function(m){ return '<option value="' + m + '">' + m + '</option>'; }).join('');
  openModal(
    '<h2>Record Payment</h2>' +
    '<div class="form-grid">' +
      '<div class="field field-wide"><label>Invoice</label><select id="pm-invoice" onchange="onPaymentInvoiceChange()">' + options + '</select></div>' +
      '<div class="field"><label>Amount (₹)</label><input type="number" id="pm-amount" min="0" step="0.01"></div>' +
      '<div class="field"><label>Date</label><input type="date" id="pm-date" value="' + todayISO() + '"></div>' +
      '<div class="field"><label>Method</label><select id="pm-method">' + methodOptions + '</select></div>' +
      '<div class="field field-wide"><label>Notes <span class="optional">(optional)</span></label><input id="pm-notes"></div>' +
    '</div>' +
    '<div class="form-actions">' +
      '<button type="button" class="btn btn-text" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-gold" onclick="saveRecordedPayment()">Record Payment</button>' +
    '</div>'
  );
  onPaymentInvoiceChange();
}

function onPaymentInvoiceChange(){
  const invId = $('#pm-invoice').value;
  const inv = state.invoices.find(function(i){ return i.id === invId; });
  if(!inv) return;
  $('#pm-amount').value = invoiceBalance(inv).toFixed(2);
}

async function saveRecordedPayment(){
  const invId = $('#pm-invoice').value;
  const inv = state.invoices.find(function(i){ return i.id === invId; });
  if(!inv){ showToast('Select an invoice'); return; }
  const amount = parseFloat($('#pm-amount').value) || 0;
  if(amount <= 0){ showToast('Enter a payment amount'); return; }
  const balance = invoiceBalance(inv);
  if(amount > balance + 0.005){
    if(!confirm('This payment (' + formatCurrency(amount) + ') is more than the remaining balance (' + formatCurrency(balance) + '). Record it anyway?')) return;
  }
  if(!requireBackend()) return;
  const res = await supabaseClient.from('payments').insert({
    invoice_id: invId, business_id: currentBusinessId,
    date: $('#pm-date').value || todayISO(), amount: amount,
    method: $('#pm-method').value, notes: $('#pm-notes').value.trim(),
  }).select().single();
  if(res.error){ showToast('Could not record payment: ' + res.error.message); return; }
  inv.payments = inv.payments || [];
  inv.payments.push(mapPaymentRow(res.data));
  persist();
  closeModal();
  showToast('Payment recorded');
  handleRoute();
}

/* ---------- Delivery Challan ---------- */
let dfState = null;

function nextDcNumberPreview(){
  const n = state.settings.nextDcNumber || 1;
  return (state.settings.dcPrefix || 'CC-DC-') + String(n).padStart(4, '0');
}

function renderDcForm(param){
  const editing = param && param !== 'new';
  const existing = editing ? state.deliveryChallans.find(function(d){ return d.id === param; }) : null;

  if(existing){
    dfState = JSON.parse(JSON.stringify(existing));
    $('#df-eyebrow').textContent = 'Edit';
    $('#df-title').textContent = existing.number;
  } else {
    dfState = {
      id: null, number: nextDcNumberPreview(), date: todayISO(),
      vehicleNumber: '', transportMode: '', invoiceId: null,
      reference: '', clientId: '', subject: '', taxType: 'intra',
      lines: [blankLine()], notes: '', terms: state.settings.defaultDcTerms, status: 'Draft', adjustment: 0,
    };
    $('#df-eyebrow').textContent = 'New';
    $('#df-title').textContent = 'Delivery Challan';
  }

  $('#df-number').value = dfState.number;
  $('#df-date').value = dfState.date;
  $('#df-vehicle').value = dfState.vehicleNumber || '';
  $('#df-transport').value = dfState.transportMode || '';
  $('#df-reference').value = dfState.reference || '';
  $('#df-subject').value = dfState.subject || '';
  $('#df-notes').value = dfState.notes || '';
  $('#df-terms').value = dfState.terms || '';

  refreshClientDropdown($('#df-client'), dfState.clientId);
  $('#df-client').value = dfState.clientId || '';

  if(dfState.invoiceId){
    const inv = state.invoices.find(function(x){ return x.id === dfState.invoiceId; });
    $('#df-source-note').hidden = false;
    $('#df-source-note').textContent = 'Created from invoice ' + (inv ? inv.number : dfState.invoiceId) + '.';
  } else {
    $('#df-source-note').hidden = true;
  }

  renderDfLines();
  renderDfTotals();
}

function renderDfLines(){
  $('#df-lines-tbody').innerHTML = dfState.lines.map(function(l){ return genericLineRowHtml(l, 'df', 'updateDfLine', 'removeDfLine', 'onDfLineItemPick'); }).join('');
  $('#df-lines-empty').hidden = dfState.lines.length > 0;
}
function renderDfTotals(){ renderTotalsCard('#df-totals', dfState, 'onAdjustDf'); }
function onAdjustDf(value){ dfState.adjustment = parseFloat(value) || 0; updateGrandTotalDisplay('#df-totals', dfState); }

function onDfLineItemPick(lineId, itemId){
  const line = dfState.lines.find(function(l){ return l.id === lineId; });
  if(!line) return;
  if(itemId){
    const it = itemById(itemId);
    line.itemId = itemId; line.name = it.name; line.description = it.description || '';
    line.rate = it.rate; line.taxRate = it.taxRate; line.unit = it.unit;
    line.pricingMode = it.pricingMode || 'flat'; line.hsn = it.hsn || '';
  } else { line.itemId = ''; }
  renderDfLines(); renderDfTotals();
}
function updateDfLine(lineId, field, value){
  const line = dfState.lines.find(function(l){ return l.id === lineId; });
  if(!line) return;
  updateLineField(line, field, value);
  if(field === 'pricingMode'){ renderDfLines(); }
  else { refreshLineRowDisplay(lineId, line); }
  renderDfTotals();
}
function addDfLine(){ dfState.lines.push(blankLine()); renderDfLines(); renderDfTotals(); }
function removeDfLine(lineId){
  dfState.lines = dfState.lines.filter(function(l){ return l.id !== lineId; });
  if(dfState.lines.length === 0) dfState.lines.push(blankLine());
  renderDfLines(); renderDfTotals();
}

function bindDcFormFieldEvents(){
  $('#df-number').addEventListener('input', function(e){ dfState.number = e.target.value; });
  $('#df-date').addEventListener('input', function(e){ dfState.date = e.target.value; });
  $('#df-vehicle').addEventListener('input', function(e){ dfState.vehicleNumber = e.target.value; });
  $('#df-transport').addEventListener('input', function(e){ dfState.transportMode = e.target.value; });
  $('#df-reference').addEventListener('input', function(e){ dfState.reference = e.target.value; });
  $('#df-subject').addEventListener('input', function(e){ dfState.subject = e.target.value; });
  $('#df-notes').addEventListener('input', function(e){ dfState.notes = e.target.value; });
  $('#df-terms').addEventListener('input', function(e){ dfState.terms = e.target.value; });
  $('#df-client').addEventListener('change', function(e){
    dfState.clientId = e.target.value;
    const tt = taxTypeForState(clientById(e.target.value) ? clientById(e.target.value).state : null);
    if(tt){ dfState.taxType = tt; }
  });
}

async function saveDc(status){
  if(!dfState.clientId){ showToast('Please select a client'); return; }
  const hasContent = dfState.lines.some(function(l){ return l.itemId || (l.name && l.name.trim()); });
  if(!hasContent){ showToast('Add at least one line item'); return; }
  if(!requireBackend()) return;
  let effectiveStatus = status;
  if(status === 'Dispatched' && dfState.status === 'Delivered'){
    /* editing an already-delivered challan: keep that outcome, just save the edited content */
    effectiveStatus = dfState.status;
  }
  const isNew = !dfState.id;
  const payload = linesPayload(dfState.lines);
  let res;
  if(isNew){
    res = await supabaseClient.rpc('create_delivery_challan', {
      p_business_id: currentBusinessId, p_client_id: dfState.clientId, p_date: dfState.date,
      p_vehicle_number: dfState.vehicleNumber || '', p_transport_mode: dfState.transportMode || '',
      p_invoice_id: dfState.invoiceId || null, p_reference: dfState.reference || '', p_subject: dfState.subject || '',
      p_tax_type: dfState.taxType, p_notes: dfState.notes || '', p_terms: dfState.terms || '',
      p_status: effectiveStatus, p_adjustment: Number(dfState.adjustment) || 0, p_lines: payload,
    });
  } else {
    res = await supabaseClient.rpc('update_delivery_challan', {
      p_dc_id: dfState.id, p_client_id: dfState.clientId, p_date: dfState.date,
      p_vehicle_number: dfState.vehicleNumber || '', p_transport_mode: dfState.transportMode || '',
      p_invoice_id: dfState.invoiceId || null, p_reference: dfState.reference || '', p_subject: dfState.subject || '',
      p_tax_type: dfState.taxType, p_notes: dfState.notes || '', p_terms: dfState.terms || '',
      p_status: effectiveStatus, p_adjustment: Number(dfState.adjustment) || 0, p_lines: payload,
    });
  }
  if(res.error){ showToast('Could not save delivery challan: ' + res.error.message); return; }
  const saved = await fetchDcById(res.data.id);
  const idx = state.deliveryChallans.findIndex(function(d){ return d.id === saved.id; });
  if(idx >= 0) state.deliveryChallans[idx] = saved; else state.deliveryChallans.push(saved);
  if(isNew) await reloadSettings();
  persist();
  showToast(status === 'Draft' ? 'Saved as draft' : 'Delivery challan saved');
  location.hash = '#dc-view/' + saved.id;
}

function dcRowHtml(dc, showActions){
  const c = clientById(dc.clientId);
  let html = '<tr onclick="location.hash=\'#dc-view/' + dc.id + '\'" style="cursor:pointer">';
  html += '<td class="mono">' + escapeHtml(dc.number) + '</td>';
  html += '<td>' + escapeHtml(c ? c.name : '—') + '</td>';
  html += '<td>' + formatDateDisplay(dc.date) + '</td>';
  html += '<td>' + escapeHtml(dc.vehicleNumber || '—') + '</td>';
  html += '<td class="num">' + formatCurrency(quotationTotal(dc)) + '</td>';
  html += '<td>' + statusBadge(dc.status) + '</td>';
  if(showActions){
    html += '<td class="row-actions">'
      + '<button class="btn-icon" title="View" onclick="event.stopPropagation();location.hash=\'#dc-view/' + dc.id + '\'">\uD83D\uDC41</button>'
      + '<button class="btn-icon" title="Edit" onclick="event.stopPropagation();location.hash=\'#dc-form/' + dc.id + '\'">\u270E</button>'
      + '<button class="btn-icon" title="More" onclick="event.stopPropagation();openDcRowMenu(this,\'' + dc.id + '\')">\u22EE</button>'
      + '</td>';
  }
  html += '</tr>';
  return html;
}

function renderDcList(){
  const panel = $('#view-delivery-challans .panel');
  const statusFilter = $('#dclist-status-filter').value;
  const search = $('#dclist-search').value;
  let list = state.deliveryChallans.slice();
  if(statusFilter) list = list.filter(function(dc){ return dc.status === statusFilter; });
  list = filterBySearch(list, search, [
    function(dc){ return dc.number; },
    function(dc){ const c = clientById(dc.clientId); return c ? c.name : ''; }
  ]);
  const sortField = $('#dclist-sort-field').value;
  const getters = {
    date: function(dc){ return dc.date || ''; },
    number: function(dc){ return (dc.number || '').toLowerCase(); },
    client: function(dc){ const c = clientById(dc.clientId); return c ? c.name.toLowerCase() : ''; },
    cost: function(dc){ return quotationTotal(dc); },
  };
  list = sortByField(list, getters[sortField] || getters.date, sortDirOf('dclist-sort-dir'));
  $('#dcs-tbody').innerHTML = list.map(function(dc){ return dcRowHtml(dc, true); }).join('');
  toggleTableEmpty(panel, $('#dcs-empty'), list.length === 0);
}

async function deleteDc(id){
  if(!confirm('Delete this delivery challan? This cannot be undone.')) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.from('delivery_challans').delete().eq('id', id);
  if(res.error){ showToast('Could not delete delivery challan: ' + res.error.message); return; }
  state.deliveryChallans = state.deliveryChallans.filter(function(d){ return d.id !== id; });
  persist();
  renderDcList();
  showToast('Delivery challan deleted');
}

async function duplicateDc(id){
  const dc = state.deliveryChallans.find(function(x){ return x.id === id; });
  if(!dc) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.rpc('create_delivery_challan', {
    p_business_id: currentBusinessId, p_client_id: dc.clientId, p_date: todayISO(),
    p_vehicle_number: '', p_transport_mode: '', p_invoice_id: null,
    p_reference: dc.reference || '', p_subject: dc.subject || '', p_tax_type: dc.taxType,
    p_notes: dc.notes || '', p_terms: dc.terms || '', p_status: 'Draft',
    p_adjustment: Number(dc.adjustment) || 0, p_lines: linesPayload(dc.lines),
  });
  if(res.error){ showToast('Could not duplicate delivery challan: ' + res.error.message); return; }
  const saved = await fetchDcById(res.data.id);
  state.deliveryChallans.push(saved);
  await reloadSettings();
  persist();
  showToast('Delivery challan duplicated');
  location.hash = '#dc-form/' + saved.id;
}

let currentViewingDcId = null;

function deliveryChallanPrintHtml(dc){
  const s = state.settings;
  const client = clientById(dc.clientId);
  const goodsValue = dc.lines.reduce(function(sum, l){ return sum + lineAmount(l); }, 0);
  const grandTotal = quotationTotal(dc);

  const linesHtml = dc.lines.map(function(l, idx){
    const nm = l.name || (l.itemId && itemById(l.itemId) ? itemById(l.itemId).name : 'Item');
    const isSqft = l.pricingMode === 'sqft';
    const sizeInfo = isSqft ? ('<div class="item-size">(' + (l.widthFt || 0) + "' \u00D7 " + (l.heightFt || 0) + "')</div>") : '';
    const qtyDisplay = l.qty + ' ' + escapeHtml(l.unit || '');
    return '<tr><td class="num">' + (idx + 1) + '</td>'
      + '<td>' + escapeHtml(nm) + sizeInfo + (l.description ? '<div class="item-desc">' + escapeHtml(l.description) + '</div>' : '') + '</td>'
      + '<td>' + escapeHtml(l.hsn || '') + '</td>'
      + '<td class="num">' + qtyDisplay + '</td>'
      + '<td class="num">' + formatNumber(lineDisplayRate(l)) + '</td>'
      + '<td class="num">' + formatNumber(lineAmount(l)) + '</td></tr>';
  }).join('');

  let html = '<div class="pd-box">';
  html += '<div class="pd-header"><div>';
  html += '<div class="pd-brand-name">' + escapeHtml((s.businessName || '').toUpperCase()) + '</div>';
  html += '<div class="pd-brand-meta">' + escapeHtml(s.address) + (endsWithIndia(s.address) ? '' : '<br>India');
  if(s.gstin) html += '<br>GSTIN ' + escapeHtml(s.gstin);
  html += '<br>' + escapeHtml(s.phone) + '<br>' + escapeHtml(s.email) + '</div></div>';
  html += '<div class="pd-doctype">DELIVERY CHALLAN</div>';
  html += '</div>';

  let dcLeftMeta = '<div class="pd-kv"><span class="k">#:</span><span class="v">' + escapeHtml(dc.number) + '</span></div>'
    + '<div class="pd-kv"><span class="k">Challan Date:</span><span class="v">' + formatDateDisplay(dc.date) + '</span></div>';
  if(dc.invoiceId){
    const inv = state.invoices.find(function(i){ return i.id === dc.invoiceId; });
    if(inv) dcLeftMeta += '<div class="pd-kv"><span class="k">Invoice #:</span><span class="v">' + escapeHtml(inv.number) + '</span></div>';
  }
  if(dc.reference) dcLeftMeta += '<div class="pd-kv"><span class="k">Reference:</span><span class="v">' + escapeHtml(dc.reference) + '</span></div>';

  let dcRightMeta = '';
  if(dc.vehicleNumber) dcRightMeta += '<div class="pd-kv"><span class="k">Vehicle No:</span><span class="v">' + escapeHtml(dc.vehicleNumber) + '</span></div>';
  if(dc.transportMode) dcRightMeta += '<div class="pd-kv"><span class="k">Transport:</span><span class="v">' + escapeHtml(dc.transportMode) + '</span></div>';

  html += '<div class="pd-meta-row"><div class="pd-meta-col">' + dcLeftMeta + '</div>';
  if(dcRightMeta) html += '<div class="pd-meta-col">' + dcRightMeta + '</div>';
  html += '</div>';

  html += '<div class="pd-parties"><div class="pd-party"><div class="pd-label">Deliver To</div>' + partyLinesHtml(client) + '</div>';
  html += '<div class="pd-party"><div class="pd-label">Ship To</div>' + shipToLinesHtml(client) + '</div></div>';
  html += '</div>'; /* end pd-box */

  if(dc.subject) html += '<div class="pd-subject">' + escapeHtml(dc.subject) + '</div>';

  html += '<table class="pd-table"><colgroup><col style="width:4%"><col style="width:46%"><col style="width:12%"><col style="width:10%"><col style="width:12%"><col style="width:16%"></colgroup><thead><tr><th class="pd-col-num">#</th><th>Item &amp; Description</th><th class="pd-col-hsn">HSN/SAC</th><th class="pd-col-qty num">Qty</th><th class="pd-col-rate num">Rate</th><th class="pd-col-amount num">Value</th></tr></thead><tbody>' + linesHtml + '</tbody></table>';

  html += '<div class="pd-bottom"><div class="pd-bottom-left">';
  if(dc.notes) html += '<div class="pd-notes"><strong>Notes</strong><br>' + escapeHtml(dc.notes) + '</div>';
  const termLines = (dc.terms || '').split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
  if(termLines.length){
    html += '<div class="pd-terms-title">Terms &amp; Conditions</div><ul class="pd-terms-list">' + termLines.map(function(l){ return '<li>' + escapeHtml(l) + '</li>'; }).join('') + '</ul>';
  }
  html += '</div>';
  html += '<div class="pd-totals-box"><div class="pt-row"><span>Value (Goods)</span><span class="val">' + formatNumber(goodsValue) + '</span></div>'
    + '<div class="pt-row grand"><span>Grand Total</span><span class="val">' + formatCurrency(grandTotal) + '</span></div></div>';
  html += '</div>'; /* end pd-bottom */

  html += '<div class="pd-dual-signoff"><div class="sign-line">Dispatched By</div><div class="sign-line">Received By (Name, Signature &amp; Date)</div></div>';
  return html;
}

function renderDcView(id){
  const dc = state.deliveryChallans.find(function(x){ return x.id === id; });
  if(!dc){ location.hash = '#delivery-challans'; return; }
  currentViewingDcId = id;
  $('#dv-heading').textContent = dc.number;

  const statusOptions = DC_STATUSES.map(function(st){
    return '<option value="' + st + '"' + (dc.status === st ? ' selected' : '') + '>' + st + '</option>';
  }).join('');
  $('#dv-status-bar').innerHTML = '<span>Status:</span> ' + statusBadge(dc.status) + ' <select id="dv-status-select">' + statusOptions + '</select>';
  bindStatusSelect($('#dv-status-select'), 'delivery_challans', dc, function(){ renderDcView(id); });

  $('#dc-print-doc').innerHTML = deliveryChallanPrintHtml(dc);
}

async function convertInvoiceToDeliveryChallan(invoiceId){
  const inv = state.invoices.find(function(x){ return x.id === invoiceId; });
  if(!inv) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.rpc('create_delivery_challan', {
    p_business_id: currentBusinessId, p_client_id: inv.clientId, p_date: todayISO(),
    p_vehicle_number: '', p_transport_mode: '', p_invoice_id: inv.id,
    p_reference: inv.reference || '', p_subject: inv.subject || '', p_tax_type: inv.taxType,
    p_notes: inv.notes || '', p_terms: state.settings.defaultDcTerms || '', p_status: 'Draft',
    p_adjustment: 0, p_lines: linesPayload(inv.lines),
  });
  if(res.error){ showToast('Could not create delivery challan: ' + res.error.message); return; }
  const saved = await fetchDcById(res.data.id);
  state.deliveryChallans.push(saved);
  await reloadSettings();
  persist();
  showToast('Delivery challan created from invoice');
  location.hash = '#dc-form/' + saved.id;
}

/* ---------- Purchase Orders ---------- */
let pfState = null;

function nextPoNumberPreview(){
  const n = state.settings.nextPoNumber || 1;
  return (state.settings.poPrefix || 'CC-PO-') + String(n).padStart(4, '0');
}

function renderPoForm(param){
  const editing = param && param !== 'new';
  const existing = editing ? state.purchaseOrders.find(function(p){ return p.id === param; }) : null;

  if(existing){
    pfState = JSON.parse(JSON.stringify(existing));
    $('#pf-eyebrow').textContent = 'Edit';
    $('#pf-title').textContent = existing.number;
  } else {
    pfState = {
      id: null, number: nextPoNumberPreview(), date: todayISO(), expectedDate: '',
      reference: '', vendorId: '', subject: '', taxType: 'intra',
      lines: [blankLine()], notes: '', terms: state.settings.defaultPoTerms, status: 'Draft', adjustment: 0,
    };
    $('#pf-eyebrow').textContent = 'New';
    $('#pf-title').textContent = 'Purchase Order';
  }

  $('#pf-number').value = pfState.number;
  $('#pf-date').value = pfState.date;
  $('#pf-expected').value = pfState.expectedDate || '';
  $('#pf-reference').value = pfState.reference || '';
  $('#pf-subject').value = pfState.subject || '';
  $('#pf-taxtype').value = pfState.taxType;
  $('#pf-notes').value = pfState.notes || '';
  $('#pf-terms').value = pfState.terms || '';

  refreshVendorDropdown($('#pf-vendor'), pfState.vendorId);
  $('#pf-vendor').value = pfState.vendorId || '';

  renderPfLines();
  renderPfTotals();
}

function renderPfLines(){
  $('#pf-lines-tbody').innerHTML = pfState.lines.map(function(l){ return genericLineRowHtml(l, 'pf', 'updatePfLine', 'removePfLine'); }).join('');
  $('#pf-lines-empty').hidden = pfState.lines.length > 0;
}
function renderPfTotals(){ renderTotalsCard('#pf-totals', pfState, 'onAdjustPf'); }
function onAdjustPf(value){ pfState.adjustment = parseFloat(value) || 0; updateGrandTotalDisplay('#pf-totals', pfState); }

function updatePfLine(lineId, field, value){
  const line = pfState.lines.find(function(l){ return l.id === lineId; });
  if(!line) return;
  updateLineField(line, field, value);
  if(field === 'pricingMode'){ renderPfLines(); }
  else { refreshLineRowDisplay(lineId, line); }
  renderPfTotals();
}
function addPfLine(){ pfState.lines.push(blankLine()); renderPfLines(); renderPfTotals(); }
function removePfLine(lineId){
  pfState.lines = pfState.lines.filter(function(l){ return l.id !== lineId; });
  if(pfState.lines.length === 0) pfState.lines.push(blankLine());
  renderPfLines(); renderPfTotals();
}

function bindPoFormFieldEvents(){
  $('#pf-number').addEventListener('input', function(e){ pfState.number = e.target.value; });
  $('#pf-date').addEventListener('input', function(e){ pfState.date = e.target.value; });
  $('#pf-expected').addEventListener('input', function(e){ pfState.expectedDate = e.target.value; });
  $('#pf-reference').addEventListener('input', function(e){ pfState.reference = e.target.value; });
  $('#pf-subject').addEventListener('input', function(e){ pfState.subject = e.target.value; });
  $('#pf-notes').addEventListener('input', function(e){ pfState.notes = e.target.value; });
  $('#pf-terms').addEventListener('input', function(e){ pfState.terms = e.target.value; });
  $('#pf-vendor').addEventListener('change', function(e){
    pfState.vendorId = e.target.value;
    const tt = taxTypeForState(vendorById(e.target.value) ? vendorById(e.target.value).state : null);
    if(tt){ pfState.taxType = tt; $('#pf-taxtype').value = tt; renderPfTotals(); }
  });
  $('#pf-taxtype').addEventListener('change', function(e){ pfState.taxType = e.target.value; renderPfTotals(); });
}

async function savePo(status){
  if(!pfState.vendorId){ showToast('Please select a vendor'); return; }
  const hasContent = pfState.lines.some(function(l){ return l.name && l.name.trim(); });
  if(!hasContent){ showToast('Add at least one line item'); return; }
  if(!requireBackend()) return;
  let effectiveStatus = status;
  if(status === 'Sent' && (pfState.status === 'Received' || pfState.status === 'Cancelled')){
    /* editing a received/cancelled PO: keep that outcome, just save the edited content */
    effectiveStatus = pfState.status;
  }
  const isNew = !pfState.id;
  const payload = linesPayload(pfState.lines);
  let res;
  if(isNew){
    res = await supabaseClient.rpc('create_purchase_order', {
      p_business_id: currentBusinessId, p_vendor_id: pfState.vendorId, p_date: pfState.date,
      p_expected_date: pfState.expectedDate || null, p_reference: pfState.reference || '',
      p_subject: pfState.subject || '', p_tax_type: pfState.taxType, p_notes: pfState.notes || '',
      p_terms: pfState.terms || '', p_status: effectiveStatus, p_adjustment: Number(pfState.adjustment) || 0,
      p_lines: payload,
    });
  } else {
    res = await supabaseClient.rpc('update_purchase_order', {
      p_po_id: pfState.id, p_vendor_id: pfState.vendorId, p_date: pfState.date,
      p_expected_date: pfState.expectedDate || null, p_reference: pfState.reference || '',
      p_subject: pfState.subject || '', p_tax_type: pfState.taxType, p_notes: pfState.notes || '',
      p_terms: pfState.terms || '', p_status: effectiveStatus, p_adjustment: Number(pfState.adjustment) || 0,
      p_lines: payload,
    });
  }
  if(res.error){ showToast('Could not save purchase order: ' + res.error.message); return; }
  const saved = await fetchPoById(res.data.id);
  const idx = state.purchaseOrders.findIndex(function(p){ return p.id === saved.id; });
  if(idx >= 0) state.purchaseOrders[idx] = saved; else state.purchaseOrders.push(saved);
  if(isNew) await reloadSettings();
  persist();
  showToast(status === 'Draft' ? 'Saved as draft' : 'Purchase order saved');
  location.hash = '#po-view/' + saved.id;
}

function poRowHtml(po, showActions){
  const v = vendorById(po.vendorId);
  let html = '<tr onclick="location.hash=\'#po-view/' + po.id + '\'" style="cursor:pointer">';
  html += '<td class="mono">' + escapeHtml(po.number) + '</td>';
  html += '<td>' + escapeHtml(v ? v.name : '—') + '</td>';
  html += '<td>' + formatDateDisplay(po.date) + '</td>';
  html += '<td>' + formatDateDisplay(po.expectedDate) + '</td>';
  html += '<td class="num">' + formatCurrency(quotationTotal(po)) + '</td>';
  html += '<td>' + statusBadge(po.status) + '</td>';
  if(showActions){
    html += '<td class="row-actions">'
      + '<button class="btn-icon" title="View" onclick="event.stopPropagation();location.hash=\'#po-view/' + po.id + '\'">\uD83D\uDC41</button>'
      + '<button class="btn-icon" title="Edit" onclick="event.stopPropagation();location.hash=\'#po-form/' + po.id + '\'">\u270E</button>'
      + '<button class="btn-icon" title="More" onclick="event.stopPropagation();openPoRowMenu(this,\'' + po.id + '\')">\u22EE</button>'
      + '</td>';
  }
  html += '</tr>';
  return html;
}

function renderPosList(){
  const panel = $('#view-purchase-orders .panel');
  const statusFilter = $('#polist-status-filter').value;
  const search = $('#polist-search').value;
  let list = state.purchaseOrders.slice();
  if(statusFilter) list = list.filter(function(po){ return po.status === statusFilter; });
  list = filterBySearch(list, search, [
    function(po){ return po.number; },
    function(po){ const v = vendorById(po.vendorId); return v ? v.name : ''; }
  ]);
  const sortField = $('#polist-sort-field').value;
  const getters = {
    date: function(po){ return po.date || ''; },
    number: function(po){ return (po.number || '').toLowerCase(); },
    client: function(po){ const v = vendorById(po.vendorId); return v ? v.name.toLowerCase() : ''; },
    cost: function(po){ return quotationTotal(po); },
  };
  list = sortByField(list, getters[sortField] || getters.date, sortDirOf('polist-sort-dir'));
  $('#pos-tbody').innerHTML = list.map(function(po){ return poRowHtml(po, true); }).join('');
  toggleTableEmpty(panel, $('#pos-empty'), list.length === 0);
}

async function deletePo(id){
  if(!confirm('Delete this purchase order? This cannot be undone.')) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.from('purchase_orders').delete().eq('id', id);
  if(res.error){ showToast('Could not delete purchase order: ' + res.error.message); return; }
  state.purchaseOrders = state.purchaseOrders.filter(function(p){ return p.id !== id; });
  persist();
  renderPosList();
  showToast('Purchase order deleted');
}

async function duplicatePo(id){
  const po = state.purchaseOrders.find(function(x){ return x.id === id; });
  if(!po) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.rpc('create_purchase_order', {
    p_business_id: currentBusinessId, p_vendor_id: po.vendorId, p_date: todayISO(),
    p_expected_date: null, p_reference: po.reference || '', p_subject: po.subject || '',
    p_tax_type: po.taxType, p_notes: po.notes || '', p_terms: po.terms || '', p_status: 'Draft',
    p_adjustment: Number(po.adjustment) || 0, p_lines: linesPayload(po.lines),
  });
  if(res.error){ showToast('Could not duplicate purchase order: ' + res.error.message); return; }
  const saved = await fetchPoById(res.data.id);
  state.purchaseOrders.push(saved);
  await reloadSettings();
  persist();
  showToast('Purchase order duplicated');
  location.hash = '#po-form/' + saved.id;
}

let currentViewingPoId = null;

function renderPoView(id){
  const po = state.purchaseOrders.find(function(x){ return x.id === id; });
  if(!po){ location.hash = '#purchase-orders'; return; }
  currentViewingPoId = id;
  $('#pv-heading').textContent = po.number;

  const statusOptions = PO_STATUSES.map(function(st){
    return '<option value="' + st + '"' + (po.status === st ? ' selected' : '') + '>' + st + '</option>';
  }).join('');
  $('#pv-status-bar').innerHTML = '<span>Status:</span> ' + statusBadge(po.status) + ' <select id="pv-status-select">' + statusOptions + '</select>';
  bindStatusSelect($('#pv-status-select'), 'purchase_orders', po, function(){ renderPoView(id); });

  $('#po-print-doc').innerHTML = documentPrintHtml({
    doc: po, docTypeLabel: 'PURCHASE ORDER', dateLabel: 'PO Date', endDateLabel: 'Expected Date',
    placeOfSupply: null,
    leftLabel: 'Vendor', leftLinesHtml: partyLinesHtml(vendorById(po.vendorId)),
    rightLabel: 'Ship To', rightLinesHtml: partyLinesHtml({ name: state.settings.businessName, address: state.settings.address, state: state.settings.state }, { includeName: true, skipGstin: true, skipPhone: true }),
  });
}

/* ---------- Expenses ---------- */
function renderExpenseCategoryFilter(){
  const sel = $('#elist-category-filter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All categories</option>' + EXPENSE_CATEGORIES.map(function(c){ return '<option value="' + c + '">' + c + '</option>'; }).join('');
  sel.value = current;
}

function expenseRowHtml(e){
  const v = e.vendorId ? vendorById(e.vendorId) : null;
  return '<tr>'
    + '<td>' + formatDateDisplay(e.date) + '</td>'
    + '<td>' + escapeHtml(e.category) + '</td>'
    + '<td>' + escapeHtml(v ? v.name : '—') + '</td>'
    + '<td class="cell-muted">' + escapeHtml(e.description || '—') + '</td>'
    + '<td class="num">' + formatCurrency(e.amount) + '</td>'
    + '<td class="row-actions">'
    + '<button class="btn-icon" title="Edit" onclick="openExpenseModal(\'' + e.id + '\')">\u270E</button>'
    + '<button class="btn-icon danger" title="Delete" onclick="deleteExpense(\'' + e.id + '\')">\u2715</button>'
    + '</td></tr>';
}

function renderExpenses(){
  renderExpenseCategoryFilter();
  const panel = $('#view-expenses .panel');
  const catFilter = $('#elist-category-filter').value;
  const search = $('#elist-search').value;
  let list = state.expenses.slice();
  if(catFilter) list = list.filter(function(e){ return e.category === catFilter; });
  list = filterBySearch(list, search, [
    function(e){ return e.description; },
    function(e){ const v = e.vendorId ? vendorById(e.vendorId) : null; return v ? v.name : ''; }
  ]);
  const sortField = $('#elist-sort-field').value;
  const getters = {
    date: function(e){ return e.date || ''; },
    client: function(e){ return (e.category || '').toLowerCase(); },
    cost: function(e){ return Number(e.amount) || 0; },
  };
  list = sortByField(list, getters[sortField] || getters.date, sortDirOf('elist-sort-dir'));
  $('#expenses-tbody').innerHTML = list.map(expenseRowHtml).join('');
  toggleTableEmpty(panel, $('#expenses-empty'), list.length === 0);
}

function openExpenseModal(id){
  const exp = id ? state.expenses.find(function(e){ return e.id === id; }) : null;
  const catOptions = EXPENSE_CATEGORIES.map(function(c){ return '<option value="' + c + '"' + (exp && exp.category === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
  const vendorOptions = '<option value="">None</option>' + state.vendors.map(function(v){ return '<option value="' + v.id + '"' + (exp && exp.vendorId === v.id ? ' selected' : '') + '>' + escapeHtml(v.name) + '</option>'; }).join('');
  const methodOptions = PAYMENT_METHODS.map(function(m){ return '<option value="' + m + '"' + (exp && exp.paymentMethod === m ? ' selected' : '') + '>' + m + '</option>'; }).join('');
  openModal(
    '<h2>' + (exp ? 'Edit Expense' : 'Add Expense') + '</h2>' +
    '<div class="form-grid">' +
      '<div class="field"><label>Date</label><input type="date" id="em-date" value="' + (exp ? exp.date : todayISO()) + '"></div>' +
      '<div class="field"><label>Category</label><select id="em-category">' + catOptions + '</select></div>' +
      '<div class="field"><label>Vendor <span class="optional">(optional)</span></label><select id="em-vendor">' + vendorOptions + '</select></div>' +
      '<div class="field"><label>Amount (₹)</label><input type="number" id="em-amount" min="0" step="0.01" value="' + (exp ? exp.amount : '') + '"></div>' +
      '<div class="field field-wide"><label>Description</label><input id="em-desc" value="' + (exp ? escapeHtml(exp.description || '') : '') + '"></div>' +
      '<div class="field"><label>Payment Method</label><select id="em-method">' + methodOptions + '</select></div>' +
      '<div class="field field-wide"><label>Notes <span class="optional">(optional)</span></label><input id="em-notes" value="' + (exp ? escapeHtml(exp.notes || '') : '') + '"></div>' +
    '</div>' +
    '<div class="form-actions">' +
      '<button type="button" class="btn btn-text" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-gold" onclick="saveExpense(' + (exp ? "'" + exp.id + "'" : 'null') + ')">Save Expense</button>' +
    '</div>'
  );
  setTimeout(function(){ const el = $('#em-amount'); if(el) el.focus(); }, 30);
}

async function saveExpense(id){
  const amount = parseFloat($('#em-amount').value) || 0;
  if(amount <= 0){ showToast('Enter an expense amount'); return; }
  if(!requireBackend()) return;
  const row = {
    business_id: currentBusinessId,
    date: $('#em-date').value || todayISO(),
    category: $('#em-category').value,
    vendor_id: $('#em-vendor').value || null,
    amount: amount,
    description: $('#em-desc').value.trim(),
    payment_method: $('#em-method').value,
    notes: $('#em-notes').value.trim(),
  };
  const res = id
    ? await supabaseClient.from('expenses').update(row).eq('id', id).select().single()
    : await supabaseClient.from('expenses').insert(row).select().single();
  if(res.error){ showToast('Could not save expense: ' + res.error.message); return; }
  const saved = mapExpenseRow(res.data);
  if(id){ Object.assign(state.expenses.find(function(e){ return e.id === id; }), saved); }
  else { state.expenses.push(saved); }
  persist();
  closeModal();
  renderExpenses();
  showToast('Expense saved');
}

async function deleteExpense(id){
  if(!confirm('Delete this expense?')) return;
  if(!requireBackend()) return;
  const res = await supabaseClient.from('expenses').delete().eq('id', id);
  if(res.error){ showToast('Could not delete expense: ' + res.error.message); return; }
  state.expenses = state.expenses.filter(function(e){ return e.id !== id; });
  persist();
  renderExpenses();
  showToast('Expense deleted');
}

/* ---------- Reports ---------- */
function setReportsRangeMonth(){
  const now = new Date();
  $('#rpt-from').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  $('#rpt-to').value = todayISO();
  renderReports();
}
function setReportsRangeYear(){
  const now = new Date();
  $('#rpt-from').value = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  $('#rpt-to').value = todayISO();
  renderReports();
}
function setReportsRangeAll(){
  $('#rpt-from').value = ''; $('#rpt-to').value = '';
  renderReports();
}

function inRange(dateStr, from, to){
  if(!dateStr) return false;
  if(from && dateStr < from) return false;
  if(to && dateStr > to) return false;
  return true;
}

function renderBarList(container, rows){
  if(rows.length === 0){ container.innerHTML = '<p class="panel-note" style="margin:0">No data in this range.</p>'; return; }
  const max = Math.max.apply(null, rows.map(function(r){ return r.value; }).concat([1]));
  container.innerHTML = rows.map(function(r){
    return '<div class="bar-row"><div class="bar-label" title="' + escapeHtml(r.label) + '">' + escapeHtml(r.label) + '</div>'
      + '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round(r.value / max * 100) + '%"></div></div>'
      + '<div class="bar-value">' + formatCurrency(r.value) + '</div></div>';
  }).join('');
}

function renderReports(){
  const from = $('#rpt-from').value || '';
  const to = $('#rpt-to').value || '';

  const invoicesInRange = state.invoices.filter(function(inv){ return inv.status !== 'Draft' && inv.status !== 'Cancelled' && inRange(inv.date, from, to); });
  const totalInvoiced = invoicesInRange.reduce(function(s, inv){ return s + quotationTotal(inv); }, 0);

  const paymentsInRange = getAllPayments().filter(function(p){ return inRange(p.date, from, to); });
  const totalReceived = paymentsInRange.reduce(function(s, p){ return s + (Number(p.amount) || 0); }, 0);

  const expensesInRange = state.expenses.filter(function(e){ return inRange(e.date, from, to); });
  const totalExpenses = expensesInRange.reduce(function(s, e){ return s + (Number(e.amount) || 0); }, 0);

  const net = totalReceived - totalExpenses;

  $('#reports-stats').innerHTML =
    '<div class="stat-card"><div class="stat-label">Invoiced</div><div class="stat-value" style="font-size:22px">' + formatCurrency(totalInvoiced) + '</div><div class="stat-sub">' + invoicesInRange.length + ' invoice' + (invoicesInRange.length === 1 ? '' : 's') + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Received</div><div class="stat-value" style="font-size:22px">' + formatCurrency(totalReceived) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Expenses</div><div class="stat-value" style="font-size:22px">' + formatCurrency(totalExpenses) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Net (Received − Expenses)</div><div class="stat-value" style="font-size:22px">' + formatCurrency(net) + '</div></div>';

  const receivables = getOutstandingReceivables();
  $('#rpt-receivables-tbody').innerHTML = receivables.map(function(inv){ return receivableRowHtml(inv, true); }).join('');
  toggleEmptyByRow($('#rpt-receivables-tbody'), $('#rpt-receivables-empty'), receivables.length === 0);

  const byClient = {};
  invoicesInRange.forEach(function(inv){
    const c = clientById(inv.clientId);
    const label = c ? c.name : 'Unknown';
    byClient[label] = (byClient[label] || 0) + quotationTotal(inv);
  });
  const byClientRows = Object.keys(byClient).map(function(k){ return { label: k, value: byClient[k] }; }).sort(function(a, b){ return b.value - a.value; }).slice(0, 8);
  renderBarList($('#rpt-by-client'), byClientRows);

  const byCategory = {};
  expensesInRange.forEach(function(e){ byCategory[e.category] = (byCategory[e.category] || 0) + (Number(e.amount) || 0); });
  const byCategoryRows = Object.keys(byCategory).map(function(k){ return { label: k, value: byCategory[k] }; }).sort(function(a, b){ return b.value - a.value; });
  renderBarList($('#rpt-by-category'), byCategoryRows);
}

/* ---------- Settings ---------- */
function renderSettings(){
  const s = state.settings;
  $('#set-name').value = s.businessName;
  $('#set-tagline').value = s.tagline;
  $('#set-address').value = s.address;
  $('#set-state').innerHTML = stateOptionsHtml(s.state);
  $('#set-phone').value = s.phone;
  $('#set-email').value = s.email;
  $('#set-instagram').value = s.instagram;
  $('#set-gstin').value = s.gstin;
  $('#set-prefix').value = s.quotationPrefix;
  $('#set-nextnum').value = s.nextQuotationNumber;
  $('#set-validity').value = s.defaultValidityDays;
  $('#set-terms').value = s.defaultTerms;
  $('#set-inv-prefix').value = s.invoicePrefix;
  $('#set-inv-nextnum').value = s.nextInvoiceNumber;
  $('#set-inv-duedays').value = s.defaultInvoiceDueDays;
  $('#set-inv-terms').value = s.defaultInvoiceTerms;
  $('#set-po-prefix').value = s.poPrefix;
  $('#set-po-nextnum').value = s.nextPoNumber;
  $('#set-po-terms').value = s.defaultPoTerms;
  $('#set-dc-prefix').value = s.dcPrefix;
  $('#set-dc-nextnum').value = s.nextDcNumber;
  $('#set-dc-terms').value = s.defaultDcTerms;
}

async function onSaveSettings(e){
  e.preventDefault();
  if(!requireBackend()) return;
  const row = {
    business_name: $('#set-name').value.trim(),
    tagline: $('#set-tagline').value.trim(),
    address: $('#set-address').value.trim(),
    state: $('#set-state').value,
    phone: $('#set-phone').value.trim(),
    email: $('#set-email').value.trim(),
    instagram: $('#set-instagram').value.trim(),
    gstin: $('#set-gstin').value.trim(),
    quotation_prefix: $('#set-prefix').value.trim() || 'CC-QT-',
    next_quotation_number: parseInt($('#set-nextnum').value, 10) || 1,
    default_validity_days: parseInt($('#set-validity').value, 10) || 15,
    default_terms: $('#set-terms').value,
    invoice_prefix: $('#set-inv-prefix').value.trim() || 'CC-INV-',
    next_invoice_number: parseInt($('#set-inv-nextnum').value, 10) || 1,
    default_invoice_due_days: parseInt($('#set-inv-duedays').value, 10) || 7,
    default_invoice_terms: $('#set-inv-terms').value,
    po_prefix: $('#set-po-prefix').value.trim() || 'CC-PO-',
    next_po_number: parseInt($('#set-po-nextnum').value, 10) || 1,
    default_po_terms: $('#set-po-terms').value,
    dc_prefix: $('#set-dc-prefix').value.trim() || 'CC-DC-',
    next_dc_number: parseInt($('#set-dc-nextnum').value, 10) || 1,
    default_dc_terms: $('#set-dc-terms').value,
  };
  const res = await supabaseClient.from('settings').update(row).eq('business_id', currentBusinessId).select().single();
  if(res.error){ showToast('Could not save settings: ' + res.error.message); return; }
  state.settings = mapSettingsRow(res.data);
  persist();
  showToast('Settings saved');
}

function onExportBackup(){
  const backup = {
    exportedAt: new Date().toISOString(),
    items: state.items, clients: state.clients, vendors: state.vendors,
    quotations: state.quotations, invoices: state.invoices,
    expenses: state.expenses, purchaseOrders: state.purchaseOrders,
    deliveryChallans: state.deliveryChallans,
    settings: state.settings,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'carve-curve-backup-' + todayISO() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
}

function onImportBackup(e){
  // Bulk-restoring a full JSON backup into the relational Supabase schema
  // (new IDs, atomic numbering, FK relationships) needs a dedicated
  // server-side restore routine, which isn't wired up yet — importing here
  // would only update the local view and get overwritten on next reload.
  // Disabled for now rather than shipping something misleading.
  e.target.value = '';
  showToast('Import isn\u2019t available yet against the live Supabase backend — ask to have this built if you need it.');
}

function onClearData(){
  showToast('Clearing all business data isn\u2019t exposed here on purpose \u2014 do it from the Supabase dashboard if you really mean to.');
}

/* ---------- Init ---------- */
function init(){
  $('#nav-toggle').addEventListener('click', function(){
    if($('#sidebar').classList.contains('open')) closeSidebar(); else openSidebar();
  });
  $('#sidebar-backdrop').addEventListener('click', closeSidebar);

  $('#modal-backdrop').addEventListener('click', function(e){ if(e.target.id === 'modal-backdrop') closeModal(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModal(); });

  $('#btn-add-item').addEventListener('click', function(){ openItemModal(null); });
  $('#btn-add-item-empty').addEventListener('click', function(){ openItemModal(null); });
  $('#items-search').addEventListener('input', renderItems);
  $('#items-sort-field').addEventListener('change', renderItems);
  bindSortDirToggle('items-sort-dir', '\u2191 Asc', '\u2193 Desc', renderItems);

  $('#btn-add-client').addEventListener('click', function(){ openClientModal(null); });
  $('#btn-add-client-empty').addEventListener('click', function(){ openClientModal(null); });
  $('#clients-search').addEventListener('input', renderClients);
  bindSortDirToggle('clients-sort-dir', '\u2191 Name A-Z', '\u2193 Name Z-A', renderClients);

  $('#btn-add-vendor').addEventListener('click', function(){ openVendorModal(null); });
  $('#btn-add-vendor-empty').addEventListener('click', function(){ openVendorModal(null); });
  $('#vendors-search').addEventListener('input', renderVendors);
  bindSortDirToggle('vendors-sort-dir', '\u2191 Name A-Z', '\u2193 Name Z-A', renderVendors);

  bindQuotationFormFieldEvents();
  $('#btn-add-line').addEventListener('click', addLine);
  $('#btn-save-draft').addEventListener('click', function(){ saveQuotation('Draft'); });
  $('#quotation-form').addEventListener('submit', function(e){ e.preventDefault(); saveQuotation('Sent'); });
  $('#btn-quick-add-client').addEventListener('click', function(){
    openClientModal(null, function(newClientId){
      refreshClientDropdown($('#qf-client'));
      $('#qf-client').value = newClientId;
      qfState.clientId = newClientId;
      const tt = taxTypeForState(clientById(newClientId) ? clientById(newClientId).state : null);
      if(tt){ qfState.taxType = tt; $('#qf-taxtype').value = tt; renderQfTotals(); }
    });
  });
  $('#qlist-status-filter').addEventListener('change', renderQuotationsList);
  $('#qlist-search').addEventListener('input', renderQuotationsList);
  $('#qlist-sort-field').addEventListener('change', renderQuotationsList);
  bindSortDirToggle('qlist-sort-dir', '\u2191 Asc', '\u2193 Desc', renderQuotationsList);
  $('#btn-print-quotation').addEventListener('click', function(){ window.print(); });
  $('#btn-edit-quotation').addEventListener('click', function(){ if(currentViewingQuotationId) location.hash = '#quotation-form/' + currentViewingQuotationId; });
  $('#btn-convert-invoice').addEventListener('click', function(){
    if(!currentViewingQuotationId) return;
    const existingInv = state.invoices.find(function(inv){ return inv.quotationId === currentViewingQuotationId; });
    if(existingInv){ showToast('Already converted — opening the invoice'); location.hash = '#invoice-view/' + existingInv.id; }
    else { convertQuotationToInvoice(currentViewingQuotationId); }
  });

  bindInvoiceFormFieldEvents();
  $('#btn-add-line-inv').addEventListener('click', addIfLine);
  $('#btn-save-draft-inv').addEventListener('click', function(){ saveInvoice('Draft'); });
  $('#invoice-form').addEventListener('submit', function(e){ e.preventDefault(); saveInvoice('Sent'); });
  $('#btn-quick-add-client-inv').addEventListener('click', function(){
    openClientModal(null, function(newClientId){
      refreshClientDropdown($('#if-client'));
      $('#if-client').value = newClientId;
      ifState.clientId = newClientId;
      const tt = taxTypeForState(clientById(newClientId) ? clientById(newClientId).state : null);
      if(tt){ ifState.taxType = tt; $('#if-taxtype').value = tt; renderIfTotals(); }
    });
  });
  $('#ilist-status-filter').addEventListener('change', renderInvoicesList);
  $('#ilist-search').addEventListener('input', renderInvoicesList);
  $('#ilist-sort-field').addEventListener('change', renderInvoicesList);
  bindSortDirToggle('ilist-sort-dir', '\u2191 Asc', '\u2193 Desc', renderInvoicesList);
  $('#btn-print-invoice').addEventListener('click', function(){ window.print(); });
  $('#btn-edit-invoice').addEventListener('click', function(){ if(currentViewingInvoiceId) location.hash = '#invoice-form/' + currentViewingInvoiceId; });
  $('#btn-record-payment-from-view').addEventListener('click', function(){ if(currentViewingInvoiceId) openRecordPaymentModal(currentViewingInvoiceId); });
  $('#btn-create-dc-from-invoice').addEventListener('click', function(){ if(currentViewingInvoiceId) convertInvoiceToDeliveryChallan(currentViewingInvoiceId); });

  $('#btn-record-payment').addEventListener('click', function(){ openRecordPaymentModal(); });
  $('#payments-search').addEventListener('input', renderPaymentsList);
  $('#payments-sort-field').addEventListener('change', renderPaymentsList);
  bindSortDirToggle('payments-sort-dir', '\u2191 Asc', '\u2193 Desc', renderPaymentsList);

  bindDcFormFieldEvents();
  $('#btn-add-line-dc').addEventListener('click', addDfLine);
  $('#btn-save-draft-dc').addEventListener('click', function(){ saveDc('Draft'); });
  $('#dc-form').addEventListener('submit', function(e){ e.preventDefault(); saveDc('Dispatched'); });
  $('#btn-quick-add-client-dc').addEventListener('click', function(){
    openClientModal(null, function(newClientId){
      refreshClientDropdown($('#df-client'));
      $('#df-client').value = newClientId;
      dfState.clientId = newClientId;
      const tt = taxTypeForState(clientById(newClientId) ? clientById(newClientId).state : null);
      if(tt){ dfState.taxType = tt; }
    });
  });
  $('#dclist-status-filter').addEventListener('change', renderDcList);
  $('#dclist-search').addEventListener('input', renderDcList);
  $('#dclist-sort-field').addEventListener('change', renderDcList);
  bindSortDirToggle('dclist-sort-dir', '\u2191 Asc', '\u2193 Desc', renderDcList);
  $('#btn-print-dc').addEventListener('click', function(){ window.print(); });
  $('#btn-edit-dc').addEventListener('click', function(){ if(currentViewingDcId) location.hash = '#dc-form/' + currentViewingDcId; });

  bindPoFormFieldEvents();
  $('#btn-add-line-po').addEventListener('click', addPfLine);
  $('#btn-save-draft-po').addEventListener('click', function(){ savePo('Draft'); });
  $('#po-form').addEventListener('submit', function(e){ e.preventDefault(); savePo('Sent'); });
  $('#btn-quick-add-vendor').addEventListener('click', function(){
    openVendorModal(null, function(newVendorId){
      refreshVendorDropdown($('#pf-vendor'));
      $('#pf-vendor').value = newVendorId;
      pfState.vendorId = newVendorId;
      const tt = taxTypeForState(vendorById(newVendorId) ? vendorById(newVendorId).state : null);
      if(tt){ pfState.taxType = tt; $('#pf-taxtype').value = tt; renderPfTotals(); }
    });
  });
  $('#polist-status-filter').addEventListener('change', renderPosList);
  $('#polist-search').addEventListener('input', renderPosList);
  $('#polist-sort-field').addEventListener('change', renderPosList);
  bindSortDirToggle('polist-sort-dir', '\u2191 Asc', '\u2193 Desc', renderPosList);
  $('#btn-print-po').addEventListener('click', function(){ window.print(); });
  $('#btn-edit-po').addEventListener('click', function(){ if(currentViewingPoId) location.hash = '#po-form/' + currentViewingPoId; });

  $('#btn-add-expense').addEventListener('click', function(){ openExpenseModal(null); });
  $('#elist-category-filter').addEventListener('change', renderExpenses);
  $('#elist-search').addEventListener('input', renderExpenses);
  $('#elist-sort-field').addEventListener('change', renderExpenses);
  bindSortDirToggle('elist-sort-dir', '\u2191 Asc', '\u2193 Desc', renderExpenses);

  $('#rpt-range-month').addEventListener('click', setReportsRangeMonth);
  $('#rpt-range-year').addEventListener('click', setReportsRangeYear);
  $('#rpt-range-all').addEventListener('click', setReportsRangeAll);
  $('#rpt-from').addEventListener('change', renderReports);
  $('#rpt-to').addEventListener('change', renderReports);

  $('#settings-form').addEventListener('submit', onSaveSettings);
  $('#btn-export').addEventListener('click', onExportBackup);
  $('#import-file').addEventListener('change', onImportBackup);
  $('#btn-clear-data').addEventListener('click', onClearData);

  bindAuthForm();
}

document.addEventListener('DOMContentLoaded', function(){
  init();
  bootstrapAuth();
});
window.addEventListener('hashchange', function(){
  if(!supabaseClient || currentSession) handleRoute();
});
