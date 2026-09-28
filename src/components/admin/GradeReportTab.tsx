import React, { useMemo, useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { findMatchingStudentForSession, integrateSessionWithStudents } from '../../lib/supabase';
import { canStudentAccessExam } from '../../utils/examAccess';

interface GradeReportRow {
  no: number; // Nomor Auto-Increment
  studentId: string;
  nisn: string;
  namaLengkap: string;
  nomorPeserta: string;
  kelas: string;
  mataUji: string;
  nilai: number | null;
  kkm: number;
  predikat: string;
  predikatCode: 'A' | 'B' | 'C' | 'D' | '-';
  keterangan: string;
  isPassed: boolean;
  hasTakenExam: boolean;
}

function computePredikat(score: number | null, kkm: number): {
  code: 'A' | 'B' | 'C' | 'D' | '-';
  label: string;
} {
  if (score === null) {
    return { code: '-', label: '-' };
  }
  if (score >= 90) {
    return { code: 'A', label: 'A (Sangat Baik)' };
  }
  if (score >= 80) {
    return { code: 'B', label: 'B (Baik)' };
  }
  if (score >= kkm) {
    return { code: 'C', label: 'C (Cukup)' };
  }
  return { code: 'D', label: 'D (Kurang)' };
}

function computeKeterangan(score: number | null, kkm: number): {
  text: string;
  passed: boolean;
} {
  if (score === null) {
    return { text: 'Belum Mengikuti Ujian', passed: false };
  }
  if (score >= kkm) {
    return { text: 'Lulus / Tuntas KKM', passed: true };
  }
  return { text: 'Remedial / Belum Tuntas', passed: false };
}

export const GradeReportTab: React.FC = () => {
  const { appSettings, classes, users, exams, sessions, showToast } = useCBT();

  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || 'ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'REMEDIAL' | 'NOT_YET'>('ALL');
  const [includeUntestedStudents, setIncludeUntestedStudents] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reportDate, setReportDate] = useState<string>(
    new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  );

  const students = useMemo(() => users.filter((u) => u.role === 'siswa'), [users]);

  const classOptions = useMemo(() => {
    const set = new Set<string>(classes.map((c) => c.namaKelas));
    students.forEach((s) => {
      if (s.kelas) set.add(s.kelas);
    });
    return Array.from(set);
  }, [classes, students]);

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId),
    [exams, selectedExamId]
  );

  const reportRows = useMemo<GradeReportRow[]>(() => {
    const rawRows: Omit<GradeReportRow, 'no'>[] = [];
    const reconciledSessions = sessions.map(
      (s) => integrateSessionWithStudents(s, students).session
    );

    if (selectedExamId !== 'ALL' && selectedExam) {
      const kkm = selectedExam.passingScore || appSettings.defaultKkm || 75;
      const examSessions = reconciledSessions.filter((s) => s.examId === selectedExam.id);
      const matchedSessionIds = new Set<string>();

      for (const st of students) {
        const ses = examSessions.find((s) => {
          if (s.studentId === st.id) return true;
          const matched = findMatchingStudentForSession(s, [st]);
          return Boolean(matched);
        });
        if (ses) {
          matchedSessionIds.add(ses.id);
        } else {
          if (!includeUntestedStudents) continue;
          // Jangan tampilkan siswa dari angkatan/kelas lain pada jadwal/laporan ujian angkatan berbeda
          if (!canStudentAccessExam(st, selectedExam, classes)) continue;
        }

        const score = ses ? ses.score : null;
        const pred = computePredikat(score, kkm);
        const ket = computeKeterangan(score, kkm);

        rawRows.push({
          studentId: st.id,
          nisn: st.username,
          namaLengkap: st.name,
          nomorPeserta: st.nomorPeserta,
          kelas: st.kelas,
          mataUji: `${selectedExam.subject} (${selectedExam.code})`,
          nilai: score,
          kkm,
          predikat: pred.label,
          predikatCode: pred.code,
          keterangan: ket.text,
          isPassed: ket.passed,
          hasTakenExam: Boolean(ses),
        });
      }

      // Also include any exam session from a student device whose student record wasn't matched above
      for (const ses of examSessions) {
        if (matchedSessionIds.has(ses.id)) continue;
        const pred = computePredikat(ses.score, kkm);
        const ket = computeKeterangan(ses.score, kkm);
        rawRows.push({
          studentId: ses.studentId,
          nisn: ses.studentUsername,
          namaLengkap: ses.studentName,
          nomorPeserta: ses.studentNomorPeserta,
          kelas: ses.studentKelas,
          mataUji: `${selectedExam.subject} (${selectedExam.code})`,
          nilai: ses.score,
          kkm,
          predikat: pred.label,
          predikatCode: pred.code,
          keterangan: ket.text,
          isPassed: ket.passed,
          hasTakenExam: true,
        });
      }
    } else {
      // All completed/in-progress sessions across all exams (integrated with public.students)
      for (const ses of reconciledSessions) {
        const ex = exams.find((e) => e.id === ses.examId);
        const kkm = ex?.passingScore || appSettings.defaultKkm || 75;
        const pred = computePredikat(ses.score, kkm);
        const ket = computeKeterangan(ses.score, kkm);

        rawRows.push({
          studentId: ses.studentId,
          nisn: ses.studentUsername,
          namaLengkap: ses.studentName,
          nomorPeserta: ses.studentNomorPeserta,
          kelas: ses.studentKelas,
          mataUji: ex ? `${ex.subject} (${ex.code})` : 'Ujian CBT',
          nilai: ses.score,
          kkm,
          predikat: pred.label,
          predikatCode: pred.code,
          keterangan: ket.text,
          isPassed: ket.passed,
          hasTakenExam: true,
        });
      }
    }

    const q = searchQuery.trim().toLowerCase();
    const filtered = rawRows.filter((r) => {
      const matchClass = classFilter === 'ALL' || r.kelas === classFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PASSED' && r.hasTakenExam && r.isPassed) ||
        (statusFilter === 'REMEDIAL' && r.hasTakenExam && !r.isPassed) ||
        (statusFilter === 'NOT_YET' && !r.hasTakenExam);
      const matchQuery =
        !q ||
        r.namaLengkap.toLowerCase().includes(q) ||
        r.nisn.toLowerCase().includes(q) ||
        r.kelas.toLowerCase().includes(q) ||
        r.predikat.toLowerCase().includes(q) ||
        r.keterangan.toLowerCase().includes(q);
      return matchClass && matchStatus && matchQuery;
    });

    // Assign Auto-Increment Number (1, 2, 3, ...)
    return filtered.map((r, index) => ({
      ...r,
      no: index + 1,
    }));
  }, [
    selectedExamId,
    selectedExam,
    appSettings.defaultKkm,
    sessions,
    students,
    includeUntestedStudents,
    exams,
    searchQuery,
    classFilter,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const tested = reportRows.filter((r) => r.nilai !== null);
    const passed = tested.filter((r) => r.isPassed).length;
    const remedial = tested.length - passed;
    const avg =
      tested.length > 0
        ? Math.round(
            tested.reduce((acc, r) => acc + (r.nilai ?? 0), 0) / tested.length
          )
        : 0;
    return {
      totalRows: reportRows.length,
      testedCount: tested.length,
      passed,
      remedial,
      avg,
    };
  }, [reportRows]);

  const handleExportCSV = () => {
    const headers = [
      'No',
      'NISN',
      'Nama Lengkap',
      'Kelas',
      'Nilai',
      'KKM',
      'Predikat',
      'Keterangan',
    ];
    const rows = reportRows.map((r) => [
      r.no,
      `"${r.nisn}"`,
      `"${r.namaLengkap.replace(/"/g, '""')}"`,
      `"${r.kelas}"`,
      r.nilai !== null ? r.nilai : '-',
      r.kkm,
      `"${r.predikat}"`,
      `"${r.keterangan}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `laporan_nilai_siswa_${selectedExam?.code || 'semua'}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(
      'Ekspor Laporan Nilai Berhasil',
      'Data nilai (No, NISN, Nama Lengkap, Kelas, Nilai, KKM, Predikat, Keterangan) berhasil diunduh (.CSV).',
      'success'
    );
  };

  const handleDownloadPrintableReport = () => {
    const rowsHtml = reportRows
      .map(
        (r) => `
      <tr>
        <td style="text-align:center;font-family:monospace;font-weight:700;">${r.no}</td>
        <td style="font-family:monospace;font-weight:700;">${r.nisn}</td>
        <td style="font-weight:600;">${r.namaLengkap}</td>
        <td style="text-align:center;">${r.kelas}</td>
        <td style="text-align:center;font-family:monospace;font-weight:800;font-size:13px;">${
          r.nilai !== null ? r.nilai : '-'
        }</td>
        <td style="text-align:center;font-family:monospace;">${r.kkm}</td>
        <td style="text-align:center;font-weight:700;">${r.predikat}</td>
        <td style="text-align:center;font-weight:700;color:${
          !r.hasTakenExam ? '#64748b' : r.isPassed ? '#047857' : '#be123c'
        };">${r.keterangan}</td>
      </tr>`
      )
      .join('\n');

    const htmlDoc = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Laporan Nilai Hasil Ujian - ${appSettings.schoolName}</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { margin: 0; padding: 15mm; color: #0f172a; background: #fff; }
    .kop { border-bottom: 3px double #0f172a; padding-bottom: 10px; margin-bottom: 16px; text-align: center; }
    .kop h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
    .kop p { margin: 3px 0 0; font-size: 11px; color: #334155; }
    .title { text-align: center; margin-bottom: 14px; }
    .title h2 { margin: 0; font-size: 14px; text-transform: uppercase; text-decoration: underline; }
    .title p { margin: 4px 0 0; font-size: 11px; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 10px; }
    th, td { border: 1px solid #1e293b; padding: 6px 8px; }
    th { background: #f1f5f9; text-transform: uppercase; font-size: 10.5px; }
    .footer-sign { margin-top: 28px; display: flex; justify-content: flex-end; }
    .sign-block { width: 240px; font-size: 11.5px; }
    @media print { .no-print { display: none !important; } body { padding: 8mm; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:14px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:13px;font-weight:700;color:#1e3a8a;">Dokumen Laporan Nilai Siap Cetak (${reportRows.length} Baris)</span>
    <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:700;cursor:pointer;">Cetak Sekarang (Ctrl+P)</button>
  </div>
  <div class="kop">
    <h1>${appSettings.schoolName}</h1>
    <p>${appSettings.schoolAddress} • NPSN: ${appSettings.npsn}</p>
    <p>Sistem Evaluasi: <b>${appSettings.appName}</b> — Tahun Pelajaran ${appSettings.academicYear} (${appSettings.semester})</p>
  </div>
  <div class="title">
    <h2>LAPORAN DAFTAR NILAI HASIL UJIAN BERBASIS KOMPUTER (CBT)</h2>
    <p>Mata Uji: <b>${
      selectedExam ? `${selectedExam.title} (${selectedExam.code})` : 'Rekapitulasi Semua Paket Ujian'
    }</b> • Kelas: <b>${classFilter === 'ALL' ? 'Semua Kelas' : classFilter}</b></p>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:42px;">No</th>
        <th>NISN</th>
        <th>Nama Lengkap</th>
        <th>Kelas</th>
        <th>Nilai</th>
        <th>KKM</th>
        <th>Predikat</th>
        <th>Keterangan</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer-sign">
    <div class="sign-block">
      <div>${appSettings.citySignature}, ${reportDate}</div>
      <div>Kepala Sekolah,</div>
      <div style="height:54px;"></div>
      <div style="font-weight:700;text-decoration:underline;">${appSettings.principalName}</div>
      <div>NIP. ${appSettings.principalNip}</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cetak_laporan_nilai_${selectedExam?.code || 'cbt'}_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Control Panel (Hidden when printing) */}
      <div className="print:hidden bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Cetak & Ekspor Laporan Nilai Siswa
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Format standar leger akademik: <strong>Nomor Auto-Increment, NISN, Nama Lengkap, Kelas, Nilai, KKM, Predikat, dan Keterangan</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Ekspor CSV / Excel
            </button>
            <button
              type="button"
              onClick={handleDownloadPrintableReport}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Unduh Dokumen Cetak (.HTML)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak Laporan Nilai ({reportRows.length} Baris)
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Pilih Paket Ujian
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.code} — {ex.subject} (KKM {ex.passingScore})
                </option>
              ))}
              <option value="ALL">Semua Sesi Ujian Terkumpul</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Filter Kelas / Rombel
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
            >
              <option value="ALL">Semua Kelas</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  Kelas {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Filter Keterangan Kelulusan
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as 'ALL' | 'PASSED' | 'REMEDIAL' | 'NOT_YET'
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
            >
              <option value="ALL">Semua Keterangan</option>
              <option value="PASSED">Lulus / Tuntas KKM</option>
              <option value="REMEDIAL">Remedial / Belum Tuntas</option>
              <option value="NOT_YET">Belum Mengikuti Ujian</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Tanggal Cetak Laporan
            </label>
            <input
              type="text"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari NISN, Nama Lengkap, Kelas, Predikat, atau Keterangan..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          {selectedExamId !== 'ALL' && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUntestedStudents}
                onChange={(e) => setIncludeUntestedStudents(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span>Tampilkan Siswa yang Belum Ujian</span>
            </label>
          )}
        </div>
      </div>

      {/* ========================================================================== */}
      {/* PRINTABLE GRADE REPORT SHEET                                               */}
      {/* ========================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs print:border-0 print:shadow-none print:p-0 space-y-6">
        {/* Official School Header (Kop Laporan) */}
        <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
          <div className="flex items-center justify-center gap-2.5">
            <Building2 className="w-6 h-6 text-slate-900" />
            <h1 className="text-lg font-extrabold uppercase tracking-wide text-slate-900">
              {appSettings.schoolName}
            </h1>
          </div>
          <p className="text-xs text-slate-600">
            {appSettings.schoolAddress} • NPSN: <strong>{appSettings.npsn}</strong>
          </p>
          <p className="text-xs font-semibold text-slate-700">
            Aplikasi Penyelenggara: {appSettings.appName} — Tahun Pelajaran{' '}
            {appSettings.academicYear} ({appSettings.semester})
          </p>
        </div>

        {/* Report Title & Summary Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div>
            <h2 className="text-sm font-extrabold uppercase text-slate-900">
              LAPORAN DAFTAR NILAI HASIL UJIAN SISWA
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Paket Ujian:{' '}
              <strong>
                {selectedExam
                  ? `${selectedExam.title} (${selectedExam.code})`
                  : 'Rekapitulasi Semua Paket Ujian'}
              </strong>{' '}
              • Kelas: <strong>{classFilter === 'ALL' ? 'Semua Kelas' : classFilter}</strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700">
              Rata-Rata: <strong>{summary.avg}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
              Tuntas KKM: {summary.passed}
            </span>
            <span className="px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 font-bold text-rose-800">
              Remedial: {summary.remedial}
            </span>
          </div>
        </div>

        {/* Grade Report Table */}
        <div className="overflow-x-auto border border-slate-300 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-14 border-r border-slate-200">
                  No.
                </th>
                <th className="py-3 px-4 border-r border-slate-200">NISN</th>
                <th className="py-3 px-4 border-r border-slate-200">
                  Nama Lengkap Siswa
                </th>
                <th className="py-3 px-4 text-center border-r border-slate-200">
                  Kelas
                </th>
                <th className="py-3 px-4 text-center border-r border-slate-200">
                  Nilai
                </th>
                <th className="py-3 px-4 text-center border-r border-slate-200">
                  KKM
                </th>
                <th className="py-3 px-4 text-center border-r border-slate-200">
                  Predikat
                </th>
                <th className="py-3 px-4 text-center">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {reportRows.map((row) => (
                <tr key={`${row.studentId}-${row.no}`} className="hover:bg-slate-50/80">
                  {/* Nomor Auto-Increment */}
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-200 tabular-nums">
                    {row.no}
                  </td>

                  {/* NISN */}
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-800 border-r border-slate-200">
                    {row.nisn}
                  </td>

                  {/* Nama Lengkap */}
                  <td className="py-2.5 px-4 font-semibold text-slate-900 border-r border-slate-200">
                    {row.namaLengkap}
                  </td>

                  {/* Kelas */}
                  <td className="py-2.5 px-4 text-center font-medium text-slate-700 border-r border-slate-200">
                    {row.kelas}
                  </td>

                  {/* Nilai */}
                  <td className="py-2.5 px-4 text-center font-mono text-sm font-extrabold text-slate-900 border-r border-slate-200 tabular-nums">
                    {row.nilai !== null ? row.nilai : '-'}
                  </td>

                  {/* KKM */}
                  <td className="py-2.5 px-4 text-center font-mono font-semibold text-slate-600 border-r border-slate-200 tabular-nums">
                    {row.kkm}
                  </td>

                  {/* Predikat */}
                  <td className="py-2.5 px-4 text-center border-r border-slate-200">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded font-bold text-[11px] ${
                        row.predikatCode === 'A'
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.predikatCode === 'B'
                          ? 'bg-sky-100 text-sky-800'
                          : row.predikatCode === 'C'
                          ? 'bg-amber-100 text-amber-800'
                          : row.predikatCode === 'D'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {row.predikat}
                    </span>
                  </td>

                  {/* Keterangan */}
                  <td className="py-2.5 px-4 text-center">
                    {!row.hasTakenExam ? (
                      <span className="text-[11px] font-medium text-slate-400">
                        {row.keterangan}
                      </span>
                    ) : row.isPassed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                        <CheckCircle2 className="w-3 h-3" />
                        {row.keterangan}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                        <AlertTriangle className="w-3 h-3" />
                        {row.keterangan}
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {reportRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Tidak ada data nilai yang sesuai dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Official Signature Block */}
        <div className="pt-4 flex justify-end">
          <div className="w-64 text-xs text-slate-700 space-y-1">
            <p>
              {appSettings.citySignature}, {reportDate}
            </p>
            <p className="font-semibold">Mengetahui, Kepala Sekolah</p>
            <div className="h-14" />
            <p className="font-bold text-slate-900 underline">
              {appSettings.principalName}
            </p>
            <p className="font-mono text-[11px] text-slate-500">
              NIP. {appSettings.principalNip}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
