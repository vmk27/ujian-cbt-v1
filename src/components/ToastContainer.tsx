import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useCBT } from '../context/CBTContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useCBT();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          ) : t.type === 'error' ? (
            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
          );

        const borderClass =
          t.type === 'success'
            ? 'border-l-4 border-l-emerald-600'
            : t.type === 'warning'
            ? 'border-l-4 border-l-amber-500'
            : t.type === 'error'
            ? 'border-l-4 border-l-red-600'
            : 'border-l-4 border-l-blue-600';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto bg-white rounded-lg border border-slate-200 ${borderClass} shadow-lg p-3.5 flex items-start justify-between gap-3 transition-all`}
          >
            <div className="flex items-start gap-2.5">
              {icon}
              <div>
                <div className="text-xs font-bold text-slate-900">{t.title}</div>
                {t.description && (
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
