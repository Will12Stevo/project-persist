# Project Persist

Website for Will & Georgia's unsupported row across the Atlantic with Atlantic Dash, departing January 2028 — 3,200 nautical miles from Lanzarote to Antigua, raising money for Action for M.E. and Diabetes UK.

Plain HTML/CSS/JS, no build step, no backend. The contact form posts to [Formspree](https://formspree.io).

## Preview locally

Just open `index.html` in a browser — or, for a closer match to how it'll behave when deployed, serve it:

```
npx serve .
```

## Structure

- `index.html` — the whole site (styles and scripts are inline)
- `images/` — photos and logos, referenced by relative path

## Editing

- Copy, sponsorship tiers, funding figures, etc. all live directly in `index.html` — search for the section by its `id` (e.g. `id="sponsor"`).
- To add a new Log entry, duplicate a `.log-entry` block in the `#log` section.
- To swap a photo, replace the file in `images/` with the same filename, or update the `src` in `index.html`.

## Before this goes live

- [ ] Replace `YOUR_FORM_ID` in the contact form's `action` attribute with your real endpoint from [formspree.io](https://formspree.io) (free tier is fine to start).
- [ ] Update the countdown target date in the `<script>` at the bottom of `index.html` once Atlantic Dash confirms the exact departure day.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo's **Settings → Pages**, set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The site publishes at `https://<your-username>.github.io/<repo-name>/` (or `https://<your-username>.github.io/` if the repo is named `<your-username>.github.io`).

To publish an update, commit your changes and push to `main` — Pages redeploys automatically within a minute or two.
