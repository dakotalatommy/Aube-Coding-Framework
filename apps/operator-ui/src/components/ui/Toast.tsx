import * as React from 'react';
import * as RToast from '@radix-ui/react-toast';

type ToastOptions = { title?: string; description?: string; durationMs?: number; variant?: 'default' | 'success' | 'error' };

type ToastContextValue = {
  showToast: (opts: ToastOptions) => void;
  toastSuccess: (title: string, description?: string) => void;
  toastError: (title: string, description?: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function useToast(){
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }){
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<ToastOptions>({});

  const showToast = React.useCallback((o: ToastOptions) => {
    setOpts(o);
    setOpen(false);
    // let Radix settle before reopening
    setTimeout(() => setOpen(true), 10);
  }, []);

  const toastSuccess = React.useCallback((title: string, description?: string) => {
    showToast({ title, description, variant: 'success' });
  }, [showToast]);
  const toastError = React.useCallback((title: string, description?: string) => {
    showToast({ title, description, variant: 'error', durationMs: 5000 });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, toastSuccess, toastError }}>
      <RToast.Provider swipeDirection="right">
        {children}
        <RToast.Root open={open} onOpenChange={setOpen} duration={opts.durationMs ?? 3500} className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border w-[92vw] max-w-sm shadow-lg ${opts.variant==='error' ? 'bg-red-50 border-red-200' : opts.variant==='success' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-white/80'}`}>
          {opts.title && (<RToast.Title className={`px-4 pt-3 font-medium ${opts.variant==='error' ? 'text-red-900' : opts.variant==='success' ? 'text-emerald-900' : 'text-slate-900'}`}>{opts.title}</RToast.Title>)}
          {opts.description && (<RToast.Description className={`px-4 pb-3 text-sm ${opts.variant==='error' ? 'text-red-700' : opts.variant==='success' ? 'text-emerald-700' : 'text-slate-600'}`}>{opts.description}</RToast.Description>)}
        </RToast.Root>
        <RToast.Viewport className="sr-only" />
      </RToast.Provider>
    </ToastContext.Provider>
  );
}



