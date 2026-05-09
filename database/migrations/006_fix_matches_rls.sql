-- Add missing INSERT and UPDATE policies for the matches table.
-- Migration 004 only created a SELECT policy, which caused the
-- "row-level security policy" error when creating or finishing a match.

create policy "Authenticated users can insert matches"
  on matches for insert
  with check (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
  );

create policy "Authenticated users can update own tenant matches"
  on matches for update
  using (
    tenant_id = (
      select tenant_id from users where id = auth.uid()
    )
  );
