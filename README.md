```markdown
# xwOBA Matchups (Frontend)

This repository contains the Next.js frontend for the xwOBA Matchups app—a lightweight dashboard that displays the top daily expected wOBA (xwOBA) matchups between MLB batters and pitchers.

---

## 📦 Project Structure

```

xwoba-matchups-frontend/
├── .env.local.example      # Template for required environment variables
├── public/                 # Static assets (logos, icons, etc.)
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Global layout & header
│   │   └── page.tsx        # Home page: fetches & displays matchups
│   ├── lib/
│   │   ├── supabaseBrowserClient.ts  # Client-only Supabase helper
│   │   └── supabaseServerClient.ts   # Server-only Supabase helper
│   └── styles/
│       └── globals.css
├── .gitignore
├── next.config.js
├── package.json
└── README.md

````

---

## 🚀 Getting Started

### 1. Clone the Repo

```bash
git clone git@github.com:reston-rays/xwoba-matchups-frontend.git
cd xwoba-matchups-frontend
````

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Configuration

Copy the example environment file and fill in your real keys:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and set:

```env
# Public (browser) variables
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Private (server) variables
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> **Note:**
>
> * `.env.local` is git-ignored and should never be committed.
> * In Vercel, configure these same four variables under **Project Settings → Environment Variables** (Production only).

---

## 🏃‍♀️ Local Development

Start the dev server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The homepage will:

1. Call your `/api/matchups` endpoint (using `supabaseServerClient` under the hood).
2. Fetch and render today’s top 20 xwOBA matchups in a table.
3. Show loading and error states automatically.

---

## 🔌 API Routes

* **`GET /api/matchups?date=YYYY-MM-DD`**
  Returns up to 20 matchups for the given date (defaults to today) in JSON:

  ```json
  [
    {
      "batter_name": "Mookie Betts",
      "pitcher_name": "Max Scherzer",
      "avg_xwoba": 0.417
    },
    ...
  ]
  ```
* **`POST /api/ingest?date=YYYY-MM-DD`**
  (Called by infra/cron)
  Triggers ingestion of daily rosters, probable pitchers, and computes xwOBA matchups into Supabase.

---

## 📦 Deployment

This is designed to deploy on **Vercel**:

1. Connect your GitHub repo to Vercel.
2. Ensure all four env vars from `.env.local` are set in **Vercel Project Settings → Environment Variables**.
3. Push to `main`—Vercel will automatically build and deploy your app.

### (Optional) Schedule Daily Ingest

* **Vercel Cron Jobs**:
  In Vercel’s dashboard under **Settings → Cron Jobs**, add:

  ```
  URL: https://<your-project>.vercel.app/api/ingest
  Schedule: 0 13 * * *  # 9 AM ET every day (UTC 13:00)
  ```
* **Infra CI**:
  Alternatively, your infra repo’s GitHub Action can `curl` the deployed ingest endpoint after migrations.

---

## 🎯 Next Steps & Enhancements

* Add a **date picker** on the homepage to view past matchups.
* Implement **filters** (by team, handedness, xwOBA threshold).
* Improve UI/UX (team logos, sorting controls, mobile responsiveness).
* Add **end-to-end tests** (Playwright/Cypress) to verify API & table rendering.
* (Later) Integrate **authentication** and user-specific watchlists.

---

## ❓ Troubleshooting

* **Blank page or CORS errors**:
  Ensure your Supabase table `daily_matchups` allows anon `SELECT` in RLS policies, or disable RLS for MVP.
* **Environment variables not loading**:
  Restart your dev server after editing `.env.local`. In Vercel, re-deploy after updating vars.
* **Fetch errors in console**:
  Check that your `/api/matchups` route is reachable (no 404) and that your Supabase DB has been seeded or ingested with data.

---

## 📄 License

MIT © [reston-rays](https://github.com/reston-rays)

```
```
