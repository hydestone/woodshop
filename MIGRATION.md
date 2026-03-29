# Database Migration — Run this in Supabase SQL Editor

Run this entire block in a **new query** in your Supabase SQL Editor.
It is safe to run even if some columns already exist.

```sql
-- Add new columns to existing tables
alter table shopping     add column if not exists cost numeric;
alter table shopping     add column if not exists purchased_at timestamptz;
alter table projects     add column if not exists dimensions_rough text not null default '';
alter table projects     add column if not exists dimensions_final text not null default '';
alter table photos       add column if not exists tags text not null default '';

-- Wood stock
create table if not exists wood_stock (
  id text primary key,
  species text not null,
  location text not null default '',
  harvested_at date,
  intended_use text not null default '',
  status text not null default 'Drying',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Moisture log (separate table for tracking over time)
create table if not exists moisture_log (
  id text primary key,
  stock_id text not null references wood_stock(id) on delete cascade,
  reading numeric not null,
  notes text not null default '',
  logged_at timestamptz not null default now()
);

-- Brainstorming notes
create table if not exists brainstorming (
  id text primary key,
  content text not null,
  created_at timestamptz not null default now()
);

-- Finish product library
create table if not exists finish_products (
  id text primary key,
  name text not null,
  manufacturer text not null default '',
  category text not null default 'Topcoat',
  notes text not null default '',
  feedback text not null default '',
  created_at timestamptz not null default now()
);

-- Resources / links
create table if not exists resources (
  id text primary key,
  title text not null,
  url text not null,
  category text not null default 'General',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Shop improvements
create table if not exists shop_improvements (
  id text primary key,
  title text not null,
  category text not null default 'Wish List',
  notes text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Disable RLS on new tables
alter table wood_stock       disable row level security;
alter table moisture_log     disable row level security;
alter table brainstorming    disable row level security;
alter table finish_products  disable row level security;
alter table resources        disable row level security;
alter table shop_improvements disable row level security;
```
