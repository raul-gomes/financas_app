import * as React from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Título do fallback (padrão: "Algo deu errado"). */
  fallbackTitle?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Barreira de erro isolada por rota/seção.
 *
 * Um crash de runtime em uma página (ex.: import faltando, campo undefined)
 * não derruba mais o app inteiro — apenas a área envolvida exibe o fallback,
 * mantendo sidebar e navegação vivas.
 *
 * Envolva cada página nas rotas:
 * `<Route path="/x" element={<ErrorBoundary><X /></ErrorBoundary>} />`
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ error: null })
  }

  private handleGoHome = () => {
    window.location.assign("/")
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-10 text-center m-4"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            {this.props.fallbackTitle ?? "Algo deu errado"}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={this.handleRetry}>
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={this.handleGoHome}>
            <Home className="h-4 w-4" />
            Voltar ao início
          </Button>
        </div>
      </div>
    )
  }
}
