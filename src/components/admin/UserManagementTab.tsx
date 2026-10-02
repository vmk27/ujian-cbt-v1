import React, { useMemo, useRef, useState } from 'react';
import {
  Shield,
  Plus,
  Search,
  Edit3,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  BookOpen,
  MonitorCheck,
  Database,
  X,
  CheckSquare,
  Square,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { UserAccount } from '../../types/cbt';

type StaffRole = 'admin' | 'guru' | 'proktor';

interface ParsedStaffRow {
  rowIndex: number;
  username: string;
  password: string;
  name: string;
  role: StaffRole;
  kelas: string; // Jabatan / Mapel / Ruang Proktor
  nomorPeserta: string; // NIP / Kode Petugas
  jenisKelamin: 'L' | 'P';
  sekolah: string;
  isValid: boolean;
  errors: string[];
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

function generateStaffPassword(role: StaffRole, nipOrIndex?: string): string {
  const prefix = role === 'admin' ? 'ADMIN' : role === 'guru' ? 'GURU' : 'PRK';
  const suffix = (nipOrIndex || '').replace(/[^0-9A-Za-z]/g, '').slice(-2);
  const rand = Math.floor(10 + Math.random() * 89);
  return `${prefix}-CBT#${suffix || rand}`;
}

export const UserManagementTab: React.FC = () => {
  const {
    appSettings,
    users,
    currentUser,
    addUserAccount,
    bulkAddUsers,
    updateUserAccount,
    deleteUserAccount,
    bulkDeleteUsers,
    showToast,
  } = useCBT();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | StaffRole>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Password visibility states
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add / Edit Staff Modal
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [showModalPassword, setShowModalPassword] = useState(true);
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'guru' as StaffRole,
    kelas: 'Guru Mata Pelajaran',
    nomorPeserta: '',
    jenisKelamin: 'L' as 'L' | 'P',
    sekolah: appSettings.schoolName || 'SMA Negeri 1 Nusantara Jakarta',
  });

  // Bulk Upload Staff Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [rawBulkText, setRawBulkText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedStaffRow[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [bulkReport, setBulkReport] = useState<{
    succeeded: UserAccount[];
    failed: Array<{ rowNumber: number; username: string; name: string; reason: string }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const staffUsers = useMemo(
    () =>
      users.filter(
        (u) => u.role === 'admin' || u.role === 'guru' || u.role === 'proktor'
      ),
    [users]
  );

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffUsers.filter((u) => {
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.password ?? '').toLowerCase().includes(q) ||
        u.nomorPeserta.toLowerCase().includes(q) ||
        u.kelas.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [staffUsers, roleFilter, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: staffUsers.length,
      admin: staffUsers.filter((u) => u.role === 'admin').length,
      guru: staffUsers.filter((u) => u.role === 'guru').length,
      proktor: staffUsers.filter((u) => u.role === 'proktor').length,
    };
  }, [staffUsers]);

  const allFilteredSelected =
    filteredStaff.length > 0 &&
    filteredStaff.every((u) => selectedIds.includes(u.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const set = new Set(filteredStaff.map((u) => u.id));
      setSelectedIds((prev) => prev.filter((id) => !set.has(id)));
    } else {
      const next = new Set(selectedIds);
      filteredStaff.forEach((u) => next.add(u.id));
      setSelectedIds(Array.from(next));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleRowPassword = (id: string) => {
    setRevealedPasswordIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyStaffCredentials = (user: UserAccount) => {
    const pass =
      user.password || generateStaffPassword(user.role as StaffRole, user.nomorPeserta);
    const text = `Username: ${user.username} | Password: ${pass} | Role: ${user.role.toUpperCase()} | NIP: ${user.nomorPeserta}`;
    navigator.clipboard.writeText(text);
    setCopiedId(user.id);
    showToast('Kredensial User Disalin', `${user.name} (${user.username})`, 'info');
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openAddModal = (presetRole: StaffRole = 'guru') => {
    setEditingUser(null);
    const count = staffUsers.filter((u) => u.role === presetRole).length + 1;
    const padded = String(count).padStart(2, '0');
    const roleDefaults: Record<
      StaffRole,
      { jabatan: string; nipPrefix: string; pass: string }
    > = {
      admin: {
        jabatan: 'Administrator Utama CBT',
        nipPrefix: `NIP-19800101-${padded}`,
        pass: `ADMIN-CBT#${padded}`,
      },
      guru: {
        jabatan: 'Guru Mata Pelajaran',
        nipPrefix: `NIP-19850615-${padded}`,
        pass: `GURU-CBT#${padded}`,
      },
      proktor: {
        jabatan: `Proktor Ruang Lab ${count}`,
        nipPrefix: `PRK-202601-${padded}`,
        pass: `PRK-LAB#${padded}`,
      },
    };
    setForm({
      username: '',
      password: roleDefaults[presetRole].pass,
      name: '',
      role: presetRole,
      kelas: roleDefaults[presetRole].jabatan,
      nomorPeserta: roleDefaults[presetRole].nipPrefix,
      jenisKelamin: 'L',
      sekolah: appSettings.schoolName || 'SMA Negeri 1 Nusantara Jakarta',
    });
    setShowModalPassword(true);
    setShowModal(true);
  };

  const openEditModal = (user: UserAccount) => {
    const role = (user.role === 'siswa' ? 'guru' : user.role) as StaffRole;
    setEditingUser(user);
    setForm({
      username: user.username,
      password: user.password || generateStaffPassword(role, user.nomorPeserta),
      name: user.name,
      role,
      kelas: user.kelas,
      nomorPeserta: user.nomorPeserta,
      jenisKelamin: user.jenisKelamin,
      sekolah: user.sekolah,
    });
    setShowModalPassword(true);
    setShowModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.name.trim() || !form.nomorPeserta.trim()) {
      showToast(
        'Data Belum Lengkap',
        'Username, Nama Lengkap, dan NIP / Kode Petugas wajib diisi.',
        'warning'
      );
      return;
    }
    if (!form.password.trim()) {
      showToast(
        'Password Wajib Diisi',
        'Kolom password user tidak boleh kosong.',
        'warning'
      );
      return;
    }

    if (editingUser) {
      updateUserAccount(editingUser.id, {
        username: form.username.trim(),
        password: form.password.trim(),
        name: form.name.trim(),
        role: form.role,
        kelas: form.kelas.trim(),
        nomorPeserta: form.nomorPeserta.trim(),
        jenisKelamin: form.jenisKelamin,
        sekolah: form.sekolah.trim() || appSettings.schoolName,
      });
      setShowModal(false);
    } else {
      const res = addUserAccount({
        username: form.username.trim(),
        password: form.password.trim(),
        name: form.name.trim(),
        role: form.role,
        kelas: form.kelas.trim(),
        nomorPeserta: form.nomorPeserta.trim(),
        jenisKelamin: form.jenisKelamin,
        sekolah: form.sekolah.trim() || appSettings.schoolName,
      });
      if (!res.ok) {
        showToast('Gagal Menambah User', res.message, 'error');
        return;
      }
      setShowModal(false);
    }
  };

  const exportUsersCSV = () => {
    const headers = [
      'no',
      'username',
      'password',
      'name',
      'role',
      'jabatan_unit',
      'nip_kode_petugas',
      'jenis_kelamin',
      'sekolah',
    ];
    const rows = filteredStaff.map((u, idx) => [
      idx + 1,
      `"${u.username}"`,
      `"${(u.password || '').replace(/"/g, '""')}"`,
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.role}"`,
      `"${u.kelas.replace(/"/g, '""')}"`,
      `"${u.nomorPeserta}"`,
      u.jenisKelamin,
      `"${u.sekolah.replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `manajemen_user_aparatur_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Ekspor Berhasil', 'Daftar akun Admin, Guru, dan Proktor beserta password diunduh.', 'success');
  };

  const downloadStaffTemplateCSV = () => {
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
    const sample = [
      [
        '"guru.kimia"',
        '"GURU-KIM#01"',
        '"Dr. Bambang Sudibyo, M.Si."',
        '"guru"',
        '"Guru Kimia & Penyusun Soal"',
        '"NIP-19820311-04"',
        '"L"',
        `"${appSettings.schoolName}"`,
      ],
      [
        '"proktor.lab3"',
        '"PRK-LAB#03"',
        '"Rina Kusumawardhani, S.Kom."',
        '"proktor"',
        '"Proktor Ruang Lab Komputer 3"',
        '"PRK-202604-03"',
        '"P"',
        `"${appSettings.schoolName}"`,
      ],
    ];
    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...sample.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', 'template_manajemen_user_cbt.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleValidateStaffBulk = (inputSource?: string) => {
    const text = (inputSource ?? rawBulkText).trim();
    if (!text) {
      showToast('Input Kosong', 'Masukkan atau pilih file CSV terlebih dahulu.', 'warning');
      return;
    }

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const delimiter = lines[0].includes('\t')
      ? '\t'
      : lines[0].includes(';') && !lines[0].includes(',')
      ? ';'
      : ',';

    const firstCols = splitCsvLine(lines[0], delimiter).map((c) =>
      c.replace(/^"|"$/g, '').toLowerCase()
    );
    const hasHeader =
      firstCols.includes('username') ||
      firstCols.includes('password') ||
      firstCols.includes('name') ||
      firstCols.includes('role');

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const existingUsernames = new Set(users.map((u) => u.username.toLowerCase()));
    const existingNip = new Set(users.map((u) => u.nomorPeserta.toLowerCase()).filter(Boolean));
    const batchUsernames = new Set<string>();

    const validated: ParsedStaffRow[] = dataLines.map((line, idx) => {
      const cols = splitCsvLine(line, delimiter).map((c) => c.replace(/^"|"$/g, '').trim());
      const username = cols[0] ?? '';
      const password = cols[1] ?? '';
      const name = cols[2] ?? '';
      const rawRole = (cols[3] ?? 'guru').toLowerCase();
      const role: StaffRole =
        rawRole === 'admin' || rawRole === 'proktor' || rawRole === 'guru'
          ? (rawRole as StaffRole)
          : 'guru';
      const kelas = cols[4] || (role === 'guru' ? 'Guru Mata Pelajaran' : 'Proktor Ruang CBT');
      const nomorPeserta = cols[5] ?? '';
      const jenisKelamin: 'L' | 'P' =
        (cols[6] ?? 'L').toUpperCase() === 'P' ? 'P' : 'L';
      const sekolah = cols[7] || appSettings.schoolName || 'SMA Negeri 1 Nusantara Jakarta';

      const errors: string[] = [];
      if (!username) errors.push('Username kosong');
      if (!password) errors.push('Password kosong');
      if (!name) errors.push('Nama lengkap kosong');
      if (!['admin', 'guru', 'proktor'].includes(rawRole)) {
        errors.push(`Role "${rawRole}" tidak valid (gunakan admin, guru, atau proktor)`);
      }
      if (!nomorPeserta) errors.push('NIP / Kode Petugas kosong');
      if (username && existingUsernames.has(username.toLowerCase())) {
        errors.push(`Username "${username}" sudah terdaftar`);
      }
      if (nomorPeserta && existingNip.has(nomorPeserta.toLowerCase())) {
        errors.push(`NIP / Kode "${nomorPeserta}" sudah terdaftar`);
      }
      if (username && batchUsernames.has(username.toLowerCase())) {
        errors.push(`Duplikat username "${username}" di dalam file`);
      }
      if (username) batchUsernames.add(username.toLowerCase());

      return {
        rowIndex: idx + 1,
        username,
        password,
        name,
        role,
        kelas,
        nomorPeserta,
        jenisKelamin,
        sekolah,
        isValid: errors.length === 0,
        errors,
      };
    });

    setParsedRows(validated);
    setHasChecked(true);
    setBulkReport(null);
  };

  const handleSaveBulkStaff = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    const invalidRows = parsedRows.filter((r) => !r.isValid);

    const res = bulkAddUsers(
      validRows.map((r) => ({
        username: r.username,
        password: r.password,
        name: r.name,
        role: r.role,
        kelas: r.kelas,
        nomorPeserta: r.nomorPeserta,
        jenisKelamin: r.jenisKelamin,
        sekolah: r.sekolah,
      }))
    );

    const failed = [
      ...invalidRows.map((r) => ({
        rowNumber: r.rowIndex,
        username: r.username || '-',
        name: r.name || '-',
        reason: r.errors.join('; '),
      })),
      ...res.failed.map((f, i) => ({
        rowNumber: validRows[i]?.rowIndex || i + 1,
        username: f.item.username,
        name: f.item.name,
        reason: f.reason,
      })),
    ];

    setBulkReport({ succeeded: res.created, failed });
    showToast(
      `Impor User Selesai: ${res.created.length} Berhasil, ${failed.length} Gagal`,
      'Periksa ringkasan hasil pembuatan akun petugas.',
      failed.length === 0 ? 'success' : 'warning'
    );
  };

  const getRoleBadge = (role: UserAccount['role']) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Shield className="w-3.5 h-3.5" />
            ADMIN
          </span>
        );
      case 'guru':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <BookOpen className="w-3.5 h-3.5" />
            GURU
          </span>
        );
      case 'proktor':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <MonitorCheck className="w-3.5 h-3.5" />
            PROKTOR
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Manajemen User (Admin, Guru & Proktor)
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Database className="w-3 h-3" />
              Tabel: public.users (+ Kolom Password)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola akun dan password login untuk aparatur penyelenggara ujian:{' '}
            <strong>Administrator Utama</strong>, <strong>Guru / Penyusun Bank Soal</strong>, dan{' '}
            <strong>Proktor Ruang Ujian</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportUsersCSV}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkReport(null);
              setShowBulkModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Bulk Upload User</span>
          </button>
          <button
            type="button"
            onClick={() => openAddModal('guru')}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Tambah User Baru</span>
          </button>
        </div>
      </div>

      {/* Role KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total User Aparatur</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {stats.total}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Admin, Guru & Proktor aktif</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Administrator (Admin)</p>
            <Shield className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-600 mt-1 tabular-nums">
            {stats.admin}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Otoritas penuh sistem & DB</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Guru / Penyusun Soal</p>
            <BookOpen className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">
            {stats.guru}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Manajemen Bank Soal & Nilai</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Proktor Ruang Ujian</p>
            <MonitorCheck className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">
            {stats.proktor}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Pengawas sesi & token ruang</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama user, username, password, NIP / kode petugas, atau jabatan..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {(
                [
                  { id: 'ALL', label: `Semua (${stats.total})` },
                  { id: 'admin', label: `Admin (${stats.admin})` },
                  { id: 'guru', label: `Guru (${stats.guru})` },
                  { id: 'proktor', label: `Proktor (${stats.proktor})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                    roleFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAllPasswords((prev) => !prev)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
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

        {/* Bulk Delete Action Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-rose-50/90 border border-rose-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-rose-600 text-white text-xs font-bold tabular-nums">
                {selectedIds.length}
              </span>
              <span className="text-xs font-semibold text-rose-950">
                User aparatur dipilih untuk dihapus massal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-100/60 cursor-pointer"
              >
                Batal Pilih
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus User Terpilih ({selectedIds.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Staff Users Table with Auto-Increment No. & Password Column */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="inline-flex items-center justify-center text-slate-500 hover:text-indigo-600 cursor-pointer"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-3 w-14 text-center">No.</th>
                <th className="py-3.5 px-4">Nama Lengkap Petugas</th>
                <th className="py-3.5 px-4">Role / Hak Akses</th>
                <th className="py-3.5 px-4">Username Login</th>
                <th className="py-3.5 px-4">Password User</th>
                <th className="py-3.5 px-4">NIP / Kode Kredensial</th>
                <th className="py-3.5 px-4">Jabatan / Bidang Tugas</th>
                <th className="py-3.5 px-3 text-center">L/P</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-sm">
              {filteredStaff.map((user, idx) => {
                const autoNumber = idx + 1;
                const isSelected = selectedIds.includes(user.id);
                const isCurrentActive = currentUser?.id === user.id;
                const isPassVisible =
                  showAllPasswords || Boolean(revealedPasswordIds[user.id]);
                const staffPass =
                  user.password ||
                  generateStaffPassword(user.role as StaffRole, user.nomorPeserta);

                return (
                  <tr
                    key={user.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-indigo-50/60 hover:bg-indigo-50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-3.5 pl-4 pr-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(user.id)}
                        className="inline-flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold tabular-nums">
                        {autoNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 text-xs">{user.name}</p>
                            {isCurrentActive && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Sedang Login
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">{user.sekolah}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{getRoleBadge(user.role)}</td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-800">
                      {user.username}
                    </td>

                    {/* Password User Column */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/80 rounded-lg px-2.5 py-1">
                        <KeyRound className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="font-mono text-xs font-semibold text-slate-800 tracking-wide">
                          {isPassVisible ? staffPass : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleRowPassword(user.id)}
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
                          onClick={() => handleCopyStaffCredentials(user)}
                          className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                          title="Salin Username & Password User"
                        >
                          {copiedId === user.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {user.nomorPeserta}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                        {user.kelas}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          user.jenisKelamin === 'L'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-pink-50 text-pink-700'
                        }`}
                      >
                        {user.jenisKelamin}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Edit User & Password"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={isCurrentActive}
                          onClick={() => deleteUserAccount(user.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title={
                            isCurrentActive
                              ? 'Akun sedang digunakan'
                              : 'Hapus User'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      Tidak ada data user yang sesuai filter
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal (With Password Field) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {editingUser
                    ? 'Edit Akun & Password User (Admin / Guru / Proktor)'
                    : 'Tambah Akun User Baru'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Disimpan ke tabel <code className="font-mono">public.users</code> lengkap dengan kolom <code className="font-mono">password</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Role Selection Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Pilih Peran / Role User (<code className="font-mono lowercase">role</code>)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        id: 'admin',
                        label: 'Admin',
                        desc: 'Akses Penuh',
                        icon: Shield,
                      },
                      {
                        id: 'guru',
                        label: 'Guru',
                        desc: 'Bank Soal & Nilai',
                        icon: BookOpen,
                      },
                      {
                        id: 'proktor',
                        label: 'Proktor',
                        desc: 'Pengawas & Token',
                        icon: MonitorCheck,
                      },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = form.role === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            role: item.id,
                            password: editingUser
                              ? prev.password
                              : generateStaffPassword(item.id, prev.nomorPeserta),
                          }))
                        }
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-950 ring-2 ring-indigo-600/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 mb-1.5 ${
                            active ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        />
                        <p className="text-xs font-bold">{item.label}</p>
                        <p className="text-[10px] text-slate-500">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Lengkap & Gelar (<code className="font-mono lowercase">name</code>)
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Dra. Siti Aminah, M.Pd."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Username Login (<code className="font-mono lowercase">username</code>)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="Contoh: guru.matematika"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    NIP / Kode Petugas (<code className="font-mono lowercase">nomor_peserta</code>)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nomorPeserta}
                    onChange={(e) => setForm({ ...form, nomorPeserta: e.target.value })}
                    placeholder="Contoh: NIP-19840721-01"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Password Field for New / Edited User */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-amber-950 uppercase tracking-wider">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Password Login User (<code className="font-mono lowercase">password</code>)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        password: generateStaffPassword(prev.role, prev.nomorPeserta),
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
                    placeholder="Masukkan password login user"
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
                  Digunakan oleh {form.role.toUpperCase()} bersama Username untuk login ke Panel NusantaraCBT.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jabatan / Mata Pelajaran / Ruang (<code className="font-mono lowercase">kelas</code>)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.kelas}
                    onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                    placeholder="Contoh: Guru Matematika / Proktor Lab 1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
                  />
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
                  Instansi Sekolah (<code className="font-mono lowercase">sekolah</code>)
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
                  {editingUser ? 'Simpan Perubahan' : 'Daftarkan User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Hapus {selectedIds.length} Akun User Terpilih?
            </h3>
            <p className="text-xs text-slate-500">
              Akun yang sedang Anda gunakan untuk login saat ini akan otomatis dilindungi dan tidak ikut terhapus.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  bulkDeleteUsers(selectedIds);
                  setSelectedIds([]);
                  setShowBulkDeleteConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Ya, Hapus Terpilih
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload User Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Bulk Upload User Aparatur (Admin, Guru, Proktor)
                </h3>
                <p className="text-xs text-slate-500">
                  Unggah file CSV dengan kolom <code className="font-mono">username, password, name, role, kelas, nomor_peserta, jenis_kelamin, sekolah</code>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadStaffTemplateCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Unduh Template .CSV
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {bulkReport && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2 text-xs">
                  <p className="font-bold text-slate-900">
                    Notifikasi Hasil Bulk Upload User: {bulkReport.succeeded.length} Berhasil Dibuat,{' '}
                    {bulkReport.failed.length} Gagal Dibuat
                  </p>
                  {bulkReport.failed.map((f, i) => (
                    <p key={i} className="text-rose-700">
                      • Baris #{f.rowNumber} ({f.username}): {f.reason}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const content = String(ev.target?.result ?? '');
                      setRawBulkText(content);
                      handleValidateStaffBulk(content);
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Pilih File CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleValidateStaffBulk()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Cek & Validasi Data
                </button>
              </div>

              <textarea
                rows={4}
                value={rawBulkText}
                onChange={(e) => {
                  setRawBulkText(e.target.value);
                  setHasChecked(false);
                }}
                placeholder="username,password,name,role,kelas,nomor_peserta,jenis_kelamin,sekolah&#10;guru.kimia,GURU-KIM#01,Dr. Bambang Sudibyo,guru,Guru Kimia,NIP-19820311-04,L,SMA Negeri 1 Nusantara Jakarta"
                className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs"
              />

              {parsedRows.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                      <tr>
                        <th className="py-2 px-3">No.</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Username</th>
                        <th className="py-2 px-3">Password</th>
                        <th className="py-2 px-3">Nama</th>
                        <th className="py-2 px-3">Role</th>
                        <th className="py-2 px-3">Jabatan / Unit</th>
                        <th className="py-2 px-3">NIP / Kode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {parsedRows.map((r) => (
                        <tr key={r.rowIndex} className={r.isValid ? 'bg-white' : 'bg-rose-50'}>
                          <td className="py-2 px-3 font-mono font-bold">{r.rowIndex}</td>
                          <td className="py-2 px-3">
                            {r.isValid ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                                <AlertCircle className="w-3.5 h-3.5" /> {r.errors.join(', ')}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono">{r.username}</td>
                          <td className="py-2 px-3 font-mono font-semibold text-amber-800">
                            {r.password}
                          </td>
                          <td className="py-2 px-3">{r.name}</td>
                          <td className="py-2 px-3 uppercase font-bold">{r.role}</td>
                          <td className="py-2 px-3">{r.kelas}</td>
                          <td className="py-2 px-3 font-mono">{r.nomorPeserta}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={!hasChecked || parsedRows.filter((r) => r.isValid).length === 0}
                onClick={handleSaveBulkStaff}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold cursor-pointer"
              >
                Simpan User Valid ({parsedRows.filter((r) => r.isValid).length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
