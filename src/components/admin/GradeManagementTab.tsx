import React, { useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Search,
  Download,
  Plus,
  Edit3,
  Eye,
  RotateCcw,
  CheckCircle2,
  Clock,
  ShieldAlert,
  X,
  BookOpen,
  Database,
  UploadCloud,
  RefreshCw,
  Upload,
  AlertCircle,
  SlidersHorizontal,
  ArrowUpDown,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { ExamSession } from '../../types/cbt';
import { findMatchingStudentForSession, integrateSessionWithStudents } from '../../lib/supabase';
import { canStudentAccessExam, extractTingkatFromText } from '../../utils/examAccess';

function getGradePredicate(score: number): { code: string; label: string; textClass: string } {
  if (score >= 90) {
    return {
      code: 'A',
      label: 'A (Sangat Baik)',
      textClass: 'text-emerald-700',
    };
  }
  if (score >= 80) {
    return {
      code: 'B',
      label: 'B (Baik)',
      textClass: 'text-blue-700',
    };
  }
  if (score >= 70) {
    return {
      code: 'C',
      label: 'C (Cukup)',
      textClass: 'text-amber-700',
    };
  }
  return {
    code: 'D',
    label: 'D (Kurang)',
    textClass: 'text-rose-700',
  };
}

type SortField = 'score_desc' | 'score_asc' | 'name_asc' | 'kelas_asc';

export const GradeManagementTab: React.FC = () => {
  const {
    sessions,
    exams,
    classes,
    users,
    getQuestionsByExam,
    resetStudentSession,
    updateSessionScore,
    addManualGradeSession,
    updateExam,
    showToast,
    deviceSavedSessions,
    unsyncedDeviceSessionIds,
    isSyncingDeviceScores,
    autoSyncDeviceScores,
    setAutoSyncDeviceScores,
    syncDeviceSessionsToServer,
    importDeviceSessionsBackup,
    isSyncingSupabase,
  } = useCBT();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterExamId, setFilterExamId] = useState<string>('ALL');
  const [filterKelas, setFilterKelas] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'PASSED' | 'REMEDIAL' | 'IN_PROGRESS'
  >('ALL');
  const [sortBy, setSortBy] = useState<SortField>('score_desc');
  const [showSyncPanel, setShowSyncPanel] = useState<boolean>(true);

  const [inspectSessionId, setInspectSessionId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);

  // Edit score form
  const [scoreForm, setScoreForm] = useState({
    score: 80,
    correctCount: 0,
    wrongCount: 0,
    unansweredCount: 0,
  });

  // Add manual grade form
  const studentUsers = useMemo(() => users.filter((u) => u.role === 'siswa'), [users]);
  const [manualForm, setManualForm] = useState({
    studentId: studentUsers[0]?.id || '',
    examId: exams[0]?.id || '',
    score: 85,
    correctCount: 7,
    wrongCount: 1,
  });

  // Reconcile all sessions with public.students (v_rekap_nilai <-> students integration)
  const integratedSessions = useMemo(
    () => sessions.map((s) => integrateSessionWithStudents(s, studentUsers).session),
    [sessions, studentUsers]
  );

  const matchedStudentsCount = useMemo(
    () =>
      integratedSessions.filter((s) =>
        Boolean(findMatchingStudentForSession(s, studentUsers))
      ).length,
    [integratedSessions, studentUsers]
  );

  const handleManualSyncDeviceScores = async () => {
    await syncDeviceSessionsToServer();
  };

  const handleImportDeviceBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = String(ev.target?.result || '');
        const parsed = JSON.parse(content);
        const list: ExamSession[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.sessions)
          ? parsed.sessions
          : [];
        await importDeviceSessionsBackup(list);
      } catch {
        showToast(
          'Format Berkas Tidak Valid',
          'Pastikan berkas yang dipilih adalah cadangan nilai berformat .JSON.',
          'error'
        );
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'CBT_v_rekap_nilai_backup',
      sessions: deviceSavedSessions.length > 0 ? deviceSavedSessions : integratedSessions,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cadangan_Nilai_Perangkat_v_rekap_nilai_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      'Cadangan Nilai Diunduh',
      'File JSON sesi ujian berhasil diunduh untuk pemulihan lintas perangkat.',
      'success'
    );
  };

  // Status counts for segmented tabs (respecting exam, class/angkatan, and search filters)
  const baseFilteredSessions = useMemo(() => {
    return integratedSessions.filter((s) => {
      const matchesExam = filterExamId === 'ALL' || s.examId === filterExamId;
      let matchesKelas = true;
      if (filterKelas === 'ANGKATAN_X') {
        matchesKelas = extractTingkatFromText(s.studentKelas, classes) === 'X';
      } else if (filterKelas === 'ANGKATAN_XI') {
        matchesKelas = extractTingkatFromText(s.studentKelas, classes) === 'XI';
      } else if (filterKelas === 'ANGKATAN_XII') {
        matchesKelas = extractTingkatFromText(s.studentKelas, classes) === 'XII';
      } else if (filterKelas !== 'ALL') {
        matchesKelas = s.studentKelas === filterKelas;
      }
      const matchesQuery =
        !searchQuery.trim() ||
        s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentNomorPeserta.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentKelas.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesExam && matchesKelas && matchesQuery;
    });
  }, [integratedSessions, filterExamId, filterKelas, classes, searchQuery]);

  const statusTabCounts = useMemo(() => {
    let passed = 0;
    let remedial = 0;
    let inProgress = 0;
    for (const s of baseFilteredSessions) {
      const ex = exams.find((e) => e.id === s.examId);
      const kkm = ex?.passingScore ?? 75;
      if (s.status === 'in_progress') {
        inProgress += 1;
      } else if (s.score >= kkm) {
        passed += 1;
      } else {
        remedial += 1;
      }
    }
    return {
      all: baseFilteredSessions.length,
      passed,
      remedial,
      inProgress,
    };
  }, [baseFilteredSessions, exams]);

  // Filtered & sorted sessions
  const filteredSessions = useMemo(() => {
    const list = baseFilteredSessions.filter((s) => {
      const ex = exams.find((e) => e.id === s.examId);
      const kkm = ex?.passingScore ?? 75;
      if (filterStatus === 'IN_PROGRESS') return s.status === 'in_progress';
      if (filterStatus === 'PASSED') return s.status !== 'in_progress' && s.score >= kkm;
      if (filterStatus === 'REMEDIAL') return s.status !== 'in_progress' && s.score < kkm;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'score_asc') return a.score - b.score;
      if (sortBy === 'name_asc') return a.studentName.localeCompare(b.studentName, 'id');
      if (sortBy === 'kelas_asc') {
        const cmp = a.studentKelas.localeCompare(b.studentKelas, 'id');
        return cmp !== 0 ? cmp : b.score - a.score;
      }
      return b.score - a.score;
    });
  }, [baseFilteredSessions, exams, filterStatus, sortBy]);

  const completedFiltered = filteredSessions.filter((s) => s.status !== 'in_progress');
  const avgScore =
    completedFiltered.length > 0
      ? Math.round(
          completedFiltered.reduce((acc, s) => acc + s.score, 0) /
            completedFiltered.length
        )
      : 0;
  const maxScore =
    completedFiltered.length > 0
      ? Math.max(...completedFiltered.map((s) => s.score))
      : 0;
  const minScore =
    completedFiltered.length > 0
      ? Math.min(...completedFiltered.map((s) => s.score))
      : 0;
  const passedCount = completedFiltered.filter((s) => {
    const ex = exams.find((e) => e.id === s.examId);
    return s.score >= (ex?.passingScore ?? 75);
  }).length;
  const remedialCount = completedFiltered.length - passedCount;
  const passRate =
    completedFiltered.length > 0
      ? Math.round((passedCount / completedFiltered.length) * 100)
      : 0;

  const openEditScoreModal = (ses: ExamSession) => {
    setEditingSession(ses);
    setScoreForm({
      score: ses.score,
      correctCount: ses.correctCount,
      wrongCount: ses.wrongCount,
      unansweredCount: ses.unansweredCount,
    });
  };

  const handleSaveScoreEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    updateSessionScore(editingSession.id, {
      score: Number(scoreForm.score),
      correctCount: Number(scoreForm.correctCount),
      wrongCount: Number(scoreForm.wrongCount),
      unansweredCount: Number(scoreForm.unansweredCount),
    });
    setEditingSession(null);
  };

  const handleSaveManualGrade = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addManualGradeSession({
      studentId: manualForm.studentId,
      examId: manualForm.examId,
      score: Number(manualForm.score),
      correctCount: Number(manualForm.correctCount),
      wrongCount: Number(manualForm.wrongCount),
    });
    if (!res.ok && res.message) {
      showToast('Gagal Menyimpan Nilai', res.message, 'error');
      return;
    }
    setManualModalOpen(false);
  };

  const handleExportGradesCSV = () => {
    const headers = [
      'Peringkat',
      'Nomor Peserta',
      'NISN',
      'Nama Lengkap Siswa',
      'Kelas',
      'Kode Ujian',
      'Mata Pelajaran',
      'Benar',
      'Salah',
      'Kosong',
      'Pindah Tab',
      'Nilai Akhir',
      'Predikat',
      'KKM',
      'Status Kelulusan',
    ];
    const rows = filteredSessions.map((s, idx) => {
      const ex = exams.find((e) => e.id === s.examId);
      const kkm = ex?.passingScore ?? 75;
      const pred = getGradePredicate(s.score).label;
      const statusKkm =
        s.status === 'in_progress'
          ? 'Sedang Mengerjakan'
          : s.score >= kkm
          ? 'TUNTAS (LULUS)'
          : 'REMEDIAL';
      return [
        idx + 1,
        s.studentNomorPeserta,
        s.studentUsername,
        `"${s.studentName}"`,
        s.studentKelas,
        ex?.code || '-',
        `"${ex?.subject || '-'}"`,
        s.correctCount,
        s.wrongCount,
        s.unansweredCount,
        s.tabSwitchCount,
        s.score,
        `"${pred}"`,
        kkm,
        statusKkm,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Leger_Data_Nilai_CBT_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Unduh Leger Nilai Berhasil', 'Berkas CSV data nilai telah diunduh.', 'success');
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setFilterExamId('ALL');
    setFilterKelas('ALL');
    setFilterStatus('ALL');
    setSortBy('score_desc');
  };

  const hasActiveFilter =
    searchQuery.trim() !== '' ||
    filterExamId !== 'ALL' ||
    filterKelas !== 'ALL' ||
    filterStatus !== 'ALL';

  const inspectedSession = sessions.find((s) => s.id === inspectSessionId);
  const inspectedExam = exams.find((e) => e.id === inspectedSession?.examId);
  const inspectedQuestions = inspectedExam
    ? getQuestionsByExam(inspectedExam.id)
    : [];

  return (
    <div className="space-y-5">
      {/* Hidden File Input for Device Backup JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportDeviceBackupFile}
        className="hidden"
      />

      {/* Section 1: Ringkasan Metrik Nilai (KPI Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-medium text-slate-500">
            Rata-Rata Nilai (Mean)
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-mono font-bold text-slate-900 tabular-nums">
              {avgScore}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {completedFiltered.length} sesi selesai
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-medium text-slate-500">
            Rentang Skor (Tertinggi / Terendah)
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div className="font-mono font-bold text-2xl text-slate-900 tabular-nums">
              <span className="text-emerald-700">{maxScore}</span>
              <span className="text-slate-300 mx-1.5">/</span>
              <span className="text-amber-700">{minScore}</span>
            </div>
            <span className="text-xs text-slate-500">Skala 0–100</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-medium text-slate-500">
            Tingkat Ketuntasan KKM
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-mono font-bold text-emerald-700 tabular-nums">
              {passRate}%
            </span>
            <span className="text-xs font-medium text-emerald-700 tabular-nums">
              {passedCount} siswa tuntas
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-medium text-slate-500">
            Perlu Remedial / Susulan
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-mono font-bold text-amber-700 tabular-nums">
              {remedialCount}
            </span>
            <span className="text-xs text-slate-500">
              Di bawah batas KKM
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Unified Control Panel & Gradebook Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Top Header & Action Bar */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              Daftar Leger & Rekapitulasi Nilai Ujian
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Rekapitulasi nilai akhir peserta didik, rincian jawaban benar/salah, ketuntasan KKM, dan lembar jawaban ujian.
            </p>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSyncPanel((prev) => !prev)}
              className={`px-3.5 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                showSyncPanel
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span className="tabular-nums">
                {showSyncPanel
                  ? 'Sembunyikan Panel Integrasi & Perangkat'
                  : `Panel Integrasi & Nilai Perangkat (${deviceSavedSessions.length} Sesi)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setManualModalOpen(true)}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0 text-blue-600" />
              <span>Input Nilai Manual</span>
            </button>

            <button
              type="button"
              onClick={handleExportGradesCSV}
              className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Unduh Leger (.CSV)</span>
            </button>
          </div>
        </div>

        {/* Filter & Segmented Control Bar */}
        <div className="px-5 py-3.5 bg-slate-50/40 border-b border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            {/* Search Input */}
            <div className="relative sm:col-span-2 lg:col-span-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa, NISN, atau nomor peserta..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Mata Ujian */}
            <div className="lg:col-span-3">
              <select
                value={filterExamId}
                onChange={(e) => setFilterExamId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">Semua Paket Mata Ujian</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    [{ex.code}] {ex.subject}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kelas */}
            <div className="lg:col-span-2">
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">Semua Kelas</option>
                <optgroup label="Filter Per Angkatan">
                  <option value="ANGKATAN_X">Semua Angkatan Kelas X</option>
                  <option value="ANGKATAN_XI">Semua Angkatan Kelas XI</option>
                  <option value="ANGKATAN_XII">Semua Angkatan Kelas XII</option>
                </optgroup>
                <optgroup label="Filter Rombel Spesifik">
                  {classes.map((c) => (
                    <option key={c.id} value={c.namaKelas}>
                      Kelas {c.namaKelas}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Sort Order */}
            <div className="lg:col-span-3 flex items-center gap-2">
              <div className="relative flex-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortField)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="score_desc">Urutkan: Nilai Tertinggi</option>
                  <option value="score_asc">Urutkan: Nilai Terendah</option>
                  <option value="name_asc">Urutkan: Nama Siswa (A–Z)</option>
                  <option value="kelas_asc">Urutkan: Kelas & Nilai</option>
                </select>
              </div>

              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-600 whitespace-nowrap cursor-pointer"
                  title="Reset seluruh filter"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Segmented Status Filter Tabs + Contextual Exam Discussion Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  filterStatus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Status ({statusTabCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PASSED')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  filterStatus === 'PASSED'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tuntas KKM ({statusTabCounts.passed})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('REMEDIAL')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  filterStatus === 'REMEDIAL'
                    ? 'bg-white text-amber-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Remedial ({statusTabCounts.remedial})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('IN_PROGRESS')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  filterStatus === 'IN_PROGRESS'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sedang Mengerjakan ({statusTabCounts.inProgress})
              </button>
            </div>

            {/* Contextual Toggle Pembahasan Soal when a specific exam is selected */}
            {filterExamId !== 'ALL' && (() => {
              const currentFilteredExam = exams.find((e) => e.id === filterExamId);
              if (!currentFilteredExam) return null;
              return (
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !currentFilteredExam.showExplanationAfterSubmit;
                    updateExam(currentFilteredExam.id, {
                      showExplanationAfterSubmit: nextState,
                    });
                    showToast(
                      nextState ? 'Pembahasan Soal Diaktifkan' : 'Pembahasan Soal Dinonaktifkan',
                      `Akses kunci jawaban & pembahasan untuk paket [${currentFilteredExam.code}] berhasil ${
                        nextState ? 'diaktifkan' : 'dinonaktifkan'
                      }.`,
                      nextState ? 'success' : 'info'
                    );
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    currentFilteredExam.showExplanationAfterSubmit
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                  }`}
                  title="Ubah pengaturan apakah siswa dapat melihat pembahasan ujian ini"
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Akses Pembahasan [{currentFilteredExam.code}]:{' '}
                    {currentFilteredExam.showExplanationAfterSubmit ? 'Dibuka' : 'Terkunci'}
                  </span>
                </button>
              );
            })()}
          </div>
        </div>

        {/* High-Density Gradebook Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4 text-center w-14 whitespace-nowrap">No</th>
                <th className="py-3 px-4 min-w-[220px]">Peserta Didik</th>
                <th className="py-3 px-4 text-center w-28 whitespace-nowrap">Kelas</th>
                <th className="py-3 px-4 min-w-[190px]">Mata Ujian</th>
                <th className="py-3 px-4 text-center w-32 whitespace-nowrap">
                  Benar / Salah / Kosong
                </th>
                <th className="py-3 px-4 text-center w-28 whitespace-nowrap">Pindah Tab</th>
                <th className="py-3 px-5 text-right w-28 whitespace-nowrap">Nilai Akhir</th>
                <th className="py-3 px-4 w-48 whitespace-nowrap">Status & Predikat</th>
                <th className="py-3 px-4 text-right w-36 whitespace-nowrap">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="text-sm font-semibold text-slate-700">
                        Belum ada data nilai yang sesuai
                      </div>
                      <p className="text-xs text-slate-500">
                        Ubah kata kunci pencarian atau filter di atas, atau tambahkan nilai ujian siswa secara manual.
                      </p>
                      <div className="pt-2 flex items-center justify-center gap-2">
                        {hasActiveFilter && (
                          <button
                            type="button"
                            onClick={resetAllFilters}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            Reset Filter
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setManualModalOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
                        >
                          + Input Nilai Manual
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((ses, idx) => {
                  const ex = exams.find((e) => e.id === ses.examId);
                  const kkm = ex?.passingScore ?? 75;
                  const isPassed = ses.score >= kkm;
                  const pred = getGradePredicate(ses.score);
                  const isMatched = Boolean(findMatchingStudentForSession(ses, studentUsers));

                  return (
                    <tr
                      key={ses.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* No / Rank */}
                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                        {idx + 1}
                      </td>

                      {/* Peserta Didik */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {ses.studentName}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] font-mono text-slate-500 tabular-nums">
                          <span>{ses.studentNomorPeserta}</span>
                          <span aria-hidden="true">·</span>
                          <span>NISN {ses.studentUsername}</span>
                          {!isMatched && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-700 font-sans font-medium">
                                Perangkat
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Kelas */}
                      <td className="py-3 px-4 text-center font-medium text-slate-700 whitespace-nowrap">
                        {ses.studentKelas}
                      </td>

                      {/* Mata Ujian */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 leading-snug">
                          {ex?.subject || '-'}
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono text-slate-500 tabular-nums">
                          {ex?.code || '-'} · KKM {kkm}
                        </div>
                      </td>

                      {/* Rincian B / S / K */}
                      <td className="py-3 px-4 text-center font-mono tabular-nums whitespace-nowrap">
                        <span className="text-emerald-700 font-semibold" title="Benar">
                          {ses.correctCount}
                        </span>
                        <span className="text-slate-300 mx-1.5">/</span>
                        <span className="text-rose-600 font-semibold" title="Salah">
                          {ses.wrongCount}
                        </span>
                        <span className="text-slate-300 mx-1.5">/</span>
                        <span className="text-slate-500" title="Kosong">
                          {ses.unansweredCount}
                        </span>
                      </td>

                      {/* Pindah Tab */}
                      <td className="py-3 px-4 text-center font-mono tabular-nums whitespace-nowrap">
                        {ses.tabSwitchCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>{ses.tabSwitchCount}x</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">0x</span>
                        )}
                      </td>

                      {/* Nilai Akhir */}
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-base tabular-nums ${
                            ses.status === 'in_progress'
                              ? 'text-slate-500'
                              : isPassed
                              ? 'text-slate-900'
                              : 'text-rose-600'
                          }`}
                        >
                          {ses.score}
                        </span>
                      </td>

                      {/* Status & Predikat */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {ses.status === 'in_progress' ? (
                          <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>Sedang Ujian</span>
                          </div>
                        ) : (
                          <div>
                            <div
                              className={`flex items-center gap-1.5 font-semibold ${
                                isPassed ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {isPassed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>{isPassed ? 'Tuntas KKM' : 'Remedial'}</span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              Predikat <span className={`font-semibold ${pred.textClass}`}>{pred.label}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Tindakan */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setInspectSessionId(ses.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Lihat Lembar Jawaban Siswa"
                          >
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            <span>Detail</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditScoreModal(ses)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-blue-700 transition-colors cursor-pointer"
                            title="Koreksi / Edit Nilai"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => resetStudentSession(ses.id)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-rose-600 transition-colors cursor-pointer"
                            title="Reset Sesi (Ujian Ulang)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="tabular-nums">
            Menampilkan <strong className="font-semibold text-slate-700">{filteredSessions.length}</strong> dari{' '}
            <strong className="font-semibold text-slate-700">{integratedSessions.length}</strong> data nilai siswa
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
            <span>
              Rata-rata filter: <strong className="font-mono font-semibold text-slate-800">{avgScore}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Tuntas: <strong className="font-mono font-semibold text-emerald-700">{passedCount}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Remedial: <strong className="font-mono font-semibold text-rose-600">{remedialCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Separated Admin Panel Cards for v_rekap_nilai Integration & Device Score Recovery */}
      {showSyncPanel && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
          {/* Kartu 1: Integrasi Tabel v_rekap_nilai <-> public.students & Pemulihan Nilai Perangkat */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between">
            <div>
              {/* Separated Header */}
              <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Integrasi Tabel <code className="font-mono text-blue-700">v_rekap_nilai</code> ↔{' '}
                    <code className="font-mono text-blue-700">public.students</code>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sinkronisasi relasi identitas peserta didik & pencadangan berkas nilai
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Separated Status Metric Box */}
                <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-950">
                      Status Relasi Nilai ke Tabel Students
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded border border-emerald-200 tabular-nums">
                    {matchedStudentsCount}/{integratedSessions.length} Nilai Terhubung
                  </span>
                </div>

                {/* Separated Explanation Text */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
                  Seluruh hasil ujian yang tersimpan di perangkat siswa otomatis dicocokkan dengan{' '}
                  <code className="font-mono font-semibold text-slate-800">public.students</code>{' '}
                  (ID Siswa, NISN, atau Nomor Peserta) dan langsung masuk ke{' '}
                  <code className="font-mono font-semibold text-slate-800">v_rekap_nilai</code>.
                  Anda juga dapat mengimpor file cadangan JSON dari perangkat siswa.
                </div>
              </div>
            </div>

            {/* Separated Footer Actions */}
            <div className="px-5 py-3.5 bg-slate-50/60 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-[11px] text-slate-500">
                Pemulihan lintas perangkat via berkas .JSON
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Impor Cadangan (.JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBackupJson}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Unduh Cadangan (.JSON)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Kartu 2: Data Nilai Ujian Tersimpan pada Perangkat Ini (Dipindahkan dari Halaman Login ke Admin Panel) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between">
            <div>
              {/* Separated Header */}
              <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Data Nilai Ujian Tersimpan pada Perangkat Ini
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      Total terdeteksi di penyimpanan lokal: {deviceSavedSessions.length} Sesi
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Separated Status Box */}
                <div
                  className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 ${
                    unsyncedDeviceSessionIds.length > 0
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Status Sinkronisasi Perangkat</span>
                  </div>
                  {unsyncedDeviceSessionIds.length > 0 ? (
                    <span className="px-2.5 py-1 rounded bg-white border border-amber-300 text-[11px] font-bold text-amber-900 tabular-nums">
                      {unsyncedDeviceSessionIds.length} Menunggu Sinkronisasi
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded bg-white border border-emerald-200 text-[11px] font-semibold text-emerald-800">
                      Terintegrasi ke v_rekap_nilai & students
                    </span>
                  )}
                </div>

                {/* Separated Explanation Text */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
                  Sistem mendeteksi riwayat pengerjaan ujian yang tersimpan di perangkat ini. Nilai
                  otomatis dihubungkan ke tabel{' '}
                  <code className="font-mono font-semibold text-slate-800">students</code> dan{' '}
                  <code className="font-mono font-semibold text-slate-800">v_rekap_nilai</code>.
                </div>

                {/* Device Saved Sessions List */}
                {deviceSavedSessions.length > 0 && (
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                    {deviceSavedSessions.map((ses) => {
                      const ex = exams.find((e) => e.id === ses.examId);
                      return (
                        <div
                          key={ses.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {ses.studentName} ({ses.studentKelas})
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 truncate tabular-nums">
                              {ex?.subject || ses.examId} · NISN {ses.studentUsername}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 tabular-nums shrink-0">
                            Nilai: {ses.score}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Separated Footer Controls */}
            <div className="px-5 py-3.5 bg-slate-50/60 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSyncDeviceScores}
                  onChange={(e) => setAutoSyncDeviceScores(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                />
                <span>Pastikan Nilai Langsung Masuk Otomatis (Opsional)</span>
              </label>

              <button
                type="button"
                disabled={isSyncingDeviceScores || isSyncingSupabase}
                onClick={handleManualSyncDeviceScores}
                className="px-3.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {isSyncingDeviceScores || isSyncingSupabase ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="tabular-nums">
                  {isSyncingDeviceScores || isSyncingSupabase
                    ? 'Mengirim...'
                    : `Kirim Nilai ke Server (${deviceSavedSessions.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Koreksi / Edit Nilai Siswa */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-base">
                  Koreksi Nilai Siswa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScoreEdit} className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-semibold text-sm text-slate-900">
                  {editingSession.studentName}
                </div>
                <div className="font-mono text-slate-500">
                  {editingSession.studentNomorPeserta} · Kelas {editingSession.studentKelas}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nilai Akhir (Skala 0 – 100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={scoreForm.score}
                  onChange={(e) =>
                    setScoreForm({ ...scoreForm, score: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2.5 font-mono font-bold text-base bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Benar
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={scoreForm.correctCount}
                    onChange={(e) =>
                      setScoreForm({
                        ...scoreForm,
                        correctCount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Salah
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={scoreForm.wrongCount}
                    onChange={(e) =>
                      setScoreForm({
                        ...scoreForm,
                        wrongCount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kosong
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={scoreForm.unansweredCount}
                    onChange={(e) =>
                      setScoreForm({
                        ...scoreForm,
                        unansweredCount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-semibold cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Input Nilai Manual Baru */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-base">
                Input Data Nilai Siswa Manual
              </h3>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualGrade} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Peserta Didik (Siswa)
                </label>
                <select
                  value={manualForm.studentId}
                  onChange={(e) => {
                    const nextStudentId = e.target.value;
                    const stu = studentUsers.find((u) => u.id === nextStudentId);
                    const allowedForStu = stu
                      ? exams.filter((ex) => canStudentAccessExam(stu, ex, classes))
                      : exams;
                    setManualForm({
                      ...manualForm,
                      studentId: nextStudentId,
                      examId: allowedForStu.some((ex) => ex.id === manualForm.examId)
                        ? manualForm.examId
                        : allowedForStu[0]?.id || '',
                    });
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  {studentUsers.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.name} ({stu.kelas} - {stu.nomorPeserta})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Paket Mata Ujian (Sesuai Angkatan Siswa)
                </label>
                <select
                  value={manualForm.examId}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, examId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  {(() => {
                    const selectedStu = studentUsers.find((u) => u.id === manualForm.studentId);
                    const allowedExams = selectedStu
                      ? exams.filter((ex) => canStudentAccessExam(selectedStu, ex, classes))
                      : exams;
                    return allowedExams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        [{ex.code}] {ex.subject} ({ex.kelasTarget})
                      </option>
                    ));
                  })()}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nilai Akhir
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={manualForm.score}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, score: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 font-mono font-bold bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Soal Benar
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={manualForm.correctCount}
                    onChange={(e) =>
                      setManualForm({
                        ...manualForm,
                        correctCount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Soal Salah
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={manualForm.wrongCount}
                    onChange={(e) =>
                      setManualForm({
                        ...manualForm,
                        wrongCount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-semibold cursor-pointer"
                >
                  Simpan ke Leger Nilai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Inspeksi Lembar Jawaban Peserta */}
      {inspectedSession && inspectedExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono font-semibold text-blue-700">
                  Inspeksi Lembar Jawaban · {inspectedExam.code}
                </div>
                <h3 className="font-semibold text-slate-900 text-base">
                  {inspectedSession.studentName} ({inspectedSession.studentKelas})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectSessionId(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-mono font-bold text-lg text-blue-700 tabular-nums">
                    {inspectedSession.score}
                  </div>
                  <div className="text-slate-600 font-medium mt-0.5">Nilai Akhir</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-mono font-bold text-lg text-emerald-700 tabular-nums">
                    {inspectedSession.correctCount}
                  </div>
                  <div className="text-slate-600 font-medium mt-0.5">Jawaban Benar</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-mono font-bold text-lg text-rose-600 tabular-nums">
                    {inspectedSession.wrongCount}
                  </div>
                  <div className="text-slate-600 font-medium mt-0.5">Jawaban Salah</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-mono font-bold text-lg text-slate-800 tabular-nums">
                    {inspectedSession.tabSwitchCount}x
                  </div>
                  <div className="text-slate-600 font-medium mt-0.5">Pindah Tab</div>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 pt-2">
                {inspectedQuestions.map((q) => {
                  const ans = inspectedSession.answers[q.id];
                  const isEssay = q.questionType === 'esai';
                  const isRight = isEssay
                    ? Boolean(
                        ans &&
                          ans.trim() &&
                          (!q.essayAnswerKey ||
                            ans.trim().toLowerCase() ===
                              q.essayAnswerKey.trim().toLowerCase() ||
                            ans
                              .trim()
                              .toLowerCase()
                              .includes(q.essayAnswerKey.trim().toLowerCase()))
                      )
                    : ans === q.correctOption;
                  return (
                    <div
                      key={q.id}
                      className={`p-2.5 rounded-lg border text-center font-mono text-xs tabular-nums ${
                        !ans
                          ? 'bg-slate-50 border-slate-200 text-slate-400'
                          : isRight
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50/70 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="text-[10px] font-semibold text-slate-500">
                        No. {q.number} {isEssay ? '(Esai)' : ''}
                      </div>
                      <div
                        className="font-bold text-sm mt-0.5 truncate"
                        title={ans || '-'}
                      >
                        {ans || '-'}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        Kunci: {isEssay ? q.essayAnswerKey || 'Pedoman' : q.correctOption}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectSessionId(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
