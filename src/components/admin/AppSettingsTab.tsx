import React, { useEffect, useState } from 'react';
import {
  Settings,
  Building2,
  MonitorCheck,
  Save,
  RotateCcw,
  Database,
  Award,
  CreditCard,
  Bell,
  ShieldAlert,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import { INITIAL_APP_SETTINGS } from '../../data/seedData';
import { AppSettings } from '../../types/cbt';

export const AppSettingsTab: React.FC = () => {
  const { appSettings, updateAppSettings, generateNextStudentNomorPeserta } = useCBT();

  const [form, setForm] = useState<AppSettings>(appSettings);

  useEffect(() => {
    setForm(appSettings);
  }, [appSettings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAppSettings({
      ...form,
      appName: form.appName.trim() || 'CBT SMANLUB',
      schoolName: form.schoolName.trim() || 'SMA Negeri 1 Lumbung Ciamis',
      studentNoPrefix: form.studentNoPrefix.trim() || '26-01-0104-',
      defaultKkm: Number(form.defaultKkm) || 75,
    });
  };

  const handleResetDefaults = () => {
    setForm(INITIAL_APP_SETTINGS);
    updateAppSettings(INITIAL_APP_SETTINGS);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Pengaturan Aplikasi & Identitas Sekolah
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Database className="w-3 h-3" />
              Tabel: public.app_settings
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ubah Nama Aplikasi, Nama Sekolah, Kepala Sekolah, Prefix Auto-Increment Nomor Peserta, serta Kop Kartu Ujian & Laporan Nilai.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Kembalikan Default
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan Aplikasi
          </button>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <MonitorCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight">
                {form.appName || 'NusantaraCBT'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                TP {form.academicYear} ({form.semester})
              </span>
            </div>
            <p className="text-xs text-slate-300 font-semibold mt-0.5">
              {form.schoolName} • NPSN: {form.npsn}
            </p>
            <p className="text-[11px] text-slate-400">{form.schoolAddress}</p>
          </div>
        </div>

        <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-xs">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Contoh Auto-Increment Nomor Peserta Siswa Berikutnya
          </p>
          <p className="font-mono font-extrabold text-amber-300 text-sm mt-0.5">
            {generateNextStudentNomorPeserta(0)}
          </p>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Identitas Aplikasi & Sekolah */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              1. Identitas Aplikasi & Satuan Pendidikan
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Nama Aplikasi CBT (<code className="font-mono lowercase">app_name</code>)
              </label>
              <input
                type="text"
                required
                value={form.appName}
                onChange={(e) => setForm({ ...form, appName: e.target.value })}
                placeholder="Contoh: NusantaraCBT"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                NPSN Sekolah (<code className="font-mono lowercase">npsn</code>)
              </label>
              <input
                type="text"
                required
                value={form.npsn}
                onChange={(e) => setForm({ ...form, npsn: e.target.value })}
                placeholder="20100101"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Subjudul / Tagline Aplikasi (<code className="font-mono lowercase">app_subtitle</code>)
            </label>
            <input
              type="text"
              required
              value={form.appSubtitle}
              onChange={(e) => setForm({ ...form, appSubtitle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Nama Sekolah / Instansi (<code className="font-mono lowercase">school_name</code>)
            </label>
            <input
              type="text"
              required
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              placeholder="Contoh: SMA Negeri 1 Nusantara Jakarta"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Alamat Lengkap Sekolah (<code className="font-mono lowercase">school_address</code>)
            </label>
            <textarea
              rows={2}
              required
              value={form.schoolAddress}
              onChange={(e) => setForm({ ...form, schoolAddress: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Tahun Pelajaran (<code className="font-mono lowercase">academic_year</code>)
              </label>
              <input
                type="text"
                required
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                placeholder="2026/2027"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Semester Aktif (<code className="font-mono lowercase">semester</code>)
              </label>
              <select
                value={form.semester}
                onChange={(e) =>
                  setForm({ ...form, semester: e.target.value as 'Ganjil' | 'Genap' })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-indigo-600"
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Pengesahan Dokumen, Kartu Ujian & Standar Penilaian */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                2. Pengaturan Kartu Ujian, Auto-Increment & Pengesahan Laporan
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Judul Kartu Ujian (<code className="font-mono lowercase">exam_card_title</code>)
              </label>
              <input
                type="text"
                required
                value={form.examCardTitle}
                onChange={(e) => setForm({ ...form, examCardTitle: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Prefix Auto-Increment Nomor Peserta (<code className="font-mono lowercase">student_no_prefix</code>)
                </label>
                <input
                  type="text"
                  required
                  value={form.studentNoPrefix}
                  onChange={(e) => setForm({ ...form, studentNoPrefix: e.target.value })}
                  placeholder="26-01-0104-"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-indigo-900 focus:outline-none focus:border-indigo-600"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Digunakan saat membuat Nomor Peserta otomatis di Menu Data Siswa.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Standar KKM Default (<code className="font-mono lowercase">default_kkm</code>)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={form.defaultKkm}
                  onChange={(e) =>
                    setForm({ ...form, defaultKkm: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Nama Kepala Sekolah / Ketua Panitia (<code className="font-mono lowercase">principal_name</code>)
                </label>
                <input
                  type="text"
                  required
                  value={form.principalName}
                  onChange={(e) => setForm({ ...form, principalName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  NIP Kepala Sekolah (<code className="font-mono lowercase">principal_nip</code>)
                </label>
                <input
                  type="text"
                  required
                  value={form.principalNip}
                  onChange={(e) => setForm({ ...form, principalNip: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Kota Tempat Pengesahan Tanda Tangan (<code className="font-mono lowercase">city_signature</code>)
              </label>
              <input
                type="text"
                required
                value={form.citySignature}
                onChange={(e) => setForm({ ...form, citySignature: e.target.value })}
                placeholder="Jakarta"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Tersinkron otomatis ke Kartu Ujian, Laporan Nilai & Tabel Supabase.</span>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Simpan Perubahan
            </button>
          </div>
        </div>

        {/* Card 3: Pengaturan Notifikasi Peringatan & Integritas Ujian */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Bell className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              3. Pengaturan Notifikasi Peringatan & Integritas Ujian Siswa
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Aktifkan atau nonaktifkan notifikasi pop-up peringatan realtime yang muncul pada layar Proktor / Admin saat siswa melaksanakan ujian di dalam ruang ujian virtual. Pengaturan ini tersimpan di tabel <code className="font-mono text-slate-800">public.app_settings</code>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {/* Enter Alert */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Siswa Masuk Ujian
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Kirim notifikasi ke proktor saat siswa baru mulai login dan memasuki ruang ujian.
                </p>
              </div>
              <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.enableAlertStudentEnter}
                  onChange={(e) => setForm({ ...form, enableAlertStudentEnter: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  {form.enableAlertStudentEnter ? 'Aktif (Kirim)' : 'Nonaktif'}
                </span>
              </label>
            </div>

            {/* Completed Alert */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Siswa Selesai Ujian
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Kirim notifikasi ke proktor saat siswa menekan tombol "Selesai" dan mengumpulkan jawaban.
                </p>
              </div>
              <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.enableAlertStudentCompleted}
                  onChange={(e) => setForm({ ...form, enableAlertStudentCompleted: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  {form.enableAlertStudentCompleted ? 'Aktif (Kirim)' : 'Nonaktif'}
                </span>
              </label>
            </div>

            {/* Tab Switch Alert */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Siswa Pindah Tab
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Kirim peringatan pelanggaran keamanan saat siswa keluar dari tab browser ujian.
                </p>
              </div>
              <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.enableAlertStudentTabSwitch}
                  onChange={(e) => setForm({ ...form, enableAlertStudentTabSwitch: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  {form.enableAlertStudentTabSwitch ? 'Aktif (Kirim)' : 'Nonaktif'}
                </span>
              </label>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
