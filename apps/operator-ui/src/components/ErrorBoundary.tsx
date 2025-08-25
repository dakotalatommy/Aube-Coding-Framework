import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; info?: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props){
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(){
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any){
    try { console.error('UI ErrorBoundary', error, info); } catch {}
    this.setState({ info: String(info) });
  }
  render(){
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto mt-10 rounded-2xl border bg-white p-5 text-slate-800">
          <div className="text-lg font-semibold">Something went wrong</div>
          <div className="text-sm text-slate-600 mt-1">Try reloading the page. If this keeps happening, contact support and include what you were doing.</div>
          <div className="mt-3 flex gap-2">
            <a href="/" className="px-3 py-2 rounded-full bg-slate-900 text-white text-sm">Reload</a>
            <a href="mailto:support@brandvx.io" className="px-3 py-2 rounded-full border bg-white text-sm">Contact support</a>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}


