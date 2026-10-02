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
    <>
      {/* Backdrop Dimming Overlay with subtle blur behind notifications */}
      <div 
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-[9998] transition-opacity duration-300 pointer-events-auto"
        onClick={() => {
          // Dismiss the newest toast on backdrop click
          if (visibleToasts.length > 0) {
            dismissToast(visibleToasts[visibleToasts.length - 1].id);
          }
        }}
        aria-label="Tutup Notifikasi"
      />

      {/* Glassmorphic Toast Notification Container */}
      <div className="fixed top-6 right-6 sm:top-8 sm:right-8 z-[9999] max-w-[calc(100vw-2.5rem)] sm:max-w-md w-full h-[140px] pointer-events-none">
        {visibleToasts.map((t, idx) => {
          const depth = topIndex - idx; // 0 for newest, 1 for middle, 2 for oldest

          const icon =
            t.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : t.type === 'warning' ? (
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
            ) : t.type === 'error' ? (
              <XCircle className="w-6 h-6 text-red-500 shrink-0" />
            ) : (
              <Info className="w-6 h-6 text-blue-500 shrink-0" />
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
              className={`absolute top-0 right-0 left-0 pointer-events-auto bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-white/70 dark:border-slate-700/70 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3.5 transition-all duration-300 ${borderClass}`}
              style={{
                transform: `scale(${1 - depth * 0.04}) translateY(${depth * 16}px)`,
                opacity: depth === 0 ? 1 : depth === 1 ? 0.85 : 0.5,
                zIndex: 100 - depth,
                boxShadow: depth === 0 
                  ? '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 10px 20px -5px rgba(0, 0, 0, 0.1)'
                  : '0 12px 24px -6px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 shadow-inner">
                  {icon}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug tracking-tight">
                    {t.title}
                  </div>
                  {t.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words font-medium">
                      {t.description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0 transition-colors p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
};
