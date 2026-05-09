create table rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null unique,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  host_id uuid not null references users(id),
  created_at timestamptz default now()
);

alter table rooms enable row level security;

create policy "Rooms are viewable by users in same tenant"
  on rooms for select
  using (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
  );

create policy "Authenticated users can create rooms"
  on rooms for insert
  with check (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
  );

create policy "Room host can update room"
  on rooms for update
  using (host_id = auth.uid());
