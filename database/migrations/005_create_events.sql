create table events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid references users(id),
  event_type text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table events enable row level security;

create policy "Events are viewable by admins in same tenant"
  on events for select
  using (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
    and
    (
      select role from users where id = auth.uid()
    ) = 'admin'
  );

create policy "Authenticated users can insert events"
  on events for insert
  with check (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
  );
