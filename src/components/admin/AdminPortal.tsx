import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  BookOpen,
  Users,
  ClipboardCheck,
  Building2,
  LogOut,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  KeyRound,
  X,
  MonitorCheck,
  Database,
  Shield,
  CreditCard,
  FileText,
  Settings,
  Calendar,
  Menu,
  Radio,
  Zap,
  BarChart3,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import {
  ExamPackage,
  ExamStatus,
} from '../../types/cbt';
import {
  canStudentAccessExam,
  extractTingkatFromText,
  TingkatAngkatan,
} from '../../utils/examAccess';
import { ClassManagementTab } from './ClassManagementTab';
import { StudentManagementTab } from './StudentManagementTab';
import { UserManagementTab } from './UserManagementTab';
import { GradeManagementTab } from './GradeManagementTab';
import { ExamCardsTab } from './ExamCardsTab';
import { GradeReportTab } from './GradeReportTab';
import { AppSettingsTab } from './AppSettingsTab';
import { DatabaseSupabaseTab } from './DatabaseSupabaseTab';
import { QuestionBankTab } from './QuestionBankTab';
import { ExamVisualSummary } from './ExamVisualSummary';

type AdminTab =
  | 'dashboard'
  | 'analytics'
  | 'classes'
  | 'students'
  | 'users'
  | 'exam_cards'
  | 'grades'
  | 'grade_report'
  | 'exams'
  | 'questions'
  | 'app_settings'
  | 'database';

export const AdminPortal: React.FC = () => {
  const {
    appSettings,
    currentUser,
    logout,
    classes,
    exams,
    questions,
    sessions,
    users,
    addExam,
    updateExam,
    deleteExam,
    regenerateExamToken,
    getQuestionsByExam,
    showToast,
    realtimeStatus,
    realtimeEventsCount,
  } = useCBT();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [studentClassFilter, setStudentClassFilter] = useState<string>('ALL');
  const [examAngkatanFilter, setExamAngkatanFilter] = useState<'ALL' | TingkatAngkatan>('ALL');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Exam Modal State
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamPackage | null>(null);
  const [examForm, setExamForm] = useState({
    code: '',
    title: '',
    subject: '',
    kelasTarget: 'Semua Kelas XII',
    examDate: new Date().toISOString().slice(0, 10),
    startTime: '08:00',
    endTime: '09:30',
    durationMinutes: 45,
    passingScore: 75,
    status: 'active' as ExamStatus,
    token: '',
    showExplanationAfterSubmit: true,
    instructionsText:
      'Berdoalah sebelum memulai pengerjaan soal.\nPeriksa kelengkapan nomor soal dan waktu ujian.\nDilarang berpindah tab selama sesi berlangsung.',
  });

  // Question Bank State
  const [selectedExamIdForQ, setSelectedExamIdForQ] = useState<string>(
    exams[0]?.id || ''
  );

  if (!currentUser) return null;

  const studentUsers = users.filter((u) => u.role === 'siswa');
  const staffUsers = users.filter(
    (u) => u.role === 'admin' || u.role === 'guru' || u.role === 'proktor'
  );
  const completedSessions = sessions.filter(
    (s) => s.status === 'completed' || s.status === 'timed_out'
  );
  const activeSessions = sessions.filter((s) => s.status === 'in_progress');
  const globalAvgScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((acc, s) => acc + s.score, 0) /
            completedSessions.length
        )
      : 0;

  // Handlers for Exam Modal
  const openCreateExamModal = () => {
    setEditingExam(null);
    const todayIso = new Date().toISOString().slice(0, 10);
    setExamForm({
      code: `CBT-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      subject: '',
      kelasTarget: 'Semua Kelas XII',
      examDate: todayIso,
      startTime: '08:00',
      endTime: '09:00',
      durationMinutes: 60,
      passingScore: 75,
      status: 'active',
      token: '',
      showExplanationAfterSubmit: true,
      instructionsText:
        'Berdoalah sebelum memulai pengerjaan soal.\nPeriksa kelengkapan nomor soal dan waktu ujian.\nDilarang berpindah tab selama sesi berlangsung.',
    });
    setExamModalOpen(true);
  };

  const openEditExamModal = (exam: ExamPackage) => {
    setEditingExam(exam);
    setExamForm({
      code: exam.code,
      title: exam.title,
      subject: exam.subject,
      kelasTarget: exam.kelasTarget,
      examDate: exam.examDate || new Date().toISOString().slice(0, 10),
      startTime: exam.startTime || '08:00',
      endTime: exam.endTime || '09:00',
      durationMinutes: exam.durationMinutes,
      passingScore: exam.passingScore,
      status: exam.status,
      token: exam.token,
      showExplanationAfterSubmit: exam.showExplanationAfterSubmit,
      instructionsText: exam.instructions.join('\n'),
    });
    setExamModalOpen(true);
  };

  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    const instructions = examForm.instructionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (editingExam) {
      updateExam(editingExam.id, {
        code: examForm.code,
        title: examForm.title,
        subject: examForm.subject,
        kelasTarget: examForm.kelasTarget,
        examDate: examForm.examDate || undefined,
        startTime: examForm.startTime || undefined,
        endTime: examForm.endTime || undefined,
        durationMinutes: Number(examForm.durationMinutes),
        passingScore: Number(examForm.passingScore),
        status: examForm.status,
        token: examForm.token.toUpperCase() || editingExam.token,
        showExplanationAfterSubmit: examForm.showExplanationAfterSubmit,
        instructions,
      });
    } else {
      const created = addExam({
        code: examForm.code,
        title: examForm.title,
        subject: examForm.subject,
        kelasTarget: examForm.kelasTarget,
        examDate: examForm.examDate || undefined,
        startTime: examForm.startTime || undefined,
        endTime: examForm.endTime || undefined,
        durationMinutes: Number(examForm.durationMinutes),
        passingScore: Number(examForm.passingScore),
        status: examForm.status,
        token: examForm.token,
        showExplanationAfterSubmit: examForm.showExplanationAfterSubmit,
        instructions,
      });
      setSelectedExamIdForQ(created.id);
    }
    setExamModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Left Sidebar Navigation */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="h-16 px-4 sm:px-6 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#1D4ED8] text-white flex items-center justify-center shadow-2xs shrink-0">
                <MonitorCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-sm tracking-tight truncate">
                  {appSettings.appName}
                </div>
                <div className="text-[11px] font-mono text-blue-700 font-semibold truncate">
                  {appSettings.schoolName}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
              aria-label="Toggle Menu Navigasi"
            >
              {mobileNavOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
              <span>Menu</span>
            </button>
          </div>

          {/* Nav Items */}
          <nav
            className={`${
              mobileNavOpen ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
            } p-3 gap-1.5`}
          >
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Utama & Master Data
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('dashboard');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Ringkasan & Token</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('analytics');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Statistik & Grafik</span>
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                Visual
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('classes');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'classes'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Data Kelas</span>
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {classes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStudentClassFilter('ALL');
                setActiveTab('students');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Users className="w-4 h-4 shrink-0" />
                <span>Data Siswa</span>
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {studentUsers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('users');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Manajemen User</span>
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                {staffUsers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('exam_cards');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'exam_cards'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Kartu Ujian</span>
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                Cetak
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('grades');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'grades'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Data Nilai</span>
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {sessions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('grade_report');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'grade_report'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Cetak Laporan Nilai</span>
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Ekspor
              </span>
            </button>

            <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Manajemen Ujian CBT
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('exams');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'exams'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span>Paket & Jadwal Ujian</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('questions');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'questions'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Bank Soal & Kunci</span>
            </button>

            <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sistem & Database
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('app_settings');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'app_settings'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Pengaturan Aplikasi</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('database');
                setMobileNavOpen(false);
              }}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'database'
                  ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Database className="w-4 h-4 shrink-0" />
                <span>Database Supabase</span>
              </span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${
                  realtimeStatus === 'SUBSCRIBED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : realtimeStatus === 'CONNECTING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {realtimeStatus === 'SUBSCRIBED' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                )}
                <span>{realtimeStatus === 'SUBSCRIBED' ? 'Realtime' : '7 Tabel'}</span>
              </span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer: Admin Profile */}
        <div className="hidden lg:block p-4 border-t border-slate-200 space-y-3 bg-slate-50/50">
          <div className="px-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-900 truncate">
                {currentUser.name}
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-100 text-indigo-800">
                {currentUser.role}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              {currentUser.nomorPeserta}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={logout}
              className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Panel</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="min-h-16 py-2 bg-white border-b border-slate-200 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold text-slate-900 truncate">
              {activeTab === 'dashboard' &&
                'Ringkasan Eksekutif & Kontrol Token CBT'}
              {activeTab === 'analytics' &&
                'Visualisasi Data Statistik & Grafik Evaluasi CBT'}
              {activeTab === 'classes' &&
                'Manajemen Data Kelas & Rombongan Belajar'}
              {activeTab === 'students' &&
                'Manajemen Data Siswa & Kartu Peserta CBT'}
              {activeTab === 'users' &&
                'Manajemen User Aparatur (Admin, Guru & Proktor)'}
              {activeTab === 'exam_cards' &&
                'Cetak Massal Kartu Ujian Peserta CBT'}
              {activeTab === 'grades' &&
                'Manajemen Data Nilai & Leger Evaluasi CBT'}
              {activeTab === 'grade_report' &&
                'Cetak & Ekspor Laporan Nilai Ujian Siswa'}
              {activeTab === 'exams' && 'Manajemen Paket & Jadwal Ujian'}
              {activeTab === 'questions' && 'Manajemen Bank Soal & Pembahasan'}
              {activeTab === 'app_settings' &&
                'Pengaturan Identitas Aplikasi & Sekolah'}
              {activeTab === 'database' &&
                'Koneksi & Skema Tabel PostgreSQL Supabase'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Realtime Supabase Status Pill */}
            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                realtimeStatus === 'SUBSCRIBED'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : realtimeStatus === 'CONNECTING'
                  ? 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
                  : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title={`Status Realtime: ${realtimeStatus}. Klik untuk membuka pengaturan database.`}
            >
              {realtimeStatus === 'SUBSCRIBED' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Realtime Supabase Aktif</span>
                  <span className="font-mono text-[10px] bg-emerald-200/80 px-1.5 py-0.2 rounded text-emerald-900 font-bold">
                    {realtimeEventsCount}
                  </span>
                </>
              ) : realtimeStatus === 'CONNECTING' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                  <span>Menghubungkan Realtime...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  <span>Realtime Offline</span>
                </>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span className="tabular-nums">
                {activeSessions.length} Peserta Sedang Ujian
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="lg:hidden px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Tab Views */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* ==================== TAB: DATA KELAS ==================== */}
          {activeTab === 'classes' && (
            <ClassManagementTab
              onNavigateToStudentsWithClass={(namaKelas) => {
                setStudentClassFilter(namaKelas);
                setActiveTab('students');
              }}
            />
          )}

          {/* ==================== TAB: DATA SISWA ==================== */}
          {activeTab === 'students' && (
            <StudentManagementTab initialClassFilter={studentClassFilter} />
          )}

          {/* ==================== TAB: MANAJEMEN USER (ADMIN, GURU, PROKTOR) ==================== */}
          {activeTab === 'users' && <UserManagementTab />}

          {/* ==================== TAB: KARTU UJIAN ==================== */}
          {activeTab === 'exam_cards' && <ExamCardsTab />}

          {/* ==================== TAB: DATA NILAI ==================== */}
          {activeTab === 'grades' && <GradeManagementTab />}

          {/* ==================== TAB: CETAK LAPORAN NILAI ==================== */}
          {activeTab === 'grade_report' && <GradeReportTab />}

          {/* ==================== TAB: ANALISIS & VISUALISASI DATA ==================== */}
          {activeTab === 'analytics' && (
            <ExamVisualSummary
              onNavigateToGrades={(examId) => setActiveTab('grades')}
              onNavigateToExams={() => setActiveTab('exams')}
            />
          )}

          {/* ==================== TAB: PENGATURAN APLIKASI ==================== */}
          {activeTab === 'app_settings' && <AppSettingsTab />}

          {/* ==================== TAB: DATABASE SUPABASE ==================== */}
          {activeTab === 'database' && <DatabaseSupabaseTab />}

          {/* ==================== TAB: DASHBOARD ==================== */}
          {activeTab === 'dashboard' && (
            <>
              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => setActiveTab('classes')}
                  className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 transition-colors shadow-2xs cursor-pointer"
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Data Kelas / Rombel
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-mono font-extrabold text-slate-900 tabular-nums">
                      {classes.length}
                    </span>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Kelola Kelas →
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('students')}
                  className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 transition-colors shadow-2xs cursor-pointer"
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Data Siswa Terdaftar
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-mono font-extrabold text-slate-900 tabular-nums">
                      {studentUsers.length}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Kelola Siswa →
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('exams')}
                  className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 transition-colors shadow-2xs cursor-pointer"
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Paket & Bank Soal
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-mono font-extrabold text-slate-900 tabular-nums">
                      {exams.length}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {questions.length} Butir Soal
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('grades')}
                  className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 transition-colors shadow-2xs cursor-pointer"
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Rata-Rata Data Nilai
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-3xl font-mono font-extrabold text-blue-700 tabular-nums">
                      {globalAvgScore}
                    </span>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Leger Nilai →
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual Data Summary & Interactive Charts */}
              <ExamVisualSummary
                onNavigateToGrades={(examId) => setActiveTab('grades')}
                onNavigateToExams={() => setActiveTab('exams')}
              />

              {/* Token Control Center & Recent Sessions Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Active Exam Tokens Panel */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-blue-600" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Kontrol Token Sesi Ujian
                      </h2>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {exams.map((ex) => (
                      <div
                        key={ex.id}
                        className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-500">
                              {ex.code}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                ex.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {ex.status}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-slate-900 truncate mt-0.5">
                            {ex.subject}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 font-mono font-extrabold text-sm text-blue-700 tracking-widest">
                            {ex.token}
                          </span>
                          <button
                            type="button"
                            title="Acak Token Baru"
                            onClick={() => regenerateExamToken(ex.id)}
                            className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live & Recent Student Activity */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Rekap Nilai & Aktivitas Peserta Terbaru
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('grades')}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      Buka Menu Data Nilai →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-4">Peserta</th>
                          <th className="py-3 px-4">Mata Uji</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right">Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {sessions.slice(0, 6).map((s) => {
                          const ex = exams.find((e) => e.id === s.examId);
                          return (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">
                                  {s.studentName}
                                </div>
                                <div className="font-mono text-[11px] text-slate-500">
                                  {s.studentKelas} • {s.studentNomorPeserta}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-700">
                                {ex?.subject || '-'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {s.status === 'in_progress' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                                    <Clock className="w-3 h-3" />
                                    <span>Mengerjakan</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Selesai</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-extrabold text-sm text-slate-900 tabular-nums">
                                {s.score}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ==================== TAB: EXAMS MANAGEMENT ==================== */}
          {activeTab === 'exams' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Daftar Paket & Jadwal Pelaksanaan Ujian CBT (Isolasi Akses Per Angkatan)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Soal dan jadwal ujian otomatis dikunci sesuai target angkatan (Kelas X, XI, atau XII) sehingga tidak bercampur antar-angkatan pada portal siswa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateExamModal}
                    className="px-4 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>Tambah Paket & Jadwal Ujian</span>
                  </button>
                </div>

                {/* Segmented Filter by Angkatan (Kelas X, XI, XII) */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        { id: 'ALL', label: `Semua Angkatan (${exams.length})` },
                        {
                          id: 'X',
                          label: `Angkatan Kelas X (${
                            exams.filter((e) => extractTingkatFromText(e.kelasTarget, classes) === 'X').length
                          })`,
                        },
                        {
                          id: 'XI',
                          label: `Angkatan Kelas XI (${
                            exams.filter((e) => extractTingkatFromText(e.kelasTarget, classes) === 'XI').length
                          })`,
                        },
                        {
                          id: 'XII',
                          label: `Angkatan Kelas XII (${
                            exams.filter((e) => extractTingkatFromText(e.kelasTarget, classes) === 'XII').length
                          })`,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setExamAngkatanFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          examAngkatanFilter === tab.id
                            ? 'bg-white text-blue-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">
                    Siswa hanya melihat jadwal yang sesuai dengan tingkat angkatan kelasnya.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exams
                  .filter((ex) => {
                    if (examAngkatanFilter === 'ALL') return true;
                    return extractTingkatFromText(ex.kelasTarget, classes) === examAngkatanFilter;
                  })
                  .map((ex) => {
                    const examQs = getQuestionsByExam(ex.id);
                    const qCount = examQs.length;
                    const pgCount = examQs.filter((q) => q.questionType !== 'esai').length;
                    const esaiCount = examQs.filter((q) => q.questionType === 'esai').length;
                    const examTingkat = extractTingkatFromText(ex.kelasTarget, classes);
                    const eligibleStudentCount = studentUsers.filter((stu) =>
                      canStudentAccessExam(stu, ex, classes)
                    ).length;
                    return (
                      <div
                        key={ex.id}
                        className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {ex.code}
                              </span>
                              {examTingkat && (
                                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                                  Khusus Angkatan {examTingkat}
                                </span>
                              )}
                              <span
                                className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded ${
                                  ex.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : ex.status === 'draft'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {ex.status === 'active'
                                  ? 'Aktif'
                                  : ex.status === 'draft'
                                  ? 'Draft'
                                  : 'Ditutup'}
                              </span>
                            </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditExamModal(ex)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              title="Edit Paket & Jadwal Ujian"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Edit & Jadwal</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteExam(ex.id)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600 cursor-pointer"
                              title="Hapus Paket Ujian"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            {ex.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Mata Pelajaran: <strong>{ex.subject}</strong> · Target Akses:{' '}
                            <strong className="text-blue-700">{ex.kelasTarget}</strong>{' '}
                            <span className="font-mono text-slate-500">
                              ({eligibleStudentCount} siswa berhak akses)
                            </span>
                          </p>
                        </div>

                        {/* Jadwal Pelaksanaan Banner (Tanggal, Jam Mulai - Jam Berakhir) */}
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 text-slate-700">
                            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>
                              Tanggal:{' '}
                              <strong className="font-mono text-slate-900">
                                {ex.examDate
                                  ? new Date(`${ex.examDate}T00:00:00`).toLocaleDateString(
                                      'id-ID',
                                      {
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      }
                                    )
                                  : 'Belum Dijadwalkan'}
                              </strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>
                              {ex.startTime && ex.endTime
                                ? `${ex.startTime} – ${ex.endTime} WIB`
                                : 'Waktu Fleksibel'}
                            </span>
                          </div>
                        </div>

                        {/* Status Pengaturan Pembahasan Soal */}
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-slate-700">Pembahasan Soal Siswa:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {ex.showExplanationAfterSubmit ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Diaktifkan (Bisa Dilihat)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>Dinonaktifkan (Terkunci)</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                            <div className="text-[10px] uppercase text-slate-400 font-semibold">
                              Soal (PG/Esai)
                            </div>
                            <div className="font-mono font-bold text-xs sm:text-sm text-slate-800 tabular-nums">
                              {qCount} ({pgCount}/{esaiCount})
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                            <div className="text-[10px] uppercase text-slate-400 font-semibold">
                              Durasi
                            </div>
                            <div className="font-mono font-bold text-sm text-slate-800 tabular-nums">
                              {ex.durationMinutes}m
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                            <div className="text-[10px] uppercase text-slate-400 font-semibold">
                              KKM
                            </div>
                            <div className="font-mono font-bold text-sm text-slate-800 tabular-nums">
                              {ex.passingScore}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                            <div className="text-[10px] uppercase text-blue-600 font-semibold">
                              Token
                            </div>
                            <div className="font-mono font-extrabold text-sm text-blue-800">
                              {ex.token}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => regenerateExamToken(ex.id)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                            <span>Perbarui Token</span>
                          </button>

                          {/* Quick Toggle Pembahasan Soal */}
                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !ex.showExplanationAfterSubmit;
                              updateExam(ex.id, { showExplanationAfterSubmit: nextState });
                              showToast(
                                nextState ? 'Pembahasan Diaktifkan' : 'Pembahasan Dinonaktifkan',
                                `Pembahasan untuk paket [${ex.code}] ${ex.title} berhasil di${
                                  nextState ? 'aktifkan' : 'nonaktifkan'
                                }.`,
                                nextState ? 'success' : 'info'
                              );
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                              ex.showExplanationAfterSubmit
                                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                            title="Klik untuk mengubah akses pembahasan soal bagi siswa"
                          >
                            <BookOpen className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {ex.showExplanationAfterSubmit
                                ? 'Matikan Pembahasan'
                                : 'Buka Pembahasan'}
                            </span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExamIdForQ(ex.id);
                            setActiveTab('questions');
                          }}
                          className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          <span>Kelola Bank Soal ({qCount})</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== TAB: QUESTION BANK ==================== */}
          {activeTab === 'questions' && (
            <QuestionBankTab
              selectedExamId={selectedExamIdForQ}
              onSelectExamId={setSelectedExamIdForQ}
            />
          )}
        </main>
      </div>

      {/* ==================== MODAL: CREATE / EDIT EXAM ==================== */}
      {examModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {editingExam ? 'Edit Konfigurasi Paket Ujian' : 'Buat Paket Ujian Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setExamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Kode Ujian
                  </label>
                  <input
                    type="text"
                    required
                    value={examForm.code}
                    onChange={(e) =>
                      setExamForm({ ...examForm, code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    required
                    value={examForm.subject}
                    onChange={(e) =>
                      setExamForm({ ...examForm, subject: e.target.value })
                    }
                    placeholder="Contoh: Fisika Peminatan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Judul Lengkap Paket Ujian
                </label>
                <input
                  type="text"
                  required
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  placeholder="Contoh: Ujian Satuan Pendidikan Fisika & Mekanika"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              {/* Pengaturan Jadwal Ujian: Tanggal, Jam Mulai & Jam Berakhir */}
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Jadwal Pelaksanaan Ujian</span>
                  </div>
                  <span className="text-[11px] font-mono text-blue-700">
                    Tanggal, Jam Mulai & Jam Berakhir
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1">
                      Tanggal Ujian
                    </label>
                    <input
                      type="date"
                      required
                      value={examForm.examDate}
                      onChange={(e) =>
                        setExamForm({ ...examForm, examDate: e.target.value })
                      }
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1">
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      required
                      value={examForm.startTime}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        let newDuration = examForm.durationMinutes;
                        if (newStart && examForm.endTime) {
                          const [sh, sm] = newStart.split(':').map(Number);
                          const [eh, em] = examForm.endTime.split(':').map(Number);
                          const diff = eh * 60 + em - (sh * 60 + sm);
                          if (diff >= 5 && diff <= 300) {
                            newDuration = diff;
                          }
                        }
                        setExamForm({
                          ...examForm,
                          startTime: newStart,
                          durationMinutes: newDuration,
                        });
                      }}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-700 mb-1">
                      Jam Berakhir
                    </label>
                    <input
                      type="time"
                      required
                      value={examForm.endTime}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        let newDuration = examForm.durationMinutes;
                        if (examForm.startTime && newEnd) {
                          const [sh, sm] = examForm.startTime.split(':').map(Number);
                          const [eh, em] = newEnd.split(':').map(Number);
                          const diff = eh * 60 + em - (sh * 60 + sm);
                          if (diff >= 5 && diff <= 300) {
                            newDuration = diff;
                          }
                        }
                        setExamForm({
                          ...examForm,
                          endTime: newEnd,
                          durationMinutes: newDuration,
                        });
                      }}
                      className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    required
                    value={examForm.durationMinutes}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        durationMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Ambang KKM
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={examForm.passingScore}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        passingScore: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Status Sesi
                  </label>
                  <select
                    value={examForm.status}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        status: e.target.value as ExamStatus,
                      })
                    }
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="active">Aktif</option>
                    <option value="draft">Draft</option>
                    <option value="closed">Ditutup</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Token (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={examForm.token}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        token: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Otomatis"
                    className="w-full px-3 py-2 font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Target Angkatan & Kelas / Rombel (Isolasi Akses Jadwal Siswa)
                </label>
                <select
                  value={examForm.kelasTarget}
                  onChange={(e) =>
                    setExamForm({ ...examForm, kelasTarget: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  <optgroup label="Per Angkatan Kelas (Seluruh Rombel Angkatan)">
                    <option value="Semua Kelas X">Semua Kelas X (Khusus Angkatan Kelas X)</option>
                    <option value="Semua Kelas XI">Semua Kelas XI (Khusus Angkatan Kelas XI)</option>
                    <option value="Semua Kelas XII">Semua Kelas XII (Khusus Angkatan Kelas XII)</option>
                  </optgroup>
                  <optgroup label="Per Angkatan & Jurusan">
                    <option value="Semua Kelas X MIPA">Semua Kelas X MIPA</option>
                    <option value="Semua Kelas X IPS">Semua Kelas X IPS</option>
                    <option value="Semua Kelas XI MIPA">Semua Kelas XI MIPA</option>
                    <option value="Semua Kelas XI IPS">Semua Kelas XI IPS</option>
                    <option value="Semua Kelas XII MIPA">Semua Kelas XII MIPA</option>
                    <option value="Semua Kelas XII IPS">Semua Kelas XII IPS</option>
                  </optgroup>
                  <optgroup label="Rombel / Kelas Spesifik">
                    {classes.map((c) => (
                      <option key={c.id} value={c.namaKelas}>
                        Kelas {c.namaKelas} (Angkatan {c.tingkat})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Paket soal dan jadwal ujian ini hanya akan muncul dan dapat diakses oleh siswa yang sesuai dengan target angkatan/kelas di atas.
                </p>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Petunjuk Pengerjaan (Satu baris per poin)
                </label>
                <textarea
                  rows={3}
                  value={examForm.instructionsText}
                  onChange={(e) =>
                    setExamForm({ ...examForm, instructionsText: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              {/* Pengaturan Pembahasan Soal (Enable / Disable) */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-700" />
                    <span className="font-bold text-sm text-blue-950">
                      Pengaturan Akses Pembahasan Soal
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      examForm.showExplanationAfterSubmit
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {examForm.showExplanationAfterSubmit ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Pembahasan Aktif</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                        <span>Pembahasan Dinonaktifkan</span>
                      </>
                    )}
                  </span>
                </div>

                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-blue-400 transition-colors">
                  <input
                    type="checkbox"
                    checked={examForm.showExplanationAfterSubmit}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        showExplanationAfterSubmit: e.target.checked,
                      })
                    }
                    className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-slate-900">
                      Izinkan Siswa Melihat Kunci Jawaban & Pembahasan Setelah Ujian Selesai
                    </div>
                    <p className="text-slate-500 leading-relaxed">
                      Bila dicentang (<strong>Aktif</strong>), siswa dapat meninjau analisis butir soal, kunci pilihan ganda/esai, dan uraian pembahasan lengkap. Bila dinonaktifkan (<strong>Nonaktif</strong>), siswa hanya dapat melihat skor akhir dan status kelulusan KKM.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setExamModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold cursor-pointer"
                >
                  Simpan Paket Ujian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
