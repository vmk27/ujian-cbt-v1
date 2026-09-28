import React, { useState } from 'react';
import {
  GraduationCap,
  LogOut,
  Clock,
  KeyRound,
  CheckCircle2,
  XCircle,
  Play,
  Award,
  BookOpen,
  ChevronRight,
  X,
  AlertCircle,
  Eye,
  RotateCcw,
  Calendar,
  UploadCloud,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { ExamPackage } from '../../types/cbt';
import { canStudentAccessExam, extractTingkatFromText } from '../../utils/examAccess';
import { ExamWorkspace } from './ExamWorkspace';
import { RichTextContent } from '../common/RichTextEditor';

export const StudentPortal: React.FC = () => {
  const {
    appSettings,
    currentUser,
    logout,
    classes,
    exams,
    sessions,
    getQuestionsByExam,
    verifyTokenAndStartSession,
    submitExamSession,
    syncDeviceSessionsToServer,
  } = useCBT();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedExamForToken, setSelectedExamForToken] = useState<ExamPackage | null>(
    null
  );
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);

  if (!currentUser) return null;

  // If currently inside an active exam workspace
  if (activeSessionId) {
    const currentSession = sessions.find((s) => s.id === activeSessionId);
    const currentExam = exams.find((e) => e.id === currentSession?.examId);
    if (
      currentSession &&
      currentExam &&
      currentSession.status === 'in_progress'
    ) {
      const examQuestions = getQuestionsByExam(currentExam.id);
      return (
        <ExamWorkspace
          exam={currentExam}
          session={currentSession}
          questions={examQuestions}
          onFinishExam={(finishedId) => {
            setActiveSessionId(null);
            setReviewSessionId(finishedId);
          }}
          onExitToLobby={() => setActiveSessionId(null)}
        />
      );
    }
  }

  const studentTingkat = extractTingkatFromText(currentUser.kelas, classes);

  // Filter paket ujian secara ketat berdasarkan tingkat angkatan (Kelas X / XI / XII) & rombel siswa
  const visibleExams = exams.filter(
    (e) => e.status !== 'draft' && canStudentAccessExam(currentUser, e, classes)
  );
  const allowedExamIds = new Set(visibleExams.map((e) => e.id));

  const studentSessions = sessions.filter((s) => {
    const isMySession =
      s.studentId === currentUser.id ||
      (s.studentUsername &&
        currentUser.username &&
        s.studentUsername.toLowerCase() === currentUser.username.toLowerCase()) ||
      (s.studentNomorPeserta &&
        currentUser.nomorPeserta &&
        s.studentNomorPeserta.toLowerCase() ===
          currentUser.nomorPeserta.toLowerCase());
    if (!isMySession) return false;
    const ex = exams.find((e) => e.id === s.examId);
    return ex ? canStudentAccessExam(currentUser, ex, classes) : allowedExamIds.has(s.examId);
  });
  const completedSessions = studentSessions.filter(
    (s) => s.status === 'completed' || s.status === 'timed_out'
  );
  const avgScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((acc, s) => acc + s.score, 0) /
            completedSessions.length
        )
      : 0;

  const handleOpenTokenModal = (exam: ExamPackage) => {
    setSelectedExamForToken(exam);
    setTokenInput('');
    setTokenError(null);
  };

  const handleStartExamWithToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamForToken) return;
    setTokenError(null);

    const res = verifyTokenAndStartSession(selectedExamForToken.id, tokenInput);
    if (!res.ok) {
      setTokenError(res.message || 'Gagal memulai ujian.');
      return;
    }
    if (res.session) {
      setSelectedExamForToken(null);
      setActiveSessionId(res.session.id);
    }
  };

  const reviewSession = sessions.find((s) => s.id === reviewSessionId);
  const reviewExam = exams.find((e) => e.id === reviewSession?.examId);
  const reviewQuestions = reviewExam ? getQuestionsByExam(reviewExam.id) : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Student Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1D4ED8] text-white flex items-center justify-center shadow-2xs shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tracking-tight">
                  {appSettings.appName}
                </span>
                <span className="text-xs text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs font-medium text-emerald-700">
                  Portal Peserta Didik
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {appSettings.schoolName || currentUser.sekolah}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-slate-900">{currentUser.name}</div>
              <div className="text-xs font-mono text-slate-500">
                {currentUser.nomorPeserta} • {currentUser.kelas}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-xs font-bold text-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Student Identity Card & Quick KPI Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kartu Peserta Ujian */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">
                  Kartu Identitas Peserta Ujian CBT
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {currentUser.name}
                </h1>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Terverifikasi Aktif</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Nomor Peserta
                </div>
                <div className="mt-1 font-mono font-bold text-sm text-slate-900 tabular-nums">
                  {currentUser.nomorPeserta}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  NISN / Username
                </div>
                <div className="mt-1 font-mono font-bold text-sm text-slate-900 tabular-nums">
                  {currentUser.username}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Kelas & Angkatan
                </div>
                <div className="mt-1 font-bold text-sm text-slate-900">
                  {currentUser.kelas}{' '}
                  {studentTingkat && (
                    <span className="text-xs font-mono font-semibold text-blue-700">
                      (Angkatan {studentTingkat})
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Jenis Kelamin
                </div>
                <div className="mt-1 font-bold text-sm text-slate-900">
                  {currentUser.jenisKelamin === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}
                </div>
              </div>
            </div>
          </div>

          {/* Student Stats Card */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ringkasan Capaian Anda
              </span>
              <Award className="w-5 h-5 text-blue-600" />
            </div>

            <div className="grid grid-cols-2 gap-4 my-4">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-2xl font-mono font-extrabold text-slate-900 tabular-nums">
                  {completedSessions.length}
                </div>
                <div className="text-xs font-medium text-slate-500 mt-0.5">
                  Ujian Selesai
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200/80">
                <div className="text-2xl font-mono font-extrabold text-blue-700 tabular-nums">
                  {avgScore}
                </div>
                <div className="text-xs font-medium text-blue-800 mt-0.5">
                  Rata-Rata Nilai
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 flex items-center justify-between pt-3 border-t border-slate-100">
              <span>Jadwal Ujian Angkatan:</span>
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {visibleExams.length} Paket Tersedia
              </span>
            </div>
          </div>
        </div>

        {/* Jadwal & Daftar Paket Ujian CBT */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Jadwal & Paket Ujian Angkatan Kelas {studentTingkat || currentUser.kelas}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan jadwal ujian khusus untuk tingkat angkatan{' '}
                <strong className="text-slate-700">
                  {studentTingkat ? `Kelas ${studentTingkat}` : currentUser.kelas}
                </strong>{' '}
                (Rombel <strong className="text-slate-700">{currentUser.kelas}</strong>). Jadwal angkatan lain disembunyikan secara otomatis.
              </p>
            </div>
            <div className="text-xs text-slate-600 font-medium shrink-0">
              Filter Akses Aktif:{' '}
              <strong className="font-mono text-blue-700">
                {studentTingkat ? `Angkatan Kelas ${studentTingkat}` : currentUser.kelas}
              </strong>{' '}
              · {visibleExams.length} Paket Ujian
            </div>
          </div>

          {visibleExams.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
              <div className="text-sm font-bold text-slate-800">
                Belum Ada Jadwal Ujian untuk Angkatan Kelas {studentTingkat || currentUser.kelas}
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Saat ini belum terdapat paket ujian aktif yang dijadwalkan untuk rombel{' '}
                <strong>{currentUser.kelas}</strong>{' '}
                {studentTingkat ? `(Angkatan Kelas ${studentTingkat})` : ''}. Silakan hubungi Proktor atau Guru pengampu.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {visibleExams.map((exam) => {
                const examQuestions = getQuestionsByExam(exam.id);
                const mySession = studentSessions.find((s) => s.examId === exam.id);
                const isCompleted =
                  mySession?.status === 'completed' || mySession?.status === 'timed_out';
                const isInProgress = mySession?.status === 'in_progress';
                const isPassed = isCompleted && (mySession?.score ?? 0) >= exam.passingScore;

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between gap-5 hover:border-slate-300 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold uppercase px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {exam.code}
                          </span>
                          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                            {exam.subject}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            · {exam.kelasTarget}
                          </span>
                        </div>

                      {isCompleted ? (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded border ${
                            isPassed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selesai • Nilai: {mySession?.score}</span>
                        </span>
                      ) : isInProgress ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-300">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Sedang Dikerjakan</span>
                        </span>
                      ) : exam.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span>Sesi Dibuka</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-500">
                          <span>Ditutup</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {exam.title}
                    </h3>

                    {/* Jadwal Ujian Info Banner */}
                    <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                          {exam.examDate
                            ? new Date(`${exam.examDate}T00:00:00`).toLocaleDateString(
                                'id-ID',
                                {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                }
                              )
                            : 'Jadwal Fleksibel'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-mono font-bold text-blue-800">
                        <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                          {exam.startTime && exam.endTime
                            ? `${exam.startTime} – ${exam.endTime} WIB`
                            : `${exam.durationMinutes} Menit`}
                        </span>
                      </div>
                    </div>

                    {/* Status Pembahasan Soal Badge */}
                    <div className="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80">
                      <span className="text-slate-500 font-medium">Kunci & Pembahasan:</span>
                      {exam.showExplanationAfterSubmit ? (
                        <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tersedia Pasca Ujian</span>
                        </span>
                      ) : (
                        <span className="font-bold text-slate-500 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Dinonaktifkan Proktor</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs text-slate-600">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                        <div className="text-[10px] font-semibold uppercase text-slate-400">
                          Durasi Waktu
                        </div>
                        <div className="font-mono font-bold text-slate-800 mt-0.5 tabular-nums">
                          {exam.durationMinutes} Menit
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                        <div className="text-[10px] font-semibold uppercase text-slate-400">
                          Jumlah Soal
                        </div>
                        <div className="font-mono font-bold text-slate-800 mt-0.5 tabular-nums">
                          {examQuestions.length} Butir
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                        <div className="text-[10px] font-semibold uppercase text-slate-400">
                          Ambang KKM
                        </div>
                        <div className="font-mono font-bold text-slate-800 mt-0.5 tabular-nums">
                          {exam.passingScore} Poin
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500">Validasi Token Proktor</span>
                    </div>

                    {isCompleted ? (
                      <button
                        type="button"
                        onClick={() => setReviewSessionId(mySession.id)}
                        className={`px-4 py-2.5 rounded-lg text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                          exam.showExplanationAfterSubmit
                            ? 'bg-slate-900 hover:bg-slate-800'
                            : 'bg-indigo-900 hover:bg-indigo-800'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        <span>
                          {exam.showExplanationAfterSubmit
                            ? 'Lihat Nilai & Pembahasan'
                            : 'Lihat Nilai Akhir'}
                        </span>
                      </button>
                    ) : isInProgress ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {Object.keys(mySession.answers || {}).length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const done = submitExamSession(mySession.id, false);
                              if (done) {
                                void syncDeviceSessionsToServer(done.id);
                                setReviewSessionId(done.id);
                              }
                            }}
                            className="px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Kumpulkan jawaban yang sudah tersimpan di perangkat ini dan kirim nilai langsung ke server"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>
                              Kumpulkan & Kirim Nilai (
                              {Object.keys(mySession.answers || {}).length} Terjawab)
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveSessionId(mySession.id)}
                          className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Lanjutkan Ujian</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={exam.status !== 'active'}
                        onClick={() => handleOpenTokenModal(exam)}
                        className="px-4 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Kerjakan Ujian</span>
                      </button>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Riwayat Hasil Ujian Siswa */}
        {completedSessions.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Riwayat Hasil & Evaluasi Ujian Anda
              </h2>
              <p className="text-xs text-slate-500">
                Rekapitulasi lembar jawaban yang telah Anda kumpulkan beserta analisis kunci jawaban.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-5">Mata Uji & Kode</th>
                      <th className="py-3.5 px-4">Waktu Selesai</th>
                      <th className="py-3.5 px-4 text-center">Benar / Salah / Kosong</th>
                      <th className="py-3.5 px-4 text-center">Nilai Akhir</th>
                      <th className="py-3.5 px-4 text-center">Status KKM</th>
                      <th className="py-3.5 px-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {completedSessions.map((ses) => {
                      const ex = exams.find((e) => e.id === ses.examId);
                      const kkm = ex?.passingScore ?? 75;
                      const passed = ses.score >= kkm;
                      return (
                        <tr key={ses.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-slate-900">
                              {ex?.title || 'Paket Ujian'}
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                              {ex?.code} • {ex?.subject}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                            {ses.submittedAt
                              ? new Date(ses.submittedAt).toLocaleString('id-ID', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })
                              : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs tabular-nums">
                            <span className="text-emerald-700 font-bold">
                              {ses.correctCount}B
                            </span>{' '}
                            /{' '}
                            <span className="text-red-600 font-bold">
                              {ses.wrongCount}S
                            </span>{' '}
                            /{' '}
                            <span className="text-slate-500">
                              {ses.unansweredCount}K
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-mono font-extrabold text-base text-slate-900 tabular-nums">
                              {ses.score}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${
                                passed
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {passed ? 'TUNTAS (LULUS)' : `REMEDIAL (<${kkm})`}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              type="button"
                              onClick={() => setReviewSessionId(ses.id)}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              {ex?.showExplanationAfterSubmit ? (
                                <>
                                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Pembahasan</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Detail Nilai</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modal 1: Konfirmasi Data Peserta & Input Token Ujian */}
      {selectedExamForToken && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Konfirmasi Sesi & Validasi Token Ujian
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExamForToken(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartExamWithToken} className="p-6 space-y-5">
              {/* Exam & Student Summary Table */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Peserta:</span>
                  <span className="font-bold text-slate-900">{currentUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor Peserta / Kelas:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {currentUser.nomorPeserta} ({currentUser.kelas})
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Mata Ujian:</span>
                  <span className="font-bold text-blue-700">
                    {selectedExamForToken.subject}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jadwal Pelaksanaan:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedExamForToken.examDate || 'Hari Ini'}{' '}
                    {selectedExamForToken.startTime && selectedExamForToken.endTime
                      ? `(${selectedExamForToken.startTime} – ${selectedExamForToken.endTime} WIB)`
                      : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Alokasi Waktu & KKM:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedExamForToken.durationMinutes} Menit • KKM{' '}
                    {selectedExamForToken.passingScore}
                  </span>
                </div>
              </div>

              {/* Instructions List */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Tata Tertib & Petunjuk Pengerjaan:
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 bg-blue-50/40 p-3.5 rounded-lg border border-blue-100">
                  {selectedExamForToken.instructions.map((inst, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-mono font-bold text-blue-700">{idx + 1}.</span>
                      <span>{inst}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Token Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Masukkan Token Ujian (6 Karakter)
                  </label>
                </div>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="Ketik kode token di sini..."
                  className="w-full px-4 py-3 text-center font-mono font-extrabold text-lg tracking-widest uppercase bg-slate-50 border-2 border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600 text-slate-900"
                />
                {tokenError && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{tokenError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedExamForToken(null)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>Mulai Kerjakan Sekarang</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Pembahasan & Review Hasil Ujian */}
      {reviewSession && reviewExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <span className="text-xs font-mono font-bold uppercase text-blue-700">
                  {reviewExam.code} • Hasil Evaluasi CBT
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  {reviewExam.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewSessionId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Score Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">Nilai Akhir Anda</div>
                  <div className="text-3xl font-mono font-extrabold text-blue-700 tabular-nums mt-0.5">
                    {reviewSession.score}
                    <span className="text-sm font-normal text-slate-400"> / 100</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Status Kelulusan (KKM {reviewExam.passingScore})</div>
                  <div className="mt-1.5">
                    {reviewSession.score >= reviewExam.passingScore ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>LULUS KKM</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-100 text-red-800 text-xs font-bold">
                        <XCircle className="w-4 h-4" />
                        <span>BELUM TUNTAS</span>
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Rincian Jawaban</div>
                  <div className="font-mono text-sm font-bold text-slate-800 mt-1 tabular-nums">
                    {reviewSession.correctCount} Benar • {reviewSession.wrongCount} Salah •{' '}
                    {reviewSession.unansweredCount} Kosong
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Total Poin Diperoleh</div>
                  <div className="font-mono text-sm font-bold text-slate-800 mt-1 tabular-nums">
                    {reviewSession.earnedPoints} / {reviewSession.maxPoints} Poin
                  </div>
                </div>
              </div>

              {/* Question-by-Question Review */}
              {reviewExam.showExplanationAfterSubmit ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Analisis Butir Soal & Kunci Pembahasan ({reviewQuestions.length} Soal)
                  </h4>

                  {reviewQuestions.map((q) => {
                    const studentAns = reviewSession.answers[q.id];
                    const isEssay = q.questionType === 'esai';
                    const isCorrect = isEssay
                      ? Boolean(
                          studentAns &&
                            studentAns.trim() &&
                            (!q.essayAnswerKey ||
                              studentAns.trim().toLowerCase() ===
                                q.essayAnswerKey.trim().toLowerCase() ||
                              studentAns
                                .trim()
                                .toLowerCase()
                                .includes(q.essayAnswerKey.trim().toLowerCase()))
                        )
                      : studentAns === q.correctOption;

                    return (
                      <div
                        key={q.id}
                        className={`p-5 rounded-xl border ${
                          isCorrect
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : 'bg-red-50/30 border-red-200'
                        } space-y-3`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-slate-900 text-white">
                              Soal #{q.number}
                            </span>
                            {isEssay ? (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                                Esai
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                Pilihan Ganda
                              </span>
                            )}
                            <span className="text-xs font-semibold text-slate-600">
                              {q.topic}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold">
                            <span>
                              Jawaban Anda:{' '}
                              <strong
                                className={
                                  isCorrect ? 'text-emerald-700' : 'text-red-600'
                                }
                              >
                                {studentAns || 'Kosong'}
                              </strong>
                            </span>
                            <span>•</span>
                            <span className="text-emerald-700">
                              Kunci:{' '}
                              <strong>
                                {isEssay
                                  ? q.essayAnswerKey || 'Pedoman Pembahasan'
                                  : q.correctOption}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {q.imageUrl && (
                          <div className="p-3 rounded-lg bg-white border border-slate-200 flex justify-center">
                            <img
                              src={q.imageUrl}
                              alt={`Foto Soal #${q.number}`}
                              referrerPolicy="no-referrer"
                              className="max-h-56 w-auto object-contain rounded"
                            />
                          </div>
                        )}

                        <div className="text-sm font-semibold text-slate-900">
                          <RichTextContent content={q.questionText} />
                        </div>

                        {!isEssay && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {q.options.map((opt) => {
                              const isKey = opt.id === q.correctOption;
                              const isChosen = opt.id === studentAns;
                              return (
                                <div
                                  key={opt.id}
                                  className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                                    isKey
                                      ? 'bg-emerald-100/70 border-emerald-400 font-semibold text-emerald-950'
                                      : isChosen && !isKey
                                      ? 'bg-red-100/70 border-red-300 text-red-900'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <span className="font-mono font-bold">{opt.id}.</span>
                                  <div className="flex-1">
                                    <RichTextContent content={opt.text} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="p-3.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed">
                            <strong className="text-blue-700 uppercase tracking-wider block mb-1">
                              Pembahasan Resmi:
                            </strong>
                            <RichTextContent content={q.explanation} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center space-y-4 bg-slate-50/80 rounded-xl border border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-2xs">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-900">
                      Kunci & Pembahasan Soal Dinonaktifkan
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Proktor atau Guru pengampu telah mengunci tampilan rincian butir soal dan kunci pembahasan untuk paket ujian ini. Lembar jawaban Anda telah tersimpan resmi dan nilai akhir Anda di atas telah diverifikasi sistem CBT.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/70 text-slate-700 text-[11px] font-mono font-semibold">
                    <span>Status Akses: Terkunci oleh Proktor</span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setReviewSessionId(null)}
                className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Tutup Pembahasan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
