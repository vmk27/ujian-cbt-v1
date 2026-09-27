-- ============================================================================
-- NUSANTARA CBT - SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Mencakup:
--   1. public.classes        (Menu Data Kelas / Rombongan Belajar)
--   2. public.users          (Menu Data Siswa & Profil Proktor - TANPA PASSWORD)
--   3. public.exams          (Menu Paket & Jadwal Ujian CBT)
--   4. public.questions      (Menu Bank Soal & Kunci Jawaban)
--   5. public.exam_sessions  (Menu Data Nilai, Lembar Jawaban & Sesi Ujian)
--   6. public.v_rekap_nilai  (View Rekapitulasi Leger Nilai Siswa)
-- ============================================================================

-- Fungsi otomatis untuk memperbarui kolom updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fungsi RPC untuk pembuatan & pembaruan tabel otomatis dari aplikasi
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- ============================================================================
-- 0. TABEL PENGATURAN APLIKASI & SEKOLAH (public.app_settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  app_name TEXT NOT NULL DEFAULT 'NusantaraCBT',
  app_subtitle TEXT NOT NULL DEFAULT 'Sistem Evaluasi & Ujian Berbasis Komputer Terpadu',
  school_name TEXT NOT NULL DEFAULT 'SMA Negeri 1 Nusantara Jakarta',
  npsn TEXT NOT NULL DEFAULT '20100192',
  school_address TEXT NOT NULL DEFAULT 'Jl. Pendidikan Nasional No. 45, Jakarta Pusat',
  academic_year TEXT NOT NULL DEFAULT '2026/2027',
  semester TEXT NOT NULL DEFAULT 'Ganjil',
  principal_name TEXT NOT NULL DEFAULT 'Dr. H. Ahmad Sulaiman, M.Pd.',
  principal_nip TEXT NOT NULL DEFAULT '19720815 199802 1 002',
  exam_card_title TEXT NOT NULL DEFAULT 'KARTU PESERTA UJIAN SATUAN PENDIDIKAN (CBT)',
  student_no_prefix TEXT NOT NULL DEFAULT '26-01-0104-',
  default_kkm NUMERIC(5,2) NOT NULL DEFAULT 75,
  city_signature TEXT NOT NULL DEFAULT 'Jakarta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 1. TABEL DATA KELAS (public.classes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.classes (
  id TEXT PRIMARY KEY,
  kode_kelas TEXT NOT NULL UNIQUE,
  nama_kelas TEXT NOT NULL UNIQUE,
  tingkat TEXT NOT NULL CHECK (tingkat IN ('X', 'XI', 'XII')),
  jurusan TEXT NOT NULL CHECK (jurusan IN ('MIPA', 'IPS', 'Bahasa', 'Umum')),
  wali_kelas TEXT NOT NULL,
  ruang_ujian TEXT NOT NULL,
  kapasitas INTEGER NOT NULL DEFAULT 36,
  tahun_ajaran TEXT NOT NULL DEFAULT '2026/2027',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_tingkat_jurusan ON public.classes (tingkat, jurusan);
CREATE INDEX IF NOT EXISTS idx_classes_nama_kelas ON public.classes (nama_kelas);

DROP TRIGGER IF EXISTS trg_classes_updated_at ON public.classes;
CREATE TRIGGER trg_classes_updated_at
BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. TABEL MANAJEMEN USER APARATUR (public.users - Admin, Guru, Proktor + Password)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT 'CBT-2026*',
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'proktor', 'siswa')) DEFAULT 'guru',
  kelas TEXT NOT NULL,
  nomor_peserta TEXT NOT NULL UNIQUE,
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
  sekolah TEXT NOT NULL DEFAULT 'SMA Negeri 1 Nusantara Jakarta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT 'CBT-2026*';
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'guru', 'proktor', 'siswa'));

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_kelas ON public.users (kelas);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2B. TABEL DATA SISWA (public.students - Struktur mirip public.users + kolom password)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT 'CBT-2026*',
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role = 'siswa') DEFAULT 'siswa',
  kelas TEXT NOT NULL,
  nomor_peserta TEXT NOT NULL UNIQUE,
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
  sekolah TEXT NOT NULL DEFAULT 'SMA Negeri 1 Nusantara Jakarta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT 'CBT-2026*';

CREATE INDEX IF NOT EXISTS idx_students_kelas ON public.students (kelas);
CREATE INDEX IF NOT EXISTS idx_students_username ON public.students (username);

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. TABEL PAKET & JADWAL UJIAN (public.exams)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  kelas_target TEXT NOT NULL,
  exam_date TEXT,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  token TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'draft', 'closed')) DEFAULT 'active',
  passing_score NUMERIC(5,2) NOT NULL DEFAULT 75,
  show_explanation_after_submit BOOLEAN NOT NULL DEFAULT TRUE,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_date TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS end_time TEXT;

CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams (status);
CREATE INDEX IF NOT EXISTS idx_exams_kelas_target ON public.exams (kelas_target);

DROP TRIGGER IF EXISTS trg_exams_updated_at ON public.exams;
CREATE TRIGGER trg_exams_updated_at
BEFORE UPDATE ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. TABEL BANK SOAL & KUNCI JAWABAN (public.questions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('pilihan_ganda', 'esai')) DEFAULT 'pilihan_ganda',
  topic TEXT NOT NULL,
  stimulus TEXT,
  question_text TEXT NOT NULL,
  image_url TEXT,
  storage_path TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D', 'E')) DEFAULT 'A',
  essay_answer_key TEXT,
  points NUMERIC(6,2) NOT NULL DEFAULT 10,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'pilihan_ganda';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS essay_answer_key TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_questions_exam_id_number ON public.questions (exam_id, number);

DROP TRIGGER IF EXISTS trg_questions_updated_at ON public.questions;
CREATE TRIGGER trg_questions_updated_at
BEFORE UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. TABEL DATA NILAI & SESI UJIAN SISWA (public.exam_sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_username TEXT NOT NULL,
  student_kelas TEXT NOT NULL,
  student_nomor_peserta TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'timed_out')) DEFAULT 'in_progress',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  doubt_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  remaining_seconds INTEGER NOT NULL DEFAULT 0,
  tab_switch_count INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  earned_points NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_points NUMERIC(6,2) NOT NULL DEFAULT 100,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_id ON public.exam_sessions (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_id ON public.exam_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_kelas ON public.exam_sessions (student_kelas);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON public.exam_sessions (status);

DROP TRIGGER IF EXISTS trg_exam_sessions_updated_at ON public.exam_sessions;
CREATE TRIGGER trg_exam_sessions_updated_at
BEFORE UPDATE ON public.exam_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 6. VIEW REKAPITULASI LEGER NILAI (public.v_rekap_nilai)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_rekap_nilai AS
SELECT
  s.id AS session_id,
  s.exam_id,
  e.code AS kode_ujian,
  e.title AS judul_ujian,
  e.subject AS mata_pelajaran,
  e.passing_score AS kkm,
  s.student_id,
  s.student_nomor_peserta AS nomor_peserta,
  s.student_username AS nisn,
  s.student_name AS nama_siswa,
  s.student_kelas AS nama_kelas,
  c.tingkat,
  c.jurusan,
  c.wali_kelas,
  s.status AS status_sesi,
  s.score AS nilai_akhir,
  CASE
    WHEN s.score >= e.passing_score THEN 'LULUS KKM'
    ELSE 'REMEDIAL'
  END AS predikat_kelulusan,
  s.correct_count AS jumlah_benar,
  s.wrong_count AS jumlah_salah,
  s.unanswered_count AS jumlah_kosong,
  s.total_questions AS total_soal,
  s.tab_switch_count AS pelanggaran_tab,
  s.started_at AS waktu_mulai,
  s.submitted_at AS waktu_selesai
FROM public.exam_sessions s
LEFT JOIN public.exams e ON s.exam_id = e.id
LEFT JOIN public.classes c ON s.student_kelas = c.nama_kelas;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) & POLICIES UNTUK AKSES CLIENT
-- ============================================================================
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access on classes" ON public.classes;
CREATE POLICY "Allow public full access on classes"
  ON public.classes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on users" ON public.users;
CREATE POLICY "Allow public full access on users"
  ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on exams" ON public.exams;
CREATE POLICY "Allow public full access on exams"
  ON public.exams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on questions" ON public.questions;
CREATE POLICY "Allow public full access on questions"
  ON public.questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on exam_sessions" ON public.exam_sessions;
CREATE POLICY "Allow public full access on exam_sessions"
  ON public.exam_sessions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. SUPABASE STORAGE BUCKET ('app-files' / 'app-file') & ROW LEVEL SECURITY POLICIES
-- Struktur otomatis folder Bank Soal:
--   <auth.uid()>/<kode_paket_ujian>/<bank_soal>/<nama_file_foto>
--   atau <kode_paket_ujian>/<bank_soal>/<nama_file_foto>
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('app-files', 'app-files', true),
  ('app-file', 'app-file', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
create policy "Users can view own files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'app-files'
  and name like (auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
create policy "Users can upload to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'app-files'
  and name like (auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
create policy "Users can update own files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'app-files'
  and name like (auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
create policy "Users can delete own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'app-files'
  and name like (auth.uid()::text || '/%')
);
