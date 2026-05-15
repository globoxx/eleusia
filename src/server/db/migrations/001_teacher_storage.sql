create extension if not exists pgcrypto;

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teacher_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists room_templates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  name text not null,
  rule text not null,
  round_duration integer not null,
  image_set text not null,
  auto_run boolean not null,
  has_ai boolean not null,
  size_limit integer not null,
  accepted_images jsonb not null default '[]'::jsonb,
  refused_images jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists room_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  template_id uuid references room_templates(id) on delete set null,
  live_room_id text not null unique,
  status text not null,
  started_at timestamptz,
  finished_at timestamptz,
  initial_config jsonb not null,
  round_history jsonb not null default '[]'::jsonb,
  final_users jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_sessions_status_check check (status in ('lobby', 'running', 'paused', 'waitingCreator', 'finished', 'expired'))
);

create index if not exists teacher_sessions_token_hash_idx on teacher_sessions(token_hash);
create index if not exists room_templates_teacher_id_updated_at_idx on room_templates(teacher_id, updated_at desc);
create index if not exists room_templates_teacher_id_archived_at_idx on room_templates(teacher_id, archived_at);
create index if not exists room_sessions_teacher_id_created_at_idx on room_sessions(teacher_id, created_at desc);
create index if not exists room_sessions_template_id_idx on room_sessions(template_id);
create index if not exists room_sessions_live_room_id_idx on room_sessions(live_room_id);
create index if not exists room_sessions_status_idx on room_sessions(status);
