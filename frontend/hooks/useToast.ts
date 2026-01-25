import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((msg: string) => showToast('success', msg), [showToast]);
  const error = useCallback((msg: string) => showToast('error', msg), [showToast]);
  const info = useCallback((msg: string) => showToast('info', msg), [showToast]);
  const warning = useCallback((msg: string) => showToast('warning', msg), [showToast]);

  return {
    toasts,
    dismiss,
    success,
    error,
    info,
    warning,
  };
}
