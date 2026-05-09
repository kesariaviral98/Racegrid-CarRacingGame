create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

alter table tenants enable row level security;

create policy "Tenants are viewable by authenticated users in same tenant"
  on tenants for select
  using (auth.uid() is not null);
