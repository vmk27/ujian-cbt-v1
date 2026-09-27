export type UserRole = 'admin' | 'guru' | 'proktor' | 'siswa';

export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export type QuestionType = 'pilihan_ganda' | 'esai';

export interface ClassRoom {
  id: string;
  kodeKelas: string;
  namaKelas: string; // e.g., 'XII MIPA 1'
  tingkat: 'X' | 'XI' | 'XII';
  jurusan: 'MIPA' | 'IPS' | 'Bahasa' | 'Umum';
  waliKelas: string;
  ruangUjian: string;
  kapasitas: number;
  tahunAjaran: string;
}

export interface AppSettings {
  id: string; // e.g., 'default'
  appName: string; // e.g., 'NusantaraCBT'
  appSubtitle: string; // e.g., 'Portal Ujian Berbasis Komputer Nasional'
  schoolName: string; // e.g., 'SMA Negeri 1 Nusantara Jakarta'
  npsn: string; // e.g., '20100101'
  schoolAddress: string; // e.g., 'Jl. Pendidikan Raya No. 1, Jakarta Pusat'
  academicYear: string; // e.g., '2026/2027'
  semester: 'Ganjil' | 'Genap';
  principalName: string; // e.g., 'Dr. H. Surya Dharma, M.Pd.'
  principalNip: string; // e.g., '19720514 199802 1 001'
  examCardTitle: string; // e.g., 'KARTU PESERTA UJIAN SATUAN PENDIDIKAN (CBT)'
  studentNoPrefix: string; // e.g., '26-01-0104-'
  defaultKkm: number; // e.g., 75
  citySignature: string; // e.g., 'Jakarta'
}

export interface UserAccount {
  id: string;
  authUserId?: string; // Optional UUID reference to Supabase Auth (auth.users)
  username: string; // NISN for Siswa or NIP/Username for Admin, Guru, Proktor
  password?: string; // Password untuk User (Admin, Guru, Proktor) & Siswa
  name: string;
  role: UserRole;
  kelas: string; // e.g., 'XII MIPA 1' untuk Siswa, atau Jabatan/Mapel/Ruang untuk Admin/Guru/Proktor
  nomorPeserta: string; // e.g., '26-01-0104-001' untuk Siswa, atau NIP/Kode Petugas untuk Admin/Guru/Proktor
  jenisKelamin: 'L' | 'P';
  sekolah: string;
}

export interface QuestionOption {
  id: OptionLetter;
  text: string;
}

export interface Question {
  id: string;
  examId: string;
  number: number;
  questionType?: QuestionType; // 'pilihan_ganda' (default) | 'esai'
  topic: string;
  stimulus?: string; // Optional reading passage / context table / case study (supports HTML)
  questionText: string; // Question stem (supports Rich Text HTML)
  imageUrl?: string; // Optional attached photo URL from Supabase Storage bucket
  storagePath?: string; // Path inside Supabase bucket: <exam_code>/<bank_soal>/<filename>
  options: QuestionOption[];
  correctOption: OptionLetter;
  essayAnswerKey?: string; // Kunci jawaban / kata kunci penilaian untuk soal Esai
  points: number;
  explanation: string; // Explanation (supports Rich Text HTML)
}

export type ExamStatus = 'active' | 'draft' | 'closed';

export interface ExamPackage {
  id: string;
  code: string;
  title: string;
  subject: string;
  kelasTarget: string; // e.g., 'Semua Kelas XII', 'XII MIPA 1', 'XII IPS 1'
  examDate?: string; // Tanggal ujian (YYYY-MM-DD), e.g., '2026-09-28'
  startTime?: string; // Jam mulai ujian (HH:mm), e.g., '07:30'
  endTime?: string; // Jam berakhir ujian (HH:mm), e.g., '09:00'
  durationMinutes: number;
  token: string; // 6-char uppercase alphanumeric token
  status: ExamStatus;
  passingScore: number; // KKM (0-100)
  showExplanationAfterSubmit: boolean;
  instructions: string[];
  createdAt: string;
}

export type SessionStatus = 'in_progress' | 'completed' | 'timed_out';

export interface ExamSession {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentUsername: string;
  studentKelas: string;
  studentNomorPeserta: string;
  startedAt: string;
  submittedAt?: string;
  status: SessionStatus;
  answers: Record<string, string>; // questionId -> OptionLetter ('A'-'E') untuk PG atau teks jawaban untuk Esai
  doubtFlags: Record<string, boolean>; // questionId -> true if marked ragu-ragu
  remainingSeconds: number;
  tabSwitchCount: number;
  score: number; // 0 - 100
  earnedPoints: number;
  maxPoints: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
}
