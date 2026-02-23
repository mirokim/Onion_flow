/**
 * Unit tests for ErrorBoundary component.
 * Tests: normal render, error fallback UI, custom fallback, retry button.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

// Suppress console.error from React's error boundary logging during tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** A component that always throws */
function ThrowingChild({ message = 'Test error' }: { message?: string }): React.ReactNode {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('should render default error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )
    // Title from i18n (ko fallback)
    expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument()
    // Description
    expect(screen.getByText(/예기치 않은 오류/)).toBeInTheDocument()
    // Retry button
    expect(screen.getByText('다시 시도')).toBeInTheDocument()
  })

  it('should show error details in expandable section', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="Something went wrong" />
      </ErrorBoundary>
    )
    // Error message should be in the details
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    // Details summary
    expect(screen.getByText('오류 상세')).toBeInTheDocument()
  })

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom Error Page</div>}>
        <ThrowingChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom Error Page')).toBeInTheDocument()
    // Default UI should NOT render
    expect(screen.queryByText('오류가 발생했습니다')).not.toBeInTheDocument()
  })

  it('should reset error state when retry button is clicked', () => {
    let shouldThrow = true

    function ConditionalChild() {
      if (shouldThrow) throw new Error('Conditional error')
      return <div>Recovered</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>
    )

    // Error state should be shown
    expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument()

    // Fix the error condition and click retry
    shouldThrow = false
    fireEvent.click(screen.getByText('다시 시도'))

    // After reset, re-render should succeed
    rerender(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })
})
