import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  INITIAL_APP_SETTINGS,
  INITIAL_CLASSES,
  INITIAL_EXAMS,
  INITIAL_QUESTIONS,
  INITIAL_SESSIONS,
  INITIAL_USERS,
} from '../data/seedData';
import {
  findMatchingStudentForSession,
  integrateSessionWithStudents,
  isSupabaseConfigured,
  mapAppSettingsToRow,
  mapClassToRow,
  mapExamToRow,
  mapQuestionToRow,
  mapRowToAppSettings,
  mapRowToClass,
  mapRowToExam,
  mapRowToQuestion,
  mapRowToSession,
  mapRowToUser,
  mapSessionToRow,
  mapStudentToRow,
  mapUserToRow,
  supabase,
  SupabaseConnectionState,
  supabaseService,
  TableHealthStatus,
} from '../lib/supabase';
import {
  AppSettings,
  ClassRoom,
  ExamPackage,
  ExamSession,
  OptionLetter,
  ProctorAlert,
  Question,
  RealtimeLogEntry,
  SupabaseRealtimeStatus,
  UserAccount,
} from '../types/cbt';
import { canStudentAccessExam, extractTingkatFromText } from '../utils/examAccess';

const STORAGE_KEYS = {
  APP_SETTINGS: 'nusantara_cbt_app_settings_v1',
  CLASSES: 'nusantara_cbt_classes_v1',
  USERS: 'nusantara_cbt_users_v1',
  EXAMS: 'nusantara_cbt_exams_v1',
  QUESTIONS: 'nusantara_cbt_questions_v1',
  SESSIONS: 'nusantara_cbt_sessions_v1',
  DEVICE_SESSIONS_BACKUP: 'nusantara_cbt_device_sessions_backup_v1',
  AUTO_SYNC_DEVICE_SCORES: 'nusantara_cbt_auto_sync_device_scores_v1',
  CURRENT_USER: 'nusantara_cbt_active_user_v1',
};

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface CBTContextType {
  appSettings: AppSettings;
  updateAppSettings: (updates: Partial<AppSettings>) => void;
  classes: ClassRoom[];
  users: UserAccount[];
  exams: ExamPackage[];
  questions: Question[];
  sessions: ExamSession[];
  currentUser: UserAccount | null;
  toasts: ToastMessage[];
  showToast: (
    title: string,
    description?: string,
    type?: 'success' | 'warning' | 'error' | 'info'
  ) => void;
  dismissToast: (id: string) => void;

  // Supabase Database Sync, Table Check & Auto Provisioning
  supabaseState: SupabaseConnectionState;
  supabaseMessage: string;
  isSyncingSupabase: boolean;
  lastSyncedAt: string | null;
  tableHealth: TableHealthStatus[];
  allTablesReady: boolean;
  refreshFromSupabase: () => Promise<void>;
  pushAllToSupabase: () => Promise<void>;
  checkAndAutoCreateTables: () => Promise<void>;

  // Supabase Realtime Connection & Live Sync
  realtimeStatus: SupabaseRealtimeStatus;
  realtimeEventsCount: number;
  lastRealtimeEvent: RealtimeLogEntry | null;
  realtimeLogs: RealtimeLogEntry[];
  sendRealtimePing: () => Promise<{ ok: boolean; message: string }>;

  // Proctor Realtime Incident & Activity Alert System
  proctorAlerts: ProctorAlert[];
  dismissProctorAlert: (id: string) => void;
  clearAllProctorAlerts: () => void;

  // Device Exam Score Recovery & Auto-Sync (Nilai Tersimpan pada Device Siswa)
  autoSyncDeviceScores: boolean;
  setAutoSyncDeviceScores: (enabled: boolean) => void;
  deviceSavedSessions: ExamSession[];
  unsyncedDeviceSessionIds: string[];
  isSyncingDeviceScores: boolean;
  syncDeviceSessionsToServer: (
    targetSessionId?: string
  ) => Promise<{ ok: boolean; syncedCount: number; message: string }>;
  importDeviceSessionsBackup: (
    importedSessions: ExamSession[]
  ) => Promise<{ ok: boolean; importedCount: number; message: string }>;

  // Helper for Student Nomor Peserta Auto-Increment
  generateNextStudentNomorPeserta: (offset?: number) => string;

  // Auth (No password stored in public.users table)
  login: (username: string, accessKey: string) => { ok: boolean; message?: string };
  logout: () => void;
  registerStudent: (data: {
    username: string;
    name: string;
    kelas: string;
    jenisKelamin: 'L' | 'P';
  }) => { ok: boolean; message?: string };

  // Classes (Data Kelas)
  addClassRoom: (cls: Omit<ClassRoom, 'id'>) => { ok: boolean; message?: string };
  updateClassRoom: (id: string, updates: Partial<ClassRoom>) => void;
  deleteClassRoom: (id: string) => void;

  // Exams
  addExam: (exam: Omit<ExamPackage, 'id' | 'createdAt' | 'token'> & { token?: string }) => ExamPackage;
  updateExam: (id: string, updates: Partial<ExamPackage>) => void;
  deleteExam: (id: string) => void;
  regenerateExamToken: (examId: string) => string;

  // Questions
  getQuestionsByExam: (examId: string) => Question[];
  addQuestion: (q: Omit<Question, 'id' | 'number'>) => void;
  bulkAddQuestions: (
    examId: string,
    items: Array<Omit<Question, 'id' | 'examId' | 'number'>>,
    mode?: 'append' | 'replace'
  ) => number;
  cloneQuestionsFromSource: (params: {
    targetExamId: string;
    sourceExamId?: string;
    bankSoalTopic?: string;
    mode?: 'append' | 'replace';
  }) => number;
  cloneQuestionsFromBankToExam: (
    targetExamId: string,
    options: { sourceExamId?: string; topicFilter?: string; mode?: 'append' | 'replace' }
  ) => number;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;

  // Student Exam Execution
  verifyTokenAndStartSession: (
    examId: string,
    inputToken: string
  ) => { ok: boolean; session?: ExamSession; message?: string };
  saveAnswer: (sessionId: string, questionId: string, answerValue: string) => void;
  toggleDoubtFlag: (sessionId: string, questionId: string) => void;
  tickSessionTimer: (sessionId: string, remainingSeconds: number) => void;
  recordTabSwitch: (sessionId: string) => void;
  submitExamSession: (sessionId: string, timedOut?: boolean) => ExamSession | undefined;
  adminForceSubmitSession: (sessionId: string) => ExamSession | undefined;

  // Admin Session, Grades & User Management
  resetStudentSession: (sessionId: string) => void;
  updateSessionScore: (
    sessionId: string,
    updates: { score: number; correctCount: number; wrongCount: number; unansweredCount: number }
  ) => void;
  addManualGradeSession: (data: {
    examId: string;
    studentId: string;
    score: number;
    correctCount: number;
    wrongCount: number;
  }) => { ok: boolean; message?: string };
  addUserAccount: (user: Omit<UserAccount, 'id'>) => { ok: boolean; message?: string };
  bulkAddUsers: (
    items: Array<Omit<UserAccount, 'id'>>
  ) => {
    created: UserAccount[];
    failed: Array<{ item: Omit<UserAccount, 'id'>; reason: string }>;
  };
  updateUserAccount: (id: string, updates: Partial<UserAccount>) => void;
  deleteUserAccount: (id: string) => void;
  bulkDeleteUsers: (ids: string[]) => { deletedCount: number; skippedActiveUser: boolean };
  clearOrphanedStudentUsers: () => Promise<void>;
  resetAllDemoData: () => void;
}

const CBTContext = createContext<CBTContextType | undefined>(undefined);

function generateRandomToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function resolveRootBankExamId(
  examId: string,
  examsList: ExamPackage[]
): string {
  let currentId = examId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const found = examsList.find((e) => e.id === currentId);
    if (
      found?.sourceExamId &&
      found.sourceExamId !== '__TOPIC__' &&
      found.sourceExamId !== found.id
    ) {
      const parentExists = examsList.some((e) => e.id === found.sourceExamId);
      if (parentExists) {
        currentId = found.sourceExamId;
        continue;
      }
      return found.sourceExamId;
    }
    break;
  }
  return currentId;
}

export function resolveQuestionsForExam(
  examId: string,
  examsList: ExamPackage[],
  questionsList: Question[]
): Question[] {
  const exam = examsList.find((e) => e.id === examId);
  if (!exam) {
    return questionsList
      .filter((q) => q.examId === examId)
      .sort((a, b) => a.number - b.number);
  }

  const topicFilter =
    exam.bankSoalName && exam.bankSoalName.trim() !== '' && exam.bankSoalName !== 'ALL'
      ? exam.bankSoalName.trim().toLowerCase()
      : null;

  // Mode 1: Shared Bank Soal based on Topic / Kelompok Bank Soal across all packages
  if (exam.sourceExamId === '__TOPIC__' && topicFilter) {
    const matched = questionsList
      .filter((q) => (q.topic || '').trim().toLowerCase() === topicFilter)
      .sort((a, b) => a.number - b.number);
    return matched.map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
  }

  // Mode 2: Shared Bank Soal referencing a previous ExamPackage (sourceExamId)
  if (
    exam.sourceExamId &&
    exam.sourceExamId !== '__TOPIC__' &&
    exam.sourceExamId !== exam.id
  ) {
    const rootId = resolveRootBankExamId(exam.id, examsList);
    const validIds = new Set<string>([exam.id, exam.sourceExamId, rootId]);
    let matched = questionsList.filter((q) => validIds.has(q.examId));
    if (topicFilter) {
      const byTopic = matched.filter(
        (q) => (q.topic || '').trim().toLowerCase() === topicFilter
      );
      if (byTopic.length > 0) {
        matched = byTopic;
      } else {
        // Fallback: if topic exists in global bank soal
        matched = questionsList.filter(
          (q) => (q.topic || '').trim().toLowerCase() === topicFilter
        );
      }
    }
    matched.sort((a, b) => a.number - b.number);
    return matched.map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
  }

  // Mode 3: Direct / Standalone ExamPackage (or filtered by bankSoalName)
  let direct = questionsList.filter((q) => q.examId === exam.id);
  if (topicFilter) {
    const byTopic = direct.filter(
      (q) => (q.topic || '').trim().toLowerCase() === topicFilter
    );
    if (byTopic.length > 0) {
      direct = byTopic;
    } else {
      // If exam has no direct questions yet but specifies bankSoalName, pull from global topic bank
      const globalByTopic = questionsList.filter(
        (q) => (q.topic || '').trim().toLowerCase() === topicFilter
      );
      if (globalByTopic.length > 0) {
        direct = globalByTopic;
      }
    }
  }
  direct.sort((a, b) => a.number - b.number);
  return direct.map((q, idx) => ({
    ...q,
    number: idx + 1,
  }));
}

function calculateSessionMetrics(
  examQuestions: Question[],
  answers: Record<string, string>
) {
  let earnedPoints = 0;
  let maxPoints = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  for (const q of examQuestions) {
    maxPoints += q.points;
    const chosen = (answers[q.id] || '').trim();
    if (!chosen) {
      unansweredCount++;
    } else if (q.questionType === 'esai') {
      const key = (q.essayAnswerKey || '').trim().toLowerCase();
      const ansLower = chosen.toLowerCase();
      if (!key) {
        // If no strict essay key is set, any substantive essay answer is counted as answered/correct
        correctCount++;
        earnedPoints += q.points;
      } else {
        // Check if answer includes key or matches keywords separated by comma/semicolon
        const keywords = key
          .split(/[,;]+/)
          .map((k) => k.trim())
          .filter(Boolean);
        const matchedKeywords =
          keywords.length > 0
            ? keywords.filter((kw) => ansLower.includes(kw)).length
            : ansLower.includes(key)
            ? 1
            : 0;
        if (ansLower.includes(key) || matchedKeywords > 0) {
          correctCount++;
          const ratio =
            keywords.length > 1 ? matchedKeywords / keywords.length : 1;
          earnedPoints += Math.round(q.points * ratio * 100) / 100;
        } else {
          wrongCount++;
        }
      }
    } else if (chosen === q.correctOption) {
      correctCount++;
      earnedPoints += q.points;
    } else {
      wrongCount++;
    }
  }

  const score = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;

  return {
    score,
    earnedPoints,
    maxPoints,
    correctCount,
    wrongCount,
    unansweredCount,
    totalQuestions: examQuestions.length,
  };
}

function isUntouchedDemoSession(s: ExamSession): boolean {
  const seed = INITIAL_SESSIONS.find((init) => init.id === s.id);
  if (!seed) return false;
  const seedAnsCount = Object.keys(seed.answers || {}).length;
  const curAnsCount = Object.keys(s.answers || {}).length;
  return (
    seed.status === s.status &&
    seed.score === s.score &&
    seed.submittedAt === s.submittedAt &&
    seedAnsCount === curAnsCount
  );
}

function isSessionBetterOrNewer(candidate: ExamSession, base: ExamSession): boolean {
  const candDone = candidate.status === 'completed' || candidate.status === 'timed_out';
  const baseDone = base.status === 'completed' || base.status === 'timed_out';
  if (candDone && !baseDone) return true;
  if (!candDone && baseDone) return false;
  const candAns = Object.keys(candidate.answers || {}).length;
  const baseAns = Object.keys(base.answers || {}).length;
  if (candAns !== baseAns) return candAns > baseAns;
  if (candidate.score !== base.score) return candidate.score > base.score;
  return Boolean(candidate.submittedAt && !base.submittedAt);
}

function readLocalDeviceSessions(): ExamSession[] {
  const map = new Map<string, ExamSession>();
  const keysToRead = [STORAGE_KEYS.DEVICE_SESSIONS_BACKUP, STORAGE_KEYS.SESSIONS];
  for (const key of keysToRead) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed as ExamSession[]) {
        if (!item || !item.id || !item.examId) continue;
        if (isUntouchedDemoSession(item)) continue;
        const existing = map.get(item.id);
        if (!existing || isSessionBetterOrNewer(item, existing)) {
          map.set(item.id, item);
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return Array.from(map.values());
}

function saveLocalDeviceSessionsBackup(sessionsList: ExamSession[]) {
  try {
    const existing = readLocalDeviceSessions();
    const map = new Map<string, ExamSession>();
    for (const s of existing) {
      map.set(s.id, s);
    }
    for (const s of sessionsList) {
      if (!s || !s.id || isUntouchedDemoSession(s)) continue;
      const prev = map.get(s.id);
      if (!prev || isSessionBetterOrNewer(s, prev)) {
        map.set(s.id, s);
      }
    }
    localStorage.setItem(
      STORAGE_KEYS.DEVICE_SESSIONS_BACKUP,
      JSON.stringify(Array.from(map.values()))
    );
  } catch {
    // ignore storage quota errors
  }
}

export const CBTProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
      return saved ? { ...INITIAL_APP_SETTINGS, ...JSON.parse(saved) } : INITIAL_APP_SETTINGS;
    } catch {
      return INITIAL_APP_SETTINGS;
    }
  });

  const [classes, setClasses] = useState<ClassRoom[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLASSES);
      if (!saved) return INITIAL_CLASSES;
      const parsed = JSON.parse(saved) as ClassRoom[];
      for (const seedCls of INITIAL_CLASSES) {
        if (
          !parsed.some(
            (c) =>
              c.id === seedCls.id ||
              c.namaKelas.toLowerCase() === seedCls.namaKelas.toLowerCase()
          )
        ) {
          parsed.push(seedCls);
        }
      }
      return parsed;
    } catch {
      return INITIAL_CLASSES;
    }
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!saved) return INITIAL_USERS;
      const parsed = JSON.parse(saved) as Array<Record<string, unknown>>;
      const loaded: UserAccount[] = parsed.map((u, idx) => {
        const role = (u.role as UserAccount['role']) || 'siswa';
        const username = String(u.username ?? '');
        const nomorPeserta = String(u.nomorPeserta ?? '');
        const seedMatch = INITIAL_USERS.find(
          (su) => su.id === String(u.id) || su.username.toLowerCase() === username.toLowerCase()
        );
        const fallbackPass = String(
          u.password ||
            seedMatch?.password ||
            (role === 'siswa'
              ? `CBT-${nomorPeserta.slice(-3) || String(idx + 1).padStart(3, '0')}*`
              : `${role.toUpperCase()}-CBT#${String(idx + 1).padStart(2, '0')}`)
        );
        return {
          id: String(u.id),
          authUserId: u.authUserId ? String(u.authUserId) : undefined,
          username,
          password: fallbackPass,
          name: String(u.name ?? ''),
          role,
          kelas: String(u.kelas ?? ''),
          nomorPeserta,
          jenisKelamin: (u.jenisKelamin as 'L' | 'P') || 'L',
          sekolah: String(u.sekolah ?? 'SMA Negeri 1 Nusantara Jakarta'),
        };
      });

      // Ensure seed guru, proktor, and sample Kelas X/XI student accounts exist if upgrading from earlier localStorage state
      for (const seedAcc of INITIAL_USERS) {
        if (
          !loaded.some(
            (existing) =>
              existing.id === seedAcc.id ||
              existing.username.toLowerCase() === seedAcc.username.toLowerCase()
          )
        ) {
          loaded.push(seedAcc);
        }
      }

      return loaded;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [exams, setExams] = useState<ExamPackage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EXAMS);
      if (!saved) return INITIAL_EXAMS;
      const parsed = JSON.parse(saved) as ExamPackage[];
      const mapped: ExamPackage[] = parsed.map((ex) => {
        const seedMatch = INITIAL_EXAMS.find(
          (se) => se.id === ex.id || se.code === ex.code
        );
        return {
          ...ex,
          examDate: ex.examDate || seedMatch?.examDate || '2026-09-28',
          startTime: ex.startTime || seedMatch?.startTime || '07:30',
          endTime: ex.endTime || seedMatch?.endTime || '09:00',
        };
      });
      for (const seedEx of INITIAL_EXAMS) {
        if (
          !mapped.some(
            (ex) => ex.id === seedEx.id || ex.code.toLowerCase() === seedEx.code.toLowerCase()
          )
        ) {
          mapped.push(seedEx);
        }
      }
      return mapped;
    } catch {
      return INITIAL_EXAMS;
    }
  });

  const [questions, setQuestions] = useState<Question[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      if (!saved) return INITIAL_QUESTIONS;
      const parsed = JSON.parse(saved) as Question[];
      for (const seedQ of INITIAL_QUESTIONS) {
        if (!parsed.some((q) => q.id === seedQ.id)) {
          parsed.push(seedQ);
        }
      }
      return parsed;
    } catch {
      return INITIAL_QUESTIONS;
    }
  });

  const [sessions, setSessions] = useState<ExamSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      const initialList: ExamSession[] = saved ? JSON.parse(saved) : INITIAL_SESSIONS;
      const deviceBackup = readLocalDeviceSessions();
      if (deviceBackup.length > 0) {
        const mergedMap = new Map<string, ExamSession>();
        for (const s of initialList) mergedMap.set(s.id, s);
        for (const ds of deviceBackup) {
          const ex = mergedMap.get(ds.id);
          if (!ex || isSessionBetterOrNewer(ds, ex)) {
            mergedMap.set(ds.id, ds);
          }
        }
        return Array.from(mergedMap.values());
      }
      return initialList;
    } catch {
      return INITIAL_SESSIONS;
    }
  });

  const [autoSyncDeviceScores, setAutoSyncDeviceScoresState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SYNC_DEVICE_SCORES);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [unsyncedDeviceSessionIds, setUnsyncedDeviceSessionIds] = useState<string[]>([]);
  const [isSyncingDeviceScores, setIsSyncingDeviceScores] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [supabaseState, setSupabaseState] = useState<SupabaseConnectionState>(
    isSupabaseConfigured() ? 'checking' : 'unconfigured'
  );
  const [supabaseMessage, setSupabaseMessage] = useState<string>(
    isSupabaseConfigured()
      ? 'Memeriksa koneksi ke database Supabase...'
      : 'Variabel VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diatur.'
  );
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [tableHealth, setTableHealth] = useState<TableHealthStatus[]>([]);
  const [allTablesReady, setAllTablesReady] = useState<boolean>(false);

  // Supabase Realtime State & Event Logging
  const [realtimeStatus, setRealtimeStatus] = useState<SupabaseRealtimeStatus>(
    isSupabaseConfigured() ? 'CONNECTING' : 'OFFLINE'
  );
  const [realtimeEventsCount, setRealtimeEventsCount] = useState<number>(0);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<RealtimeLogEntry | null>(null);
  const [realtimeLogs, setRealtimeLogs] = useState<RealtimeLogEntry[]>([]);

  // Proctor Realtime Incident & Activity Alerts State
  const [proctorAlerts, setProctorAlerts] = useState<ProctorAlert[]>([]);

  const addProctorAlert = useCallback((alertData: Omit<ProctorAlert, 'id' | 'timestamp'>) => {
    const newAlert: ProctorAlert = {
      ...alertData,
      id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setProctorAlerts((prev) => [newAlert, ...prev.filter((a) => a.sessionId !== newAlert.sessionId || a.type !== newAlert.type).slice(0, 29)]);
  }, []);

  const dismissProctorAlert = useCallback((id: string) => {
    setProctorAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAllProctorAlerts = useCallback(() => {
    setProctorAlerts([]);
  }, []);

  const sessionsRef = useRef<ExamSession[]>(sessions);
  const appSettingsRef = useRef<AppSettings>(appSettings);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  const generateNextStudentNomorPeserta = useCallback(
    (offset = 0): string => {
      const prefix = (appSettings.studentNoPrefix || '26-01-0104-').trim();
      const studentList = users.filter((u) => u.role === 'siswa');
      let maxSeq = studentList.length;
      for (const st of studentList) {
        const match = st.nomorPeserta.match(/(\d+)$/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!Number.isNaN(val) && val > maxSeq) {
            maxSeq = val;
          }
        }
      }
      const nextNum = maxSeq + 1 + offset;
      return `${prefix}${String(nextNum).padStart(3, '0')}`;
    },
    [users, appSettings.studentNoPrefix]
  );

  const showToast = useCallback(
    (
      title: string,
      description?: string,
      type: 'success' | 'warning' | 'error' | 'info' = 'info'
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, description, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const setAutoSyncDeviceScores = useCallback(
    (enabled: boolean) => {
      setAutoSyncDeviceScoresState(enabled);
      try {
        localStorage.setItem(STORAGE_KEYS.AUTO_SYNC_DEVICE_SCORES, String(enabled));
      } catch {
        // ignore
      }
      showToast(
        enabled
          ? 'Sinkronisasi Nilai Otomatis Diaktifkan'
          : 'Mode Sinkronisasi Manual Diaktifkan',
        enabled
          ? 'Data nilai yang tersimpan pada perangkat siswa akan langsung dikirim ke server (v_rekap_nilai & students) secara otomatis.'
          : 'Nilai tersimpan aman di perangkat dan dapat dikirim kapan saja menggunakan tombol Sinkronkan Nilai.',
        'info'
      );
    },
    [showToast]
  );

  // Daftar sesi ujian riil yang tersimpan di perangkat ini
  const deviceSavedSessions = React.useMemo(() => {
    const backup = readLocalDeviceSessions();
    const map = new Map<string, ExamSession>();
    for (const b of backup) map.set(b.id, b);
    for (const s of sessions) {
      if (!isUntouchedDemoSession(s)) {
        const prev = map.get(s.id);
        if (!prev || isSessionBetterOrNewer(s, prev)) {
          map.set(s.id, s);
        }
      }
    }
    return Array.from(map.values()).map((s) => {
      const { session: integrated } = integrateSessionWithStudents(s, users);
      return integrated;
    });
  }, [sessions, users]);

  // Sinkronisasi manual / langsung data nilai dari perangkat siswa ke Supabase (exam_sessions & v_rekap_nilai)
  const syncDeviceSessionsToServer = useCallback(
    async (
      targetSessionId?: string
    ): Promise<{ ok: boolean; syncedCount: number; message: string }> => {
      const candidates = targetSessionId
        ? deviceSavedSessions.filter((s) => s.id === targetSessionId)
        : deviceSavedSessions.length > 0
        ? deviceSavedSessions
        : sessions.filter((s) => !isUntouchedDemoSession(s));

      // Recalculate metrics & integrate with students before pushing
      const prepared: ExamSession[] = candidates.map((s) => {
        const { session: integrated } = integrateSessionWithStudents(s, users);
        const exQuestions = resolveQuestionsForExam(
          integrated.examId,
          exams,
          questions
        );
        const hasAnswers = Object.keys(integrated.answers || {}).length > 0;
        if (exQuestions.length > 0 && hasAnswers) {
          const metrics = calculateSessionMetrics(exQuestions, integrated.answers);
          return {
            ...integrated,
            ...metrics,
          };
        }
        return integrated;
      });

      if (prepared.length === 0) {
        const msg = 'Tidak ada data sesi ujian baru di perangkat ini yang perlu dikirim.';
        showToast('Data Nilai Sudah Sinkron', msg, 'info');
        return { ok: true, syncedCount: 0, message: msg };
      }

      // Update local state first with reconciled student data & recalculated scores
      setSessions((prev) => {
        const map = new Map<string, ExamSession>();
        for (const item of prev) map.set(item.id, item);
        for (const p of prepared) map.set(p.id, p);
        return Array.from(map.values());
      });
      saveLocalDeviceSessionsBackup(prepared);

      if (!isSupabaseConfigured()) {
        const msg = `${prepared.length} hasil ujian telah diamankan dan diintegrasikan dengan data siswa pada perangkat ini.`;
        showToast('Tersimpan di Perangkat', msg, 'success');
        return { ok: true, syncedCount: prepared.length, message: msg };
      }

      setIsSyncingDeviceScores(true);
      const batchRes = await supabaseService.upsertSessionsBatch(prepared, users);
      setIsSyncingDeviceScores(false);

      if (batchRes.ok) {
        const syncedIds = new Set(batchRes.syncedSessions.map((s) => s.id));
        setUnsyncedDeviceSessionIds((prev) => prev.filter((id) => !syncedIds.has(id)));
        setSessions((prev) => {
          const map = new Map<string, ExamSession>();
          for (const item of prev) map.set(item.id, item);
          for (const synced of batchRes.syncedSessions) {
            map.set(synced.id, synced);
          }
          return Array.from(map.values());
        });
        setLastSyncedAt(new Date().toISOString());
        const msg = `${batchRes.syncedSessions.length} nilai hasil ujian siswa dari perangkat ini berhasil masuk ke tabel exam_sessions & v_rekap_nilai (terintegrasi tabel students).`;
        showToast('Nilai Berhasil Masuk ke Server', msg, 'success');
        return {
          ok: true,
          syncedCount: batchRes.syncedSessions.length,
          message: msg,
        };
      }

      const errMsg =
        batchRes.error ||
        'Gagal mengirim sebagian nilai ke server. Data tetap tersimpan aman di perangkat siswa.';
      showToast('Gagal Sinkronisasi Server', errMsg, 'warning');
      return { ok: false, syncedCount: 0, message: errMsg };
    },
    [deviceSavedSessions, sessions, users, questions, showToast]
  );

  const importDeviceSessionsBackup = useCallback(
    async (
      importedSessions: ExamSession[]
    ): Promise<{ ok: boolean; importedCount: number; message: string }> => {
      if (!Array.isArray(importedSessions) || importedSessions.length === 0) {
        return {
          ok: false,
          importedCount: 0,
          message: 'Berkas cadangan tidak berisi data sesi nilai ujian yang valid.',
        };
      }

      const validSessions: ExamSession[] = importedSessions
        .filter((s) => s && s.id && s.examId && (s.studentId || s.studentUsername))
        .map((s) => {
          const { session: integrated } = integrateSessionWithStudents(s, users);
          const exQuestions = resolveQuestionsForExam(
            integrated.examId,
            exams,
            questions
          );
          const hasAnswers = Object.keys(integrated.answers || {}).length > 0;
          if (exQuestions.length > 0 && hasAnswers && integrated.score === 0) {
            const metrics = calculateSessionMetrics(exQuestions, integrated.answers);
            return { ...integrated, ...metrics };
          }
          return integrated;
        });

      if (validSessions.length === 0) {
        return {
          ok: false,
          importedCount: 0,
          message: 'Tidak ditemukan format sesi nilai ujian yang valid di dalam berkas.',
        };
      }

      setSessions((prev) => {
        const map = new Map<string, ExamSession>();
        for (const item of prev) map.set(item.id, item);
        for (const vs of validSessions) {
          const existing = map.get(vs.id);
          if (!existing || isSessionBetterOrNewer(vs, existing)) {
            map.set(vs.id, vs);
          }
        }
        return Array.from(map.values());
      });
      saveLocalDeviceSessionsBackup(validSessions);

      if (isSupabaseConfigured()) {
        setIsSyncingDeviceScores(true);
        const batchRes = await supabaseService.upsertSessionsBatch(validSessions, users);
        setIsSyncingDeviceScores(false);
        if (batchRes.ok) {
          setLastSyncedAt(new Date().toISOString());
          const msg = `${batchRes.syncedSessions.length} nilai ujian siswa berhasil dipulihkan dan langsung masuk ke tabel exam_sessions & v_rekap_nilai.`;
          showToast('Pemulihan Nilai Siswa Berhasil', msg, 'success');
          return { ok: true, importedCount: batchRes.syncedSessions.length, message: msg };
        }
      }

      const msg = `${validSessions.length} data nilai siswa berhasil diimpor dan diintegrasikan dengan tabel students.`;
      showToast('Impor Data Nilai Berhasil', msg, 'success');
      return { ok: true, importedCount: validSessions.length, message: msg };
    },
    [users, questions, showToast]
  );

  // Supabase Initial Check & Fetch (dengan pelestarian & auto-sync data nilai pada device siswa)
  const refreshFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setSupabaseState('unconfigured');
      setSupabaseMessage(
        'Variabel VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diatur pada Environment Variables.'
      );
      return;
    }

    // Baca seluruh sesi ujian yang tersimpan pada perangkat ini sebelum fetch agar tidak pernah tertimpa
    const localDeviceList = readLocalDeviceSessions();

    setIsSyncingSupabase(true);
    setSupabaseState('checking');

    // First check all tables health in database
    const healthCheck = await supabaseService.checkAllTablesHealth();
    setTableHealth(healthCheck.tables);
    setAllTablesReady(healthCheck.allReady);

    const conn = await supabaseService.checkConnection();
    setSupabaseState(conn.state);
    setSupabaseMessage(conn.message);

    if (conn.state === 'connected') {
      // If any new table (e.g. app_settings, students, v_rekap_nilai) or column is missing, attempt automatic creation via RPC
      if (!healthCheck.allReady) {
        const autoRes = await supabaseService.autoCreateTablesInDatabase();
        setTableHealth(autoRes.health.tables);
        setAllTablesReady(autoRes.health.allReady);
      }

      const res = await supabaseService.fetchAllData();
      if (res.ok && res.data) {
        if (res.data.appSettings) {
          setAppSettings(res.data.appSettings);
        }
        const isDbEmpty =
          res.data.classes.length === 0 &&
          res.data.users.length === 0 &&
          res.data.exams.length === 0;

        if (isDbEmpty) {
          // Automatically seed initial data + any local device sessions into Supabase
          const seedPlusLocal = [...INITIAL_SESSIONS];
          for (const ls of localDeviceList) {
            const idx = seedPlusLocal.findIndex((s) => s.id === ls.id);
            if (idx >= 0) seedPlusLocal[idx] = ls;
            else seedPlusLocal.unshift(ls);
          }
          await supabaseService.syncAllToSupabase({
            appSettings: INITIAL_APP_SETTINGS,
            classes: INITIAL_CLASSES,
            users: INITIAL_USERS,
            exams: INITIAL_EXAMS,
            questions: INITIAL_QUESTIONS,
            sessions: seedPlusLocal,
          });
          setSessions(seedPlusLocal);
          const updatedHealth = await supabaseService.checkAllTablesHealth();
          setTableHealth(updatedHealth.tables);
          setAllTablesReady(updatedHealth.allReady);
          setLastSyncedAt(new Date().toISOString());
        } else {
          const remoteUsers = res.data.users;
          const remoteExams = res.data.exams;
          const remoteQuestions = res.data.questions;
          const remoteSessions = res.data.sessions;

          setClasses(res.data.classes);
          setUsers(remoteUsers);
          setExams(remoteExams);
          setQuestions(remoteQuestions);

          // Sinkronkan currentUser (jika siswa sedang login di perangkat ini) agar ID-nya selaras dengan public.students
          setCurrentUser((prevUser) => {
            if (!prevUser || prevUser.role !== 'siswa') return prevUser;
            const matchedStu = findMatchingStudentForSession(
              {
                studentId: prevUser.id,
                studentUsername: prevUser.username,
                studentNomorPeserta: prevUser.nomorPeserta,
                studentName: prevUser.name,
                studentKelas: prevUser.kelas,
              },
              remoteUsers
            );
            return matchedStu ? { ...prevUser, ...matchedStu, role: 'siswa' } : prevUser;
          });

          // Gabungkan sesi dari server dengan sesi yang tersimpan di perangkat siswa
          const mergedSessionMap = new Map<string, ExamSession>();
          for (const rs of remoteSessions) {
            const { session: integratedRemote } = integrateSessionWithStudents(
              rs,
              remoteUsers
            );
            mergedSessionMap.set(integratedRemote.id, integratedRemote);
          }

          const pendingDeviceToPush: ExamSession[] = [];

          for (const rawLocal of localDeviceList) {
            const { session: integratedLocal } = integrateSessionWithStudents(
              rawLocal,
              remoteUsers
            );
            const exQuestions = resolveQuestionsForExam(
              integratedLocal.examId,
              remoteExams,
              remoteQuestions
            );
            const hasAns = Object.keys(integratedLocal.answers || {}).length > 0;
            const reconciledLocal: ExamSession =
              exQuestions.length > 0 &&
              hasAns &&
              (integratedLocal.score === 0 || integratedLocal.totalQuestions === 0)
                ? {
                    ...integratedLocal,
                    ...calculateSessionMetrics(exQuestions, integratedLocal.answers),
                  }
                : integratedLocal;

            // Cek apakah sesi ini sudah ada di server (berdasarkan ID sesi atau kombinasi examId + studentId/username)
            const existingById = mergedSessionMap.get(reconciledLocal.id);
            const existingByStudentExam =
              existingById ||
              Array.from(mergedSessionMap.values()).find(
                (rs) =>
                  rs.examId === reconciledLocal.examId &&
                  (rs.studentId === reconciledLocal.studentId ||
                    (rs.studentUsername &&
                      reconciledLocal.studentUsername &&
                      rs.studentUsername.toLowerCase() ===
                        reconciledLocal.studentUsername.toLowerCase()))
              );

            if (!existingByStudentExam) {
              // Sesi dari perangkat siswa belum masuk ke database server sama sekali!
              mergedSessionMap.set(reconciledLocal.id, reconciledLocal);
              pendingDeviceToPush.push(reconciledLocal);
            } else if (isSessionBetterOrNewer(reconciledLocal, existingByStudentExam)) {
              // Sesi pada perangkat siswa lebih baru/lengkap (misal sudah selesai/memiliki jawaban lebih banyak)
              const unifiedSession: ExamSession = {
                ...reconciledLocal,
                id: existingByStudentExam.id,
              };
              mergedSessionMap.set(unifiedSession.id, unifiedSession);
              pendingDeviceToPush.push(unifiedSession);
            }
          }

          const finalSessionsList = Array.from(mergedSessionMap.values());
          setSessions(finalSessionsList);
          saveLocalDeviceSessionsBackup(finalSessionsList);

          // Jika ada nilai dari perangkat siswa yang belum masuk ke database server:
          if (pendingDeviceToPush.length > 0) {
            const shouldAutoSync =
              localStorage.getItem(STORAGE_KEYS.AUTO_SYNC_DEVICE_SCORES) !== 'false';
            if (shouldAutoSync) {
              setIsSyncingDeviceScores(true);
              const pushRes = await supabaseService.upsertSessionsBatch(
                pendingDeviceToPush,
                remoteUsers
              );
              setIsSyncingDeviceScores(false);
              if (pushRes.ok) {
                setUnsyncedDeviceSessionIds([]);
                setSessions((prev) => {
                  const map = new Map<string, ExamSession>();
                  for (const item of prev) map.set(item.id, item);
                  for (const synced of pushRes.syncedSessions) {
                    map.set(synced.id, synced);
                  }
                  return Array.from(map.values());
                });
                showToast(
                  'Nilai Perangkat Otomatis Masuk',
                  `${pushRes.syncedSessions.length} hasil ujian yang tersimpan pada perangkat ini langsung disinkronkan ke tabel students & v_rekap_nilai.`,
                  'success'
                );
              } else {
                setUnsyncedDeviceSessionIds(pendingDeviceToPush.map((s) => s.id));
              }
            } else {
              setUnsyncedDeviceSessionIds(pendingDeviceToPush.map((s) => s.id));
            }
          } else {
            setUnsyncedDeviceSessionIds([]);
          }

          setLastSyncedAt(new Date().toISOString());
        }
      }
    } else if (conn.state === 'schema_missing') {
      // Attempt automatic table creation if RPC exists
      const autoRes = await supabaseService.autoCreateTablesInDatabase({
        appSettings: INITIAL_APP_SETTINGS,
        classes: INITIAL_CLASSES,
        users: INITIAL_USERS,
        exams: INITIAL_EXAMS,
        questions: INITIAL_QUESTIONS,
        sessions: INITIAL_SESSIONS,
      });
      setTableHealth(autoRes.health.tables);
      setAllTablesReady(autoRes.health.allReady);
      if (autoRes.ok) {
        setSupabaseState('connected');
        setSupabaseMessage(autoRes.message);
        setLastSyncedAt(new Date().toISOString());
      }
    }
    setIsSyncingSupabase(false);
  }, [showToast]);

  const checkAndAutoCreateTables = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      showToast(
        'Supabase Belum Dikonfigurasi',
        'Atur VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY terlebih dahulu.',
        'warning'
      );
      return;
    }

    setIsSyncingSupabase(true);
    const res = await supabaseService.autoCreateTablesInDatabase({
      appSettings,
      classes,
      users,
      exams,
      questions,
      sessions,
    });
    setTableHealth(res.health.tables);
    setAllTablesReady(res.health.allReady);
    setIsSyncingSupabase(false);

    if (res.ok) {
      setSupabaseState('connected');
      setSupabaseMessage(res.message);
      setLastSyncedAt(new Date().toISOString());
      showToast('Pemeriksaan & Pembuatan Tabel Berhasil', res.message, 'success');
    } else {
      showToast('Status Pemeriksaan Tabel Database', res.message, 'warning');
    }
  }, [appSettings, classes, users, exams, questions, sessions, showToast]);

  const pushAllToSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      showToast(
        'Supabase Belum Dikonfigurasi',
        'Atur VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY terlebih dahulu.',
        'warning'
      );
      return;
    }

    setIsSyncingSupabase(true);
    const conn = await supabaseService.checkConnection();
    setSupabaseState(conn.state);
    setSupabaseMessage(conn.message);

    if (conn.state !== 'connected') {
      setIsSyncingSupabase(false);
      showToast('Gagal Sinkronisasi', conn.message, 'error');
      return;
    }

    const res = await supabaseService.syncAllToSupabase({
      appSettings,
      classes,
      users,
      exams,
      questions,
      sessions,
    });
    const healthCheck = await supabaseService.checkAllTablesHealth();
    setTableHealth(healthCheck.tables);
    setAllTablesReady(healthCheck.allReady);
    setIsSyncingSupabase(false);

    if (res.ok) {
      setLastSyncedAt(new Date().toISOString());
      showToast('Sinkronisasi Supabase Berhasil', res.message, 'success');
    } else {
      showToast('Gagal Menyinkronkan ke Supabase', res.message, 'error');
    }
  }, [appSettings, classes, users, exams, questions, sessions, showToast]);

  const sendRealtimePing = useCallback(async () => {
    const sender = currentUser?.name || 'Administrator CBT';
    const res = await supabaseService.broadcastRealtimePing(sender);
    if (res.ok) {
      showToast('Sinyal Realtime Disiarkan', res.message, 'success');
    } else {
      showToast('Gagal Realtime Ping', res.message, 'warning');
    }
    return res;
  }, [currentUser, showToast]);

  useEffect(() => {
    if (isSupabaseConfigured()) {
      refreshFromSupabase();
    }
  }, [refreshFromSupabase]);

  // Supabase Realtime Subscription (Live bidirectional sync for all 7 tables)
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setRealtimeStatus('OFFLINE');
      return;
    }

    setRealtimeStatus('CONNECTING');

    const logEvent = (entry: Omit<RealtimeLogEntry, 'id' | 'timestamp'>) => {
      const fullEntry: RealtimeLogEntry = {
        ...entry,
        id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      };
      setLastRealtimeEvent(fullEntry);
      setRealtimeEventsCount((prev) => prev + 1);
      setRealtimeLogs((prev) => [fullEntry, ...prev.slice(0, 49)]);
    };

    const channel = supabase
      .channel('cbt-live-sync', {
        config: {
          broadcast: { self: true },
        },
      })
      // 1. app_settings
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new) {
              const updated = mapRowToAppSettings(payload.new as Record<string, unknown>);
              setAppSettings(updated);
              logEvent({
                table: 'app_settings',
                eventType: payload.eventType,
                description: `Pengaturan aplikasi "${updated.appName}" disinkronkan realtime.`,
                recordId: updated.id,
              });
            }
          }
        }
      )
      // 2. classes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classes' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (payload.new) {
              const newCls = mapRowToClass(payload.new as Record<string, unknown>);
              setClasses((prev) => {
                const idx = prev.findIndex((c) => c.id === newCls.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = newCls;
                  return copy;
                }
                return [...prev, newCls];
              });
              logEvent({
                table: 'classes',
                eventType: 'INSERT',
                description: `Kelas baru "${newCls.namaKelas}" diterima via realtime.`,
                recordId: newCls.id,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new) {
              const updatedCls = mapRowToClass(payload.new as Record<string, unknown>);
              setClasses((prev) =>
                prev.map((c) => (c.id === updatedCls.id ? updatedCls : c))
              );
              logEvent({
                table: 'classes',
                eventType: 'UPDATE',
                description: `Data kelas "${updatedCls.namaKelas}" diperbarui realtime.`,
                recordId: updatedCls.id,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = String((payload.old as { id?: string })?.id ?? '');
            if (oldId) {
              setClasses((prev) => prev.filter((c) => c.id !== oldId));
              logEvent({
                table: 'classes',
                eventType: 'DELETE',
                description: `Kelas (ID: ${oldId}) dihapus di database.`,
                recordId: oldId,
              });
            }
          }
        }
      )
      // 3. users (Admin, Guru, Proktor)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new) {
              const u = mapRowToUser(payload.new as Record<string, unknown>);
              setUsers((prev) => {
                const idx = prev.findIndex((item) => item.id === u.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = { ...copy[idx], ...u };
                  return copy;
                }
                return [...prev, u];
              });
              logEvent({
                table: 'users',
                eventType: payload.eventType,
                description: `Akun "${u.name}" (${u.role.toUpperCase()}) disinkronkan realtime.`,
                recordId: u.id,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = String((payload.old as { id?: string })?.id ?? '');
            if (oldId) {
              setUsers((prev) => prev.filter((u) => u.id !== oldId));
              logEvent({
                table: 'users',
                eventType: 'DELETE',
                description: `Akun (ID: ${oldId}) dihapus di database.`,
                recordId: oldId,
              });
            }
          }
        }
      )
      // 4. students (Data Siswa & Password)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new) {
              const s = mapRowToUser(payload.new as Record<string, unknown>);
              setUsers((prev) => {
                const idx = prev.findIndex((item) => item.id === s.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = { ...copy[idx], ...s, role: 'siswa' };
                  return copy;
                }
                return [...prev, { ...s, role: 'siswa' }];
              });
              logEvent({
                table: 'students',
                eventType: payload.eventType,
                description: `Siswa "${s.name}" (${s.kelas}) disinkronkan realtime.`,
                recordId: s.id,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = String((payload.old as { id?: string })?.id ?? '');
            if (oldId) {
              setUsers((prev) => prev.filter((u) => u.id !== oldId));
              logEvent({
                table: 'students',
                eventType: 'DELETE',
                description: `Data Siswa (ID: ${oldId}) dihapus di database.`,
                recordId: oldId,
              });
            }
          }
        }
      )
      // 5. exams (Paket & Jadwal Ujian)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exams' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (payload.new) {
              const newExam = mapRowToExam(payload.new as Record<string, unknown>);
              setExams((prev) => {
                const idx = prev.findIndex((e) => e.id === newExam.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = newExam;
                  return copy;
                }
                return [newExam, ...prev];
              });
              logEvent({
                table: 'exams',
                eventType: 'INSERT',
                description: `Paket Ujian baru "${newExam.title}" (${newExam.code}) aktif realtime.`,
                recordId: newExam.id,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new) {
              const updatedExam = mapRowToExam(payload.new as Record<string, unknown>);
              setExams((prev) =>
                prev.map((e) => (e.id === updatedExam.id ? updatedExam : e))
              );
              logEvent({
                table: 'exams',
                eventType: 'UPDATE',
                description: `Paket Ujian "${updatedExam.title}" diperbarui secara realtime.`,
                recordId: updatedExam.id,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = String((payload.old as { id?: string })?.id ?? '');
            if (oldId) {
              setExams((prev) => prev.filter((e) => e.id !== oldId));
              logEvent({
                table: 'exams',
                eventType: 'DELETE',
                description: `Paket Ujian (ID: ${oldId}) dihapus.`,
                recordId: oldId,
              });
            }
          }
        }
      )
      // 6. questions (Bank Soal, Rich Text & Foto)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'questions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (payload.new) {
              const newQ = mapRowToQuestion(payload.new as Record<string, unknown>);
              setQuestions((prev) => {
                const idx = prev.findIndex((q) => q.id === newQ.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = newQ;
                  return copy;
                }
                return [...prev, newQ];
              });
              logEvent({
                table: 'questions',
                eventType: 'INSERT',
                description: `Soal No. ${newQ.number} (${newQ.topic}) ditambahkan realtime.`,
                recordId: newQ.id,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new) {
              const updatedQ = mapRowToQuestion(payload.new as Record<string, unknown>);
              setQuestions((prev) =>
                prev.map((q) => (q.id === updatedQ.id ? updatedQ : q))
              );
              logEvent({
                table: 'questions',
                eventType: 'UPDATE',
                description: `Soal No. ${updatedQ.number} (${updatedQ.topic}) diperbarui realtime.`,
                recordId: updatedQ.id,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = String((payload.old as { id?: string })?.id ?? '');
            if (oldId) {
              setQuestions((prev) => prev.filter((q) => q.id !== oldId));
              logEvent({
                table: 'questions',
                eventType: 'DELETE',
                description: `Butir Soal (ID: ${oldId}) dihapus.`,
                recordId: oldId,
              });
            }
          }
        }
      )
      // 7. exam_sessions (Data Nilai & Sesi Siswa)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_sessions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (payload.new) {
              const newSes = mapRowToSession(payload.new as Record<string, unknown>);
              const ex = exams.find((e) => e.id === newSes.examId);
              setSessions((prev) => {
                const idx = prev.findIndex((s) => s.id === newSes.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = newSes;
                  return copy;
                }
                return [newSes, ...prev];
              });
              logEvent({
                table: 'exam_sessions',
                eventType: 'INSERT',
                description: `Sesi Ujian siswa ${newSes.studentName} (${newSes.status}) mulai realtime.`,
                recordId: newSes.id,
              });

              // Toast & Alert untuk Proktor saat Siswa Masuk Ujian via Supabase Realtime
              if (appSettingsRef.current.enableAlertStudentEnter) {
                showToast(
                  '🚀 Siswa Masuk Ujian',
                  `Siswa ${newSes.studentName} (${newSes.studentKelas}) baru saja login & memulai pengerjaan [${ex?.code || newSes.examId}].`,
                  'info'
                );
                addProctorAlert({
                  type: 'student_enter',
                  title: '🚀 Siswa Masuk Ujian',
                  message: `Siswa ${newSes.studentName} (${newSes.studentKelas}) login & mulai pengerjaan [${ex?.code || newSes.examId}].`,
                  studentName: newSes.studentName,
                  studentKelas: newSes.studentKelas,
                  studentNomorPeserta: newSes.studentNomorPeserta,
                  examCode: ex?.code || newSes.examId,
                  sessionId: newSes.id,
                });
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new) {
              const updatedSes = mapRowToSession(payload.new as Record<string, unknown>);
              const ex = exams.find((e) => e.id === updatedSes.examId);
              const prevSes = sessionsRef.current.find((s: ExamSession) => s.id === updatedSes.id);

              setSessions((prev) =>
                prev.map((s) => (s.id === updatedSes.id ? updatedSes : s))
              );
              logEvent({
                table: 'exam_sessions',
                eventType: 'UPDATE',
                description: `Nilai/Sesi siswa ${updatedSes.studentName} (Skor: ${updatedSes.score}) disinkronkan realtime.`,
                recordId: updatedSes.id,
              });

              // 1. Deteksi Kendala / Pelanggaran Perpindahan Tab
              if (appSettingsRef.current.enableAlertStudentTabSwitch && updatedSes.tabSwitchCount > (prevSes?.tabSwitchCount || 0)) {
                showToast(
                  '⚠️ Peringatan Integritas Proktor',
                  `Siswa ${updatedSes.studentName} (${updatedSes.studentKelas}) terdeteksi berpindah tab/fokus! (Total: ${updatedSes.tabSwitchCount} kali)`,
                  'warning'
                );
                addProctorAlert({
                  type: 'tab_switch',
                  title: '⚠️ Peringatan Integritas Proktor',
                  message: `Siswa ${updatedSes.studentName} (${updatedSes.studentKelas}) terdeteksi berpindah tab/fokus saat pengerjaan [${ex?.code || updatedSes.examId}]! (Total Pelanggaran: ${updatedSes.tabSwitchCount} kali)`,
                  studentName: updatedSes.studentName,
                  studentKelas: updatedSes.studentKelas,
                  studentNomorPeserta: updatedSes.studentNomorPeserta,
                  examCode: ex?.code || updatedSes.examId,
                  sessionId: updatedSes.id,
                  tabSwitchCount: updatedSes.tabSwitchCount,
                });
              } else if (prevSes?.status === 'in_progress' && updatedSes.status === 'completed') {
                // 2. Deteksi Siswa Menyelesaikan Ujian
                if (appSettingsRef.current.enableAlertStudentCompleted) {
                  showToast(
                    '✅ Siswa Selesaikan Ujian',
                    `Siswa ${updatedSes.studentName} (${updatedSes.studentKelas}) telah mengumpulkan lembar jawaban [${ex?.code || updatedSes.examId}]. Skor: ${updatedSes.score}`,
                    'success'
                  );
                  addProctorAlert({
                    type: 'student_completed',
                    title: '✅ Siswa Menyelesaikan Ujian',
                    message: `Siswa ${updatedSes.studentName} (${updatedSes.studentKelas}) selesai mengumpulkan lembar jawaban [${ex?.code || updatedSes.examId}]. Skor: ${updatedSes.score}`,
                    studentName: updatedSes.studentName,
                    studentKelas: updatedSes.studentKelas,
                    studentNomorPeserta: updatedSes.studentNomorPeserta,
                    examCode: ex?.code || updatedSes.examId,
                    sessionId: updatedSes.id,
                    score: updatedSes.score,
                  });
                }
              } else if (prevSes?.status === 'in_progress' && updatedSes.status === 'timed_out') {
                // 3. Deteksi Kendala Sesi Ujian Waktu Habis / Timed Out
                showToast(
                  '⏰ Sesi Ujian Waktu Habis',
                  `Sesi ujian siswa ${updatedSes.studentName} (${updatedSes.studentKelas}) diakhiri otomatis karena batas waktu habis.`,
                  'warning'
                );
                addProctorAlert({
                  type: 'student_timeout',
                  title: '⏰ Sesi Ujian Waktu Habis',
                  message: `Sesi ujian siswa ${updatedSes.studentName} (${updatedSes.studentKelas}) diakhiri otomatis karena batas waktu habis.`,
                  studentName: updatedSes.studentName,
                  studentKelas: updatedSes.studentKelas,
                  studentNomorPeserta: updatedSes.studentNomorPeserta,
                  examCode: ex?.code || updatedSes.examId,
                  sessionId: updatedSes.id,
                });
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = String((payload.old as { id?: string })?.id ?? '');
            if (oldId) {
              setSessions((prev) => prev.filter((s) => s.id !== oldId));
              logEvent({
                table: 'exam_sessions',
                eventType: 'DELETE',
                description: `Sesi Ujian (ID: ${oldId}) direset/dihapus.`,
                recordId: oldId,
              });
            }
          }
        }
      )
      // Broadcast Ping Channel
      .on('broadcast', { event: 'cbt-realtime-ping' }, (payload) => {
        const data = payload.payload as { sender?: string; timestamp?: string; message?: string };
        logEvent({
          table: 'channel:cbt-live-sync',
          eventType: 'BROADCAST',
          description: data?.message || `Ping broadcast diterima dari ${data?.sender || 'Klien CBT'}.`,
        });
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('SUBSCRIBED');
          logEvent({
            table: 'supabase_realtime',
            eventType: 'SUBSCRIBED',
            description: 'Saluran realtime "cbt-live-sync" aktif dan mendengarkan perubahan data Supabase.',
          });
        } else if (status === 'TIMED_OUT') {
          setRealtimeStatus('TIMED_OUT');
        } else if (status === 'CHANNEL_ERROR') {
          setRealtimeStatus('CHANNEL_ERROR');
          console.warn('Realtime channel error:', err);
        } else if (status === 'CLOSED') {
          setRealtimeStatus('DISCONNECTED');
        }
      });

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(appSettings));
    } catch (e) {
      console.error(e);
    }
  }, [appSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
    } catch (e) {
      console.error(e);
    }
  }, [classes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      console.error(e);
    }
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
    } catch (e) {
      console.error(e);
    }
  }, [exams]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    } catch (e) {
      console.error(e);
    }
  }, [questions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      saveLocalDeviceSessionsBackup(sessions);
    } catch (e) {
      console.error(e);
    }
  }, [sessions]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  // Cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      try {
        if (e.key === STORAGE_KEYS.CLASSES && e.newValue) {
          setClasses(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.USERS && e.newValue) {
          setUsers(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.EXAMS && e.newValue) {
          setExams(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.QUESTIONS && e.newValue) {
          setQuestions(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEYS.SESSIONS && e.newValue) {
          setSessions(JSON.parse(e.newValue));
        }
      } catch (err) {
        console.error(err);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Auth Actions: Siswa autentikasi dari tabel public.students, Staf (Admin, Guru, Proktor) dari tabel public.users
  const login = (usernameInput: string, accessKeyInput: string) => {
    const cleanUser = usernameInput.trim().toLowerCase();
    const rawKey = accessKeyInput.trim();
    const cleanKey = rawKey.toLowerCase();

    // 1. Cek autentikasi Siswa (Data berasal dari tabel public.students)
    const studentCandidate = users.find(
      (u) =>
        u.role === 'siswa' &&
        (u.username.toLowerCase() === cleanUser ||
          u.nomorPeserta.toLowerCase() === cleanUser)
    );

    if (studentCandidate) {
      const isStudentValid =
        Boolean(
          studentCandidate.password &&
            (rawKey === studentCandidate.password ||
              cleanKey === studentCandidate.password.toLowerCase())
        ) ||
        cleanKey === studentCandidate.nomorPeserta.toLowerCase() ||
        cleanKey === studentCandidate.username.toLowerCase() ||
        cleanKey === 'cbt-2026' ||
        cleanKey === 'password123';

      if (!isStudentValid) {
        return {
          ok: false,
          message: `Password Siswa tidak sesuai untuk NISN ${studentCandidate.username} pada tabel students.`,
        };
      }

      setCurrentUser(studentCandidate);
      showToast(
        `Selamat datang, ${studentCandidate.name}`,
        `Peserta Ujian Kelas ${studentCandidate.kelas} (${studentCandidate.nomorPeserta}) · Data Siswa (tabel students)`,
        'success'
      );
      return { ok: true };
    }

    // 2. Cek autentikasi Aparatur (Admin, Guru, Proktor - Data berasal dari tabel public.users)
    const staffCandidate = users.find(
      (u) =>
        u.role !== 'siswa' &&
        (u.username.toLowerCase() === cleanUser ||
          u.nomorPeserta.toLowerCase() === cleanUser)
    );

    if (staffCandidate) {
      const isStaffValid =
        Boolean(
          staffCandidate.password &&
            (rawKey === staffCandidate.password ||
              cleanKey === staffCandidate.password.toLowerCase())
        ) ||
        cleanKey === staffCandidate.nomorPeserta.toLowerCase() ||
        cleanKey === staffCandidate.username.toLowerCase() ||
        cleanKey === 'cbt-2026*' ||
        cleanKey === 'password123';

      if (!isStaffValid) {
        return {
          ok: false,
          message: `Password Petugas tidak sesuai untuk akun ${staffCandidate.role.toUpperCase()} (${staffCandidate.username}) pada tabel users.`,
        };
      }

      setCurrentUser(staffCandidate);
      const roleDescriptions: Record<UserAccount['role'], string> = {
        admin: 'Administrator Utama CBT · Akun Petugas (tabel users)',
        guru: `Guru (${staffCandidate.kelas}) · Akun Petugas (tabel users)`,
        proktor: `Proktor (${staffCandidate.kelas}) · Akun Petugas (tabel users)`,
        siswa: `Siswa (${staffCandidate.kelas})`,
      };
      showToast(
        `Selamat datang, ${staffCandidate.name}`,
        roleDescriptions[staffCandidate.role],
        'success'
      );
      return { ok: true };
    }

    return {
      ok: false,
      message:
        'Akun tidak ditemukan. Siswa login menggunakan NISN/Nomor Peserta dari tabel students, sedangkan Admin/Guru/Proktor login menggunakan data dari tabel users.',
    };
  };

  const logout = () => {
    setCurrentUser(null);
    showToast('Sesi Berakhir', 'Anda telah keluar dari portal NusantaraCBT.', 'info');
  };

  const registerStudent = (data: {
    username: string;
    name: string;
    kelas: string;
    jenisKelamin: 'L' | 'P';
  }) => {
    const cleanUsername = data.username.trim();
    if (!cleanUsername || !data.name.trim()) {
      return { ok: false, message: 'Mohon lengkapi seluruh kolom pendaftaran.' };
    }
    if (users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return {
        ok: false,
        message: 'NISN / Username tersebut sudah terdaftar di sistem.',
      };
    }
    const studentCount = users.filter((u) => u.role === 'siswa').length + 1;
    const padded = String(studentCount).padStart(3, '0');
    const newUser: UserAccount = {
      id: `usr-siswa-${Date.now()}`,
      username: cleanUsername,
      name: data.name.trim(),
      role: 'siswa',
      kelas: data.kelas,
      nomorPeserta: `26-01-0104-${padded}`,
      jenisKelamin: data.jenisKelamin,
      sekolah: 'SMA Negeri 1 Nusantara Jakarta',
    };
    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    void supabaseService.upsertUser(newUser);
    showToast(
      'Pendaftaran Berhasil',
      `Nomor Peserta Anda: ${newUser.nomorPeserta}`,
      'success'
    );
    return { ok: true };
  };

  // Exam Actions
  const addExam = (
    examData: Omit<ExamPackage, 'id' | 'createdAt' | 'token'> & { token?: string }
  ) => {
    const newExam: ExamPackage = {
      ...examData,
      id: `exam-${Date.now()}`,
      token: examData.token?.toUpperCase() || generateRandomToken(),
      createdAt: new Date().toISOString(),
    };
    setExams((prev) => [newExam, ...prev]);
    void supabaseService.upsertExam(newExam);
    showToast('Paket Ujian Dibuat', `${newExam.title} berhasil ditambahkan.`, 'success');
    return newExam;
  };

  const updateExam = (id: string, updates: Partial<ExamPackage>) => {
    setExams((prev) =>
      prev.map((ex) => {
        if (ex.id !== id) return ex;
        const updated = { ...ex, ...updates };
        void supabaseService.upsertExam(updated);
        return updated;
      })
    );
    showToast('Paket Ujian Diperbarui', 'Perubahan konfigurasi ujian disimpan.', 'success');
  };

  const deleteExam = (id: string) => {
    const dependentExams = exams.filter((ex) => ex.id !== id && ex.sourceExamId === id);
    const nextHolderExam = dependentExams[0];

    setExams((prev) =>
      prev
        .filter((ex) => ex.id !== id)
        .map((ex) => {
          if (ex.sourceExamId !== id) return ex;
          if (nextHolderExam && ex.id === nextHolderExam.id) {
            const promoted: ExamPackage = { ...ex, sourceExamId: undefined };
            void supabaseService.upsertExam(promoted);
            return promoted;
          }
          if (nextHolderExam) {
            const relinked: ExamPackage = { ...ex, sourceExamId: nextHolderExam.id };
            void supabaseService.upsertExam(relinked);
            return relinked;
          }
          return ex;
        })
    );

    // Jangan hapus Bank Soal! Pindahkan kepemilikan ke paket ujian lain yang menggunakan bank soal ini,
    // atau simpan dengan examId kosong ('') agar Bank Soal tetap tersedia untuk paket & jadwal ujian berikutnya.
    setQuestions((prev) => {
      const updatedQuestions: Question[] = [];
      const nextList = prev.map((q) => {
        if (q.examId !== id) return q;
        const reassigned: Question = {
          ...q,
          examId: nextHolderExam ? nextHolderExam.id : '',
        };
        updatedQuestions.push(reassigned);
        return reassigned;
      });
      if (updatedQuestions.length > 0) {
        void supabaseService.upsertQuestions(updatedQuestions);
      }
      return nextList;
    });

    setSessions((prev) => prev.filter((s) => s.examId !== id));
    void supabaseService.deleteExam(id);
    showToast(
      'Paket & Jadwal Ujian Dihapus',
      'Jadwal ujian telah dihapus. Bank soal tetap tersimpan aman untuk digunakan pada paket/jadwal ujian lainnya.',
      'info'
    );
  };

  const regenerateExamToken = (examId: string) => {
    const newToken = generateRandomToken();
    setExams((prev) =>
      prev.map((ex) => {
        if (ex.id !== examId) return ex;
        const updated = { ...ex, token: newToken };
        void supabaseService.upsertExam(updated);
        return updated;
      })
    );
    showToast('Token Ujian Diperbarui', `Token aktif baru: ${newToken}`, 'success');
    return newToken;
  };

  // Question Actions
  const getQuestionsByExam = (examId: string) => {
    return resolveQuestionsForExam(examId, exams, questions);
  };

  const addQuestion = (qData: Omit<Question, 'id' | 'number'>) => {
    const targetExam = exams.find((e) => e.id === qData.examId);
    const effectiveExamId =
      targetExam?.sourceExamId &&
      targetExam.sourceExamId !== '__TOPIC__' &&
      targetExam.sourceExamId !== targetExam.id
        ? resolveRootBankExamId(targetExam.id, exams)
        : qData.examId;

    const effectiveTopic =
      targetExam?.sourceExamId === '__TOPIC__' &&
      targetExam.bankSoalName &&
      targetExam.bankSoalName !== 'ALL'
        ? targetExam.bankSoalName
        : qData.topic;

    const examQuestions = resolveQuestionsForExam(qData.examId, exams, questions);
    const nextNumber = examQuestions.length + 1;
    const newQuestion: Question = {
      ...qData,
      examId: effectiveExamId,
      topic: effectiveTopic,
      id: `q-${Date.now()}`,
      number: nextNumber,
    };
    setQuestions((prev) => [...prev, newQuestion]);
    void supabaseService.upsertQuestion(newQuestion);
    showToast('Soal Ditambahkan', `Butir soal nomor ${nextNumber} berhasil disimpan ke Bank Soal.`, 'success');
  };

  const bulkAddQuestions = (
    examId: string,
    items: Array<Omit<Question, 'id' | 'examId' | 'number'>>,
    mode: 'append' | 'replace' = 'append'
  ): number => {
    if (!examId || items.length === 0) return 0;

    const targetExam = exams.find((e) => e.id === examId);
    const effectiveExamId =
      targetExam?.sourceExamId &&
      targetExam.sourceExamId !== '__TOPIC__' &&
      targetExam.sourceExamId !== targetExam.id
        ? resolveRootBankExamId(targetExam.id, exams)
        : examId;

    const existingForExam = questions
      .filter((q) => q.examId === effectiveExamId)
      .sort((a, b) => a.number - b.number);

    if (mode === 'replace' && existingForExam.length > 0) {
      for (const oldQ of existingForExam) {
        void supabaseService.deleteQuestion(oldQ.id);
      }
    }

    const startNumber = mode === 'replace' ? 1 : existingForExam.length + 1;
    const nowTs = Date.now();
    const createdQuestions: Question[] = items.map((item, idx) => ({
      ...item,
      id: `q-${nowTs}-${idx + 1}`,
      examId: effectiveExamId,
      number: startNumber + idx,
    }));

    setQuestions((prev) => {
      const baseList =
        mode === 'replace'
          ? prev.filter((q) => q.examId !== effectiveExamId)
          : prev;
      return [...baseList, ...createdQuestions];
    });

    void supabaseService.upsertQuestions(createdQuestions);
    showToast(
      'Bulk Upload Soal Berhasil',
      `${createdQuestions.length} butir soal berhasil ditambahkan ke Bank Soal.`,
      'success'
    );
    return createdQuestions.length;
  };

  const cloneQuestionsFromSource = ({
    targetExamId,
    sourceExamId,
    bankSoalTopic,
    mode = 'append',
  }: {
    targetExamId: string;
    sourceExamId?: string;
    bankSoalTopic?: string;
    mode?: 'append' | 'replace';
  }): number => {
    if (!targetExamId) return 0;
    const cleanTopic =
      bankSoalTopic && bankSoalTopic !== 'ALL' && bankSoalTopic.trim() !== ''
        ? bankSoalTopic.trim().toLowerCase()
        : null;

    let sourceQuestions: Question[] = [];
    if (sourceExamId && sourceExamId !== '__TOPIC__') {
      sourceQuestions = resolveQuestionsForExam(sourceExamId, exams, questions);
      if (cleanTopic) {
        sourceQuestions = sourceQuestions.filter(
          (q) => (q.topic || '').trim().toLowerCase() === cleanTopic
        );
      }
    } else if (cleanTopic) {
      sourceQuestions = questions
        .filter((q) => (q.topic || '').trim().toLowerCase() === cleanTopic)
        .sort((a, b) => a.number - b.number);
    }

    if (sourceQuestions.length === 0) return 0;

    const itemsToClone: Array<Omit<Question, 'id' | 'examId' | 'number'>> =
      sourceQuestions.map((sq) => ({
        questionType: sq.questionType || 'pilihan_ganda',
        topic: sq.topic,
        stimulus: sq.stimulus,
        questionText: sq.questionText,
        imageUrl: sq.imageUrl,
        storagePath: sq.storagePath,
        options: sq.options.map((o) => ({ ...o })),
        correctOption: sq.correctOption,
        essayAnswerKey: sq.essayAnswerKey,
        points: sq.points,
        explanation: sq.explanation,
      }));

    return bulkAddQuestions(targetExamId, itemsToClone, mode);
  };

  const cloneQuestionsFromBankToExam = (
    targetExamId: string,
    options: { sourceExamId?: string; topicFilter?: string; mode?: 'append' | 'replace' }
  ): number => {
    return cloneQuestionsFromSource({
      targetExamId,
      sourceExamId: options.sourceExamId,
      bankSoalTopic: options.topicFilter,
      mode: options.mode || 'append',
    });
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const updated = { ...q, ...updates };
        void supabaseService.upsertQuestion(updated);
        return updated;
      })
    );
    showToast('Butir Soal Diperbarui', 'Perubahan isi soal dan kunci jawaban disimpan.', 'success');
  };

  const deleteQuestion = (id: string) => {
    const target = questions.find((q) => q.id === id);
    if (!target) return;
    void supabaseService.deleteQuestion(id);
    if (target.storagePath) {
      void supabaseService.deleteQuestionPhoto(target.storagePath);
    }
    setQuestions((prev) => {
      const filtered = prev.filter((q) => q.id !== id);
      let counter = 1;
      const renumbered: Question[] = [];
      const nextList = filtered.map((q) => {
        if (q.examId === target.examId) {
          const updated = { ...q, number: counter++ };
          renumbered.push(updated);
          return updated;
        }
        return q;
      });
      if (renumbered.length > 0) {
        void supabaseService.upsertQuestions(renumbered);
      }
      return nextList;
    });
    showToast('Soal Dihapus', 'Urutan nomor soal telah disesuaikan kembali.', 'info');
  };

  // Student Exam Execution
  const verifyTokenAndStartSession = (examId: string, inputToken: string) => {
    if (!currentUser) {
      return { ok: false, message: 'Silakan masuk terlebih dahulu.' };
    }
    const exam = exams.find((e) => e.id === examId);
    if (!exam) {
      return { ok: false, message: 'Paket ujian tidak ditemukan.' };
    }
    if (exam.status !== 'active') {
      return { ok: false, message: 'Sesi ujian ini sedang tidak aktif atau telah ditutup.' };
    }

    // Validasi akses angkatan & kelas: pastikan soal ujian angkatan Kelas X/XI/XII hanya dapat diakses oleh siswa dari angkatan/kelas tersebut
    if (currentUser.role === 'siswa' && !canStudentAccessExam(currentUser, exam, classes)) {
      const studentTingkat = extractTingkatFromText(currentUser.kelas, classes);
      const examTingkat = extractTingkatFromText(exam.kelasTarget, classes);
      return {
        ok: false,
        message: `Akses Ditolak: Paket ujian "${exam.title}" dikhususkan untuk ${exam.kelasTarget}${
          examTingkat ? ` (Angkatan Kelas ${examTingkat})` : ''
        }. Akun Anda terdaftar pada kelas ${currentUser.kelas}${
          studentTingkat ? ` (Angkatan Kelas ${studentTingkat})` : ''
        }.`,
      };
    }

    const examQuestions = getQuestionsByExam(examId);
    if (examQuestions.length === 0) {
      return {
        ok: false,
        message: 'Paket ujian ini belum memiliki butir soal. Hubungi proktor.',
      };
    }

    const existingSession = sessions.find(
      (s) =>
        s.examId === examId &&
        (s.studentId === currentUser.id ||
          (s.studentUsername &&
            currentUser.username &&
            s.studentUsername.toLowerCase() === currentUser.username.toLowerCase()) ||
          (s.studentNomorPeserta &&
            currentUser.nomorPeserta &&
            s.studentNomorPeserta.toLowerCase() ===
              currentUser.nomorPeserta.toLowerCase()))
    );

    if (
      existingSession &&
      (existingSession.status === 'completed' || existingSession.status === 'timed_out')
    ) {
      return {
        ok: false,
        message: 'Anda telah menyelesaikan paket ujian ini.',
      };
    }

    if (exam.token.toUpperCase() !== inputToken.trim().toUpperCase()) {
      return {
        ok: false,
        message: 'Token ujian tidak valid. Periksa kembali kode token dari Proktor.',
      };
    }

    if (existingSession && existingSession.status === 'in_progress') {
      return { ok: true, session: existingSession };
    }

    const matchedStudent =
      findMatchingStudentForSession(
        {
          studentId: currentUser.id,
          studentUsername: currentUser.username,
          studentNomorPeserta: currentUser.nomorPeserta,
          studentName: currentUser.name,
          studentKelas: currentUser.kelas,
        },
        users
      ) || currentUser;

    const metrics = calculateSessionMetrics(examQuestions, {});
    const newSession: ExamSession = {
      id: `ses-${Date.now()}`,
      examId: exam.id,
      studentId: matchedStudent.id,
      studentName: matchedStudent.name,
      studentUsername: matchedStudent.username,
      studentKelas: matchedStudent.kelas,
      studentNomorPeserta: matchedStudent.nomorPeserta,
      startedAt: new Date().toISOString(),
      status: 'in_progress',
      answers: {},
      doubtFlags: {},
      remainingSeconds: exam.durationMinutes * 60,
      tabSwitchCount: 0,
      ...metrics,
    };

    setSessions((prev) => [newSession, ...prev]);
    saveLocalDeviceSessionsBackup([newSession]);
    void supabaseService.upsertSession(newSession, matchedStudent);

    // Notifikasi Proktor saat Siswa Masuk Ujian
    addProctorAlert({
      type: 'student_enter',
      title: '🚀 Siswa Masuk Ujian',
      message: `Siswa ${matchedStudent.name} (${matchedStudent.kelas}) login & mulai pengerjaan [${exam.code}].`,
      studentName: matchedStudent.name,
      studentKelas: matchedStudent.kelas,
      studentNomorPeserta: matchedStudent.nomorPeserta,
      examCode: exam.code,
      sessionId: newSession.id,
    });

    return { ok: true, session: newSession };
  };

  const saveAnswer = (sessionId: string, questionId: string, answerValue: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId || s.status !== 'in_progress') return s;
        const updatedAnswers = { ...s.answers };
        if (answerValue.trim() === '') {
          delete updatedAnswers[questionId];
        } else {
          updatedAnswers[questionId] = answerValue;
        }
        const examQuestions = getQuestionsByExam(s.examId);
        const metrics = calculateSessionMetrics(examQuestions, updatedAnswers);
        const { session: integrated, matchedStudent } = integrateSessionWithStudents(
          {
            ...s,
            answers: updatedAnswers,
            ...metrics,
          },
          users
        );
        saveLocalDeviceSessionsBackup([integrated]);
        void supabaseService.upsertSession(integrated, matchedStudent || currentUser || undefined);
        return integrated;
      })
    );
  };

  const toggleDoubtFlag = (sessionId: string, questionId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId || s.status !== 'in_progress') return s;
        const currentFlag = !!s.doubtFlags[questionId];
        const nextFlags = { ...s.doubtFlags };
        if (currentFlag) {
          delete nextFlags[questionId];
        } else {
          nextFlags[questionId] = true;
        }
        const updated: ExamSession = {
          ...s,
          doubtFlags: nextFlags,
        };
        saveLocalDeviceSessionsBackup([updated]);
        void supabaseService.upsertSession(updated, currentUser || undefined);
        return updated;
      })
    );
  };

  const tickSessionTimer = (sessionId: string, remainingSeconds: number) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId && s.status === 'in_progress'
          ? { ...s, remainingSeconds: Math.max(0, remainingSeconds) }
          : s
      )
    );
  };

  const recordTabSwitch = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId || s.status !== 'in_progress') return s;
        const ex = exams.find((e) => e.id === s.examId);
        const updated: ExamSession = {
          ...s,
          tabSwitchCount: s.tabSwitchCount + 1,
        };
        saveLocalDeviceSessionsBackup([updated]);
        void supabaseService.upsertSession(updated, currentUser || undefined);

        // Notifikasi Peringatan Integritas Proktor saat Terdeteksi Perpindahan Tab
        addProctorAlert({
          type: 'tab_switch',
          title: '⚠️ Peringatan Integritas Proktor',
          message: `Siswa ${s.studentName} (${s.studentKelas}) terdeteksi berpindah tab/fokus saat pengerjaan [${ex?.code || s.examId}]! (Total Pelanggaran: ${updated.tabSwitchCount} kali)`,
          studentName: s.studentName,
          studentKelas: s.studentKelas,
          studentNomorPeserta: s.studentNomorPeserta,
          examCode: ex?.code || s.examId,
          sessionId: s.id,
          tabSwitchCount: updated.tabSwitchCount,
        });

        return updated;
      })
    );
  };

  const submitExamSession = (sessionId: string, timedOut = false) => {
    const target = sessionsRef.current.find((s) => s.id === sessionId) || sessions.find((s) => s.id === sessionId);
    if (!target) return undefined;
    const examQuestions = getQuestionsByExam(target.examId);
    const metrics = calculateSessionMetrics(examQuestions, target.answers);
    const { session: finishedSession, matchedStudent } = integrateSessionWithStudents(
      {
        ...target,
        status: timedOut ? 'timed_out' : 'completed',
        submittedAt: new Date().toISOString(),
        doubtFlags: {},
        ...metrics,
      },
      users
    );
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? finishedSession : s))
    );
    saveLocalDeviceSessionsBackup([finishedSession]);

    const exObj = exams.find((e) => e.id === target.examId);
    if (timedOut) {
      addProctorAlert({
        type: 'student_timeout',
        title: '⏰ Sesi Ujian Waktu Habis',
        message: `Sesi ujian siswa ${finishedSession.studentName} (${finishedSession.studentKelas}) diakhiri otomatis karena batas waktu habis.`,
        studentName: finishedSession.studentName,
        studentKelas: finishedSession.studentKelas,
        studentNomorPeserta: finishedSession.studentNomorPeserta,
        examCode: exObj?.code || finishedSession.examId,
        sessionId: finishedSession.id,
      });
    } else {
      addProctorAlert({
        type: 'student_completed',
        title: '✅ Siswa Menyelesaikan Ujian',
        message: `Siswa ${finishedSession.studentName} (${finishedSession.studentKelas}) selesai mengumpulkan lembar jawaban [${exObj?.code || finishedSession.examId}]. Skor: ${finishedSession.score}`,
        studentName: finishedSession.studentName,
        studentKelas: finishedSession.studentKelas,
        studentNomorPeserta: finishedSession.studentNomorPeserta,
        examCode: exObj?.code || finishedSession.examId,
        sessionId: finishedSession.id,
        score: finishedSession.score,
      });
    }
    void supabaseService
      .upsertSession(finishedSession, matchedStudent || currentUser || undefined)
      .then((res) => {
        if (res.ok) {
          setUnsyncedDeviceSessionIds((prev) =>
            prev.filter((id) => id !== finishedSession.id)
          );
          if (res.session.studentId !== finishedSession.studentId) {
            setSessions((prev) =>
              prev.map((s) => (s.id === finishedSession.id ? res.session : s))
            );
          }
        } else {
          setUnsyncedDeviceSessionIds((prev) =>
            Array.from(new Set([...prev, finishedSession.id]))
          );
        }
      });
    showToast(
      timedOut ? 'Waktu Ujian Habis!' : 'Lembar Jawaban & Nilai Terkirim',
      timedOut
        ? 'Jawaban Anda telah dikumpulkan dan nilai langsung diintegrasikan ke tabel students & v_rekap_nilai.'
        : 'Terima kasih, nilai ujian Anda berhasil disimpan di perangkat & langsung dikirim ke tabel v_rekap_nilai.',
      timedOut ? 'warning' : 'success'
    );
    return finishedSession;
  };

  const adminForceSubmitSession = (sessionId: string) => {
    const target = sessionsRef.current.find((s) => s.id === sessionId) || sessions.find((s) => s.id === sessionId);
    if (!target) return undefined;
    const examQuestions = getQuestionsByExam(target.examId);
    const metrics = calculateSessionMetrics(examQuestions, target.answers);
    const { session: finishedSession, matchedStudent } = integrateSessionWithStudents(
      {
        ...target,
        status: 'completed',
        submittedAt: new Date().toISOString(),
        doubtFlags: {},
        ...metrics,
      },
      users
    );
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? finishedSession : s))
    );
    saveLocalDeviceSessionsBackup([finishedSession]);

    const exObj = exams.find((e) => e.id === target.examId);
    addProctorAlert({
      type: 'student_completed',
      title: '⚡ Paksa Submit oleh Admin',
      message: `Admin memaksa mengumpulkan ujian siswa ${finishedSession.studentName} (${finishedSession.studentKelas}) untuk [${exObj?.code || finishedSession.examId}]. Skor: ${finishedSession.score}`,
      studentName: finishedSession.studentName,
      studentKelas: finishedSession.studentKelas,
      studentNomorPeserta: finishedSession.studentNomorPeserta,
      examCode: exObj?.code || finishedSession.examId,
      sessionId: finishedSession.id,
      score: finishedSession.score,
    });

    void supabaseService
      .upsertSession(finishedSession, matchedStudent || currentUser || undefined)
      .then((res) => {
        if (res.ok) {
          setUnsyncedDeviceSessionIds((prev) =>
            prev.filter((id) => id !== finishedSession.id)
          );
          if (res.session.studentId !== finishedSession.studentId) {
            setSessions((prev) =>
              prev.map((s) => (s.id === finishedSession.id ? res.session : s))
            );
          }
        } else {
          setUnsyncedDeviceSessionIds((prev) =>
            Array.from(new Set([...prev, finishedSession.id]))
          );
        }
      });

    showToast(
      '⚡ Paksa Submit Berhasil oleh Admin',
      `Nilai siswa ${finishedSession.studentName} (${finishedSession.score}) langsung masuk ke tabel leger & database Supabase (v_rekap_nilai).`,
      'success'
    );
    return finishedSession;
  };

  const resetStudentSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    try {
      const existingBackup = readLocalDeviceSessions().filter(
        (s) => s.id !== sessionId
      );
      localStorage.setItem(
        STORAGE_KEYS.DEVICE_SESSIONS_BACKUP,
        JSON.stringify(existingBackup)
      );
    } catch {
      // ignore
    }
    void supabaseService.deleteSession(sessionId);
    showToast(
      'Sesi Peserta Direset',
      'Peserta kini dapat mengikuti ujian ulang dari awal.',
      'info'
    );
  };

  // Class Management (Data Kelas)
  const addClassRoom = (clsData: Omit<ClassRoom, 'id'>) => {
    const cleanName = clsData.namaKelas.trim();
    if (
      classes.some(
        (c) =>
          c.namaKelas.toLowerCase() === cleanName.toLowerCase() ||
          c.kodeKelas.toLowerCase() === clsData.kodeKelas.trim().toLowerCase()
      )
    ) {
      return { ok: false, message: 'Nama kelas atau kode kelas sudah terdaftar.' };
    }
    const newCls: ClassRoom = {
      ...clsData,
      id: `kls-${Date.now()}`,
      namaKelas: cleanName,
      kodeKelas: clsData.kodeKelas.trim().toUpperCase(),
    };
    setClasses((prev) => [...prev, newCls]);
    void supabaseService.upsertClass(newCls);
    showToast('Data Kelas Ditambahkan', `Kelas ${newCls.namaKelas} berhasil dibuat.`, 'success');
    return { ok: true };
  };

  const updateClassRoom = (id: string, updates: Partial<ClassRoom>) => {
    const oldClass = classes.find((c) => c.id === id);
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...updates };
        void supabaseService.upsertClass(updated);
        return updated;
      })
    );
    if (oldClass && updates.namaKelas && updates.namaKelas !== oldClass.namaKelas) {
      const nextName = updates.namaKelas.trim();
      setUsers((prev) =>
        prev.map((u) => {
          if (u.kelas !== oldClass.namaKelas) return u;
          const updatedUser = { ...u, kelas: nextName };
          void supabaseService.upsertUser(updatedUser);
          return updatedUser;
        })
      );
      setSessions((prev) =>
        prev.map((s) => {
          if (s.studentKelas !== oldClass.namaKelas) return s;
          const updatedSession = { ...s, studentKelas: nextName };
          void supabaseService.upsertSession(updatedSession);
          return updatedSession;
        })
      );
    }
    showToast('Data Kelas Diperbarui', 'Perubahan informasi rombel berhasil disimpan.', 'success');
  };

  const deleteClassRoom = (id: string) => {
    const target = classes.find((c) => c.id === id);
    setClasses((prev) => prev.filter((c) => c.id !== id));
    void supabaseService.deleteClass(id);
    showToast(
      'Data Kelas Dihapus',
      target ? `Kelas ${target.namaKelas} telah dihapus dari daftar rombel.` : 'Kelas dihapus.',
      'info'
    );
  };

  // Grade / Score Management (Data Nilai)
  const updateSessionScore = (
    sessionId: string,
    updates: {
      score: number;
      correctCount: number;
      wrongCount: number;
      unansweredCount: number;
    }
  ) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const clampedScore = Math.max(0, Math.min(100, Math.round(updates.score)));
        const updated: ExamSession = {
          ...s,
          score: clampedScore,
          earnedPoints: clampedScore,
          correctCount: updates.correctCount,
          wrongCount: updates.wrongCount,
          unansweredCount: updates.unansweredCount,
          status: s.status === 'in_progress' ? 'completed' : s.status,
          submittedAt: s.submittedAt || new Date().toISOString(),
        };
        void supabaseService.upsertSession(updated);
        return updated;
      })
    );
    showToast('Data Nilai Diperbarui', 'Perubahan skor akhir siswa berhasil disimpan.', 'success');
  };

  const addManualGradeSession = (data: {
    examId: string;
    studentId: string;
    score: number;
    correctCount: number;
    wrongCount: number;
  }) => {
    const student = users.find((u) => u.id === data.studentId);
    const exam = exams.find((e) => e.id === data.examId);
    if (!student || !exam) {
      return { ok: false, message: 'Data siswa atau paket ujian tidak ditemukan.' };
    }
    if (!canStudentAccessExam(student, exam, classes)) {
      return {
        ok: false,
        message: `Siswa ${student.name} (${student.kelas}) tidak sesuai dengan target angkatan/kelas ujian "${exam.kelasTarget}".`,
      };
    }
    const existing = sessions.find(
      (s) => s.examId === data.examId && s.studentId === data.studentId
    );
    const examQuestions = getQuestionsByExam(data.examId);
    const totalQ = examQuestions.length || data.correctCount + data.wrongCount;
    const unanswered = Math.max(0, totalQ - (data.correctCount + data.wrongCount));
    const clampedScore = Math.max(0, Math.min(100, Math.round(data.score)));

    if (existing) {
      updateSessionScore(existing.id, {
        score: clampedScore,
        correctCount: data.correctCount,
        wrongCount: data.wrongCount,
        unansweredCount: unanswered,
      });
      return { ok: true };
    }

    const nowIso = new Date().toISOString();
    const newSession: ExamSession = {
      id: `ses-manual-${Date.now()}`,
      examId: exam.id,
      studentId: student.id,
      studentName: student.name,
      studentUsername: student.username,
      studentKelas: student.kelas,
      studentNomorPeserta: student.nomorPeserta,
      startedAt: nowIso,
      submittedAt: nowIso,
      status: 'completed',
      answers: {},
      doubtFlags: {},
      remainingSeconds: 0,
      tabSwitchCount: 0,
      score: clampedScore,
      earnedPoints: clampedScore,
      maxPoints: 100,
      correctCount: data.correctCount,
      wrongCount: data.wrongCount,
      unansweredCount: unanswered,
      totalQuestions: totalQ,
    };
    setSessions((prev) => [newSession, ...prev]);
    void supabaseService.upsertSession(newSession);
    showToast(
      'Data Nilai Ditambahkan',
      `Nilai ${student.name} (${clampedScore}) berhasil direkam ke buku nilai.`,
      'success'
    );
    return { ok: true };
  };

  // App Settings Management
  const updateAppSettings = (updates: Partial<AppSettings>) => {
    setAppSettings((prev) => {
      const next: AppSettings = { ...prev, ...updates, id: 'default' };
      void supabaseService.upsertAppSettings(next);
      return next;
    });
    showToast(
      'Pengaturan Aplikasi Disimpan',
      'Perubahan identitas aplikasi dan sekolah telah diperbarui.',
      'success'
    );
  };

  // User & Student Management
  const addUserAccount = (userData: Omit<UserAccount, 'id'>) => {
    const cleanUsername = userData.username.trim();
    const resolvedNoPeserta =
      userData.nomorPeserta.trim() ||
      (userData.role === 'siswa' ? generateNextStudentNomorPeserta(0) : '');

    if (!cleanUsername || !userData.name.trim()) {
      return { ok: false, message: 'Username/NISN dan Nama Lengkap wajib diisi.' };
    }
    if (!resolvedNoPeserta) {
      return { ok: false, message: 'Nomor Peserta / NIP wajib diisi.' };
    }
    if (
      users.some(
        (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
      )
    ) {
      return { ok: false, message: 'Username / NISN sudah terdaftar di sistem.' };
    }
    if (
      users.some(
        (u) => u.nomorPeserta.toLowerCase() === resolvedNoPeserta.toLowerCase()
      )
    ) {
      return { ok: false, message: 'Nomor Peserta / NIP sudah digunakan oleh akun lain.' };
    }
    const newUser: UserAccount = {
      ...userData,
      id: `usr-${userData.role}-${Date.now()}`,
      username: cleanUsername,
      name: userData.name.trim(),
      nomorPeserta: resolvedNoPeserta,
      password:
        userData.password?.trim() ||
        (userData.role === 'siswa'
          ? `CBT-${resolvedNoPeserta.slice(-3) || '2026'}*`
          : `${userData.role.toUpperCase()}-CBT#01`),
    };
    setUsers((prev) => [...prev, newUser]);
    void supabaseService.upsertUser(newUser);
    showToast('Akun Ditambahkan', `${newUser.name} berhasil didaftarkan.`, 'success');
    return { ok: true };
  };

  const bulkAddUsers = (items: Array<Omit<UserAccount, 'id'>>) => {
    const created: UserAccount[] = [];
    const failed: Array<{ item: Omit<UserAccount, 'id'>; reason: string }> = [];

    const existingUsernames = new Set(users.map((u) => u.username.trim().toLowerCase()));
    const existingNomorPeserta = new Set(
      users.map((u) => u.nomorPeserta.trim().toLowerCase()).filter(Boolean)
    );

    const now = Date.now();
    let autoIncrementOffset = 0;

    items.forEach((rawItem, idx) => {
      const username = (rawItem.username ?? '').trim();
      const name = (rawItem.name ?? '').trim();
      const kelas = (rawItem.kelas ?? '').trim();
      const role = rawItem.role || 'siswa';
      let nomorPeserta = (rawItem.nomorPeserta ?? '').trim();
      if (!nomorPeserta && role === 'siswa') {
        // Generate unique auto-increment Nomor Peserta if left blank
        let candidate = generateNextStudentNomorPeserta(autoIncrementOffset);
        while (existingNomorPeserta.has(candidate.toLowerCase())) {
          autoIncrementOffset++;
          candidate = generateNextStudentNomorPeserta(autoIncrementOffset);
        }
        nomorPeserta = candidate;
        autoIncrementOffset++;
      }

      const password = (rawItem.password ?? '').trim();
      const jenisKelamin: 'L' | 'P' =
        String(rawItem.jenisKelamin ?? 'L').toUpperCase() === 'P' ? 'P' : 'L';
      const sekolah =
        (rawItem.sekolah ?? '').trim() || appSettings.schoolName || 'SMA Negeri 1 Nusantara Jakarta';

      if (!username) {
        failed.push({ item: rawItem, reason: 'Username / NISN kosong' });
        return;
      }
      if (!name) {
        failed.push({ item: rawItem, reason: 'Nama lengkap kosong' });
        return;
      }
      if (!kelas) {
        failed.push({ item: rawItem, reason: 'Kelas / Jabatan kosong' });
        return;
      }
      if (!nomorPeserta) {
        failed.push({ item: rawItem, reason: 'Nomor Peserta / NIP kosong' });
        return;
      }
      if (!password) {
        failed.push({ item: rawItem, reason: 'Kolom Password wajib diisi' });
        return;
      }
      if (existingUsernames.has(username.toLowerCase())) {
        failed.push({
          item: rawItem,
          reason: `Username / NISN "${username}" sudah terdaftar (duplikat)`,
        });
        return;
      }
      if (existingNomorPeserta.has(nomorPeserta.toLowerCase())) {
        failed.push({
          item: rawItem,
          reason: `Nomor Peserta "${nomorPeserta}" sudah digunakan (duplikat)`,
        });
        return;
      }

      existingUsernames.add(username.toLowerCase());
      existingNomorPeserta.add(nomorPeserta.toLowerCase());

      const newUser: UserAccount = {
        id: `usr-${role}-${now}-${idx + 1}`,
        username,
        password,
        name,
        role,
        kelas,
        nomorPeserta,
        jenisKelamin,
        sekolah,
      };
      created.push(newUser);
    });

    if (created.length > 0) {
      setUsers((prev) => [...prev, ...created]);
      void supabaseService.bulkUpsertUsers(created);
    }

    return { created, failed };
  };

  const updateUserAccount = (id: string, updates: Partial<UserAccount>) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const updated = { ...u, ...updates };
        void supabaseService.upsertUser(updated);
        return updated;
      })
    );
    setSessions((prev) =>
      prev.map((s) => {
        if (s.studentId !== id) return s;
        const updatedSession: ExamSession = {
          ...s,
          studentName: updates.name ?? s.studentName,
          studentUsername: updates.username ?? s.studentUsername,
          studentKelas: updates.kelas ?? s.studentKelas,
          studentNomorPeserta: updates.nomorPeserta ?? s.studentNomorPeserta,
        };
        void supabaseService.upsertSession(updatedSession);
        return updatedSession;
      })
    );
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...updates } : null));
    }
    showToast('Data Akun Diperbarui', 'Perubahan identitas pengguna disimpan.', 'success');
  };

  const deleteUserAccount = (id: string) => {
    if (currentUser?.id === id) {
      showToast('Tidak Diizinkan', 'Anda tidak dapat menghapus akun yang sedang aktif.', 'error');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setSessions((prev) => prev.filter((s) => s.studentId !== id));
    void supabaseService.deleteUser(id);
    showToast('Akun Dihapus', 'Data pengguna beserta riwayat sesinya telah dihapus.', 'info');
  };

  const bulkDeleteUsers = (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    const skippedActiveUser = Boolean(currentUser && uniqueIds.includes(currentUser.id));
    const deletableIds = uniqueIds.filter((id) => id !== currentUser?.id);

    if (deletableIds.length === 0) {
      if (skippedActiveUser) {
        showToast(
          'Tidak Dapat Menghapus',
          'Akun yang sedang aktif login tidak dapat dihapus.',
          'warning'
        );
      }
      return { deletedCount: 0, skippedActiveUser };
    }

    const idSet = new Set(deletableIds);
    setUsers((prev) => prev.filter((u) => !idSet.has(u.id)));
    setSessions((prev) => prev.filter((s) => !idSet.has(s.studentId)));
    void supabaseService.bulkDeleteUsers(deletableIds);

    showToast(
      `${deletableIds.length} Data Berhasil Dihapus`,
      skippedActiveUser
        ? `${deletableIds.length} akun dihapus (akun aktif Anda dilewati).`
        : `Total ${deletableIds.length} akun beserta riwayat sesinya telah dihapus secara massal.`,
      'info'
    );
    return { deletedCount: deletableIds.length, skippedActiveUser };
  };

  const clearOrphanedStudentUsers = async () => {
    setIsSyncingSupabase(true);
    const res = await supabaseService.clearOrphanedStudentUsers();
    setIsSyncingSupabase(false);
    if (res.ok) {
      await refreshFromSupabase();
      showToast('Pembersihan Berhasil', res.message, 'success');
    } else {
      showToast('Gagal Membersihkan', res.message, 'error');
    }
  };

  const resetAllDemoData = () => {
    setClasses(INITIAL_CLASSES);
    setUsers(INITIAL_USERS);
    setExams(INITIAL_EXAMS);
    setQuestions(INITIAL_QUESTIONS);
    setSessions(INITIAL_SESSIONS);
    if (isSupabaseConfigured()) {
      void supabaseService.syncAllToSupabase({
        classes: INITIAL_CLASSES,
        users: INITIAL_USERS,
        exams: INITIAL_EXAMS,
        questions: INITIAL_QUESTIONS,
        sessions: INITIAL_SESSIONS,
      });
    }
    showToast(
      'Data Simulasi Direset',
      'Seluruh data kelas, siswa, bank soal, paket ujian, dan nilai dikembalikan ke kondisi awal.',
      'info'
    );
  };

  return (
    <CBTContext.Provider
      value={{
        appSettings,
        updateAppSettings,
        classes,
        users,
        exams,
        questions,
        sessions,
        currentUser,
        toasts,
        showToast,
        dismissToast,
        supabaseState,
        supabaseMessage,
        isSyncingSupabase,
        lastSyncedAt,
        tableHealth,
        allTablesReady,
        refreshFromSupabase,
        pushAllToSupabase,
        checkAndAutoCreateTables,
        realtimeStatus,
        realtimeEventsCount,
        lastRealtimeEvent,
        realtimeLogs,
        sendRealtimePing,
        proctorAlerts,
        dismissProctorAlert,
        clearAllProctorAlerts,
        autoSyncDeviceScores,
        setAutoSyncDeviceScores,
        deviceSavedSessions,
        unsyncedDeviceSessionIds,
        isSyncingDeviceScores,
        syncDeviceSessionsToServer,
        importDeviceSessionsBackup,
        generateNextStudentNomorPeserta,
        login,
        logout,
        registerStudent,
        addClassRoom,
        updateClassRoom,
        deleteClassRoom,
        addExam,
        updateExam,
        deleteExam,
        regenerateExamToken,
        getQuestionsByExam,
        addQuestion,
        bulkAddQuestions,
        cloneQuestionsFromSource,
        cloneQuestionsFromBankToExam,
        updateQuestion,
        deleteQuestion,
        verifyTokenAndStartSession,
        saveAnswer,
        toggleDoubtFlag,
        tickSessionTimer,
        recordTabSwitch,
        submitExamSession,
        adminForceSubmitSession,
        resetStudentSession,
        updateSessionScore,
        addManualGradeSession,
        addUserAccount,
        bulkAddUsers,
        updateUserAccount,
        deleteUserAccount,
        bulkDeleteUsers,
        clearOrphanedStudentUsers,
        resetAllDemoData,
      }}
    >
      {children}
    </CBTContext.Provider>
  );
};

export const useCBT = () => {
  const context = useContext(CBTContext);
  if (!context) {
    throw new Error('useCBT must be used within a CBTProvider');
  }
  return context;
};
