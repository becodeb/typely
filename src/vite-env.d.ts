/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Internal backend endpoint for sending invitation emails. Never a key. */
  readonly VITE_INVITE_API_URL?: string;
  /** "true" habilita el Developer Layout Editor (sólo se evalúa en `vite dev`;
   *  en build de producción la herramienta no se incluye). */
  readonly VITE_ENABLE_LAYOUT_EDITOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
