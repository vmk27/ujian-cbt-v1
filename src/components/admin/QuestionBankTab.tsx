import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Plus,
  Upload,
  FileSpreadsheet,
  FileCode,
  ClipboardPaste,
  Edit3,
  Trash2,
  Image as ImageIcon,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Download,
  X,
  Search,
  Sparkles,
  Loader2,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useCBT } from '../../context/CBTContext';
import {
  buildExamBankSoalFolder,
  supabaseService,
} from '../../lib/supabase';
import { OptionLetter, Question, QuestionType } from '../../types/cbt';
import {
  RichTextContent,
  RichTextEditor,
  stripHtmlToPlainText,
} from '../common/RichTextEditor';

interface QuestionBankTabProps {
  selectedExamId: string;
  onSelectExamId: (examId: string) => void;
}

interface ParsedBulkQuestion {
  tempId: string;
  questionType: QuestionType;
  topic: string;
  stimulus?: string;
  questionText: string;
  optA: string;
  optB: string;
  optC: string;
  optD: string;
  optE: string;
  correctOption: OptionLetter;
  essayAnswerKey?: string;
  points: number;
  explanation: string;
  imageUrl?: string;
  storagePath?: string;
  isUploadingPhoto?: boolean;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
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

function normalizeOptionLetter(raw?: string): OptionLetter {
  const cleaned = (raw || 'A').trim().toUpperCase();
  if (
    cleaned === 'A' ||
    cleaned === 'B' ||
    cleaned === 'C' ||
    cleaned === 'D' ||
    cleaned === 'E'
  ) {
    return cleaned;
  }
  return 'A';
}

export const QuestionBankTab: React.FC<QuestionBankTabProps> = ({
  selectedExamId,
  onSelectExamId,
}) => {
  const {
    currentUser,
    exams,
    getQuestionsByExam,
    addQuestion,
    bulkAddQuestions,
    updateQuestion,
    deleteQuestion,
    updateExam,
    showToast,
  } = useCBT();

  const activeExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || exams[0],
    [exams, selectedExamId]
  );

  const currentExamQuestions = useMemo(
    () => (activeExam ? getQuestionsByExam(activeExam.id) : []),
    [activeExam, getQuestionsByExam]
  );

  // Filter & Search State
  const [selectedBankTopic, setSelectedBankTopic] = useState<string>('ALL');
  const [selectedQuestionType, setSelectedQuestionType] = useState<
    'ALL' | QuestionType
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewLightboxUrl, setPreviewLightboxUrl] = useState<string | null>(
    null
  );

  // Single Question Modal (Rich Text + Photo Upload)
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isUploadingSinglePhoto, setIsUploadingSinglePhoto] = useState(false);
  const [singleUploadFeedback, setSingleUploadFeedback] = useState<
    string | null
  >(null);
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick photo upload on existing question card
  const [quickUploadQuestionId, setQuickUploadQuestionId] = useState<
    string | null
  >(null);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);

  const [qForm, setQForm] = useState({
    questionType: 'pilihan_ganda' as QuestionType,
    topic: '',
    stimulus: '',
    questionText: '',
    imageUrl: '',
    storagePath: '',
    optA: '',
    optB: '',
    optC: '',
    optD: '',
    optE: '',
    correctOption: 'A' as OptionLetter,
    essayAnswerKey: '',
    points: 10,
    explanation: '',
  });

  // Bulk Upload Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkInputTab, setBulkInputTab] = useState<'csv' | 'paste' | 'json'>(
    'csv'
  );
  const [defaultBankSoalName, setDefaultBankSoalName] = useState<string>(
    'Bank Soal Utama'
  );
  const [bulkImportMode, setBulkImportMode] = useState<'append' | 'replace'>(
    'append'
  );
  const [rawBulkText, setRawBulkText] = useState<string>('');
  const [parsedBulkItems, setParsedBulkItems] = useState<ParsedBulkQuestion[]>(
    []
  );
  const [bulkParseError, setBulkParseError] = useState<string | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);

  // Unique Bank Soal / Topics inside this Exam Package
  const bankTopics = useMemo(() => {
    const set = new Set<string>();
    for (const q of currentExamQuestions) {
      if (q.topic?.trim()) set.add(q.topic.trim());
    }
    return Array.from(set);
  }, [currentExamQuestions]);

  const filteredQuestions = useMemo(() => {
    return currentExamQuestions.filter((q) => {
      if (selectedBankTopic !== 'ALL' && q.topic !== selectedBankTopic) {
        return false;
      }
      const qType: QuestionType =
        q.questionType === 'esai' ? 'esai' : 'pilihan_ganda';
      if (selectedQuestionType !== 'ALL' && qType !== selectedQuestionType) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const kw = searchQuery.toLowerCase();
      const plainStem = stripHtmlToPlainText(q.questionText).toLowerCase();
      const plainStimulus = stripHtmlToPlainText(q.stimulus).toLowerCase();
      return (
        q.topic.toLowerCase().includes(kw) ||
        plainStem.includes(kw) ||
        plainStimulus.includes(kw) ||
        String(q.number).includes(kw)
      );
    });
  }, [currentExamQuestions, selectedBankTopic, selectedQuestionType, searchQuery]);

  // Compute live target folder in bucket 'app-file'
  const activeModalFolderPath = useMemo(() => {
    const examCode = activeExam?.code || 'paket-ujian';
    const bankName =
      qForm.topic.trim() ||
      (selectedBankTopic !== 'ALL' ? selectedBankTopic : 'bank-soal-umum');
    return buildExamBankSoalFolder({
      examCode,
      examTitle: activeExam?.title,
      bankSoalName: bankName,
    });
  }, [activeExam, qForm.topic, selectedBankTopic]);

  const activeBulkFolderPath = useMemo(() => {
    const examCode = activeExam?.code || 'paket-ujian';
    return buildExamBankSoalFolder({
      examCode,
      examTitle: activeExam?.title,
      bankSoalName: defaultBankSoalName || 'bank-soal-utama',
    });
  }, [activeExam, defaultBankSoalName]);

  // Handlers for Create / Edit Question Modal
  const openCreateQuestionModal = () => {
    setEditingQuestion(null);
    setSingleUploadFeedback(null);
    setQForm({
      questionType:
        selectedQuestionType !== 'ALL' ? selectedQuestionType : 'pilihan_ganda',
      topic:
        selectedBankTopic !== 'ALL'
          ? selectedBankTopic
          : bankTopics[0] || `${activeExam?.subject || 'Umum'} - Paket A`,
      stimulus: '',
      questionText: '',
      imageUrl: '',
      storagePath: '',
      optA: '',
      optB: '',
      optC: '',
      optD: '',
      optE: '',
      correctOption: 'A',
      essayAnswerKey: '',
      points: 10,
      explanation: '',
    });
    setQuestionModalOpen(true);
  };

  const openEditQuestionModal = (q: Question) => {
    setEditingQuestion(q);
    setSingleUploadFeedback(
      q.storagePath ? `Tersimpan di: ${q.storagePath}` : null
    );
    setQForm({
      questionType: q.questionType === 'esai' ? 'esai' : 'pilihan_ganda',
      topic: q.topic,
      stimulus: q.stimulus || '',
      questionText: q.questionText,
      imageUrl: q.imageUrl || '',
      storagePath: q.storagePath || '',
      optA: q.options.find((o) => o.id === 'A')?.text || '',
      optB: q.options.find((o) => o.id === 'B')?.text || '',
      optC: q.options.find((o) => o.id === 'C')?.text || '',
      optD: q.options.find((o) => o.id === 'D')?.text || '',
      optE: q.options.find((o) => o.id === 'E')?.text || '',
      correctOption: q.correctOption,
      essayAnswerKey: q.essayAnswerKey || '',
      points: q.points,
      explanation: q.explanation,
    });
    setQuestionModalOpen(true);
  };

  const handleUploadPhotoInModal = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeExam) return;

    if (!file.type.startsWith('image/')) {
      showToast(
        'Format Berkas Tidak Valid',
        'Harap pilih dokumen berupa foto/gambar (JPG, PNG, WEBP, GIF, SVG).',
        'error'
      );
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showToast(
        'Ukuran Foto Terlalu Besar',
        'Ukuran maksimal dokumen foto soal adalah 8 MB.',
        'error'
      );
      return;
    }

    setIsUploadingSinglePhoto(true);
    setSingleUploadFeedback(null);

    try {
      const bankSoalFolder =
        qForm.topic.trim() || `${activeExam.subject} Umum`;
      const res = await supabaseService.uploadQuestionPhoto(file, {
        examCode: activeExam.code,
        examTitle: activeExam.title,
        bankSoalName: bankSoalFolder,
        userId: currentUser?.authUserId || currentUser?.id,
      });

      if (res.ok) {
        setQForm((prev) => ({
          ...prev,
          imageUrl: res.url,
          storagePath: res.storagePath,
        }));
        setSingleUploadFeedback(res.message);
        showToast('Dokumen Foto Diunggah', res.message, 'success');
      }
    } catch (err) {
      showToast(
        'Gagal Mengunggah Foto',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat upload.',
        'error'
      );
    } finally {
      setIsUploadingSinglePhoto(false);
      if (singleFileInputRef.current) {
        singleFileInputRef.current.value = '';
      }
    }
  };

  const handleQuickPhotoUploadForCard = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeExam || !quickUploadQuestionId) return;

    const targetQ = currentExamQuestions.find(
      (q) => q.id === quickUploadQuestionId
    );
    if (!targetQ) return;

    if (!file.type.startsWith('image/')) {
      showToast(
        'Format Berkas Tidak Valid',
        'Harap pilih dokumen berupa foto/gambar (JPG, PNG, WEBP).',
        'error'
      );
      return;
    }

    try {
      const res = await supabaseService.uploadQuestionPhoto(file, {
        examCode: activeExam.code,
        examTitle: activeExam.title,
        bankSoalName: targetQ.topic || activeExam.subject,
        userId: currentUser?.authUserId || currentUser?.id,
      });

      if (res.ok) {
        updateQuestion(targetQ.id, {
          imageUrl: res.url,
          storagePath: res.storagePath,
        });
        showToast(
          `Foto Soal #${targetQ.number} Tersimpan`,
          res.message,
          'success'
        );
      }
    } finally {
      setQuickUploadQuestionId(null);
      if (quickFileInputRef.current) {
        quickFileInputRef.current.value = '';
      }
    }
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExam) return;

    const plainStem = stripHtmlToPlainText(qForm.questionText);
    if (!plainStem && !qForm.imageUrl) {
      showToast(
        'Pertanyaan Kosong',
        'Harap isi teks pertanyaan pokok atau lampirkan foto soal.',
        'warning'
      );
      return;
    }

    const isEssay = qForm.questionType === 'esai';
    const options = isEssay
      ? []
      : [
          { id: 'A' as OptionLetter, text: qForm.optA || 'Opsi A' },
          { id: 'B' as OptionLetter, text: qForm.optB || 'Opsi B' },
          { id: 'C' as OptionLetter, text: qForm.optC || 'Opsi C' },
          { id: 'D' as OptionLetter, text: qForm.optD || 'Opsi D' },
          { id: 'E' as OptionLetter, text: qForm.optE || 'Opsi E' },
        ];

    const cleanStimulus = stripHtmlToPlainText(qForm.stimulus)
      ? qForm.stimulus
      : undefined;

    if (editingQuestion) {
      updateQuestion(editingQuestion.id, {
        questionType: qForm.questionType,
        topic: qForm.topic.trim() || 'Umum',
        stimulus: cleanStimulus,
        questionText: qForm.questionText,
        imageUrl: qForm.imageUrl || undefined,
        storagePath: qForm.storagePath || undefined,
        options,
        correctOption: qForm.correctOption,
        essayAnswerKey: isEssay ? qForm.essayAnswerKey.trim() : undefined,
        points: Number(qForm.points) || 10,
        explanation: qForm.explanation,
      });
    } else {
      addQuestion({
        examId: activeExam.id,
        questionType: qForm.questionType,
        topic: qForm.topic.trim() || 'Umum',
        stimulus: cleanStimulus,
        questionText: qForm.questionText,
        imageUrl: qForm.imageUrl || undefined,
        storagePath: qForm.storagePath || undefined,
        options,
        correctOption: qForm.correctOption,
        essayAnswerKey: isEssay ? qForm.essayAnswerKey.trim() : undefined,
        points: Number(qForm.points) || 10,
        explanation: qForm.explanation,
      });
    }
    setQuestionModalOpen(false);
  };

  // ============================================================================
  // BULK UPLOAD SOAL LOGIC (CSV / TSV / JSON / STRUCTURED TEXT + PHOTO PER ROW)
  // ============================================================================

  const openBulkUploadModal = () => {
    setBulkParseError(null);
    setDefaultBankSoalName(
      selectedBankTopic !== 'ALL'
        ? selectedBankTopic
        : bankTopics[0] || `Bank Soal ${activeExam?.subject || 'Utama'}`
    );
    setParsedBulkItems([]);
    setRawBulkText('');
    setBulkModalOpen(true);
  };

  const parseBulkContent = (content: string, modeHint?: 'csv' | 'json') => {
    setBulkParseError(null);
    const trimmed = content.trim();
    if (!trimmed) {
      setBulkParseError('Data input masih kosong. Pilih file atau tempelkan daftar soal.');
      return;
    }

    const fallbackTopic =
      defaultBankSoalName.trim() ||
      `Bank Soal ${activeExam?.subject || 'Utama'}`;

    try {
      // 1. Try JSON parsing if it starts with '[' or modeHint === 'json'
      if (modeHint === 'json' || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
          throw new Error('Format JSON harus berupa Array objek soal ([...]).');
        }
        const results: ParsedBulkQuestion[] = parsed
          .map((item: Record<string, unknown>, idx: number) => {
            const optsArray = Array.isArray(item.options)
              ? (item.options as Array<{ id?: string; text?: string }>)
              : [];
            const findOpt = (letter: string, altKeys: string[]) => {
              const fromArr = optsArray.find(
                (o) => String(o.id || '').toUpperCase() === letter
              )?.text;
              if (fromArr) return String(fromArr);
              for (const k of altKeys) {
                if (item[k] !== undefined && item[k] !== null) {
                  return String(item[k]);
                }
              }
              return '';
            };

            const qText = String(
              item.questionText ||
                item.question_text ||
                item.pertanyaan ||
                item.soal ||
                ''
            ).trim();
            if (!qText) return null;

            const rawType = String(
              item.questionType ||
                item.question_type ||
                item.jenis_soal ||
                item.tipe ||
                'pilihan_ganda'
            ).toLowerCase();
            const qType: QuestionType =
              rawType === 'esai' || rawType === 'essay' || rawType === 'uraian'
                ? 'esai'
                : 'pilihan_ganda';

            return {
              tempId: `bulk-json-${Date.now()}-${idx}`,
              questionType: qType,
              topic:
                String(
                  item.topic || item.topik || item.bank_soal || fallbackTopic
                ).trim() || fallbackTopic,
              stimulus: item.stimulus
                ? String(item.stimulus)
                : item.wacana
                ? String(item.wacana)
                : undefined,
              questionText: qText,
              optA: findOpt('A', ['optA', 'opsi_a', 'a', 'A']) || 'Opsi A',
              optB: findOpt('B', ['optB', 'opsi_b', 'b', 'B']) || 'Opsi B',
              optC: findOpt('C', ['optC', 'opsi_c', 'c', 'C']) || 'Opsi C',
              optD: findOpt('D', ['optD', 'opsi_d', 'd', 'D']) || 'Opsi D',
              optE: findOpt('E', ['optE', 'opsi_e', 'e', 'E']) || 'Opsi E',
              correctOption: normalizeOptionLetter(
                String(
                  item.correctOption ||
                    item.correct_option ||
                    item.kunci ||
                    item.jawaban ||
                    'A'
                )
              ),
              essayAnswerKey:
                qType === 'esai'
                  ? String(
                      item.essayAnswerKey ||
                        item.essay_answer_key ||
                        item.kunci ||
                        item.jawaban ||
                        ''
                    )
                  : undefined,
              points: Number(item.points ?? item.poin ?? item.bobot ?? 10) || 10,
              explanation: String(
                item.explanation || item.pembahasan || 'Pembahasan sesuai kunci jawaban.'
              ),
              imageUrl: item.imageUrl
                ? String(item.imageUrl)
                : item.image_url
                ? String(item.image_url)
                : undefined,
            };
          })
          .filter(Boolean) as ParsedBulkQuestion[];

        if (results.length === 0) {
          throw new Error('Tidak ditemukan butir soal yang valid di dalam JSON.');
        }
        setParsedBulkItems(results);
        return;
      }

      // 2. Parse CSV / TSV / Semicolon delimited rows
      const lines = trimmed
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        throw new Error('Tidak ada baris data yang dapat dibaca.');
      }

      // Auto-detect delimiter: Tab (\t), Semicolon (;), or Comma (,)
      const firstLine = lines[0];
      const delimiter = firstLine.includes('\t')
        ? '\t'
        : firstLine.split(';').length > firstLine.split(',').length
        ? ';'
        : ',';

      const firstCols = parseCsvLine(firstLine, delimiter).map((c) =>
        c.toLowerCase().replace(/[^a-z0-9_]/g, '')
      );

      const isHeaderRow =
        firstCols.includes('pertanyaan') ||
        firstCols.includes('question_text') ||
        firstCols.includes('questiontext') ||
        firstCols.includes('soal') ||
        firstCols.includes('opsi_a') ||
        firstCols.includes('kunci');

      const dataLines = isHeaderRow ? lines.slice(1) : lines;

      // Map column indices if header exists, otherwise use standard positional order:
      // [0] topik, [1] stimulus, [2] pertanyaan, [3] opsi_a, [4] opsi_b, [5] opsi_c, [6] opsi_d, [7] opsi_e, [8] kunci, [9] poin, [10] pembahasan, [11] image_url
      const findColIndex = (candidates: string[], fallbackIdx: number) => {
        if (!isHeaderRow) return fallbackIdx;
        const idx = firstCols.findIndex((col) => candidates.includes(col));
        return idx >= 0 ? idx : -1;
      };

      const idxTopic = findColIndex(['topik', 'topic', 'bank_soal', 'banksoal', 'kd'], 0);
      const idxStimulus = findColIndex(['stimulus', 'wacana', 'bacaan'], 1);
      const idxQuestion = findColIndex(
        ['pertanyaan', 'soal', 'question_text', 'questiontext', 'question'],
        2
      );
      const idxA = findColIndex(['opsi_a', 'opsia', 'a', 'pilihan_a'], 3);
      const idxB = findColIndex(['opsi_b', 'opsib', 'b', 'pilihan_b'], 4);
      const idxC = findColIndex(['opsi_c', 'opsic', 'c', 'pilihan_c'], 5);
      const idxD = findColIndex(['opsi_d', 'opsid', 'd', 'pilihan_d'], 6);
      const idxE = findColIndex(['opsi_e', 'opsie', 'e', 'pilihan_e'], 7);
      const idxKey = findColIndex(
        ['kunci', 'jawaban', 'correct_option', 'correctoption', 'key'],
        8
      );
      const idxPoints = findColIndex(['poin', 'bobot', 'points', 'skor'], 9);
      const idxExplanation = findColIndex(
        ['pembahasan', 'explanation', 'penjelasan'],
        10
      );
      const idxImage = findColIndex(['image_url', 'imageurl', 'foto', 'gambar'], 11);
      const idxType = findColIndex(['jenis_soal', 'jenissoal', 'question_type', 'tipe'], -1);

      const results: ParsedBulkQuestion[] = [];
      for (let i = 0; i < dataLines.length; i++) {
        const cols = parseCsvLine(dataLines[i], delimiter);
        if (cols.length < 4) continue;

        // Handle short 8-column format (pertanyaan, A, B, C, D, E, kunci, pembahasan) when no header
        if (!isHeaderRow && cols.length >= 6 && cols.length <= 9) {
          const [qText, a, b, c, d, e, key, exp] = cols;
          if (!qText) continue;
          results.push({
            tempId: `bulk-row-${Date.now()}-${i}`,
            questionType: 'pilihan_ganda',
            topic: fallbackTopic,
            questionText: qText,
            optA: a || 'Opsi A',
            optB: b || 'Opsi B',
            optC: c || 'Opsi C',
            optD: d || 'Opsi D',
            optE: e || 'Opsi E',
            correctOption: normalizeOptionLetter(key),
            points: 10,
            explanation: exp || 'Pembahasan sesuai kunci jawaban.',
          });
          continue;
        }

        const qText =
          (idxQuestion >= 0 ? cols[idxQuestion] : cols[2]) || cols[0] || '';
        if (!qText.trim()) continue;

        const topicVal =
          (idxTopic >= 0 ? cols[idxTopic] : '')?.trim() || fallbackTopic;
        const stimulusVal =
          idxStimulus >= 0 ? cols[idxStimulus]?.trim() : undefined;
        const rawType = idxType >= 0 ? (cols[idxType] || '').trim().toLowerCase() : '';
        const qType: QuestionType =
          rawType === 'esai' || rawType === 'essay' || rawType === 'uraian'
            ? 'esai'
            : 'pilihan_ganda';
        const rawKeyVal = (idxKey >= 0 ? cols[idxKey] : cols[8]) || '';

        results.push({
          tempId: `bulk-csv-${Date.now()}-${i}`,
          questionType: qType,
          topic: topicVal,
          stimulus: stimulusVal || undefined,
          questionText: qText.trim(),
          optA: (idxA >= 0 ? cols[idxA] : cols[3]) || 'Opsi A',
          optB: (idxB >= 0 ? cols[idxB] : cols[4]) || 'Opsi B',
          optC: (idxC >= 0 ? cols[idxC] : cols[5]) || 'Opsi C',
          optD: (idxD >= 0 ? cols[idxD] : cols[6]) || 'Opsi D',
          optE: (idxE >= 0 ? cols[idxE] : cols[7]) || 'Opsi E',
          correctOption: normalizeOptionLetter(rawKeyVal),
          essayAnswerKey: qType === 'esai' ? rawKeyVal.trim() : undefined,
          points: Number(idxPoints >= 0 ? cols[idxPoints] : cols[9]) || 10,
          explanation:
            (idxExplanation >= 0 ? cols[idxExplanation] : cols[10]) ||
            'Pembahasan sesuai kunci jawaban.',
          imageUrl:
            idxImage >= 0 && cols[idxImage]?.trim()
              ? cols[idxImage].trim()
              : undefined,
        });
      }

      if (results.length === 0) {
        throw new Error(
          'Tidak ditemukan baris soal yang valid. Pastikan kolom dipisahkan dengan koma (,), titik koma (;), atau Tab.'
        );
      }

      setParsedBulkItems(results);
    } catch (err) {
      setBulkParseError(
        err instanceof Error
          ? err.message
          : 'Gagal memproses format berkas soal.'
      );
    }
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isJson = file.name.toLowerCase().endsWith('.json');
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setRawBulkText(text);
      parseBulkContent(text, isJson ? 'json' : 'csv');
    };
    reader.readAsText(file);
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = '';
    }
  };

  const handleUploadPhotoForBulkRow = async (
    tempId: string,
    file: File | undefined
  ) => {
    if (!file || !activeExam) return;
    if (!file.type.startsWith('image/')) {
      showToast(
        'Format Tidak Didukung',
        'Pilih dokumen berupa foto/gambar (JPG, PNG, WEBP).',
        'error'
      );
      return;
    }

    const rowItem = parsedBulkItems.find((item) => item.tempId === tempId);
    if (!rowItem) return;

    setParsedBulkItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId ? { ...item, isUploadingPhoto: true } : item
      )
    );

    try {
      const res = await supabaseService.uploadQuestionPhoto(file, {
        examCode: activeExam.code,
        examTitle: activeExam.title,
        bankSoalName: rowItem.topic || defaultBankSoalName,
        userId: currentUser?.authUserId || currentUser?.id,
      });

      setParsedBulkItems((prev) =>
        prev.map((item) =>
          item.tempId === tempId
            ? {
                ...item,
                imageUrl: res.url,
                storagePath: res.storagePath,
                isUploadingPhoto: false,
              }
            : item
        )
      );
      showToast('Foto Soal Bulk Diunggah', res.message, 'success');
    } catch {
      setParsedBulkItems((prev) =>
        prev.map((item) =>
          item.tempId === tempId ? { ...item, isUploadingPhoto: false } : item
        )
      );
    }
  };

  const handleDownloadCsvTemplate = () => {
    const examSubj = activeExam?.subject || 'Matematika';
    const sampleRows = [
      [
        'topik',
        'stimulus',
        'pertanyaan',
        'opsi_a',
        'opsi_b',
        'opsi_c',
        'opsi_d',
        'opsi_e',
        'kunci',
        'poin',
        'pembahasan',
      ],
      [
        `${examSubj} - Analisis Konsep`,
        'Perhatikan data eksperimen laboratorium berikut sebelum menjawab soal.',
        'Berdasarkan hasil pengamatan, faktor utama yang memengaruhi laju perubahan variabel terikat adalah <b>konsentrasi awal</b> dan suhu reaksi. Pernyataan yang tepat adalah...',
        'Laju berbanding lurus dengan konsentrasi reaktan',
        'Laju berbanding terbalik dengan suhu mutlak',
        'Katalis mengubah entalpi reaksi secara permanen',
        'Energi aktivasi meningkat saat katalis ditambahkan',
        'Konsentrasi tidak memengaruhi frekuensi tumbukan',
        'A',
        '10',
        'Peningkatan konsentrasi memperbesar jumlah partikel per satuan volume sehingga frekuensi tumbukan efektif meningkat.',
      ],
      [
        `${examSubj} - Penalaran Kuantitatif`,
        '',
        'Jika fungsi kuadrat didefinisikan sebagai f(x) = 2x<sup>2</sup> - 8x + 6, maka nilai minimum fungsi tersebut dicapai pada titik puncak...',
        '(2, -2)',
        '(2, 4)',
        '(-2, -2)',
        '(4, -2)',
        '(1, 0)',
        'A',
        '10',
        'Sumbu simetri x = -b/(2a) = 8/(4) = 2. Nilai minimum f(2) = 2(4) - 16 + 6 = -2. Jadi titik baliknya (2, -2).',
      ],
    ];

    const csvContent = sampleRows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template_bulk_soal_${activeExam?.code.toLowerCase() || 'cbt'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJsonTemplate = () => {
    const examSubj = activeExam?.subject || 'Sains';
    const sampleJson = [
      {
        topic: `${examSubj} - Paket Utama`,
        stimulus:
          'Bacalah kutipan studi kasus berikut dengan saksama.',
        questionText:
          'Manakah pernyataan di bawah ini yang <b>paling tepat</b> menjelaskan hubungan antara energi kinetik dan kecepatan benda?',
        optA: 'Berbanding lurus dengan kuadrat kecepatan (v²)',
        optB: 'Berbanding terbalik dengan massa benda',
        optC: 'Tidak bergantung pada kerangka acuan gerak',
        optD: 'Selalu bernilai negatif pada gerak diperlambat',
        optE: 'Sama dengan momentum linear dibagi waktu',
        correctOption: 'A',
        points: 10,
        explanation:
          'Rumus energi kinetik adalah Ek = ½ m·v², sehingga Ek sebanding dengan kuadrat kecepatan (v²).',
      },
    ];

    const blob = new Blob([JSON.stringify(sampleJson, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template_bulk_soal_${activeExam?.code.toLowerCase() || 'cbt'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadSampleBulkData = () => {
    const subj = activeExam?.subject || 'Penalaran Akademik';
    const bank = defaultBankSoalName.trim() || `Bank Soal ${subj}`;
    const sampleItems: ParsedBulkQuestion[] = [
      {
        tempId: `sample-1-${Date.now()}`,
        questionType: 'pilihan_ganda',
        topic: bank,
        stimulus:
          'Sebuah benda bermassa <b>m = 4 kg</b> mula-mula diam di atas bidang datar licin, kemudian ditarik gaya mendatar konstan sebesar <b>F = 20 N</b> selama 6 detik.',
        questionText:
          'Berapakah besar kecepatan akhir benda dan usaha (<i>W</i>) yang dilakukan oleh gaya tersebut selama 6 detik?',
        optA: 'v = 30 m/s dan W = 1.800 Joule',
        optB: 'v = 24 m/s dan W = 1.200 Joule',
        optC: 'v = 15 m/s dan W = 900 Joule',
        optD: 'v = 30 m/s dan W = 900 Joule',
        optE: 'v = 20 m/s dan W = 1.600 Joule',
        correctOption: 'A',
        points: 10,
        explanation:
          'Percepatan a = F/m = 20/4 = 5 m/s². Kecepatan akhir v = a·t = 5 × 6 = 30 m/s. Usaha W = ΔEk = ½ m·v² = ½ (4)(30²) = 1.800 Joule.',
      },
      {
        tempId: `sample-2-${Date.now()}`,
        questionType: 'pilihan_ganda',
        topic: bank,
        stimulus: '',
        questionText:
          'Dalam reaksi kesetimbangan gas: <b>N<sub>2</sub>(g) + 3H<sub>2</sub>(g) ⇌ 2NH<sub>3</sub>(g)</b> dengan ΔH = -92 kJ/mol. Perlakuan yang akan menggeser kesetimbangan ke arah pembentukan amonia (NH<sub>3</sub>) adalah...',
        optA: 'Menurunkan suhu dan memperbesar tekanan sistem',
        optB: 'Menaikkan suhu dan memperkecil tekanan sistem',
        optC: 'Menurunkan suhu dan memperbesar volume ruang',
        optD: 'Menambahkan katalis besi untuk menggeser arah reaksi',
        optE: 'Mengurangi konsentrasi gas hidrogen (H₂)',
        correctOption: 'A',
        points: 10,
        explanation:
          'Reaksi bersifat eksoterm (ΔH negatif) dan jumlah koefisien gas kanan (2) lebih kecil dari kiri (4). Sesuai asas Le Chatelier, penurunan suhu dan peningkatan tekanan menggeser kesetimbangan ke kanan (NH₃).',
      },
      {
        tempId: `sample-3-${Date.now()}`,
        questionType: 'esai',
        topic: bank,
        stimulus: '',
        questionText:
          'Diketahui matriks <b>A</b> memiliki determinan det(A) = 4 dan matriks <b>B</b> berukuran 2×2 memiliki det(B) = 3. Hitunglah nilai dari <b>det(2A · B<sup>T</sup>)</b>!',
        optA: '48',
        optB: '24',
        optC: '12',
        optD: '36',
        optE: '96',
        correctOption: 'A',
        essayAnswerKey: '48',
        points: 15,
        explanation:
          'Untuk matriks ordo 2×2, det(k·A) = k²·det(A). Maka det(2A · Bᵀ) = 2² × det(A) × det(B) = 4 × 4 × 3 = 48.',
      },
    ];
    setParsedBulkItems(sampleItems);
    setBulkParseError(null);
  };

  const handleConfirmBulkImport = () => {
    if (!activeExam || parsedBulkItems.length === 0) return;

    const formatted = parsedBulkItems.map((item) => ({
      questionType: item.questionType,
      topic: item.topic.trim() || defaultBankSoalName.trim() || 'Umum',
      stimulus: item.stimulus?.trim() || undefined,
      questionText: item.questionText,
      imageUrl: item.imageUrl,
      storagePath: item.storagePath,
      options:
        item.questionType === 'esai'
          ? []
          : [
              { id: 'A' as OptionLetter, text: item.optA },
              { id: 'B' as OptionLetter, text: item.optB },
              { id: 'C' as OptionLetter, text: item.optC },
              { id: 'D' as OptionLetter, text: item.optD },
              { id: 'E' as OptionLetter, text: item.optE },
            ],
      correctOption: item.correctOption,
      essayAnswerKey:
        item.questionType === 'esai' ? item.essayAnswerKey?.trim() : undefined,
      points: Number(item.points) || 10,
      explanation: item.explanation,
    }));

    bulkAddQuestions(activeExam.id, formatted, bulkImportMode);
    setBulkModalOpen(false);
    setParsedBulkItems([]);
  };

  const questionsWithPhotosCount = currentExamQuestions.filter((q) =>
    Boolean(q.imageUrl)
  ).length;
  const multipleChoiceCount = currentExamQuestions.filter(
    (q) => q.questionType !== 'esai'
  ).length;
  const essayCount = currentExamQuestions.filter(
    (q) => q.questionType === 'esai'
  ).length;

  return (
    <div className="space-y-5">
      {/* Hidden input for 1-click quick photo attachment on existing question cards */}
      <input
        ref={quickFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleQuickPhotoUploadForCard}
      />

      {/* Top Filter, Paket Ujian Selector, Auto-Folder Info & Action Buttons */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Paket Ujian Aktif
              </label>
              <select
                value={activeExam?.id || ''}
                onChange={(e) => {
                  onSelectExamId(e.target.value);
                  setSelectedBankTopic('ALL');
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    [{ex.code}] {ex.title} ({getQuestionsByExam(ex.id).length}{' '}
                    Soal)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Filter Kelompok Bank Soal / Topik
              </label>
              <select
                value={selectedBankTopic}
                onChange={(e) => setSelectedBankTopic(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">
                  Semua Bank Soal ({currentExamQuestions.length} Butir)
                </option>
                {bankTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Jenis Soal
              </label>
              <select
                value={selectedQuestionType}
                onChange={(e) =>
                  setSelectedQuestionType(
                    e.target.value as 'ALL' | QuestionType
                  )
                }
                className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">
                  Semua Jenis ({currentExamQuestions.length})
                </option>
                <option value="pilihan_ganda">
                  Pilihan Ganda ({multipleChoiceCount})
                </option>
                <option value="esai">Esai / Uraian ({essayCount})</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Cari Isi Soal / Nomor
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik kata kunci pertanyaan atau topik..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
              title="Unduh Format Template CSV untuk Bulk Upload Soal"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Template CSV</span>
            </button>

            <button
              type="button"
              onClick={openBulkUploadModal}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer whitespace-nowrap transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Upload Soal</span>
            </button>

            <button
              type="button"
              onClick={openCreateQuestionModal}
              className="px-4 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer whitespace-nowrap transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Butir Soal</span>
            </button>
          </div>
        </div>

        {/* Supabase Storage Auto-Folder & Pembahasan Soal Status Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Folder Bucket Supabase (<strong>app-file</strong>):
              </span>
              <code className="font-mono text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                app-file/{activeModalFolderPath}/
              </code>
            </div>

            {/* Quick Toggle Pengaturan Pembahasan Soal */}
            {activeExam && (
              <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-slate-200">
                <span className="text-slate-500 font-medium">Akses Pembahasan Siswa:</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !activeExam.showExplanationAfterSubmit;
                    updateExam(activeExam.id, { showExplanationAfterSubmit: next });
                    showToast(
                      next ? 'Pembahasan Soal Diaktifkan' : 'Pembahasan Soal Dinonaktifkan',
                      `Akses kunci & pembahasan paket [${activeExam.code}] berhasil ${
                        next ? 'dibuka untuk siswa' : 'ditutup/dikunci'
                      }.`,
                      next ? 'success' : 'info'
                    );
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    activeExam.showExplanationAfterSubmit
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  }`}
                  title="Klik untuk mengubah akses pembahasan soal setelah siswa mengakhiri ujian"
                >
                  {activeExam.showExplanationAfterSubmit ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Pembahasan: AKTIF (Buka)</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Pembahasan: NONAKTIF (Kunci)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-slate-500 font-mono text-[11px] tabular-nums">
            <span>Total: {currentExamQuestions.length} Soal</span>
            <span>·</span>
            <span className="text-blue-700 font-semibold">
              PG: {multipleChoiceCount}
            </span>
            <span>·</span>
            <span className="text-purple-700 font-semibold">
              Esai: {essayCount}
            </span>
            <span>·</span>
            <span>Dengan Foto: {questionsWithPhotosCount} Soal</span>
          </div>
        </div>
      </div>

      {/* Question Cards List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-base font-bold text-slate-800">
            Belum Ada Butir Soal yang Sesuai
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Gunakan tombol <strong>Tambah Butir Soal</strong> (dengan Rich Text
            Editor & Upload Foto) atau <strong>Bulk Upload Soal</strong> untuk
            mengimpor banyak soal sekaligus ke paket ujian ini.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={openBulkUploadModal}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Mulai Bulk Upload Soal</span>
            </button>
            <button
              type="button"
              onClick={openCreateQuestionModal}
              className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Soal Baru</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q) => (
            <div
              key={q.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4"
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-bold tabular-nums">
                    SOAL #{q.number}
                  </span>
                  {q.questionType === 'esai' ? (
                    <span className="px-2.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 font-bold uppercase text-[10px] tracking-wider">
                      Esai / Uraian
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase text-[10px] tracking-wider">
                      Pilihan Ganda
                    </span>
                  )}
                  <span className="font-semibold text-slate-800">{q.topic}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    Bobot: <strong>{q.points} Poin</strong>
                  </span>
                  <span className="text-slate-300">·</span>
                  {q.questionType === 'esai' ? (
                    <span className="font-mono font-bold text-purple-700">
                      Kunci Esai: {q.essayAnswerKey || 'Koreksi Manual / Pedoman'}
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-emerald-700">
                      Kunci: {q.correctOption}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickUploadQuestionId(q.id);
                      quickFileInputRef.current?.click();
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    title="Unggah atau ganti dokumen foto soal ke bucket app-file"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{q.imageUrl ? 'Ganti Foto' : 'Upload Foto'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditQuestionModal(q)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5 shrink-0" />
                    <span>Edit Soal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteQuestion(q.id)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600 cursor-pointer shrink-0"
                    title="Hapus Soal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stimulus / Wacana (Rich Text) */}
              {q.stimulus && (
                <div className="p-3.5 rounded-lg bg-[#F7F6F2] border border-slate-200 border-l-4 border-l-blue-600 text-xs text-slate-700">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-blue-700 mb-1">
                    Wacana / Stimulus:
                  </div>
                  <RichTextContent content={q.stimulus} />
                </div>
              )}

              {/* Attached Question Photo from Supabase Bucket */}
              {q.imageUrl && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5 font-mono">
                      <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {q.storagePath ||
                          `app-file/${buildExamBankSoalFolder({
                            examCode: activeExam?.code || 'ujian',
                            bankSoalName: q.topic,
                          })}/foto-soal.jpg`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewLightboxUrl(q.imageUrl || null)}
                        className="text-blue-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Perbesar Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (q.storagePath) {
                            void supabaseService.deleteQuestionPhoto(
                              q.storagePath
                            );
                          }
                          updateQuestion(q.id, {
                            imageUrl: undefined,
                            storagePath: undefined,
                          });
                        }}
                        className="text-red-600 hover:underline font-semibold cursor-pointer"
                      >
                        Hapus Foto
                      </button>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-hidden rounded-lg border border-slate-200 bg-white flex items-center justify-center p-2">
                    <img
                      src={q.imageUrl}
                      alt={`Dokumen Foto Soal Nomor ${q.number}`}
                      referrerPolicy="no-referrer"
                      onClick={() => setPreviewLightboxUrl(q.imageUrl || null)}
                      className="max-h-56 w-auto object-contain rounded cursor-zoom-in"
                    />
                  </div>
                </div>
              )}

              {/* Question Stem (Rich Text) */}
              <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                <RichTextContent content={q.questionText} />
              </div>

              {/* Multiple Choice Options A - E OR Essay Answer Key */}
              {q.questionType === 'esai' ? (
                <div className="p-3.5 rounded-lg bg-purple-50/60 border border-purple-200 text-xs text-purple-900 space-y-1">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-purple-700">
                    Pedoman / Kunci Jawaban Soal Esai:
                  </div>
                  <div className="font-mono font-semibold text-slate-800">
                    {q.essayAnswerKey ||
                      'Jawaban uraian terbuka (dinilai berdasarkan pembahasan di bawah)'}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {q.options.map((opt) => {
                    const isCorrect = opt.id === q.correctOption;
                    return (
                      <div
                        key={opt.id}
                        className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900'
                            : 'bg-slate-50/60 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded font-mono font-bold text-[11px] flex items-center justify-center shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <div className="flex-1">
                          <RichTextContent content={opt.text} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Explanation (Rich Text) */}
              {q.explanation && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <strong className="text-slate-800 block mb-0.5">
                    Pembahasan Kunci:
                  </strong>
                  <RichTextContent content={q.explanation} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ==================== MODAL 1: CREATE / EDIT QUESTION (RICH TEXT & SUPABASE PHOTO UPLOAD) ==================== */}
      {questionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingQuestion
                    ? `Edit Butir Soal #${editingQuestion.number} (Rich Text & Dokumen Foto)`
                    : 'Tambah Butir Soal Baru (Rich Text & Dokumen Foto)'}
                </h3>
                <p className="text-xs text-slate-500">
                  Paket Ujian: <strong>[{activeExam?.code}] {activeExam?.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuestionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveQuestion}
              className="p-6 overflow-y-auto space-y-5 text-xs"
            >
              {/* Pilihan Jenis Soal (Pilihan Ganda atau Esai) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold uppercase text-slate-700">
                  Pilih Jenis Butir Soal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setQForm({ ...qForm, questionType: 'pilihan_ganda' })
                    }
                    className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer flex items-start gap-3 ${
                      qForm.questionType === 'pilihan_ganda'
                        ? 'border-blue-600 bg-blue-50/70'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        qForm.questionType === 'pilihan_ganda'
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {qForm.questionType === 'pilihan_ganda' && (
                        <span className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        Pilihan Ganda (Opsi A s.d. E)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Siswa memilih satu jawaban benar dari 5 pilihan opsi A, B, C, D, atau E.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQForm({ ...qForm, questionType: 'esai' })}
                    className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer flex items-start gap-3 ${
                      qForm.questionType === 'esai'
                        ? 'border-purple-600 bg-purple-50/70'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        qForm.questionType === 'esai'
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {qForm.questionType === 'esai' && (
                        <span className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        Soal Esai / Uraian
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Siswa mengetikkan jawaban isian/uraian secara langsung pada lembar ujian.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bank Soal / Topik & Points */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Nama Bank Soal / Topik Kompetensi Dasar
                  </label>
                  <input
                    type="text"
                    required
                    list="existing-bank-topics"
                    value={qForm.topic}
                    onChange={(e) =>
                      setQForm({ ...qForm, topic: e.target.value })
                    }
                    placeholder="Contoh: Kalkulus Integral / Hukum Newton"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <datalist id="existing-bank-topics">
                    {bankTopics.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Bobot Poin
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step="0.5"
                    required
                    value={qForm.points}
                    onChange={(e) =>
                      setQForm({ ...qForm, points: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              {/* Supabase Storage Photo Upload Card (Bucket app-file with auto folder per Paket Ujian & Bank Soal) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      <span>
                        Upload Dokumen Foto Soal (Bucket Supabase: app-file)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>Folder otomatis:</span>
                      <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-blue-700">
                        app-file/{activeModalFolderPath}/
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={singleFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadPhotoInModal}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingSinglePhoto}
                      onClick={() => singleFileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {isUploadingSinglePhoto ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengunggah ke Bucket...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {qForm.imageUrl
                              ? 'Ganti Dokumen Foto'
                              : 'Pilih & Upload Foto'}
                          </span>
                        </>
                      )}
                    </button>

                    {qForm.imageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          if (qForm.storagePath) {
                            void supabaseService.deleteQuestionPhoto(
                              qForm.storagePath
                            );
                          }
                          setQForm((prev) => ({
                            ...prev,
                            imageUrl: '',
                            storagePath: '',
                          }));
                          setSingleUploadFeedback(null);
                        }}
                        className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs cursor-pointer"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>
                </div>

                {singleUploadFeedback && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{singleUploadFeedback}</span>
                  </div>
                )}

                {qForm.imageUrl && (
                  <div className="p-3 rounded-lg bg-white border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={qForm.imageUrl}
                      alt="Pratinjau Foto Soal"
                      referrerPolicy="no-referrer"
                      className="max-h-40 w-auto object-contain rounded border border-slate-200"
                    />
                    <div className="flex-1 min-w-0 space-y-1 text-[11px] text-slate-600">
                      <div className="font-bold text-slate-800">
                        Dokumen Foto Terlampir pada Butir Soal
                      </div>
                      {qForm.storagePath && (
                        <div className="font-mono text-slate-500 break-all">
                          Path Storage: {qForm.storagePath}
                        </div>
                      )}
                      <div className="text-slate-400">
                        Foto ini akan ditampilkan secara otomatis kepada siswa
                        di lembar ujian CBT.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Rich Text Editor: Wacana / Stimulus */}
              <RichTextEditor
                label="Wacana / Stimulus Bacaan (Opsional - Rich Text)"
                helperText="Mendukung cetak tebal, miring, daftar, pangkat/subskrip, & simbol ilmiah"
                value={qForm.stimulus}
                onChange={(html) => setQForm({ ...qForm, stimulus: html })}
                placeholder="Masukkan pengantar kasus, wacana bacaan, atau tabel teks bila diperlukan..."
                minHeight="90px"
              />

              {/* Rich Text Editor: Pertanyaan Utama */}
              <RichTextEditor
                label="Pertanyaan Utama / Pokok Soal (Rich Text Editor)"
                helperText="Gunakan toolbar untuk memformat rumus, pangkat (x²), subskrip (H₂O), atau penekanan kata"
                value={qForm.questionText}
                onChange={(html) => setQForm({ ...qForm, questionText: html })}
                placeholder="Tuliskan isi pertanyaan pokok dengan jelas..."
                minHeight="130px"
              />

              {/* Pilihan Jawaban A s.d. E OR Kunci Jawaban Esai */}
              {qForm.questionType === 'pilihan_ganda' ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block font-bold uppercase text-slate-600">
                      Pilihan Jawaban (A s.d. E) — Klik Huruf untuk Menetapkan
                      Kunci
                    </label>
                    <span className="text-[11px] font-mono font-bold text-emerald-700">
                      Kunci Saat Ini: Opsi {qForm.correctOption}
                    </span>
                  </div>
                  {(['A', 'B', 'C', 'D', 'E'] as OptionLetter[]).map(
                    (letter) => {
                      const fieldKey = `opt${letter}` as
                        | 'optA'
                        | 'optB'
                        | 'optC'
                        | 'optD'
                        | 'optE';
                      const isKey = qForm.correctOption === letter;
                      return (
                        <div key={letter} className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setQForm({ ...qForm, correctOption: letter })
                            }
                            title={`Jadikan Opsi ${letter} sebagai Kunci Jawaban`}
                            className={`w-8 h-8 rounded-lg font-mono font-bold flex items-center justify-center shrink-0 border transition-colors cursor-pointer ${
                              isKey
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {letter}
                          </button>
                          <input
                            type="text"
                            required={qForm.questionType === 'pilihan_ganda'}
                            value={qForm[fieldKey]}
                            onChange={(e) =>
                              setQForm({ ...qForm, [fieldKey]: e.target.value })
                            }
                            placeholder={`Teks pilihan jawaban ${letter} (mendukung tag seperti <sup>2</sup> atau <sub>2</sub>)...`}
                            className={`flex-1 px-3 py-2 rounded-lg border ${
                              isKey
                                ? 'bg-emerald-50/40 border-emerald-300 font-semibold text-slate-900'
                                : 'bg-slate-50 border-slate-300 text-slate-800'
                            }`}
                          />
                        </div>
                      );
                    }
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2">
                  <label className="block font-bold uppercase text-purple-900">
                    Kunci Jawaban / Kata Kunci Esai (Untuk Koreksi Otomatis & Pedoman Skor)
                  </label>
                  <textarea
                    rows={3}
                    value={qForm.essayAnswerKey}
                    onChange={(e) =>
                      setQForm({ ...qForm, essayAnswerKey: e.target.value })
                    }
                    placeholder="Contoh: 48 (atau tuliskan kata kunci / pedoman jawaban esai yang diharapkan)..."
                    className="w-full px-3 py-2 rounded-lg bg-white border border-purple-300 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                  <p className="text-[11px] text-purple-700">
                    Jika diisi jawaban singkat/kata kunci, sistem CBT akan mencocokkan jawaban siswa secara otomatis (case-insensitive).
                  </p>
                </div>
              )}

              {/* Kunci Jawaban & Rich Text Pembahasan */}
              <div className="space-y-4 pt-1">
                {qForm.questionType === 'pilihan_ganda' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-bold uppercase text-slate-600 mb-1">
                        Kunci Jawaban Benar
                      </label>
                      <select
                        value={qForm.correctOption}
                        onChange={(e) =>
                          setQForm({
                            ...qForm,
                            correctOption: e.target.value as OptionLetter,
                          })
                        }
                        className="w-full px-3 py-2 font-mono font-bold bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg"
                      >
                        <option value="A">Opsi A</option>
                        <option value="B">Opsi B</option>
                        <option value="C">Opsi C</option>
                        <option value="D">Opsi D</option>
                        <option value="E">Opsi E</option>
                      </select>
                    </div>
                  </div>
                )}

                <RichTextEditor
                  label="Pembahasan & Penyelesaian Soal (Rich Text Editor)"
                  value={qForm.explanation}
                  onChange={(html) => setQForm({ ...qForm, explanation: html })}
                  placeholder="Tuliskan langkah penyelesaian dan alasan kunci jawaban..."
                  minHeight="100px"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setQuestionModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold cursor-pointer"
                >
                  Simpan Butir Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: BULK UPLOAD SOAL (CSV / EXCEL / JSON + PHOTO UPLOAD PER ROW) ==================== */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  <span>
                    Bulk Upload Soal & Lampiran Dokumen Foto (Paket:{' '}
                    {activeExam?.code})
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Impor puluhan butir soal sekaligus melalui berkas CSV/Excel,
                  JSON, atau tempel tabel langsung beserta pengelompokan folder
                  otomatis di bucket <strong>app-file</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Target Paket Ujian & Nama Bank Soal Folder Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Nama Bank Soal / Kelompok Topik Default
                  </label>
                  <input
                    type="text"
                    value={defaultBankSoalName}
                    onChange={(e) => setDefaultBankSoalName(e.target.value)}
                    placeholder="Contoh: Bank Soal Kalkulus Paket 1"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Mode Penyimpanan ke Paket Ujian
                  </label>
                  <select
                    value={bulkImportMode}
                    onChange={(e) =>
                      setBulkImportMode(e.target.value as 'append' | 'replace')
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-semibold text-slate-900"
                  >
                    <option value="append">
                      Tambahkan ke Nomor Berikutnya (Append)
                    </option>
                    <option value="replace">
                      Ganti Seluruh Soal di Paket Ini (Replace)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">
                    Folder Otomatis Bucket Supabase
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 font-mono text-[11px] text-blue-800 truncate">
                    app-file/{activeBulkFolderPath}/
                  </div>
                </div>
              </div>

              {/* Input Method Selector Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBulkInputTab('csv')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      bulkInputTab === 'csv'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Upload File CSV / Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkInputTab('paste')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      bulkInputTab === 'paste'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-blue-600" />
                    <span>Copy-Paste Tabel / Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkInputTab('json')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      bulkInputTab === 'json'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-amber-600" />
                    <span>Format JSON</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSampleBulkData}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Muat 3 Contoh Soal Siap Impor</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Template .CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJsonTemplate}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Template .JSON</span>
                  </button>
                </div>
              </div>

              {/* Input Area Based on Active Tab */}
              {bulkInputTab === 'csv' && (
                <div className="p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 text-center space-y-3">
                  <FileSpreadsheet className="w-9 h-9 text-emerald-600 mx-auto" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Pilih Berkas CSV (.csv) atau Teks Terformat (.txt) dari
                      Komputer Anda
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl mx-auto">
                      Urutan kolom standar:{' '}
                      <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        topik, stimulus, pertanyaan, opsi_a, opsi_b, opsi_c,
                        opsi_d, opsi_e, kunci, poin, pembahasan
                      </code>
                    </p>
                  </div>
                  <div>
                    <input
                      ref={bulkFileInputRef}
                      type="file"
                      accept=".csv,.txt,.tsv,.json"
                      onChange={handleBulkFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => bulkFileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Pilih File CSV / JSON</span>
                    </button>
                  </div>
                </div>
              )}

              {(bulkInputTab === 'paste' || bulkInputTab === 'json') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold uppercase text-slate-600">
                      {bulkInputTab === 'json'
                        ? 'Tempelkan Array JSON Daftar Soal'
                        : 'Tempelkan Baris Soal dari Excel / Google Sheets / CSV'}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        parseBulkContent(
                          rawBulkText,
                          bulkInputTab === 'json' ? 'json' : 'csv'
                        )
                      }
                      className="px-3.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-xs cursor-pointer"
                    >
                      Proses & Tampilkan Pratinjau
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={rawBulkText}
                    onChange={(e) => setRawBulkText(e.target.value)}
                    placeholder={
                      bulkInputTab === 'json'
                        ? '[{"topic": "Fisika", "questionText": "Pertanyaan...", "optA": "...", "optB": "...", "optC": "...", "optD": "...", "optE": "...", "correctOption": "A", "points": 10, "explanation": "..."}]'
                        : 'topik,stimulus,pertanyaan,opsi_a,opsi_b,opsi_c,opsi_d,opsi_e,kunci,poin,pembahasan\n"Kalkulus","","Turunan pertama dari f(x) = 3x^2 adalah...","6x","3x","x^2","6","3","A","10","f\'(x) = 2*3x = 6x"'
                    }
                    className="w-full p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs focus:outline-none"
                  />
                </div>
              )}

              {bulkParseError && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{bulkParseError}</span>
                </div>
              )}

              {/* Interactive Preview & Per-Row Photo Upload Table */}
              {parsedBulkItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        Pratinjau {parsedBulkItems.length} Butir Soal Siap
                        Diimpor (Anda dapat melampirkan foto pada setiap baris)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setParsedBulkItems([])}
                      className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                    >
                      Bersihkan Daftar Pratinjau
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="py-2.5 px-3 w-10">#</th>
                            <th className="py-2.5 px-3">Jenis</th>
                            <th className="py-2.5 px-3">Bank Soal / Topik</th>
                            <th className="py-2.5 px-3">
                              Pertanyaan & Opsi / Kunci Esai
                            </th>
                            <th className="py-2.5 px-3 text-center">Kunci</th>
                            <th className="py-2.5 px-3 text-center">Poin</th>
                            <th className="py-2.5 px-3">
                              Dokumen Foto (app-file)
                            </th>
                            <th className="py-2.5 px-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs">
                          {parsedBulkItems.map((item, idx) => (
                            <tr key={item.tempId} className="hover:bg-slate-50">
                              <td className="py-3 px-3 font-mono font-bold text-slate-500 tabular-nums">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-3 w-32">
                                <select
                                  value={item.questionType}
                                  onChange={(e) => {
                                    const val = e.target.value as QuestionType;
                                    setParsedBulkItems((prev) =>
                                      prev.map((p) =>
                                        p.tempId === item.tempId
                                          ? { ...p, questionType: val }
                                          : p
                                      )
                                    );
                                  }}
                                  className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] font-bold"
                                >
                                  <option value="pilihan_ganda">Pilihan Ganda</option>
                                  <option value="esai">Esai</option>
                                </select>
                              </td>
                              <td className="py-3 px-3 w-44">
                                <input
                                  type="text"
                                  value={item.topic}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setParsedBulkItems((prev) =>
                                      prev.map((p) =>
                                        p.tempId === item.tempId
                                          ? { ...p, topic: val }
                                          : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold"
                                />
                              </td>
                              <td className="py-3 px-3 min-w-[260px]">
                                <div className="font-semibold text-slate-900">
                                  <RichTextContent content={item.questionText} />
                                </div>
                                {item.questionType === 'esai' ? (
                                  <div className="mt-1.5">
                                    <input
                                      type="text"
                                      value={item.essayAnswerKey || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setParsedBulkItems((prev) =>
                                          prev.map((p) =>
                                            p.tempId === item.tempId
                                              ? { ...p, essayAnswerKey: val }
                                              : p
                                          )
                                        );
                                      }}
                                      placeholder="Kunci jawaban esai..."
                                      className="w-full px-2 py-1 rounded border border-purple-300 bg-purple-50/50 text-[11px] text-purple-900"
                                    />
                                  </div>
                                ) : (
                                  <div className="mt-1 text-[11px] text-slate-500 grid grid-cols-2 gap-x-3 gap-y-0.5">
                                    <span>A: {stripHtmlToPlainText(item.optA)}</span>
                                    <span>B: {stripHtmlToPlainText(item.optB)}</span>
                                    <span>C: {stripHtmlToPlainText(item.optC)}</span>
                                    <span>D: {stripHtmlToPlainText(item.optD)}</span>
                                    <span>E: {stripHtmlToPlainText(item.optE)}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {item.questionType === 'esai' ? (
                                  <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                                    ESAI
                                  </span>
                                ) : (
                                  <select
                                    value={item.correctOption}
                                    onChange={(e) => {
                                      const val = e.target.value as OptionLetter;
                                      setParsedBulkItems((prev) =>
                                        prev.map((p) =>
                                          p.tempId === item.tempId
                                            ? { ...p, correctOption: val }
                                            : p
                                        )
                                      );
                                    }}
                                    className="px-2 py-1 rounded bg-emerald-50 border border-emerald-300 font-mono font-bold text-emerald-800"
                                  >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                    <option value="E">E</option>
                                  </select>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center w-20">
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={item.points}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || 10;
                                    setParsedBulkItems((prev) =>
                                      prev.map((p) =>
                                        p.tempId === item.tempId
                                          ? { ...p, points: val }
                                          : p
                                      )
                                    );
                                  }}
                                  className="w-16 px-2 py-1 text-center font-mono rounded border border-slate-300 bg-white tabular-nums"
                                />
                              </td>
                              <td className="py-3 px-3 w-48">
                                {item.imageUrl ? (
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={item.imageUrl}
                                      alt="Foto"
                                      referrerPolicy="no-referrer"
                                      className="w-9 h-9 rounded object-cover border border-slate-300 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[10px] font-mono text-emerald-700 truncate">
                                        {item.storagePath || 'Terlampir'}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setParsedBulkItems((prev) =>
                                            prev.map((p) =>
                                              p.tempId === item.tempId
                                                ? {
                                                    ...p,
                                                    imageUrl: undefined,
                                                    storagePath: undefined,
                                                  }
                                                : p
                                            )
                                          )
                                        }
                                        className="text-[10px] text-red-600 hover:underline cursor-pointer"
                                      >
                                        Hapus Foto
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap">
                                    {item.isUploadingPhoto ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                        <span>Upload...</span>
                                      </>
                                    ) : (
                                      <>
                                        <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                                        <span>+ Upload Foto</span>
                                      </>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) =>
                                        handleUploadPhotoForBulkRow(
                                          item.tempId,
                                          e.target.files?.[0]
                                        )
                                      }
                                    />
                                  </label>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setParsedBulkItems((prev) =>
                                      prev.filter(
                                        (p) => p.tempId !== item.tempId
                                      )
                                    )
                                  }
                                  className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                                  title="Hapus baris ini"
                                >
                                  <Trash2 className="w-4 h-4" />
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
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500">
                Target Paket Ujian:{' '}
                <strong className="text-slate-800">
                  [{activeExam?.code}] {activeExam?.title}
                </strong>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-xs text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={parsedBulkItems.length === 0}
                  onClick={handleConfirmBulkImport}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Simpan & Impor {parsedBulkItems.length} Butir Soal ke
                    Database
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {previewLightboxUrl && (
        <div
          onClick={() => setPreviewLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-3 max-w-3xl w-full shadow-2xl space-y-2"
          >
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-bold text-slate-700">
                Pratinjau Dokumen Foto Soal (Bucket Supabase: app-file)
              </span>
              <button
                type="button"
                onClick={() => setPreviewLightboxUrl(null)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 flex items-center justify-center max-h-[78vh] overflow-auto">
              <img
                src={previewLightboxUrl}
                alt="Lampiran Foto Soal"
                referrerPolicy="no-referrer"
                className="max-h-[72vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
