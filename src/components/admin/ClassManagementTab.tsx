import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  Users,
  Search,
  MonitorCheck,
  Award,
  X,
  ArrowRight,
  UploadCloud,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { ClassRoom } from '../../types/cbt';

interface ClassManagementTabProps {
  onNavigateToStudentsWithClass?: (namaKelas: string) => void;
}

export const ClassManagementTab: React.FC<ClassManagementTabProps> = ({
  onNavigateToStudentsWithClass,
}) => {
  const {
    classes,
    users,
    sessions,
    addClassRoom,
    updateClassRoom,
    deleteClassRoom,
    pushAllToSupabase,
    showToast,
  } = useCBT();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTingkat, setFilterTingkat] = useState<'ALL' | 'X' | 'XI' | 'XII'>('ALL');
  const [filterJurusan, setFilterJurusan] = useState<string>('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [detailClass, setDetailClass] = useState<ClassRoom | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncClasses = async () => {
    setIsSyncing(true);
    await pushAllToSupabase();
    setIsSyncing(false);
  };

  const [form, setForm] = useState({
    kodeKelas: '',
    namaKelas: '',
    tingkat: 'XII' as 'X' | 'XI' | 'XII',
    jurusan: 'MIPA' as 'MIPA' | 'IPS' | 'Bahasa' | 'Umum',
    waliKelas: '',
    ruangUjian: 'Lab Komputer 1 (Gedung A)',
    kapasitas: 36,
    tahunAjaran: '2026/2027',
  });

  const studentUsers = users.filter((u) => u.role === 'siswa');
  const totalCapacity = classes.reduce((acc, c) => acc + c.kapasitas, 0);

  const openCreateModal = () => {
    setEditingClass(null);
    setForm({
      kodeKelas: `KLS-XII-${Math.floor(10 + Math.random() * 89)}`,
      namaKelas: '',
      tingkat: 'XII',
      jurusan: 'MIPA',
      waliKelas: '',
      ruangUjian: 'Lab Komputer 1 (Gedung A)',
      kapasitas: 36,
      tahunAjaran: '2026/2027',
    });
    setModalOpen(true);
  };

  const openEditModal = (cls: ClassRoom) => {
    setEditingClass(cls);
    setForm({
      kodeKelas: cls.kodeKelas,
      namaKelas: cls.namaKelas,
      tingkat: cls.tingkat,
      jurusan: cls.jurusan,
      waliKelas: cls.waliKelas,
      ruangUjian: cls.ruangUjian,
      kapasitas: cls.kapasitas,
      tahunAjaran: cls.tahunAjaran,
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClass) {
      updateClassRoom(editingClass.id, {
        ...form,
        kapasitas: Number(form.kapasitas),
      });
      setModalOpen(false);
    } else {
      const res = addClassRoom({
        ...form,
        kapasitas: Number(form.kapasitas),
      });
      if (!res.ok && res.message) {
        showToast('Gagal Menyimpan Kelas', res.message, 'error');
        return;
      }
      setModalOpen(false);
    }
  };

  const filteredClasses = classes.filter((cls) => {
    const matchesSearch =
      cls.namaKelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.kodeKelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.waliKelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.ruangUjian.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTingkat = filterTingkat === 'ALL' || cls.tingkat === filterTingkat;
    const matchesJurusan = filterJurusan === 'ALL' || cls.jurusan === filterJurusan;
    return matchesSearch && matchesTingkat && matchesJurusan;
  });

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Rombongan Belajar
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-mono font-extrabold text-slate-900 tabular-nums">
              {classes.length}
            </span>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              TA 2026/2027
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Siswa Terpetakan di Kelas
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-mono font-extrabold text-slate-900 tabular-nums">
              {studentUsers.length}
            </span>
            <span className="text-xs font-mono text-slate-500">
              Daya Tampung: {totalCapacity} Kursi
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Peminatan / Jurusan
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-extrabold text-slate-900">
              MIPA & IPS
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Kurikulum Merdeka
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Ruang Lab CBT Terjadwal
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-mono font-extrabold text-blue-700 tabular-nums">
              {new Set(classes.map((c) => c.ruangUjian)).size}
            </span>
            <span className="text-xs font-medium text-slate-500">Laboratorium Aktif</span>
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama kelas, wali kelas, lab..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={filterTingkat}
            onChange={(e) => setFilterTingkat(e.target.value as 'ALL' | 'X' | 'XI' | 'XII')}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">Semua Tingkat (X, XI, XII)</option>
            <option value="XII">Kelas XII</option>
            <option value="XI">Kelas XI</option>
            <option value="X">Kelas X</option>
          </select>

          <select
            value={filterJurusan}
            onChange={(e) => setFilterJurusan(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">Semua Jurusan</option>
            <option value="MIPA">MIPA</option>
            <option value="IPS">IPS</option>
            <option value="Bahasa">Bahasa</option>
            <option value="Umum">Umum</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncClasses}
            disabled={isSyncing}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Sinkronkan ke Supabase</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Data Kelas</span>
          </button>
        </div>
      </div>

      {/* Data Kelas Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Kode & Nama Kelas</th>
                <th className="py-3.5 px-4">Tingkat / Jurusan</th>
                <th className="py-3.5 px-4">Wali Kelas</th>
                <th className="py-3.5 px-4">Ruang Lab CBT</th>
                <th className="py-3.5 px-4 text-center">Jumlah Siswa</th>
                <th className="py-3.5 px-4 text-center">Rata-Rata Nilai</th>
                <th className="py-3.5 px-5 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Tidak ada data kelas yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredClasses.map((cls) => {
                  const classStudents = studentUsers.filter(
                    (u) => u.kelas === cls.namaKelas
                  );
                  const classSessions = sessions.filter(
                    (s) =>
                      s.studentKelas === cls.namaKelas &&
                      (s.status === 'completed' || s.status === 'timed_out')
                  );
                  const avgClassScore =
                    classSessions.length > 0
                      ? Math.round(
                          classSessions.reduce((acc, s) => acc + s.score, 0) /
                            classSessions.length
                        )
                      : null;

                  return (
                    <tr key={cls.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-sm text-slate-900">
                          {cls.namaKelas}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {cls.kodeKelas} • TA {cls.tahunAjaran}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold">
                            Tingkat {cls.tingkat}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold border ${
                              cls.jurusan === 'MIPA'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : cls.jurusan === 'IPS'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {cls.jurusan}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {cls.waliKelas}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <MonitorCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{cls.ruangUjian}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setDetailClass(cls)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 font-mono font-bold text-slate-800 transition-colors cursor-pointer tabular-nums"
                        >
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {classStudents.length} / {cls.kapasitas}
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {avgClassScore !== null ? (
                          <span className="inline-flex items-center gap-1 font-mono font-extrabold text-sm text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 tabular-nums">
                            <Award className="w-3.5 h-3.5" />
                            <span>{avgClassScore}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">Belum Ujian</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailClass(cls)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                          >
                            Daftar Siswa
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(cls)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            title="Edit Kelas"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteClassRoom(cls.id)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600 cursor-pointer"
                            title="Hapus Kelas"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Modal Tambah / Edit Kelas */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingClass ? 'Edit Data Kelas / Rombel' : 'Tambah Kelas / Rombel Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Kode Kelas
                  </label>
                  <input
                    type="text"
                    required
                    value={form.kodeKelas}
                    onChange={(e) =>
                      setForm({ ...form, kodeKelas: e.target.value.toUpperCase() })
                    }
                    placeholder="KLS-XII-MIPA-3"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Nama Rombel / Kelas
                  </label>
                  <input
                    type="text"
                    required
                    value={form.namaKelas}
                    onChange={(e) => setForm({ ...form, namaKelas: e.target.value })}
                    placeholder="Contoh: XII MIPA 3"
                    className="w-full px-3 py-2 font-bold bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Tingkat Kelas
                  </label>
                  <select
                    value={form.tingkat}
                    onChange={(e) =>
                      setForm({ ...form, tingkat: e.target.value as 'X' | 'XI' | 'XII' })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="X">Kelas X</option>
                    <option value="XI">Kelas XI</option>
                    <option value="XII">Kelas XII</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Peminatan / Jurusan
                  </label>
                  <select
                    value={form.jurusan}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        jurusan: e.target.value as 'MIPA' | 'IPS' | 'Bahasa' | 'Umum',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="MIPA">MIPA</option>
                    <option value="IPS">IPS</option>
                    <option value="Bahasa">Bahasa</option>
                    <option value="Umum">Umum</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Kapasitas Siswa
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={form.kapasitas}
                    onChange={(e) =>
                      setForm({ ...form, kapasitas: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-slate-600 mb-1">
                  Nama Wali Kelas
                </label>
                <input
                  type="text"
                  required
                  value={form.waliKelas}
                  onChange={(e) => setForm({ ...form, waliKelas: e.target.value })}
                  placeholder="Contoh: Drs. Ahmad Fauzi, M.Pd."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Ruang Lab CBT Default
                  </label>
                  <input
                    type="text"
                    required
                    value={form.ruangUjian}
                    onChange={(e) => setForm({ ...form, ruangUjian: e.target.value })}
                    placeholder="Contoh: Lab Komputer 1 (Gedung A)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Tahun Ajaran
                  </label>
                  <input
                    type="text"
                    required
                    value={form.tahunAjaran}
                    onChange={(e) => setForm({ ...form, tahunAjaran: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold cursor-pointer"
                >
                  Simpan Data Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Anggota Siswa dalam Kelas */}
      {detailClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-blue-700">
                  {detailClass.kodeKelas} • {detailClass.ruangUjian}
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  Daftar Peserta Didik Kelas {detailClass.namaKelas}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailClass(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">Wali Kelas: </span>
                  <strong className="text-slate-900">{detailClass.waliKelas}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Terdaftar: </span>
                  <strong className="font-mono text-blue-700">
                    {studentUsers.filter((u) => u.kelas === detailClass.namaKelas).length}{' '}
                    / {detailClass.kapasitas} Siswa
                  </strong>
                </div>
              </div>

              {studentUsers.filter((u) => u.kelas === detailClass.namaKelas).length ===
              0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Belum ada siswa yang terdaftar pada kelas {detailClass.namaKelas}.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-400">
                      <th className="py-2.5 px-3">No. Peserta</th>
                      <th className="py-2.5 px-3">NISN</th>
                      <th className="py-2.5 px-3">Nama Lengkap</th>
                      <th className="py-2.5 px-3 text-center">L/P</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {studentUsers
                      .filter((u) => u.kelas === detailClass.namaKelas)
                      .map((stu) => (
                        <tr key={stu.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                            {stu.nomorPeserta}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {stu.username}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {stu.name}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {stu.jenisKelamin}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {onNavigateToStudentsWithClass ? (
                <button
                  type="button"
                  onClick={() => {
                    const targetKelas = detailClass.namaKelas;
                    setDetailClass(null);
                    onNavigateToStudentsWithClass(targetKelas);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Kelola di Menu Data Siswa</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setDetailClass(null)}
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
