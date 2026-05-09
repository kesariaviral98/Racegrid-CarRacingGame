-- Allow a newly authenticated user to insert their own profile row
CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- Relax tenants read policy so a brand-new auth user (no profile yet) can find the tenant to join
DROP POLICY IF EXISTS "Tenants are viewable by authenticated users in same tenant" ON tenants;
CREATE POLICY "Tenants are viewable by authenticated users"
  ON tenants FOR SELECT
  USING (auth.uid() IS NOT NULL);
