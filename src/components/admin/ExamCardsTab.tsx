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
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useCBT } from '../../context/CBTContext';

export type CardSizePresetId = 'cr80' | 'khusus_panitia' | 'khusus_b2' | 'khusus_custom';

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
  rowsPerA4: number;
}

const CARD_SIZE_PRESETS: Record<Exclude<CardSizePresetId, 'khusus_custom'>, CardDimensionSpec> = {
  cr80: {
    id: 'cr80',
    category: 'Standar Internasional',
    label: 'Standar Internasional (CR-80 / ID-1): 8,56 × 5,4 cm (85,6 × 53,98 mm)',
    shortLabel: 'CR-80 / ID-1 (85,6 × 53,98 mm)',
    widthMm: 85.6,
    heightMm: 53.98,
    widthCm: '8,56',
    heightCm: '5,4',
    cardsPerPageA4: 10,
    rowsPerA4: 5,
  },
  khusus_panitia: {
    id: 'khusus_panitia',
    category: 'Ukuran Khusus',
    label: 'Ukuran Khusus Panitia (9,5 × 6,0 cm / 95 × 60 mm)',
    shortLabel: 'Khusus Panitia (95 × 60 mm)',
    widthMm: 95,
    heightMm: 60,
    widthCm: '9,5',
    heightCm: '6,0',
    cardsPerPageA4: 8,
    rowsPerA4: 4,
  },
  khusus_b2: {
    id: 'khusus_b2',
    category: 'Ukuran Khusus',
    label: 'Ukuran Khusus Lanyard B2 (10,0 × 6,5 cm / 100 × 65 mm)',
    shortLabel: 'Khusus B2 (100 × 65 mm)',
    widthMm: 100,
    heightMm: 65,
    widthCm: '10,0',
    heightCm: '6,5',
    cardsPerPageA4: 8,
    rowsPerA4: 4,
  },
};

export const ExamCardsTab: React.FC = () => {
  const { appSettings, classes, users, exams, showToast } = useCBT();

  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPasswordOnCard, setShowPasswordOnCard] = useState<boolean>(true);
  const [showTokenOnCard, setShowTokenOnCard] = useState<boolean>(false);
  const [cardSizePreset, setCardSizePreset] = useState<CardSizePresetId>('cr80');
  const [customWidthMm, setCustomWidthMm] = useState<number>(85.6);
  const [customHeightMm, setCustomHeightMm] = useState<number>(53.98);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const [customCardTitle, setCustomCardTitle] = useState<string>(
    appSettings.examCardTitle || 'KARTU PESERTA PENILAIAN AKHIR TAHUN (CBT)'
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
      rowsPerA4: rows,
    };
  }, [cardSizePreset, customWidthMm, customHeightMm]);

  const students = useMemo(() => users.filter((u) => u.role === 'siswa'), [users]);

  const classOptions = useMemo(() => {
    const set = new Set<string>(classes.map((c) => c.namaKelas));
    students.forEach((s) => {
      if (s.kelas) set.add(s.kelas);
    });
    return Array.from(set);
  }, [classes, students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const matchClass = classFilter === 'ALL' || s.kelas === classFilter;
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.nomorPeserta.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [students, classFilter, searchQuery]);

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

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId),
    [exams, selectedExamId]
  );

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
  // CETAK DALAM PDF UKURAN A4 (210 x 297 mm) DENGAN UKURAN KARTU PRESISI (CR-80 / KHUSUS)
  // TANPA PASFOTO & TANPA QR CODE
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
      const cardW = activeSizeSpec.widthMm; // 85.6 mm for CR-80 / ID-1
      const cardH = activeSizeSpec.heightMm; // 53.98 mm for CR-80 / ID-1

      const cols = cardW * 2 + 12 <= pageWidth ? 2 : 1;
      const gapX = 6; // 6 mm horizontal spacing between cards
      const gapY = 4; // 4 mm vertical spacing between cards
      const rows = Math.max(1, Math.floor((pageHeight - 20) / (cardH + gapY)));
      const cardsPerPage = cols * rows;

      const totalGridW = cols * cardW + (cols - 1) * gapX;
      const startX = (pageWidth - totalGridW) / 2;
      const startY = 12; // Top margin 12 mm on A4

      targetStudents.forEach((st, idx) => {
        const indexOnPage = idx % cardsPerPage;
        if (idx > 0 && indexOnPage === 0) {
          doc.addPage('a4', 'portrait');
        }

        // Draw subtle page header info on top of each A4 page
        if (indexOnPage === 0) {
          const currentPage = Math.floor(idx / cardsPerPage) + 1;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(
            `${appSettings.schoolName} — Lembar Cetak Kartu Ujian A4 (${activeSizeSpec.shortLabel}) • Halaman ${currentPage}/${Math.ceil(
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

        // Scale factor relative to CR-80 (85.6 x 53.98 mm)
        const scale = Math.min(cardW / 85.6, cardH / 53.98);

        // 1. Outer Card Border (CR-80 / Custom size)
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.35);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'S');

        // 2. Top Header Banner inside Card
        const headerH = 11.5 * scale;
        doc.setFillColor(241, 245, 249);
        doc.rect(x + 0.3, y + 0.3, cardW - 0.6, headerH, 'F');

        // Double divider line below header
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.3);
        doc.line(x, y + headerH, x + cardW, y + headerH);

        // School Name
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8 * scale);
        const schoolTitle = (appSettings.schoolName || 'SMA NEGERI 1 NUSANTARA').toUpperCase();
        doc.text(schoolTitle.slice(0, 42), x + 2.5, y + 3.6 * scale);

        // Card Number Badge on Top Right
        const badgeText = `NO. ${String(idx + 1).padStart(2, '0')}`;
        doc.setFillColor(15, 23, 42);
        const badgeW = 13.5 * scale;
        const badgeH = 3.8 * scale;
        doc.roundedRect(x + cardW - badgeW - 2.2, y + 1.4 * scale, badgeW, badgeH, 0.8, 0.8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('courier', 'bold');
        doc.setFontSize(5.8 * scale);
        doc.text(badgeText, x + cardW - badgeW / 2 - 2.2, y + 3.9 * scale, {
          align: 'center',
        });

        // Card Title & Academic Year
        doc.setTextColor(29, 78, 216);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2 * scale);
        doc.text(
          customCardTitle.toUpperCase().slice(0, 48),
          x + cardW / 2,
          y + 7.4 * scale,
          { align: 'center' }
        );

        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.2 * scale);
        doc.text(
          `TP ${appSettings.academicYear} (${appSettings.semester}) • NPSN: ${appSettings.npsn} • ${appSettings.appName}`,
          x + cardW / 2,
          y + 10.2 * scale,
          { align: 'center' }
        );

        // 3. Student Identity Rows
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

        // 4. Credentials Strip (Username / NISN & Password Login)
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

        // 5. Card Footer (Tanpa Pasfoto & Tanpa QR — Info Ukuran & Tanda Tangan Kepala Sekolah)
        const footerTopY = y + cardH - 11.8 * scale;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(x + 2.5, footerTopY, x + cardW - 2.5, footerTopY);

        // Left Note inside Footer
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(4.8 * scale);
        doc.setTextColor(100, 116, 139);
        doc.text('Kartu Resmi Peserta Ujian CBT', x + 2.8, footerTopY + 3.2 * scale);
        doc.text('Wajib dibawa saat sesi ujian.', x + 2.8, footerTopY + 5.8 * scale);
        doc.setFont('courier', 'normal');
        doc.setFontSize(4.4 * scale);
        doc.text(activeSizeSpec.shortLabel, x + 2.8, footerTopY + 8.6 * scale);

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
          <div>
            <div class="card-header">
              <div class="header-top">
                <div>
                  <div class="school-name">${appSettings.schoolName}</div>
                  <div class="school-sub">NPSN: ${appSettings.npsn} • ${appSettings.appName}</div>
                </div>
                <div class="badge-no">NO. ${String(idx + 1).padStart(2, '0')}</div>
              </div>
              <div class="card-title">${customCardTitle}</div>
              <div class="card-period">TAHUN PELAJARAN ${appSettings.academicYear} (${appSettings.semester.toUpperCase()})</div>
            </div>
            <div class="card-body">
              <table class="info-table">
                <tr><td class="lbl">Nama Peserta</td><td class="sep">:</td><td class="val bold">${st.name}</td></tr>
                <tr><td class="lbl">Nomor Peserta</td><td class="sep">:</td><td class="val mono bold">${st.nomorPeserta}</td></tr>
                <tr><td class="lbl">Kelas / Rombel</td><td class="sep">:</td><td class="val">${st.kelas} (${st.jenisKelamin})</td></tr>
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
              </div>
            </div>
          </div>
          <div class="card-footer">
            <div class="card-note">
              <div>Kartu Resmi Peserta CBT</div>
              <div class="mono-note">${activeSizeSpec.shortLabel}</div>
            </div>
            <div class="sign-box">
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
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { margin: 0; padding: 10mm; background: #fff; color: #0f172a; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, ${activeSizeSpec.widthMm}mm);
      justify-content: center;
      gap: 4mm 6mm;
    }
    .card {
      width: ${activeSizeSpec.widthMm}mm;
      height: ${activeSizeSpec.heightMm}mm;
      border: 1.2px solid #0f172a;
      border-radius: 6px;
      padding: 2.2mm 2.8mm;
      page-break-inside: avoid;
      break-inside: avoid;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .card-header { border-bottom: 1.5px double #0f172a; padding-bottom: 1.2mm; margin-bottom: 1.5mm; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; }
    .school-name { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; color: #0f172a; line-height: 1.1; }
    .school-sub { font-size: 5.5pt; color: #475569; }
    .badge-no { font-size: 6pt; font-weight: 800; font-family: monospace; background: #0f172a; color: #fff; padding: 1px 4px; border-radius: 3px; white-space: nowrap; }
    .card-title { font-size: 6.5pt; font-weight: 800; text-align: center; margin-top: 1mm; color: #1d4ed8; text-transform: uppercase; }
    .card-period { font-size: 5.2pt; font-weight: 600; text-align: center; color: #334155; }
    .info-table { width: 100%; border-collapse: collapse; font-size: 6.2pt; line-height: 1.22; }
    .info-table td { padding: 0.3mm 0; vertical-align: top; }
    .lbl { width: 21mm; color: #475569; font-weight: 600; }
    .sep { width: 2mm; text-align: center; }
    .val { color: #0f172a; }
    .bold { font-weight: 700; }
    .mono { font-family: 'Courier New', monospace; }
    .cred-strip { margin-top: 1.2mm; padding: 1mm 2mm; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; justify-content: space-between; gap: 6px; }
    .cred-lbl { display: block; font-size: 4.8pt; font-weight: 700; color: #64748b; }
    .pass-lbl { color: #b45309; }
    .cred-val { font-size: 6.5pt; font-weight: 800; color: #0f172a; }
    .pass-val { color: #92400e; background: #fef3c7; padding: 0 3px; border-radius: 2px; }
    .card-footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 1mm; border-top: 1px dashed #cbd5e1; }
    .card-note { font-size: 5pt; color: #64748b; line-height: 1.2; }
    .mono-note { font-family: monospace; font-size: 4.8pt; color: #475569; }
    .sign-box { font-size: 5.2pt; text-align: left; min-width: 34mm; line-height: 1.15; }
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
  <div class="no-print" style="margin-bottom:14px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <span style="font-size:13px;font-weight:700;color:#1e3a8a;">Dokumen Siap Cetak Kertas A4 — Ukuran ${activeSizeSpec.label} (${targetStudents.length} Kartu, Tanpa Pasfoto & QR)</span>
    <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:700;cursor:pointer;">Cetak / Simpan PDF Ukuran A4 (Ctrl+P)</button>
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

  return (
    <div className="space-y-6">
      {/* Print-only CSS rules for exact A4 & CR-80 physical dimensions */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: #ffffff !important;
          }
          .print-a4-grid {
            display: grid !important;
            grid-template-columns: repeat(2, ${activeSizeSpec.widthMm}mm) !important;
            justify-content: center !important;
            gap: 4mm 6mm !important;
          }
          .print-cr80-card {
            width: ${activeSizeSpec.widthMm}mm !important;
            height: ${activeSizeSpec.heightMm}mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      {/* Control Header (Hidden on Print) */}
      <div className="print:hidden bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600 shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Cetak Bulk Kartu Ujian Siswa (Ukuran Standar CR-80 / ID-1 & Khusus)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Standar Internasional <strong>CR-80 / ID-1: 8,56 × 5,4 cm (85,6 × 53,98 mm)</strong> — Ringkas tanpa pasfoto dan tanpa QR code, siap cetak langsung ke <strong>PDF ukuran kertas A4</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdfA4}
              className="inline-flex items-center gap-2 bg-[#1D4ED8] hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              <span>
                {isGeneratingPdf
                  ? 'Menyusun PDF A4...'
                  : `Cetak / Unduh PDF Ukuran A4 (${targetStudents.length} Kartu)`}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrintBrowser}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Cetak Kertas A4 ({totalA4Pages} Hal)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPrintableHtml}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Unduh HTML A4</span>
            </button>
          </div>
        </div>

        {/* Ukuran Kartu Selector: Ukuran Standar (CR-80 / ID-1) dan Ukuran Khusus */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Pilih Ukuran Kartu: Ukuran Standar dan Khusus (Kertas Cetak A4: 210 × 297 mm)
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              Dimensi Aktif: {activeSizeSpec.widthCm} × {activeSizeSpec.heightCm} cm ({activeSizeSpec.widthMm} × {activeSizeSpec.heightMm} mm) • {activeSizeSpec.cardsPerPageA4} Kartu / Lembar A4
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {(
              [
                {
                  id: 'cr80' as CardSizePresetId,
                  badge: 'Standar Internasional',
                  title: 'CR-80 / ID-1 (Standar)',
                  dim: '8,56 × 5,4 cm (85,6 × 53,98 mm)',
                  sub: '10 Kartu per halaman A4',
                },
                {
                  id: 'khusus_panitia' as CardSizePresetId,
                  badge: 'Ukuran Khusus',
                  title: 'Khusus Panitia (B1)',
                  dim: '9,5 × 6,0 cm (95 × 60 mm)',
                  sub: '8 Kartu per halaman A4',
                },
                {
                  id: 'khusus_b2' as CardSizePresetId,
                  badge: 'Ukuran Khusus',
                  title: 'Khusus Holder B2',
                  dim: '10,0 × 6,5 cm (100 × 65 mm)',
                  sub: '8 Kartu per halaman A4',
                },
                {
                  id: 'khusus_custom' as CardSizePresetId,
                  badge: 'Ukuran Khusus Kustom',
                  title: 'Kustomisasi Milimeter',
                  dim: `${customWidthMm} × ${customHeightMm} mm`,
                  sub: 'Atur lebar & tinggi khusus',
                },
              ] as const
            ).map((opt) => {
              const isSelected = cardSizePreset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCardSizePreset(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-600/15'
                      : 'bg-white border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isSelected ? 'text-blue-700' : 'text-slate-400'
                      }`}
                    >
                      {opt.badge}
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </div>
                  <div className="text-xs font-bold text-slate-900">{opt.title}</div>
                  <div className="font-mono text-[11px] font-semibold text-slate-700">
                    {opt.dim}
                  </div>
                  <div className="text-[10px] text-slate-500">{opt.sub}</div>
                </button>
              );
            })}
          </div>

          {cardSizePreset === 'khusus_custom' && (
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Lebar Kartu (mm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={65}
                  max={190}
                  value={customWidthMm}
                  onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Tinggi Kartu (mm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={45}
                  max={130}
                  value={customHeightMm}
                  onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
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
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Kembalikan ke Standar CR-80 (85,6 × 53,98 mm)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter & Card Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Filter Kelas / Rombel
            </label>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setSelectedStudentIds([]);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
            >
              <option value="ALL">Semua Kelas ({students.length} Siswa)</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  Kelas {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Paket Ujian pada Kartu (Opsional)
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
            >
              <option value="ALL">Kartu Umum (Berlaku Semua Mata Uji)</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.code} — {ex.subject}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Judul Tajuk Kartu Ujian
            </label>
            <input
              type="text"
              value={customCardTitle}
              onChange={(e) => setCustomCardTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Tanggal Pengesahan Kartu
            </label>
            <input
              type="text"
              value={printDate}
              onChange={(e) => setPrintDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>
        </div>

        {/* Search & Student Selection Strip */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa, NISN, atau nomor peserta..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPasswordOnCard((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer shrink-0 ${
                showPasswordOnCard
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {showPasswordOnCard ? (
                <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Cetak Password di Kartu</span>
            </button>

            {selectedExam && (
              <button
                type="button"
                onClick={() => setShowTokenOnCard((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer shrink-0 ${
                  showTokenOnCard
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>Sertakan Token ({selectedExam.token})</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Batal Pilih Semua</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 shrink-0" />
                  <span>Pilih Spesifik ({selectedStudentIds.length || 'Semua'})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Multi-Select Selector */}
        <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase">
              Daftar Peserta yang Akan Dicetak ({targetStudents.length} Kartu • Tanpa Pasfoto & Tanpa QR):
            </span>
            {selectedStudentIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Reset ke Semua Siswa Terfilter ({filteredStudents.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {filteredStudents.map((st, i) => {
              const checked =
                selectedStudentIds.length === 0 || selectedStudentIds.includes(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => toggleSelectOne(st.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                    checked
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3 h-3 shrink-0 ${
                      checked ? 'text-indigo-600' : 'text-slate-300'
                    }`}
                  />
                  <span>
                    {i + 1}. {st.name} ({st.kelas})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================== */}
      {/* LIVE PREVIEW & PRINTABLE A4 SHEET LAYOUT (CR-80: 85,6 x 53,98 mm, NO PHOTO/QR) */}
      {/* ========================================================================== */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Pratinjau Kartu Ujian Presisi — <strong>{activeSizeSpec.label}</strong> (Tanpa Pasfoto & Tanpa QR)
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          Kertas Cetak: A4 (210 × 297 mm) • Estimasi: {totalA4Pages} Halaman A4
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="print-a4-grid grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center max-w-4xl mx-auto">
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
                className="print-cr80-card max-w-full bg-white rounded-lg border-[1.5px] border-slate-900 p-2.5 shadow-xs print:shadow-none flex flex-col justify-between text-slate-900"
              >
                {/* Top Section: Kop Sekolah & Identitas Peserta */}
                <div>
                  {/* Kop Sekolah Ringkas */}
                  <div className="border-b-2 border-slate-900 pb-1.5 mb-1.5 bg-slate-50/80 -mx-2.5 -mt-2.5 px-2.5 pt-2 rounded-t-md">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center shrink-0">
                          <Building2 className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[9px] font-extrabold uppercase tracking-tight text-slate-900 truncate">
                            {appSettings.schoolName}
                          </h3>
                          <p className="text-[7.5px] text-slate-500 truncate">
                            NPSN: {appSettings.npsn} • {appSettings.appName}
                          </p>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[8px] font-bold shrink-0">
                        NO. {String(cardNo).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="mt-1 text-center">
                      <p className="text-[8.5px] font-extrabold text-blue-800 uppercase tracking-wide leading-tight truncate">
                        {customCardTitle}
                      </p>
                      <p className="text-[7px] font-semibold text-slate-600 uppercase">
                        TP {appSettings.academicYear} ({appSettings.semester})
                      </p>
                    </div>
                  </div>

                  {/* Tabel Identitas Peserta (Proporsional untuk CR-80 85,6 x 53,98 mm) */}
                  <div className="space-y-0.5 text-[8.5px] leading-snug">
                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 font-semibold text-slate-500">
                        Nama Peserta
                      </span>
                      <span className="col-span-8 font-bold text-slate-900 truncate">
                        : {student.name}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 font-semibold text-slate-500">
                        Nomor Peserta
                      </span>
                      <span className="col-span-8 font-mono font-bold text-indigo-950 truncate">
                        : {student.nomorPeserta}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 font-semibold text-slate-500">
                        Kelas / Rombel
                      </span>
                      <span className="col-span-8 font-semibold text-slate-800 truncate">
                        : {student.kelas} ({student.jenisKelamin === 'L' ? 'L' : 'P'})
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 font-semibold text-slate-500">
                        Ruang Lab CBT
                      </span>
                      <span className="col-span-8 font-medium text-slate-700 truncate">
                        : {roomName}
                      </span>
                    </div>

                    {selectedExam && (
                      <div className="grid grid-cols-12 items-baseline">
                        <span className="col-span-4 font-semibold text-slate-500">
                          Mata Uji
                        </span>
                        <span className="col-span-8 font-semibold text-slate-800 truncate">
                          : {selectedExam.subject} ({selectedExam.code})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Kotak Kredensial Login (Username / NISN & Password) */}
                  <div className="mt-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-300 flex items-center justify-between gap-2">
                    <div>
                      <span className="block text-[6.5px] font-bold uppercase text-slate-400">
                        Username / NISN
                      </span>
                      <span className="font-mono text-[9px] font-extrabold text-slate-900">
                        {student.username}
                      </span>
                    </div>

                    {showPasswordOnCard && (
                      <div>
                        <span className="block text-[6.5px] font-bold uppercase text-amber-700">
                          Password Login
                        </span>
                        <span className="inline-block font-mono text-[9px] font-extrabold text-amber-950 bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-300">
                          {studentPassword}
                        </span>
                      </div>
                    )}

                    {selectedExam && showTokenOnCard && (
                      <div>
                        <span className="block text-[6.5px] font-bold uppercase text-indigo-700">
                          Token
                        </span>
                        <span className="font-mono text-[8.5px] font-bold text-indigo-900">
                          {selectedExam.token}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Tanpa Pasfoto & Tanpa QR — Hanya Catatan Resmi & Pengesahan */}
                <div className="mt-1.5 pt-1 border-t border-dashed border-slate-300 flex items-end justify-between gap-2">
                  <div className="text-[7px] text-slate-500 leading-tight">
                    <p className="font-semibold text-slate-700">Kartu Resmi Peserta CBT</p>
                    <p>Bawa kartu saat sesi ujian.</p>
                    <p className="font-mono text-[6.5px] text-slate-400 mt-0.5">
                      {activeSizeSpec.widthCm}×{activeSizeSpec.heightCm} cm
                    </p>
                  </div>

                  <div className="text-[7.5px] text-slate-700 text-left min-w-[115px] leading-tight">
                    <p>
                      {appSettings.citySignature}, {printDate}
                    </p>
                    <p className="font-semibold">Kepala Sekolah / Ketua Panitia,</p>
                    <div className="h-3" />
                    <p className="font-bold text-slate-900 underline truncate">
                      {appSettings.principalName}
                    </p>
                    <p className="text-[6.8px] text-slate-500 font-mono">
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
  );
};
