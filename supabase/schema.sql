-- Enable UUID
create extension if not exists "pgcrypto";

-- STRATEGIES (Playbook)
create table strategies (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null,
  version          text not null,
  context_rules    text,
  entry_rules      text,
  risk_rules       text,
  management_rules text,
  created_at       timestamptz default now() not null
);

-- TRADES
create table trades (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  strategy_id     uuid references strategies(id) on delete set null,
  pair            text not null,
  direction       text check (direction in ('long','short')) not null,
  session         text not null,
  date_backtested date not null,
  entry_time      time,
  exit_time       time,
  result          text check (result in ('win','loss','breakeven','missed')),
  rr_planned      numeric(5,2),
  rr_realized     numeric(5,2),
  exit_type       text check (exit_type in ('tp','sl','breakeven','trailing','manual')),
  emotion         text,
  status          text check (status in ('quick', 'in_progress', 'complete')) default 'in_progress' not null,
  journal_type    text check (journal_type in ('global','bias','poi','confirmation')) default 'global' not null,
  created_at      timestamptz default now() not null
);

-- STEPS
create table steps (
  id         uuid primary key default gen_random_uuid(),
  trade_id   uuid references trades(id) on delete cascade not null,
  "order"    int not null default 0,
  type       text not null,
  title      text not null,
  timeframe  text,
  notes      text,
  fields     jsonb,
  created_at timestamptz default now() not null
);

-- STEP IMAGES
create table step_images (
  id           uuid primary key default gen_random_uuid(),
  step_id      uuid references steps(id) on delete cascade not null,
  storage_path text,
  source       text check (source in ('telegram','upload','url')) not null,
  url          text,
  created_at   timestamptz default now() not null
);

-- COMBO MEMORY
create table combo_memory (
  id         uuid primary key default gen_random_uuid(),
  field_key  text not null,
  value      text not null,
  used_count int default 1,
  last_used  timestamptz default now(),
  unique(field_key, value)
);

-- ROW LEVEL SECURITY
alter table strategies   enable row level security;
alter table trades       enable row level security;
alter table steps        enable row level security;
alter table step_images  enable row level security;
alter table combo_memory enable row level security;

-- Policies (solo user — accès total à ses propres données)
create policy "owner" on strategies   for all using (auth.uid() = user_id);
create policy "owner" on trades       for all using (auth.uid() = user_id);
create policy "owner" on steps        for all using (
  exists (select 1 from trades where trades.id = steps.trade_id and trades.user_id = auth.uid())
);
create policy "owner" on step_images  for all using (
  exists (select 1 from steps join trades on trades.id = steps.trade_id
          where steps.id = step_images.step_id and trades.user_id = auth.uid())
);
create policy "owner" on combo_memory for all using (auth.uid() is not null);

-- STORAGE BUCKET
insert into storage.buckets (id, name, public) values ('trade-images', 'trade-images', true);
create policy "owner" on storage.objects for all using (auth.uid() is not null);
