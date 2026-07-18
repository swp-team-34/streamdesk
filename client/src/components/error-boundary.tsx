import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiUrl } from "@/lib/queryClient";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
    this.reportClientError(error, errorInfo);
  }

  reportClientError(error: Error, errorInfo: ErrorInfo) {
    try {
      fetch(apiUrl("/api/platform/incidents/report"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Ошибка интерфейса: ${error.name || "Error"}`,
          message: error.message || String(error),
          type: "bug",
          severity: "high",
          source: "client-error",
          metadata: {
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            path: window.location.pathname,
            userAgent: navigator.userAgent,
          },
        }),
      }).catch(() => {});
    } catch {
      // Ошибка репорта не должна ломать fallback-экран.
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-2xl border-error/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-8 w-8 text-error" />
                <h2 className="text-2xl font-semibold text-foreground">
                  Произошла ошибка
                </h2>
              </div>
              
              {this.state.error && (
                <div className="mb-4 rounded-surface border border-error/20 bg-error-muted/60 p-4">
                  <p className="break-all font-mono text-sm text-error">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-error">
                        Детали ошибки
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-control bg-error-muted p-2 text-xs text-error">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={this.handleReset} variant="default">
                  Попробовать снова
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Обновить страницу
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
