import { Component, type ReactNode } from 'react'
import i18n from '@/i18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-bg-primary">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-xl font-bold text-text-primary">{i18n.t('errorBoundary.title')}</h2>
            <p className="text-sm text-text-muted">
              {i18n.t('errorBoundary.description')}
            </p>
            {this.state.error && (
              <details className="text-left text-xs text-text-muted bg-bg-secondary rounded p-3">
                <summary className="cursor-pointer font-medium">{i18n.t('errorBoundary.details')}</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/80 transition-colors text-sm"
            >
              {i18n.t('errorBoundary.retry')}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
