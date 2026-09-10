# Africa Connect

Marketplace connecting African farmers directly with buyers of agricultural produce.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4 (via `@tailwindcss/vite`, theme tokens in [src/index.css](src/index.css))

## Structure

- `src/components/` — UI components (`Navbar`, `Hero`, escrow/order UI, charts, etc.)
- `src/pages/` — routed pages (`Home`, `Marketplace`, `Auth`, `Messages`, `FarmerDashboard`, `BuyerDashboard`, etc.)
- `src/context/` — React context providers (`AuthContext`, `OrdersContext`, `MessagingContext`, `CropContext`, `CurrencyContext`, `WatchlistContext`)
- `src/lib/` — client logic (Supabase client/mappers, escrow calculations, payment SDK wrappers, forecasting, containment guards)
- `src/hooks/` — shared hooks (e.g. `useLocalStorage`)
- `src/data/` — static/mock data (crops, listings, FAQs, community content)
- `src/types/` — shared types and constants (currencies, languages, roles)
- `api/` — Vercel serverless functions (Stripe/Paystack/Flutterwave webhook handlers, Supabase admin client)
- `supabase/schema.sql` — Postgres schema, RLS policies, and triggers (may drift from the live database — see [PAYMENT_SECURITY_AUDIT.md](PAYMENT_SECURITY_AUDIT.md))
- `tests/` — Node test runner suites covering escrow math, webhooks, and payment containment

## Theme

Earth-tone palette anchored on `#1b4332` (`--color-earth-800`), with sand/clay accent tones defined in [src/index.css](src/index.css).

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — lint
