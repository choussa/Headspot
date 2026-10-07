import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: unknown) {
    console.error('Unhandled UI error', error, info)
  }
  private retry = () => this.setState({ error: null })
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-fg-2">
          <p className="font-medium text-fg">{this.props.label ?? 'Something went wrong.'}</p>
          <p className="max-w-md text-xs text-fg-3">{this.state.error.message}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="rounded-md border border-control bg-raised px-3 py-1.5 text-xs text-fg hover:bg-line"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-control bg-raised px-3 py-1.5 text-xs text-fg hover:bg-line"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
