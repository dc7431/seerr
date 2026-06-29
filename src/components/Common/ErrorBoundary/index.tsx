import React from 'react';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
  /** Rendered in place of the children when a render error is caught. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Minimal error boundary that contains render errors within its subtree so they
 * cannot crash the rest of the page. Used on the login page to guarantee that a
 * failing OIDC login button can never take down the local sign-in form or the
 * break-glass recovery link.
 */
class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
