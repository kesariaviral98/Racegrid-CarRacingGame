create table users (
  id uuid primary key references auth.users(id),
  tenant_id uuid not null references tenants(id),
  username text not null,
  role text not null default 'player' check (role in ('player', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table users enable row level security;

create policy "Users can view users in same tenant"
  on users for select
  using (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
  );

create policy "Users can update their own record"
  on users for update
  using (id = auth.uid());
