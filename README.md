# Africa Connect

Marketplace connecting African farmers directly with buyers of agricultural produce — browse verified harvests, negotiate directly with farmers, and settle trades through a protected escrow flow.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4 (via `@tailwindcss/vite`, theme tokens in [src/index.css](src/index.css))
- React Router for client-side routing

The app is fully client-side for this build: listings, auth, messaging, and orders are mock data persisted to the browser's `localStorage` (see `src/context/*.tsx`). No backend or environment variables are required to run it — see [.env.example](.env.example) for what a future backend integration would need.

## Structure

- `src/components/` — UI components (`Navbar`, `Hero`, `CropCard`, `ProductDetailModal`, `EscrowPaymentModal`, …)
- `src/pages/` — routed pages (`Marketplace`, `FarmerDashboard`, `BuyerDashboard`, `Messages`, `Auth`, …)
- `src/context/` — global state: auth, crop listings, watchlist, messaging, orders
- `src/data/` — mock seed data (crop catalog, FAQs, community posts)
- `src/types/` — shared types and constants (currencies, languages, roles, listings, orders)

## Theme

Earth-tone palette anchored on `#1b4332` (`--color-earth-800`), with sand/clay accent tones defined in [src/index.css](src/index.css).

## Commands

```bash
npm install      # install dependencies
npm run dev      # start dev server at http://localhost:5173
npm run build    # type-check (tsc -b) and produce a production build in dist/
npm run preview  # serve the production build locally for a final check
npm run lint     # run oxlint
```

## Deployment

The app builds to a static `dist/` folder, so it deploys to any static host. Client-side routing needs a rewrite rule so deep links like `/marketplace` or `/farmer/dashboard` don't 404 — this repo already includes [vercel.json](vercel.json) (Vercel) and [public/_redirects](public/_redirects) (Netlify) for that.

### 1. Push the repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Create the empty repo on GitHub first — via the web UI, or `gh repo create <your-repo> --public --source=. --remote=origin` if you have the GitHub CLI installed.)

### 2. Deploy — Vercel

**Via the dashboard:**
1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
2. Vercel auto-detects Vite: build command `npm run build`, output directory `dist`. Leave the defaults (already mirrored in `vercel.json`).
3. Click **Deploy**. Every push to `main` redeploys automatically.

**Via the CLI:**
```bash
npm install -g vercel
vercel login
vercel        # first run links/creates the project, deploys a preview
vercel --prod # promote to production
```

### 3. Deploy — Netlify

**Via the dashboard:**
1. Go to [app.netlify.com/start](https://app.netlify.com/start) and connect the GitHub repo.
2. Set build command to `npm run build` and publish directory to `dist`.
3. Click **Deploy site**. The `public/_redirects` file handles SPA routing automatically.

**Via the CLI:**
```bash
npm install -g netlify-cli
netlify login
netlify init          # link or create a site, confirm build command/publish dir
netlify deploy --build          # preview deploy
netlify deploy --build --prod   # production deploy
```

### Environment variables

None are required for this build. If you wire up a real backend, FX-rate API, or escrow provider later, copy `.env.example` to `.env.local` for local dev and add the same `VITE_`-prefixed keys in your host's project settings (Vercel: Project → Settings → Environment Variables; Netlify: Site configuration → Environment variables).
