-- ============================================================================
-- MIGRATION: 20260927000000_auto_sync_schema.sql
-- Hardened Supabase Security & Schema Synchronization
-- - Drops password/password_hash from public.users (authentication via Supabase Auth)
-- - Uses public.user_roles + JWT app_metadata for admin verification (never public.users.role)
-- - Avoids GRANT ALL ON ALL TABLES; enables RLS on all public tables & applies specific grants
-- - Applies domain-specific RLS policies per table
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'siswa' CHECK (role IN ('admin', 'siswa')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', FALSE)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    );
$$;

ALTER TABLE IF EXISTS public.users DROP COLUMN IF EXISTS password;
ALTER TABLE IF EXISTS public.users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE IF EXISTS public.users ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.users ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE IF EXISTS public.classes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.exams ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.questions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.exam_sessions ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  tbl RECORD;
  pol RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl.tablename);
  END LOOP;

  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_roles', 'users', 'classes', 'exams', 'questions', 'exam_sessions')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

GRANT SELECT ON TABLE
  public.user_roles,
  public.users,
  public.classes,
  public.exams,
  public.questions,
  public.exam_sessions
TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.user_roles,
  public.users,
  public.classes,
  public.exams,
  public.questions,
  public.exam_sessions
TO authenticated;

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "users_select_own_or_admin" ON public.users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "users_insert_own_or_admin" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid() AND role = 'siswa') OR public.is_admin());

CREATE POLICY "users_update_own_or_admin" ON public.users
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK ((user_id = auth.uid() AND role = 'siswa') OR public.is_admin());

CREATE POLICY "users_delete_admin_only" ON public.users
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "classes_select_authenticated" ON public.classes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "classes_write_admin_only" ON public.classes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "exams_select_member_or_admin" ON public.exams
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      status = 'active'
      AND (
        kelas_target ILIKE 'Semua%'
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.user_id = auth.uid()
            AND (u.kelas = exams.kelas_target OR exams.kelas_target ILIKE '%' || u.kelas || '%')
        )
      )
    )
  );

CREATE POLICY "exams_write_admin_only" ON public.exams
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "questions_select_active_exam_or_admin" ON public.questions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = questions.exam_id
        AND e.status = 'active'
    )
  );

CREATE POLICY "questions_write_admin_only" ON public.questions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "exam_sessions_select_own_or_admin" ON public.exam_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = exam_sessions.student_id AND u.user_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "exam_sessions_insert_own_or_admin" ON public.exam_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = exam_sessions.student_id AND u.user_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "exam_sessions_update_own_or_admin" ON public.exam_sessions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = exam_sessions.student_id AND u.user_id = auth.uid()
    )
    OR public.is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = exam_sessions.student_id AND u.user_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "exam_sessions_delete_admin_only" ON public.exam_sessions
  FOR DELETE TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
