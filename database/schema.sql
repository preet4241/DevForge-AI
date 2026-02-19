
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects Table
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  type text check (type in ('web', 'app', 'bot', 'software')),
  status text default 'active',
  created_at bigint default (extract(epoch from now()) * 1000),
  updated_at bigint default (extract(epoch from now()) * 1000),
  metadata jsonb default '{}'::jsonb
);

-- Code Files Table (Relational structure for code)
create table if not exists public.code_files (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  language text,
  content text,
  path text,
  created_at bigint default (extract(epoch from now()) * 1000),
  unique(project_id, path, name)
);

-- Agent Activity Logs
create table if not exists public.activity_logs (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  agent_id text not null,
  type text not null,
  text text not null,
  detail text,
  timestamp bigint default (extract(epoch from now()) * 1000),
  done boolean default false
);

-- Indexes for performance
create index if not exists idx_projects_created_at on public.projects(created_at desc);
create index if not exists idx_code_files_project on public.code_files(project_id);
create index if not exists idx_activity_logs_project on public.activity_logs(project_id);

-- Simple Row Level Security (RLS) - Open for demo, lock down in production
alter table public.projects enable row level security;
alter table public.code_files enable row level security;
alter table public.activity_logs enable row level security;

create policy "Enable all access for all users" on public.projects for all using (true);
create policy "Enable all access for all users" on public.code_files for all using (true);
create policy "Enable all access for all users" on public.activity_logs for all using (true);
