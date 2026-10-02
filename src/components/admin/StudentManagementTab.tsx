import React, { useMemo, useRef, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  RotateCcw,
  X,
  Database,
  ShieldCheck,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { UserAccount } from '../../types/cbt';

interface ParsedStudentRow {
  rowIndex: number; // 1-based auto increment in preview
  username: string;
  password: string;
  name: string;
  role: 'siswa';
  kelas: string;
  nomorPeserta: string;
  jenisKelamin: 'L' | 'P';
  sekolah: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface BulkUploadResultReport {
  timestamp: string;
  totalProcessed: number;
  succeeded: UserAccount[];
  failed: Array<{
    rowNumber: number;
    username: string;
    name: string;
    kelas: string;
    nomorPeserta: string;
    reason: string;
  }>;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function generateStudentPassword(nomorPeserta?: string): string {
  const suffix = (nomorPeserta || '').replace(/[^0-9A-Za-z]/g, '').slice(-3);
  const rand = Math.floor(10 + Math.random() * 89);
  return `CBT-${suffix || rand}*`;
}

interface StudentManagementTabProps {
  initialClassFilter?: string;
}

export const StudentManagementTab: React.FC<StudentManagementTabProps> = ({
  initialClassFilter = 'ALL',
}) => {
  const {
    appSettings,
    classes,
    users,
    sessions,
    addUserAccount,
    bulkAddUsers,
    updateUserAccount,
    deleteUserAccount,
    bulkDeleteUsers,
    resetStudentSession,
    generateNextStudentNomorPeserta,
    showToast,
  } = useCBT();

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>(initialClassFilter || 'ALL');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'L' | 'P'>('ALL');
  const [showAllPasswords, setShowAllPasswords] = useState<boolean>(false);
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSchemaInfo, setShowSchemaInfo] = useState<boolean>(false);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);

  // Single Deletion Confirmation State
  const [studentToDelete, setStudentToDelete] = useState<UserAccount | null>(null);

  // Add / Edit Student Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserAccount | null>(null);
  const [showModalPassword, setShowModalPassword] = useState(true);
  const [nomorPesertaMode, setNomorPesertaMode] = useState<'auto' | 'manual'>('auto');
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    kelas: classes[0]?.namaKelas || 'XII MIPA 1',
    nomorPeserta: '',
    jenisKelamin: 'L' as 'L' | 'P',
    sekolah: appSettings.schoolName || 'SMA Negeri 1 Nusantara Jakarta',
  });

  // Bulk Upload Modal & Validation State
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkTab, setBulkTab] = useState<'csv' | 'paste' | 'json'>('csv');
  const [defaultBulkKelas, setDefaultBulkKelas] = useState<string>(
    classes[0]?.namaKelas || 'XII MIPA 1'
  );
  const [defaultBulkSekolah, setDefaultBulkSekolah] = useState<string>(
    'SMA Negeri 1 Nusantara Jakarta'
  );
  const [rawBulkText, setRawBulkText] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [hasCheckedData, setHasCheckedData] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [skipInvalidRows, setSkipInvalidRows] = useState<boolean>(true);
  const [uploadReport, setUploadReport] = useState<BulkUploadResultReport | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const students = useMemo(() => users.filter((u) => u.role === 'siswa'), [users]);

  const classOptions = useMemo(() => {
    const names = new Set<string>(classes.map((c) => c.namaKelas));
    students.forEach((s) => {
      if (s.kelas) names.add(s.kelas);
    });
    return Array.from(names);
  }, [classes, students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const matchesClass = classFilter === 'ALL' || s.kelas === classFilter;
      const matchesGender = genderFilter === 'ALL' || s.jenisKelamin === genderFilter;
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.nomorPeserta.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q) ||
        (s.password ?? '').toLowerCase().includes(q);
      return matchesClass && matchesGender && matchesQuery;
    });
  }, [students, searchQuery, classFilter, genderFilter]);

  const studentStats = useMemo(() => {
    const total = students.length;
    const male = students.filter((s) => s.jenisKelamin === 'L').length;
    const female = students.filter((s) => s.jenisKelamin === 'P').length;
    const completedIds = new Set(
      sessions
        .filter((s) => s.status === 'completed' || s.status === 'timed_out')
        .map((s) => s.studentId)
    );
    const activeIds = new Set(
      sessions.filter((s) => s.status === 'in_progress').map((s) => s.studentId)
    );
    return {
      total,
      male,
      female,
      participated: completedIds.size + activeIds.size,
    };
  }, [students, sessions]);

  // Selection Helpers
  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.includes(s.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredStudents.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const next = new Set(selectedIds);
      filteredStudents.forEach((s) => next.add(s.id));
      setSelectedIds(Array.from(next));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedStudentsList = useMemo(
    () => students.filter((s) => selectedIds.includes(s.id)),
    [students, selectedIds]
  );

  const handleConfirmBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    bulkDeleteUsers(selectedIds);
    setSelectedIds([]);
    setShowBulkDeleteConfirm(false);
    showToast(
      'Hapus Massal Berhasil',
      `${count} data siswa beserta seluruh riwayat nilai/sesi ujian mereka telah dihapus secara permanen dari database.`,
      'info'
    );
  };

  const toggleRowPassword = (id: string) => {
    setRevealedPasswordIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyCredentials = (student: UserAccount) => {
    const pass = student.password || generateStudentPassword(student.nomorPeserta);
    const text = `NISN/Username: ${student.username} | Password: ${pass} | No. Peserta: ${student.nomorPeserta}`;
    navigator.clipboard.writeText(text);
    setCopiedId(student.id);
    showToast('Kredensial Siswa Disalin', `${student.name} (${student.username})`, 'info');
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openAddModal = () => {
    setEditingStudent(null);
    const nextNoPeserta = generateNextStudentNomorPeserta(0);
    const nextSuffix = nextNoPeserta.slice(-3) || String(students.length + 1).padStart(3, '0');
    setNomorPesertaMode('auto');
    setForm({
      username: '',
      password: `CBT-${nextSuffix}*`,
      name: '',
      kelas: classFilter !== 'ALL' ? classFilter : classOptions[0] || 'XII MIPA 1',
      nomorPeserta: nextNoPeserta,
      jenisKelamin: 'L',
      sekolah: appSettings.schoolName || 'SMA Negeri 1 Nusantara Jakarta',
    });
    setShowModalPassword(true);
    setShowModal(true);
  };

  const openEditModal = (student: UserAccount) => {
    setEditingStudent(student);
    setNomorPesertaMode('manual');
    setForm({
      username: student.username,
      password: student.password || generateStudentPassword(student.nomorPeserta),
      name: student.name,
      kelas: student.kelas,
      nomorPeserta: student.nomorPeserta,
      jenisKelamin: student.jenisKelamin,
      sekolah: student.sekolah,
    });
    setShowModalPassword(true);
    setShowModal(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedNoPeserta =
      nomorPesertaMode === 'auto'
        ? form.nomorPeserta.trim() || generateNextStudentNomorPeserta(0)
        : form.nomorPeserta.trim() || generateNextStudentNomorPeserta(0);

    if (!form.username.trim() || !form.name.trim()) {
      showToast('Data Belum Lengkap', 'NISN dan Nama Lengkap wajib diisi.', 'warning');
      return;
    }
    if (!form.password.trim()) {
      showToast('Password Wajib Diisi', 'Kolom password siswa tidak boleh kosong.', 'warning');
      return;
    }

    if (editingStudent) {
      updateUserAccount(editingStudent.id, {
        username: form.username.trim(),
        password: form.password.trim(),
        name: form.name.trim(),
        role: 'siswa',
        kelas: form.kelas,
        nomorPeserta: resolvedNoPeserta,
        jenisKelamin: form.jenisKelamin,
        sekolah: form.sekolah.trim() || appSettings.schoolName || 'SMA Negeri 1 Nusantara Jakarta',
      });
      setShowModal(false);
    } else {
      const res = addUserAccount({
        username: form.username.trim(),
        password: form.password.trim(),
        name: form.name.trim(),
        role: 'siswa',
        kelas: form.kelas,
        nomorPeserta: resolvedNoPeserta,
        jenisKelamin: form.jenisKelamin,
        sekolah: form.sekolah.trim() || appSettings.schoolName || 'SMA Negeri 1 Nusantara Jakarta',
      });
      if (!res.ok) {
        showToast('Gagal Menambah Siswa', res.message, 'error');
        return;
      }
      setShowModal(false);
    }
  };

  const exportStudentsCSV = () => {
    const headers = [
      'no',
      'username',
      'password',
      'name',
      'role',
      'kelas',
      'nomor_peserta',
      'jenis_kelamin',
      'sekolah',
    ];
    const rows = filteredStudents.map((s, idx) => [
      idx + 1,
      `"${s.username}"`,
      `"${(s.password || '').replace(/"/g, '""')}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.role}"`,
      `"${s.kelas}"`,
      `"${s.nomorPeserta}"`,
      s.jenisKelamin,
      `"${s.sekolah.replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `data_siswa_nusantaracbt_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Ekspor Berhasil', 'Data siswa beserta kolom password berhasil diunduh (.CSV).', 'success');
  };

  // ============================================================================
  // BULK UPLOAD & PRE-VALIDATION LOGIC
  // ============================================================================
  const downloadTemplateCSV = () => {
    const sampleClass = classOptions[0] || 'XII MIPA 1';
    const secondClass = classOptions[1] || sampleClass;
    const baseNum = students.length + 1;
    const n1 = String(baseNum).padStart(3, '0');
    const n2 = String(baseNum + 1).padStart(3, '0');
    const n3 = String(baseNum + 2).padStart(3, '0');

    const headers = [
      'username',
      'password',
      'name',
      'role',
      'kelas',
      'nomor_peserta',
      'jenis_kelamin',
      'sekolah',
    ];
    const sampleRows = [
      [
        `"0089123${n1}"`,
        `"CBT-${n1}*"`,
        `"Bagas Pratama Putra"`,
        `"siswa"`,
        `"${sampleClass}"`,
        `"26-01-0104-${n1}"`,
        `"L"`,
        `"SMA Negeri 1 Nusantara Jakarta"`,
      ],
      [
        `"0089123${n2}"`,
        `"CBT-${n2}*"`,
        `"Nabila Azzahra Putri"`,
        `"siswa"`,
        `"${sampleClass}"`,
        `"26-01-0104-${n2}"`,
        `"P"`,
        `"SMA Negeri 1 Nusantara Jakarta"`,
      ],
      [
        `"0089123${n3}"`,
        `"CBT-${n3}*"`,
        `"Rizky Ramadhan Hidayat"`,
        `"siswa"`,
        `"${secondClass}"`,
        `"26-01-0104-${n3}"`,
        `"L"`,
        `"SMA Negeri 1 Nusantara Jakarta"`,
      ],
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'template_bulk_upload_siswa_cbt.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(
      'Template CSV Diunduh',
      'Struktur kolom: username, password, name, role, kelas, nomor_peserta, jenis_kelamin, sekolah.',
      'info'
    );
  };

  const downloadTemplateJSON = () => {
    const sampleClass = classOptions[0] || 'XII MIPA 1';
    const baseNum = students.length + 1;
    const n1 = String(baseNum).padStart(3, '0');
    const n2 = String(baseNum + 1).padStart(3, '0');
    const templateData = [
      {
        username: `0089123${n1}`,
        password: `CBT-${n1}*`,
        name: 'Bagas Pratama Putra',
        role: 'siswa',
        kelas: sampleClass,
        nomor_peserta: `26-01-0104-${n1}`,
        jenis_kelamin: 'L',
        sekolah: 'SMA Negeri 1 Nusantara Jakarta',
      },
      {
        username: `0089123${n2}`,
        password: `CBT-${n2}*`,
        name: 'Nabila Azzahra Putri',
        role: 'siswa',
        kelas: sampleClass,
        nomor_peserta: `26-01-0104-${n2}`,
        jenis_kelamin: 'P',
        sekolah: 'SMA Negeri 1 Nusantara Jakarta',
      },
    ];
    const blob = new Blob([JSON.stringify(templateData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_bulk_upload_siswa_cbt.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Template JSON Diunduh', 'Gunakan struktur JSON ini untuk impor massal siswa.', 'info');
  };

  const validateRows = (
    rawItems: Array<{
      username: string;
      password: string;
      name: string;
      kelas: string;
      nomorPeserta: string;
      jenisKelamin: string;
      sekolah: string;
    }>
  ): ParsedStudentRow[] => {
    const existingUsernames = new Set(users.map((u) => u.username.trim().toLowerCase()));
    const existingNomorPeserta = new Set(
      users.map((u) => u.nomorPeserta.trim().toLowerCase()).filter(Boolean)
    );
    const knownClasses = new Set(classOptions.map((c) => c.toLowerCase()));

    const seenBatchUsernames = new Map<string, number>();
    const seenBatchNoPeserta = new Map<string, number>();
    let autoNoOffset = 0;

    return rawItems.map((item, idx) => {
      const rowIndex = idx + 1;
      const username = (item.username || '').trim();
      const password = (item.password || '').trim();
      const name = (item.name || '').trim();
      const kelas = (item.kelas || defaultBulkKelas || '').trim();
      let nomorPeserta = (item.nomorPeserta || '').trim();
      let wasAutoGeneratedNoPeserta = false;

      if (!nomorPeserta) {
        let candidate = generateNextStudentNomorPeserta(autoNoOffset);
        while (
          existingNomorPeserta.has(candidate.toLowerCase()) ||
          seenBatchNoPeserta.has(candidate.toLowerCase())
        ) {
          autoNoOffset++;
          candidate = generateNextStudentNomorPeserta(autoNoOffset);
        }
        nomorPeserta = candidate;
        autoNoOffset++;
        wasAutoGeneratedNoPeserta = true;
      }

      const rawJk = (item.jenisKelamin || 'L').trim().toUpperCase();
      const jenisKelamin: 'L' | 'P' =
        rawJk === 'P' || rawJk === 'PEREMPUAN' || rawJk === 'FEMALE' ? 'P' : 'L';
      const sekolah = (
        item.sekolah ||
        defaultBulkSekolah ||
        appSettings.schoolName ||
        'SMA Negeri 1 Nusantara Jakarta'
      ).trim();

      const errors: string[] = [];
      const warnings: string[] = [];

      if (wasAutoGeneratedNoPeserta) {
        warnings.push(`No. Peserta dibuat otomatis (Auto-Increment: ${nomorPeserta})`);
      }

      if (!username) {
        errors.push('Kolom username (NISN) wajib diisi');
      } else if (username.length < 3) {
        errors.push('Username / NISN minimal 3 karakter');
      }

      if (!password) {
        errors.push('Kolom password siswa wajib diisi');
      } else if (password.length < 4) {
        warnings.push('Password kurang dari 4 karakter');
      }

      if (!name) {
        errors.push('Kolom name (Nama Lengkap) wajib diisi');
      }

      if (!kelas) {
        errors.push('Kolom kelas wajib diisi');
      } else if (knownClasses.size > 0 && !knownClasses.has(kelas.toLowerCase())) {
        warnings.push(`Kelas "${kelas}" belum ada di Master Kelas`);
      }

      if (rawJk && !['L', 'P', 'LAKI-LAKI', 'PEREMPUAN', 'MALE', 'FEMALE'].includes(rawJk)) {
        errors.push(`jenis_kelamin "${item.jenisKelamin}" tidak valid (gunakan L atau P)`);
      }

      // Check duplicate with database
      if (username && existingUsernames.has(username.toLowerCase())) {
        errors.push(`Username/NISN "${username}" sudah terdaftar di database`);
      }
      if (nomorPeserta && existingNomorPeserta.has(nomorPeserta.toLowerCase())) {
        errors.push(`Nomor Peserta "${nomorPeserta}" sudah terdaftar di database`);
      }

      // Check duplicate within uploaded file batch
      if (username) {
        const lowerU = username.toLowerCase();
        if (seenBatchUsernames.has(lowerU)) {
          errors.push(
            `Duplikat username "${username}" di dalam file (sama dengan baris #${seenBatchUsernames.get(lowerU)})`
          );
        } else {
          seenBatchUsernames.set(lowerU, rowIndex);
        }
      }

      if (nomorPeserta) {
        const lowerNo = nomorPeserta.toLowerCase();
        if (seenBatchNoPeserta.has(lowerNo)) {
          errors.push(
            `Duplikat nomor_peserta "${nomorPeserta}" di dalam file (sama dengan baris #${seenBatchNoPeserta.get(lowerNo)})`
          );
        } else {
          seenBatchNoPeserta.set(lowerNo, rowIndex);
        }
      }

      return {
        rowIndex,
        username,
        password,
        name,
        role: 'siswa',
        kelas,
        nomorPeserta,
        jenisKelamin,
        sekolah,
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    });
  };

  const handleParseAndValidateInput = (textToParse?: string, modeOverride?: 'csv' | 'paste' | 'json') => {
    const source = (textToParse ?? rawBulkText).trim();
    const activeMode = modeOverride ?? bulkTab;

    if (!source) {
      showToast('Input Kosong', 'Silakan pilih file template atau tempel data terlebih dahulu.', 'warning');
      return;
    }

    try {
      let rawExtracted: Array<{
        username: string;
        password: string;
        name: string;
        kelas: string;
        nomorPeserta: string;
        jenisKelamin: string;
        sekolah: string;
      }> = [];

      if (activeMode === 'json' || source.startsWith('[')) {
        const parsedJson = JSON.parse(source);
        if (!Array.isArray(parsedJson)) {
          throw new Error('Format JSON harus berupa Array of Objects ([...]).');
        }
        rawExtracted = parsedJson.map((obj: Record<string, unknown>) => ({
          username: String(obj.username ?? obj.nisn ?? ''),
          password: String(obj.password ?? obj.pass ?? ''),
          name: String(obj.name ?? obj.nama ?? obj.nama_lengkap ?? ''),
          kelas: String(obj.kelas ?? obj.rombel ?? defaultBulkKelas),
          nomorPeserta: String(
            obj.nomor_peserta ?? obj.nomorPeserta ?? obj.no_peserta ?? ''
          ),
          jenisKelamin: String(obj.jenis_kelamin ?? obj.jenisKelamin ?? obj.jk ?? 'L'),
          sekolah: String(obj.sekolah ?? defaultBulkSekolah),
        }));
      } else {
        const lines = source
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length === 0) {
          throw new Error('Tidak ada baris data yang ditemukan.');
        }

        // Detect delimiter: tab, semicolon, or comma
        const firstLine = lines[0];
        const delimiter = firstLine.includes('\t')
          ? '\t'
          : firstLine.includes(';') && !firstLine.includes(',')
          ? ';'
          : ',';

        const firstCols = splitCsvLine(firstLine, delimiter).map((c) =>
          c.replace(/^"|"$/g, '').trim().toLowerCase()
        );

        const hasHeader =
          firstCols.includes('username') ||
          firstCols.includes('nisn') ||
          firstCols.includes('name') ||
          firstCols.includes('nama') ||
          firstCols.includes('password');

        const dataLines = hasHeader ? lines.slice(1) : lines;

        // Map column indexes dynamically if header exists
        const idxMap = {
          username: 0,
          password: 1,
          name: 2,
          role: -1,
          kelas: 3,
          nomorPeserta: 4,
          jenisKelamin: 5,
          sekolah: 6,
        };

        if (hasHeader) {
          firstCols.forEach((col, i) => {
            if (['username', 'nisn', 'user'].includes(col)) idxMap.username = i;
            else if (['password', 'pass', 'kata_sandi', 'sandi'].includes(col))
              idxMap.password = i;
            else if (['name', 'nama', 'nama_lengkap', 'nama siswa'].includes(col))
              idxMap.name = i;
            else if (['role', 'peran'].includes(col)) idxMap.role = i;
            else if (['kelas', 'rombel', 'nama_kelas'].includes(col)) idxMap.kelas = i;
            else if (
              ['nomor_peserta', 'nomorpeserta', 'no_peserta', 'nopeserta'].includes(col)
            )
              idxMap.nomorPeserta = i;
            else if (['jenis_kelamin', 'jeniskelamin', 'jk', 'gender', 'l/p'].includes(col))
              idxMap.jenisKelamin = i;
            else if (['sekolah', 'asal_sekolah', 'instansi'].includes(col))
              idxMap.sekolah = i;
          });
        }

        rawExtracted = dataLines.map((line) => {
          const cols = splitCsvLine(line, delimiter).map((c) =>
            c.replace(/^"|"$/g, '').trim()
          );
          return {
            username: cols[idxMap.username] ?? '',
            password: cols[idxMap.password] ?? '',
            name: cols[idxMap.name] ?? '',
            kelas: cols[idxMap.kelas] || defaultBulkKelas,
            nomorPeserta: cols[idxMap.nomorPeserta] ?? '',
            jenisKelamin: cols[idxMap.jenisKelamin] || 'L',
            sekolah: cols[idxMap.sekolah] || defaultBulkSekolah,
          };
        });
      }

      const validated = validateRows(rawExtracted);
      setParsedRows(validated);
      setHasCheckedData(true);
      setUploadReport(null);

      const validCount = validated.filter((r) => r.isValid).length;
      const invalidCount = validated.length - validCount;

      if (invalidCount === 0) {
        showToast(
          'Pengecekan Data Selesai (100% Valid)',
          `Seluruh ${validCount} baris data siswa lolos validasi dan siap diimpor.`,
          'success'
        );
      } else {
        showToast(
          'Hasil Pengecekan Data Ditemukan Masalah',
          `${validCount} baris valid, ${invalidCount} baris bermasalah/duplikat. Periksa tabel pratinjau di bawah.`,
          'warning'
        );
      }
    } catch (err) {
      showToast(
        'Gagal Memproses Template',
        err instanceof Error ? err.message : 'Pastikan format CSV/JSON sesuai template.',
        'error'
      );
    }
  };

  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const isJson = file.name.toLowerCase().endsWith('.json');
    if (isJson) setBulkTab('json');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result ?? '');
      setRawBulkText(content);
      handleParseAndValidateInput(content, isJson ? 'json' : 'csv');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpdatePreviewCell = (
    rowIndex: number,
    field: keyof Pick<
      ParsedStudentRow,
      'username' | 'password' | 'name' | 'kelas' | 'nomorPeserta' | 'jenisKelamin' | 'sekolah'
    >,
    value: string
  ) => {
    const updatedRaw = parsedRows.map((row) => {
      if (row.rowIndex !== rowIndex) return row;
      return { ...row, [field]: value };
    });
    const revalidated = validateRows(updatedRaw);
    setParsedRows(revalidated);
  };

  const handleRemovePreviewRow = (rowIndex: number) => {
    const remaining = parsedRows.filter((r) => r.rowIndex !== rowIndex);
    setParsedRows(validateRows(remaining));
  };

  const handleExecuteBulkUpload = () => {
    if (!hasCheckedData || parsedRows.length === 0) {
      showToast(
        'Lakukan Pengecekan Terlebih Dahulu',
        'Klik tombol "Cek & Validasi Data" sebelum menyimpan data siswa.',
        'warning'
      );
      return;
    }

    const validRows = parsedRows.filter((r) => r.isValid);
    const preFailedRows = parsedRows.filter((r) => !r.isValid);

    if (!skipInvalidRows && preFailedRows.length > 0) {
      showToast(
        'Masih Ada Baris Gagal Pengecekan',
        'Perbaiki baris yang merah atau aktifkan opsi "Tetap proses baris yang valid".',
        'error'
      );
      return;
    }

    const payload = validRows.map((r) => ({
      username: r.username,
      password: r.password,
      name: r.name,
      role: 'siswa' as const,
      kelas: r.kelas,
      nomorPeserta: r.nomorPeserta,
      jenisKelamin: r.jenisKelamin,
      sekolah: r.sekolah,
    }));

    const result = bulkAddUsers(payload);

    // Combine pre-validation failures + any runtime failures into a unified report
    const combinedFailed: BulkUploadResultReport['failed'] = [
      ...preFailedRows.map((r) => ({
        rowNumber: r.rowIndex,
        username: r.username || '(Kosong)',
        name: r.name || '(Kosong)',
        kelas: r.kelas || '-',
        nomorPeserta: r.nomorPeserta || '-',
        reason: r.errors.join('; '),
      })),
      ...result.failed.map((f, i) => ({
        rowNumber: validRows[i]?.rowIndex || i + 1,
        username: f.item.username || '(Kosong)',
        name: f.item.name || '(Kosong)',
        kelas: f.item.kelas || '-',
        nomorPeserta: f.item.nomorPeserta || '-',
        reason: f.reason,
      })),
    ];

    const report: BulkUploadResultReport = {
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      totalProcessed: parsedRows.length,
      succeeded: result.created,
      failed: combinedFailed,
    };

    setUploadReport(report);

    if (report.succeeded.length > 0 && report.failed.length === 0) {
      showToast(
        `Bulk Upload Selesai: ${report.succeeded.length} Siswa Berhasil Dibuat`,
        'Seluruh data siswa telah tersimpan ke database tanpa ada data yang gagal.',
        'success'
      );
    } else if (report.succeeded.length > 0 && report.failed.length > 0) {
      showToast(
        `Bulk Upload Selesai: ${report.succeeded.length} Berhasil, ${report.failed.length} Gagal`,
        `Sebanyak ${report.succeeded.length} siswa dibuat dan ${report.failed.length} baris dilewati karena tidak lolos validasi.`,
        'warning'
      );
    } else {
      showToast(
        `Bulk Upload Gagal: 0 Berhasil, ${report.failed.length} Gagal Dibuat`,
        'Tidak ada data siswa yang dapat disimpan. Periksa detail alasan gagal pada laporan.',
        'error'
      );
    }
  };

  const validPreviewCount = parsedRows.filter((r) => r.isValid).length;
  const invalidPreviewCount = parsedRows.length - validPreviewCount;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Manajemen Data Siswa (Peserta CBT)
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Database className="w-3 h-3" />
              Struktur: public.students (+ kolom password)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola akun peserta ujian dengan nomor urut otomatis, kolom password siswa, bulk upload dengan pengecekan validasi, serta hapus massal (bulk delete).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSchemaInfo((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
              showSchemaInfo
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span>Struktur Kolom Siswa</span>
          </button>
          <button
            type="button"
            onClick={exportStudentsCSV}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadReport(null);
              setShowBulkUploadModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Bulk Upload Siswa (Template)</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Collapsible Schema Comparison Card (Mirip public.users + kolom password) */}
      {showSchemaInfo && (
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Struktur Tabel Siswa (public.students) — Identik dengan public.users + Kolom Password
              </h3>
            </div>
            <button
              onClick={() => setShowSchemaInfo(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2 text-[11px]">
            {[
              { col: 'id', type: 'TEXT PK', desc: 'ID Unik Siswa' },
              { col: 'username', type: 'TEXT UNIQUE', desc: 'NISN / Username' },
              { col: 'password', type: 'TEXT NOT NULL', desc: 'Password CBT Siswa', highlight: true },
              { col: 'name', type: 'TEXT NOT NULL', desc: 'Nama Lengkap' },
              { col: 'role', type: "TEXT ('siswa')", desc: 'Peran Peserta' },
              { col: 'kelas', type: 'TEXT NOT NULL', desc: 'Rombel Kelas' },
              { col: 'nomor_peserta', type: 'TEXT UNIQUE', desc: 'No. Peserta Ujian' },
              { col: 'jenis_kelamin', type: "TEXT ('L'|'P')", desc: 'Gender Siswa' },
              { col: 'sekolah', type: 'TEXT NOT NULL', desc: 'Instansi Sekolah' },
            ].map((item) => (
              <div
                key={item.col}
                className={`p-2.5 rounded-xl border ${
                  item.highlight
                    ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                    : 'bg-slate-800/90 border-slate-700 text-slate-300'
                }`}
              >
                <p className="font-mono font-bold text-xs">{item.col}</p>
                <p className="font-mono text-[10px] opacity-80 mt-0.5">{item.type}</p>
                <p className="text-[10px] opacity-70 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Persistent Bulk Upload Result Notification Banner (if a bulk upload was recently executed) */}
      {uploadReport && !showBulkUploadModal && (
        <div
          className={`rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            uploadReport.failed.length === 0
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              : uploadReport.succeeded.length > 0
              ? 'bg-amber-50/90 border-amber-200 text-amber-950'
              : 'bg-rose-50/90 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-3">
            {uploadReport.failed.length === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-sm font-bold">
                Notifikasi Hasil Bulk Upload Siswa ({uploadReport.timestamp})
              </h4>
              <p className="text-xs mt-0.5">
                Total Diproses: <strong>{uploadReport.totalProcessed} baris</strong> •{' '}
                <span className="text-emerald-700 font-bold">
                  Berhasil Dibuat: {uploadReport.succeeded.length} siswa
                </span>{' '}
                •{' '}
                <span className="text-rose-700 font-bold">
                  Gagal Dibuat: {uploadReport.failed.length} baris
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkUploadModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Lihat Rincian Laporan
            </button>
            <button
              onClick={() => setUploadReport(null)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-black/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total Siswa Terdaftar</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {studentStats.total}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Tersebar di {classOptions.length} kelas
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Siswa Laki-Laki (L)</p>
          <p className="text-2xl font-extrabold text-sky-600 mt-1 tabular-nums">
            {studentStats.male}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {studentStats.total > 0
              ? Math.round((studentStats.male / studentStats.total) * 100)
              : 0}
            % dari populasi
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Siswa Perempuan (P)</p>
          <p className="text-2xl font-extrabold text-pink-600 mt-1 tabular-nums">
            {studentStats.female}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {studentStats.total > 0
              ? Math.round((studentStats.female / studentStats.total) * 100)
              : 0}
            % dari populasi
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Partisipasi Sesi CBT</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">
            {studentStats.participated}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Siswa telah/sedang ujian</p>
        </div>
      </div>

      {/* Filter, Search & Bulk Delete Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa, NISN / username, password, atau nomor peserta..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full lg:w-auto px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">Semua Kelas ({students.length})</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl w-full lg:w-auto">
              {(['ALL', 'L', 'P'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenderFilter(g)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                    genderFilter === g
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {g === 'ALL' ? 'Semua' : g === 'L' ? 'Laki-Laki' : 'Perempuan'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAllPasswords((prev) => !prev)}
              className={`sm:col-span-2 lg:col-span-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                showAllPasswords
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {showAllPasswords ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                  <span>Sembunyikan Password</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>Tampilkan Semua Password</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Contextual Bulk Delete Bar when rows are selected */}
        {selectedIds.length > 0 && (
          <div className="bg-rose-50/90 border border-rose-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-rose-600 text-white text-xs font-bold tabular-nums">
                {selectedIds.length}
              </span>
              <span className="text-xs font-semibold text-rose-950">
                Data siswa dipilih siap untuk tindakan massal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-100/60 transition-colors cursor-pointer"
              >
                Batal Pilih
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Terpilih ({selectedIds.length} Siswa)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Students Table with Auto-Increment No., Password Column, and Bulk Checkboxes */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAllFiltered}
                    className="inline-flex items-center justify-center text-slate-500 hover:text-indigo-600 cursor-pointer"
                    title="Pilih Semua Siswa pada Tampilan Ini"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-3 w-14 text-center">No.</th>
                <th className="py-3.5 px-4">Nama Lengkap Siswa</th>
                <th className="py-3.5 px-4">Username / NISN</th>
                <th className="py-3.5 px-4">Password Siswa</th>
                <th className="py-3.5 px-4">Nomor Peserta</th>
                <th className="py-3.5 px-4">Kelas</th>
                <th className="py-3.5 px-3 text-center">L/P</th>
                <th className="py-3.5 px-4">Status Sesi</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-sm">
              {filteredStudents.map((student, idx) => {
                const autoNumber = idx + 1;
                const isSelected = selectedIds.includes(student.id);
                const isPassVisible = showAllPasswords || Boolean(revealedPasswordIds[student.id]);
                const studentPass =
                  student.password || generateStudentPassword(student.nomorPeserta);
                const studentSessions = sessions.filter((s) => s.studentId === student.id);
                const activeSession = studentSessions.find((s) => s.status === 'in_progress');
                const completedCount = studentSessions.filter(
                  (s) => s.status === 'completed' || s.status === 'timed_out'
                ).length;

                return (
                  <tr
                    key={student.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-indigo-50/60 hover:bg-indigo-50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Bulk Select Checkbox */}
                    <td className="py-3.5 pl-4 pr-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(student.id)}
                        className="inline-flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* Auto-Increment Number */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold tabular-nums">
                        {autoNumber}
                      </span>
                    </td>

                    {/* Student Name & School */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-xs">{student.name}</p>
                          <p className="text-[11px] text-slate-400">{student.sekolah}</p>
                        </div>
                      </div>
                    </td>

                    {/* Username / NISN */}
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-700">
                      {student.username}
                    </td>

                    {/* Password Column */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/80 rounded-lg px-2.5 py-1">
                        <KeyRound className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="font-mono text-xs font-semibold text-slate-800 tracking-wide">
                          {isPassVisible ? studentPass : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleRowPassword(student.id)}
                          className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                          title={isPassVisible ? 'Sembunyikan Password' : 'Lihat Password'}
                        >
                          {isPassVisible ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyCredentials(student)}
                          className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                          title="Salin NISN & Password Siswa"
                        >
                          {copiedId === student.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Nomor Peserta */}
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {student.nomorPeserta}
                    </td>

                    {/* Kelas */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                        {student.kelas}
                      </span>
                    </td>

                    {/* Jenis Kelamin */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          student.jenisKelamin === 'L'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-pink-50 text-pink-700'
                        }`}
                      >
                        {student.jenisKelamin}
                      </span>
                    </td>

                    {/* Status Sesi */}
                    <td className="py-3.5 px-4">
                      {activeSession ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Sedang Ujian
                          </span>
                          <button
                            onClick={() => resetStudentSession(activeSession.id)}
                            title="Reset Sesi Aktif"
                            className="p-1 rounded-md text-amber-600 hover:bg-amber-50 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : completedCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                          {completedCount} Ujian Selesai
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Belum Ujian</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Edit Data & Password Siswa"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setStudentToDelete(student)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus Siswa & Nilai"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      Tidak ada data siswa yang cocok
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ubah kata kunci pencarian, filter kelas, atau tambahkan siswa baru / bulk upload.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="bg-slate-50/80 border-t border-slate-200/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Menampilkan <strong>{filteredStudents.length}</strong> dari total{' '}
            <strong>{students.length}</strong> siswa terdaftar (Nomor urut otomatis 1 s/d{' '}
            {filteredStudents.length}).
          </div>
          {selectedIds.length > 0 && (
            <div className="font-semibold text-indigo-700">
              {selectedIds.length} baris dipilih
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================== */}
      {/* MODAL 1: TAMBAH / EDIT SISWA TUNGGAL (DENGAN KOLOM PASSWORD)              */}
      {/* ========================================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {editingStudent ? 'Edit Identitas & Password Siswa' : 'Registrasi Peserta Siswa Baru'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Struktur tabel <code className="font-mono">public.students</code> (identik{' '}
                  <code className="font-mono">public.users</code> + kolom{' '}
                  <code className="font-mono">password</code>)
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Lengkap Siswa (<code className="font-mono lowercase">name</code>)
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Aditya Pratama Wijaya"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    NISN / Username (<code className="font-mono lowercase">username</code>)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="Contoh: 0081234501"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Nomor Peserta (Opsional)
                    </label>
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setNomorPesertaMode('auto');
                          setForm((prev) => ({
                            ...prev,
                            nomorPeserta: generateNextStudentNomorPeserta(0),
                          }));
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                          nomorPesertaMode === 'auto'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Auto-Increment
                      </button>
                      <button
                        type="button"
                        onClick={() => setNomorPesertaMode('manual')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                          nomorPesertaMode === 'manual'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    readOnly={nomorPesertaMode === 'auto'}
                    value={form.nomorPeserta}
                    onChange={(e) => setForm({ ...form, nomorPeserta: e.target.value })}
                    placeholder="Kosongkan untuk Auto-Increment otomatis"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono focus:outline-none ${
                      nomorPesertaMode === 'auto'
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 font-bold'
                        : 'bg-white border-slate-300 focus:border-indigo-600'
                    }`}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {nomorPesertaMode === 'auto'
                      ? 'Diisi otomatis berurutan sesuai prefix pengaturan aplikasi.'
                      : 'Ketik manual atau kosongkan untuk diisi otomatis saat disimpan.'}
                  </p>
                </div>
              </div>

              {/* Password Field for Student */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-amber-950 uppercase tracking-wider">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Password Login Siswa (<code className="font-mono lowercase">password</code>)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        password: generateStudentPassword(prev.nomorPeserta),
                      }))
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Generate Otomatis
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showModalPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Masukkan password kartu ujian siswa"
                    className="w-full pl-3.5 pr-10 py-2 rounded-lg border border-amber-300 bg-white text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showModalPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-amber-800 mt-1">
                  Password ini disimpan pada kolom <code className="font-mono">password</code> tabel siswa untuk keperluan cetak kartu peserta & login CBT.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kelas / Rombel (<code className="font-mono lowercase">kelas</code>)
                  </label>
                  <select
                    value={form.kelas}
                    onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-indigo-600"
                  >
                    {classOptions.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jenis Kelamin (<code className="font-mono lowercase">jenis_kelamin</code>)
                  </label>
                  <select
                    value={form.jenisKelamin}
                    onChange={(e) =>
                      setForm({ ...form, jenisKelamin: e.target.value as 'L' | 'P' })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-indigo-600"
                  >
                    <option value="L">Laki-Laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Asal Sekolah / Instansi (<code className="font-mono lowercase">sekolah</code>)
                </label>
                <input
                  type="text"
                  required
                  value={form.sekolah}
                  onChange={(e) => setForm({ ...form, sekolah: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs cursor-pointer text-center"
                >
                  {editingStudent ? 'Simpan Perubahan' : 'Daftarkan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================== */}
      {/* MODAL: KONFIRMASI DELETE SISWA TUNGGAL                                     */}
      {/* ========================================================================== */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Data Siswa & Seluruh Nilainya?
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin menghapus siswa <strong>{studentToDelete.name}</strong> (NISN: {studentToDelete.username})?
                </p>
                <div className="mt-3.5 p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>PENTING (Koneksi Cascade):</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed font-semibold">
                    Menghapus akun siswa ini akan <strong>menghapus secara permanen</strong> seluruh riwayat sesi ujian, lembar jawaban, dan data nilai (*nilai*) mereka dari database Supabase secara otomatis (*on delete cascade*).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentToDelete(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteUserAccount(studentToDelete.id);
                    showToast(
                      'Siswa & Nilai Berhasil Dihapus',
                      `Akun ${studentToDelete.name} beserta seluruh riwayat nilainya telah dibersihkan dari database.`,
                      'info'
                    );
                    setStudentToDelete(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Ya, Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================== */}
      {/* MODAL 2: KONFIRMASI BULK DELETE SISWA                                      */}
      {/* ========================================================================== */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Massal {selectedStudentsList.length} Data Siswa?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tindakan ini akan menghapus <strong>{selectedStudentsList.length} akun siswa</strong> yang dipilih.
                </p>
                <div className="mt-3.5 p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>PERINGATAN INTEGRITAS DATA:</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed font-semibold">
                    Seluruh riwayat sesi ujian, lembar jawaban, dan data nilai (*nilai*) siswa terpilih akan <strong>dihapus secara permanen</strong> dari database Supabase secara otomatis (*on delete cascade*).
                  </p>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-1.5">
                {selectedStudentsList.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-xs text-slate-700"
                  >
                    <span className="font-semibold truncate">
                      {i + 1}. {s.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {s.username} • {s.kelas}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Ya, Hapus {selectedStudentsList.length} Siswa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================== */}
      {/* MODAL 3: BULK UPLOAD DATA SISWA DENGAN TEMPLATE & PENGECEKAN DATA          */}
      {/* ========================================================================== */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-6xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Bulk Upload Data Siswa Menggunakan Template
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap file/data yang diunggah akan melalui <strong>Pengecekan Validasi Data</strong> terlebih dahulu sebelum disimpan ke database.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadTemplateCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Unduh Template .CSV
                </button>
                <button
                  type="button"
                  onClick={downloadTemplateJSON}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-semibold cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  Unduh Template .JSON
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkUploadModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* NOTIFICATION REPORT OF SUCCEEDED AND FAILED ROWS */}
              {uploadReport && (
                <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-200/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Laporan Notifikasi Hasil Bulk Upload Data Siswa ({uploadReport.timestamp})
                        </h4>
                        <p className="text-xs text-slate-600">
                          Rincian data siswa yang <strong>Berhasil Dibuat</strong> dan <strong>Gagal Dibuat</strong>.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Berhasil: {uploadReport.succeeded.length} Siswa
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300">
                        Gagal: {uploadReport.failed.length} Baris
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Succeeded List */}
                    <div className="bg-white rounded-xl border border-emerald-200 p-3.5 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Data Siswa Berhasil Dibuat ({uploadReport.succeeded.length})
                      </div>
                      {uploadReport.succeeded.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          Tidak ada data baru yang berhasil dibuat.
                        </p>
                      ) : (
                        <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 text-xs">
                          {uploadReport.succeeded.map((s, idx) => (
                            <div
                              key={s.id}
                              className="py-1.5 flex items-center justify-between gap-2"
                            >
                              <span className="font-semibold text-slate-800 truncate">
                                {idx + 1}. {s.name}{' '}
                                <span className="text-slate-400 font-normal">({s.kelas})</span>
                              </span>
                              <span className="font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                {s.username} | Pass: {s.password}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Failed List */}
                    <div className="bg-white rounded-xl border border-rose-200 p-3.5 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        Data Siswa Gagal Dibuat ({uploadReport.failed.length})
                      </div>
                      {uploadReport.failed.length === 0 ? (
                        <p className="text-xs text-emerald-700 font-medium py-2">
                          0 data gagal — Seluruh baris berhasil dibuat!
                        </p>
                      ) : (
                        <div className="max-h-44 overflow-y-auto divide-y divide-rose-100 text-xs">
                          {uploadReport.failed.map((f, idx) => (
                            <div key={idx} className="py-1.5 space-y-0.5">
                              <div className="flex items-center justify-between font-semibold text-slate-800">
                                <span>
                                  Baris #{f.rowNumber}: {f.name} ({f.username})
                                </span>
                                <span className="text-[11px] text-slate-500">{f.kelas}</span>
                              </div>
                              <p className="text-[11px] text-rose-600 font-medium">
                                Alasan Gagal: {f.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Method Tabs & Default Metadata */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      {
                        id: 'csv' as const,
                        label: '1. Upload File Template (.CSV)',
                        icon: FileSpreadsheet,
                      },
                      {
                        id: 'paste' as const,
                        label: '2. Copy-Paste dari Excel / Spreadsheet',
                        icon: ClipboardPaste,
                      },
                      {
                        id: 'json' as const,
                        label: '3. Format JSON (.JSON)',
                        icon: FileCode,
                      },
                    ].map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setBulkTab(t.id)}
                          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            bulkTab === t.id
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {bulkTab === 'csv' && (
                    <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-5 text-center bg-slate-50/70 transition-colors">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt,.json"
                        onChange={handleFileUploadChange}
                        className="hidden"
                      />
                      <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-800">
                        {uploadedFileName
                          ? `File Terpilih: ${uploadedFileName}`
                          : 'Pilih File Template CSV / Excel (.csv)'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Kolom template:{' '}
                        <code className="font-mono bg-white px-1.5 py-0.5 rounded border">
                          username, password, name, role, kelas, nomor_peserta, jenis_kelamin, sekolah
                        </code>
                      </p>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs cursor-pointer"
                        >
                          Pilih File dari Komputer
                        </button>
                        <button
                          type="button"
                          onClick={downloadTemplateCSV}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs cursor-pointer"
                        >
                          Unduh Contoh Template
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        {bulkTab === 'json'
                          ? 'Data JSON Siswa (Array of Objects)'
                          : 'Data Teks CSV / TSV (Dapat Diedit Langsung Sebelum Validasi)'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleClass = classOptions[0] || 'XII MIPA 1';
                          const b = students.length + 1;
                          const s1 = String(b).padStart(3, '0');
                          const s2 = String(b + 1).padStart(3, '0');
                          const sample = `username,password,name,role,kelas,nomor_peserta,jenis_kelamin,sekolah\n0089123${s1},CBT-${s1}*,Bagas Pratama Putra,siswa,${sampleClass},26-01-0104-${s1},L,SMA Negeri 1 Nusantara Jakarta\n0089123${s2},CBT-${s2}*,Nabila Azzahra Putri,siswa,${sampleClass},26-01-0104-${s2},P,SMA Negeri 1 Nusantara Jakarta`;
                          setRawBulkText(sample);
                          handleParseAndValidateInput(sample, 'csv');
                        }}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        Isi Contoh Data Uji Validasi
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={rawBulkText}
                      onChange={(e) => {
                        setRawBulkText(e.target.value);
                        setHasCheckedData(false);
                      }}
                      placeholder={
                        bulkTab === 'json'
                          ? '[\n  {"username": "0089123010", "password": "CBT-010*", "name": "Nama Siswa", "kelas": "XII MIPA 1", "nomor_peserta": "26-01-0104-010", "jenis_kelamin": "L"}\n]'
                          : 'username,password,name,role,kelas,nomor_peserta,jenis_kelamin,sekolah\n0089123010,CBT-010*,Bagas Pratama Putra,siswa,XII MIPA 1,26-01-0104-010,L,SMA Negeri 1 Nusantara Jakarta'
                      }
                      className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* Default Values & Pre-Check Trigger Box */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Pengaturan Default & Pengecekan Data
                    </h4>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Kelas Default (Jika kolom kelas di file kosong)
                      </label>
                      <select
                        value={defaultBulkKelas}
                        onChange={(e) => setDefaultBulkKelas(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                      >
                        {classOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nama Sekolah Default
                      </label>
                      <input
                        type="text"
                        value={defaultBulkSekolah}
                        onChange={(e) => setDefaultBulkSekolah(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <label className="flex items-start gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipInvalidRows}
                        onChange={(e) => setSkipInvalidRows(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600"
                      />
                      <span className="text-[11px] text-slate-600 leading-relaxed">
                        Tetap simpan baris yang <strong>Valid</strong> dan laporkan baris yang <strong>Gagal</strong> pada notifikasi akhir.
                      </span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleParseAndValidateInput()}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    1. Cek & Validasi Data Terlebih Dahulu
                  </button>
                </div>
              </div>

              {/* Step 2: Interactive Validation Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/90 px-4 py-3 rounded-xl border border-slate-200">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold text-slate-800">
                        Hasil Pengecekan Pra-Upload:
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700">
                        Total Diperiksa: {parsedRows.length}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Lolos Validasi: {validPreviewCount}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          invalidPreviewCount > 0
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Gagal / Bermasalah: {invalidPreviewCount}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Tips: Anda dapat memperbaiki langsung sel yang merah pada tabel di bawah ini, validasi akan otomatis diperbarui.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                            <th className="py-2.5 px-3 text-center w-12">No.</th>
                            <th className="py-2.5 px-3">Status Pengecekan</th>
                            <th className="py-2.5 px-3">Username / NISN</th>
                            <th className="py-2.5 px-3">Password Siswa</th>
                            <th className="py-2.5 px-3">Nama Lengkap</th>
                            <th className="py-2.5 px-3">Kelas</th>
                            <th className="py-2.5 px-3">Nomor Peserta</th>
                            <th className="py-2.5 px-2 text-center">L/P</th>
                            <th className="py-2.5 px-2 text-center">Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {parsedRows.map((row) => (
                            <tr
                              key={row.rowIndex}
                              className={
                                row.isValid ? 'bg-white hover:bg-slate-50' : 'bg-rose-50/70'
                              }
                            >
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">
                                {row.rowIndex}
                              </td>
                              <td className="py-2 px-3">
                                {row.isValid ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Valid (Siap Dibuat)
                                    </span>
                                    {row.warnings.map((w, wi) => (
                                      <p key={wi} className="text-[10px] text-amber-700">
                                        Catatan: {w}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                                      <AlertCircle className="w-3 h-3" />
                                      Gagal Validasi
                                    </span>
                                    {row.errors.map((err, ei) => (
                                      <p
                                        key={ei}
                                        className="text-[10px] text-rose-700 font-semibold"
                                      >
                                        • {err}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.username}
                                  onChange={(e) =>
                                    handleUpdatePreviewCell(
                                      row.rowIndex,
                                      'username',
                                      e.target.value
                                    )
                                  }
                                  className="w-28 px-2 py-1 rounded border border-slate-300 font-mono text-xs bg-white"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.password}
                                  onChange={(e) =>
                                    handleUpdatePreviewCell(
                                      row.rowIndex,
                                      'password',
                                      e.target.value
                                    )
                                  }
                                  className="w-28 px-2 py-1 rounded border border-amber-300 font-mono text-xs bg-amber-50/40 font-semibold"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={(e) =>
                                    handleUpdatePreviewCell(row.rowIndex, 'name', e.target.value)
                                  }
                                  className="w-44 px-2 py-1 rounded border border-slate-300 text-xs bg-white"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.kelas}
                                  onChange={(e) =>
                                    handleUpdatePreviewCell(row.rowIndex, 'kelas', e.target.value)
                                  }
                                  className="w-28 px-2 py-1 rounded border border-slate-300 text-xs bg-white"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.nomorPeserta}
                                  onChange={(e) =>
                                    handleUpdatePreviewCell(
                                      row.rowIndex,
                                      'nomorPeserta',
                                      e.target.value
                                    )
                                  }
                                  className="w-32 px-2 py-1 rounded border border-slate-300 font-mono text-xs bg-white"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <select
                                  value={row.jenisKelamin}
                                  onChange={(e) =>
                                    handleUpdatePreviewCell(
                                      row.rowIndex,
                                      'jenisKelamin',
                                      e.target.value
                                    )
                                  }
                                  className="px-1.5 py-1 rounded border border-slate-300 text-xs bg-white"
                                >
                                  <option value="L">L</option>
                                  <option value="P">P</option>
                                </select>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePreviewRow(row.rowIndex)}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Hapus baris dari antrean"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-600">
                {hasCheckedData ? (
                  <span>
                    Status Pengecekan: <strong className="text-emerald-700">{validPreviewCount} siap dibuat</strong>,{' '}
                    <strong className="text-rose-700">{invalidPreviewCount} gagal validasi</strong>.
                  </span>
                ) : (
                  <span>Klik <strong>"1. Cek & Validasi Data Terlebih Dahulu"</strong> sebelum menyimpan.</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBulkUploadModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={!hasCheckedData || parsedRows.length === 0}
                  onClick={handleExecuteBulkUpload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  2. Proses & Buat Data Siswa ({validPreviewCount} Valid)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
