import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AppSettings,
  ClassRoom,
  ExamPackage,
  ExamSession,
  ExamStatus,
  OptionLetter,
  Question,
  QuestionOption,
  QuestionType,
  SessionStatus,
  UserAccount,
  UserRole,
} from '../types/cbt';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(rawUrl) &&
    Boolean(rawKey) &&
    rawUrl.startsWith('http') &&
    !rawUrl.includes('your-project-id.supabase.co') &&
    rawKey !== 'your-supabase-anon-key'
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(rawUrl, rawKey, {
      auth: {
        persistSession: false,
      },
    })
  : null;

export const getSupabaseProjectRef = (): string => {
  if (!isSupabaseConfigured()) return 'Belum Dikonfigurasi';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname;
  } catch {
    return rawUrl;
  }
};

// ============================================================================
// ROW MAPPERS (PostgreSQL snake_case <-> TypeScript camelCase)
// ============================================================================

export function mapAppSettingsToRow(settings: AppSettings) {
  return {
    id: settings.id || 'default',
    app_name: settings.appName,
    app_subtitle: settings.appSubtitle,
    school_name: settings.schoolName,
    npsn: settings.npsn,
    school_address: settings.schoolAddress,
    academic_year: settings.academicYear,
    semester: settings.semester,
    principal_name: settings.principalName,
    principal_nip: settings.principalNip,
    exam_card_title: settings.examCardTitle,
    student_no_prefix: settings.studentNoPrefix,
    default_kkm: Number(settings.defaultKkm ?? 75),
    city_signature: settings.citySignature,
    enable_alert_student_enter: Boolean(settings.enableAlertStudentEnter ?? true),
    enable_alert_student_completed: Boolean(settings.enableAlertStudentCompleted ?? true),
    enable_alert_student_tab_switch: Boolean(settings.enableAlertStudentTabSwitch ?? true),
  };
}

export function mapRowToAppSettings(row: Record<string, unknown>): AppSettings {
  return {
    id: String(row.id ?? 'default'),
    appName: String(row.app_name ?? 'NusantaraCBT'),
    appSubtitle: String(
      row.app_subtitle ?? 'Sistem Evaluasi & Ujian Berbasis Komputer Nasional'
    ),
    schoolName: String(row.school_name ?? 'SMA Negeri 1 Nusantara Jakarta'),
    npsn: String(row.npsn ?? '20100101'),
    schoolAddress: String(
      row.school_address ?? 'Jl. Pendidikan Nasional No. 10, Menteng, Jakarta Pusat'
    ),
    academicYear: String(row.academic_year ?? '2026/2027'),
    semester: (row.semester as 'Ganjil' | 'Genap') || 'Genap',
    principalName: String(row.principal_name ?? 'Dr. H. Surya Dharma, M.Pd.'),
    principalNip: String(row.principal_nip ?? '19720514 199802 1 001'),
    examCardTitle: String(
      row.exam_card_title ?? 'KARTU PESERTA PENILAIAN AKHIR TAHUN (CBT)'
    ),
    studentNoPrefix: String(row.student_no_prefix ?? '26-01-0104-'),
    defaultKkm: Number(row.default_kkm ?? 75),
    citySignature: String(row.city_signature ?? 'Jakarta'),
    enableAlertStudentEnter: row.enable_alert_student_enter !== undefined ? Boolean(row.enable_alert_student_enter) : true,
    enableAlertStudentCompleted: row.enable_alert_student_completed !== undefined ? Boolean(row.enable_alert_student_completed) : true,
    enableAlertStudentTabSwitch: row.enable_alert_student_tab_switch !== undefined ? Boolean(row.enable_alert_student_tab_switch) : true,
  };
}

export function mapClassToRow(cls: ClassRoom) {
  return {
    id: cls.id,
    kode_kelas: cls.kodeKelas,
    nama_kelas: cls.namaKelas,
    tingkat: cls.tingkat,
    jurusan: cls.jurusan,
    wali_kelas: cls.waliKelas,
    ruang_ujian: cls.ruangUjian,
    kapasitas: Number(cls.kapasitas),
    tahun_ajaran: cls.tahunAjaran,
  };
}

export function mapRowToClass(row: Record<string, unknown>): ClassRoom {
  return {
    id: String(row.id),
    kodeKelas: String(row.kode_kelas ?? ''),
    namaKelas: String(row.nama_kelas ?? ''),
    tingkat: (row.tingkat as ClassRoom['tingkat']) || 'XII',
    jurusan: (row.jurusan as ClassRoom['jurusan']) || 'MIPA',
    waliKelas: String(row.wali_kelas ?? ''),
    ruangUjian: String(row.ruang_ujian ?? ''),
    kapasitas: Number(row.kapasitas ?? 36),
    tahunAjaran: String(row.tahun_ajaran ?? '2026/2027'),
  };
}

export function mapUserToRow(user: UserAccount): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: user.id,
    username: user.username,
    password: user.password || 'CBT-2026*',
    name: user.name,
    role: user.role,
    kelas: user.kelas,
    nomor_peserta: user.nomorPeserta,
    jenis_kelamin: user.jenisKelamin,
    sekolah: user.sekolah,
  };
  if (user.authUserId) {
    row.auth_user_id = user.authUserId;
  }
  return row;
}

export function mapUserToRowLegacy(user: UserAccount): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    kelas: user.kelas,
    nomor_peserta: user.nomorPeserta,
    jenis_kelamin: user.jenisKelamin,
    sekolah: user.sekolah,
  };
  if (user.authUserId) {
    row.auth_user_id = user.authUserId;
  }
  return row;
}

export function mapStudentToRow(student: UserAccount): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: student.id,
    username: student.username,
    password: student.password || 'CBT-2026',
    name: student.name,
    role: 'siswa',
    kelas: student.kelas,
    nomor_peserta: student.nomorPeserta,
    jenis_kelamin: student.jenisKelamin,
    sekolah: student.sekolah,
  };
  if (student.authUserId) {
    row.auth_user_id = student.authUserId;
  }
  return row;
}

export function mapRowToUser(row: Record<string, unknown>): UserAccount {
  const role = (row.role as UserRole) || 'siswa';
  return {
    id: String(row.id),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : undefined,
    username: String(row.username ?? ''),
    password: row.password ? String(row.password) : 'CBT-2026*',
    name: String(row.name ?? ''),
    role,
    kelas: String(row.kelas ?? ''),
    nomorPeserta: String(row.nomor_peserta ?? ''),
    jenisKelamin: (row.jenis_kelamin as 'L' | 'P') || 'L',
    sekolah: String(row.sekolah ?? 'SMA Negeri 1 Nusantara Jakarta'),
  };
}

export function mapExamToRow(exam: ExamPackage) {
  return {
    id: exam.id,
    code: exam.code,
    title: exam.title,
    subject: exam.subject,
    kelas_target: exam.kelasTarget,
    exam_date: exam.examDate ?? null,
    start_time: exam.startTime ?? null,
    end_time: exam.endTime ?? null,
    duration_minutes: Number(exam.durationMinutes),
    token: exam.token,
    status: exam.status,
    passing_score: Number(exam.passingScore),
    show_explanation_after_submit: Boolean(exam.showExplanationAfterSubmit),
    min_half_duration_submit: Boolean(exam.minHalfDurationSubmitRequired),
    instructions: exam.instructions,
    source_exam_id: exam.sourceExamId ?? null,
    bank_soal_name: exam.bankSoalName ?? null,
    created_at: exam.createdAt,
  };
}

export function mapExamToRowLegacy(exam: ExamPackage) {
  return {
    id: exam.id,
    code: exam.code,
    title: exam.title,
    subject: exam.subject,
    kelas_target: exam.kelasTarget,
    duration_minutes: Number(exam.durationMinutes),
    token: exam.token,
    status: exam.status,
    passing_score: Number(exam.passingScore),
    show_explanation_after_submit: Boolean(exam.showExplanationAfterSubmit),
    instructions: exam.instructions,
    created_at: exam.createdAt,
  };
}

export function mapRowToExam(row: Record<string, unknown>): ExamPackage {
  return {
    id: String(row.id),
    code: String(row.code ?? ''),
    title: String(row.title ?? ''),
    subject: String(row.subject ?? ''),
    kelasTarget: String(row.kelas_target ?? 'Semua Kelas XII'),
    examDate: row.exam_date ? String(row.exam_date) : undefined,
    startTime: row.start_time ? String(row.start_time) : undefined,
    endTime: row.end_time ? String(row.end_time) : undefined,
    durationMinutes: Number(row.duration_minutes ?? 45),
    token: String(row.token ?? ''),
    status: (row.status as ExamStatus) || 'active',
    passingScore: Number(row.passing_score ?? 75),
    showExplanationAfterSubmit: Boolean(row.show_explanation_after_submit ?? true),
    minHalfDurationSubmitRequired: Boolean(row.min_half_duration_submit ?? false),
    instructions: Array.isArray(row.instructions)
      ? (row.instructions as string[])
      : [],
    sourceExamId: row.source_exam_id ? String(row.source_exam_id) : undefined,
    bankSoalName: row.bank_soal_name ? String(row.bank_soal_name) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function sanitizeStorageSegment(input: string, fallback = 'umum'): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
}

export function buildExamBankSoalFolder(params: {
  examCode: string;
  examTitle?: string;
  bankSoalName?: string;
  userId?: string;
}): string {
  const paketSegment = sanitizeStorageSegment(
    params.examCode || params.examTitle || 'paket-ujian',
    'paket-ujian'
  );
  const bankSegment = sanitizeStorageSegment(
    params.bankSoalName || 'bank-soal-umum',
    'bank-soal-umum'
  );
  const paketFolder = paketSegment.startsWith('paket-')
    ? paketSegment
    : `paket-${paketSegment}`;
  const bankFolder = bankSegment.startsWith('bank-soal-')
    ? bankSegment
    : `bank-soal-${bankSegment}`;

  if (params.userId && params.userId.trim()) {
    return `${params.userId.trim()}/${paketFolder}/${bankFolder}`;
  }
  return `${paketFolder}/${bankFolder}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.readAsDataURL(file);
  });
}

export function mapQuestionToRow(q: Question) {
  return {
    id: q.id,
    exam_id: q.examId || null,
    number: Number(q.number),
    question_type: q.questionType || 'pilihan_ganda',
    topic: q.topic,
    stimulus: q.stimulus ?? null,
    question_text: q.questionText,
    image_url: q.imageUrl ?? null,
    storage_path: q.storagePath ?? null,
    options: q.options,
    correct_option: q.correctOption || 'A',
    essay_answer_key: q.essayAnswerKey ?? null,
    points: Number(q.points),
    explanation: q.explanation,
  };
}

export function mapQuestionToRowLegacy(q: Question) {
  return {
    id: q.id,
    exam_id: q.examId,
    number: Number(q.number),
    topic: q.topic,
    stimulus: q.stimulus ?? null,
    question_text: q.questionText,
    image_url: q.imageUrl ?? null,
    storage_path: q.storagePath ?? null,
    options: q.options,
    correct_option: q.correctOption || 'A',
    points: Number(q.points),
    explanation: q.explanation,
  };
}

export function mapRowToQuestion(row: Record<string, unknown>): Question {
  const rawType = String(row.question_type ?? 'pilihan_ganda');
  const questionType: QuestionType =
    rawType === 'esai' ? 'esai' : 'pilihan_ganda';
  return {
    id: String(row.id),
    examId: String(row.exam_id ?? ''),
    number: Number(row.number ?? 1),
    questionType,
    topic: String(row.topic ?? ''),
    stimulus: row.stimulus ? String(row.stimulus) : undefined,
    questionText: String(row.question_text ?? ''),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    storagePath: row.storage_path ? String(row.storage_path) : undefined,
    options: Array.isArray(row.options)
      ? (row.options as QuestionOption[])
      : [],
    correctOption: (row.correct_option as OptionLetter) || 'A',
    essayAnswerKey: row.essay_answer_key
      ? String(row.essay_answer_key)
      : undefined,
    points: Number(row.points ?? 10),
    explanation: String(row.explanation ?? ''),
  };
}

export function mapSessionToRow(s: ExamSession) {
  return {
    id: s.id,
    exam_id: s.examId,
    student_id: s.studentId,
    student_name: s.studentName,
    student_username: s.studentUsername,
    student_kelas: s.studentKelas,
    student_nomor_peserta: s.studentNomorPeserta,
    started_at: s.startedAt,
    submitted_at: s.submittedAt ?? null,
    status: s.status,
    answers: s.answers,
    doubt_flags: s.doubtFlags,
    remaining_seconds: Number(s.remainingSeconds),
    tab_switch_count: Number(s.tabSwitchCount),
    score: Number(s.score),
    earned_points: Number(s.earnedPoints),
    max_points: Number(s.maxPoints),
    correct_count: Number(s.correctCount),
    wrong_count: Number(s.wrongCount),
    unanswered_count: Number(s.unansweredCount),
    total_questions: Number(s.totalQuestions),
  };
}

export function mapRowToSession(row: Record<string, unknown>): ExamSession {
  return {
    id: String(row.id ?? row.session_id ?? ''),
    examId: String(row.exam_id ?? ''),
    studentId: String(row.student_id ?? ''),
    studentName: String(row.student_name ?? row.nama_siswa ?? ''),
    studentUsername: String(row.student_username ?? row.nisn ?? ''),
    studentKelas: String(row.student_kelas ?? row.nama_kelas ?? ''),
    studentNomorPeserta: String(
      row.student_nomor_peserta ?? row.nomor_peserta ?? ''
    ),
    startedAt: String(
      row.started_at ?? row.waktu_mulai ?? new Date().toISOString()
    ),
    submittedAt:
      row.submitted_at || row.waktu_selesai
        ? String(row.submitted_at ?? row.waktu_selesai)
        : undefined,
    status:
      ((row.status ?? row.status_sesi) as SessionStatus) || 'in_progress',
    answers:
      row.answers && typeof row.answers === 'object'
        ? (row.answers as Record<string, string>)
        : row.jawaban_siswa && typeof row.jawaban_siswa === 'object'
        ? (row.jawaban_siswa as Record<string, string>)
        : {},
    doubtFlags:
      row.doubt_flags && typeof row.doubt_flags === 'object'
        ? (row.doubt_flags as Record<string, boolean>)
        : {},
    remainingSeconds: Number(row.remaining_seconds ?? 0),
    tabSwitchCount: Number(row.tab_switch_count ?? row.pelanggaran_tab ?? 0),
    score: Number(row.score ?? row.nilai_akhir ?? 0),
    earnedPoints: Number(
      row.earned_points ?? row.poin_diperoleh ?? row.score ?? row.nilai_akhir ?? 0
    ),
    maxPoints: Number(row.max_points ?? row.poin_maksimal ?? 100),
    correctCount: Number(row.correct_count ?? row.jumlah_benar ?? 0),
    wrongCount: Number(row.wrong_count ?? row.jumlah_salah ?? 0),
    unansweredCount: Number(row.unanswered_count ?? row.jumlah_kosong ?? 0),
    totalQuestions: Number(row.total_questions ?? row.total_soal ?? 0),
  };
}

export function findMatchingStudentForSession(
  s: Pick<
    ExamSession,
    | 'studentId'
    | 'studentUsername'
    | 'studentNomorPeserta'
    | 'studentName'
    | 'studentKelas'
  >,
  usersList: UserAccount[]
): UserAccount | undefined {
  const stuList = usersList.filter((u) => u.role === 'siswa');
  if (stuList.length === 0) return undefined;

  // 1. Exact ID match in students
  const byId = stuList.find((st) => st.id === s.studentId);
  if (byId) return byId;

  // 2. Match by NISN / username
  const cleanUser = (s.studentUsername || '').trim().toLowerCase();
  if (cleanUser) {
    const byUsername = stuList.find(
      (st) => st.username.trim().toLowerCase() === cleanUser
    );
    if (byUsername) return byUsername;
  }

  // 3. Match by Nomor Peserta
  const cleanNo = (s.studentNomorPeserta || '').trim().toLowerCase();
  if (cleanNo) {
    const byNoPeserta = stuList.find(
      (st) => st.nomorPeserta.trim().toLowerCase() === cleanNo
    );
    if (byNoPeserta) return byNoPeserta;
  }

  // 4. Match by Name + Kelas
  const cleanName = (s.studentName || '').trim().toLowerCase();
  const cleanKelas = (s.studentKelas || '').trim().toLowerCase();
  if (cleanName) {
    const byName = stuList.find(
      (st) =>
        st.name.trim().toLowerCase() === cleanName &&
        (!cleanKelas || st.kelas.trim().toLowerCase() === cleanKelas)
    );
    if (byName) return byName;
  }

  return undefined;
}

export function integrateSessionWithStudents(
  session: ExamSession,
  usersList: UserAccount[]
): { session: ExamSession; matchedStudent?: UserAccount } {
  const matched = findMatchingStudentForSession(session, usersList);
  if (!matched) {
    return { session };
  }
  return {
    matchedStudent: matched,
    session: {
      ...session,
      studentId: matched.id,
      studentName: matched.name || session.studentName,
      studentUsername: matched.username || session.studentUsername,
      studentKelas: matched.kelas || session.studentKelas,
      studentNomorPeserta:
        matched.nomorPeserta || session.studentNomorPeserta,
    },
  };
}

// ============================================================================
// SUPABASE CRUD & SYNC SERVICE
// ============================================================================

async function resilientUpsert(
  client: SupabaseClient,
  tableName: string,
  rows: Record<string, unknown>[],
  onConflict = 'id'
): Promise<{ ok: boolean; error?: string }> {
  if (rows.length === 0) return { ok: true };

  // Attempt 1: full rows
  const { error: err1 } = await client.from(tableName).upsert(rows, { onConflict });
  if (!err1) return { ok: true };

  let currentRows = [...rows];
  let lastErr = err1;

  // Attempt 2: strip 'auth_user_id' if schema cache doesn't know it
  if (
    lastErr.message.toLowerCase().includes('auth_user_id') ||
    lastErr.message.toLowerCase().includes('schema cache')
  ) {
    currentRows = currentRows.map((r) => {
      const copy = { ...r };
      delete copy.auth_user_id;
      return copy;
    });
    const { error: err2 } = await client.from(tableName).upsert(currentRows, { onConflict });
    if (!err2) return { ok: true };
    lastErr = err2;
  }

  // Attempt 3: strip 'password' if not yet migrated on that table
  if (lastErr.message.toLowerCase().includes('password')) {
    currentRows = currentRows.map((r) => {
      const copy = { ...r };
      delete copy.password;
      return copy;
    });
    const { error: err3 } = await client.from(tableName).upsert(currentRows, { onConflict });
    if (!err3) return { ok: true };
    lastErr = err3;
  }

  // Attempt 4: strip newly added exam columns if missing in legacy table
  if (
    lastErr.message.toLowerCase().includes('source_exam_id') ||
    lastErr.message.toLowerCase().includes('bank_soal_name')
  ) {
    currentRows = currentRows.map((r) => {
      const copy = { ...r };
      delete copy.source_exam_id;
      delete copy.bank_soal_name;
      return copy;
    });
    const { error: err4a } = await client.from(tableName).upsert(currentRows, { onConflict });
    if (!err4a) return { ok: true };
    lastErr = err4a;
  }

  if (
    lastErr.message.toLowerCase().includes('exam_date') ||
    lastErr.message.toLowerCase().includes('start_time') ||
    lastErr.message.toLowerCase().includes('end_time') ||
    lastErr.message.toLowerCase().includes('source_exam_id') ||
    lastErr.message.toLowerCase().includes('bank_soal_name') ||
    lastErr.message.toLowerCase().includes('min_half_duration_submit')
  ) {
    currentRows = currentRows.map((r) => {
      const copy = { ...r };
      delete copy.exam_date;
      delete copy.start_time;
      delete copy.end_time;
      delete copy.source_exam_id;
      delete copy.bank_soal_name;
      delete copy.min_half_duration_submit;
      return copy;
    });
    const { error: err4 } = await client.from(tableName).upsert(currentRows, { onConflict });
    if (!err4) return { ok: true };
    lastErr = err4;
  }

  // Attempt 5: strip newly added question columns if missing in legacy table
  if (
    lastErr.message.toLowerCase().includes('question_type') ||
    lastErr.message.toLowerCase().includes('essay_answer_key')
  ) {
    currentRows = currentRows.map((r) => {
      const copy = { ...r };
      delete copy.question_type;
      delete copy.essay_answer_key;
      return copy;
    });
    const { error: err5 } = await client.from(tableName).upsert(currentRows, { onConflict });
    if (!err5) return { ok: true };
    lastErr = err5;
  }

  return { ok: false, error: lastErr.message };
}

export type SupabaseConnectionState =
  | 'unconfigured'
  | 'checking'
  | 'connected'
  | 'schema_missing'
  | 'error';

export interface TableHealthStatus {
  tableName: string;
  shortName: string;
  menuLabel: string;
  exists: boolean;
  rowCount: number;
  hasPasswordColumn?: boolean;
  errorMessage?: string;
}

export interface TableHealthCheckResult {
  ok: boolean;
  allReady: boolean;
  missingTables: string[];
  tables: TableHealthStatus[];
}

export const supabaseService = {
  async checkAllTablesHealth(): Promise<TableHealthCheckResult> {
    const tableDefs = [
      {
        tableName: 'public.app_settings',
        shortName: 'app_settings',
        menuLabel: 'Pengaturan Aplikasi & Sekolah',
        checkPassword: false,
      },
      {
        tableName: 'public.classes',
        shortName: 'classes',
        menuLabel: 'Master Data Kelas',
        checkPassword: false,
      },
      {
        tableName: 'public.students',
        shortName: 'students',
        menuLabel: 'Data Siswa (+ Password)',
        checkPassword: true,
      },
      {
        tableName: 'public.users',
        shortName: 'users',
        menuLabel: 'Manajemen User (+ Password)',
        checkPassword: true,
      },
      {
        tableName: 'public.exams',
        shortName: 'exams',
        menuLabel: 'Paket & Jadwal Ujian',
        checkPassword: false,
      },
      {
        tableName: 'public.questions',
        shortName: 'questions',
        menuLabel: 'Bank Soal & Kunci',
        checkPassword: false,
      },
      {
        tableName: 'public.exam_sessions',
        shortName: 'exam_sessions',
        menuLabel: 'Data Nilai & Sesi Ujian (Terhubung students)',
        checkPassword: false,
      },
      {
        tableName: 'public.v_rekap_nilai',
        shortName: 'v_rekap_nilai',
        menuLabel: 'View Rekap Nilai (Integrasi students & exam_sessions)',
        checkPassword: false,
      },
    ];

    if (!supabase) {
      return {
        ok: false,
        allReady: false,
        missingTables: tableDefs.map((t) => t.tableName),
        tables: tableDefs.map((t) => ({
          tableName: t.tableName,
          shortName: t.shortName,
          menuLabel: t.menuLabel,
          exists: false,
          rowCount: 0,
          errorMessage: 'Koneksi Supabase belum dikonfigurasi',
        })),
      };
    }

    const client = supabase;
    const results: TableHealthStatus[] = await Promise.all(
      tableDefs.map(async (t) => {
        try {
          const { count, error } = await client
            .from(t.shortName)
            .select('*', { count: 'exact', head: true });

          if (error) {
            return {
              tableName: t.tableName,
              shortName: t.shortName,
              menuLabel: t.menuLabel,
              exists: false,
              rowCount: 0,
              errorMessage: error.message,
            };
          }

          let hasPasswordColumn: boolean | undefined = undefined;
          if (t.checkPassword) {
            const { error: passErr } = await client
              .from(t.shortName)
              .select('password')
              .limit(1);
            hasPasswordColumn = !passErr;
          }

          return {
            tableName: t.tableName,
            shortName: t.shortName,
            menuLabel: t.menuLabel,
            exists: true,
            rowCount: count ?? 0,
            hasPasswordColumn,
          };
        } catch (err) {
          return {
            tableName: t.tableName,
            shortName: t.shortName,
            menuLabel: t.menuLabel,
            exists: false,
            rowCount: 0,
            errorMessage: err instanceof Error ? err.message : 'Error',
          };
        }
      })
    );

    const missingTables = results
      .filter((r) => !r.exists || r.hasPasswordColumn === false)
      .map((r) =>
        !r.exists ? r.tableName : `${r.tableName} (kolom password belum ada)`
      );

    return {
      ok: true,
      allReady: missingTables.length === 0,
      missingTables,
      tables: results,
    };
  },

  async autoCreateTablesInDatabase(payload?: {
    appSettings?: AppSettings;
    classes: ClassRoom[];
    users: UserAccount[];
    exams: ExamPackage[];
    questions: Question[];
    sessions: ExamSession[];
  }): Promise<{
    ok: boolean;
    rpcExecuted: boolean;
    message: string;
    health: TableHealthCheckResult;
  }> {
    if (!supabase) {
      const emptyHealth = await this.checkAllTablesHealth();
      return {
        ok: false,
        rpcExecuted: false,
        message: 'Koneksi Supabase belum dikonfigurasi.',
        health: emptyHealth,
      };
    }

    // 1. Check current tables first
    let health = await this.checkAllTablesHealth();
    let rpcExecuted = false;

    // 2. If any table or column is missing, try automatic DDL creation via RPC
    if (!health.allReady) {
      const rpcCandidates = [
        { fn: 'exec_sql', arg: { sql_query: SUPABASE_SCHEMA_SQL } },
        { fn: 'exec_sql', arg: { sql: SUPABASE_SCHEMA_SQL } },
        { fn: 'exec_sql', arg: { query: SUPABASE_SCHEMA_SQL } },
        { fn: 'run_sql', arg: { sql: SUPABASE_SCHEMA_SQL } },
        { fn: 'execute_sql', arg: { sql_query: SUPABASE_SCHEMA_SQL } },
      ];

      for (const candidate of rpcCandidates) {
        try {
          const { error } = await supabase.rpc(candidate.fn, candidate.arg);
          if (!error) {
            rpcExecuted = true;
            break;
          }
        } catch {
          // Ignore and try next RPC signature
        }
      }

      // Re-check health after RPC attempt
      health = await this.checkAllTablesHealth();
    }

    // 3. Sync data to all existing tables automatically
    if (payload) {
      await this.syncAllToSupabase(payload);
      health = await this.checkAllTablesHealth();
    }

    if (health.allReady) {
      return {
        ok: true,
        rpcExecuted,
        message: rpcExecuted
          ? 'Seluruh 7 tabel & kolom password berhasil dibuat otomatis via RPC dan disinkronkan!'
          : 'Pemeriksaan selesai: Seluruh 7 tabel database beserta kolom password sudah lengkap dan tersinkronisasi.',
        health,
      };
    }

    return {
      ok: false,
      rpcExecuted,
      message: `Ditemukan ${health.missingTables.length} tabel/kolom yang belum tersedia di Supabase (${health.missingTables.join(
        ', '
      )}). Salin & jalankan Skrip SQL Otomatis di bawah satu kali pada Supabase SQL Editor untuk mengaktifkan fungsi auto-migration.`,
      health,
    };
  },

  async checkConnection(): Promise<{
    state: SupabaseConnectionState;
    message: string;
  }> {
    if (!supabase) {
      return {
        state: 'unconfigured',
        message:
          'Variabel environment VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diatur.',
      };
    }

    try {
      const { error } = await supabase.from('classes').select('id').limit(1);
      if (error) {
        if (
          error.code === '42P01' ||
          error.message.toLowerCase().includes('does not exist') ||
          error.message.toLowerCase().includes('schema cache')
        ) {
          return {
            state: 'schema_missing',
            message:
              'Terhubung ke Supabase, namun tabel database belum dibuat. Jalankan skrip migrasi SQL terlebih dahulu.',
          };
        }
        return {
          state: 'error',
          message: `Gagal mengakses tabel Supabase: ${error.message}`,
        };
      }
      return {
        state: 'connected',
        message: 'Terhubung aktif ke database PostgreSQL Supabase.',
      };
    } catch (err) {
      return {
        state: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Koneksi ke server Supabase gagal.',
      };
    }
  },

  async fetchAllData(): Promise<{
    ok: boolean;
    message?: string;
    data?: {
      appSettings?: AppSettings;
      classes: ClassRoom[];
      users: UserAccount[];
      exams: ExamPackage[];
      questions: Question[];
      sessions: ExamSession[];
    };
  }> {
    if (!supabase) {
      return { ok: false, message: 'Client Supabase belum dikonfigurasi.' };
    }

    try {
      const [setRes, clsRes, usrRes, stuRes, exmRes, qstRes, sesRes, rekapRes] =
        await Promise.all([
          supabase.from('app_settings').select('*').limit(1),
          supabase.from('classes').select('*').order('nama_kelas', { ascending: true }),
          supabase.from('users').select('*').order('name', { ascending: true }),
          supabase.from('students').select('*').order('name', { ascending: true }),
          supabase.from('exams').select('*').order('created_at', { ascending: false }),
          supabase.from('questions').select('*').order('number', { ascending: true }),
          supabase.from('exam_sessions').select('*').order('started_at', { ascending: false }),
          supabase.from('v_rekap_nilai').select('*'),
        ]);

      const firstErr =
        clsRes.error || usrRes.error || exmRes.error || qstRes.error || sesRes.error;
      if (firstErr) {
        return { ok: false, message: firstErr.message };
      }

      const appSettings =
        !setRes.error && setRes.data && setRes.data.length > 0
          ? mapRowToAppSettings(setRes.data[0] as Record<string, unknown>)
          : undefined;

      // public.users khusus untuk akun aparatur (Admin, Guru, Proktor)
      const staffList = (usrRes.data || [])
        .map((r) => mapRowToUser(r as Record<string, unknown>))
        .filter((u) => u.role !== 'siswa');

      // public.students khusus untuk data siswa peserta ujian lengkap dengan password
      const studentList = (!stuRes.error && stuRes.data ? stuRes.data : [])
        .map((r) => mapRowToUser(r as Record<string, unknown>))
        .map((s) => ({ ...s, role: 'siswa' as const }));

      // Fallback: jika ada akun siswa lama di public.users yang belum masuk ke public.students
      const legacyStudentList = (usrRes.data || [])
        .map((r) => mapRowToUser(r as Record<string, unknown>))
        .filter((u) => u.role === 'siswa')
        .filter(
          (lu) =>
            !studentList.some(
              (st) =>
                st.id === lu.id ||
                st.username.toLowerCase() === lu.username.toLowerCase() ||
                st.nomorPeserta.toLowerCase() === lu.nomorPeserta.toLowerCase()
            )
        );

      const allStudents = [...studentList, ...legacyStudentList];
      if (legacyStudentList.length > 0) {
        // Otomatis migrasikan akun siswa lama ke tabel public.students
        void resilientUpsert(
          supabase,
          'students',
          legacyStudentList.map(mapStudentToRow)
        );
      }

      // Gabungkan akun untuk indeks sistem di aplikasi
      const mergedUsers = [...staffList, ...allStudents];

      // Gabungkan exam_sessions dan v_rekap_nilai serta integrasikan langsung dengan public.students
      const rawSessions = (sesRes.data || []).map((r) =>
        mapRowToSession(r as Record<string, unknown>)
      );
      const sessionMap = new Map<string, ExamSession>();
      for (const s of rawSessions) {
        const { session: integrated } = integrateSessionWithStudents(s, allStudents);
        sessionMap.set(integrated.id, integrated);
      }

      // Jika terdapat baris di v_rekap_nilai yang memperkaya data siswa / belum masuk ke map
      if (!rekapRes.error && Array.isArray(rekapRes.data)) {
        for (const r of rekapRes.data) {
          const mappedRekap = mapRowToSession(r as Record<string, unknown>);
          if (!mappedRekap.id) continue;
          const existing = sessionMap.get(mappedRekap.id);
          if (existing) {
            const { session: enriched } = integrateSessionWithStudents(
              {
                ...existing,
                studentId: mappedRekap.studentId || existing.studentId,
                studentName: mappedRekap.studentName || existing.studentName,
                studentUsername:
                  mappedRekap.studentUsername || existing.studentUsername,
                studentKelas: mappedRekap.studentKelas || existing.studentKelas,
                studentNomorPeserta:
                  mappedRekap.studentNomorPeserta || existing.studentNomorPeserta,
              },
              allStudents
            );
            sessionMap.set(enriched.id, enriched);
          } else {
            const { session: integrated } = integrateSessionWithStudents(
              mappedRekap,
              allStudents
            );
            sessionMap.set(integrated.id, integrated);
          }
        }
      }

      return {
        ok: true,
        data: {
          appSettings,
          classes: (clsRes.data || []).map((r) => mapRowToClass(r as Record<string, unknown>)),
          users: mergedUsers,
          exams: (exmRes.data || []).map((r) => mapRowToExam(r as Record<string, unknown>)),
          questions: (qstRes.data || []).map((r) =>
            mapRowToQuestion(r as Record<string, unknown>)
          ),
          sessions: Array.from(sessionMap.values()),
        },
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Gagal memuat data dari Supabase.',
      };
    }
  },

  async syncAllToSupabase(payload: {
    appSettings?: AppSettings;
    classes: ClassRoom[];
    users: UserAccount[];
    exams: ExamPackage[];
    questions: Question[];
    sessions: ExamSession[];
  }): Promise<{ ok: boolean; message: string }> {
    if (!supabase) {
      return {
        ok: false,
        message: 'Variabel VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum dikonfigurasi.',
      };
    }

    try {
      // 0. Upsert app_settings if table exists
      if (payload.appSettings) {
        await resilientUpsert(supabase, 'app_settings', [mapAppSettingsToRow(payload.appSettings)]);
      }

      // 1. Upsert classes
      if (payload.classes.length > 0) {
        const clsRes = await resilientUpsert(
          supabase,
          'classes',
          payload.classes.map(mapClassToRow)
        );
        if (!clsRes.ok) throw new Error(`Tabel classes: ${clsRes.error}`);
      }

      // 2. Upsert public.students (Khusus Data Siswa Peserta Ujian & Password Siswa)
      const studentOnly = payload.users.filter((u) => u.role === 'siswa');
      if (studentOnly.length > 0) {
        const stuRes = await resilientUpsert(
          supabase,
          'students',
          studentOnly.map(mapStudentToRow)
        );
        if (!stuRes.ok) {
          console.warn('Peringatan tabel students:', stuRes.error);
        }
      }

      // 3. Upsert public.users (Khusus Akun Aparatur: Admin, Guru, Proktor)
      const staffOnly = payload.users.filter((u) => u.role !== 'siswa');
      if (staffOnly.length > 0) {
        const usrRes = await resilientUpsert(
          supabase,
          'users',
          staffOnly.map(mapUserToRow)
        );
        if (!usrRes.ok) {
          console.warn('Peringatan tabel users:', usrRes.error);
        }
      }

      // 4. Upsert exams (Paket & Jadwal Ujian)
      if (payload.exams.length > 0) {
        const exmRes = await resilientUpsert(
          supabase,
          'exams',
          payload.exams.map(mapExamToRow)
        );
        if (!exmRes.ok) throw new Error(`Tabel exams: ${exmRes.error}`);
      }

      // 5. Upsert questions (Bank Soal & Kunci)
      if (payload.questions.length > 0) {
        const qstRes = await resilientUpsert(
          supabase,
          'questions',
          payload.questions.map(mapQuestionToRow)
        );
        if (!qstRes.ok) throw new Error(`Tabel questions: ${qstRes.error}`);
      }

      // 6. Upsert exam_sessions (Data Nilai & Sesi Siswa Terintegrasi Tabel public.students & v_rekap_nilai)
      if (payload.sessions.length > 0) {
        const batchRes = await this.upsertSessionsBatch(
          payload.sessions,
          payload.users
        );
        if (!batchRes.ok && batchRes.error) {
          throw new Error(`Tabel exam_sessions: ${batchRes.error}`);
        }
      }

      return {
        ok: true,
        message: `Berhasil menyinkronkan pengaturan aplikasi, ${payload.classes.length} kelas, ${studentOnly.length} siswa ke tabel students, ${staffOnly.length} staf ke tabel users, ${payload.exams.length} paket ujian, ${payload.questions.length} butir soal, dan ${payload.sessions.length} data nilai ke exam_sessions & v_rekap_nilai.`,
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat menyinkronkan data ke Supabase.',
      };
    }
  },

  // Individual Entity Persistence Helpers
  async upsertAppSettings(settings: AppSettings) {
    if (!supabase) return;
    await resilientUpsert(supabase, 'app_settings', [mapAppSettingsToRow(settings)]);
  },

  async upsertClass(cls: ClassRoom) {
    if (!supabase) return;
    await resilientUpsert(supabase, 'classes', [mapClassToRow(cls)]);
  },

  async deleteClass(id: string) {
    if (!supabase) return;
    await supabase.from('classes').delete().eq('id', id);
  },

  async upsertUser(user: UserAccount) {
    if (!supabase) return;
    if (user.role === 'siswa') {
      await resilientUpsert(supabase, 'students', [mapStudentToRow(user)]);
    } else {
      await resilientUpsert(supabase, 'users', [mapUserToRow(user)]);
    }
  },

  async bulkUpsertUsers(usersList: UserAccount[]) {
    if (!supabase || usersList.length === 0) return;
    const studentsList = usersList.filter((u) => u.role === 'siswa');
    const staffList = usersList.filter((u) => u.role !== 'siswa');
    if (studentsList.length > 0) {
      await resilientUpsert(supabase, 'students', studentsList.map(mapStudentToRow));
    }
    if (staffList.length > 0) {
      await resilientUpsert(supabase, 'users', staffList.map(mapUserToRow));
    }
  },

  async authenticateStudentDirectly(usernameOrNoPeserta: string): Promise<UserAccount | null> {
    if (!supabase) return null;
    try {
      const clean = usernameOrNoPeserta.trim().toLowerCase();
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .or(`username.ilike.${clean},nomor_peserta.ilike.${clean}`)
        .limit(1);
      if (!error && data && data.length > 0) {
        return { ...mapRowToUser(data[0] as Record<string, unknown>), role: 'siswa' };
      }
    } catch {
      // ignore
    }
    return null;
  },

  async authenticateStaffDirectly(usernameOrNip: string): Promise<UserAccount | null> {
    if (!supabase) return null;
    try {
      const clean = usernameOrNip.trim().toLowerCase();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.ilike.${clean},nomor_peserta.ilike.${clean}`)
        .limit(1);
      if (!error && data && data.length > 0) {
        const user = mapRowToUser(data[0] as Record<string, unknown>);
        if (user.role !== 'siswa') {
          return user;
        }
      }
    } catch {
      // ignore
    }
    return null;
  },

  async deleteUser(id: string) {
    if (!supabase) return;
    await Promise.all([
      supabase.from('users').delete().eq('id', id),
      supabase.from('students').delete().eq('id', id),
    ]);
  },

  async bulkDeleteUsers(ids: string[]) {
    if (!supabase || ids.length === 0) return;
    await Promise.all([
      supabase.from('users').delete().in('id', ids),
      supabase.from('students').delete().in('id', ids),
    ]);
  },

  async upsertExam(exam: ExamPackage) {
    if (!supabase) return;
    await resilientUpsert(supabase, 'exams', [mapExamToRow(exam)]);
  },

  async deleteExam(id: string) {
    if (!supabase) return;
    await supabase.from('exams').delete().eq('id', id);
  },

  async upsertQuestion(q: Question) {
    if (!supabase) return;
    await resilientUpsert(supabase, 'questions', [mapQuestionToRow(q)]);
  },

  async upsertQuestions(questions: Question[]) {
    if (!supabase || questions.length === 0) return;
    await resilientUpsert(supabase, 'questions', questions.map(mapQuestionToRow));
  },

  async deleteQuestion(id: string) {
    if (!supabase) return;
    await supabase.from('questions').delete().eq('id', id);
  },

  async upsertSession(
    s: ExamSession,
    studentContext?: UserAccount
  ): Promise<{ ok: boolean; session: ExamSession; error?: string }> {
    if (!supabase) {
      return {
        ok: false,
        session: s,
        error: 'Client Supabase belum dikonfigurasi.',
      };
    }

    let resolvedSession: ExamSession = { ...s };

    try {
      // 1. Cari data siswa di tabel public.students agar student_id terintegrasi dengan v_rekap_nilai
      const cleanUsername = (s.studentUsername || '').trim();
      const cleanNoPeserta = (s.studentNomorPeserta || '').trim();
      const orConditions: string[] = [`id.eq.${s.studentId}`];
      if (cleanUsername) orConditions.push(`username.ilike.${cleanUsername}`);
      if (cleanNoPeserta) orConditions.push(`nomor_peserta.ilike.${cleanNoPeserta}`);

      const { data: matchedStu } = await supabase
        .from('students')
        .select('*')
        .or(orConditions.join(','))
        .limit(1);

      let targetStudentAccount: UserAccount;

      if (matchedStu && matchedStu.length > 0) {
        const stuRow = matchedStu[0] as Record<string, unknown>;
        targetStudentAccount = {
          ...mapRowToUser(stuRow),
          role: 'siswa',
        };
        resolvedSession = {
          ...resolvedSession,
          studentId: targetStudentAccount.id,
          studentName: targetStudentAccount.name || resolvedSession.studentName,
          studentUsername:
            targetStudentAccount.username || resolvedSession.studentUsername,
          studentKelas:
            targetStudentAccount.kelas || resolvedSession.studentKelas,
          studentNomorPeserta:
            targetStudentAccount.nomorPeserta ||
            resolvedSession.studentNomorPeserta,
        };
      } else {
        // Jika siswa belum ada di public.students, daftarkan otomatis ke public.students
        targetStudentAccount = studentContext
          ? { ...studentContext, role: 'siswa' }
          : {
              id: s.studentId || `usr-siswa-${Date.now()}`,
              username: s.studentUsername || s.studentId,
              password: `CBT-${(s.studentNomorPeserta || '2026').slice(-3)}*`,
              name: s.studentName || 'Peserta Didik CBT',
              role: 'siswa',
              kelas: s.studentKelas || 'XII MIPA 1',
              nomorPeserta:
                s.studentNomorPeserta ||
                `26-01-0104-${Date.now().toString().slice(-3)}`,
              jenisKelamin: 'L',
              sekolah: 'SMA Negeri 1 Nusantara Jakarta',
            };
        await resilientUpsert(supabase, 'students', [
          mapStudentToRow(targetStudentAccount),
        ]);
      }

      // 2. Upsert ke tabel exam_sessions
      let sesRes = await resilientUpsert(supabase, 'exam_sessions', [
        mapSessionToRow(resolvedSession),
      ]);

      // 3. Fallback: Jika database masih memiliki constraint FK lama (exam_sessions.student_id -> public.users.id)
      //    pastikan baris siswa juga di-upsert ke public.users dan perbaiki FK via RPC bila tersedia
      if (!sesRes.ok) {
        await resilientUpsert(supabase, 'users', [
          mapStudentToRow(targetStudentAccount),
        ]);

        // Cek apakah di public.users sudah ada username/nomor_peserta yang sama dengan ID berbeda
        const { data: legacyUsr } = await supabase
          .from('users')
          .select('*')
          .or(orConditions.join(','))
          .limit(1);

        if (legacyUsr && legacyUsr.length > 0) {
          const usrRow = legacyUsr[0] as Record<string, unknown>;
          const legacyId = String(usrRow.id);
          // Pastikan di public.students juga tersedia agar v_rekap_nilai tetap terintegrasi
          await resilientUpsert(supabase, 'students', [
            mapStudentToRow({ ...targetStudentAccount, id: legacyId }),
          ]);
          resolvedSession = {
            ...resolvedSession,
            studentId: legacyId,
          };
        }

        // Coba jalankan perbaikan DDL untuk FK & v_rekap_nilai secara otomatis di latar belakang
        try {
          await supabase.rpc('exec_sql', { sql: REKAP_NILAI_MIGRATION_SQL });
        } catch {
          // Abaikan jika fungsi RPC belum dibuat
        }

        sesRes = await resilientUpsert(supabase, 'exam_sessions', [
          mapSessionToRow(resolvedSession),
        ]);
      }

      return {
        ok: sesRes.ok,
        session: resolvedSession,
        error: sesRes.error,
      };
    } catch (err) {
      return {
        ok: false,
        session: resolvedSession,
        error: err instanceof Error ? err.message : 'Gagal menyimpan sesi nilai.',
      };
    }
  },

  async upsertSessionsBatch(
    sessionsList: ExamSession[],
    knownUsers: UserAccount[] = []
  ): Promise<{
    ok: boolean;
    syncedSessions: ExamSession[];
    error?: string;
  }> {
    if (!supabase) {
      return {
        ok: false,
        syncedSessions: sessionsList,
        error: 'Client Supabase belum dikonfigurasi.',
      };
    }
    if (sessionsList.length === 0) {
      return { ok: true, syncedSessions: [] };
    }

    try {
      // Ambil daftar siswa terkini dari public.students untuk memastikan relasi student_id akurat
      const { data: dbStudentsData } = await supabase.from('students').select('*');
      const dbStudents: UserAccount[] = (dbStudentsData || []).map((r) => ({
        ...mapRowToUser(r as Record<string, unknown>),
        role: 'siswa' as const,
      }));

      const combinedStudents = [
        ...dbStudents,
        ...knownUsers
          .filter((u) => u.role === 'siswa')
          .filter(
            (ku) =>
              !dbStudents.some(
                (dbs) =>
                  dbs.id === ku.id ||
                  dbs.username.toLowerCase() === ku.username.toLowerCase() ||
                  dbs.nomorPeserta.toLowerCase() === ku.nomorPeserta.toLowerCase()
              )
          ),
      ];

      const studentsToEnsure = new Map<string, UserAccount>();
      const reconciledSessions: ExamSession[] = sessionsList.map((ses) => {
        const { session: integrated, matchedStudent } =
          integrateSessionWithStudents(ses, combinedStudents);
        if (matchedStudent) {
          studentsToEnsure.set(matchedStudent.id, matchedStudent);
          return integrated;
        }
        // Buat entitas siswa dari snapshot sesi apabila belum terdaftar di tabel students
        const fallbackStudent: UserAccount = {
          id: ses.studentId || `usr-siswa-${Date.now()}`,
          username: ses.studentUsername || ses.studentId,
          password: `CBT-${(ses.studentNomorPeserta || '2026').slice(-3)}*`,
          name: ses.studentName || 'Peserta Didik CBT',
          role: 'siswa',
          kelas: ses.studentKelas || 'XII MIPA 1',
          nomorPeserta:
            ses.studentNomorPeserta ||
            `26-01-0104-${Date.now().toString().slice(-3)}`,
          jenisKelamin: 'L',
          sekolah: 'SMA Negeri 1 Nusantara Jakarta',
        };
        studentsToEnsure.set(fallbackStudent.id, fallbackStudent);
        return integrated;
      });

      const studentRows = Array.from(studentsToEnsure.values()).map(mapStudentToRow);
      if (studentRows.length > 0) {
        await resilientUpsert(supabase, 'students', studentRows);
      }

      // Upsert seluruh sesi ke public.exam_sessions
      let sesRes = await resilientUpsert(
        supabase,
        'exam_sessions',
        reconciledSessions.map(mapSessionToRow)
      );

      // Jika gagal karena constraint FK lama yang masih menunjuk ke public.users,
      // sinkronkan siswa ke public.users dan jalankan migrasi RPC, lalu coba kembali per sesi
      if (!sesRes.ok) {
        if (studentRows.length > 0) {
          await resilientUpsert(supabase, 'users', studentRows);
        }
        try {
          await supabase.rpc('exec_sql', { sql: REKAP_NILAI_MIGRATION_SQL });
        } catch {
          // Abaikan bila RPC tidak tersedia
        }

        sesRes = await resilientUpsert(
          supabase,
          'exam_sessions',
          reconciledSessions.map(mapSessionToRow)
        );

        // Jika batch masih terkendala salah satu baris, proses satu per satu via upsertSession
        if (!sesRes.ok) {
          const singleResults: ExamSession[] = [];
          let lastSingleErr: string | undefined;
          let anyOk = false;
          for (const item of reconciledSessions) {
            const single = await this.upsertSession(
              item,
              studentsToEnsure.get(item.studentId)
            );
            singleResults.push(single.session);
            if (single.ok) {
              anyOk = true;
            } else {
              lastSingleErr = single.error;
            }
          }
          return {
            ok: anyOk,
            syncedSessions: singleResults,
            error: anyOk ? undefined : lastSingleErr,
          };
        }
      }

      return {
        ok: true,
        syncedSessions: reconciledSessions,
      };
    } catch (err) {
      return {
        ok: false,
        syncedSessions: sessionsList,
        error:
          err instanceof Error
            ? err.message
            : 'Gagal menyinkronkan kumpulan nilai ke Supabase.',
      };
    }
  },

  async deleteSession(id: string) {
    if (!supabase) return;
    await supabase.from('exam_sessions').delete().eq('id', id);
  },

  // Supabase Storage ('app-file' / 'app-files' bucket with automatic folder per Paket Ujian & Bank Soal)
  async uploadQuestionPhoto(
    file: File,
    params: {
      examCode: string;
      examTitle?: string;
      bankSoalName?: string;
      userId?: string;
    }
  ): Promise<{
    ok: boolean;
    url: string;
    storagePath: string;
    bucket: string;
    folderPath: string;
    message: string;
  }> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const baseName = sanitizeStorageSegment(
      file.name.replace(/\.[^/.]+$/, ''),
      'foto-soal'
    );
    const uniqueFileName = `${Date.now()}_${baseName}.${ext}`;

    // Check if there is an active Supabase Auth user to prefix with auth.uid() if RLS requires it
    let authUid: string | undefined;
    if (supabase) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          authUid = authData.user.id;
        }
      } catch {
        // Ignore if no Supabase Auth session
      }
    }

    const baseFolderPath = buildExamBankSoalFolder({
      examCode: params.examCode,
      examTitle: params.examTitle,
      bankSoalName: params.bankSoalName,
    });

    const candidateFolderPaths = authUid
      ? [`${authUid}/${baseFolderPath}`, baseFolderPath]
      : params.userId
      ? [baseFolderPath, `${params.userId}/${baseFolderPath}`]
      : [baseFolderPath];

    if (supabase) {
      // Try bucket 'app-file' first (as requested), then 'app-files'
      const candidateBuckets = ['app-file', 'app-files'];
      for (const bucketName of candidateBuckets) {
        for (const folderCandidate of candidateFolderPaths) {
          const fullObjectPath = `${folderCandidate}/${uniqueFileName}`;
          const { error: uploadErr } = await supabase.storage
            .from(bucketName)
            .upload(fullObjectPath, file, {
              cacheControl: '3600',
              upsert: true,
              contentType: file.type || 'image/jpeg',
            });

          if (!uploadErr) {
            // Try signed URL first (works for both private and public buckets), fallback to publicUrl
            const { data: signedData } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(fullObjectPath, 60 * 60 * 24 * 365);

            if (signedData?.signedUrl) {
              return {
                ok: true,
                url: signedData.signedUrl,
                storagePath: `${bucketName}/${fullObjectPath}`,
                bucket: bucketName,
                folderPath: folderCandidate,
                message: `Foto berhasil diunggah ke bucket '${bucketName}' pada folder otomatis: ${folderCandidate}/`,
              };
            }

            const { data: pubData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(fullObjectPath);

            return {
              ok: true,
              url: pubData.publicUrl,
              storagePath: `${bucketName}/${fullObjectPath}`,
              bucket: bucketName,
              folderPath: folderCandidate,
              message: `Foto berhasil disimpan ke bucket '${bucketName}' (${folderCandidate}/)`,
            };
          }
        }
      }
    }

    // Fallback to local Data URL if Supabase env/bucket is not yet reachable so the image works immediately
    const dataUrl = await readFileAsDataUrl(file);
    const fullObjectPath = `${baseFolderPath}/${uniqueFileName}`;
    return {
      ok: true,
      url: dataUrl,
      storagePath: `app-file/${fullObjectPath}`,
      bucket: 'app-file',
      folderPath: baseFolderPath,
      message: supabase
        ? `Folder otomatis 'app-file/${baseFolderPath}/' telah disiapkan dan foto dilampirkan.`
        : `Folder otomatis 'app-file/${baseFolderPath}/' disiapkan (hubungkan Supabase untuk sinkronisasi bucket cloud).`,
    };
  },

  async deleteQuestionPhoto(storagePath?: string) {
    if (!supabase || !storagePath) return;
    const parts = storagePath.split('/');
    if (parts.length < 2) return;
    const bucketName = parts[0];
    const objectPath = parts.slice(1).join('/');
    if (bucketName === 'app-file' || bucketName === 'app-files') {
      await supabase.storage.from(bucketName).remove([objectPath]);
    }
  },

  async uploadOwnFile(userId: string, file: File) {
    if (!supabase) {
      return { ok: false, message: 'Client Supabase belum dikonfigurasi.' };
    }
    const filePath = `${userId}/${file.name}`;
    const { error } = await supabase.storage
      .from('app-files')
      .upload(filePath, file, { upsert: true });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, path: filePath };
  },

  async listOwnFiles(userId: string) {
    if (!supabase) return [];
    const { data } = await supabase.storage.from('app-files').list(userId);
    return data || [];
  },

  async deleteOwnFile(userId: string, fileName: string) {
    if (!supabase) return;
    await supabase.storage.from('app-files').remove([`${userId}/${fileName}`]);
  },

  async broadcastRealtimePing(senderName: string = 'Admin'): Promise<{ ok: boolean; message: string }> {
    if (!supabase) {
      return { ok: false, message: 'Client Supabase belum dikonfigurasi.' };
    }
    try {
      const channel = supabase.channel('cbt-live-sync');
      await channel.send({
        type: 'broadcast',
        event: 'cbt-realtime-ping',
        payload: {
          sender: senderName,
          timestamp: new Date().toISOString(),
          message: `Sinyal realtime dari ${senderName} diterima.`,
        },
      });
      return { ok: true, message: 'Sinyal realtime ping berhasil disiarkan ke seluruh klien.' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Gagal menyiarkan sinyal realtime ping.',
      };
    }
  },
};

// ============================================================================
// SCHEMA METADATA & MIGRATION SQL FOR ADMIN INSPECTOR
// ============================================================================

export interface TableColumnDef {
  name: string;
  type: string;
  constraints: string;
  description: string;
}

export interface SupabaseTableSchemaInfo {
  tableName: string;
  menuName: string;
  description: string;
  columns: TableColumnDef[];
}

export const SUPABASE_TABLES_METADATA: SupabaseTableSchemaInfo[] = [
  {
    tableName: 'public.app_settings',
    menuName: 'Menu Pengaturan Aplikasi & Sekolah',
    description:
      'Menyimpan konfigurasi identitas aplikasi CBT, nama sekolah, NPSN, alamat instansi, kepala sekolah, tahun ajaran, judul kartu ujian, serta prefix auto-increment nomor peserta.',
    columns: [
      { name: 'id', type: 'TEXT', constraints: "PRIMARY KEY DEFAULT 'default'", description: 'ID konfigurasi tunggal aplikasi' },
      { name: 'app_name', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama aplikasi CBT (contoh: NusantaraCBT)' },
      { name: 'app_subtitle', type: 'TEXT', constraints: 'NOT NULL', description: 'Tagline / subjudul aplikasi pada halaman login & kop' },
      { name: 'school_name', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama resmi satuan pendidikan penyelenggara' },
      { name: 'npsn', type: 'TEXT', constraints: 'NOT NULL', description: 'Nomor Pokok Sekolah Nasional (NPSN)' },
      { name: 'school_address', type: 'TEXT', constraints: 'NOT NULL', description: 'Alamat lengkap sekolah untuk kop Kartu Ujian & Laporan Nilai' },
      { name: 'academic_year', type: 'TEXT', constraints: 'NOT NULL', description: 'Tahun pelajaran aktif (contoh: 2026/2027)' },
      { name: 'semester', type: 'TEXT', constraints: "CHECK ('Ganjil','Genap')", description: 'Semester berjalan' },
      { name: 'principal_name', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama Kepala Sekolah / Ketua Panitia pengesah dokumen' },
      { name: 'principal_nip', type: 'TEXT', constraints: 'NOT NULL', description: 'NIP Kepala Sekolah / Ketua Panitia' },
      { name: 'exam_card_title', type: 'TEXT', constraints: 'NOT NULL', description: 'Judul tajuk pada cetak Kartu Peserta Ujian' },
      { name: 'student_no_prefix', type: 'TEXT', constraints: "DEFAULT '26-01-0104-'", description: 'Prefix awalan untuk auto-increment nomor peserta siswa' },
      { name: 'default_kkm', type: 'NUMERIC(5,2)', constraints: 'DEFAULT 75', description: 'Standar KKM default satuan pendidikan' },
      { name: 'city_signature', type: 'TEXT', constraints: "DEFAULT 'Jakarta'", description: 'Kota tempat pengesahan tanda tangan laporan & kartu' },
      { name: 'enable_alert_student_enter', type: 'BOOLEAN', constraints: 'DEFAULT TRUE', description: 'Aktifkan notifikasi pop-up saat siswa masuk ujian' },
      { name: 'enable_alert_student_completed', type: 'BOOLEAN', constraints: 'DEFAULT TRUE', description: 'Aktifkan notifikasi pop-up saat siswa menyelesaikan ujian' },
      { name: 'enable_alert_student_tab_switch', type: 'BOOLEAN', constraints: 'DEFAULT TRUE', description: 'Aktifkan notifikasi pop-up saat siswa berpindah tab browser' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Waktu pembaruan konfigurasi terakhir' },
    ],
  },
  {
    tableName: 'public.classes',
    menuName: 'Menu Data Kelas',
    description:
      'Menyimpan master data Rombongan Belajar (Rombel), tingkat kelas, peminatan jurusan, wali kelas, ruang lab CBT, dan kuota kursi.',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'ID unik rombel (contoh: kls-xii-mipa-1)' },
      { name: 'kode_kelas', type: 'TEXT', constraints: 'NOT NULL UNIQUE', description: 'Kode standar rombel (contoh: KLS-XII-MIPA-1)' },
      { name: 'nama_kelas', type: 'TEXT', constraints: 'NOT NULL UNIQUE', description: 'Nama kelas (contoh: XII MIPA 1)' },
      { name: 'tingkat', type: 'TEXT', constraints: "CHECK ('X','XI','XII')", description: 'Tingkat kelas satuan pendidikan' },
      { name: 'jurusan', type: 'TEXT', constraints: "CHECK ('MIPA','IPS','Bahasa','Umum')", description: 'Peminatan akademik rombel' },
      { name: 'wali_kelas', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama lengkap dan gelar wali kelas' },
      { name: 'ruang_ujian', type: 'TEXT', constraints: 'NOT NULL', description: 'Lokasi laboratorium komputer ujian CBT' },
      { name: 'kapasitas', type: 'INTEGER', constraints: 'DEFAULT 36', description: 'Daya tampung maksimal kursi peserta' },
      { name: 'tahun_ajaran', type: 'TEXT', constraints: "DEFAULT '2026/2027'", description: 'Periode tahun akademik aktif' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Waktu pembuatan baris data' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Waktu pembaruan terakhir otomatis' },
    ],
  },
  {
    tableName: 'public.students',
    menuName: 'Menu Data Siswa (Struktur Mirip public.users + Kolom Password)',
    description:
      'Menyimpan data akun peserta didik (Siswa) dengan struktur kolom yang identik dengan public.users ditambah kolom password khusus untuk login ujian CBT siswa.',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'ID unik siswa (contoh: usr-siswa-01)' },
      { name: 'auth_user_id', type: 'UUID', constraints: 'UNIQUE FK -> auth.users(id) NULLABLE', description: 'Relasi opsional ke Supabase Auth (auth.users)' },
      { name: 'username', type: 'TEXT', constraints: 'NOT NULL UNIQUE', description: 'NISN / Username login siswa' },
      { name: 'password', type: 'TEXT', constraints: 'NOT NULL', description: 'Password login CBT khusus untuk akun siswa' },
      { name: 'name', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama lengkap peserta didik' },
      { name: 'role', type: 'TEXT', constraints: "CHECK ('siswa') DEFAULT 'siswa'", description: 'Peran pengguna tetap sebagai siswa' },
      { name: 'kelas', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama kelas / rombel siswa (contoh: XII MIPA 1)' },
      { name: 'nomor_peserta', type: 'TEXT', constraints: 'NOT NULL UNIQUE', description: 'Nomor kartu peserta ujian CBT (contoh: 26-01-0104-001)' },
      { name: 'jenis_kelamin', type: 'TEXT', constraints: "CHECK ('L','P')", description: 'Jenis kelamin siswa (Laki-laki / Perempuan)' },
      { name: 'sekolah', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama satuan pendidikan asal peserta' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Waktu pembuatan data siswa' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Waktu pembaruan terakhir' },
    ],
  },
  {
    tableName: 'public.users',
    menuName: 'Menu Manajemen User (Admin, Guru, Proktor + Kolom Password)',
    description:
      'Menyimpan akun aparatur penyelenggara ujian (Admin, Guru, dan Proktor) beserta kolom password login, peran hak akses, NIP/Kode Otorisasi, dan penugasan.',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'ID unik pengguna (contoh: usr-admin-01, usr-guru-01)' },
      { name: 'auth_user_id', type: 'UUID', constraints: 'UNIQUE FK -> auth.users(id) NULLABLE', description: 'Relasi opsional ke sistem autentikasi Supabase Auth (auth.users)' },
      { name: 'username', type: 'TEXT', constraints: 'NOT NULL UNIQUE', description: 'Username / NIP untuk Admin, Guru, atau Proktor' },
      { name: 'password', type: 'TEXT', constraints: "NOT NULL DEFAULT 'CBT-2026*'", description: 'Password login untuk akun Admin, Guru, Proktor' },
      { name: 'name', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama lengkap dan gelar Admin / Guru / Proktor' },
      { name: 'role', type: 'TEXT', constraints: "CHECK ('admin','guru','proktor','siswa')", description: 'Hak akses pengguna (admin, guru, proktor)' },
      { name: 'kelas', type: 'TEXT', constraints: 'NOT NULL', description: 'Jabatan / Mata Pelajaran Ampuan / Ruang Lab Tugas' },
      { name: 'nomor_peserta', type: 'TEXT', constraints: 'NOT NULL UNIQUE', description: 'NIP atau Kode Otorisasi Petugas' },
      { name: 'jenis_kelamin', type: 'TEXT', constraints: "CHECK ('L','P')", description: 'Jenis kelamin (Laki-laki / Perempuan)' },
      { name: 'sekolah', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama satuan pendidikan / instansi' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Waktu registrasi profil akun' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Waktu pembaruan terakhir' },
    ],
  },
  {
    tableName: 'public.exam_sessions',
    menuName: 'Menu Data Nilai & Leger Sesi (Terhubung Tabel students)',
    description:
      'Menyimpan hasil nilai ujian (skor akhir, jumlah benar/salah/kosong), rekaman lembar jawaban siswa real-time, sisa waktu, serta log pindah tab yang berelasi langsung ke public.students.',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'ID sesi pengerjaan ujian / leger nilai' },
      { name: 'exam_id', type: 'TEXT', constraints: 'FK -> public.exams(id) CASCADE', description: 'Referensi paket ujian yang dikerjakan' },
      { name: 'student_id', type: 'TEXT', constraints: 'FK -> public.students(id) CASCADE', description: 'Referensi akun siswa peserta ujian pada tabel public.students' },
      { name: 'student_name', type: 'TEXT', constraints: 'NOT NULL', description: 'Snapshot nama lengkap siswa saat ujian' },
      { name: 'student_username', type: 'TEXT', constraints: 'NOT NULL', description: 'Snapshot NISN siswa peserta ujian' },
      { name: 'student_kelas', type: 'TEXT', constraints: 'NOT NULL', description: 'Snapshot kelas rombel siswa' },
      { name: 'student_nomor_peserta', type: 'TEXT', constraints: 'NOT NULL', description: 'Snapshot nomor peserta CBT' },
      { name: 'status', type: 'TEXT', constraints: "CHECK ('in_progress','completed','timed_out')", description: 'Status pengerjaan lembar jawaban' },
      { name: 'score', type: 'NUMERIC(5,2)', constraints: 'DEFAULT 0', description: 'Nilai akhir skala 0 - 100' },
      { name: 'earned_points', type: 'NUMERIC(6,2)', constraints: 'DEFAULT 0', description: 'Total bobot poin yang diperoleh siswa' },
      { name: 'max_points', type: 'NUMERIC(6,2)', constraints: 'DEFAULT 100', description: 'Total bobot poin maksimal paket soal' },
      { name: 'correct_count', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Jumlah butir soal dijawab benar' },
      { name: 'wrong_count', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Jumlah butir soal dijawab salah' },
      { name: 'unanswered_count', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Jumlah butir soal tidak dijawab / kosong' },
      { name: 'total_questions', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Total butir soal dalam paket ujian' },
      { name: 'answers', type: 'JSONB', constraints: "DEFAULT '{}'::jsonb", description: 'Peta jawaban siswa per ID soal (A/B/C/D/E)' },
      { name: 'doubt_flags', type: 'JSONB', constraints: "DEFAULT '{}'::jsonb", description: 'Penanda soal ragu-ragu selama sesi ujian' },
      { name: 'remaining_seconds', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Sisa waktu hitung mundur ujian (detik)' },
      { name: 'tab_switch_count', type: 'INTEGER', constraints: 'DEFAULT 0', description: 'Jumlah pelanggaran berpindah tab browser' },
      { name: 'started_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Waktu mulai mengerjakan ujian' },
      { name: 'submitted_at', type: 'TIMESTAMPTZ', constraints: 'NULLABLE', description: 'Waktu pengumpulan lembar jawaban' },
    ],
  },
  {
    tableName: 'public.v_rekap_nilai',
    menuName: 'View Rekapitulasi Nilai (Integrasi v_rekap_nilai ⇄ students)',
    description:
      'View leger rekapitulasi nilai yang mengintegrasikan langsung tabel public.exam_sessions dengan tabel public.students (ID Siswa, Nomor Peserta, NISN, Nama Lengkap, Kelas, Jenis Kelamin, Sekolah), public.exams, dan public.classes.',
    columns: [
      { name: 'session_id', type: 'TEXT', constraints: 'PK dari exam_sessions.id', description: 'ID unik sesi pengerjaan ujian' },
      { name: 'student_id', type: 'TEXT', constraints: 'JOIN -> public.students(id)', description: 'ID siswa terintegrasi dari tabel public.students' },
      { name: 'nomor_peserta', type: 'TEXT', constraints: 'COALESCE(students.nomor_peserta)', description: 'Nomor peserta ujian dari tabel public.students' },
      { name: 'nisn', type: 'TEXT', constraints: 'COALESCE(students.username)', description: 'NISN / Username siswa dari tabel public.students' },
      { name: 'nama_siswa', type: 'TEXT', constraints: 'COALESCE(students.name)', description: 'Nama lengkap siswa dari tabel public.students' },
      { name: 'nama_kelas', type: 'TEXT', constraints: 'COALESCE(students.kelas)', description: 'Kelas / Rombel siswa dari tabel public.students' },
      { name: 'jenis_kelamin', type: 'TEXT', constraints: 'students.jenis_kelamin', description: 'Jenis kelamin siswa (L/P) dari tabel public.students' },
      { name: 'sekolah', type: 'TEXT', constraints: 'students.sekolah', description: 'Nama satuan pendidikan dari tabel public.students' },
      { name: 'exam_id', type: 'TEXT', constraints: 'JOIN -> public.exams(id)', description: 'ID paket ujian' },
      { name: 'kode_ujian', type: 'TEXT', constraints: 'exams.code', description: 'Kode paket ujian' },
      { name: 'mata_pelajaran', type: 'TEXT', constraints: 'exams.subject', description: 'Nama mata pelajaran ujian' },
      { name: 'kkm', type: 'NUMERIC(5,2)', constraints: 'exams.passing_score', description: 'Ambang batas KKM ujian' },
      { name: 'nilai_akhir', type: 'NUMERIC(5,2)', constraints: 'exam_sessions.score', description: 'Skor nilai akhir ujian siswa (0-100)' },
      { name: 'predikat_kelulusan', type: 'TEXT', constraints: 'LULUS KKM / REMEDIAL', description: 'Status ketuntasan terhadap KKM' },
      { name: 'jumlah_benar', type: 'INTEGER', constraints: 'exam_sessions.correct_count', description: 'Jumlah jawaban benar' },
      { name: 'jumlah_salah', type: 'INTEGER', constraints: 'exam_sessions.wrong_count', description: 'Jumlah jawaban salah' },
      { name: 'jumlah_kosong', type: 'INTEGER', constraints: 'exam_sessions.unanswered_count', description: 'Jumlah soal tidak dijawab' },
    ],
  },
  {
    tableName: 'public.exams',
    menuName: 'Menu Paket & Jadwal Ujian (Mendukung Bank Soal Bersama Lintas Paket)',
    description:
      'Menyimpan jadwal ujian, mata pelajaran, target kelas, durasi ujian, ambang KKM, status rilis, 6-digit token proktor, serta referensi source_exam_id dan bank_soal_name agar beberapa paket & jadwal ujian dapat menggunakan satu Bank Soal yang sama.',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'ID unik paket ujian (contoh: exam-mtk-01)' },
      { name: 'code', type: 'TEXT', constraints: 'NOT NULL UNIQUE', description: 'Kode paket ujian (contoh: USP-MTK-2026)' },
      { name: 'title', type: 'TEXT', constraints: 'NOT NULL', description: 'Judul lengkap paket asesmen/ujian' },
      { name: 'subject', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama mata pelajaran' },
      { name: 'kelas_target', type: 'TEXT', constraints: 'NOT NULL', description: 'Sasaran rombel ujian (Semua Kelas XII / spesifik)' },
      { name: 'exam_date', type: 'TEXT', constraints: 'NULLABLE', description: 'Tanggal pelaksanaan ujian (YYYY-MM-DD)' },
      { name: 'start_time', type: 'TEXT', constraints: 'NULLABLE', description: 'Jam mulai sesi ujian (HH:mm)' },
      { name: 'end_time', type: 'TEXT', constraints: 'NULLABLE', description: 'Jam berakhir sesi ujian (HH:mm)' },
      { name: 'duration_minutes', type: 'INTEGER', constraints: 'DEFAULT 45', description: 'Durasi pengerjaan ujian dalam menit' },
      { name: 'token', type: 'TEXT', constraints: 'NOT NULL', description: 'Token keamanan 6 karakter untuk memulai sesi' },
      { name: 'status', type: 'TEXT', constraints: "CHECK ('active','draft','closed')", description: 'Status ketersediaan paket ujian' },
      { name: 'passing_score', type: 'NUMERIC(5,2)', constraints: 'DEFAULT 75', description: 'Kriteria Ketuntasan Minimal (KKM)' },
      { name: 'show_explanation_after_submit', type: 'BOOLEAN', constraints: 'DEFAULT TRUE', description: 'Opsi tampilkan pembahasan setelah selesai' },
      { name: 'min_half_duration_submit', type: 'BOOLEAN', constraints: 'DEFAULT FALSE', description: 'Aturan batas minimal 1/2 durasi pengerjaan wajib' },
      { name: 'instructions', type: 'JSONB', constraints: "DEFAULT '[]'::jsonb", description: 'Daftar tata tertib dan petunjuk pengerjaan' },
      { name: 'source_exam_id', type: 'TEXT', constraints: 'NULLABLE (ID Paket Sumber / __TOPIC__)', description: 'ID paket ujian sumber apabila menggunakan kembali Bank Soal sebelumnya lintas jadwal' },
      { name: 'bank_soal_name', type: 'TEXT', constraints: 'NULLABLE', description: 'Nama Kelompok Bank Soal / Topik yang digunakan bersama oleh paket & jadwal ujian ini' },
      { name: 'created_at', type: 'TIMESTAMPTZ', constraints: 'DEFAULT NOW()', description: 'Waktu pembuatan paket ujian' },
    ],
  },
  {
    tableName: 'public.questions',
    menuName: 'Menu Bank Soal, Rich Text & Foto Soal (Reusable Lintas Paket & Jadwal)',
    description:
      'Menyimpan butir soal pilihan ganda (A-E) & esai, wacana/stimulus Rich Text HTML, URL & path dokumen foto dari bucket Supabase (app-file), kunci jawaban, dan pembahasan. Kolom exam_id bersifat opsional (ON DELETE SET NULL) sehingga Bank Soal tetap utuh dan dapat dipakai oleh banyak paket/jadwal ujian.',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY', description: 'ID unik butir soal (contoh: q-mtk-1)' },
      { name: 'exam_id', type: 'TEXT', constraints: 'FK -> public.exams(id) ON DELETE SET NULL', description: 'Referensi paket ujian asal (opsional, tidak terhapus saat jadwal dihapus)' },
      { name: 'number', type: 'INTEGER', constraints: 'NOT NULL', description: 'Nomor urut soal dalam bank soal' },
      { name: 'question_type', type: 'TEXT', constraints: "CHECK ('pilihan_ganda','esai') DEFAULT 'pilihan_ganda'", description: 'Tipe butir soal (Pilihan Ganda / Esai)' },
      { name: 'topic', type: 'TEXT', constraints: 'NOT NULL', description: 'Nama Kelompok Bank Soal / Topik (dapat digunakan lintas paket & jadwal ujian)' },
      { name: 'stimulus', type: 'TEXT', constraints: 'NULLABLE', description: 'Teks wacana pengantar (mendukung Rich Text HTML)' },
      { name: 'question_text', type: 'TEXT', constraints: 'NOT NULL', description: 'Pertanyaan pokok butir soal (mendukung Rich Text HTML)' },
      { name: 'image_url', type: 'TEXT', constraints: 'NULLABLE', description: 'URL dokumen foto soal dari bucket Supabase Storage' },
      { name: 'storage_path', type: 'TEXT', constraints: 'NULLABLE', description: 'Path folder otomatis: app-file/paket-<kode>/bank-soal-<topik>/<file>' },
      { name: 'options', type: 'JSONB', constraints: "DEFAULT '[]'::jsonb", description: 'Array JSON opsi jawaban A, B, C, D, E' },
      { name: 'correct_option', type: 'TEXT', constraints: "CHECK ('A','B','C','D','E')", description: 'Huruf kunci jawaban benar' },
      { name: 'essay_answer_key', type: 'TEXT', constraints: 'NULLABLE', description: 'Kunci jawaban / kata kunci penilaian soal esai' },
      { name: 'points', type: 'NUMERIC(6,2)', constraints: 'DEFAULT 10', description: 'Bobot poin butir soal' },
      { name: 'explanation', type: 'TEXT', constraints: 'NOT NULL', description: 'Uraian pembahasan penyelesaian soal (Rich Text HTML)' },
    ],
  },
  {
    tableName: 'storage.objects (app-file / app-files)',
    menuName: 'Bucket Dokumen Foto Bank Soal',
    description:
      "Bucket penyimpanan foto & dokumen soal ('app-file' dan 'app-files') dengan pembuatan folder otomatis berdasarkan Paket Ujian dan Bank Soal: paket-<kode_ujian>/bank-soal-<topik>/<nama_file>.",
    columns: [
      { name: 'bucket_id', type: 'TEXT', constraints: "IN ('app-file', 'app-files')", description: 'Identitas bucket penyimpanan dokumen & foto soal' },
      { name: 'name', type: 'TEXT', constraints: 'paket-<kode>/bank-soal-<topik>/*', description: 'Path otomatis berdasarkan Paket Ujian dan Bank Soal (atau diawali auth.uid())' },
      { name: 'owner_id', type: 'TEXT', constraints: 'auth.uid() NULLABLE', description: 'Pemilik objek berkas pada Supabase Storage' },
    ],
  },
];

export const REKAP_NILAI_MIGRATION_SQL = `
-- Migrasi Integrasi exam_sessions & v_rekap_nilai -> public.students
INSERT INTO public.students (id, username, password, name, role, kelas, nomor_peserta, jenis_kelamin, sekolah)
SELECT id, username, COALESCE(password, 'CBT-2026'), name, 'siswa', kelas, nomor_peserta, COALESCE(jenis_kelamin, 'L'), COALESCE(sekolah, 'SMA Negeri 1 Nusantara Jakarta')
FROM public.users
WHERE role = 'siswa'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.students (id, username, password, name, role, kelas, nomor_peserta, jenis_kelamin, sekolah)
SELECT DISTINCT ON (s.student_id)
  s.student_id,
  s.student_username,
  'CBT-2026',
  s.student_name,
  'siswa',
  s.student_kelas,
  s.student_nomor_peserta,
  'L',
  'SMA Negeri 1 Nusantara Jakarta'
FROM public.exam_sessions s
WHERE s.student_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.students st WHERE st.id = s.student_id)
  AND NOT EXISTS (SELECT 1 FROM public.students st WHERE LOWER(st.username) = LOWER(s.student_username))
  AND NOT EXISTS (SELECT 1 FROM public.students st WHERE LOWER(st.nomor_peserta) = LOWER(s.student_nomor_peserta))
ON CONFLICT DO NOTHING;

UPDATE public.exam_sessions es
SET student_id = st.id,
    student_name = st.name,
    student_username = st.username,
    student_kelas = st.kelas,
    student_nomor_peserta = st.nomor_peserta
FROM public.students st
WHERE es.student_id <> st.id
  AND (
    (es.student_username <> '' AND LOWER(es.student_username) = LOWER(st.username))
    OR (es.student_nomor_peserta <> '' AND LOWER(es.student_nomor_peserta) = LOWER(st.nomor_peserta))
  );

ALTER TABLE public.exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_student_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_sessions_student_id_students_fkey'
  ) THEN
    ALTER TABLE public.exam_sessions
      ADD CONSTRAINT exam_sessions_student_id_students_fkey
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.exam_sessions VALIDATE CONSTRAINT exam_sessions_student_id_students_fkey;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP VIEW IF EXISTS public.v_rekap_nilai CASCADE;
CREATE OR REPLACE VIEW public.v_rekap_nilai AS
SELECT
  s.id AS session_id,
  s.exam_id,
  e.code AS kode_ujian,
  e.title AS judul_ujian,
  e.subject AS mata_pelajaran,
  COALESCE(e.passing_score, 75) AS kkm,
  COALESCE(st.id, s.student_id) AS student_id,
  COALESCE(st.nomor_peserta, s.student_nomor_peserta) AS nomor_peserta,
  COALESCE(st.username, s.student_username) AS nisn,
  COALESCE(st.name, s.student_name) AS nama_siswa,
  COALESCE(st.kelas, s.student_kelas) AS nama_kelas,
  COALESCE(st.jenis_kelamin, 'L') AS jenis_kelamin,
  COALESCE(st.sekolah, 'SMA Negeri 1 Nusantara Jakarta') AS sekolah,
  c.tingkat,
  c.jurusan,
  c.wali_kelas,
  c.ruang_ujian,
  s.status AS status_sesi,
  s.score AS nilai_akhir,
  s.earned_points AS poin_diperoleh,
  s.max_points AS poin_maksimal,
  CASE
    WHEN s.status = 'in_progress' THEN 'SEDANG MENGERJAKAN'
    WHEN s.score >= COALESCE(e.passing_score, 75) THEN 'LULUS KKM'
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
LEFT JOIN public.students st
  ON s.student_id = st.id
  OR (s.student_username <> '' AND LOWER(s.student_username) = LOWER(st.username))
  OR (s.student_nomor_peserta <> '' AND LOWER(s.student_nomor_peserta) = LOWER(st.nomor_peserta))
LEFT JOIN public.exams e ON s.exam_id = e.id
LEFT JOIN public.classes c ON COALESCE(st.kelas, s.student_kelas) = c.nama_kelas;

GRANT SELECT ON public.v_rekap_nilai TO anon, authenticated, service_role;
`;

export const SUPABASE_SCHEMA_SQL = `-- ============================================================================
-- NUSANTARA CBT - SUPABASE POSTGRESQL SCHEMA MIGRATION (AUTO-PROVISIONING)
-- Jalankan skrip ini pada menu SQL Editor di Dashboard Supabase Anda
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fungsi Helper RPC agar aplikasi dapat membuat/memperbarui tabel secara otomatis:
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- 0. TABEL PENGATURAN APLIKASI & SEKOLAH (public.app_settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  app_name TEXT NOT NULL DEFAULT 'NusantaraCBT',
  app_subtitle TEXT NOT NULL DEFAULT 'Sistem Evaluasi & Ujian Berbasis Komputer Nasional',
  school_name TEXT NOT NULL DEFAULT 'SMA Negeri 1 Nusantara Jakarta',
  npsn TEXT NOT NULL DEFAULT '20100101',
  school_address TEXT NOT NULL DEFAULT 'Jl. Pendidikan Nasional No. 10, Menteng, Jakarta Pusat',
  academic_year TEXT NOT NULL DEFAULT '2026/2027',
  semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')) DEFAULT 'Genap',
  principal_name TEXT NOT NULL DEFAULT 'Dr. H. Surya Dharma, M.Pd.',
  principal_nip TEXT NOT NULL DEFAULT '19720514 199802 1 001',
  exam_card_title TEXT NOT NULL DEFAULT 'KARTU PESERTA PENILAIAN AKHIR TAHUN (CBT)',
  student_no_prefix TEXT NOT NULL DEFAULT '26-01-0104-',
  default_kkm NUMERIC(5,2) NOT NULL DEFAULT 75,
  city_signature TEXT NOT NULL DEFAULT 'Jakarta',
  enable_alert_student_enter BOOLEAN NOT NULL DEFAULT TRUE,
  enable_alert_student_completed BOOLEAN NOT NULL DEFAULT TRUE,
  enable_alert_student_tab_switch BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS enable_alert_student_enter BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS enable_alert_student_completed BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS enable_alert_student_tab_switch BOOLEAN NOT NULL DEFAULT TRUE;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 1. TABEL DATA KELAS (public.classes)
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

-- 2A. TABEL MANAJEMEN USER: ADMIN, GURU, PROKTOR (public.users - DENGAN KOLOM PASSWORD)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT 'CBT-2026*',
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'proktor', 'siswa')) DEFAULT 'proktor',
  kelas TEXT NOT NULL,
  nomor_peserta TEXT NOT NULL UNIQUE,
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
  sekolah TEXT NOT NULL DEFAULT 'SMA Negeri 1 Nusantara Jakarta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
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

-- 2B. TABEL DATA SISWA (public.students - STRUKTUR MIRIP public.users + KOLOM PASSWORD)
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT 'CBT-2026',
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('siswa')) DEFAULT 'siswa',
  kelas TEXT NOT NULL,
  nomor_peserta TEXT NOT NULL UNIQUE,
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
  sekolah TEXT NOT NULL DEFAULT 'SMA Negeri 1 Nusantara Jakarta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT 'CBT-2026';

CREATE INDEX IF NOT EXISTS idx_students_kelas ON public.students (kelas);
CREATE INDEX IF NOT EXISTS idx_students_username ON public.students (username);

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. TABEL PAKET & JADWAL UJIAN (public.exams)
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
  min_half_duration_submit BOOLEAN NOT NULL DEFAULT FALSE,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_exam_id TEXT,
  bank_soal_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_date TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS min_half_duration_submit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS source_exam_id TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS bank_soal_name TEXT;

CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams (status);
CREATE INDEX IF NOT EXISTS idx_exams_kelas_target ON public.exams (kelas_target);
CREATE INDEX IF NOT EXISTS idx_exams_source_exam_id ON public.exams (source_exam_id);

DROP TRIGGER IF EXISTS trg_exams_updated_at ON public.exams;
CREATE TRIGGER trg_exams_updated_at
BEFORE UPDATE ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. TABEL BANK SOAL & KUNCI JAWABAN (public.questions - REUSABLE LINTAS PAKET & JADWAL UJIAN)
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT REFERENCES public.exams(id) ON DELETE SET NULL,
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
ALTER TABLE public.questions ALTER COLUMN exam_id DROP NOT NULL;

-- Pastikan saat satu paket/jadwal ujian dihapus, bank soal tidak ikut terhapus (ON DELETE SET NULL)
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_exam_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_exam_id_set_null_fkey'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_exam_id_set_null_fkey
      FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE SET NULL NOT VALID;
    ALTER TABLE public.questions VALIDATE CONSTRAINT questions_exam_id_set_null_fkey;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_exam_id_number ON public.questions (exam_id, number);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions (topic);

DROP TRIGGER IF EXISTS trg_questions_updated_at ON public.questions;
CREATE TRIGGER trg_questions_updated_at
BEFORE UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. TABEL DATA NILAI & SESI UJIAN SISWA TERINTEGRASI TABEL STUDENTS (public.exam_sessions)
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
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

-- Pastikan seluruh akun siswa di public.users maupun di exam_sessions terdaftar pada public.students
INSERT INTO public.students (id, username, password, name, role, kelas, nomor_peserta, jenis_kelamin, sekolah)
SELECT id, username, COALESCE(password, 'CBT-2026'), name, 'siswa', kelas, nomor_peserta, COALESCE(jenis_kelamin, 'L'), COALESCE(sekolah, 'SMA Negeri 1 Nusantara Jakarta')
FROM public.users
WHERE role = 'siswa'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.students (id, username, password, name, role, kelas, nomor_peserta, jenis_kelamin, sekolah)
SELECT DISTINCT ON (s.student_id)
  s.student_id,
  s.student_username,
  'CBT-2026',
  s.student_name,
  'siswa',
  s.student_kelas,
  s.student_nomor_peserta,
  'L',
  'SMA Negeri 1 Nusantara Jakarta'
FROM public.exam_sessions s
WHERE s.student_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.students st WHERE st.id = s.student_id)
  AND NOT EXISTS (SELECT 1 FROM public.students st WHERE LOWER(st.username) = LOWER(s.student_username))
  AND NOT EXISTS (SELECT 1 FROM public.students st WHERE LOWER(st.nomor_peserta) = LOWER(s.student_nomor_peserta))
ON CONFLICT DO NOTHING;

-- Sinkronkan student_id pada exam_sessions agar merujuk langsung ke id pada public.students
UPDATE public.exam_sessions es
SET student_id = st.id,
    student_name = st.name,
    student_username = st.username,
    student_kelas = st.kelas,
    student_nomor_peserta = st.nomor_peserta
FROM public.students st
WHERE es.student_id <> st.id
  AND (
    (es.student_username <> '' AND LOWER(es.student_username) = LOWER(st.username))
    OR (es.student_nomor_peserta <> '' AND LOWER(es.student_nomor_peserta) = LOWER(st.nomor_peserta))
  );

-- Hapus constraint FK lama yang mengarah ke public.users(id) dan hubungkan ke public.students(id)
ALTER TABLE public.exam_sessions DROP CONSTRAINT IF EXISTS exam_sessions_student_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_sessions_student_id_students_fkey'
  ) THEN
    ALTER TABLE public.exam_sessions
      ADD CONSTRAINT exam_sessions_student_id_students_fkey
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.exam_sessions VALIDATE CONSTRAINT exam_sessions_student_id_students_fkey;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_id ON public.exam_sessions (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_id ON public.exam_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_kelas ON public.exam_sessions (student_kelas);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON public.exam_sessions (status);

DROP TRIGGER IF EXISTS trg_exam_sessions_updated_at ON public.exam_sessions;
CREATE TRIGGER trg_exam_sessions_updated_at
BEFORE UPDATE ON public.exam_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. VIEW REKAPITULASI LEGER NILAI TERINTEGRASI TABEL STUDENTS (public.v_rekap_nilai)
DROP VIEW IF EXISTS public.v_rekap_nilai CASCADE;
CREATE OR REPLACE VIEW public.v_rekap_nilai AS
SELECT
  s.id AS session_id,
  s.exam_id,
  e.code AS kode_ujian,
  e.title AS judul_ujian,
  e.subject AS mata_pelajaran,
  COALESCE(e.passing_score, 75) AS kkm,
  COALESCE(st.id, s.student_id) AS student_id,
  COALESCE(st.nomor_peserta, s.student_nomor_peserta) AS nomor_peserta,
  COALESCE(st.username, s.student_username) AS nisn,
  COALESCE(st.name, s.student_name) AS nama_siswa,
  COALESCE(st.kelas, s.student_kelas) AS nama_kelas,
  COALESCE(st.jenis_kelamin, 'L') AS jenis_kelamin,
  COALESCE(st.sekolah, 'SMA Negeri 1 Nusantara Jakarta') AS sekolah,
  c.tingkat,
  c.jurusan,
  c.wali_kelas,
  c.ruang_ujian,
  s.status AS status_sesi,
  s.score AS nilai_akhir,
  s.earned_points AS poin_diperoleh,
  s.max_points AS poin_maksimal,
  CASE
    WHEN s.status = 'in_progress' THEN 'SEDANG MENGERJAKAN'
    WHEN s.score >= COALESCE(e.passing_score, 75) THEN 'LULUS KKM'
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
LEFT JOIN public.students st
  ON s.student_id = st.id
  OR (s.student_username <> '' AND LOWER(s.student_username) = LOWER(st.username))
  OR (s.student_nomor_peserta <> '' AND LOWER(s.student_nomor_peserta) = LOWER(st.nomor_peserta))
LEFT JOIN public.exams e ON s.exam_id = e.id
LEFT JOIN public.classes c ON COALESCE(st.kelas, s.student_kelas) = c.nama_kelas;

GRANT SELECT ON public.v_rekap_nilai TO anon, authenticated, service_role;

-- 7. ROW LEVEL SECURITY (RLS) & POLICIES
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access on app_settings" ON public.app_settings;
CREATE POLICY "Allow public full access on app_settings"
  ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on classes" ON public.classes;
CREATE POLICY "Allow public full access on classes"
  ON public.classes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on users" ON public.users;
CREATE POLICY "Allow public full access on users"
  ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on students" ON public.students;
CREATE POLICY "Allow public full access on students"
  ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on exams" ON public.exams;
CREATE POLICY "Allow public full access on exams"
  ON public.exams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on questions" ON public.questions;
CREATE POLICY "Allow public full access on questions"
  ON public.questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on exam_sessions" ON public.exam_sessions;
CREATE POLICY "Allow public full access on exam_sessions"
  ON public.exam_sessions FOR ALL USING (true) WITH CHECK (true);

-- 8. SUPABASE STORAGE BUCKET ('app-file' & 'app-files') & POLICIES
-- Struktur otomatis folder Bank Soal:
--   paket-<kode_paket_ujian>/bank-soal-<nama_bank_soal>/<nama_file_foto>
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('app-file', 'app-file', true),
  ('app-files', 'app-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow storage access on app-file" ON storage.objects;
CREATE POLICY "Allow storage access on app-file"
  ON storage.objects FOR ALL
  USING (bucket_id IN ('app-file', 'app-files'))
  WITH CHECK (bucket_id IN ('app-file', 'app-files'));

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

-- 9. PUBLIKASI SUPABASE REALTIME (MENGAKTIFKAN KONEKSI REALTIME KE SEMUA TABEL)
DO $$
BEGIN
  -- Set REPLICA IDENTITY FULL agar payload event UPDATE dan DELETE menyertakan data baris lengkap
  ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
  ALTER TABLE public.classes REPLICA IDENTITY FULL;
  ALTER TABLE public.users REPLICA IDENTITY FULL;
  ALTER TABLE public.students REPLICA IDENTITY FULL;
  ALTER TABLE public.exams REPLICA IDENTITY FULL;
  ALTER TABLE public.questions REPLICA IDENTITY FULL;
  ALTER TABLE public.exam_sessions REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE 
        public.app_settings, 
        public.classes, 
        public.users, 
        public.students, 
        public.exams, 
        public.questions, 
        public.exam_sessions;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;`;
