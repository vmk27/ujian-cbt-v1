import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  Printer,
  Download,
  FileDown,
  Search,
  CheckSquare,
  Square,
  KeyRound,
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
  Ruler,
  FileText,
  Sparkles,
  FileSpreadsheet,
  Scissors,
  ShieldCheck,
  Stamp,
  Layers,
  Settings2,
  Maximize2,
  SlidersHorizontal,
  UserCheck,
  BadgeCheck,
  School,
  Calendar,
  Clock,
  Award,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useCBT } from '../../context/CBTContext';
import { canStudentAccessExam } from '../../utils/examAccess';

export type CardSizePresetId =
  | 'cr80'
  | 'khusus_panitia'
  | 'khusus_b2'
  | 'khusus_b3'
  | 'khusus_a6'
  | 'khusus_custom';

interface CardDimensionSpec {
  id: CardSizePresetId;
  category: 'Standar Internasional' | 'Ukuran Khusus';
  label: string;
  shortLabel: string;
  widthMm: number;
  heightMm: number;
  widthCm: string;
  heightCm: string;
  cardsPerPageA4: number;
  colsPerA4: number;
  rowsPerA4: number;
  description: string;
}

const CARD_SIZE_PRESETS: Record<Exclude<CardSizePresetId, 'khusus_custom'>, CardDimensionSpec> = {
  cr80: {
    id: 'cr80',
    category: 'Standar Internasional',
    label: 'Standar Internasional (CR-80 / ID-1): 8,56 × 5,4 cm (85,6 × 53,98 mm)',
    shortLabel: 'CR-80 Standar (85,6 × 54 mm)',
    widthMm: 85.6,
    heightMm: 53.98,
    widthCm: '8,56',
    heightCm: '5,4',
    cardsPerPageA4: 10,
    colsPerA4: 2,
    rowsPerA4: 5,
    description: 'Ukuran standar KTP/ATM/Kartu Pelajar. Muat 10 kartu per lembar A4.',
  },
  khusus_panitia: {
    id: 'khusus_panitia',
    category: 'Ukuran Khusus',
    label: 'Ukuran Khusus Panitia B1 (9,5 × 6,0 cm / 95 × 60 mm)',
    shortLabel: 'Panitia B1 (95 × 60 mm)',
    widthMm: 95,
    heightMm: 60,
    widthCm: '9,5',
    heightCm: '6,0',
    cardsPerPageA4: 8,
    colsPerA4: 2,
    rowsPerA4: 4,
    description: 'Format pas untuk plastik mika panitia B1. Muat 8 kartu per lembar A4.',
  },
  khusus_b2: {
    id: 'khusus_b2',
    category: 'Ukuran Khusus',
    label: 'Ukuran Khusus Lanyard B2 (10,0 × 6,5 cm / 100 × 65 mm)',
    shortLabel: 'Lanyard B2 (100 × 65 mm)',
    widthMm: 100,
    heightMm: 65,
    widthCm: '10,0',
    heightCm: '6,5',
    cardsPerPageA4: 8,
    colsPerA4: 2,
    rowsPerA4: 4,
    description: 'Cocok untuk gantungan ID Card tali lanyard B2. Muat 8 kartu per lembar A4.',
  },
  khusus_b3: {
    id: 'khusus_b3',
    category: 'Ukuran Khusus',
    label: 'Ukuran Holder Besar B3 (12,5 × 8,5 cm / 125 × 85 mm)',
    shortLabel: 'Holder B3 (125 × 85 mm)',
    widthMm: 125,
    heightMm: 85,
    widthCm: '12,5',
    heightCm: '8,5',
    cardsPerPageA4: 4,
    colsPerA4: 1,
    rowsPerA4: 4,
    description: 'Kartu format besar ekstra jelas untuk pengawas dan meja peserta.',
  },
  khusus_a6: {
    id: 'khusus_a6',
    category: 'Ukuran Khusus',
    label: 'Ukuran 1/4 Lembar A4 (A6: 14,8 × 10,5 cm / 148 × 105 mm)',
    shortLabel: 'A6 - 1/4 A4 (148 × 105 mm)',
    widthMm: 148,
    heightMm: 105,
    widthCm: '14,8',
    heightCm: '10,5',
    cardsPerPageA4: 4,
    colsPerA4: 1,
    rowsPerA4: 2,
    description: 'Format lembaran besar dokumen ujian resmi. Muat 4 kartu per lembar A4.',
  },
};

export const ExamCardsTab: React.FC = () => {
  const { appSettings, classes, users, exams, showToast } = useCBT();

  // Filters & Options
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPasswordOnCard, setShowPasswordOnCard] = useState<boolean>(true);
  const [showTokenOnCard, setShowTokenOnCard] = useState<boolean>(false);
  const [showCutMarks, setShowCutMarks] = useState<boolean>(true);
  const [showOfficialStamp, setShowOfficialStamp] = useState<boolean>(true);
  const [cardTheme, setCardTheme] = useState<'official' | 'modern' | 'compact'>('official');
  const [previewZoom, setPreviewZoom] = useState<'fit' | '100' | '80'>('100');
  const [activeTab, setActiveTab] = useState<'preview' | 'settings'>('preview');

  // Card Size & Dimension State
  const [cardSizePreset, setCardSizePreset] = useState<CardSizePresetId>('cr80');
  const [customWidthMm, setCustomWidthMm] = useState<number>(85.6);
  const [customHeightMm, setCustomHeightMm] = useState<number>(53.98);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Metadata Customization
  const [customCardTitle, setCustomCardTitle] = useState<string>(
    appSettings.examCardTitle || 'KARTU PESERTA ASESMEN / UJIAN BERBASIS KOMPUTER (CBT)'
  );
  const [customSubTitle, setCustomSubTitle] = useState<string>(
    `TAHUN PELAJARAN ${appSettings.academicYear} • SEMESTER ${appSettings.semester.toUpperCase()}`
  );
  const [printDate, setPrintDate] = useState<string>(
    new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  );

  const activeSizeSpec: CardDimensionSpec = useMemo(() => {
    if (cardSizePreset !== 'khusus_custom') {
      return CARD_SIZE_PRESETS[cardSizePreset];
    }
    const wMm = Math.max(65, Math.min(190, Number(customWidthMm) || 85.6));
    const hMm = Math.max(45, Math.min(130, Number(customHeightMm) || 53.98));
    const cols = wMm * 2 + 16 <= 210 ? 2 : 1;
    const rows = Math.max(1, Math.floor((297 - 20) / (hMm + 4)));
    return {
      id: 'khusus_custom',
      category: 'Ukuran Khusus',
      label: `Ukuran Khusus Kustom: ${(wMm / 10).toFixed(2).replace('.', ',')} × ${(
        hMm / 10
      )
        .toFixed(2)
        .replace('.', ',')} cm (${wMm} × ${hMm} mm)`,
      shortLabel: `Khusus (${wMm} × ${hMm} mm)`,
      widthMm: wMm,
      heightMm: hMm,
      widthCm: (wMm / 10).toFixed(2).replace('.', ','),
      heightCm: (hMm / 10).toFixed(2).replace('.', ','),
      cardsPerPageA4: cols * rows,
      colsPerA4: cols,
      rowsPerA4: rows,
      description: `Format kustom pengguna (${cols} kolom × ${rows} baris).`,
    };
  }, [cardSizePreset, customWidthMm, customHeightMm]);

  const students = useMemo(() => users.filter((u) => u.role === 'siswa'), [users]);

  const classOptions = useMemo(() => {
    const set = new Set<string>(classes.map((c) => c.namaKelas));
    students.forEach((s) => {
      if (s.kelas) set.add(s.kelas);
    });
    return Array.from(set).sort();
  }, [classes, students]);

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId),
    [exams, selectedExamId]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const matchClass = classFilter === 'ALL' || s.kelas === classFilter;
      const matchExamAngkatan =
        !selectedExam || canStudentAccessExam(s, selectedExam, classes);
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.nomorPeserta.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q);
      return matchClass && matchExamAngkatan && matchQuery;
    });
  }, [students, classFilter, selectedExam, classes, searchQuery]);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const targetStudents = useMemo(() => {
    if (selectedStudentIds.length === 0) return filteredStudents;
    const set = new Set(selectedStudentIds);
    return filteredStudents.filter((s) => set.has(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const getRoomForClass = (namaKelas: string): string => {
    const found = classes.find(
      (c) => c.namaKelas.toLowerCase() === namaKelas.toLowerCase()
    );
    return found?.ruangUjian || 'Lab Komputer CBT Utama';
  };

  const totalA4Pages = Math.max(
    1,
    Math.ceil(targetStudents.length / activeSizeSpec.cardsPerPageA4)
  );

  // ============================================================================
  // CETAK DALAM PDF UKURAN A4 (210 x 297 mm) DENGAN UKURAN KARTU PRESISI
  // ============================================================================
  const handleDownloadPdfA4 = () => {
    if (targetStudents.length === 0) {
      showToast(
        'Tidak Ada Siswa',
        'Pilih minimal 1 siswa untuk mencetak kartu ujian dalam PDF A4.',
        'warning'
      );
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4', // 210 x 297 mm
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const cardW = activeSizeSpec.widthMm;
      const cardH = activeSizeSpec.heightMm;

      const cols = activeSizeSpec.colsPerA4;
      const gapX = cols > 1 ? 6 : 0;
      const gapY = 4;
      const rows = activeSizeSpec.rowsPerA4;
      const cardsPerPage = cols * rows;

      const totalGridW = cols * cardW + (cols - 1) * gapX;
      const startX = (pageWidth - totalGridW) / 2;
      const startY = 12;

      targetStudents.forEach((st, idx) => {
        const indexOnPage = idx % cardsPerPage;
        if (idx > 0 && indexOnPage === 0) {
          doc.addPage('a4', 'portrait');
        }

        // Draw page header info
        if (indexOnPage === 0) {
          const currentPage = Math.floor(idx / cardsPerPage) + 1;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(
            `${appSettings.schoolName} — Lembar Cetak Kartu Ujian CBT A4 (${activeSizeSpec.shortLabel}) • Halaman ${currentPage}/${Math.ceil(
              targetStudents.length / cardsPerPage
            )}`,
            startX,
            8
          );
        }

        const colIdx = indexOnPage % cols;
        const rowIdx = Math.floor(indexOnPage / cols);

        const x = startX + colIdx * (cardW + gapX);
        const y = startY + rowIdx * (cardH + gapY);

        const scale = Math.min(cardW / 85.6, cardH / 53.98);

        // 1. Cut Guide Marks (Scissors lines)
        if (showCutMarks) {
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.15);
          // Corner cross marks
          doc.line(x - 2, y, x + cardW + 2, y);
          doc.line(x - 2, y + cardH, x + cardW + 2, y + cardH);
          doc.line(x, y - 2, x, y + cardH + 2);
          doc.line(x + cardW, y - 2, x + cardW, y + cardH + 2);
        }

        // 2. Outer Card Border
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.35);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'S');

        // 3. Top Header Banner inside Card
        const headerH = 12 * scale;
        doc.setFillColor(248, 250, 252);
        doc.rect(x + 0.3, y + 0.3, cardW - 0.6, headerH, 'F');

        // Double divider line below header
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.35);
        doc.line(x, y + headerH, x + cardW, y + headerH);
        doc.setLineWidth(0.15);
        doc.line(x, y + headerH + 0.5, x + cardW, y + headerH + 0.5);

        // School Logo Icon placeholder (Small emblem box)
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(x + 2.2, y + 1.8 * scale, 5.5 * scale, 5.5 * scale, 0.8, 0.8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(4.5 * scale);
        doc.text('CBT', x + 2.2 + 2.75 * scale, y + 5.2 * scale, { align: 'center' });

        // School Name
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8 * scale);
        const schoolTitle = (appSettings.schoolName || 'SMA NEGERI 1 NUSANTARA').toUpperCase();
        doc.text(schoolTitle.slice(0, 38), x + 9 * scale, y + 3.8 * scale);

        // Card Number Badge on Top Right
        const badgeText = `NO. ${String(idx + 1).padStart(2, '0')}`;
        doc.setFillColor(15, 23, 42);
        const badgeW = 14 * scale;
        const badgeH = 3.8 * scale;
        doc.roundedRect(x + cardW - badgeW - 2.2, y + 1.5 * scale, badgeW, badgeH, 0.8, 0.8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('courier', 'bold');
        doc.setFontSize(5.8 * scale);
        doc.text(badgeText, x + cardW - badgeW / 2 - 2.2, y + 4.0 * scale, {
          align: 'center',
        });

        // Card Title & Academic Year
        doc.setTextColor(29, 78, 216);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2 * scale);
        doc.text(
          customCardTitle.toUpperCase().slice(0, 46),
          x + cardW / 2,
          y + 8.2 * scale,
          { align: 'center' }
        );

        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.0 * scale);
        doc.text(
          `TP ${appSettings.academicYear} (${appSettings.semester}) • NPSN: ${appSettings.npsn} • ${appSettings.appName}`,
          x + cardW / 2,
          y + 11.0 * scale,
          { align: 'center' }
        );

        // 4. Student Identity Rows
        const bodyStartY = y + headerH + 3.4 * scale;
        const rowStep = 3.6 * scale;
        const labelX = x + 2.8;
        const colonX = x + 23 * scale;
        const valX = x + 25 * scale;
        const room = getRoomForClass(st.kelas);
        const pass = st.password || `CBT-${st.nomorPeserta.slice(-3) || '2026'}*`;

        const infoRows: Array<{ label: string; value: string; bold?: boolean; mono?: boolean }> = [
          { label: 'Nama Peserta', value: st.name.slice(0, 34), bold: true },
          { label: 'Nomor Peserta', value: st.nomorPeserta, bold: true, mono: true },
          {
            label: 'Kelas / Rombel',
            value: `${st.kelas} (${st.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan'})`,
          },
          { label: 'Ruang Lab CBT', value: room.slice(0, 34) },
        ];

        if (selectedExam) {
          const scheduleStr = selectedExam.examDate
            ? ` • ${selectedExam.examDate}${selectedExam.startTime ? ` (${selectedExam.startTime})` : ''}`
            : '';
          infoRows.push({
            label: 'Mata Uji',
            value: `${selectedExam.subject} (${selectedExam.code})${scheduleStr}`.slice(0, 38),
          });
        }

        infoRows.forEach((r, rIdx) => {
          const curY = bodyStartY + rIdx * rowStep;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8 * scale);
          doc.setTextColor(71, 85, 105);
          doc.text(r.label, labelX, curY);
          doc.text(':', colonX, curY);

          if (r.mono) {
            doc.setFont('courier', r.bold ? 'bold' : 'normal');
          } else {
            doc.setFont('helvetica', r.bold ? 'bold' : 'normal');
          }
          doc.setTextColor(15, 23, 42);
          doc.setFontSize(6.1 * scale);
          doc.text(r.value, valX, curY);
        });

        // 5. Credentials Strip (Username / NISN & Password Login)
        const credY = bodyStartY + infoRows.length * rowStep + 0.5 * scale;
        const credH = 7.2 * scale;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.roundedRect(x + 2.5, credY, cardW - 5, credH, 1.2, 1.2, 'FD');

        // Username / NISN
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(4.8 * scale);
        doc.setTextColor(100, 116, 139);
        doc.text('USERNAME / NISN:', x + 4.2, credY + 2.6 * scale);

        doc.setFont('courier', 'bold');
        doc.setFontSize(6.4 * scale);
        doc.setTextColor(15, 23, 42);
        doc.text(st.username, x + 4.2, credY + 5.7 * scale);

        // Password Login
        if (showPasswordOnCard) {
          const passBoxX = x + cardW * 0.48;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(4.8 * scale);
          doc.setTextColor(180, 83, 9);
          doc.text('PASSWORD LOGIN:', passBoxX, credY + 2.6 * scale);

          doc.setFont('courier', 'bold');
          doc.setFontSize(6.4 * scale);
          doc.setTextColor(146, 64, 14);
          doc.text(pass, passBoxX, credY + 5.7 * scale);
        }

        if (selectedExam && showTokenOnCard) {
          const tokenX = x + cardW - 18 * scale;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(4.6 * scale);
          doc.setTextColor(29, 78, 216);
          doc.text('TOKEN:', tokenX, credY + 2.6 * scale);
          doc.setFont('courier', 'bold');
          doc.setFontSize(6.2 * scale);
          doc.text(selectedExam.token, tokenX, credY + 5.7 * scale);
        }

        // 6. Card Footer & Signature Block
        const footerTopY = y + cardH - 11.8 * scale;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(x + 2.5, footerTopY, x + cardW - 2.5, footerTopY);

        // Left Note inside Footer
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(4.8 * scale);
        doc.setTextColor(100, 116, 139);
        doc.text('Kartu Resmi Peserta CBT', x + 2.8, footerTopY + 3.2 * scale);
        doc.text('Wajib dibawa saat sesi ujian.', x + 2.8, footerTopY + 5.8 * scale);
        doc.setFont('courier', 'normal');
        doc.setFontSize(4.4 * scale);
        doc.text(activeSizeSpec.shortLabel, x + 2.8, footerTopY + 8.6 * scale);

        // Optional Official Stamp Watermark in Signature
        if (showOfficialStamp) {
          doc.setDrawColor(219, 39, 119); // soft magenta / blue stamp tint
          doc.setLineWidth(0.2);
          doc.ellipse(x + cardW - 20 * scale, footerTopY + 6.5 * scale, 6 * scale, 3.5 * scale, 'S');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(3.8 * scale);
          doc.setTextColor(190, 24, 93);
          doc.text('PANITIA CBT', x + cardW - 20 * scale, footerTopY + 7.0 * scale, { align: 'center' });
        }

        // Right Signature Block inside Footer
        const signX = x + cardW - 36 * scale;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.9 * scale);
        doc.setTextColor(51, 65, 85);
        doc.text(`${appSettings.citySignature}, ${printDate}`, signX, footerTopY + 2.8 * scale);
        doc.text('Kepala Sekolah / Ketua Panitia,', signX, footerTopY + 5.0 * scale);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.2 * scale);
        doc.setTextColor(15, 23, 42);
        doc.text(appSettings.principalName.slice(0, 30), signX, footerTopY + 9.2 * scale);

        doc.setFont('courier', 'normal');
        doc.setFontSize(4.5 * scale);
        doc.setTextColor(71, 85, 105);
        doc.text(`NIP. ${appSettings.principalNip}`, signX, footerTopY + 11.1 * scale);
      });

      const filename = `kartu_ujian_A4_${activeSizeSpec.id}_${
        classFilter === 'ALL' ? 'semua_kelas' : classFilter.replace(/\s+/g, '_')
      }.pdf`;
      doc.save(filename);

      showToast(
        'PDF Kartu Ujian A4 Berhasil Diunduh',
        `${targetStudents.length} kartu ukuran ${activeSizeSpec.shortLabel} telah disusun pada kertas A4 (${totalA4Pages} halaman).`,
        'success'
      );
    } catch (err) {
      showToast(
        'Gagal Membuat PDF',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat dokumen PDF A4.',
        'error'
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintBrowser = () => {
    if (targetStudents.length === 0) {
      showToast('Tidak Ada Siswa', 'Pilih minimal 1 siswa untuk mencetak kartu ujian.', 'warning');
      return;
    }
    window.print();
  };

  const handleDownloadPrintableHtml = () => {
    if (targetStudents.length === 0) {
      showToast('Tidak Ada Siswa', 'Pilih minimal 1 siswa untuk mengunduh kartu ujian.', 'warning');
      return;
    }

    const cardsHtml = targetStudents
      .map((st, idx) => {
        const room = getRoomForClass(st.kelas);
        const pass = st.password || `CBT-${st.nomorPeserta.slice(-3) || '2026'}*`;
        return `
        <div class="card">
          <div class="card-inner">
            <div class="card-header">
              <div class="header-top">
                <div class="brand-box">
                  <div class="school-logo">CBT</div>
                  <div>
                    <div class="school-name">${appSettings.schoolName}</div>
                    <div class="school-sub">NPSN: ${appSettings.npsn} • ${appSettings.appName}</div>
                  </div>
                </div>
                <div class="badge-no">NO. ${String(idx + 1).padStart(2, '0')}</div>
              </div>
              <div class="card-title">${customCardTitle}</div>
              <div class="card-period">${customSubTitle}</div>
            </div>
            <div class="card-body">
              <table class="info-table">
                <tr><td class="lbl">Nama Peserta</td><td class="sep">:</td><td class="val bold">${st.name}</td></tr>
                <tr><td class="lbl">Nomor Peserta</td><td class="sep">:</td><td class="val mono bold">${st.nomorPeserta}</td></tr>
                <tr><td class="lbl">Kelas / Rombel</td><td class="sep">:</td><td class="val">${st.kelas} (${st.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan'})</td></tr>
                <tr><td class="lbl">Ruang Lab CBT</td><td class="sep">:</td><td class="val">${room}</td></tr>
                ${
                  selectedExam
                    ? `<tr><td class="lbl">Mata Uji</td><td class="sep">:</td><td class="val">${selectedExam.subject} (${selectedExam.code})${
                        showTokenOnCard ? ` • Token: <b>${selectedExam.token}</b>` : ''
                      }</td></tr>`
                    : ''
                }
              </table>
              <div class="cred-strip">
                <div>
                  <span class="cred-lbl">USERNAME / NISN</span>
                  <span class="cred-val mono">${st.username}</span>
                </div>
                ${
                  showPasswordOnCard
                    ? `<div>
                        <span class="cred-lbl pass-lbl">PASSWORD LOGIN</span>
                        <span class="cred-val mono pass-val">${pass}</span>
                      </div>`
                    : ''
                }
                ${
                  selectedExam && showTokenOnCard
                    ? `<div>
                        <span class="cred-lbl token-lbl">TOKEN UJIAN</span>
                        <span class="cred-val mono token-val">${selectedExam.token}</span>
                      </div>`
                    : ''
                }
              </div>
            </div>
          </div>
          <div class="card-footer">
            <div class="card-note">
              <div class="note-title">Kartu Resmi Peserta CBT</div>
              <div class="note-sub">Wajib dibawa saat sesi ujian.</div>
              <div class="mono-note">${activeSizeSpec.shortLabel}</div>
            </div>
            <div class="sign-box">
              ${showOfficialStamp ? '<div class="stamp-badge">PANITIA CBT</div>' : ''}
              <div>${appSettings.citySignature}, ${printDate}</div>
              <div>Kepala Sekolah / Ketua Panitia,</div>
              <div class="sign-space"></div>
              <div class="sign-name">${appSettings.principalName}</div>
              <div class="sign-nip">NIP. ${appSettings.principalNip}</div>
            </div>
          </div>
        </div>`;
      })
      .join('\n');

    const fullHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Cetak Kartu Ujian A4 (${activeSizeSpec.shortLabel}) - ${appSettings.schoolName}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, -apple-system, sans-serif; }
    body { margin: 0; padding: 10mm; background: #fff; color: #0f172a; }
    .grid {
      display: grid;
      grid-template-columns: repeat(${activeSizeSpec.colsPerA4}, ${activeSizeSpec.widthMm}mm);
      justify-content: center;
      gap: 4mm 6mm;
    }
    .card {
      width: ${activeSizeSpec.widthMm}mm;
      height: ${activeSizeSpec.heightMm}mm;
      border: 1.2px solid #0f172a;
      border-radius: 6px;
      padding: 2.4mm 3mm;
      page-break-inside: avoid;
      break-inside: avoid;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      position: relative;
    }
    .brand-box { display: flex; align-items: center; gap: 4px; }
    .school-logo { background: #0f172a; color: #fff; font-size: 5pt; font-weight: 800; padding: 2px 4px; border-radius: 2px; }
    .card-header { border-bottom: 1.5px double #0f172a; padding-bottom: 1.2mm; margin-bottom: 1.2mm; background: #f8fafc; margin: -2.4mm -3mm 1.2mm -3mm; padding: 2mm 3mm 1.2mm 3mm; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; }
    .school-name { font-size: 7.2pt; font-weight: 800; text-transform: uppercase; color: #0f172a; line-height: 1.1; }
    .school-sub { font-size: 5.2pt; color: #475569; }
    .badge-no { font-size: 6pt; font-weight: 800; font-family: monospace; background: #0f172a; color: #fff; padding: 1px 4px; border-radius: 3px; white-space: nowrap; }
    .card-title { font-size: 6.5pt; font-weight: 800; text-align: center; margin-top: 1mm; color: #1d4ed8; text-transform: uppercase; }
    .card-period { font-size: 5pt; font-weight: 600; text-align: center; color: #334155; }
    .info-table { width: 100%; border-collapse: collapse; font-size: 6.2pt; line-height: 1.22; }
    .info-table td { padding: 0.3mm 0; vertical-align: top; }
    .lbl { width: 21mm; color: #475569; font-weight: 600; }
    .sep { width: 2mm; text-align: center; }
    .val { color: #0f172a; }
    .bold { font-weight: 700; }
    .mono { font-family: 'Courier New', monospace; }
    .cred-strip { margin-top: 1mm; padding: 1mm 2mm; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; justify-content: space-between; gap: 6px; }
    .cred-lbl { display: block; font-size: 4.6pt; font-weight: 700; color: #64748b; }
    .pass-lbl { color: #b45309; }
    .token-lbl { color: #1d4ed8; }
    .cred-val { font-size: 6.5pt; font-weight: 800; color: #0f172a; }
    .pass-val { color: #92400e; background: #fef3c7; padding: 0 3px; border-radius: 2px; }
    .token-val { color: #1e40af; background: #dbeafe; padding: 0 3px; border-radius: 2px; }
    .card-footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 1mm; border-top: 1px dashed #cbd5e1; }
    .card-note { font-size: 5pt; color: #64748b; line-height: 1.2; }
    .note-title { font-weight: 700; color: #334155; }
    .mono-note { font-family: monospace; font-size: 4.6pt; color: #475569; }
    .sign-box { font-size: 5.2pt; text-align: left; min-width: 34mm; line-height: 1.15; position: relative; }
    .stamp-badge { position: absolute; right: 2mm; top: 2mm; border: 1px solid rgba(219,39,119,0.5); color: #be185d; font-size: 4pt; font-weight: bold; border-radius: 50%; width: 14mm; height: 7mm; display: flex; align-items: center; justify-content: center; opacity: 0.6; pointer-events: none; }
    .sign-space { height: 3.2mm; }
    .sign-name { font-weight: 700; text-decoration: underline; color: #0f172a; }
    .sign-nip { font-size: 4.8pt; color: #475569; font-family: monospace; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:14px;padding:12px 16px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <div>
      <span style="font-size:14px;font-weight:800;color:#166534;">Dokumen Siap Cetak Kertas A4 — ${activeSizeSpec.label}</span>
      <div style="font-size:12px;color:#15803d;margin-top:2px;">Total: <b>${targetStudents.length} Kartu</b> • Format Presisi (${activeSizeSpec.cardsPerPageA4} Kartu per Halaman A4)</div>
    </div>
    <button onclick="window.print()" style="background:#15803d;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;">
      🖨️ Cetak Dokumen / Simpan PDF (Ctrl+P)
    </button>
  </div>
  <div class="grid">${cardsHtml}</div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kartu_ujian_A4_${activeSizeSpec.id}_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      'File Cetak Kartu Ujian A4 Diunduh',
      `Berhasil menyiapkan ${targetStudents.length} kartu peserta ukuran ${activeSizeSpec.shortLabel}.`,
      'success'
    );
  };

  // ============================================================================
  // UNDUH DATA KARTU UJIAN (NISN, NAMA, KELAS, PASSWORD) FORMAT CSV & EXCEL
  // ============================================================================
  const handleDownloadDataCsv = () => {
    if (targetStudents.length === 0) {
      showToast(
        'Tidak Ada Siswa',
        'Pilih minimal 1 siswa untuk mengunduh data kartu ujian.',
        'warning'
      );
      return;
    }

    const headers = [
      'No',
      'NISN',
      'Nama Siswa',
      'Kelas',
      'Password',
      'Nomor Peserta',
      'Jenis Kelamin',
      'Ruang Ujian',
      'Mata Uji',
      'Token Ujian',
    ];

    const rows = targetStudents.map((st, idx) => {
      const room = getRoomForClass(st.kelas);
      const pass = st.password || `CBT-${st.nomorPeserta.slice(-3) || '2026'}*`;
      const subject = selectedExam ? `${selectedExam.subject} (${selectedExam.code})` : '-';
      const token = selectedExam ? selectedExam.token : '-';
      return [
        String(idx + 1),
        `"${st.username.replace(/"/g, '""')}"`,
        `"${st.name.replace(/"/g, '""')}"`,
        `"${st.kelas.replace(/"/g, '""')}"`,
        `"${pass.replace(/"/g, '""')}"`,
        `"${st.nomorPeserta.replace(/"/g, '""')}"`,
        `"${st.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan'}"`,
        `"${room.replace(/"/g, '""')}"`,
        `"${subject.replace(/"/g, '""')}"`,
        `"${token.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanFilter = classFilter === 'ALL' ? 'semua_kelas' : classFilter.replace(/\s+/g, '_');
    link.download = `data_kartu_ujian_${cleanFilter}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      'Data Kartu Ujian CSV Berhasil Diunduh',
      `Berhasil mengekspor ${targetStudents.length} data kartu (NISN, Nama, Kelas, Password).`,
      'success'
    );
  };

  const handleDownloadDataExcel = () => {
    if (targetStudents.length === 0) {
      showToast(
        'Tidak Ada Siswa',
        'Pilih minimal 1 siswa untuk mengunduh data kartu ujian.',
        'warning'
      );
      return;
    }

    const tableRows = targetStudents
      .map((st, idx) => {
        const room = getRoomForClass(st.kelas);
        const pass = st.password || `CBT-${st.nomorPeserta.slice(-3) || '2026'}*`;
        const subject = selectedExam ? `${selectedExam.subject} (${selectedExam.code})` : '-';
        const token = selectedExam ? selectedExam.token : '-';
        return `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="mso-number-format:'\\@'; text-align: center; font-weight: bold;">${st.username}</td>
            <td>${st.name}</td>
            <td style="text-align: center;">${st.kelas}</td>
            <td style="mso-number-format:'\\@'; font-weight: bold; color: #b45309; text-align: center; background-color: #fef3c7;">${pass}</td>
            <td style="mso-number-format:'\\@'; text-align: center;">${st.nomorPeserta}</td>
            <td style="text-align: center;">${st.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan'}</td>
            <td>${room}</td>
            <td>${subject}</td>
            <td style="mso-number-format:'\\@'; text-align: center;">${token}</td>
          </tr>
        `;
      })
      .join('');

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Data Kartu Ujian</x:Name>
                  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
            th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #000000; padding: 6px 10px; font-weight: bold; }
            td { border: 1px solid #d1d5db; padding: 5px 8px; }
            .title { font-size: 14pt; font-weight: bold; text-align: center; color: #1e3a8a; }
            .subtitle { font-size: 10pt; text-align: center; color: #4b5563; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="10" class="title">${appSettings.schoolName}</td></tr>
            <tr><td colspan="10" class="subtitle">DATA REKAP KARTU UJIAN PESERTA CBT (NISN, NAMA, KELAS, PASSWORD)</td></tr>
            <tr><td colspan="10" class="subtitle">Tahun Pelajaran ${appSettings.academicYear} • Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}</td></tr>
            <tr><td colspan="10"></td></tr>
            <thead>
              <tr>
                <th>No</th>
                <th>NISN</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th>Password</th>
                <th>Nomor Peserta</th>
                <th>Jenis Kelamin</th>
                <th>Ruang Ujian</th>
                <th>Mata Uji</th>
                <th>Token</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanFilter = classFilter === 'ALL' ? 'semua_kelas' : classFilter.replace(/\s+/g, '_');
    link.download = `rekap_data_kartu_ujian_${cleanFilter}_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      'Data Kartu Ujian Excel Berhasil Diunduh',
      `Berhasil mengekspor format Excel (.xls) untuk ${targetStudents.length} peserta kartu ujian (NISN, Nama, Kelas, Password).`,
      'success'
    );
  };

  return (
    <div className="space-y-6">
      {/* Print CSS Rules for Exact Physical Dimensions */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-a4-grid {
            display: grid !important;
            grid-template-columns: repeat(${activeSizeSpec.colsPerA4}, ${activeSizeSpec.widthMm}mm) !important;
            justify-content: center !important;
            gap: 4mm 6mm !important;
          }
          .print-cr80-card {
            width: ${activeSizeSpec.widthMm}mm !important;
            height: ${activeSizeSpec.heightMm}mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            border-color: #0f172a !important;
          }
        }
      `}</style>

      {/* Modern App Header & Action Control Hub (Hidden on Print) */}
      <div className="print:hidden bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Top Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-6 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-blue-200">
                <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Modul Cetak Kartu Peserta Ujian CBT Resmi</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-3">
                <CreditCard className="w-7 h-7 text-blue-400 shrink-0" />
                <span>Kartu Peserta Ujian Berbasis Komputer</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Kelola, kustomisasi format ukuran standar/khusus, pratinjau lembar A4 secara live, serta unduh data kartu lengkap (NISN, Nama, Kelas, Password) dalam format Excel, CSV, dan PDF.
              </p>
            </div>

            {/* Quick Summary Pill Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <div className="text-[10px] uppercase font-bold text-blue-200">Total Siswa</div>
                <div className="text-lg font-black text-white">{students.length}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <div className="text-[10px] uppercase font-bold text-emerald-200">Terpilih</div>
                <div className="text-lg font-black text-emerald-400">{targetStudents.length}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <div className="text-[10px] uppercase font-bold text-amber-200">Format Kartu</div>
                <div className="text-xs font-black text-amber-300 mt-1 truncate max-w-[90px]" title={activeSizeSpec.shortLabel}>
                  {activeSizeSpec.shortLabel}
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center">
                <div className="text-[10px] uppercase font-bold text-purple-200">Lembar A4</div>
                <div className="text-lg font-black text-purple-300">{totalA4Pages} Hal</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Navigation Tabs */}
          <div className="inline-flex p-1 bg-slate-200/80 rounded-2xl border border-slate-300/60">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Pratinjau Lembar ({targetStudents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings2 className="w-4 h-4 text-blue-600" />
              <span>Pengaturan & Ukuran Presisi</span>
            </button>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Download Data Excel */}
            <button
              type="button"
              onClick={handleDownloadDataExcel}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
              title="Unduh Data Rekap Kartu Ujian (NISN, Nama, Kelas, Password) dalam format Excel (.xls)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Data Excel</span>
            </button>

            {/* Download Data CSV */}
            <button
              type="button"
              onClick={handleDownloadDataCsv}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
              title="Unduh Data Kartu Ujian (NISN, Nama, Kelas, Password) dalam format CSV"
            >
              <FileDown className="w-4 h-4" />
              <span>Unduh CSV</span>
            </button>

            {/* Download PDF A4 */}
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdfA4}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {isGeneratingPdf
                  ? 'Menyusun PDF...'
                  : `Unduh PDF A4 (${targetStudents.length} Kartu)`}
              </span>
            </button>

            {/* Browser Print */}
            <button
              type="button"
              onClick={handlePrintBrowser}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Cetak Kertas A4</span>
            </button>

            {/* Download Standalone HTML */}
            <button
              type="button"
              onClick={handleDownloadPrintableHtml}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs px-3 py-2.5 rounded-xl transition-all cursor-pointer"
              title="Unduh file HTML mandiri siap cetak di browser apa pun"
            >
              <Download className="w-3.5 h-3.5" />
              <span>HTML A4</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar Strip */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Kelas Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-indigo-600" />
                <span>Filter Kelas / Rombel</span>
              </label>
              <select
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setSelectedStudentIds([]);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">Semua Kelas ({students.length} Siswa)</option>
                {classOptions.map((c) => {
                  const count = students.filter((s) => s.kelas === c).length;
                  return (
                    <option key={c} value={c}>
                      Kelas {c} ({count} Siswa)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Mata Uji / Paket Ujian */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-blue-600" />
                <span>Mata Uji pada Kartu</span>
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">Kartu Umum (Semua Mata Uji)</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.code} — {ex.subject}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Box */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <span>Cari Peserta Ujian</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari berdasarkan nama lengkap, NISN, atau nomor peserta..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 placeholder:text-slate-400 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Quick Toggle Chips & Selection Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              {/* Show Password Toggle */}
              <button
                type="button"
                onClick={() => setShowPasswordOnCard((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  showPasswordOnCard
                    ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {showPasswordOnCard ? (
                  <Eye className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>Cetak Password Login</span>
              </button>

              {/* Show Token Toggle */}
              {selectedExam && (
                <button
                  type="button"
                  onClick={() => setShowTokenOnCard((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    showTokenOnCard
                      ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sertakan Token ({selectedExam.token})</span>
                </button>
              )}

              {/* Show Cut Marks Toggle */}
              <button
                type="button"
                onClick={() => setShowCutMarks((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  showCutMarks
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                <span>Garis Gunting/Potong</span>
              </button>

              {/* Show Official Stamp Toggle */}
              <button
                type="button"
                onClick={() => setShowOfficialStamp((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  showOfficialStamp
                    ? 'bg-pink-50 border-pink-300 text-pink-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Stamp className="w-3.5 h-3.5 text-pink-600" />
                <span>Cap / Stempel Panitia</span>
              </button>
            </div>

            {/* Select All / Specific toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs transition-all"
              >
                {allFilteredSelected ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Batal Pilih Semua</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Pilih Semua Siswa ({filteredStudents.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Multi-Select Student Badges Container */}
          <div className="bg-slate-100/70 rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800">
                  Daftar Peserta Kartu ({targetStudents.length} Terpilih / {filteredStudents.length} Sesuai Filter):
                </span>
              </div>
              {selectedStudentIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Reset Pilihan ({filteredStudents.length} Siswa)
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {filteredStudents.map((st, i) => {
                const checked =
                  selectedStudentIds.length === 0 || selectedStudentIds.includes(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => toggleSelectOne(st.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      checked
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        checked ? 'text-blue-600' : 'text-slate-300'
                      }`}
                    />
                    <span>
                      {i + 1}. {st.name} <span className="opacity-70">({st.kelas})</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detailed Settings Accordion / Tab */}
        {activeTab === 'settings' && (
          <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-5 animate-fadeIn">
            {/* Card Size Selector Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Pilih Preset Ukuran Kartu (Standar Internasional & Ukuran Khusus)
                  </h3>
                </div>
                <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-100/60 px-3 py-1 rounded-lg border border-blue-200">
                  Aktif: {activeSizeSpec.widthCm} × {activeSizeSpec.heightCm} cm • {activeSizeSpec.cardsPerPageA4} Kartu / Lembar A4
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {(Object.keys(CARD_SIZE_PRESETS) as Array<Exclude<CardSizePresetId, 'khusus_custom'>>).map((key) => {
                  const opt = CARD_SIZE_PRESETS[key];
                  const isSelected = cardSizePreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCardSizePreset(key)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-600/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isSelected ? 'text-blue-700' : 'text-slate-400'
                          }`}
                        >
                          {opt.category}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{opt.shortLabel}</div>
                        <div className="font-mono text-xs font-bold text-indigo-950 mt-0.5">
                          {opt.widthCm} × {opt.heightCm} cm
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 leading-tight">
                        {opt.description}
                      </div>
                    </button>
                  );
                })}

                {/* Custom Size Preset Button */}
                <button
                  type="button"
                  onClick={() => setCardSizePreset('khusus_custom')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    cardSizePreset === 'khusus_custom'
                      ? 'bg-purple-50 border-purple-600 ring-2 ring-purple-600/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        cardSizePreset === 'khusus_custom' ? 'text-purple-700' : 'text-slate-400'
                      }`}
                    >
                      Kustomisasi
                    </span>
                    {cardSizePreset === 'khusus_custom' && (
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Ukuran Khusus Kustom</div>
                    <div className="font-mono text-xs font-bold text-purple-950 mt-0.5">
                      {customWidthMm} × {customHeightMm} mm
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Atur lebar dan tinggi milimeter secara leluasa sesuai wadah.
                  </div>
                </button>
              </div>

              {/* Custom Dimension Inputs */}
              {cardSizePreset === 'khusus_custom' && (
                <div className="p-4 bg-white rounded-2xl border border-purple-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Lebar Kartu (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={65}
                      max={190}
                      value={customWidthMm}
                      onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Tinggi Kartu (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={45}
                      max={130}
                      value={customHeightMm}
                      onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomWidthMm(85.6);
                        setCustomHeightMm(53.98);
                        setCardSizePreset('cr80');
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition-all"
                    >
                      Reset ke CR-80 Standar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Title & Metadata Customization */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Judul Utama Kartu
                </label>
                <input
                  type="text"
                  value={customCardTitle}
                  onChange={(e) => setCustomCardTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Sub-Judul / Periode Pelaksanaan
                </label>
                <input
                  type="text"
                  value={customSubTitle}
                  onChange={(e) => setCustomSubTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Tanggal Pengesahan Kartu
                </label>
                <input
                  type="text"
                  value={printDate}
                  onChange={(e) => setPrintDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================== */}
      {/* LIVE PREVIEW & PRINTABLE A4 SHEET PRESENTATION */}
      {/* ========================================================================== */}
      <div className="space-y-4">
        {/* Preview Control & Information Bar */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-slate-700">
              Pratinjau Lembar Cetak Kertas A4 ({targetStudents.length} Kartu Siap Cetak)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 font-mono">
              Ukuran: <strong>{activeSizeSpec.widthCm} × {activeSizeSpec.heightCm} cm</strong> ({activeSizeSpec.cardsPerPageA4} Kartu per Halaman)
            </span>
          </div>
        </div>

        {/* Paper Sheet Preview Container */}
        <div className="overflow-x-auto pb-8 pt-2">
          <div className="max-w-5xl mx-auto bg-slate-200/60 p-4 sm:p-8 rounded-3xl border border-slate-300/80 shadow-inner">
            <div className="print-a4-grid grid grid-cols-1 md:grid-cols-2 gap-5 justify-items-center">
              {targetStudents.map((student, idx) => {
                const cardNo = idx + 1;
                const roomName = getRoomForClass(student.kelas);
                const studentPassword =
                  student.password || `CBT-${student.nomorPeserta.slice(-3) || '2026'}*`;

                return (
                  <div
                    key={student.id}
                    style={{
                      width: `${activeSizeSpec.widthMm}mm`,
                      minHeight: `${activeSizeSpec.heightMm}mm`,
                    }}
                    className={`print-cr80-card relative max-w-full bg-white rounded-xl border-[1.5px] border-slate-900 p-3 shadow-md print:shadow-none flex flex-col justify-between text-slate-900 overflow-hidden ${
                      showCutMarks ? 'outline-1 outline-dashed outline-slate-300' : ''
                    }`}
                  >
                    {/* Watermark Background pattern */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
                      <ShieldCheck className="w-48 h-48 text-slate-900" />
                    </div>

                    {/* Top Section: Kop Sekolah & Identitas */}
                    <div className="relative z-10">
                      {/* Kop Surat / Header Kartu */}
                      <div className="border-b-[1.5px] border-slate-900 pb-1.5 mb-2 bg-gradient-to-r from-slate-50 to-blue-50/50 -mx-3 -mt-3 px-3 pt-2.5 rounded-t-xl">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-[9px] shrink-0 shadow-2xs">
                              CBT
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-[9.5px] font-black uppercase tracking-tight text-slate-900 truncate leading-tight">
                                {appSettings.schoolName}
                              </h3>
                              <p className="text-[8px] font-medium text-slate-500 truncate leading-tight">
                                NPSN: {appSettings.npsn} • {appSettings.appName}
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[8.5px] font-black shrink-0">
                            NO. {String(cardNo).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="mt-1.5 text-center">
                          <p className="text-[9px] font-black text-blue-900 uppercase tracking-wide leading-tight truncate">
                            {customCardTitle}
                          </p>
                          <p className="text-[7.5px] font-bold text-slate-600 uppercase">
                            TP {appSettings.academicYear} ({appSettings.semester})
                          </p>
                        </div>
                      </div>

                      {/* Tabel Data Peserta */}
                      <div className="space-y-1 text-[9px] leading-snug">
                        <div className="grid grid-cols-12 items-baseline">
                          <span className="col-span-4 font-bold text-slate-500 text-[8.5px]">
                            Nama Peserta
                          </span>
                          <span className="col-span-8 font-extrabold text-slate-900 truncate">
                            : {student.name}
                          </span>
                        </div>

                        <div className="grid grid-cols-12 items-baseline">
                          <span className="col-span-4 font-bold text-slate-500 text-[8.5px]">
                            Nomor Peserta
                          </span>
                          <span className="col-span-8 font-mono font-black text-indigo-950 truncate">
                            : {student.nomorPeserta}
                          </span>
                        </div>

                        <div className="grid grid-cols-12 items-baseline">
                          <span className="col-span-4 font-bold text-slate-500 text-[8.5px]">
                            Kelas / Rombel
                          </span>
                          <span className="col-span-8 font-semibold text-slate-800 truncate">
                            : {student.kelas} ({student.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan'})
                          </span>
                        </div>

                        <div className="grid grid-cols-12 items-baseline">
                          <span className="col-span-4 font-bold text-slate-500 text-[8.5px]">
                            Ruang Lab CBT
                          </span>
                          <span className="col-span-8 font-medium text-slate-700 truncate">
                            : {roomName}
                          </span>
                        </div>

                        {selectedExam && (
                          <div className="grid grid-cols-12 items-baseline">
                            <span className="col-span-4 font-bold text-slate-500 text-[8.5px]">
                              Mata Uji
                            </span>
                            <span className="col-span-8 font-semibold text-slate-800 truncate">
                              : {selectedExam.subject} ({selectedExam.code})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Box Kredensial Login (NISN & Password) */}
                      <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 flex items-center justify-between gap-2 shadow-2xs">
                        <div>
                          <span className="block text-[7px] font-black uppercase tracking-wider text-slate-400">
                            USERNAME / NISN
                          </span>
                          <span className="font-mono text-[9.5px] font-black text-slate-900">
                            {student.username}
                          </span>
                        </div>

                        {showPasswordOnCard && (
                          <div>
                            <span className="block text-[7px] font-black uppercase tracking-wider text-amber-700">
                              PASSWORD LOGIN
                            </span>
                            <span className="inline-block font-mono text-[9.5px] font-black text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                              {studentPassword}
                            </span>
                          </div>
                        )}

                        {selectedExam && showTokenOnCard && (
                          <div>
                            <span className="block text-[7px] font-black uppercase tracking-wider text-blue-700">
                              TOKEN
                            </span>
                            <span className="font-mono text-[9px] font-black text-blue-900 bg-blue-100/80 px-1.5 py-0.5 rounded">
                              {selectedExam.token}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Catatan Resmi & Pengesahan */}
                    <div className="relative z-10 mt-2 pt-1.5 border-t border-dashed border-slate-300 flex items-end justify-between gap-2">
                      <div className="text-[7.5px] text-slate-500 leading-tight">
                        <p className="font-bold text-slate-700">Kartu Resmi CBT</p>
                        <p>Wajib dibawa saat ujian.</p>
                        <p className="font-mono text-[7px] text-slate-400 mt-0.5">
                          {activeSizeSpec.widthCm}×{activeSizeSpec.heightCm} cm
                        </p>
                      </div>

                      {/* Signature Box */}
                      <div className="relative text-[8px] text-slate-700 text-left min-w-[125px] leading-tight">
                        {showOfficialStamp && (
                          <div className="absolute right-0 top-1 w-16 h-8 border border-pink-400/60 rounded-full flex items-center justify-center rotate-[-12deg] pointer-events-none opacity-40">
                            <span className="text-[6px] font-black text-pink-700 uppercase tracking-tighter">
                              PANITIA CBT
                            </span>
                          </div>
                        )}
                        <p>
                          {appSettings.citySignature}, {printDate}
                        </p>
                        <p className="font-semibold">Kepala Sekolah / Panitia,</p>
                        <div className="h-3.5" />
                        <p className="font-extrabold text-slate-900 underline truncate">
                          {appSettings.principalName}
                        </p>
                        <p className="text-[7px] text-slate-500 font-mono">
                          NIP. {appSettings.principalNip}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
