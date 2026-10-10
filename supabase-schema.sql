-- TOKEN RADAR — run once in Supabase SQL Editor.
-- No table is readable/writable from the browser anon role. Edge Functions use service_role.
create extension if not exists pgcrypto;

create table if not exists public.token_scans (
  id bigint generated always as identity primary key,
  token_address text not null check (token_address ~ '^0x[a-f0-9]{40}$'),
  token_name text,
  token_symbol text,
  score integer check (score between 0 and 100),
  verdict text,
  source text,
  result jsonb not null,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists token_scans_address_scanned_idx
  on public.token_scans (token_address, scanned_at desc);
create index if not exists token_scans_score_scanned_idx
  on public.token_scans (score desc, scanned_at desc);

-- Keep rate-limit buckets private. The function only hashes a request IP and does not store raw IP.
create table if not exists public.scan_rate_limits (
  ip_hash text primary key check (length(ip_hash) = 64),
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.consume_scan_rate_limit(
  p_ip_hash text,
  p_window_seconds integer default 60,
  p_max_requests integer default 12
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.scan_rate_limits%rowtype;
  v_now timestamptz := now();
begin
  if p_ip_hash is null or length(p_ip_hash) <> 64 then
    return false;
  end if;
  insert into public.scan_rate_limits(ip_hash, window_started_at, request_count, updated_at)
  values (p_ip_hash, v_now, 1, v_now)
  on conflict (ip_hash) do nothing;

  select * into v_row from public.scan_rate_limits where ip_hash = p_ip_hash for update;
  if v_now - v_row.window_started_at >= make_interval(secs => greatest(1, p_window_seconds)) then
    update public.scan_rate_limits
      set window_started_at = v_now, request_count = 1, updated_at = v_now
      where ip_hash = p_ip_hash;
    return true;
  elsif v_row.request_count < greatest(1, p_max_requests) then
    update public.scan_rate_limits
      set request_count = request_count + 1, updated_at = v_now
      where ip_hash = p_ip_hash;
    return true;
  else
    return false;
  end if;
end;
$$;

alter table public.token_scans enable row level security;
alter table public.scan_rate_limits enable row level security;

revoke all on public.token_scans from anon, authenticated;
revoke all on public.scan_rate_limits from anon, authenticated;
revoke all on function public.consume_scan_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_scan_rate_limit(text, integer, integer) to service_role;
grant select, insert on public.token_scans to service_role;
grant usage, select on sequence public.token_scans_id_seq to service_role;

-- Optional later: outcome snapshots for measured signal performance. Do not label signals profitable
-- until entry price, exit price, slippage, liquidity, and evaluation window are stored and audited.
create table if not exists public.signal_outcomes (
  id bigint generated always as identity primary key,
  token_address text not null check (token_address ~ '^0x[a-f0-9]{40}$'),
  signal_type text not null,
  signal_score integer check (signal_score between 0 and 100),
  observed_at timestamptz not null default now(),
  entry_price_usd numeric,
  outcome_1h jsonb,
  outcome_6h jsonb,
  outcome_24h jsonb,
  outcome_7d jsonb,
  evaluation_status text not null default 'pending'
    check (evaluation_status in ('pending','evaluated','insufficient_data','invalid')),
  created_at timestamptz not null default now()
);
alter table public.signal_outcomes enable row level security;
revoke all on public.signal_outcomes from anon, authenticated;
grant select, insert, update on public.signal_outcomes to service_role;
grant usage, select on sequence public.signal_outcomes_id_seq to service_role;
