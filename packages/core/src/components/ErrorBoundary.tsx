'use client';

import { Component, type ReactNode } from 'react';

export type InkioErrorFallbackProps = {
  error: unknown;
  reset: () => void;
};

export type InkioErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode | ((props: InkioErrorFallbackProps) => ReactNode);
  onError?: (error: unknown) => void;
};

type State = { error: unknown; key: number };

export class InkioErrorBoundary extends Component<InkioErrorBoundaryProps, State> {
  state: State = { error: null, key: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  private handleReset = () => {
    this.setState((s) => ({ error: null, key: s.key + 1 }));
  };

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback({ error: this.state.error, reset: this.handleReset });
      }
      if (fallback !== undefined) return fallback;
      return (
        <div className="inkio inkio-container-default" role="alert">
          <div className="inkio-content">
            <p>Editor failed to render.</p>
          </div>
        </div>
      );
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}
