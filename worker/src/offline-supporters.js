// Supporters who gave outside Stripe (e.g. GoFundMe), shown on the supporters wall.
// Their money is already counted in ROW_OFFLINE / CHARITY_OFFLINE in wrangler.toml,
// so these entries only affect the wall, not the totals.
//
// Fields:
//   name    as it should appear ("Anonymous" for anyone who gave anonymously)
//   amount  in pounds
//   date    'YYYY-MM-DD', used to order the wall (newest first)
//   kind    'row' or 'charity' (optional, defaults to 'row')
//   what    short label (optional, defaults to 'Donated on GoFundMe')
//   msg     message to show (optional)
//
// After editing, run `npx wrangler deploy` from the worker folder.

export default [
  // { name: 'Jane Smith', amount: 50, date: '2026-10-01', msg: 'Good luck!' },
];
