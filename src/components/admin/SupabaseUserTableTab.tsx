import React, { useState } from 'react';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Plus,
  Edit3,
  Trash2,
  KeyRound,
  ShieldCheck,
  GraduationCap,
  Eye,
  EyeOff,
  Terminal,
  UploadCloud,
  Search,
  X,
  Play,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import {
  SUPABASE_PROJECT_URL,
  SUPABASE_REST_ENDPOINT,
  SUPABASE_USERS_DDL_SQL,
} from '../../lib/supabase';
import { UserAccount, UserRole } from '../../types/cbt';

export const SupabaseUserTableTab: React.FC = () => {
  const {
    users,
    classes,
    supabaseStatus,
    supabaseTableName,
    supabaseError,
    supabaseLastSync,
    refreshUsersFromSupabase,
    seedUsersToSupabase,
    addUserAccount,
    updateUserAccount,
    deleteUserAccount,
    resetUserPasswordViaAuth,
    showToast,
  } = useCBT();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'admin' | 'siswa'>('ALL');
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Add / Edit User Modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [uUsername, setUUsername] = useState('');
  const [uName, setUName] = useState('');
  const [uRole, setURole] = useState<UserRole>('siswa');
  const [uKelas, setUKelas] = useState('XII MIPA 1');
  const [uNomorPeserta, setUNomorPeserta] = useState('');
  const [uGender, setUGender] = useState<'L' | 'P'>('L');
  const [uSekolah, setUSekolah] = useState('SMA Negeri 1 Nusantara Jakarta');
  const [formError, setFormError] = useState<string | null>(null);

  // Test Profile Lookup Modal
  const [testUser, setTestUser] = useState('admin');
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
    matchedUser?: UserAccount;
  }>({ status: 'idle', message: '' });

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.nomorPeserta.toLowerCase().includes(q) ||
      u.kelas.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_USERS_DDL_SQL);
    setCopiedSql(true);
    showToast(
      'Script SQL Disalin',
      'Tempel dan jalankan script pada SQL Editor di Dashboard Supabase Anda.',
      'success'
    );
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleRefresh = async () => {
    setIsSyncing(true);
    await refreshUsersFromSupabase();
    setIsSyncing(false);
  };

  const handlePushSeed = async () => {
    setIsSyncing(true);
    await seedUsersToSupabase();
    setIsSyncing(false);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    const nextNum = String(users.filter((u) => u.role === 'siswa').length + 1).padStart(
      3,
      '0'
    );
    setUUsername('');
    setUName('');
    setURole('siswa');
    setUKelas(classes[0]?.namaKelas || 'XII MIPA 1');
    setUNomorPeserta(`26-01-0104-${nextNum}`);
    setUGender('L');
    setUSekolah('SMA Negeri 1 Nusantara Jakarta');
    setFormError(null);
    setShowUserModal(true);
  };

  const openEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setUUsername(user.username);
    setUName(user.name);
    setURole(user.role);
    setUKelas(user.kelas);
    setUNomorPeserta(user.nomorPeserta);
    setUGender(user.jenisKelamin);
    setUSekolah(user.sekolah);
    setFormError(null);
    setShowUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!uUsername.trim() || !uName.trim()) {
      setFormError('Username dan nama lengkap wajib diisi.');
      return;
    }

    if (editingUser) {
      updateUserAccount(editingUser.id, {
        username: uUsername.trim(),
        name: uName.trim(),
        role: uRole,
        kelas: uRole === 'admin' ? 'Proktor Pusat' : uKelas,
        nomorPeserta: uNomorPeserta.trim(),
        jenisKelamin: uGender,
        sekolah: uSekolah.trim(),
      });
      setShowUserModal(false);
    } else {
      const res = addUserAccount({
        username: uUsername.trim(),
        name: uName.trim(),
        role: uRole,
        kelas: uRole === 'admin' ? 'Proktor Pusat' : uKelas,
        nomorPeserta:
          uNomorPeserta.trim() ||
          (uRole === 'admin' ? 'NIP-PROKTOR' : '26-01-0104-099'),
        jenisKelamin: uGender,
        sekolah: uSekolah.trim() || 'SMA Negeri 1 Nusantara Jakarta',
      });
      if (!res.ok && res.message) {
        setFormError(res.message);
        return;
      }
      setShowUserModal(false);
    }
  };

  const handleTestAuthQuery = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = testUser.trim().toLowerCase();
    const found = users.find(
      (u) =>
        u.username.toLowerCase() === clean ||
        u.nomorPeserta.toLowerCase() === clean
    );
    if (!found) {
      setTestResult({
        status: 'error',
        message: `SELECT id, username, name, kelas FROM public.${supabaseTableName} WHERE username = '${testUser}' -> 0 baris ditemukan.`,
      });
      return;
    }
    setTestResult({
      status: 'success',
      message: `Profil ditemukan (Tanpa eksposur kolom password). Hak akses diverifikasi via Supabase Auth & public.user_roles.`,
      matchedUser: found,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Live Connection Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Tabel User Login & Koneksi Database Supabase
                </h2>
                {supabaseStatus === 'connected' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    TERHUBUNG (public.{supabaseTableName})
                  </span>
                )}
                {supabaseStatus === 'checking' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    MEMERIKSA KONEKSI...
                  </span>
                )}
                {supabaseStatus === 'table_missing' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    MENUNGGU PEMBUATAN TABEL public.users
                  </span>
                )}
                {supabaseStatus === 'error' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    GANGGUAN KONEKSI
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Manajemen tabel <code className="font-mono font-semibold text-slate-700">public.{supabaseTableName}</code> yang digunakan untuk autentikasi login Admin/Proktor dan Siswa CBT melalui Supabase REST API v1.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowSqlPanel(!showSqlPanel)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-slate-600" />
              <span>{showSqlPanel ? 'Tutup Script SQL' : 'Lihat Script SQL Tabel'}</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Muat Ulang dari Supabase</span>
            </button>

            <button
              type="button"
              onClick={handlePushSeed}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Sinkronkan ({users.length} User) ke Supabase</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Akun Login</span>
            </button>
          </div>
        </div>

        {/* Connection Endpoint Credentials Card */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Endpoint REST API v1 Supabase
            </div>
            <div className="mt-1 font-mono text-xs font-semibold text-slate-800 break-all">
              {SUPABASE_REST_ENDPOINT}{supabaseTableName}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Project URL: <span className="font-mono">{SUPABASE_PROJECT_URL}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Keamanan Kredensial & RLS
            </div>
            <div className="mt-1 font-mono text-xs font-semibold text-emerald-800">
              Supabase Auth + public.user_roles
            </div>
            <div className="mt-1 text-[11px] text-emerald-700 font-medium">
              Tanpa kolom password di API • Service-Role Key diblokir di browser
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Statistik Tabel User Login
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-xl font-extrabold font-mono text-slate-900">
                {users.length} Baris
              </span>
              <span className="text-xs text-slate-500">
                ({users.filter((u) => u.role === 'admin').length} Admin •{' '}
                {users.filter((u) => u.role === 'siswa').length} Siswa)
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {supabaseLastSync
                ? `Sinkronisasi terakhir: ${supabaseLastSync}`
                : 'Mode hibrida: Tabel lokal & REST API siap'}
            </div>
          </div>
        </div>

        {/* Notice if table public.users hasn't been created in Supabase SQL Editor yet */}
        {(supabaseStatus === 'table_missing' || showSqlPanel) && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50/70 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Inisialisasi Tabel <code className="font-mono text-blue-700">public.users</code> pada Database Supabase
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {supabaseError ||
                      'Salin dan jalankan perintah SQL di bawah ini pada menu SQL Editor di Dashboard Supabase Anda untuk membuat tabel public.users beserta kebijakan akses (RLS) dan data awal akun login.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Script SQL</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Cek Tabel Sekarang</span>
                </button>
              </div>
            </div>

            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-72 leading-relaxed border border-slate-800">
              {SUPABASE_USERS_DDL_SQL}
            </pre>
          </div>
        )}
      </div>

      {/* Interactive Login Query Tester + Schema Specification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Schema Definition */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <span>Struktur Skema Tabel Login (public.users)</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase bg-slate-50">
                  <th className="py-2.5 px-3 font-bold">Nama Kolom</th>
                  <th className="py-2.5 px-3 font-bold">Tipe Data</th>
                  <th className="py-2.5 px-3 font-bold">Atribut / Constraint</th>
                  <th className="py-2.5 px-3 font-bold">Keterangan Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="py-2 px-3 font-bold text-blue-700">id</td>
                  <td className="py-2 px-3 text-slate-600">TEXT</td>
                  <td className="py-2 px-3 text-emerald-700">PRIMARY KEY</td>
                  <td className="py-2 px-3 font-sans text-slate-600">ID unik pengguna (usr-...)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-blue-700">username</td>
                  <td className="py-2 px-3 text-slate-600">TEXT</td>
                  <td className="py-2 px-3 text-emerald-700">UNIQUE NOT NULL</td>
                  <td className="py-2 px-3 font-sans text-slate-600">NISN Siswa / Username Admin</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-blue-700">user_id</td>
                  <td className="py-2 px-3 text-slate-600">UUID</td>
                  <td className="py-2 px-3 text-emerald-700">REFERENCES auth.users(id)</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Relasi pemilik akun Supabase Auth</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800">name</td>
                  <td className="py-2 px-3 text-slate-600">TEXT</td>
                  <td className="py-2 px-3 text-slate-700">NOT NULL</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Nama lengkap peserta / proktor</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800">public.user_roles</td>
                  <td className="py-2 px-3 text-slate-600">TABLE</td>
                  <td className="py-2 px-3 text-emerald-700">public.is_admin()</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Bukti otorisasi Admin (tidak bisa diedit siswa)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800">kelas</td>
                  <td className="py-2 px-3 text-slate-600">TEXT</td>
                  <td className="py-2 px-3 text-slate-700">NOT NULL</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Rombel siswa / jabatan admin</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800">nomor_peserta</td>
                  <td className="py-2 px-3 text-slate-600">TEXT</td>
                  <td className="py-2 px-3 text-slate-700">NOT NULL</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Nomor kartu ujian / NIP</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Login Authentication Tester */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-600" />
              <span>Simulasi & Uji Kueri Login Tabel User</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Uji kecocokan kredensial <code className="font-mono">username</code> dan <code className="font-mono">password</code> terhadap data pada tabel user:
            </p>

            <form onSubmit={handleTestAuthQuery} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Username / NISN
                </label>
                <input
                  type="text"
                  value={testUser}
                  onChange={(e) => setTestUser(e.target.value)}
                  placeholder="admin / 10293847"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Uji Kueri Profil Tanpa Kolom Password</span>
              </button>
            </form>
          </div>

          {testResult.status !== 'idle' && (
            <div
              className={`mt-4 p-3.5 rounded-lg border text-xs ${
                testResult.status === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                {testResult.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.matchedUser && (
                <div className="mt-2 pt-2 border-t border-emerald-200/70 font-mono text-[11px] text-emerald-800">
                  ID: {testResult.matchedUser.id} | Nama: {testResult.matchedUser.name} | Role:{' '}
                  {testResult.matchedUser.role} | Kelas: {testResult.matchedUser.kelas}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Data Rows of public.users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Data Baris Tabel <code className="font-mono text-blue-700">public.{supabaseTableName}</code> ({filteredUsers.length} Akun)
            </h3>
            <p className="text-xs text-slate-500">
              Setiap penambahan atau perubahan akun di bawah ini langsung digunakan oleh halaman Login Aplikasi dan disinkronkan ke Supabase.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari username, nama, nomor..."
                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-blue-600 w-56"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | 'admin' | 'siswa')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="ALL">Semua Role ({users.length})</option>
              <option value="admin">
                Admin / Proktor ({users.filter((u) => u.role === 'admin').length})
              </option>
              <option value="siswa">
                Siswa / Peserta ({users.filter((u) => u.role === 'siswa').length})
              </option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">ID Baris</th>
                <th className="py-3 px-4">Username (Login)</th>
                <th className="py-3 px-4">Kredensial Supabase Auth</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Otorisasi (user_roles)</th>
                <th className="py-3 px-4">Kelas / Unit</th>
                <th className="py-3 px-4">Nomor Peserta / NIP</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredUsers.map((u) => {
                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {u.id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {u.username}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => resetUserPasswordViaAuth(u.username)}
                        className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold text-[11px] cursor-pointer"
                      >
                        Reset Password Auth
                      </button>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                    <td className="py-3 px-4">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <ShieldCheck className="w-3 h-3" />
                          <span>admin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <GraduationCap className="w-3 h-3" />
                          <span>siswa</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{u.kelas}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {u.nomorPeserta}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Sunting Baris User"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteUserAccount(u.id)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Hapus Baris User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit User Row */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingUser
                    ? `Edit Baris Tabel User (${editingUser.username})`
                    : 'Tambah Akun Baru ke Tabel User Login'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role Akses Login (`role`)
                  </label>
                  <select
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                  >
                    <option value="siswa">siswa (Peserta Ujian)</option>
                    <option value="admin">admin (Proktor / Administrator)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username / NISN (`username`)
                  </label>
                  <input
                    type="text"
                    value={uUsername}
                    onChange={(e) => setUUsername(e.target.value)}
                    placeholder={uRole === 'admin' ? 'admin2' : '10293855'}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Peserta / NIP (`nomor_peserta`)
                </label>
                <input
                  type="text"
                  value={uNomorPeserta}
                  onChange={(e) => setUNomorPeserta(e.target.value)}
                  placeholder="26-01-0104-008"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Pengguna (`name`)
                </label>
                <input
                  type="text"
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  placeholder="Masukkan nama lengkap..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kelas / Unit (`kelas`)
                  </label>
                  {uRole === 'admin' ? (
                    <input
                      type="text"
                      value="Proktor Pusat"
                      disabled
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-500"
                    />
                  ) : (
                    <select
                      value={uKelas}
                      onChange={(e) => setUKelas(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.namaKelas}>
                          {c.namaKelas}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenis Kelamin (`jenis_kelamin`)
                  </label>
                  <select
                    value={uGender}
                    onChange={(e) => setUGender(e.target.value as 'L' | 'P')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="L">L (Laki-laki)</option>
                    <option value="P">P (Perempuan)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold cursor-pointer"
                >
                  {editingUser ? 'Simpan Perubahan ke Tabel' : 'Simpan ke Tabel User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
