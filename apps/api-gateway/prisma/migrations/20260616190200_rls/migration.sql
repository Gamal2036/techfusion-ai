-- Helper function to safely get current org_id from session setting
CREATE OR REPLACE FUNCTION current_org_id() RETURNS TEXT LANGUAGE SQL STABLE AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '');
$$;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;

-- Organization policy: members can see their own org
DROP POLICY IF EXISTS org_isolation ON "Organization";
CREATE POLICY org_isolation ON "Organization"
  FOR ALL
  USING (id = current_org_id());

-- User policy: only users in the same org
DROP POLICY IF EXISTS user_isolation ON "User";
CREATE POLICY user_isolation ON "User"
  FOR ALL
  USING ("orgId" = current_org_id());

-- RefreshToken policy: only tokens for users in the same org
DROP POLICY IF EXISTS refresh_token_isolation ON "RefreshToken";
CREATE POLICY refresh_token_isolation ON "RefreshToken"
  FOR ALL
  USING ("orgId" = current_org_id());
