//

type Props = {
  state: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export default function InlineStatus({ state, message, onRetry, className }: Props) {
  const base = 'inline-flex items-center gap-2 text-sm';
  const tone = state === 'loading'
    ? 'text-slate-600'
    : state === 'success'
    ? 'text-green-700'
    : state === 'error'
    ? 'text-rose-700'
    : 'text-slate-600';
  return (
    <div className={`${base} ${tone} ${className || ''}`.trim()} role="status" aria-live="polite">
      {state === 'loading' && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
      )}
      {state === 'success' && (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.364 7.364a1 1 0 01-1.414 0L3.293 9.435a1 1 0 111.414-1.414l3.222 3.222 6.657-6.657a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
      )}
      {state === 'error' && (
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 002 0V7zm0 6a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd"/></svg>
      )}
      <span>{message || (state === 'loading' ? 'Working…' : state === 'success' ? 'Done' : state === 'error' ? 'Something went wrong' : '')}</span>
      {state === 'error' && onRetry && (
        <button onClick={onRetry} className="ml-2 text-rose-700 underline-offset-2 hover:underline">Retry</button>
      )}
    </div>
  );
}


