-- JDH Woodworks — Hardening migration DRAFT v2
-- ⚠️ GATED. Do not run until rls-storage-audit.sql results are reviewed.
-- Every section assumes facts that Q1–Q8 must confirm (noted inline).
-- Run sections individually, in order, after review.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — PORTFOLIO: stop exposing base tables to anon
-- Assumes (Q3): anon currently has SELECT on projects/photos, OR portfolio is
-- currently broken. Either way this is the target state.
-- Portfolio.jsx changes .from('photos') → .from('portfolio_photos') and
-- .from('projects') → .from('portfolio_projects'). Nothing else in the app changes.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.portfolio_photos
  WITH (security_invoker = false) AS           -- definer: bypasses RLS on base table
  SELECT id, project_id, storage_path, caption, tags, photo_type, created_at
  FROM public.photos
  WHERE tags ILIKE '%portfolio%';               -- the ONLY rows the public may see

CREATE OR REPLACE VIEW public.portfolio_projects
  WITH (security_invoker = false) AS
  SELECT p.id, p.name, p.category, p.wood_type, p.year_completed, p.finish_used, p.status
  FROM public.projects p
  WHERE EXISTS (SELECT 1 FROM public.photos ph
                WHERE ph.project_id = p.id AND ph.tags ILIKE '%portfolio%');
  -- Deliberately excludes: notes, cost/time entries, wood sources, user_id.

REVOKE ALL ON public.projects, public.photos FROM anon;   -- base tables closed
GRANT SELECT ON public.portfolio_photos, public.portfolio_projects TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — RLS on every owner table
-- Assumes (Q2): each table below has a user_id column. Remove any that don't
-- and decide separately. Idempotent: drops then recreates.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'projects','steps','coats','maintenance','shopping','photos','wood_stock',
    'brainstorming','finish_products','resources','shop_improvements','categories',
    'wood_locations','project_wood_sources','species','finishes','tools',
    'notes','trash','moisture_log']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_delete_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t||'_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', t||'_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t||'_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t||'_delete_own', t);
  END LOOP;
END $$;
-- Note: project_wood_sources / moisture_log / trash — Q2 must confirm user_id exists.
-- If a child table lacks user_id, use:
--   USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.user_id = auth.uid()))

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — STORAGE: bucket 'woodshop-photos'
-- Public READ stays (portfolio + unguessable UID paths — accepted, documented).
-- Close WRITE/DELETE to object owner. Uses storage.objects.owner (set
-- automatically on authenticated upload) so legacy project-scoped paths are
-- covered without a file migration. Q7 'objects_null_owner' must be 0 —
-- any null-owner objects were uploaded via service key and need
-- UPDATE storage.objects SET owner = '<owner uuid>' before delete works.
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "wp_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "wp_insert_own"   ON storage.objects;
DROP POLICY IF EXISTS "wp_update_own"   ON storage.objects;
DROP POLICY IF EXISTS "wp_delete_own"   ON storage.objects;
CREATE POLICY "wp_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'woodshop-photos');
CREATE POLICY "wp_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'woodshop-photos' AND owner = auth.uid());
CREATE POLICY "wp_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'woodshop-photos' AND owner = auth.uid());
CREATE POLICY "wp_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'woodshop-photos' AND owner = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — INDEXES (justified by actual app query patterns, see HANDOFF)
-- Skip any that Q6 shows already exist.
-- ═══════════════════════════════════════════════════════════════════════════
-- RLS predicate user_id = auth.uid() runs on EVERY startup query:
CREATE INDEX IF NOT EXISTS idx_projects_user    ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_steps_user       ON steps(user_id);
CREATE INDEX IF NOT EXISTS idx_coats_user       ON coats(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_user      ON photos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_user    ON shopping(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_user ON maintenance(user_id);
CREATE INDEX IF NOT EXISTS idx_wood_stock_user  ON wood_stock(user_id);
CREATE INDEX IF NOT EXISTS idx_trash_user       ON trash(user_id);
-- notes: upsert ON CONFLICT (user_id,key) requires a UNIQUE index — verify in Q6:
CREATE UNIQUE INDEX IF NOT EXISTS uq_notes_user_key ON notes(user_id, key);
-- Child lookups + project delete cascade:
CREATE INDEX IF NOT EXISTS idx_steps_project    ON steps(project_id);
CREATE INDEX IF NOT EXISTS idx_coats_project    ON coats(project_id);
CREATE INDEX IF NOT EXISTS idx_photos_project   ON photos(project_id);
CREATE INDEX IF NOT EXISTS idx_shopping_project ON shopping(project_id);
CREATE INDEX IF NOT EXISTS idx_pws_project      ON project_wood_sources(project_id);
CREATE INDEX IF NOT EXISTS idx_moisture_stock   ON moisture_log(stock_id);
-- Portfolio view predicate:
CREATE INDEX IF NOT EXISTS idx_photos_tags_trgm ON photos USING gin (tags gin_trgm_ops);
--   ^ requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;  (skip if ILIKE on ~250 rows is fine — it is, today)
-- OMITTED on evidence: photos(phash) — duplicate scan is client-side, no SQL predicate.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5 — FK CASCADES (only if Q5 shows NO ACTION on child tables)
-- deleteProject() deletes only the projects row; without cascades, children orphan.
-- ═══════════════════════════════════════════════════════════════════════════
-- ALTER TABLE steps    DROP CONSTRAINT IF EXISTS steps_project_id_fkey,    ADD CONSTRAINT steps_project_id_fkey    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
-- ALTER TABLE coats    DROP CONSTRAINT IF EXISTS coats_project_id_fkey,    ADD CONSTRAINT coats_project_id_fkey    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
-- ALTER TABLE shopping DROP CONSTRAINT IF EXISTS shopping_project_id_fkey, ADD CONSTRAINT shopping_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
-- photos: DO NOT cascade — storage files would orphan. App trash flow handles photos explicitly.
