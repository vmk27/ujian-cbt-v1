import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Award,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  ChevronRight,
  Filter,
  ArrowUpRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { ExamPackage, ExamSession, ClassRoom, UserAccount } from '../../types/cbt';

interface ExamVisualSummaryProps {
  onNavigateToGrades?: (examId?: string) => void;
  onNavigateToExams?: () => void;
}

export const ExamVisualSummary: React.FC<ExamVisualSummaryProps> = ({
  onNavigateToGrades,
  onNavigateToExams,
}) => {
  const { exams, sessions, users, classes, appSettings } = useCBT();

  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [activeMetricTab, setActiveMetricTab] = useState<'overview' | 'classes' | 'distribution'>('overview');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const studentUsers = useMemo(() => users.filter((u) => u.role === 'siswa'), [users]);

  // Filtered dataset
  const filteredExams = useMemo(() => {
    if (selectedExamId === 'ALL') return exams;
    return exams.filter((e) => e.id === selectedExamId);
  }, [exams, selectedExamId]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchExam = selectedExamId === 'ALL' || s.examId === selectedExamId;
      const matchClass = selectedClassFilter === 'ALL' || s.studentKelas === selectedClassFilter;
      return matchExam && matchClass;
    });
  }, [sessions, selectedExamId, selectedClassFilter]);

  const completedSessions = useMemo(() => {
    return filteredSessions.filter((s) => s.status === 'completed' || s.status === 'timed_out');
  }, [filteredSessions]);

  const inProgressSessions = useMemo(() => {
    return filteredSessions.filter((s) => s.status === 'in_progress');
  }, [filteredSessions]);

  // Overall metrics
  const totalTargetExpected = useMemo(() => {
    if (selectedExamId === 'ALL') {
      if (selectedClassFilter === 'ALL') {
        return studentUsers.length * Math.max(1, exams.length);
      }
      const studentsInClass = studentUsers.filter((u) => u.kelas === selectedClassFilter).length;
      return studentsInClass * Math.max(1, exams.length);
    }
    const currentExam = exams.find((e) => e.id === selectedExamId);
    if (!currentExam) return studentUsers.length;
    if (selectedClassFilter !== 'ALL') {
      return studentUsers.filter((u) => u.kelas === selectedClassFilter).length;
    }
    if (currentExam.kelasTarget && currentExam.kelasTarget !== 'Semua Kelas XII' && currentExam.kelasTarget !== 'Semua Kelas XI') {
      return studentUsers.filter((u) => u.kelas === currentExam.kelasTarget).length;
    }
    return studentUsers.length;
  }, [selectedExamId, selectedClassFilter, studentUsers, exams]);

  const completionRate = useMemo(() => {
    if (totalTargetExpected === 0) return 0;
    return Math.min(100, Math.round((completedSessions.length / totalTargetExpected) * 100));
  }, [completedSessions, totalTargetExpected]);

  const participationRate = useMemo(() => {
    if (totalTargetExpected === 0) return 0;
    const totalActiveOrDone = completedSessions.length + inProgressSessions.length;
    return Math.min(100, Math.round((totalActiveOrDone / totalTargetExpected) * 100));
  }, [completedSessions, inProgressSessions, totalTargetExpected]);

  const averageScore = useMemo(() => {
    if (completedSessions.length === 0) return 0;
    const sum = completedSessions.reduce((acc, s) => acc + s.score, 0);
    return Math.round((sum / completedSessions.length) * 10) / 10;
  }, [completedSessions]);

  const maxScore = useMemo(() => {
    if (completedSessions.length === 0) return 0;
    return Math.max(...completedSessions.map((s) => s.score));
  }, [completedSessions]);

  const minScore = useMemo(() => {
    if (completedSessions.length === 0) return 0;
    return Math.min(...completedSessions.map((s) => s.score));
  }, [completedSessions]);

  const passedCount = useMemo(() => {
    return completedSessions.filter((s) => {
      const ex = exams.find((e) => e.id === s.examId);
      const kkm = ex?.passingScore ?? 75;
      return s.score >= kkm;
    }).length;
  }, [completedSessions, exams]);

  const passRate = useMemo(() => {
    if (completedSessions.length === 0) return 0;
    return Math.round((passedCount / completedSessions.length) * 100);
  }, [passedCount, completedSessions]);

  // Exam-by-Exam Statistics for Multi-Bar / Comparison Chart
  const examStatsList = useMemo(() => {
    return exams.map((ex) => {
      const exSessions = sessions.filter((s) => {
        const matchExam = s.examId === ex.id;
        const matchClass = selectedClassFilter === 'ALL' || s.studentKelas === selectedClassFilter;
        return matchExam && matchClass;
      });
      const done = exSessions.filter((s) => s.status === 'completed' || s.status === 'timed_out');
      const inProg = exSessions.filter((s) => s.status === 'in_progress');
      const avg = done.length > 0 ? Math.round((done.reduce((acc, s) => acc + s.score, 0) / done.length) * 10) / 10 : 0;
      const targetCount = selectedClassFilter === 'ALL' ? studentUsers.length : studentUsers.filter((u) => u.kelas === selectedClassFilter).length;
      const rate = targetCount > 0 ? Math.min(100, Math.round((done.length / targetCount) * 100)) : 0;
      const passed = done.filter((s) => s.score >= ex.passingScore).length;
      const passPercentage = done.length > 0 ? Math.round((passed / done.length) * 100) : 0;

      return {
        id: ex.id,
        code: ex.code,
        title: ex.title,
        subject: ex.subject,
        kkm: ex.passingScore,
        totalDone: done.length,
        inProg: inProg.length,
        targetCount,
        averageScore: avg,
        completionRate: rate,
        passPercentage,
        passed,
        remedial: done.length - passed,
      };
    });
  }, [exams, sessions, selectedClassFilter, studentUsers]);

  // Class-by-Class Participation and Performance
  const classStatsList = useMemo(() => {
    return classes.map((cls) => {
      const clsStudents = studentUsers.filter((u) => u.kelas === cls.namaKelas);
      const clsSessions = sessions.filter((s) => {
        const matchClass = s.studentKelas === cls.namaKelas;
        const matchExam = selectedExamId === 'ALL' || s.examId === selectedExamId;
        return matchClass && matchExam;
      });
      const done = clsSessions.filter((s) => s.status === 'completed' || s.status === 'timed_out');
      const inProg = clsSessions.filter((s) => s.status === 'in_progress');
      const avg = done.length > 0 ? Math.round((done.reduce((acc, s) => acc + s.score, 0) / done.length) * 10) / 10 : 0;
      const expectedTotal = clsStudents.length * (selectedExamId === 'ALL' ? Math.max(1, exams.length) : 1);
      const rate = expectedTotal > 0 ? Math.min(100, Math.round((done.length / expectedTotal) * 100)) : 0;

      return {
        id: cls.id,
        namaKelas: cls.namaKelas,
        jurusan: cls.jurusan,
        tingkat: cls.tingkat,
        studentCount: clsStudents.length,
        completedCount: done.length,
        inProgressCount: inProg.length,
        expectedTotal,
        participationRate: rate,
        averageScore: avg,
      };
    });
  }, [classes, studentUsers, sessions, selectedExamId, exams]);

  // Class-by-Class Statistics for KKM Comparison Chart (Data Berdasarkan Kelas)
  const classKkmStatsList = useMemo(() => {
    // Determine list of classes to display
    const targetClasses =
      selectedClassFilter === 'ALL'
        ? classes
        : classes.filter((c) => c.namaKelas === selectedClassFilter);

    // Fallback if classes array is empty
    const effectiveClasses =
      targetClasses.length > 0
        ? targetClasses.map((c) => ({
            id: c.id,
            namaKelas: c.namaKelas,
            jurusan: c.jurusan,
            tingkat: c.tingkat,
          }))
        : Array.from(
            new Set(studentUsers.map((u) => u.kelas).filter(Boolean))
          ).map((k) => ({
            id: k,
            namaKelas: k,
            jurusan: 'Umum',
            tingkat: 'XII',
          }));

    return effectiveClasses.map((cls) => {
      const clsStudents = studentUsers.filter((u) => u.kelas === cls.namaKelas);
      const clsSessions = sessions.filter((s) => {
        const matchClass = s.studentKelas === cls.namaKelas;
        const matchExam =
          selectedExamId === 'ALL' || s.examId === selectedExamId;
        return matchClass && matchExam;
      });

      const doneSessions = clsSessions.filter(
        (s) => s.status === 'completed' || s.status === 'timed_out'
      );

      // Average score for this class
      const avgScore =
        doneSessions.length > 0
          ? Math.round(
              (doneSessions.reduce((acc, s) => acc + s.score, 0) /
                doneSessions.length) *
                10
            ) / 10
          : 0;

      // Determine KKM threshold for this class
      let classKkm = appSettings.defaultKkm || 75;
      if (selectedExamId !== 'ALL') {
        const selectedEx = exams.find((e) => e.id === selectedExamId);
        if (selectedEx) classKkm = selectedEx.passingScore;
      } else if (doneSessions.length > 0) {
        const kkmSum = doneSessions.reduce((acc, s) => {
          const ex = exams.find((e) => e.id === s.examId);
          return acc + (ex?.passingScore ?? appSettings.defaultKkm ?? 75);
        }, 0);
        classKkm = Math.round(kkmSum / doneSessions.length);
      } else if (exams.length > 0) {
        classKkm = Math.round(
          exams.reduce((acc, e) => acc + e.passingScore, 0) / exams.length
        );
      }

      const passedCount = doneSessions.filter((s) => {
        const ex = exams.find((e) => e.id === s.examId);
        const kkm = ex?.passingScore ?? classKkm;
        return s.score >= kkm;
      }).length;

      const passPercentage =
        doneSessions.length > 0
          ? Math.round((passedCount / doneSessions.length) * 100)
          : 0;

      return {
        id: cls.id,
        namaKelas: cls.namaKelas,
        jurusan: cls.jurusan,
        tingkat: cls.tingkat,
        studentCount: clsStudents.length,
        totalDone: doneSessions.length,
        averageScore: avgScore,
        kkm: classKkm,
        passedCount,
        passPercentage,
      };
    });
  }, [
    classes,
    selectedClassFilter,
    studentUsers,
    sessions,
    selectedExamId,
    exams,
    appSettings.defaultKkm,
  ]);
  const scoreBands = useMemo(() => {
    const bands = [
      { label: '90 - 100 (A: Amat Baik)', range: '90-100', count: 0, color: '#10B981', bg: 'bg-emerald-500' },
      { label: '80 - 89 (B: Baik)', range: '80-89', count: 0, color: '#3B82F6', bg: 'bg-blue-500' },
      { label: '70 - 79 (C: Cukup)', range: '70-79', count: 0, color: '#F59E0B', bg: 'bg-amber-500' },
      { label: '< 70 (D: Remedial)', range: '<70', count: 0, color: '#EF4444', bg: 'bg-red-500' },
    ];

    completedSessions.forEach((s) => {
      if (s.score >= 90) bands[0].count += 1;
      else if (s.score >= 80) bands[1].count += 1;
      else if (s.score >= 70) bands[2].count += 1;
      else bands[3].count += 1;
    });

    const maxBandCount = Math.max(1, ...bands.map((b) => b.count));
    return bands.map((b) => ({
      ...b,
      percentage: completedSessions.length > 0 ? Math.round((b.count / completedSessions.length) * 100) : 0,
      relativeWidth: Math.round((b.count / maxBandCount) * 100),
    }));
  }, [completedSessions]);

  return (
    <div className="space-y-6">
      {/* Header with Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Visualisasi Data & Statistik Evaluasi CBT
              </h2>
              <p className="text-xs text-slate-500">
                Grafik penyelesaian ujian, analisis rata-rata nilai, dan tingkat partisipasi peserta didik.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter:</span>
          </div>

          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">Semua Paket Ujian ({exams.length})</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                [{ex.code}] {ex.subject}
              </option>
            ))}
          </select>

          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">Semua Kelas ({classes.length})</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.namaKelas}>
                {cls.namaKelas}
              </option>
            ))}
          </select>

          {/* Segmented View Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => setActiveMetricTab('overview')}
              className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${
                activeMetricTab === 'overview'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Komparasi Ujian
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricTab('classes')}
              className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${
                activeMetricTab === 'classes'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Per Rombel / Kelas
            </button>
            <button
              type="button"
              onClick={() => setActiveMetricTab('distribution')}
              className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${
                activeMetricTab === 'distribution'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Distribusi Nilai
            </button>
          </div>
        </div>
      </div>

      {/* 4 Summary Stat Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Tingkat Partisipasi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tingkat Partisipasi
            </span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-mono font-extrabold text-blue-700 tabular-nums">
              {participationRate}%
            </div>
            <div className="text-xs font-mono font-semibold text-slate-500 tabular-nums">
              {completedSessions.length + inProgressSessions.length} / {totalTargetExpected} Sesi
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${participationRate}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Selesai: {completedSessions.length}</span>
            <span>Berjalan: {inProgressSessions.length}</span>
          </div>
        </div>

        {/* Metric 2: Rata-rata Nilai */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Rata-Rata Nilai
            </span>
            <Award className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-mono font-extrabold text-indigo-700 tabular-nums">
              {averageScore}
            </div>
            <div className="text-xs font-mono font-semibold text-slate-500 tabular-nums">
              Rentang {minScore} - {maxScore}
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, averageScore)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Skor Terendah: {minScore}</span>
            <span>Skor Tertinggi: {maxScore}</span>
          </div>
        </div>

        {/* Metric 3: Ketuntasan KKM */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ketuntasan KKM
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-mono font-extrabold text-emerald-700 tabular-nums">
              {passRate}%
            </div>
            <div className="text-xs font-mono font-semibold text-emerald-800 tabular-nums">
              {passedCount} Tuntas
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${passRate}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Tuntas: {passedCount} Siswa</span>
            <span className="text-amber-700">Remedial: {completedSessions.length - passedCount}</span>
          </div>
        </div>

        {/* Metric 4: Kecepatan Penyelesaian */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Penyelesaian Ujian
            </span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-mono font-extrabold text-amber-700 tabular-nums">
              {completionRate}%
            </div>
            <div className="text-xs font-mono font-semibold text-slate-500 tabular-nums">
              {completedSessions.length} Lembar Selesai
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Sedang Berjalan: {inProgressSessions.length}</span>
            <span>Belum Mulai: {Math.max(0, totalTargetExpected - completedSessions.length - inProgressSessions.length)}</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Visual Charts Area */}
      {activeMetricTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column Chart: Komparasi Nilai & KKM Per Kelas / Rombel */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Komparasi Nilai Rata-Rata Terhadap Ambang KKM (Data Per Kelas)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Grafik perbandingan Rata-Rata Nilai vs Ambang KKM untuk masing-masing Rombongan Belajar (Kelas).
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
                    <span className="text-slate-600">Rerata Nilai Kelas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                    <span className="text-slate-600">Ambang KKM</span>
                  </div>
                </div>
              </div>

              {/* Responsive Class-based Bar Comparison Chart */}
              <div className="pt-6 pb-2">
                {classKkmStatsList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Belum ada data kelas / rombel yang tersedia.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {classKkmStatsList.map((item, idx) => {
                      const isHovered = hoveredBarIndex === idx;
                      const isAboveKkm = item.averageScore >= item.kkm;

                      return (
                        <div
                          key={item.id}
                          onMouseEnter={() => setHoveredBarIndex(idx)}
                          onMouseLeave={() => setHoveredBarIndex(null)}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isHovered
                              ? 'bg-blue-50/50 border-blue-300 shadow-2xs'
                              : 'bg-slate-50/70 border-slate-200/80'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200 text-xs">
                                Kelas {item.namaKelas}
                              </span>
                              <span className="text-slate-500 text-[11px] sm:text-xs">
                                ({item.studentCount} Siswa · {item.totalDone} Sesi Selesai)
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono font-semibold tabular-nums text-xs">
                              <span className={isAboveKkm ? 'text-emerald-700 font-bold' : 'text-amber-800'}>
                                Rerata: <strong>{item.averageScore}</strong>
                              </span>
                              <span className="text-slate-400">/</span>
                              <span className="text-slate-600">
                                KKM: <strong>{item.kkm}</strong>
                              </span>
                              <span className="text-slate-400">/</span>
                              <span className={item.passPercentage >= 75 ? 'text-blue-700 font-bold' : 'text-slate-600'}>
                                Ketuntasan: {item.passPercentage}%
                              </span>
                            </div>
                          </div>

                          {/* Visual Bar Comparison Track */}
                          <div className="space-y-1.5">
                            <div className="w-full bg-slate-200/80 rounded-full h-3 overflow-hidden relative">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isAboveKkm ? 'bg-blue-600' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, item.averageScore)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>* Data diperbarui otomatis dari rekaman nilai pengerjaan CBT.</span>
              {onNavigateToGrades && (
                <button
                  type="button"
                  onClick={() => onNavigateToGrades(selectedExamId !== 'ALL' ? selectedExamId : undefined)}
                  className="font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka Leger Nilai Detail</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Donut / Radial Composition of Completion Status */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Komposisi Lembar Jawaban
                  </h3>
                  <p className="text-xs text-slate-500">
                    Status partisipasi seluruh target ujian.
                  </p>
                </div>
                <PieChartIcon className="w-4 h-4 text-slate-400" />
              </div>

              {/* Radial Visual Circle Representation */}
              <div className="py-6 flex flex-col items-center justify-center">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#F1F5F9"
                      strokeWidth="12"
                      fill="transparent"
                    />
                    {/* Completed Arc */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#10B981"
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={`${2.51 * completionRate} 251`}
                      strokeLinecap="round"
                    />
                    {/* In Progress Arc */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#3B82F6"
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={`${2.51 * Math.min(100, (inProgressSessions.length / Math.max(1, totalTargetExpected)) * 100)} 251`}
                      strokeDashoffset={`-${2.51 * completionRate}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-2xl font-mono font-extrabold text-slate-900 block tabular-nums">
                      {completionRate}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Selesai
                    </span>
                  </div>
                </div>
              </div>

              {/* Legend List */}
              <div className="space-y-2.5 pt-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-emerald-900">Ujian Selesai (Tuntas & Dikumpulkan)</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-800 tabular-nums">
                    {completedSessions.length} Sesi
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/60 border border-blue-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="font-semibold text-blue-900">Sedang Berlangsung di Lab</span>
                  </div>
                  <span className="font-mono font-bold text-blue-800 tabular-nums">
                    {inProgressSessions.length} Sesi
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span className="font-medium text-slate-600">Belum Mengakses Ujian</span>
                  </div>
                  <span className="font-mono font-semibold text-slate-700 tabular-nums">
                    {Math.max(0, totalTargetExpected - completedSessions.length - inProgressSessions.length)} Sesi
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
              Total Kuota Target: <strong className="text-slate-700 font-mono">{totalTargetExpected}</strong> peserta didik
            </div>
          </div>
        </div>
      )}

      {/* View Tab 2: Per Rombel / Kelas */}
      {activeMetricTab === 'classes' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Statistik Partisipasi & Nilai Berdasarkan Rombongan Belajar (Kelas)
              </h3>
              <p className="text-xs text-slate-500">
                Tinjau tingkat kehadiran peserta dan rata-rata perolehan nilai setiap ruang rombel kelas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classStatsList.map((cls) => (
              <div
                key={cls.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 space-y-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{cls.namaKelas}</h4>
                    <span className="text-[11px] text-slate-500">
                      Peminatan {cls.jurusan} • {cls.studentCount} Siswa
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {cls.participationRate}% Hadir
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Partisipasi Ujian:</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {cls.completedCount} / {cls.expectedTotal} Selesai
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${cls.participationRate}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Rerata Nilai Kelas:</span>
                  <span className="font-mono font-extrabold text-blue-700 text-sm tabular-nums">
                    {cls.averageScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Tab 3: Distribusi Nilai Siswa */}
      {activeMetricTab === 'distribution' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Histogram Bar Chart */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Distribusi Sebaran Nilai Peserta Didik
              </h3>
              <p className="text-xs text-slate-500">
                Histogram frekuensi pengelompokan predikat nilai ujian (Rentang 0 - 100).
              </p>
            </div>

            <div className="space-y-4">
              {scoreBands.map((band, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-xs inline-block" style={{ backgroundColor: band.color }} />
                      <span className="font-bold text-slate-900">{band.label}</span>
                    </div>
                    <div className="font-mono font-bold text-slate-700 tabular-nums">
                      {band.count} Siswa ({band.percentage}%)
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(band.count > 0 ? 5 : 0, band.relativeWidth)}%`,
                        backgroundColor: band.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-950 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Total <strong>{completedSessions.length}</strong> lembar jawaban telah diperiksa. Tingkat kelulusan di atas KKM mencapai <strong>{passRate}%</strong> ({passedCount} siswa tuntas).
              </div>
            </div>
          </div>

          {/* Quick Exam Overview Table */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  Ringkasan Ketuntasan Per Mata Ujian
                </h3>
                <p className="text-xs text-slate-500">
                  Perbandingan kelulusan KKM per paket soal.
                </p>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {examStatsList.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">{item.subject}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {item.code} • KKM {item.kkm}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-emerald-700 tabular-nums">
                        {item.passPercentage}% Tuntas
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {item.passed} Lulus / {item.remedial} Remedial
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {onNavigateToExams && (
              <button
                type="button"
                onClick={onNavigateToExams}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Kelola Paket & Jadwal Ujian</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
