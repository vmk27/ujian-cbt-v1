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
              <span className="font-bold text-slate-900 tracking-tight text-base block">
                {appSettings.appName}
              </span>
              <p className="text-xs text-slate-500">
                {appSettings.appSubtitle} — {appSettings.schoolName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="hidden sm:inline-block font-medium text-slate-700">
              Portal Evaluasi Akademik Terpadu
            </span>
            <span className="hidden sm:inline-block text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-600 tabular-nums">
              TA {appSettings.academicYear} · Semester {appSettings.semester}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Split Grid */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Institutional Information */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 text-blue-700 text-xs font-semibold mb-3">
                <BookOpenCheck className="w-4 h-4" />
                <span>Portal Pelaksanaan Ujian Satuan Pendidikan</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight text-balance">
                Evaluasi Akademik Terukur dengan Integritas Penuh.
              </h1>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                Platform ujian berbasis komputer yang dirancang khusus untuk kenyamanan fokus siswa
                serta kemudahan pengawasan proktor. Dilengkapi validasi token sesi, isolasi jadwal
                per angkatan kelas, penanda soal ragu-ragu, dan rekapitulasi nilai terpadu.
              </p>

              {/* Feature Grid */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-6 border-t border-slate-100">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-xs font-semibold text-blue-700 mb-1">
                    01. Validasi Token
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Keamanan akses paket soal menggunakan token dinamis 6-karakter dari proktor.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-xs font-semibold text-amber-700 mb-1">
                    02. Isolasi Angkatan
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Jadwal dan paket soal otomatis disesuaikan dengan tingkat angkatan Kelas X, XI, atau XII.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-xs font-semibold text-emerald-700 mb-1">
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
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-slate-900">
                    Masuk {appSettings.appName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Masukkan NISN (untuk Peserta Didik) atau Username/NIP (untuk Admin, Guru, dan Proktor).
                  </p>
                </div>

                {errorMsg && (
                  <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      NISN / Username / NIP
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Contoh Siswa: 0071234567 | Admin: admin"
                        className="w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password / Kredensial CBT
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        placeholder="Masukkan password akun Anda"
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
                      className="w-full py-3 px-4 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Masuk Sistem CBT</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Pastikan kredensial sesuai dengan Kartu Peserta Ujian yang diterbitkan oleh panitia penyelenggara.
                    </span>
                  </div>
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
            Standar Tata Kelola Evaluasi Berbasis Komputer
          </div>
        </div>
      </footer>
    </div>
  );
};
