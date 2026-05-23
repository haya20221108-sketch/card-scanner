'use client';

import React from 'react';
import { Info, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CustomAlertProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  type?: 'info' | 'error' | 'success';
}

export function CustomAlert({ isOpen, onClose, title, message, onConfirm, onCancel, type = 'info' }: CustomAlertProps) {
  if (!isOpen) return null;

  const typeStyles = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      icon: <Info size={28} className="text-blue-500" />,
      btn: 'bg-blue-600 shadow-blue-100',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-100',
      icon: <AlertCircle size={28} className="text-red-500" />,
      btn: 'bg-red-600 shadow-red-100',
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      icon: <CheckCircle2 size={28} className="text-emerald-500" />,
      btn: 'bg-emerald-600 shadow-emerald-100',
    }
  };

  const style = typeStyles[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className={`p-5 rounded-[2rem] ${style.bg} ${style.border} border shadow-inner`}>
            {style.icon}
          </div>
          <div className="space-y-2 px-2">
            <h3 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">
              {title}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest">
              {message}
            </p>
          </div>
        </div>
        {onConfirm && onCancel ? (
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all ${style.btn}`}
            >
              Confirm
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className={`w-full py-5 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all ${style.btn}`}
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}
