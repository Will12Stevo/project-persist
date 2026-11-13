# Donations Worker

A small Cloudflare Worker that connects the give page to Stripe. The website stays on GitHub Pages; this runs separately on Cloudflare (free plan).

- `POST /api/checkout` creates a Stripe Checkout payment and sends the donor to Stripe's payment page
- `GET /api/session` tells the thank-you screen what was paid
- `GET /api/totals` gives the raised totals for each fund and the latest supporters, for the meters and the supporters wall

Every payment is tagged in Stripe with `fund = row` or `fund = charity`. The totals are worked out directly from Stripe (after Stripe's fee, less any refunds), so there's no database to look after. Payments made any other way on the same Stripe account are ignored.

## One-time setup

You need Node.js installed (`node -v` should work).

### 1. Stripe

1. Sign up at stripe.com and stay in **Test mode** (the toggle at the top of the dashboard) for now.
2. Go to **Developers → API keys** and copy the **Secret key** (`sk_test_...`).
3. Under **Settings → Business → Public details**, set the name shown on the payment page and receipts to "Project Persist", and add the logo.
4. Under **Settings → Customer emails**, switch on **Successful payments** so donors get a receipt.
5. Under **Settings → Payment methods**, check that Apple Pay and Google Pay are on.

### 2. Cloudflare

Run these in a terminal from the `worker` folder:

```sh
npx wrangler login                          # opens the browser to sign in or create a free account
npx wrangler kv namespace create CACHE      # prints an id: paste it into wrangler.toml, replacing REPLACE_WITH_KV_ID
npx wrangler secret put STRIPE_SECRET_KEY   # paste the sk_test_... key when asked
npx wrangler deploy                         # prints your Worker's address
```

`deploy` prints an address like `https://persist-donations.yourname.workers.dev`.

### 3. Point the site at the Worker

Replace `https://persist-donations.REPLACE-ME.workers.dev` with that address in **both** places:

- `give.html`: `var API = ...` near the top of the main script
- `index.html`: `var API = ...` in the "Live fundraising total" script near the bottom

Until this is done, the pages show the fallback figures written in the HTML, and the donate button shows an error instead of taking payments.

### 4. Test it

Open the give page, make a donation, and pay with the test card `4242 4242 4242 4242` (any future expiry date, any CVC). You should land on the thank-you screen, and the meters and supporters wall should update straight away. The payment appears in the Stripe dashboard under **Payments**, with `fund` shown in its metadata.

To test from your own computer, serve the site locally (for example `npx serve ..` from the `worker` folder). The Worker accepts requests from `localhost`.

### 5. Go live

1. Finish activating your Stripe account (bank details and identity check).
2. Switch the dashboard to live mode, copy the **live** secret key (`sk_live_...`), and run `npx wrangler secret put STRIPE_SECRET_KEY` again with it. Then run `npx wrangler deploy`.
3. Test payments don't count towards the live totals, so the meters start again from the offline figures.

## Day to day

**Money raised outside Stripe** (GoFundMe, sponsors, bank transfers): change `ROW_OFFLINE` or `CHARITY_OFFLINE` in `wrangler.toml`, then run `npx wrangler deploy`. The meters show this figure plus everything paid through Stripe.

**Goals:** change `ROW_GOAL` / `CHARITY_GOAL` the same way.

**Removing a message from the supporters wall:** find the payment in Stripe, copy its Checkout Session id (`cs_live_...`), add it to `HIDDEN_SUPPORTERS` (comma-separated), and deploy. The money still counts towards the total.

**Refunds:** refund in the Stripe dashboard. The totals drop within a couple of minutes.

**How much each charity is owed:** in Stripe, go to **Payments**, filter by metadata `fund` = `charity`, and export the list. The `/api/totals` address also shows the charity total after fees. Divide it by four.

**Prices:** the price of each option (km, meal and so on) is set in `src/index.js` (`ROW_OPTIONS`) and also shown in `give.html` (`OPTIONS`). If you change one, change the other, then deploy.
