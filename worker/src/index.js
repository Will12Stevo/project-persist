// Project Persist donations API (Cloudflare Worker)
//
//   POST /api/checkout   -> creates a Stripe Checkout Session, returns { url }
//   GET  /api/session    -> ?id=cs_... returns what the thank-you screen needs
//   GET  /api/totals     -> raised per fund + recent supporters (cached for CACHE_SECONDS)
//
// Stripe is the source of truth: totals are worked out by listing completed
// Checkout Sessions tagged source=persist-give, so there is no webhook and no
// database to keep in sync. Money raised outside Stripe (GoFundMe, sponsors,
// bank transfers) is added via ROW_OFFLINE / CHARITY_OFFLINE in wrangler.toml.

import OFFLINE_SUPPORTERS from './offline-supporters.js';

const SOURCE = 'persist-give';
const FEE_PCT = 0.015, FEE_FIXED = 0.20; // Stripe UK standard cards; must match give.html
const MIN = 2, MAX = 10000;               // pounds

// Prices are set here, on the server, so nobody can change them in the browser.
const ROW_OPTIONS = {
  km:    { price: 5,   noun: ['kilometre of ocean', 'kilometres of ocean'] },
  meal:  { price: 12,  noun: ['meal at sea', 'meals at sea'] },
  hour:  { price: 25,  noun: ['hour at the oars', 'hours at the oars'] },
  day:   { price: 100, noun: ['day at sea', 'days at sea'] },
  night: { price: 50,  noun: ['night shift', 'night shifts'] },
  custom: null
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === '/api/checkout' && request.method === 'POST') return await checkout(request, env, cors);
      if (url.pathname === '/api/session' && request.method === 'GET') return await session(url, env, cors);
      if (url.pathname === '/api/totals' && request.method === 'GET') return await totals(env, cors);
      return json({ error: 'Not found' }, 404, cors);
    } catch (err) {
      console.error(err && err.stack || err);
      return json({ error: 'Something went wrong. Please try again.' }, 500, cors);
    }
  }
};

// ---------- checkout ----------
async function checkout(request, env, cors) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Bad request' }, 400, cors); }

  const mode = b.mode === 'charity' ? 'charity' : b.mode === 'row' ? 'row' : null;
  if (!mode) return json({ error: 'Bad request' }, 400, cors);

  let base, what;
  if (mode === 'charity') {
    base = round2(+b.amount);
    what = 'Gave to charity';
  } else {
    if (!Object.prototype.hasOwnProperty.call(ROW_OPTIONS, b.option)) return json({ error: 'Bad request' }, 400, cors);
    const o = ROW_OPTIONS[b.option];
    if (o) {
      const qty = Math.floor(+b.qty);
      if (!(qty >= 1 && qty <= 1000)) return json({ error: 'Please choose a quantity between 1 and 1,000.' }, 400, cors);
      base = o.price * qty;
      what = qty + ' ' + o.noun[qty === 1 ? 0 : 1];
    } else {
      base = round2(+b.amount);
      what = 'Backed the row';
    }
  }
  if (!(base >= MIN && base <= MAX)) return json({ error: `Please choose an amount between £${MIN} and £${MAX.toLocaleString('en-GB')}.` }, 400, cors);

  const name = clean(b.name, 80);
  const email = clean(b.email, 200);
  if (!name) return json({ error: 'Please add your name.' }, 400, cors);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Please add a valid email for your receipt.' }, 400, cors);

  const cover = !!b.coverFee;
  const total = cover ? Math.ceil(((base + FEE_FIXED) / (1 - FEE_PCT)) * 100) / 100 : base;
  const feeCover = round2(total - base);

  const tributeName = b.tribute ? clean(b.tribute.name, 60) : '';
  const tributeType = b.tribute && b.tribute.type === 'In memory of' ? 'In memory of' : 'In honour of';

  const metadata = {
    source: SOURCE,
    fund: mode,
    option: mode === 'row' ? String(b.option) : '',
    what,
    base: base.toFixed(2),
    fee_cover: feeCover.toFixed(2),
    name,
    anonymous: b.anonymous ? '1' : '0',
    message: clean(b.message, 200),
    tribute: tributeName ? `${tributeType} ${tributeName}` : '',
    tribute_msg: tributeName && b.tribute ? clean(b.tribute.message, 200) : ''
  };

  const productName = mode === 'charity'
    ? "Donation to Project Persist's four charities"
    : 'Project Persist row: ' + what;

  const line_items = [{
    quantity: 1,
    price_data: {
      currency: 'gbp',
      unit_amount: Math.round(base * 100),
      product_data: {
        name: productName,
        description: mode === 'charity'
          ? 'Split equally between Action for M.E., Diabetes UK, Kom op tegen Kanker and Football Academy Noah.'
          : 'Pays for the crossing itself: boat, kit, food and race entry. Not a charity donation.'
      }
    }
  }];
  if (feeCover > 0) {
    line_items.push({
      quantity: 1,
      price_data: { currency: 'gbp', unit_amount: Math.round(feeCover * 100), product_data: { name: 'Card fee cover' } }
    });
  }

  // Send donors back to the site they came from (live site, or localhost while testing).
  const origin = request.headers.get('Origin') || '';
  const site = (cors['Access-Control-Allow-Origin'] === origin && origin ? origin : env.SITE_URL).replace(/\/$/, '');
  const s = await stripe(env, 'POST', '/v1/checkout/sessions', {
    mode: 'payment',
    submit_type: mode === 'charity' ? 'donate' : 'pay',
    customer_email: email,
    line_items,
    metadata,
    payment_intent_data: {
      description: mode === 'charity' ? 'Charity donation' : 'Row: ' + what,
      metadata
    },
    success_url: `${site}/give?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/give${mode === 'charity' ? '#charity' : '#give'}`
  });
  return json({ url: s.url }, 200, cors);
}

// ---------- thank-you lookup ----------
async function session(url, env, cors) {
  const id = url.searchParams.get('id') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json({ error: 'Bad request' }, 400, cors);
  const s = await stripe(env, 'GET', '/v1/checkout/sessions/' + id);
  const m = s.metadata || {};
  if (m.source !== SOURCE) return json({ error: 'Not found' }, 404, cors);

  const paid = s.payment_status === 'paid';
  // A new donation just landed, so rebuild the cached totals now and the meters update straight away.
  let fundTotals = null;
  if (paid) {
    const t = await (await totals(env, cors, true)).json();
    fundTotals = t[m.fund === 'charity' ? 'charity' : 'row'];
  }

  return json({
    paid,
    fund: m.fund,
    what: m.what,
    base: parseFloat(m.base) || 0,
    total: (s.amount_total || 0) / 100,
    firstName: (m.name || '').split(/\s+/)[0],
    wallName: m.anonymous === '1' ? 'Anonymous' : (m.name || 'Anonymous'),
    message: m.message || '',
    tribute: m.tribute || '',
    email: s.customer_details && s.customer_details.email || s.customer_email || '',
    fundTotals
  }, 200, { ...cors, 'Cache-Control': 'no-store' });
}

// ---------- totals ----------
async function totals(env, cors, force) {
  const ttl = Math.max(30, parseInt(env.CACHE_SECONDS, 10) || 120);
  if (env.CACHE && !force) {
    const hit = await env.CACHE.get('totals');
    if (hit) return new Response(hit, { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }

  const hidden = new Set(String(env.HIDDEN_SUPPORTERS || '').split(',').map(s => s.trim()).filter(Boolean));
  const raised = { row: 0, charity: 0 };
  const count = { row: 0, charity: 0 };
  const supporters = [];

  let after = null;
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ status: 'complete', limit: '100' });
    q.append('expand[]', 'data.payment_intent.latest_charge.balance_transaction');
    if (after) q.set('starting_after', after);
    const list = await stripe(env, 'GET', '/v1/checkout/sessions?' + q.toString());

    for (const s of list.data) {
      const m = s.metadata || {};
      if (m.source !== SOURCE || s.payment_status !== 'paid') continue;
      const fund = m.fund === 'charity' ? 'charity' : 'row';

      // What actually landed in the account after Stripe's fee, less any refund.
      const charge = s.payment_intent && s.payment_intent.latest_charge;
      const bt = charge && charge.balance_transaction;
      const gross = s.amount_total || 0;
      const refunded = charge && charge.amount_refunded || 0;
      if (refunded >= gross) continue;
      const net = (bt && typeof bt.net === 'number' ? bt.net : gross) - refunded;

      raised[fund] += net;
      count[fund] += 1;

      if (!hidden.has(s.id) && supporters.length < 200) {
        supporters.push({
          kind: fund,
          name: m.anonymous === '1' ? 'Anonymous' : (m.name || 'Anonymous'),
          amount: parseFloat(m.base) || gross / 100,
          what: m.what || '',
          msg: m.message || '',
          tribute: m.tribute || '',
          at: s.created
        });
      }
    }
    if (!list.has_more || !list.data.length) break;
    after = list.data[list.data.length - 1].id;
  }

  for (const o of OFFLINE_SUPPORTERS) {
    if (!o || !o.name) continue;
    supporters.push({
      kind: o.kind === 'charity' ? 'charity' : 'row',
      name: String(o.name),
      amount: num(o.amount),
      what: o.what || '',
      msg: o.msg || '',
      tribute: o.tribute || '',
      at: Math.floor((Date.parse(o.date) || 0) / 1000)
    });
  }
  supporters.sort((a, b) => b.at - a.at);

  const body = JSON.stringify({
    row: {
      raised: Math.round(raised.row / 100 + num(env.ROW_OFFLINE)),
      online: Math.round(raised.row / 100),
      donations: count.row,
      goal: num(env.ROW_GOAL)
    },
    charity: {
      raised: Math.round(raised.charity / 100 + num(env.CHARITY_OFFLINE)),
      online: Math.round(raised.charity / 100),
      donations: count.charity,
      goal: num(env.CHARITY_GOAL)
    },
    supporters,
    updated: new Date().toISOString()
  });
  if (env.CACHE) await env.CACHE.put('totals', body, { expirationTtl: Math.max(60, ttl) });
  return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

// ---------- helpers ----------
async function stripe(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  const init = {
    method,
    headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }
  };
  if (params) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = formEncode(params);
  }
  const res = await fetch('https://api.stripe.com' + path, init);
  const data = await res.json();
  if (!res.ok) throw new Error('Stripe ' + res.status + ': ' + (data.error && data.error.message));
  return data;
}

// Stripe wants nested form fields: line_items[0][price_data][currency]=gbp
function formEncode(obj, prefix, out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out.toString();
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return ok ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  } : { 'Vary': 'Origin' };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
function clean(s, max) { return String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function round2(n) { return Math.round((n || 0) * 100) / 100; }
function num(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }
