'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { SceneFallback } from './SceneFallback';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class SceneErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (typeof console !== 'undefined') {
      console.warn('[Hero3D] Scene error caught:', error.message);
    }
    void errorInfo;
  }

  render() {
    if (this.state.hasError) {
      return <SceneFallback />;
    }
    return this.props.children;
  }
}
