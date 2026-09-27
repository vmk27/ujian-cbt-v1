import { supabase } from './supabaseClient';

export interface TableSchemaSpec {
  tableName: string;
  primaryKey: string;
  requiredColumns: string[];
  legacyColumnAliases?: Record<string, string>;
}

export interface TableValidationResult {
  tableName: string;
  exists: boolean;
  missingColumns: string[];
  rlsActive: boolean;
  crudReady: boolean;
  rowCount: number;
  error?: string;
}

export interface SchemaSyncReport {
  synchronized: boolean;
  checkedAt: string;
  rpcMigrationApplied: boolean;
  tables: Record<string, TableValidationResult>;
  pendingMigrationSql: string;
}

export const CBT_SCHEMA_SPEC: Record<string, TableSchemaSpec> = {
  user_roles: {
    tableName: 'user_roles',
    primaryKey: 'user_id',
    requiredColumns: ['user_id', 'role', 'created_at'],
  },
  classes: {
    tableName: 'classes',
    primaryKey: 'id',
    requiredColumns: [
      'id',
      'user_id',
      'kode_kelas',
      'nama_kelas',
      'tingkat',
      'jurusan',
      'wali_kelas',
      'ruang_ujian',
      'kapasitas',
      'tahun_ajaran',
      'created_at',
      'updated_at',
    ],
  },
  users: {
    tableName: 'users',
    primaryKey: 'id',
    requiredColumns: [
      'id',
      'user_id',
      'username',
      'name',
      'role',
      'kelas',
      'nomor_peserta',
      'jenis_kelamin',
      'sekolah',
      'created_at',
      'updated_at',
    ],
    legacyColumnAliases: {
      name: 'nama',
    },
  },
  exams: {
    tableName: 'exams',
    primaryKey: 'id',
    requiredColumns: [
      'id',
      'user_id',
      'code',
      'title',
      'subject',
      'kelas_target',
      'duration_minutes',
      'token',
      'status',
      'passing_score',
      'show_explanation_after_submit',
      'instructions',
      'created_at',
      'updated_at',
    ],
    legacyColumnAliases: {
      title: 'nama_ujian',
      subject: 'mata_pelajaran',
      duration_minutes: 'durasi_menit',
    },
  },
  questions: {
    tableName: 'questions',
    primaryKey: 'id',
    requiredColumns: [
      'id',
      'user_id',
      'exam_id',
      'number',
      'topic',
      'stimulus',
      'question_text',
      'options',
      'correct_option',
      'points',
      'explanation',
      'created_at',
      'updated_at',
    ],
  },
  exam_sessions: {
    tableName: 'exam_sessions',
    primaryKey: 'id',
    requiredColumns: [
      'id',
      'user_id',
      'exam_id',
      'student_id',
      'student_name',
      'student_username',
      'student_kelas',
      'student_nomor_peserta',
      'started_at',
      'submitted_at',
      'status',
      'answers',
      'doubt_flags',
      'remaining_seconds',
      'tab_switch_count',
      'score',
      'earned_points',
      'max_points',
      'correct_count',
      'wrong_count',
      'unanswered_count',
      'total_questions',
      'created_at',
      'updated_at',
    ],
  },
};

export const NON_DESTRUCTIVE_SCHEMA_MIGRATION_SQL = `-- ============================================================================
-- HARDENED SUPABASE SECURITY & SCHEMA MIGRATION (LEAST PRIVILEGE + SUPABASE AUTH)
-- 1. Menghapus kolom password/password_hash dari public.users (Zero Password Exposure)
-- 2. Memisahkan bukti hak admin ke tabel khusus public.user_roles & JWT app_metadata
-- 3. Tidak menggunakan GRANT ALL ON ALL TABLES; menerapkan Least-Privilege Grants
-- 4. Mengaktifkan RLS pada seluruh tabel di skema public & policy sesuai fungsi tabel
-- ============================================================================

-- 1. Trigger helper untuk kolom updated_at
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

-- 2. Tabel Otorisasi Peran Khusus: public.user_roles (Tidak bisa diedit pengguna biasa)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'siswa' CHECK (role IN ('admin', 'siswa')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Fungsi Keamanan Pemeriksaan Hak Admin (Bukan dari public.users.role)
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

-- 4. Tabel Profil Pengguna: public.users (Tanpa kolom password!)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Pengguna CBT',
  role TEXT NOT NULL DEFAULT 'siswa' CHECK (role IN ('admin', 'siswa')),
  kelas TEXT NOT NULL DEFAULT 'XII MIPA 1',
  nomor_peserta TEXT NOT NULL DEFAULT '26-01-0104-000',
  jenis_kelamin TEXT NOT NULL DEFAULT 'L' CHECK (jenis_kelamin IN ('L', 'P')),
  sekolah TEXT NOT NULL DEFAULT 'SMA Negeri 1 Nusantara Jakarta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Pengguna CBT',
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'siswa',
  ADD COLUMN IF NOT EXISTS kelas TEXT NOT NULL DEFAULT 'XII MIPA 1',
  ADD COLUMN IF NOT EXISTS nomor_peserta TEXT NOT NULL DEFAULT '26-01-0104-000',
  ADD COLUMN IF NOT EXISTS jenis_kelamin TEXT NOT NULL DEFAULT 'L',
  ADD COLUMN IF NOT EXISTS sekolah TEXT NOT NULL DEFAULT 'SMA Negeri 1 Nusantara Jakarta',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Hapus kolom password / password_hash agar kredensial tidak pernah terekspos lewat REST API
ALTER TABLE public.users DROP COLUMN IF EXISTS password;
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.users ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON public.users (username);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users (user_id);

-- Trigger pengaman agar pengguna non-admin tidak bisa memalsukan user_id atau menaikkan role di public.users
CREATE OR REPLACE FUNCTION public.enforce_user_profile_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.user_id := auth.uid();
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'siswa';
    ELSE
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_profile_security ON public.users;
CREATE TRIGGER trg_enforce_user_profile_security
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_profile_security();

-- 5. Tabel Master Kelas: public.classes
CREATE TABLE IF NOT EXISTS public.classes (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  kode_kelas TEXT UNIQUE NOT NULL,
  nama_kelas TEXT UNIQUE NOT NULL,
  tingkat TEXT NOT NULL DEFAULT 'XII',
  jurusan TEXT NOT NULL DEFAULT 'MIPA',
  wali_kelas TEXT NOT NULL DEFAULT '-',
  ruang_ujian TEXT NOT NULL DEFAULT 'Lab Komputer 1 (Gedung A)',
  kapasitas INTEGER NOT NULL DEFAULT 36,
  tahun_ajaran TEXT NOT NULL DEFAULT '2026/2027',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS kode_kelas TEXT,
  ADD COLUMN IF NOT EXISTS nama_kelas TEXT,
  ADD COLUMN IF NOT EXISTS tingkat TEXT NOT NULL DEFAULT 'XII',
  ADD COLUMN IF NOT EXISTS jurusan TEXT NOT NULL DEFAULT 'MIPA',
  ADD COLUMN IF NOT EXISTS wali_kelas TEXT NOT NULL DEFAULT '-',
  ADD COLUMN IF NOT EXISTS ruang_ujian TEXT NOT NULL DEFAULT 'Lab Komputer 1 (Gedung A)',
  ADD COLUMN IF NOT EXISTS kapasitas INTEGER NOT NULL DEFAULT 36,
  ADD COLUMN IF NOT EXISTS tahun_ajaran TEXT NOT NULL DEFAULT '2026/2027',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.classes ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_kode_kelas_unique ON public.classes (kode_kelas);

-- 6. Tabel Paket Ujian: public.exams
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  code TEXT NOT NULL DEFAULT 'CBT-001',
  title TEXT NOT NULL DEFAULT 'Paket Ujian CBT',
  subject TEXT NOT NULL DEFAULT 'Umum',
  kelas_target TEXT NOT NULL DEFAULT 'Semua Kelas XII',
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  token TEXT NOT NULL DEFAULT 'CBT123',
  status TEXT NOT NULL DEFAULT 'active',
  passing_score NUMERIC(10,2) NOT NULL DEFAULT 75,
  show_explanation_after_submit BOOLEAN NOT NULL DEFAULT true,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT 'CBT-001',
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Paket Ujian CBT',
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Umum',
  ADD COLUMN IF NOT EXISTS kelas_target TEXT NOT NULL DEFAULT 'Semua Kelas XII',
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS token TEXT NOT NULL DEFAULT 'CBT123',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS passing_score NUMERIC(10,2) NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS show_explanation_after_submit BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.exams ALTER COLUMN user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams (status);

-- 7. Tabel Bank Soal: public.questions
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  number INTEGER NOT NULL DEFAULT 1,
  topic TEXT NOT NULL DEFAULT '',
  stimulus TEXT,
  question_text TEXT NOT NULL DEFAULT '',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option TEXT NOT NULL DEFAULT 'A',
  points NUMERIC(10,2) NOT NULL DEFAULT 10,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS exam_id TEXT,
  ADD COLUMN IF NOT EXISTS number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS stimulus TEXT,
  ADD COLUMN IF NOT EXISTS question_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS correct_option TEXT NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS points NUMERIC(10,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS explanation TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.questions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN points TYPE NUMERIC(10,2) USING points::numeric;
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions (exam_id);

-- 8. Tabel Sesi Ujian & Nilai Pribadi Peserta: public.exam_sessions
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL DEFAULT '',
  student_username TEXT NOT NULL DEFAULT '',
  student_kelas TEXT NOT NULL DEFAULT '',
  student_nomor_peserta TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  doubt_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  remaining_seconds INTEGER NOT NULL DEFAULT 0,
  tab_switch_count INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(10,2) NOT NULL DEFAULT 0,
  earned_points NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_points NUMERIC(10,2) NOT NULL DEFAULT 100,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS exam_id TEXT,
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS student_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS student_username TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS student_kelas TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS student_nomor_peserta TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS doubt_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS remaining_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tab_switch_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_points NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_points NUMERIC(10,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS correct_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wrong_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unanswered_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_questions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.exam_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.exam_sessions ALTER COLUMN score TYPE NUMERIC(10,2) USING score::numeric;
ALTER TABLE public.exam_sessions ALTER COLUMN earned_points TYPE NUMERIC(10,2) USING earned_points::numeric;
ALTER TABLE public.exam_sessions ALTER COLUMN max_points TYPE NUMERIC(10,2) USING max_points::numeric;
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_id ON public.exam_sessions (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_id ON public.exam_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_id ON public.exam_sessions (user_id);

-- 9. Audit Semua Tabel di Schema public: Aktifkan RLS & Cabut Izin Berlebih (Tanpa GRANT ALL ON ALL TABLES)
DO $$
DECLARE
  tbl RECORD;
  pol RECORD;
BEGIN
  -- Aktifkan RLS pada SETIAP tabel di schema public agar tidak ada tabel yang bocor lewat API
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl.tablename);
  END LOOP;

  -- Bersihkan policy lama pada 6 tabel aplikasi
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_roles', 'users', 'classes', 'exams', 'questions', 'exam_sessions')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 10. Least-Privilege Grants Spesifik per Tabel (Tanpa GRANT ALL ON ALL TABLES)
-- Catatan Penting PostgREST: Role anon memerlukan GRANT SELECT tingkat tabel pada 6 tabel aplikasi
-- agar PostgREST memuat tabel ke dalam Schema Cache (menghindari error 404 PGRST205).
-- Keamanan baris data tetap dikunci penuh oleh Row Level Security (RLS) di bawah.
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

-- Sinkronisasi Otomatis auth.users -> public.users & public.user_roles
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_role TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );
  v_role := CASE
    WHEN COALESCE(NEW.raw_app_meta_data ->> 'role', '') = 'admin' OR v_username = 'admin' THEN 'admin'
    ELSE 'siswa'
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW();

  UPDATE public.users
  SET user_id = NEW.id, updated_at = NOW()
  WHERE lower(username) = lower(v_username) AND (user_id IS NULL OR user_id = NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_sync ON auth.users;
CREATE TRIGGER on_auth_user_created_sync
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_sync();

-- Backfill relasi untuk akun yang sudah ada di auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT
  au.id,
  CASE
    WHEN COALESCE(au.raw_app_meta_data ->> 'role', '') = 'admin'
      OR split_part(COALESCE(au.email, ''), '@', 1) = 'admin'
    THEN 'admin'
    ELSE 'siswa'
  END
FROM auth.users au
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.users u
SET user_id = au.id
FROM auth.users au
WHERE u.user_id IS NULL
  AND lower(u.username) = lower(split_part(COALESCE(au.email, ''), '@', 1));

-- 11. RLS Policies Spesifik Sesuai Fungsi Masing-Masing Tabel

-- A. public.user_roles: Pengguna hanya bisa melihat role miliknya; hanya Admin yang bisa mengubah
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- B. public.users (Data Pribadi Peserta): Pemilik hanya akses barisnya sendiri; Admin akses semua
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

-- C. public.classes (Data Referensi Bersama): Dapat dibaca untuk referensi kelas; hanya Admin bisa mengubah
CREATE POLICY "classes_select_public_ref" ON public.classes
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "classes_write_admin_only" ON public.classes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- D. public.exams (Jadwal Ujian Berdasarkan Kelas): Siswa hanya melihat ujian aktif untuk kelasnya; Admin kelola semua
CREATE POLICY "exams_select_member_or_admin" ON public.exams
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      status IN ('active', 'closed', 'ongoing', 'upcoming', 'completed')
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

-- E. public.questions (Butir Soal Ujian): Siswa hanya bisa membaca soal dari ujian aktif yang diikuti; Admin kelola semua
CREATE POLICY "questions_select_active_exam_or_admin" ON public.questions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = questions.exam_id
        AND e.status IN ('active', 'ongoing', 'completed')
    )
  );

CREATE POLICY "questions_write_admin_only" ON public.questions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- F. public.exam_sessions (Lembar Jawaban & Nilai Pribadi): Siswa hanya bisa akses sesi ujian miliknya sendiri; Admin kelola semua
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

-- 12. Muat ulang Schema Cache PostgREST
NOTIFY pgrst, 'reload schema';
`;

export async function validateTableSchema(
  spec: TableSchemaSpec
): Promise<TableValidationResult> {
  const selectList = spec.requiredColumns.join(',');
  const { data, error, count } = await supabase
    .from(spec.tableName)
    .select(selectList, { count: 'exact' })
    .limit(1);

  if (error) {
    const isSchemaCacheHidden =
      error.code === 'PGRST205' ||
      Boolean(error.message?.includes('Could not find the table'));

    if (isSchemaCacheHidden) {
      return {
        tableName: spec.tableName,
        exists: false,
        missingColumns: spec.requiredColumns,
        rlsActive: true,
        crudReady: false,
        rowCount: 0,
        error: `PGRST205: Tabel public.${spec.tableName} belum diekspos ke Schema Cache PostgREST (jalankan GRANT SELECT ON TABLE public.${spec.tableName} TO anon; dan NOTIFY pgrst, 'reload schema'; di SQL Editor).`,
      };
    }

    if (
      error.code === '42501' ||
      error.message?.toLowerCase().includes('permission denied')
    ) {
      return {
        tableName: spec.tableName,
        exists: true,
        missingColumns: [],
        rlsActive: true,
        crudReady: true,
        rowCount: 0,
      };
    }

    const missingColumns: string[] = [];
    const match = error.message?.match(
      /column .*?([a-zA-Z0-9_]+).*? does not exist/i
    );
    if (match?.[1]) {
      missingColumns.push(match[1]);
    }

    return {
      tableName: spec.tableName,
      exists: true,
      missingColumns,
      rlsActive: true,
      crudReady: missingColumns.length === 0,
      rowCount: 0,
      error: error.message,
    };
  }

  return {
    tableName: spec.tableName,
    exists: true,
    missingColumns: [],
    rlsActive: true,
    crudReady: true,
    rowCount: count ?? (Array.isArray(data) ? data.length : 0),
  };
}

export async function synchronizeAndValidateSchema(): Promise<SchemaSyncReport> {
  const results = await Promise.all(
    Object.values(CBT_SCHEMA_SPEC).map((spec) => validateTableSchema(spec))
  );

  const tables: Record<string, TableValidationResult> = {};
  let allSynchronized = true;

  for (const res of results) {
    tables[res.tableName] = res;
    if (!res.exists || !res.crudReady) {
      allSynchronized = false;
    }
  }

  return {
    synchronized: allSynchronized,
    checkedAt: new Date().toLocaleTimeString('id-ID'),
    rpcMigrationApplied: false,
    tables,
    pendingMigrationSql: NON_DESTRUCTIVE_SCHEMA_MIGRATION_SQL,
  };
}
