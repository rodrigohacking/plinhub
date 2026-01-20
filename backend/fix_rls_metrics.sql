-- Enable RLS for Metric but allow Authenticated/Anon to SELECT
-- Since the frontend uses Supabase Client (Anon/Auth) to read Metrics (via /api it uses Service Role, but if using direct select...)
-- Actually, the DASHBOARD uses the API (/api/metrics/:id).
-- The API uses Service Role in backend, so it bypasses RLS.
-- SO RLS ON TABLE SHOULD NOT MATTER FOR API.
-- BUT: if the frontend is doing direct fetching somewhere (layout, sidebar?), that might explain.

-- However, the user says "Dados não carregaram".
-- If using API, check backend/routes/metrics.js.
-- It returns `res.json(metrics || [])`.
-- If metrics exist in DB but API returns empty, then the query params might be wrong.

-- Let's query what the API would see for Apolar.

-- Also, fix RLS just in case.
CREATE POLICY "Enable read access for all users" ON "Metric" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "Integration" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON "SyncLog" FOR SELECT USING (true);
