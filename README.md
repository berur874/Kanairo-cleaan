# Kanairo-Klean ♻️
A digital marketplace platform connecting informal waste collectors, local aggregator yards, and industrial recyclers — bringing price transparency, instant payments, and full material traceability to the waste economy.

## The Problem
- **Asymmetric Information** - Collectors sell materials at arbitrary prices due to a lack of market data.
- **Liquidity Delays** - Independent collectors face significant gaps in receiving payments. 
- **Unpredictable Supply** - Industrial recyclers suffer from frequent supply shocks.  
- **Inefficient Brokerage** - The current waste economy relies on manual, inefficient middleman structures.

## Our Solution
- **Price Discovery** - Real-time market rates for PET, HDPE, and E-Waste. 
- **Verified Inventory** - Digital logging of "Material Hotspots" for real-time tracking.
- **Instant Settlement** - Automated M-Pesa payouts at the point of weight verification.  


## Who it is For
| Primary Users (Nodes) | Beneficiaries | Industrial Clients | Corporate Clients |
| :--- | :--- | :--- | :--- |
| Local aggregators and yard owners who act as digital nodes | Thousands of independent street-level collectors | Recycling plants requiring steady, traceable supply chains | Companies requiring Extended Producer Responsibility (EPR) compliance |


## Key Difference
- **Digital Circular Ledger** — Transforms physical waste into a traceable digital asset.
- **The "Micro-Hub" Strategy** — Bridges the device gap by using yard owners as proxies for collectors who lack smartphones/data access.
- **EPR Compliance** — Creates a verified paper trail aligned with current 2026 environmental regulations.
- **First-Mover Advantage** — Purpose-built compliance tooling aligned with active 2026 EPR standards, combined with a proxy-user model that sidesteps the informal sector's device-access barrier.


## Project Structure
```text
Kanairo-Klean/
├── public/
│   ├── data/
│   │   └── site-data.json       # Centralized platform static data
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Header.jsx           # Global SPA Navigation with React Router
│   │   └── Footer.jsx
│   ├── css/
│   │   ├── styles.css           # Global typography, colors & variables
│   │   ├── dashboard.css        # Scoped CSS grid-shell layouts
│   │   └── responsive.css       # Layout media queries
│   ├── hooks/
│   │   └── useScrollReveal.jsx  # Intersection observer hook for viewport triggers
│   ├── pages/
│   │   ├── Home.jsx             # Platform landing page
│   │   ├── About.jsx            # Platform mission & objectives
│   │   ├── Compliance.jsx       # EPR compliance tools & details
│   │   ├── Dashboard.jsx        # Node operator panel (sticky flex-aside layout)
│   │   └── Marketplace.jsx      # Active listings & pricing interface
│   ├── utils/
│   │   └── dataLoader.jsx       # Cached module-level Promise loader for site-data
│   ├── App.jsx                  # React Router configuration & path mappings
│   └── main.jsx                 # Vite application entry point
├── package.json                 # Dependency manifests (React, Router, Recharts, Lucide)
├── vite.config.js               # Vite compilation profiles
└── README.md
```


## Tech Stack & Dependencies
- **Core Engine:** React 18 / Vite (Single Page Application architecture)
- **Routing:** `react-router-dom` (Dynamic client-side transitions)
- **Icons:** `lucide-react` (SVG-based system icons)
- **Analytics:** `recharts` (Declarative interactive node-dashboard visualizers)


## Key Metrics We are Targeting
- 📈 **Collector Earnings** — Up to 30% increase in income via fair market rates
- 📦 **Supply Predictability** — Reduced supply shocks for industrial recyclers
- ✅ **Traceability** — 100% material traceability from collector to plant


## Getting Started

### Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/maishamagicast/Kanairo-Klean.git](https://github.com/maishamagicast/Kanairo-Klean.git)
   cd Kanairo-Klean
   ```

2. Install the application dependencies:
   ```bash
   npm install
   ```

3. Spin up the local development server:
   ```bash
   npm run dev
   ```

4. Open the browser and navigate to the local server port provided by Vite (typically `http://localhost:5173`).


## Revenue Model
- **Marketplace Efficiency** — Capturing transactional micro-fees by replacing inefficient manual brokerage structures with a streamlined digital escrow system.
- **Traceability Data** — Offering enterprise SaaS API access to verified logistics audit logs to fulfill corporate 2026 EPR compliance requirements.
```
# Kanairo: localStorage → Supabase migration

## What changed

Inventory (`kanairo_hotspots`) and transaction receipts (`kanairo_transactions`)
no longer live in `localStorage`. They're now in your connected Supabase
project (`fgjcuumoqmlkqrjichtl`), in three tables:

- **`hotspots`** — `id`, `name`
- **`hotspot_materials`** — `id`, `hotspot_id` (→ hotspots), `material_name`, `quantity`
- **`transactions`** — `id` (M-Pesa receipt), `material`, `quantity`, `amount`, `created_at`

Tables and RLS policies were already created in your project. RLS is on,
with public read/insert/update policies on all three tables — this is a
no-auth demo app, so I kept the same open-access model your `localStorage`
version had (anyone using the app could read/write it client-side either
way). If you later add user accounts, tighten these policies to scope rows
per user.

Realtime is enabled on `hotspots` and `hotspot_materials`, so
`onHotspotsChange` now uses a Supabase Realtime subscription instead of the
browser's `storage`/custom `window` event — updates now sync **across
browser tabs and devices**, not just within one tab.

## Files changed

- `src/utils/supabaseClient.jsx` — **new.** Creates the Supabase client from env vars.
- `src/utils/storage.jsx` — rewritten. All functions are now `async` and hit the database:
  - `getHotspots()` — was sync, now returns a `Promise`
  - `saveHotspots()` — **removed.** Replaced by the more targeted `addInventory(hotspotName, materialName, quantity)`
  - `deductInventory()` — same name, now async
  - `onHotspotsChange()` — now backed by Supabase Realtime
  - `aggregateInventory()` — unchanged, still a pure function
- `src/utils/payments.jsx` — `recordTransaction()` is now `async` and writes to the `transactions` table.
- `src/components/DashboardInventory.jsx` — `MaterialMix`, `InventoryBars`, `LogMaterialForm` updated for the async API. Also fixed an import typo (`marketData.jxs` → `marketData.jsx`) that would have broken the build.
- `src/pages/Dashboard.jsx` — hotspots are now loaded via `useEffect` instead of a sync `useState` initializer.
- `src/pages/Marketplace.jsx` — same hotspots fix, plus `handleConfirmMpesa` is now `async` with error handling if the payment/DB write fails.

## Setup steps

1. Install the Supabase client:
   ```bash
   npm install @supabase/supabase-js
   ```
2. Copy `.env.example` to `.env` in your project root (it's pre-filled with
   your project's URL and anon/publishable key — safe to expose client-side,
   that's what RLS policies are for):
   ```bash
   cp .env.example .env
   ```
3. Drop the updated files into your project at the paths shown above,
   replacing the existing ones (and adding the new `supabaseClient.jsx`).
4. Restart your dev server so Vite picks up the new env vars.

## One behavior change worth knowing

Previously, if no `kanairo_hotspots` key existed in `localStorage`, the app
seeded itself from `data/site-data.json`'s `defaultHotspots` (see the bottom
of the old `storage.jsx`). That auto-seed-on-first-load logic was removed —
since the database is now shared across everyone using the app, it
shouldn't silently reseed itself. If you want the same "populate demo data
on first run" behavior, I can add a one-off SQL seed insert instead — just
say the word.# Kanairo-cleaan
