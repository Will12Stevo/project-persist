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
  // GoFundMe donors, copied 2026-11-13. Dates are approximate (GoFundMe shows "4 mos" etc).
  { name: 'Varun Kasisomayajula', amount: 225, date: '2026-10-19' },
  { name: 'Gaby Morrison', amount: 200, date: '2026-10-13' },
  { name: 'Luke Conkleton', amount: 100, date: '2026-11-03' },
  { name: 'Jeetesh Malhi', amount: 100, date: '2026-10-17' },
  { name: 'Judith Hargreaves', amount: 100, date: '2026-09-13' },
  { name: 'Anonymous', amount: 200, date: '2026-09-13' },
  { name: 'Martin Richardson', amount: 60, date: '2026-09-13' },
  { name: 'Paul Dukes', amount: 100, date: '2026-07-13' },
  { name: 'MarieCatherine Fraser', amount: 100, date: '2026-07-13' },
  { name: 'Pete Harris', amount: 50, date: '2026-08-13' },
  { name: 'Garry Stevens', amount: 50, date: '2026-07-13' },
  { name: 'Gordon Clark', amount: 50, date: '2026-07-13' },
  { name: 'Lucy Martin', amount: 25, date: '2026-07-13' },
  { name: 'Catherine OSullivan', amount: 25, date: '2026-07-13' },
  { name: 'Helen McDonald', amount: 25, date: '2026-07-13' },
  { name: 'Shona Galloway', amount: 20, date: '2026-09-13' },
  { name: 'Helena Landau', amount: 20, date: '2026-07-13' },
  { name: 'Anonymous', amount: 20, date: '2026-08-13' },
  { name: 'Harry Seddon', amount: 10, date: '2026-07-13' },
  { name: 'Lydia Ukrasin', amount: 10, date: '2026-07-13' },
  { name: 'Alastair Webb', amount: 30, date: '2026-07-13' },
  { name: 'Tiziano Li Kai Hu', amount: 175, date: '2026-06-13' },
  { name: 'Anonymous', amount: 250, date: '2026-05-13' },
  { name: 'Ruifeng Li', amount: 15, date: '2026-05-13' },
  { name: 'Evan Bowers', amount: 10, date: '2026-05-13' },
  { name: 'Shona Galloway', amount: 20, date: '2026-05-13' },
  { name: 'Sarah Harman', amount: 30, date: '2026-05-13' },
  { name: 'Katarzyna Wedolowska', amount: 10, date: '2026-05-13' },
  { name: 'Anonymous', amount: 250, date: '2026-04-29' },
];
