import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useCBT } from '../context/CBTContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useCBT();

  if (toasts.length === 0) return null;

  // Get the latest 3 toasts to display in a beautiful stack
  const visibleToasts = toasts.slice(-3);
  const topIndex = visibleToasts.length - 1;

  return (
    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[9999] max-w-[calc(100vw-2rem)] sm:max-w-sm w-full h-[120px] pointer-events-none">
      {visibleToasts.map((t, idx) => {
        const depth = topIndex - idx; // 0 for newest, 1 for middle, 2 for oldest

        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          ) : t.type === 'error' ? (
            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-500 shrink-0" />
          );

        const borderClass =
          t.type === 'success'
            ? 'border-l-4 border-l-emerald-500'
            : t.type === 'warning'
            ? 'border-l-4 border-l-amber-500'
            : t.type === 'error'
            ? 'border-l-4 border-l-red-500'
            : 'border-l-4 border-l-blue-500';

        return (
          <div
            key={t.id}
            className={`absolute top-0 right-0 left-0 pointer-events-auto bg-white/70 backdrop-blur-md border border-slate-200/40 rounded-xl shadow-lg p-3.5 flex items-start justify-between gap-3 transition-all duration-300 ${borderClass}`}
            style={{
              transform: `scale(${1 - depth * 0.05}) translateY(${depth * 12}px)`,
              opacity: depth === 0 ? 1 : depth === 1 ? 0.8 : 0.45,
              zIndex: 100 - depth,
              boxShadow: depth === 0 
                ? '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
                : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div className="flex items-start gap-2.5">
              {icon}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 leading-snug">{t.title}</div>
                {t.description && (
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed break-words">
                    {t.description}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0 transition-colors p-0.5 hover:bg-slate-100 rounded"
              title="Tutup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
