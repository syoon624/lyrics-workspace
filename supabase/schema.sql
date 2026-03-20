create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  display_name text not null default '사용자',
  created_at timestamptz not null default now()
);

create table if not exists folders (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists templates (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  content text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists drafts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  lyrics text not null default '',
  ref_audio_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audios (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  folder_name text not null,
  original_name text not null,
  mime_type text not null,
  size bigint not null default 0,
  storage_path text not null unique,
  public_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists docs (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  folder_name text not null,
  original_name text not null,
  mime_type text not null,
  size bigint not null default 0,
  storage_path text not null unique,
  public_url text not null,
  created_at timestamptz not null default now()
);
