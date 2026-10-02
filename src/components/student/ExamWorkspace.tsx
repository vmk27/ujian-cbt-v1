import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Send,
  ShieldAlert,
  BookOpen,
  Keyboard,
  LayoutGrid,
  X,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { ExamPackage, ExamSession, OptionLetter, Question } from '../../types/cbt';
import { isExamScheduleExpired } from '../../utils/examAccess';
import { RichTextContent } from '../common/RichTextEditor';

interface ExamWorkspaceProps {
  exam: ExamPackage;
  session: ExamSession;
  questions: Question[];
  onFinishExam: (completedSessionId: string) => void;
  onExitToLobby: () => void;
}

function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

export const ExamWorkspace: React.FC<ExamWorkspaceProps> = ({
  exam,
  session,
  questions,
  onFinishExam,
  onExitToLobby,
}) => {
  const {
    saveAnswer,
    toggleDoubtFlag,
    tickSessionTimer,
    recordTabSwitch,
    submitExamSession,
    showToast,
  } = useCBT();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [fontScale, setFontScale] = useState<'sm' | 'base' | 'lg'>('base');
  const [localSeconds, setLocalSeconds] = useState<number>(session.remainingSeconds);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTimeOutModal, setShowTimeOutModal] = useState(false);
  const [timeOutReason, setTimeOutReason] = useState<'schedule_expired' | 'duration_zero'>('duration_zero');
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [mobileMatrixOpen, setMobileMatrixOpen] = useState(false);

  const currentQuestion = questions[currentIndex];
  const secondsRef = useRef<number>(session.remainingSeconds);
  const autoSubmittedRef = useRef<boolean>(false);
  const callbacksRef = useRef({
    submitExamSession,
    tickSessionTimer,
    onFinishExam,
  });

  useEffect(() => {
    callbacksRef.current = {
      submitExamSession,
      tickSessionTimer,
      onFinishExam,
    };
  }, [submitExamSession, tickSessionTimer, onFinishExam]);

  // Check if schedule time has expired
  const checkIsScheduleExpired = useCallback(() => {
    return isExamScheduleExpired(exam);
  }, [exam]);

  // Check on mount if schedule is already expired
  useEffect(() => {
    if (checkIsScheduleExpired() && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      setTimeOutReason('schedule_expired');
      setShowSubmitModal(false);
      setShowTimeOutModal(true);
      const finished = callbacksRef.current.submitExamSession(session.id, true);
      if (finished) {
        setTimeout(() => {
          callbacksRef.current.onFinishExam(finished.id);
        }, 4000);
      }
    }
  }, [checkIsScheduleExpired, session.id]);

  // Countdown timer & schedule expiration checker
  useEffect(() => {
    secondsRef.current = session.remainingSeconds;
    autoSubmittedRef.current = false;
    setLocalSeconds(session.remainingSeconds);
  }, [session.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Cek apabila jam jadwal ujian telah selesai (misal jam berakhir 09:00)
      if (checkIsScheduleExpired()) {
        clearInterval(interval);
        if (!autoSubmittedRef.current) {
          autoSubmittedRef.current = true;
          setTimeOutReason('schedule_expired');
          setShowSubmitModal(false);
          setShowTimeOutModal(true);
          showToast(
            '⏰ Waktu Ujian Selesai!',
            'Jadwal pelaksanaan ujian untuk paket ini telah berakhir. Sesi Anda dikumpulkan otomatis.',
            'error'
          );
          const finished = callbacksRef.current.submitExamSession(session.id, true);
          if (finished) {
            setTimeout(() => {
              callbacksRef.current.onFinishExam(finished.id);
            }, 4000);
          }
        }
        return;
      }

      // 2. Cek apabila durasi timer telah habis
      const prev = secondsRef.current;
      if (prev <= 1) {
        secondsRef.current = 0;
        setLocalSeconds(0);
        clearInterval(interval);
        if (!autoSubmittedRef.current) {
          autoSubmittedRef.current = true;
          setTimeOutReason('duration_zero');
          setShowSubmitModal(false);
          setShowTimeOutModal(true);
          showToast(
            '⏰ Waktu Ujian Selesai!',
            'Durasi pengerjaan ujian Anda telah habis. Jawaban Anda berhasil dikumpulkan otomatis.',
            'error'
          );
          const finished = callbacksRef.current.submitExamSession(session.id, true);
          if (finished) {
            setTimeout(() => {
              callbacksRef.current.onFinishExam(finished.id);
            }, 4000);
          }
        }
        return;
      }

      const next = prev - 1;
      secondsRef.current = next;
      setLocalSeconds(next);
      if (next % 5 === 0) {
        callbacksRef.current.tickSessionTimer(session.id, next);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [checkIsScheduleExpired, session.id]);

  // Tab switch / visibility loss anti-cheat detector
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordTabSwitch(session.id);
        showToast(
          'Peringatan Pengawas Integritas',
          'Terdeteksi perpindahan fokus/tab keluar dari ruang ujian. Aktivitas ini tercatat di sistem Proktor.',
          'warning'
        );
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session.id]);

  const handleSelectOption = useCallback(
    (letter: OptionLetter) => {
      if (!currentQuestion || autoSubmittedRef.current || localSeconds <= 0) return;
      saveAnswer(session.id, currentQuestion.id, letter);
    },
    [currentQuestion, saveAnswer, session.id, localSeconds]
  );

  const handleToggleDoubt = useCallback(() => {
    if (!currentQuestion || autoSubmittedRef.current || localSeconds <= 0) return;
    toggleDoubtFlag(session.id, currentQuestion.id);
  }, [currentQuestion, toggleDoubtFlag, session.id, localSeconds]);

  // Keyboard shortcuts for fast CBT operation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSubmitModal) return;
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      if (
        currentQuestion?.questionType !== 'esai' &&
        ['A', 'B', 'C', 'D', 'E'].includes(key)
      ) {
        e.preventDefault();
        handleSelectOption(key as OptionLetter);
      } else if (key === 'R') {
        e.preventDefault();
        handleToggleDoubt();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectOption, handleToggleDoubt, questions.length, showSubmitModal]);

  if (!currentQuestion) {
    return null;
  }

  const selectedAnswer = session.answers[currentQuestion.id] || '';
  const isEssayQuestion = currentQuestion.questionType === 'esai';
  const isDoubt = !!session.doubtFlags[currentQuestion.id];

  const totalQuestions = questions.length;
  const answeredCount = questions.filter(
    (q) => Boolean(session.answers[q.id] && String(session.answers[q.id]).trim())
  ).length;
  const doubtCount = questions.filter((q) => !!session.doubtFlags[q.id]).length;
  const unansweredCount = totalQuestions - answeredCount;

  // Logika pembatasan minimal 1/2 durasi pengerjaan
  const totalDurationSeconds = (exam.durationMinutes || 45) * 60;
  const elapsedSeconds = Math.max(0, totalDurationSeconds - localSeconds);
  const halfDurationSeconds = Math.floor(totalDurationSeconds / 2);
  const minHalfRequired = Boolean(exam.minHalfDurationSubmitRequired);

  const isHalfTimeReached = elapsedSeconds >= halfDurationSeconds;
  const isExpired = autoSubmittedRef.current || localSeconds <= 0 || checkIsScheduleExpired();
  const isSubmitAllowed = !minHalfRequired || isHalfTimeReached || isExpired;
  const secondsRemainingToHalf = Math.max(0, halfDurationSeconds - elapsedSeconds);

  const isTimerWarning = localSeconds <= 300 && localSeconds > 60;
  const isTimerCritical = localSeconds <= 60;

  const fontSizeClass =
    fontScale === 'sm'
      ? 'text-sm leading-relaxed'
      : fontScale === 'lg'
      ? 'text-lg leading-relaxed'
      : 'text-base leading-relaxed';

  const handleConfirmSubmit = () => {
    tickSessionTimer(session.id, localSeconds);
    const finished = submitExamSession(session.id, false);
    setShowSubmitModal(false);
    if (finished) {
      onFinishExam(finished.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col select-none">
      {/* Sticky Top Exam Header */}
      <header className="sticky top-0 z-30 min-h-14 py-2 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#1D4ED8] text-white font-mono font-bold text-xs sm:text-sm flex items-center justify-center shrink-0">
            CBT
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                {exam.code}
              </span>
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[120px] sm:max-w-xs md:max-w-md">
                {exam.title}
              </h1>
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 truncate hidden sm:block">
              Peserta: <span className="font-semibold text-slate-700">{session.studentName}</span> ({session.studentNomorPeserta} • {session.studentKelas})
            </div>
          </div>
        </div>

        {/* Right Controls: Font Size, Integrity Badge, Countdown Timer, Mobile Matrix Button */}
        <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
          {/* Font Size Controller */}
          <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 px-2">Ukuran Teks:</span>
            <button
              type="button"
              onClick={() => setFontScale('sm')}
              className={`px-2 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                fontScale === 'sm'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontScale('base')}
              className={`px-2 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                fontScale === 'base'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontScale('lg')}
              className={`px-2 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                fontScale === 'lg'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A+
            </button>
          </div>

          {/* Integrity Indicator if student switched tabs */}
          {session.tabSwitchCount > 0 && (
            <div
              title="Jumlah perpindahan tab yang tercatat oleh pengawas sistem"
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span className="tabular-nums">Tab: {session.tabSwitchCount}x</span>
            </div>
          )}

          {/* Live Countdown Timer */}
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg border font-mono font-bold text-xs sm:text-base tabular-nums transition-colors ${
              isTimerCritical
                ? 'bg-red-600 text-white border-red-700 animate-pulse'
                : isTimerWarning
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>{formatSeconds(localSeconds)}</span>
          </div>

          {/* Mobile Question Matrix Drawer Button */}
          <button
            type="button"
            onClick={() => setMobileMatrixOpen(true)}
            className="lg:hidden p-1.5 sm:p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 cursor-pointer shrink-0"
            aria-label="Daftar Nomor Soal"
          >
            <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Back to Lobby (Pause/Save) */}
          <button
            type="button"
            onClick={() => {
              tickSessionTimer(session.id, localSeconds);
              onExitToLobby();
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <span>Simpan & Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Question Stem & Options Canvas (72% / 8.5 cols -> 8 cols on 12-col grid) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-5">
          {/* Visual Progress Bar Component */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Progress Pengerjaan:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                  {answeredCount} dari {totalQuestions} Soal Terjawab
                </span>
                {doubtCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700 animate-pulse">
                    {doubtCount} Ragu-Ragu
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-blue-700">{totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0}% Selesai</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-[#1D4ED8] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Question Metadata Subheader */}
            <div className="px-4 sm:px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-[#1D4ED8] text-white font-mono font-bold text-sm tabular-nums">
                  SOAL NO. {String(currentQuestion.number).padStart(2, '0')} /{' '}
                  {String(totalQuestions).padStart(2, '0')}
                </span>
                {isEssayQuestion ? (
                  <span className="text-xs font-bold uppercase px-2.5 py-1 rounded bg-purple-100 text-purple-800 border border-purple-300">
                    Soal Esai / Uraian
                  </span>
                ) : (
                  <span className="text-xs font-bold uppercase px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Pilihan Ganda
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200">
                  Topik: {currentQuestion.topic}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-mono font-semibold text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 tabular-nums">
                  Bobot: {currentQuestion.points} Poin
                </span>
                {isDoubt ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded">
                    <Flag className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                    <span>Ragu-Ragu</span>
                  </span>
                ) : selectedAnswer.trim() ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Terjawab ({isEssayQuestion ? 'Esai' : selectedAnswer})
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                    <span>Belum Dijawab</span>
                  </span>
                )}
              </div>
            </div>

            {/* Question Body */}
            <div className="p-4 sm:p-8 space-y-5 sm:space-y-6">
              {/* Optional Stimulus / Reading Passage */}
              {currentQuestion.stimulus && (
                <div className="p-5 rounded-lg bg-[#F7F6F2] border border-slate-200/90 border-l-4 border-l-blue-700 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                    <span>Wacana / Stimulus Soal</span>
                  </div>
                  <div className={`text-slate-800 font-normal ${fontSizeClass}`}>
                    <RichTextContent content={currentQuestion.stimulus} />
                  </div>
                </div>
              )}

              {/* Optional Attached Photo Document from Supabase Bucket (app-file) */}
              {currentQuestion.imageUrl && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-2">
                  <img
                    src={currentQuestion.imageUrl}
                    alt={`Lampiran Foto Soal Nomor ${currentQuestion.number}`}
                    referrerPolicy="no-referrer"
                    className="max-h-80 w-auto object-contain rounded-lg border border-slate-200 bg-white p-2"
                  />
                </div>
              )}

              {/* Question Stem */}
              <div className={`font-semibold text-slate-900 ${fontSizeClass}`}>
                <RichTextContent content={currentQuestion.questionText} />
              </div>

              {/* Multiple Choice Options A - E OR Essay Textarea */}
              {isEssayQuestion ? (
                <div className="space-y-2.5 pt-2 select-text">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-purple-800">
                      Lembar Jawaban Esai / Uraian Anda:
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {selectedAnswer.trim()
                        ? `Tersimpan otomatis (${selectedAnswer.trim().length} karakter)`
                        : 'Ketik jawaban Anda di bawah ini'}
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={selectedAnswer}
                    disabled={autoSubmittedRef.current || localSeconds <= 0}
                    onChange={(e) =>
                      saveAnswer(session.id, currentQuestion.id, e.target.value)
                    }
                    placeholder="Ketik jawaban uraian / esai Anda secara jelas dan lengkap di sini..."
                    className={`w-full p-4 rounded-xl border-2 bg-slate-50/70 focus:bg-white text-slate-900 focus:outline-none transition-colors ${fontSizeClass} ${
                      selectedAnswer.trim()
                        ? isDoubt
                          ? 'border-amber-500 focus:border-amber-600'
                          : 'border-purple-600 focus:border-purple-700'
                        : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {currentQuestion.options.map((option) => {
                    const isSelected = selectedAnswer === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelectOption(option.id)}
                        className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all flex items-start gap-3 sm:gap-4 cursor-pointer group ${
                          isSelected
                            ? isDoubt
                              ? 'border-amber-500 bg-amber-50/50 shadow-2xs'
                              : 'border-[#1D4ED8] bg-blue-50/60 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-lg font-mono font-bold text-sm flex items-center justify-center shrink-0 border transition-colors ${
                            isSelected
                              ? isDoubt
                                ? 'bg-amber-500 text-white border-amber-600'
                                : 'bg-[#1D4ED8] text-white border-blue-800'
                              : 'bg-slate-100 text-slate-700 border-slate-300 group-hover:border-slate-400'
                          }`}
                        >
                          {option.id}
                        </span>
                        <div
                          className={`flex-1 min-w-0 break-words pt-0.5 ${fontSizeClass} ${
                            isSelected
                              ? 'font-semibold text-slate-900'
                              : 'text-slate-700'
                          }`}
                        >
                          <RichTextContent content={option.text} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Action Bar Inside Question Card */}
            <div className="px-3 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 grid grid-cols-3 sm:flex sm:flex-wrap items-center justify-between gap-2">
              {/* Previous Question */}
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="truncate">Sebelumnya</span>
              </button>

              {/* Ragu-Ragu Toggle (Amber) */}
              <button
                type="button"
                onClick={handleToggleDoubt}
                className={`px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 border transition-all cursor-pointer ${
                  isDoubt
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isDoubt}
                  readOnly
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 accent-amber-700 rounded pointer-events-none shrink-0"
                />
                <span className="truncate">Ragu-Ragu</span>
              </button>

              {/* Next Question or Finish */}
              {currentIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))
                  }
                  className="px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <span className="truncate">Selanjutnya</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmCheck(false);
                    setShowSubmitModal(true);
                  }}
                  className="px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span className="truncate">Kumpulkan</span>
                </button>
              )}
            </div>
          </div>

          {/* Keyboard Navigation Hint Bar */}
          <div className="hidden sm:flex items-center justify-between px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-500">
            <div className="flex items-center gap-2 font-medium text-slate-600">
              <Keyboard className="w-4 h-4 text-blue-600" />
              <span>Pintasan Papan Ketik (Keyboard Shortcuts):</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">
                  A
                </kbd>
                -
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">
                  E
                </kbd>{' '}
                Pilih Jawaban
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">
                  R
                </kbd>{' '}
                Tandai Ragu-Ragu
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">
                  ←
                </kbd>{' '}
                /{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700">
                  →
                </kbd>{' '}
                Pindah Nomor
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Question Matrix Navigation Dock (Desktop) */}
        <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-22">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Navigasi Nomor Soal
              </h2>
              <span className="text-xs font-mono font-bold text-slate-600 tabular-nums">
                {answeredCount}/{totalQuestions} Terjawab
              </span>
            </div>

            <div className="p-5 space-y-5">
              {/* Progress Bar */}
              <div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{
                      width: `${Math.round((answeredCount / totalQuestions) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="font-mono font-bold text-sm text-emerald-800 tabular-nums">
                      {answeredCount}
                    </div>
                    <div className="text-[10px] font-semibold uppercase text-emerald-700">
                      Dijawab
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="font-mono font-bold text-sm text-amber-800 tabular-nums">
                      {doubtCount}
                    </div>
                    <div className="text-[10px] font-semibold uppercase text-amber-700">
                      Ragu-Ragu
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-mono font-bold text-sm text-slate-700 tabular-nums">
                      {unansweredCount}
                    </div>
                    <div className="text-[10px] font-semibold uppercase text-slate-500">
                      Kosong
                    </div>
                  </div>
                </div>
              </div>

              {/* 5-Column Question Number Grid */}
              <div className="grid grid-cols-5 gap-2.5">
                {questions.map((q, idx) => {
                  const ans = session.answers[q.id];
                  const flagged = !!session.doubtFlags[q.id];
                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative h-11 rounded-lg font-mono font-bold text-xs tabular-nums border transition-all flex flex-col items-center justify-center cursor-pointer ${
                        isCurrent ? 'ring-2 ring-offset-2 ring-blue-600 ' : ''
                      }${
                        flagged
                          ? 'bg-amber-500 text-white border-amber-600'
                          : ans
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>{q.number}</span>
                      {ans && String(ans).trim() && (
                        <span
                          className={`text-[9px] leading-none px-1 rounded font-extrabold max-w-[36px] truncate ${
                            flagged
                              ? 'bg-amber-700 text-white'
                              : 'bg-emerald-800 text-emerald-100'
                          }`}
                        >
                          {q.questionType === 'esai' ? 'ESAI' : ans}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block"></span>
                  <span>Sudah Dijawab</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block"></span>
                  <span>Ditandai Ragu-Ragu</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-xs bg-white border border-slate-300 inline-block"></span>
                  <span>Belum Dijawab</span>
                </div>
              </div>

              {/* Final Submit Trigger */}
              <div className="pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmCheck(false);
                    setShowSubmitModal(true);
                  }}
                  className="w-full py-3 px-4 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Kumpulkan Lembar Ujian</span>
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Question Matrix Drawer */}
      {mobileMatrixOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="w-80 max-w-full bg-white h-full p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                  Daftar Nomor Soal
                </h3>
                <button
                  type="button"
                  onClick={() => setMobileMatrixOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const ans = session.answers[q.id];
                  const flagged = !!session.doubtFlags[q.id];
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setMobileMatrixOpen(false);
                      }}
                      className={`h-11 rounded-lg font-mono font-bold text-xs tabular-nums border flex flex-col items-center justify-center ${
                        isCurrent ? 'ring-2 ring-blue-600 ' : ''
                      }${
                        flagged
                          ? 'bg-amber-500 text-white border-amber-600'
                          : ans
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <span>{q.number}</span>
                      {ans && String(ans).trim() && (
                        <span className="text-[9px] max-w-[36px] truncate">
                          {q.questionType === 'esai' ? 'ESAI' : ans}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMatrixOpen(false);
                setConfirmCheck(false);
                setShowSubmitModal(true);
              }}
              className="w-full py-3 px-4 rounded-lg bg-[#1D4ED8] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Kumpulkan Ujian</span>
            </button>
          </div>
        </div>
      )}

      {/* Submit Exam Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Konfirmasi Pengumpulan Lembar Jawaban
              </h3>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Status Summary Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                <div className="p-2.5 sm:p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-lg sm:text-xl font-mono font-extrabold text-emerald-700 tabular-nums">
                    {answeredCount}
                  </div>
                  <div className="text-[11px] sm:text-xs font-semibold text-emerald-800">Soal Dijawab</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-lg sm:text-xl font-mono font-extrabold text-amber-700 tabular-nums">
                    {doubtCount}
                  </div>
                  <div className="text-[11px] sm:text-xs font-semibold text-amber-800">Ragu-Ragu</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-lg sm:text-xl font-mono font-extrabold text-slate-700 tabular-nums">
                    {unansweredCount}
                  </div>
                  <div className="text-[11px] sm:text-xs font-semibold text-slate-600">Belum Dijawab</div>
                </div>
              </div>

              {/* Warnings if unanswered or doubt exists */}
              {(unansweredCount > 0 || doubtCount > 0) && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 space-y-1 leading-relaxed">
                    <div className="font-bold">Perhatian Sebelum Mengakhiri Ujian:</div>
                    {unansweredCount > 0 && (
                      <p>• Masih terdapat {unansweredCount} butir soal yang belum Anda jawab.</p>
                    )}
                    {doubtCount > 0 && (
                      <p>
                        • Masih terdapat {doubtCount} butir soal yang berstatus{' '}
                        <strong>Ragu-Ragu</strong>.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Warning jika belum memenuhi minimal 1/2 durasi pengerjaan */}
              {minHalfRequired && !isHalfTimeReached && !isExpired && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Belum Memenuhi Minimal 1/2 Durasi Ujian:</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Aturan paket ujian ini mengharuskan Anda mengerjakan minimal{' '}
                    <strong>
                      1/2 (separuh) dari total durasi ({exam.durationMinutes} menit, yaitu minimal{' '}
                      {Math.ceil(exam.durationMinutes / 2)} menit)
                    </strong>{' '}
                    sebelum diperbolehkan mengumpulkan lembar jawaban.
                  </p>
                  <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono font-bold">
                    <span className="text-slate-700">Waktu Berjalan: {formatSeconds(elapsedSeconds)}</span>
                    <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      Terbuka Dalam: {formatSeconds(secondsRemainingToHalf)}
                    </span>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmCheck}
                  onChange={(e) => setConfirmCheck(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-600 rounded"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  Saya menyatakan telah memeriksa seluruh jawaban dengan teliti. Setelah
                  dikumpulkan, saya tidak dapat mengubah jawaban pada sesi ujian ini lagi.
                </span>
              </label>
            </div>

            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Kembali ke Soal
              </button>
              <button
                type="button"
                disabled={!confirmCheck || !isSubmitAllowed}
                onClick={handleConfirmSubmit}
                className="w-full sm:w-auto px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Ya, Kumpulkan Jawaban Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automatic Time-out / Schedule Expired Popup Modal */}
      {showTimeOutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 text-center space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center mx-auto shadow-2xs">
              <Clock className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900">
                {timeOutReason === 'schedule_expired'
                  ? 'Jadwal Pelaksanaan Ujian Telah Berakhir!'
                  : 'Waktu Ujian Telah Selesai!'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                {timeOutReason === 'schedule_expired'
                  ? 'Batas jam pelaksanaan ujian untuk paket ini telah selesai. Anda tidak diperbolehkan mengisi atau mengubah jawaban lagi.'
                  : 'Durasi waktu pengerjaan ujian Anda telah habis. Anda tidak diperbolehkan mengisi atau mengubah jawaban lagi.'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-left font-mono">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 text-slate-600">
                <span>Paket Ujian:</span>
                <strong className="text-slate-900 sm:text-right break-words">[{exam.code}] {exam.subject}</strong>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 text-slate-600">
                <span>Status Sesi:</span>
                <strong className="text-emerald-700 sm:text-right">Jawaban Tersimpan Otomatis</strong>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 text-slate-600">
                <span>Total Jawaban Terisi:</span>
                <strong className="text-blue-700 sm:text-right">{answeredCount} / {totalQuestions} Soal</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const finished = submitExamSession(session.id, true);
                onFinishExam(finished?.id || session.id);
              }}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Lihat Hasil & Selesaikan Sesi</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
