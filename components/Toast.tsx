
import React, { useEffect, useState } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: number;
  title: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [exiting, setExiting] = useState(false);

  const typeClasses: Record<ToastType, { border: string; icon: string; iconColor: string; progress: string }> = {
    info: { border: 'border-cyan-400', icon: 'fa-info-circle', iconColor: 'text-cyan-400', progress: 'bg-cyan-400' },
    success: { border: 'border-green-500', icon: 'fa-check-circle', iconColor: 'text-green-500', progress: 'bg-green-500' },
    warning: { border: 'border-amber-400', icon: 'fa-exclamation-triangle', iconColor: 'text-amber-400', progress: 'bg-amber-400' },
    error: { border: 'border-red-500', icon: 'fa-exclamation-circle', iconColor: 'text-red-500', progress: 'bg-red-500' },
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);
  
  const handleDismiss = () => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`relative w-full max-w-sm rounded-2xl shadow-2xl p-4 flex items-start gap-4 transition-all duration-300 ease-out border-l-4 bg-slate-800/80 backdrop-blur-md border-slate-700/50
        ${typeClasses[toast.type].border}
        ${exiting ? 'opacity-0 translate-x-[-100%]' : 'opacity-100 translate-x-0'}`}
      role="alert"
    >
      <i className={`fas ${typeClasses[toast.type].icon} ${typeClasses[toast.type].iconColor} text-xl mt-1`}></i>
      <div className="flex-1">
        <h3 className="font-bold text-white">{toast.title}</h3>
        <p className="text-sm text-slate-300">{toast.message}</p>
      </div>
       <button onClick={handleDismiss} className="text-slate-400 hover:text-white transition-colors">
        <i className="fas fa-times"></i>
      </button>
      <div className={`absolute bottom-0 left-0 h-1 ${typeClasses[toast.type].progress} animate-[progress_5s_linear_forwards]`} style={{'--animation-name': 'progress'} as React.CSSProperties}></div>
      <style>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default Toast;
