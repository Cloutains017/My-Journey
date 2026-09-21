-- 在 Supabase SQL Editor 中执行
create table trips (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text not null unique,
  date date not null,
  end_date date,
  location text not null,
  city_name text,
  latitude float8 not null,
  longitude float8 not null,
  cover_image text,
  content text,
  rating int2 not null check (rating between 1 and 5),
  created_at timestamptz default now()
);

create table photos (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade not null,
  url text not null,
  caption text,
  sort_order int2 default 0,
  width int2,
  height int2,
  created_at timestamptz default now()
);

create table agreement_votes (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade not null,
  nickname text not null,
  agreement int2 not null check (agreement between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create table desire_votes (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade not null,
  nickname text not null,
  desire_level int2 not null check (desire_level between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

-- 创建索引
create index idx_photos_trip_id on photos(trip_id);
create index idx_agreement_votes_trip_id on agreement_votes(trip_id);
create index idx_desire_votes_trip_id on desire_votes(trip_id);
create index idx_trips_date on trips(date desc);
create index idx_trips_created_at on trips(created_at desc);

-- 同一昵称对同一旅程只能投票一次
alter table agreement_votes add unique(trip_id, nickname);
alter table desire_votes add unique(trip_id, nickname);

-- 启用行级安全
alter table trips enable row level security;
alter table photos enable row level security;
alter table agreement_votes enable row level security;
alter table desire_votes enable row level security;

-- 城市边界数据（运行时动态添加）
create table city_boundaries (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  adcode text not null,
  geojson jsonb not null,
  created_at timestamptz default now()
);

-- 公开可读
alter table city_boundaries enable row level security;

create policy "Anyone can read trips" on trips for select using (true);
create policy "Anyone can read photos" on photos for select using (true);
create policy "Anyone can read agreement_votes" on agreement_votes for select using (true);
create policy "Anyone can read desire_votes" on desire_votes for select using (true);
create policy "Anyone can read city_boundaries" on city_boundaries for select using (true);
