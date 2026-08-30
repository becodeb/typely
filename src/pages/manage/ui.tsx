/* Primitivas de las pantallas de gestión.
 *
 * Deliberadamente NO usan el lenguaje visual del juego. El juego es
 * cristal, pastel y Baloo 2; esto es una herramienta de trabajo: fondo
 * plano, bordes de 1px, tipografía normal y densidad alta. Un admin que
 * mira 300 alumnos necesita leerlos, no que le brillen.
 *
 * El contraste también orienta: en cuanto ves la pantalla sabés si estás
 * del lado del juego o del lado de la gestión.
 *
 * Un solo color de acento (el azul de la marca) y para una sola cosa: la
 * acción principal de cada pantalla. Si todo resalta, nada resalta.
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/* ------------------------------------------------------------------ */
/* Botones                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-[#3159e8] text-white border-[#3159e8] hover:bg-[#2749c4] hover:border-[#2749c4]",
  secondary: "bg-white text-[#1a2233] border-[#d5d9e2] hover:bg-[#f4f6fa]",
  danger: "bg-white text-[#b42318] border-[#f0c2bd] hover:bg-[#fef3f2]",
  ghost: "bg-transparent text-[#475069] border-transparent hover:bg-[#eef1f6]",
};

export function Button({
  variant = "secondary",
  loading = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${BUTTON_STYLES[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Campos                                                              */
/* ------------------------------------------------------------------ */

const FIELD_BASE =
  "w-full rounded-lg border border-[#d5d9e2] bg-white px-3 py-2 text-sm text-[#1a2233] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[#3159e8] focus:ring-2 focus:ring-[#3159e8]/15 disabled:bg-[#f4f6fa]";

/** Envoltorio con etiqueta, ayuda y error. El error se anuncia con
 *  `role="alert"` y se ata al campo con aria-describedby: un lector de
 *  pantalla lo lee al llegar, no queda solo como color. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-[#344054]">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-[#667085]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-[#b42318]">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ invalid, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${FIELD_BASE} ${invalid ? "border-[#d92d20] focus:border-[#d92d20] focus:ring-[#d92d20]/15" : ""} ${className}`}
    />
  );
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${FIELD_BASE} ${className}`}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Contenedores y estados                                              */
/* ------------------------------------------------------------------ */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#e3e6ec] bg-white ${className}`}>{children}</section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#101828]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/** Error de carga. Siempre ofrece reintentar: un mensaje sin salida deja
 *  al usuario con la única opción de recargar a mano. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[#f0c2bd] bg-[#fef3f2] px-4 py-3">
      <p className="flex-1 text-sm font-medium text-[#b42318]">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Estado vacío. `hint` explica QUÉ hacer, no solo que no hay nada. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-sm font-semibold text-[#344054]">{title}</p>
      {hint && <p className="max-w-md text-sm text-[#667085]">{hint}</p>}
      {action}
    </div>
  );
}

/** Esqueleto de carga: mantiene la altura de la tabla para que el
 *  contenido no salte cuando llegan los datos. */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[#eef1f6]" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-[#eef1f6]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[#eef1f6]" />
          <div className="ml-auto h-4 w-24 animate-pulse rounded bg-[#eef1f6]" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grados                                                              */
/* ------------------------------------------------------------------ */

export const GRADES = [
  { id: "inicial", label: "Inicial" },
  { id: "1ep", label: "1.º grado" },
  { id: "2ep", label: "2.º grado" },
  { id: "3ep", label: "3.º grado" },
  { id: "4ep", label: "4.º grado" },
  { id: "5ep", label: "5.º grado" },
  { id: "6ep", label: "6.º grado" },
  { id: "sec", label: "Secundaria" },
  { id: "libre", label: "Libre" },
] as const;

export function gradeLabel(id: string): string {
  return GRADES.find((g) => g.id === id)?.label ?? id;
}
