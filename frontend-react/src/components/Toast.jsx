import { createContext, useCallback, useContext } from 'react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

const ToastContext = createContext(() => {});

/** Same API as before (toast(message, 'error')), now shown with shadcn's Sonner toaster. */
export function ToastProvider({ children }) {
  const push = useCallback((message, kind = 'ok') => (kind === 'error' ? toast.error(message) : toast.success(message)), []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <Toaster position="bottom-right" richColors closeButton duration={4500} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
