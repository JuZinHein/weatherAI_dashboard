import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/** Keeps a single child crash from wiping the whole showcase to a black screen. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#030712] px-6 text-center text-white">
          <p className="text-sm font-semibold text-rose-300">View crashed</p>
          <p className="max-w-md font-mono text-[11px] text-slate-400">
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
