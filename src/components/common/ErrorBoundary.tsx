import { Component, type ErrorInfo, type ReactNode } from "react";

/* Error boundary global: si una pantalla lanza una excepción en render,
   en vez de quedar la página gris muda mostramos una tarjeta amigable con
   opciones de recuperación. Nunca expone el stack al usuario (solo a la
   consola, para diagnóstico). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[TYPELY] error de render no capturado:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main
        className="min-h-dvh grid place-items-center p-6"
        style={{ background: "linear-gradient(180deg, #cfeeff 0%, #e8f6ff 60%, #f3f9ff 100%)" }}
      >
        <section className="glass-card-smooth tarjeta-marca rounded-3xl p-10 w-[min(28rem,92vw)] text-center flex flex-col items-center gap-4">
          <img src="/favicon-256.png" alt="" className="w-20 h-20" decoding="async" />
          <h1 className="font-display text-2xl font-black text-text">¡Ups! Algo salió mal</h1>
          <p className="text-muted font-semibold text-sm">
            La pantalla tuvo un problema inesperado. Probá recargar o volver al inicio.
          </p>
          <div className="flex gap-3 w-full mt-2">
            <button
              type="button"
              className="flex-1 py-3 rounded-xl font-extrabold text-white cursor-pointer bg-gradient-to-br from-accent-sky to-accent-strong shadow-btn transition-transform hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
            <button
              type="button"
              className="flex-1 py-3 rounded-xl font-bold cursor-pointer bg-white/60 text-text transition-transform hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => { window.location.href = "/"; }}
            >
              Ir al inicio
            </button>
          </div>
        </section>
      </main>
    );
  }
}
