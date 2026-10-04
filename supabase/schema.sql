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
  summary text constraint trips_summary_length check (char_length(summary) <= 120),
  cover_card_position jsonb constraint trips_card_position_valid check (
    case when cover_card_position is null then true
      when jsonb_typeof(cover_card_position) = 'object'
        and jsonb_typeof(cover_card_position->'x') = 'number'
        and jsonb_typeof(cover_card_position->'y') = 'number'
        and cover_card_position - 'x' - 'y' = '{}'::jsonb
      then (cover_card_position->>'x')::numeric between 0 and 100
        and (cover_card_position->>'y')::numeric between 0 and 100
      else false end
  ),
  cover_hero_position jsonb constraint trips_hero_position_valid check (
    case when cover_hero_position is null then true
      when jsonb_typeof(cover_hero_position) = 'object'
        and jsonb_typeof(cover_hero_position->'x') = 'number'
        and jsonb_typeof(cover_hero_position->'y') = 'number'
        and cover_hero_position - 'x' - 'y' = '{}'::jsonb
      then (cover_hero_position->>'x')::numeric between 0 and 100
        and (cover_hero_position->>'y')::numeric between 0 and 100
      else false end
  ),
  content text,
  photo_groups jsonb default '[]'::jsonb,
  rating int2 not null check (rating between 1 and 5),
  created_at timestamptz default now()
);

create table education (
  id text primary key default gen_random_uuid()::text,
  degree text not null check (length(trim(degree)) > 0),
  school text not null check (length(trim(school)) > 0),
  date date not null,
  location text not null check (length(trim(location)) > 0),
  city_name text,
  latitude float8 not null check (latitude between -90 and 90),
  longitude float8 not null check (longitude between -180 and 180)
);

insert into education (id, degree, school, date, location, city_name, latitude, longitude) values
  ('school-2010', '小学', '厦门市同安区第一实验小学', '2010-09-01', '厦门市', '厦门市', 24.72, 118.15),
  ('school-2016', '初中', '厦门市东山中学', '2016-09-01', '厦门市', '厦门市', 24.72, 118.15),
  ('school-2019', '高中', '厦门外国语学校', '2019-09-01', '厦门市', '厦门市', 24.48, 118.09),
  ('school-2022', '本科', '福州大学', '2022-09-01', '福州市', '福州市', 26.06, 119.2),
  ('school-2026', '硕士研究生', '南洋理工大学', '2026-08-01', '新加坡', null, 1.3483, 103.6831);

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
create index idx_education_date on education(date desc);

-- 同一昵称对同一旅程只能投票一次
alter table agreement_votes add unique(trip_id, nickname);
alter table desire_votes add unique(trip_id, nickname);

-- 启用行级安全
alter table trips enable row level security;
alter table education enable row level security;
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
revoke all on table education from public, anon, authenticated;
grant select on education to anon, authenticated;
grant select, insert, update, delete on education to service_role;
create policy "Anyone can read education" on education for select to anon, authenticated using (true);
create policy "Anyone can read photos" on photos for select using (true);
create policy "Anyone can read agreement_votes" on agreement_votes for select using (true);
create policy "Anyone can read desire_votes" on desire_votes for select using (true);
create policy "Anyone can read city_boundaries" on city_boundaries for select using (true);
