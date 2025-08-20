import * as React from 'react';
import * as RToast from '@radix-ui/react-toast';

type ToastOptions = { title?: string; description?: string; durationMs?: number };

type ToastContextValue = {
  showToast: (opts: ToastOptions) => void;
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

  return (
    <ToastContext.Provider value={{ showToast }}>
      <RToast.Provider swipeDirection="right">
        {children}
        <RToast.Root open={open} onOpenChange={setOpen} duration={opts.durationMs ?? 3500} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border bg-white shadow-lg w-[92vw] max-w-sm">
          {opts.title && (<RToast.Title className="px-4 pt-3 text-slate-900 font-medium">{opts.title}</RToast.Title>)}
          {opts.description && (<RToast.Description className="px-4 pb-3 text-slate-600 text-sm">{opts.description}</RToast.Description>)}
        </RToast.Root>
        <RToast.Viewport className="sr-only" />
      </RToast.Provider>
    </ToastContext.Provider>
  );
}



