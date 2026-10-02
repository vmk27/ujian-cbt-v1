import { ClassRoom, ExamPackage, UserAccount } from '../types/cbt';

export type TingkatAngkatan = 'X' | 'XI' | 'XII';

/**
 * Mengekstrak tingkat angkatan ('X' | 'XI' | 'XII') dari nama kelas atau target kelas.
 * Urutan pengecekan wajib XII -> XI -> X agar 'XII' atau 'XI' tidak salah terbaca sebagai 'X'.
 */
export function extractTingkatFromText(
  rawText: string | undefined | null,
  classesList?: ClassRoom[]
): TingkatAngkatan | null {
  if (!rawText) return null;
  const cleaned = rawText.trim();
  if (!cleaned) return null;

  // 1. Cek kecocokan langsung pada daftar master kelas jika tersedia
  if (classesList && classesList.length > 0) {
    const matchedClass = classesList.find(
      (c) =>
        c.namaKelas.trim().toLowerCase() === cleaned.toLowerCase() ||
        c.kodeKelas.trim().toLowerCase() === cleaned.toLowerCase()
    );
    if (matchedClass && (matchedClass.tingkat === 'X' || matchedClass.tingkat === 'XI' || matchedClass.tingkat === 'XII')) {
      return matchedClass.tingkat;
    }
  }

  // 2. Deteksi berbasis token kata (cek XII/12 terlebih dahulu, lalu XI/11, lalu X/10)
  if (/(?:^|[\s\-_/()])(XII|12)(?:$|[\s\-_/()])/i.test(cleaned)) {
    return 'XII';
  }
  if (/(?:^|[\s\-_/()])(XI|11)(?:$|[\s\-_/()])/i.test(cleaned)) {
    return 'XI';
  }
  if (/(?:^|[\s\-_/()])(X|10)(?:$|[\s\-_/()])/i.test(cleaned)) {
    return 'X';
  }

  return null;
}

/**
 * Mengekstrak jurusan ('MIPA' | 'IPS' | 'Bahasa') bila disebutkan secara spesifik pada teks kelas/target.
 */
export function extractJurusanFromText(
  rawText: string | undefined | null,
  classesList?: ClassRoom[]
): 'MIPA' | 'IPS' | 'Bahasa' | null {
  if (!rawText) return null;
  const cleaned = rawText.trim();

  if (classesList && classesList.length > 0) {
    const matchedClass = classesList.find(
      (c) =>
        c.namaKelas.trim().toLowerCase() === cleaned.toLowerCase() ||
        c.kodeKelas.trim().toLowerCase() === cleaned.toLowerCase()
    );
    if (matchedClass && matchedClass.jurusan && matchedClass.jurusan !== 'Umum') {
      return matchedClass.jurusan;
    }
  }

  if (/\b(MIPA|IPA)\b/i.test(cleaned)) return 'MIPA';
  if (/\b(IPS)\b/i.test(cleaned)) return 'IPS';
  if (/\b(BAHASA|BHS)\b/i.test(cleaned)) return 'Bahasa';
  return null;
}

/**
 * Menentukan apakah sebuah target ujian bersifat mencakup seluruh kelas dalam satu angkatan
 * (misalnya: "Semua Kelas X", "Semua Kelas XI", "Semua Kelas XII", "Angkatan Kelas X", "Kelas X").
 */
export function isAngkatanWideTarget(kelasTarget: string): boolean {
  const cleaned = kelasTarget.trim().toLowerCase();
  if (
    cleaned.startsWith('semua ') ||
    cleaned.startsWith('angkatan ') ||
    cleaned === 'kelas x' ||
    cleaned === 'kelas xi' ||
    cleaned === 'kelas xii' ||
    cleaned === 'x' ||
    cleaned === 'xi' ||
    cleaned === 'xii'
  ) {
    return true;
  }
  return false;
}

/**
 * Memvalidasi apakah seorang siswa berhak melihat jadwal dan mengakses paket ujian tertentu
 * berdasarkan kesesuaian angkatan (Kelas X / XI / XII), jurusan, atau rombel spesifik.
 *
 * Aturan utama:
 * - Soal/jadwal ujian untuk angkatan Kelas X HANYA bisa diakses oleh siswa Kelas X.
 * - Soal/jadwal ujian untuk angkatan Kelas XI HANYA bisa diakses oleh siswa Kelas XI.
 * - Soal/jadwal ujian untuk angkatan Kelas XII HANYA bisa diakses oleh siswa Kelas XII.
 * - Jika paket ujian menunjuk rombel spesifik (misal "XII MIPA 1"), maka hanya siswa di rombel tersebut yang dapat mengakses.
 */
export function canStudentAccessExam(
  student: Pick<UserAccount, 'kelas' | 'role'> | null | undefined,
  exam: Pick<ExamPackage, 'kelasTarget'> | null | undefined,
  classesList?: ClassRoom[]
): boolean {
  if (!student || !exam) return false;
  if (student.role && student.role !== 'siswa') return true;

  const studentKelas = (student.kelas || '').trim();
  const examTarget = (exam.kelasTarget || '').trim();

  if (!studentKelas) return false;
  if (!examTarget) return true;

  const targetLower = examTarget.toLowerCase();
  const studentLower = studentKelas.toLowerCase();

  // Jika target eksplisit untuk semua angkatan tanpa batas tingkat
  if (
    targetLower === 'semua angkatan' ||
    targetLower === 'semua kelas' ||
    targetLower === 'seluruh siswa'
  ) {
    return true;
  }

  const studentTingkat = extractTingkatFromText(studentKelas, classesList);
  const examTingkat = extractTingkatFromText(examTarget, classesList);

  // 1. Isolasi Ketat Antar-Angkatan (Kelas X vs XI vs XII)
  // Jika ujian memiliki tingkat angkatan (X, XI, atau XII), maka tingkat angkatan siswa WAJIB sama persis.
  if (examTingkat) {
    if (!studentTingkat || studentTingkat !== examTingkat) {
      return false;
    }
  }

  // 2. Jika nama kelas siswa sama persis dengan target ujian (mis. "X MIPA 1" === "X MIPA 1")
  if (studentLower === targetLower) {
    return true;
  }

  // 3. Jika target ujian adalah cakupan angkatan (mis. "Semua Kelas X", "Semua Kelas XII MIPA")
  if (isAngkatanWideTarget(examTarget)) {
    if (!examTingkat) return true;
    // Cek apakah target angkatan juga membatasi jurusan tertentu (mis. "Semua Kelas X MIPA")
    const targetJurusan = extractJurusanFromText(examTarget);
    if (targetJurusan) {
      const studentJurusan = extractJurusanFromText(studentKelas, classesList);
      return studentJurusan === targetJurusan;
    }
    // Target adalah seluruh rombel pada angkatan tersebut (mis. "Semua Kelas X")
    return studentTingkat === examTingkat;
  }

  // 4. Jika target ujian adalah rombel spesifik (mis. "XII MIPA 1" atau "X MIPA 1"),
  // maka siswa dari rombel lain (meskipun satu angkatan, mis. "XII IPS 1" atau "XII MIPA 2") tidak cocok.
  return false;
}

/**
 * Menghasilkan label ringkas angkatan dari kelas atau target ujian.
 */
export function formatTingkatLabel(
  rawText: string | undefined | null,
  classesList?: ClassRoom[]
): string {
  const tingkat = extractTingkatFromText(rawText, classesList);
  if (!tingkat) return 'Semua Angkatan';
  return `Angkatan Kelas ${tingkat}`;
}

/**
 * Memeriksa apakah jadwal pelaksanaan ujian telah berakhir berdasarkan tanggal dan jam berakhir (endTime).
 */
export function isExamScheduleExpired(
  exam: Pick<ExamPackage, 'examDate' | 'endTime'> | null | undefined
): boolean {
  if (!exam || !exam.examDate || !exam.endTime) return false;
  try {
    const dateStr = exam.examDate.trim();
    const timeStr = exam.endTime.trim();
    if (!dateStr || !timeStr) return false;

    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (
      isNaN(year) ||
      isNaN(month) ||
      isNaN(day) ||
      isNaN(hours) ||
      isNaN(minutes)
    ) {
      return false;
    }

    const endDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return new Date().getTime() > endDateTime.getTime();
  } catch {
    return false;
  }
}
