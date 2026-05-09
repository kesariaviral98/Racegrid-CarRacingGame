create table matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  room_id uuid not null references rooms(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'finished')),
  winner_team text check (winner_team in ('A', 'B')),
  started_at timestamptz,
  finished_at timestamptz
);

alter table matches enable row level security;

create table match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id),
  user_id uuid not null references users(id),
  tenant_id uuid not null references tenants(id),
  team text not null check (team in ('A', 'B')),
  finish_position integer,
  finish_time_ms integer,
  score integer not null default 0
);

alter table match_players enable row level security;

create policy "Matches are viewable by users in same tenant"
  on matches for select
  using (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
  );

create policy "Match players are viewable by users in same tenant"
  on match_players for select
  using (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
  );

create policy "Authenticated users can insert match players"
  on match_players for insert
  with check (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
  );
