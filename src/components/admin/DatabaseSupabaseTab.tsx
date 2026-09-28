import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  Copy,
  Check,
  Download,
  Table2,
  FileCode2,
  Layers,
  ShieldCheck,
  Wrench,
  Settings2,
  XCircle,
  Radio,
  Activity,
  Zap,
  Wifi,
  WifiOff,
  BellRing,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import {
  getSupabaseProjectRef,
  mapAppSettingsToRow,
  mapClassToRow,
  mapExamToRow,
  mapQuestionToRow,
  mapSessionToRow,
  mapStudentToRow,
  mapUserToRow,
  SUPABASE_SCHEMA_SQL,
  SUPABASE_TABLES_METADATA,
} from '../../lib/supabase';

function escapeSqlLiteral(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

const AUTO_CHECK_STORAGE_KEY = 'cbt_supabase_auto_check_v1';

export const DatabaseSupabaseTab: React.FC = () => {
  const {
    appSettings,
    classes,
    users,
    exams,
    questions,
    sessions,
    supabaseState,
    supabaseMessage,
    isSyncingSupabase,
    lastSyncedAt,
    tableHealth,
    allTablesReady,
    refreshFromSupabase,
    pushAllToSupabase,
    checkAndAutoCreateTables,
    realtimeStatus,
    realtimeEventsCount,
    lastRealtimeEvent,
    realtimeLogs,
    sendRealtimePing,
    showToast,
  } = useCBT();

  const [isPingingRealtime, setIsPingingRealtime] = useState<boolean>(false);
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);
  const [sqlViewMode, setSqlViewMode] = useState<'ddl' | 'seed'>('ddl');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [autoCheckOnStartup, setAutoCheckOnStartup] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTO_CHECK_STORAGE_KEY);
      return saved ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleAutoCheck = (next: boolean) => {
    setAutoCheckOnStartup(next);
    try {
      localStorage.setItem(AUTO_CHECK_STORAGE_KEY, String(next));
    } catch {
      // ignore storage errors
    }
    showToast(
      next ? 'Pengecekan Otomatis Aktif' : 'Pengecekan Otomatis Dinonaktifkan',
      next
        ? 'Aplikasi akan selalu memeriksa tabel database dan membuat/menyinkronkan tabel secara otomatis saat dibuka.'
        : 'Pengecekan tabel otomatis saat startup dinonaktifkan.',
      'info'
    );
  };

  const generateFullSeedSql = (): string => {
    const rApp = mapAppSettingsToRow(appSettings);
    const lines: string[] = [
      '-- ============================================================================',
      '-- NUSANTARA CBT - DATA SEEDING SQL (PENGATURAN, KELAS, USER, SISWA, UJIAN, SOAL & NILAI)',
      '-- Jalankan setelah skema 001_initial_cbt_schema.sql dibuat di Supabase SQL Editor',
      '-- ============================================================================',
      '',
      '-- 0. PENGATURAN APLIKASI & SEKOLAH (public.app_settings)',
      `INSERT INTO public.app_settings (id, app_name, app_subtitle, school_name, npsn, school_address, academic_year, semester, principal_name, principal_nip, exam_card_title, student_no_prefix, default_kkm, city_signature) VALUES (${escapeSqlLiteral(
        rApp.id
      )}, ${escapeSqlLiteral(rApp.app_name)}, ${escapeSqlLiteral(
        rApp.app_subtitle
      )}, ${escapeSqlLiteral(rApp.school_name)}, ${escapeSqlLiteral(
        rApp.npsn
      )}, ${escapeSqlLiteral(rApp.school_address)}, ${escapeSqlLiteral(
        rApp.academic_year
      )}, ${escapeSqlLiteral(rApp.semester)}, ${escapeSqlLiteral(
        rApp.principal_name
      )}, ${escapeSqlLiteral(rApp.principal_nip)}, ${escapeSqlLiteral(
        rApp.exam_card_title
      )}, ${escapeSqlLiteral(rApp.student_no_prefix)}, ${escapeSqlLiteral(
        rApp.default_kkm
      )}, ${escapeSqlLiteral(
        rApp.city_signature
      )}) ON CONFLICT (id) DO UPDATE SET app_name = EXCLUDED.app_name, app_subtitle = EXCLUDED.app_subtitle, school_name = EXCLUDED.school_name, npsn = EXCLUDED.npsn, school_address = EXCLUDED.school_address, academic_year = EXCLUDED.academic_year, semester = EXCLUDED.semester, principal_name = EXCLUDED.principal_name, principal_nip = EXCLUDED.principal_nip, exam_card_title = EXCLUDED.exam_card_title, student_no_prefix = EXCLUDED.student_no_prefix, default_kkm = EXCLUDED.default_kkm, city_signature = EXCLUDED.city_signature;`,
      '',
      '-- 1. DATA KELAS (public.classes)',
    ];

    for (const c of classes) {
      const r = mapClassToRow(c);
      lines.push(
        `INSERT INTO public.classes (id, kode_kelas, nama_kelas, tingkat, jurusan, wali_kelas, ruang_ujian, kapasitas, tahun_ajaran) VALUES (${escapeSqlLiteral(
          r.id
        )}, ${escapeSqlLiteral(r.kode_kelas)}, ${escapeSqlLiteral(
          r.nama_kelas
        )}, ${escapeSqlLiteral(r.tingkat)}, ${escapeSqlLiteral(
          r.jurusan
        )}, ${escapeSqlLiteral(r.wali_kelas)}, ${escapeSqlLiteral(
          r.ruang_ujian
        )}, ${escapeSqlLiteral(r.kapasitas)}, ${escapeSqlLiteral(
          r.tahun_ajaran
        )}) ON CONFLICT (id) DO UPDATE SET kode_kelas = EXCLUDED.kode_kelas, nama_kelas = EXCLUDED.nama_kelas, tingkat = EXCLUDED.tingkat, jurusan = EXCLUDED.jurusan, wali_kelas = EXCLUDED.wali_kelas, ruang_ujian = EXCLUDED.ruang_ujian, kapasitas = EXCLUDED.kapasitas, tahun_ajaran = EXCLUDED.tahun_ajaran;`
      );
    }

    lines.push('', '-- 2. DATA SISWA (public.students - DENGAN KOLOM PASSWORD)');
    for (const st of users.filter((u) => u.role === 'siswa')) {
      const r = mapStudentToRow(st);
      lines.push(
        `INSERT INTO public.students (id, username, password, name, role, kelas, nomor_peserta, jenis_kelamin, sekolah) VALUES (${escapeSqlLiteral(
          r.id
        )}, ${escapeSqlLiteral(r.username)}, ${escapeSqlLiteral(
          r.password
        )}, ${escapeSqlLiteral(r.name)}, ${escapeSqlLiteral(
          r.role
        )}, ${escapeSqlLiteral(r.kelas)}, ${escapeSqlLiteral(
          r.nomor_peserta
        )}, ${escapeSqlLiteral(r.jenis_kelamin)}, ${escapeSqlLiteral(
          r.sekolah
        )}) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role, kelas = EXCLUDED.kelas, nomor_peserta = EXCLUDED.nomor_peserta, jenis_kelamin = EXCLUDED.jenis_kelamin, sekolah = EXCLUDED.sekolah;`
      );
    }

    lines.push('', '-- 2B. MANAJEMEN USER KHUSUS APARATUR: ADMIN, GURU, PROKTOR (public.users)');
    for (const u of users.filter((u) => u.role !== 'siswa')) {
      const r = mapUserToRow(u);
      lines.push(
        `INSERT INTO public.users (id, username, password, name, role, kelas, nomor_peserta, jenis_kelamin, sekolah) VALUES (${escapeSqlLiteral(
          r.id
        )}, ${escapeSqlLiteral(r.username)}, ${escapeSqlLiteral(
          r.password
        )}, ${escapeSqlLiteral(r.name)}, ${escapeSqlLiteral(
          r.role
        )}, ${escapeSqlLiteral(r.kelas)}, ${escapeSqlLiteral(
          r.nomor_peserta
        )}, ${escapeSqlLiteral(r.jenis_kelamin)}, ${escapeSqlLiteral(
          r.sekolah
        )}) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role, kelas = EXCLUDED.kelas, nomor_peserta = EXCLUDED.nomor_peserta, jenis_kelamin = EXCLUDED.jenis_kelamin, sekolah = EXCLUDED.sekolah;`
      );
    }

    lines.push('', '-- 3. PAKET & JADWAL UJIAN (public.exams)');
    for (const ex of exams) {
      const r = mapExamToRow(ex);
      lines.push(
        `INSERT INTO public.exams (id, code, title, subject, kelas_target, exam_date, start_time, end_time, duration_minutes, token, status, passing_score, show_explanation_after_submit, instructions, created_at) VALUES (${escapeSqlLiteral(
          r.id
        )}, ${escapeSqlLiteral(r.code)}, ${escapeSqlLiteral(
          r.title
        )}, ${escapeSqlLiteral(r.subject)}, ${escapeSqlLiteral(
          r.kelas_target
        )}, ${escapeSqlLiteral(r.exam_date)}, ${escapeSqlLiteral(
          r.start_time
        )}, ${escapeSqlLiteral(r.end_time)}, ${escapeSqlLiteral(
          r.duration_minutes
        )}, ${escapeSqlLiteral(r.token)}, ${escapeSqlLiteral(
          r.status
        )}, ${escapeSqlLiteral(r.passing_score)}, ${escapeSqlLiteral(
          r.show_explanation_after_submit
        )}, ${escapeSqlLiteral(r.instructions)}, ${escapeSqlLiteral(
          r.created_at
        )}) ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, title = EXCLUDED.title, subject = EXCLUDED.subject, kelas_target = EXCLUDED.kelas_target, exam_date = EXCLUDED.exam_date, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, duration_minutes = EXCLUDED.duration_minutes, token = EXCLUDED.token, status = EXCLUDED.status, passing_score = EXCLUDED.passing_score, show_explanation_after_submit = EXCLUDED.show_explanation_after_submit, instructions = EXCLUDED.instructions;`
      );
    }

    lines.push('', '-- 4. BANK SOAL & KUNCI JAWABAN (public.questions)');
    for (const q of questions) {
      const r = mapQuestionToRow(q);
      lines.push(
        `INSERT INTO public.questions (id, exam_id, number, question_type, topic, stimulus, question_text, image_url, storage_path, options, correct_option, essay_answer_key, points, explanation) VALUES (${escapeSqlLiteral(
          r.id
        )}, ${escapeSqlLiteral(r.exam_id)}, ${escapeSqlLiteral(
          r.number
        )}, ${escapeSqlLiteral(r.question_type)}, ${escapeSqlLiteral(
          r.topic
        )}, ${escapeSqlLiteral(r.stimulus)}, ${escapeSqlLiteral(
          r.question_text
        )}, ${escapeSqlLiteral(r.image_url)}, ${escapeSqlLiteral(
          r.storage_path
        )}, ${escapeSqlLiteral(r.options)}, ${escapeSqlLiteral(
          r.correct_option
        )}, ${escapeSqlLiteral(r.essay_answer_key)}, ${escapeSqlLiteral(
          r.points
        )}, ${escapeSqlLiteral(
          r.explanation
        )}) ON CONFLICT (id) DO UPDATE SET number = EXCLUDED.number, question_type = EXCLUDED.question_type, topic = EXCLUDED.topic, stimulus = EXCLUDED.stimulus, question_text = EXCLUDED.question_text, image_url = EXCLUDED.image_url, storage_path = EXCLUDED.storage_path, options = EXCLUDED.options, correct_option = EXCLUDED.correct_option, essay_answer_key = EXCLUDED.essay_answer_key, points = EXCLUDED.points, explanation = EXCLUDED.explanation;`
      );
    }

    lines.push('', '-- 5. DATA NILAI & SESI UJIAN SISWA (public.exam_sessions)');
    for (const s of sessions) {
      const r = mapSessionToRow(s);
      lines.push(
        `INSERT INTO public.exam_sessions (id, exam_id, student_id, student_name, student_username, student_kelas, student_nomor_peserta, started_at, submitted_at, status, answers, doubt_flags, remaining_seconds, tab_switch_count, score, earned_points, max_points, correct_count, wrong_count, unanswered_count, total_questions) VALUES (${escapeSqlLiteral(
          r.id
        )}, ${escapeSqlLiteral(r.exam_id)}, ${escapeSqlLiteral(
          r.student_id
        )}, ${escapeSqlLiteral(r.student_name)}, ${escapeSqlLiteral(
          r.student_username
        )}, ${escapeSqlLiteral(r.student_kelas)}, ${escapeSqlLiteral(
          r.student_nomor_peserta
        )}, ${escapeSqlLiteral(r.started_at)}, ${escapeSqlLiteral(
          r.submitted_at
        )}, ${escapeSqlLiteral(r.status)}, ${escapeSqlLiteral(
          r.answers
        )}, ${escapeSqlLiteral(r.doubt_flags)}, ${escapeSqlLiteral(
          r.remaining_seconds
        )}, ${escapeSqlLiteral(r.tab_switch_count)}, ${escapeSqlLiteral(
          r.score
        )}, ${escapeSqlLiteral(r.earned_points)}, ${escapeSqlLiteral(
          r.max_points
        )}, ${escapeSqlLiteral(r.correct_count)}, ${escapeSqlLiteral(
          r.wrong_count
        )}, ${escapeSqlLiteral(r.unanswered_count)}, ${escapeSqlLiteral(
          r.total_questions
        )}) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, submitted_at = EXCLUDED.submitted_at, answers = EXCLUDED.answers, doubt_flags = EXCLUDED.doubt_flags, remaining_seconds = EXCLUDED.remaining_seconds, tab_switch_count = EXCLUDED.tab_switch_count, score = EXCLUDED.score, earned_points = EXCLUDED.earned_points, max_points = EXCLUDED.max_points, correct_count = EXCLUDED.correct_count, wrong_count = EXCLUDED.wrong_count, unanswered_count = EXCLUDED.unanswered_count, total_questions = EXCLUDED.total_questions;`
      );
    }

    return lines.join('\n');
  };

  const activeSqlContent =
    sqlViewMode === 'ddl'
      ? SUPABASE_SCHEMA_SQL
      : `${SUPABASE_SCHEMA_SQL}\n\n${generateFullSeedSql()}`;

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(activeSqlContent);
      setCopiedSql(true);
      showToast(
        'Skrip SQL Disalin',
        'Tempel dan jalankan skrip pada menu SQL Editor di Dashboard Supabase Anda.',
        'success'
      );
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      showToast('Gagal Menyalin', 'Silakan salin teks SQL secara manual.', 'error');
    }
  };

  const handleDownloadSql = () => {
    const blob = new Blob([activeSqlContent], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      sqlViewMode === 'ddl'
        ? '001_initial_cbt_schema.sql'
        : '001_cbt_schema_with_seed_data.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const tableCounts: Record<string, number> = {
    'public.app_settings': 1,
    'public.classes': classes.length,
    'public.students': users.filter((u) => u.role === 'siswa').length,
    'public.users': users.filter((u) => u.role !== 'siswa').length,
    'public.exam_sessions': sessions.length,
    'public.exams': exams.length,
    'public.questions': questions.length,
  };

  const activeTable = SUPABASE_TABLES_METADATA[selectedTableIndex];
  const readyTablesCount = tableHealth.filter(
    (t) => t.exists && t.hasPasswordColumn !== false
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Status & Synchronization Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Koneksi & Manajemen Tabel Database PostgreSQL Supabase
                </h2>
                <span className="text-xs text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-xs text-slate-600">
                  Host: {getSupabaseProjectRef()}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">{supabaseMessage}</p>
              {lastSyncedAt && (
                <p className="text-[11px] font-mono text-slate-500 mt-1">
                  Sinkronisasi terakhir: {new Date(lastSyncedAt).toLocaleTimeString('id-ID')}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isSyncingSupabase}
              onClick={() => void refreshFromSupabase()}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin' : ''}`}
              />
              <span>Muat Data dari Supabase</span>
            </button>

            <button
              type="button"
              disabled={isSyncingSupabase}
              onClick={() => void pushAllToSupabase()}
              className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Sinkronkan Semua Data</span>
            </button>
          </div>
        </div>

        {/* Connection Guide & Status Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              {supabaseState === 'connected' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>1. Pengecekan Database & Tabel</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Sistem mengecek keberadaan 7 tabel utama (termasuk{' '}
              <code className="font-mono text-slate-900">app_settings</code>,{' '}
              <code className="font-mono text-slate-900">users.password</code>, dan{' '}
              <code className="font-mono text-slate-900">students.password</code>) sebelum
              melakukan operasi CRUD.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Wrench className="w-4 h-4 text-blue-600 shrink-0" />
              <span>2. Penambahan Tabel Otomatis</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Gunakan tombol <strong>Buat & Perbaiki Tabel Otomatis</strong> di bawah untuk
              menjalankan migrasi DDL via RPC Supabase & mengisi data awal secara otomatis.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>3. Sinkronisasi Real-Time Otomatis</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Setiap penambahan/perubahan pada <strong>Pengaturan Aplikasi</strong>,{' '}
              <strong>Manajemen User</strong>, <strong>Data Siswa</strong>,{' '}
              <strong>Data Kelas</strong>, <strong>Paket Ujian</strong>, &{' '}
              <strong>Bank Soal</strong> langsung di-upsert ke Supabase.
            </p>
          </div>
        </div>
      </div>

      {/* Supabase Realtime Live Sync & Channel Status Panel */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-blue-50/30 to-indigo-50/20">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                realtimeStatus === 'SUBSCRIBED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : realtimeStatus === 'CONNECTING'
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-700 text-white'
              }`}
            >
              {realtimeStatus === 'SUBSCRIBED' ? (
                <Radio className="w-5 h-5 animate-pulse" />
              ) : realtimeStatus === 'CONNECTING' ? (
                <Activity className="w-5 h-5 animate-spin" />
              ) : (
                <WifiOff className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Status Koneksi Realtime Supabase (PostgreSQL Changes & Broadcast)
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    realtimeStatus === 'SUBSCRIBED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : realtimeStatus === 'CONNECTING'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      realtimeStatus === 'SUBSCRIBED'
                        ? 'bg-emerald-500 animate-ping'
                        : realtimeStatus === 'CONNECTING'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span>
                    {realtimeStatus === 'SUBSCRIBED'
                      ? 'REALTIME TERHUBUNG (SUBSCRIBED)'
                      : realtimeStatus === 'CONNECTING'
                      ? 'MENGHUBUNGKAN REALTIME...'
                      : realtimeStatus === 'OFFLINE'
                      ? 'REALTIME OFFLINE'
                      : `STATUS: ${realtimeStatus}`}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Mendengarkan event perubahan data (<code className="font-mono text-slate-800 font-bold">postgres_changes</code>) secara dua arah untuk seluruh 7 tabel utama. Data nilai, lembar jawab siswa, paket ujian, butir soal, dan profil otomatis ter-update tanpa reload.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isPingingRealtime}
              onClick={async () => {
                setIsPingingRealtime(true);
                await sendRealtimePing();
                setTimeout(() => setIsPingingRealtime(false), 800);
              }}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Zap className={`w-3.5 h-3.5 ${isPingingRealtime ? 'animate-bounce' : ''}`} />
              <span>{isPingingRealtime ? 'Mengirim Ping...' : 'Uji Sinyal Realtime Ping'}</span>
            </button>
          </div>
        </div>

        {/* Realtime Metrics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-200 bg-white text-xs border-b border-slate-200">
          <div className="p-3.5">
            <span className="text-[11px] font-medium text-slate-500 block">Kanal / Channel Supabase</span>
            <span className="font-mono font-bold text-slate-900 mt-0.5 block truncate">
              cbt-live-sync (public)
            </span>
          </div>

          <div className="p-3.5">
            <span className="text-[11px] font-medium text-slate-500 block">Total Event Diterima</span>
            <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5 block tabular-nums">
              {realtimeEventsCount} Transaksi Live
            </span>
          </div>

          <div className="p-3.5">
            <span className="text-[11px] font-medium text-slate-500 block">Tabel Dipublikasikan</span>
            <span className="font-bold text-blue-700 mt-0.5 block">
              7 Tabel (Full Identity)
            </span>
          </div>

          <div className="p-3.5">
            <span className="text-[11px] font-medium text-slate-500 block">Aktivitas Realtime Terakhir</span>
            <span className="font-mono text-[11px] text-slate-700 mt-0.5 block truncate">
              {lastRealtimeEvent
                ? `${new Date(lastRealtimeEvent.timestamp).toLocaleTimeString('id-ID')} · ${lastRealtimeEvent.table}`
                : 'Belum ada transaksi live'}
            </span>
          </div>
        </div>

        {/* Live Event Stream / Log Preview */}
        {realtimeLogs.length > 0 && (
          <div className="p-4 bg-slate-900 text-slate-200 text-xs">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
              <span className="font-mono font-semibold text-emerald-400 flex items-center gap-1.5 text-[11px]">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Live Realtime Feed (Sinkronisasi Data Dua Arah)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Menampilkan {Math.min(realtimeLogs.length, 5)} event terbaru
              </span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              {realtimeLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center gap-2 py-0.5 border-b border-slate-800/50 last:border-none"
                >
                  <span className="text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      log.eventType === 'INSERT'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : log.eventType === 'UPDATE'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : log.eventType === 'DELETE'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    }`}
                  >
                    {log.eventType}
                  </span>
                  <span className="text-amber-300 font-semibold">{log.table}</span>
                  <span className="text-slate-300 truncate">{log.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Database & Table Health Check + Auto Provisioning Settings Panel */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                allTablesReady
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Pengecekan Struktur Tabel & Penambahan Tabel Otomatis (Auto-Provisioning)
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    allTablesReady
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {readyTablesCount} / {tableHealth.length || 7} Tabel Siap
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Memeriksa apakah seluruh tabel dan kolom baru (seperti kolom{' '}
                <code className="font-mono text-slate-700">password</code> pada{' '}
                <code className="font-mono text-slate-700">public.users</code> &{' '}
                <code className="font-mono text-slate-700">public.students</code> serta tabel{' '}
                <code className="font-mono text-slate-700">public.app_settings</code>) sudah
                tersedia di Supabase.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isSyncingSupabase}
              onClick={() => void refreshFromSupabase()}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin' : ''}`}
              />
              <span>Cek Database & Tabel Terlebih Dahulu</span>
            </button>

            <button
              type="button"
              disabled={isSyncingSupabase}
              onClick={() => void checkAndAutoCreateTables()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Wrench
                className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin' : ''}`}
              />
              <span>Buat & Sinkronkan Tabel Otomatis ke Database</span>
            </button>
          </div>
        </div>

        {/* Auto-Provisioning Settings Bar */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Settings2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-bold">Pengaturan Otomatisasi Database:</span>
            <span className="text-slate-600">
              Cek kesehatan tabel & jalankan auto-provisioning + seeding otomatis saat aplikasi
              dimuat
            </span>
          </div>

          <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCheckOnStartup}
              onChange={(e) => handleToggleAutoCheck(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-bold text-slate-800">
              {autoCheckOnStartup ? 'Aktif (Otomatis)' : 'Manual'}
            </span>
          </label>
        </div>

        {/* Table Health Status Grid */}
        <div className="p-5">
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-bold">Nama Tabel PostgreSQL</th>
                  <th className="py-2.5 px-4 font-bold">Menu Terkait</th>
                  <th className="py-2.5 px-4 font-bold">Status Tabel</th>
                  <th className="py-2.5 px-4 font-bold">Pengecekan Kolom Khusus</th>
                  <th className="py-2.5 px-4 font-bold text-right">Baris di Supabase</th>
                  <th className="py-2.5 px-4 font-bold text-right">Baris di Aplikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tableHealth.map((th) => {
                  const localCount = tableCounts[th.tableName] ?? 0;
                  const needsPasswordFix = th.exists && th.hasPasswordColumn === false;
                  return (
                    <tr key={th.tableName} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                        {th.tableName}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">
                        {th.menuLabel}
                      </td>
                      <td className="py-2.5 px-4">
                        {th.exists ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Tabel Tersedia</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Belum Dibuat</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {th.shortName === 'users' || th.shortName === 'students' ? (
                          th.hasPasswordColumn ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Kolom password aktif</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>
                                {needsPasswordFix
                                  ? 'Kolom password belum ditambahkan'
                                  : 'Menunggu pembuatan tabel'}
                              </span>
                            </span>
                          )
                        ) : (
                          <span className="text-slate-500">Struktur standar</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800 text-right tabular-nums">
                        {th.exists ? `${th.rowCount} baris` : '-'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 text-right tabular-nums">
                        {localCount} baris
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Table Schema Inspector */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Struktur Tabel Database CBT (7 Tabel Utama & 1 View Leger)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih tabel di bawah untuk melihat daftar kolom, tipe data PostgreSQL, dan
              relasi Foreign Key.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-600 tabular-nums">
            Total Rekaman Aktif:{' '}
            <strong>
              {1 +
                classes.length +
                users.length +
                sessions.length +
                exams.length +
                questions.length}{' '}
              baris
            </strong>
          </div>
        </div>

        {/* Segmented Table Selector Buttons */}
        <div className="px-5 pt-4 pb-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2">
          {SUPABASE_TABLES_METADATA.map((tbl, idx) => {
            const isSelected = idx === selectedTableIndex;
            const rowCount = tableCounts[tbl.tableName] ?? 0;
            return (
              <button
                key={tbl.tableName}
                type="button"
                onClick={() => setSelectedTableIndex(idx)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="font-mono">{tbl.tableName}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    isSelected ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  ({rowCount})
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Table Columns Detail */}
        {activeTable && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {activeTable.tableName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-blue-700">
                    {activeTable.menuName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {tableCounts[activeTable.tableName] ?? 0} baris data
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{activeTable.description}</p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-4 font-bold">Nama Kolom</th>
                    <th className="py-2.5 px-4 font-bold">Tipe Data PostgreSQL</th>
                    <th className="py-2.5 px-4 font-bold">Aturan / Indeks / Relasi</th>
                    <th className="py-2.5 px-4 font-bold">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeTable.columns.map((col) => (
                    <tr key={col.name} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                        {col.name}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold">
                        {col.type}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {col.constraints}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{col.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SQL Migration & Seeding Code Viewer */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileCode2 className="w-5 h-5 text-blue-700 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Skrip SQL Migrasi & Seed Data Supabase
              </h3>
              <p className="text-xs text-slate-500">
                File sumber:{' '}
                <code className="font-mono text-slate-700">
                  supabase/migrations/001_initial_cbt_schema.sql
                </code>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setSqlViewMode('ddl')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  sqlViewMode === 'ddl'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Skema Tabel (DDL)
              </button>
              <button
                type="button"
                onClick={() => setSqlViewMode('seed')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  sqlViewMode === 'seed'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Skema + Data Awal (DDL + INSERT)
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadSql}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh .SQL</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopySql()}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Skrip SQL</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-slate-950 text-slate-100 p-5 overflow-x-auto max-h-[480px] overflow-y-auto">
          <pre className="font-mono text-xs leading-relaxed select-all">
            {activeSqlContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
