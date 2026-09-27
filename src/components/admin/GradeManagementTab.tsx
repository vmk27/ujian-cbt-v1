import React, { useState } from 'react';
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
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { ExamSession } from '../../types/cbt';

function getGradePredicate(score: number): { label: string; badgeClass: string } {
  if (score >= 90) {
    return {
      label: 'A (Sangat Baik)',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (score >= 80) {
    return {
      label: 'B (Baik)',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    };
  }
  if (score >= 70) {
    return {
      label: 'C (Cukup)',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }
  return {
    label: 'D (Kurang)',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  };
}

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
    showToast,
  } = useCBT();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterExamId, setFilterExamId] = useState<string>('ALL');
  const [filterKelas, setFilterKelas] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'PASSED' | 'REMEDIAL' | 'IN_PROGRESS'
  >('ALL');

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
  const studentUsers = users.filter((u) => u.role === 'siswa');
  const [manualForm, setManualForm] = useState({
    studentId: studentUsers[0]?.id || '',
    examId: exams[0]?.id || '',
    score: 85,
    correctCount: 7,
    wrongCount: 1,
  });

  // Filtered sessions
  const filteredSessions = sessions
    .filter((s) => {
      const ex = exams.find((e) => e.id === s.examId);
      const kkm = ex?.passingScore ?? 75;
      const matchesExam = filterExamId === 'ALL' || s.examId === filterExamId;
      const matchesKelas = filterKelas === 'ALL' || s.studentKelas === filterKelas;
      const matchesQuery =
        s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentNomorPeserta.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentKelas.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesStatus = true;
      if (filterStatus === 'IN_PROGRESS') {
        matchesStatus = s.status === 'in_progress';
      } else if (filterStatus === 'PASSED') {
        matchesStatus = s.status !== 'in_progress' && s.score >= kkm;
      } else if (filterStatus === 'REMEDIAL') {
        matchesStatus = s.status !== 'in_progress' && s.score < kkm;
      }

      return matchesExam && matchesKelas && matchesQuery && matchesStatus;
    })
    .sort((a, b) => b.score - a.score);

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

  const inspectedSession = sessions.find((s) => s.id === inspectSessionId);
  const inspectedExam = exams.find((e) => e.id === inspectedSession?.examId);
  const inspectedQuestions = inspectedExam
    ? getQuestionsByExam(inspectedExam.id)
    : [];

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Rata-Rata Nilai (Mean)
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-mono font-extrabold text-blue-700 tabular-nums">
              {avgScore}
            </span>
            <span className="text-xs font-medium text-slate-500">
              Dari {completedFiltered.length} Sesi Selesai
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Nilai Tertinggi / Terendah
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="font-mono font-extrabold text-2xl text-slate-900 tabular-nums">
              <span className="text-emerald-700">{maxScore}</span>
              <span className="text-slate-300 mx-1.5">/</span>
              <span className="text-amber-700">{minScore}</span>
            </div>
            <span className="text-xs font-mono text-slate-500">Rentang Skor</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Tingkat Ketuntasan KKM
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-mono font-extrabold text-emerald-700 tabular-nums">
              {passRate}%
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {passedCount} Siswa Lulus
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Perlu Remedial / Susulan
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-mono font-extrabold text-amber-700 tabular-nums">
              {completedFiltered.length - passedCount}
            </span>
            <span className="text-xs font-medium text-slate-500">Di Bawah KKM</span>
          </div>
        </div>
      </div>

      {/* Filter & Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[210px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa, NISN..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={filterExamId}
            onChange={(e) => setFilterExamId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
          >
            <option value="ALL">Semua Mata Ujian</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.code} - {ex.subject}
              </option>
            ))}
          </select>

          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
          >
            <option value="ALL">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.namaKelas}>
                {c.namaKelas}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(
                e.target.value as 'ALL' | 'PASSED' | 'REMEDIAL' | 'IN_PROGRESS'
              )
            }
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg"
          >
            <option value="ALL">Semua Status KKM</option>
            <option value="PASSED">Lulus KKM (Tuntas)</option>
            <option value="REMEDIAL">Remedial (Di Bawah KKM)</option>
            <option value="IN_PROGRESS">Sedang Mengerjakan</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setManualModalOpen(true)}
            className="px-3.5 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Input Nilai Manual</span>
          </button>
          <button
            type="button"
            onClick={handleExportGradesCSV}
            className="px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Unduh Leger (.CSV)</span>
          </button>
        </div>
      </div>

      {/* Data Nilai Gradebook Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 text-center">Rank</th>
                <th className="py-3.5 px-4">Peserta Didik</th>
                <th className="py-3.5 px-4">Kelas</th>
                <th className="py-3.5 px-4">Mata Pelajaran</th>
                <th className="py-3.5 px-4 text-center">B / S / K</th>
                <th className="py-3.5 px-4 text-center">Pindah Tab</th>
                <th className="py-3.5 px-4 text-center">Nilai Akhir</th>
                <th className="py-3.5 px-4 text-center">Predikat & KKM</th>
                <th className="py-3.5 px-4 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    Tidak ada data nilai yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((ses, idx) => {
                  const ex = exams.find((e) => e.id === ses.examId);
                  const kkm = ex?.passingScore ?? 75;
                  const isPassed = ses.score >= kkm;
                  const pred = getGradePredicate(ses.score);

                  return (
                    <tr key={ses.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-500 tabular-nums">
                        #{idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{ses.studentName}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {ses.studentNomorPeserta} • NISN {ses.studentUsername}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {ses.studentKelas}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {ex?.subject || '-'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {ex?.code} (KKM {kkm})
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono tabular-nums">
                        <span className="text-emerald-700 font-bold">
                          {ses.correctCount}
                        </span>{' '}
                        / <span className="text-red-600 font-bold">{ses.wrongCount}</span>{' '}
                        / <span className="text-slate-400">{ses.unansweredCount}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {ses.tabSwitchCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-mono font-bold">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>{ses.tabSwitchCount}x</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0x</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-extrabold text-base text-slate-900 tabular-nums">
                          {ses.score}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {ses.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Sedang Ujian</span>
                          </span>
                        ) : (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span
                              className={`px-2 py-0.5 rounded border text-[11px] font-bold ${pred.badgeClass}`}
                            >
                              {pred.label}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold uppercase ${
                                isPassed ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {isPassed ? '• LULUS KKM' : '• REMEDIAL'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectSessionId(ses.id)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                            title="Lihat Detail Jawaban"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditScoreModal(ses)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-blue-700 cursor-pointer"
                            title="Koreksi / Edit Nilai"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => resetStudentSession(ses.id)}
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                            title="Reset Sesi (Ujian Ulang)"
                          >
                            <RotateCcw className="w-4 h-4" />
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
      </div>

      {/* Modal 1: Koreksi / Edit Nilai Siswa */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Koreksi / Penyesuaian Nilai Siswa
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
                <div className="font-bold text-sm text-slate-900">
                  {editingSession.studentName}
                </div>
                <div className="font-mono text-slate-500">
                  {editingSession.studentNomorPeserta} • {editingSession.studentKelas}
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Nilai Akhir (Skala 0 - 100)
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
                  className="w-full px-3.5 py-2.5 font-mono font-extrabold text-base bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Jml Benar
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
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Jml Salah
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
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
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
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold cursor-pointer"
                >
                  Simpan Perubahan Nilai
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
              <h3 className="font-bold text-slate-900 text-base">
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
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Pilih Peserta Didik (Siswa)
                </label>
                <select
                  value={manualForm.studentId}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, studentId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  {studentUsers.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.name} ({stu.kelas} - {stu.nomorPeserta})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Pilih Paket Mata Ujian
                </label>
                <select
                  value={manualForm.examId}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, examId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      [{ex.code}] {ex.subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
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
                    className="w-full px-3 py-2 font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
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
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
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
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold cursor-pointer"
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
                <span className="text-xs font-mono font-bold text-blue-700">
                  Inspeksi Lembar Jawaban • {inspectedExam.code}
                </span>
                <h3 className="font-bold text-slate-900 text-base">
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
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="font-mono font-extrabold text-lg text-blue-700">
                    {inspectedSession.score}
                  </div>
                  <div className="text-blue-800 font-semibold">Nilai Akhir</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="font-mono font-extrabold text-lg text-emerald-700">
                    {inspectedSession.correctCount}
                  </div>
                  <div className="text-emerald-800 font-semibold">Benar</div>
                </div>
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="font-mono font-extrabold text-lg text-red-600">
                    {inspectedSession.wrongCount}
                  </div>
                  <div className="text-red-800 font-semibold">Salah</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-mono font-extrabold text-lg text-slate-700">
                    {inspectedSession.tabSwitchCount}x
                  </div>
                  <div className="text-slate-600 font-semibold">Pindah Tab</div>
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
                      className={`p-2.5 rounded-lg border text-center font-mono text-xs ${
                        !ans
                          ? 'bg-slate-50 border-slate-200 text-slate-400'
                          : isRight
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-red-50 border-red-300 text-red-800'
                      }`}
                    >
                      <div className="text-[10px] font-bold">
                        No. {q.number} {isEssay ? '(Esai)' : ''}
                      </div>
                      <div
                        className="font-extrabold text-sm mt-0.5 truncate"
                        title={ans || '-'}
                      >
                        {ans || '-'}
                      </div>
                      <div className="text-[10px] opacity-75 truncate">
                        Kunci:{' '}
                        {isEssay ? q.essayAnswerKey || 'Pedoman' : q.correctOption}
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
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
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
