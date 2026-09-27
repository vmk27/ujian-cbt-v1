import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  MonitorCheck,
  BookOpenCheck,
  ShieldCheck,
} from 'lucide-react';
import { useCBT } from '../context/CBTContext';

export const LoginView: React.FC = () => {
  const { appSettings, login } = useCBT();

  const [username, setUsername] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = login(username, accessKey);
    if (!res.ok && res.message) {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Top Institutional Bar */}
      <header className="w-full bg-white border-b border-slate-200 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1D4ED8] flex items-center justify-center text-white shadow-xs shrink-0">
              <MonitorCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base">
                  {appSettings.appName}
                </span>
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  v4.2 Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {appSettings.appSubtitle} — {appSettings.schoolName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600">
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-medium text-slate-700">Server CBT Aktif</span>
            </div>
            <div className="font-mono text-slate-500 tabular-nums bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
              TA {appSettings.academicYear} • Semester {appSettings.semester}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Split Grid */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Institutional Information */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-4">
                <BookOpenCheck className="w-4 h-4" />
                <span>Portal Pelaksanaan Ujian Satuan Pendidikan</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Evaluasi Akademik Terukur dengan Integritas Penuh.
              </h1>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                Platform ujian berbasis komputer yang dirancang khusus untuk kenyamanan fokus siswa
                serta kemudahan pengawasan proktor. Dilengkapi validasi token sesi, penanda soal
                ragu-ragu, penyimpanan jawaban otomatis, dan rekapitulasi nilai terpadu.
              </p>

              {/* Feature Grid */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-6 border-t border-slate-100">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">
                    01. Validasi Token
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Keamanan akses paket soal menggunakan token dinamis 6-karakter dari proktor.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
                    02. Penanda Ragu-Ragu
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Matriks nomor soal interaktif dengan indikator warna Terjawab, Ragu, dan Kosong.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
                    03. Analitik Real-Time
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pemantauan pengerjaan langsung, deteksi pindah tab, dan ekspor leger nilai.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Login Form Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-900">
                    Masuk {appSettings.appName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Masukkan NISN / Username serta Password atau Nomor Peserta Ujian Anda.
                  </p>
                </div>

                {errorMsg && (
                  <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      NISN / Username
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Masukkan NISN atau Username"
                        className="w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Password / Nomor Peserta CBT
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        placeholder="Masukkan Password atau Nomor Peserta"
                        className="w-full pl-10 pr-10 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3 px-4 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Masuk Sistem</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Sistem mengarahkan hak akses secara otomatis berdasarkan akun yang terdaftar.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            © 2026 {appSettings.appName} — {appSettings.schoolName}.
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Standar Tata Kelola ANBK / UTBK-SNBT Nasional
          </div>
        </div>
      </footer>
    </div>
  );
};
