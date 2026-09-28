create table public.education (
  id text primary key default gen_random_uuid()::text,
  degree text not null check (length(trim(degree)) > 0),
  school text not null check (length(trim(school)) > 0),
  date date not null,
  location text not null check (length(trim(location)) > 0),
  city_name text,
  latitude float8 not null check (latitude between -90 and 90),
  longitude float8 not null check (longitude between -180 and 180)
);

create index idx_education_date on public.education(date desc);
alter table public.education enable row level security;
grant select on public.education to anon, authenticated;
grant select, insert, update, delete on public.education to service_role;
create policy "Anyone can read education" on public.education for select to anon, authenticated using (true);

insert into public.education (id, degree, school, date, location, city_name, latitude, longitude) values
  ('school-2010', '小学', '厦门市同安区第一实验小学', '2010-09-01', '厦门市', '厦门市', 24.72, 118.15),
  ('school-2016', '初中', '厦门市东山中学', '2016-09-01', '厦门市', '厦门市', 24.72, 118.15),
  ('school-2019', '高中', '厦门外国语学校', '2019-09-01', '厦门市', '厦门市', 24.48, 118.09),
  ('school-2022', '本科', '福州大学', '2022-09-01', '福州市', '福州市', 26.06, 119.2),
  ('school-2026', '硕士研究生', '南洋理工大学', '2026-08-01', '新加坡', null, 1.3483, 103.6831);
