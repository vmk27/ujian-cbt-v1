import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Subscript,
  Superscript,
  Code,
  RemoveFormatting,
  Sigma,
  Eye,
} from 'lucide-react';

const MATH_SCIENCE_SYMBOLS = [
  { symbol: 'π', label: 'Pi' },
  { symbol: '√', label: 'Akar Kuadrat' },
  { symbol: 'Δ', label: 'Delta' },
  { symbol: 'θ', label: 'Theta' },
  { symbol: 'α', label: 'Alpha' },
  { symbol: 'β', label: 'Beta' },
  { symbol: 'λ', label: 'Lambda' },
  { symbol: 'Ω', label: 'Omega / Ohm' },
  { symbol: '≤', label: 'Kurang dari sama dengan' },
  { symbol: '≥', label: 'Lebih dari sama dengan' },
  { symbol: '≠', label: 'Tidak sama dengan' },
  { symbol: '≈', label: 'Hampir sama dengan' },
  { symbol: '±', label: 'Plus Minus' },
  { symbol: '×', label: 'Kali' },
  { symbol: '÷', label: 'Bagi' },
  { symbol: '∞', label: 'Tak Hingga' },
  { symbol: '→', label: 'Panah Reaksi' },
  { symbol: '⇌', label: 'Kesetimbangan Kimia' },
  { symbol: '°', label: 'Derajat' },
  { symbol: '²', label: 'Kuadrat' },
  { symbol: '³', label: 'Kubik' },
  { symbol: '∫', label: 'Integral' },
  { symbol: '∑', label: 'Sigma / Jumlah' },
];

export function sanitizeRichHtml(input?: string): string {
  if (!input) return '';
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export function stripHtmlToPlainText(input?: string): string {
  if (!input) return '';
  return input
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatHtmlForDisplay(raw?: string): string {
  if (!raw) return '';
  const cleaned = sanitizeRichHtml(raw);
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(cleaned);
  if (hasHtmlTags) {
    return cleaned;
  }
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');
}

interface RichTextContentProps {
  content?: string;
  className?: string;
}

export const RichTextContent: React.FC<RichTextContentProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;
  const html = formatHtmlForDisplay(content);
  return (
    <div
      className={`rich-text-content break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_p]:my-1 first:[&_p]:mt-0 last:[&_p]:mb-0 [&_sub]:text-[0.75em] [&_sub]:align-sub [&_sup]:text-[0.75em] [&_sup]:align-super [&_code]:font-mono [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  minHeight?: string;
  required?: boolean;
  helperText?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Tuliskan teks di sini...',
  minHeight = '120px',
  helperText,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [showSymbolPalette, setShowSymbolPalette] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value changes when not actively typing inside the editor
  useEffect(() => {
    const el = editorRef.current;
    if (!el || sourceMode) return;
    const formatted = formatHtmlForDisplay(value);
    if (el.innerHTML !== formatted && !isFocused) {
      el.innerHTML = formatted;
    }
  }, [value, sourceMode, isFocused]);

  // Ensure initial mount sets HTML
  useEffect(() => {
    const el = editorRef.current;
    if (el && !sourceMode) {
      el.innerHTML = formatHtmlForDisplay(value);
    }
  }, [sourceMode]);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    const rawHtml = el.innerHTML;
    const plain = stripHtmlToPlainText(rawHtml);
    if (!plain && !rawHtml.includes('<img')) {
      onChange('');
    } else {
      onChange(sanitizeRichHtml(rawHtml));
    }
  };

  const execFormat = (command: string, arg?: string) => {
    if (sourceMode) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, arg);
    emitChange();
  };

  const insertSymbol = (sym: string) => {
    if (sourceMode) {
      onChange(`${value}${sym}`);
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('insertText', false, sym);
    emitChange();
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            {label}
          </label>
          {helperText && (
            <span className="text-[11px] text-slate-400">{helperText}</span>
          )}
        </div>
      )}

      <div
        className={`rounded-xl border transition-colors overflow-hidden bg-white ${
          isFocused
            ? 'border-blue-600 ring-2 ring-blue-600/15'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        {/* Toolbar */}
        <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('bold');
              }}
              title="Tebal (Bold)"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('italic');
              }}
              title="Miring (Italic)"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('underline');
              }}
              title="Garis Bawah (Underline)"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-slate-300 mx-0.5" />

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('subscript');
              }}
              title="Subskrip (Contoh: H₂O)"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <Subscript className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('superscript');
              }}
              title="Superskrip / Pangkat (Contoh: x²)"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <Superscript className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-slate-300 mx-0.5" />

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('insertUnorderedList');
              }}
              title="Daftar Poin (Bullet List)"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('insertOrderedList');
              }}
              title="Daftar Bernomor (Numbered List)"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-slate-300 mx-0.5" />

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('justifyLeft');
              }}
              title="Rata Kiri"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('justifyCenter');
              }}
              title="Rata Tengah"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('justifyRight');
              }}
              title="Rata Kanan"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-700 cursor-pointer transition-colors"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-slate-300 mx-0.5" />

            <button
              type="button"
              onClick={() => setShowSymbolPalette((prev) => !prev)}
              title="Sisipkan Simbol Matematika, Fisika & Kimia"
              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                showSymbolPalette
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>Simbol Rumus</span>
            </button>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execFormat('removeFormat');
              }}
              title="Bersihkan Format"
              className="p-1.5 rounded-md hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
            >
              <RemoveFormatting className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSourceMode((prev) => !prev)}
            title="Beralih antara Editor Visual dan Kode HTML"
            className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              sourceMode
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            {sourceMode ? (
              <>
                <Eye className="w-3 h-3" />
                <span>Visual</span>
              </>
            ) : (
              <>
                <Code className="w-3 h-3" />
                <span>HTML</span>
              </>
            )}
          </button>
        </div>

        {/* Optional Math & Science Symbol Bar */}
        {showSymbolPalette && (
          <div className="px-3 py-2 bg-blue-50/60 border-b border-slate-200 flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mr-1">
              Klik Simbol:
            </span>
            {MATH_SCIENCE_SYMBOLS.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertSymbol(item.symbol);
                }}
                title={item.label}
                className="w-6 h-6 rounded bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 font-mono text-xs font-bold text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                {item.symbol}
              </button>
            ))}
          </div>
        )}

        {/* Editable Area */}
        {sourceMode ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            style={{ minHeight }}
            className="w-full p-3.5 font-mono text-xs bg-slate-900 text-emerald-300 focus:outline-none resize-y"
          />
        ) : (
          <div className="relative">
            {!stripHtmlToPlainText(value) && !isFocused && (
              <div className="pointer-events-none absolute top-3 left-3.5 text-xs text-slate-400 select-none">
                {placeholder}
              </div>
            )}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={emitChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false);
                emitChange();
              }}
              style={{ minHeight }}
              className="w-full p-3.5 text-xs sm:text-sm text-slate-900 focus:outline-none overflow-y-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_sub]:text-[0.75em] [&_sub]:align-sub [&_sup]:text-[0.75em] [&_sup]:align-super"
            />
          </div>
        )}
      </div>
    </div>
  );
};
