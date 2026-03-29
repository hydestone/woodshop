# Workshop App — Setup Guide

## Step 1 — Supabase: Create tables

Go to your Supabase project → SQL Editor → New query → paste and run all of this:

```sql
-- Projects
create table if not exists projects (
  id text primary key,
  name text not null,
  wood_type text not null default '',
  status text not null default 'active',
  description text not null default '',
  created_at timestamptz not null default now()
);

-- Build steps
create table if not exists steps (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  note text not null default '',
  completed boolean not null default false,
  sort_order int not null default 0
);

-- Finish coats
create table if not exists coats (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  product text not null,
  coat_number int not null default 1,
  notes text not null default '',
  applied_at timestamptz,
  interval_value numeric not null default 4,
  interval_unit text not null default 'hours'
);

-- Maintenance tasks
create table if not exists maintenance (
  id text primary key,
  name text not null,
  category text not null default 'General',
  last_done timestamptz,
  interval_days int not null default 14,
  notes text not null default ''
);

-- Shopping items
create table if not exists shopping (
  id text primary key,
  name text not null,
  qty text not null default '',
  unit text not null default '',
  store text not null default '',
  notes text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Photos
create table if not exists photos (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  photo_type text not null default 'progress',
  created_at timestamptz not null default now()
);

-- Disable RLS on all tables (single-user personal app)
alter table projects   disable row level security;
alter table steps      disable row level security;
alter table coats      disable row level security;
alter table maintenance disable row level security;
alter table shopping   disable row level security;
alter table photos     disable row level security;
```

You should see "Success. No rows returned." for each statement.

---

## Step 2 — Supabase: Create photo storage bucket

1. In your Supabase project, click **Storage** in the left sidebar
2. Click **New bucket**
3. Name: `woodshop-photos`
4. Toggle **Public bucket** ON
5. Click **Save**

Then go back to SQL Editor and run this:

```sql
-- Allow public reads of photos
create policy "Public read photos"
  on storage.objects for select
  using ( bucket_id = 'woodshop-photos' );

-- Allow uploads
create policy "Public upload photos"
  on storage.objects for insert
  with check ( bucket_id = 'woodshop-photos' );

-- Allow deletes
create policy "Public delete photos"
  on storage.objects for delete
  using ( bucket_id = 'woodshop-photos' );
```

---

## Step 3 — Local setup

```bash
cd woodshop-app
cp .env.example .env
```

Open `.env` and fill in your values from Supabase → Settings → API Keys:
- `VITE_SUPABASE_URL` = your Project URL
- `VITE_SUPABASE_ANON_KEY` = your publishable key (sb_publishable_...)

Then:

```bash
npm install
npm run dev
```

Open http://localhost:5173 — the app should load.

---

## Step 4 — Deploy to Vercel

1. Push this folder to a GitHub repo (public or private)
2. Go to vercel.com → New Project → Import your GitHub repo
3. Vercel auto-detects Vite — no build settings needed
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click Deploy

---

## Step 5 — iPhone home screen

Once deployed on Vercel:
1. Open your `.vercel.app` URL in **Safari** on iPhone
2. Tap the Share button
3. Tap **Add to Home Screen**
4. Name it "Workshop"

The app runs full-screen like a native app with data synced to Supabase.
